<?php
/**
 * ERP AB Malaya - 100% Pure PHP Web Master Sync & Cron Engine
 * File: public/cron_trigger.php
 *
 * Runs background sync processes (Gmail Sync, AI Classification, Quotation Draft,
 * AI Vision OCR, and IMPA Matching) purely within PHP without any Linux CLI / shell_exec dependencies.
 */

error_reporting(0);
ini_set('display_errors', 0);
ignore_user_abort(true);
set_time_limit(60);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    echo json_encode(['status' => 'ok']);
    exit;
}

$start_time = microtime(true);
$logs = [];

try {
    require_once __DIR__ . '/db_connect.php';
    if (!isset($db_conn) || !$db_conn || $db_conn->connect_error) {
        throw new Exception('Database connection failed in cron_trigger.php');
    }

    // ── STEP 1: Live Gmail IMAP Sync ──────────────────────────────────────────
    $emails_pulled = 0;
    if (file_exists(__DIR__ . '/api_fetch_live_gmail.php')) {
        if (!defined('MASTER_CRON_MODE')) {
            define('MASTER_CRON_MODE', true);
        }
        $_GET['cron'] = '1';
        try {
            require_once __DIR__ . '/api_fetch_live_gmail.php';
            $emails_pulled = isset($data) && is_array($data) ? count($data) : 0;
        } catch (Throwable $e) {
            $logs['gmail_sync_error'] = $e->getMessage();
        }
        $logs['gmail_sync'] = "Sync finished. Pulled/Processed {$emails_pulled} email(s).";
    }

    // ── STEP 2: Fast AI Inbox Verification & Classification ───────────────────
    $verified_rfqs = 0;
    $res_unverified = $db_conn->query("SELECT id, subject, message_body, client_email, client_name FROM rfq_requests WHERE (ai_verified = 0 OR ai_classification IS NULL) ORDER BY id DESC LIMIT 5");
    if ($res_unverified && $res_unverified->num_rows > 0) {
        $keys = [];
        $k_q = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' ORDER BY id ASC");
        if ($k_q) {
            while ($kr = $k_q->fetch_assoc()) {
                $k = trim($kr['api_key']);
                if (!empty($k) && strpos($k, '...') === false) $keys[] = $k;
            }
        }
        $keys = array_values(array_unique($keys));

        while ($rfq_row = $res_unverified->fetch_assoc()) {
            $rid = (int)$rfq_row['id'];
            $sbj = $rfq_row['subject'] ?? '';
            $bod = substr(strip_tags($rfq_row['message_body'] ?? ''), 0, 1500);

            $is_rfq = 0;
            $class_label = 'general_inquiry';
            $item_req = $sbj;

            // Fast high-precision heuristic check
            $rfq_keywords = ['rfq', 'quotation', 'inquiry', 'quote', 'tender', 'purchasing', 'requisition', 'urgent inquiry', 'supply', 'spares', 'parts', 'price', 'sebutharga', 'penawaran', 'vecom', 'valve', 'dryer', 'pump'];
            $combined_text = strtolower($sbj . ' ' . $bod);
            foreach ($rfq_keywords as $kw) {
                if (strpos($combined_text, $kw) !== false) {
                    $is_rfq = 1;
                    $class_label = 'client_rfq';
                    break;
                }
            }

            // Quick AI fallback if keys available and keyword didn't match
            if (!$is_rfq && !empty($keys)) {
                $prompt = "Classify this maritime procurement email:\nSubject: {$sbj}\nBody: {$bod}\nIs this a client RFQ? Reply JSON: {\"is_rfq\": true/false, \"classification\": \"client_rfq\"/\"general_inquiry\", \"item_requested\": \"short summary\"}";
                $chosen_key = $keys[array_rand($keys)];
                if (strpos($chosen_key, 'AIza') === 0 || strpos($chosen_key, 'AQ.') === 0) {
                    $u = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . urlencode($chosen_key);
                    $ch = curl_init($u);
                    curl_setopt_array($ch, [
                        CURLOPT_POST => true,
                        CURLOPT_POSTFIELDS => json_encode(['contents' => [['parts' => [['text' => $prompt]]]]]),
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_TIMEOUT => 3,
                        CURLOPT_HTTPHEADER => ['Content-Type: application/json']
                    ]);
                    $ai_res = curl_exec($ch);
                    $http_c = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    curl_close($ch);

                    if ($http_c === 200 && !empty($ai_res)) {
                        $ai_dec = json_decode($ai_res, true);
                        $txt = $ai_dec['candidates'][0]['content']['parts'][0]['text'] ?? '';
                        $txt = trim(preg_replace('/^```json\s*/i', '', preg_replace('/\s*```$/i', '', trim($txt))));
                        $parsed_ai = json_decode($txt, true);
                        if (is_array($parsed_ai) && isset($parsed_ai['is_rfq'])) {
                            $is_rfq = $parsed_ai['is_rfq'] ? 1 : 0;
                            $class_label = $parsed_ai['classification'] ?? ($is_rfq ? 'client_rfq' : 'general_inquiry');
                            if (!empty($parsed_ai['item_requested'])) {
                                $item_req = $parsed_ai['item_requested'];
                            }
                        }
                    }
                }
            }

            $u_stmt = $db_conn->prepare("UPDATE rfq_requests SET ai_verified = ?, ai_classification = ?, item_requested = ? WHERE id = ?");
            if ($u_stmt) {
                $u_stmt->bind_param("issi", $is_rfq, $class_label, $item_req, $rid);
                $u_stmt->execute();
                $u_stmt->close();
                $verified_rfqs++;
            }
        }
    }
    $logs['ai_classification'] = "Verified {$verified_rfqs} pending email(s).";

    // ── STEP 3: Auto-create Quotations SPH for verified RFQs ──────────────────
    $created_quos = 0;
    $res_create = $db_conn->query("
        SELECT r.* FROM rfq_requests r
        LEFT JOIN quotations q ON q.rfq_id = r.id
        WHERE r.ai_verified = 1 AND r.ai_classification = 'client_rfq' AND q.id IS NULL
        ORDER BY r.id DESC LIMIT 5
    ");
    if ($res_create && $res_create->num_rows > 0) {
        while ($rfq_row = $res_create->fetch_assoc()) {
            $rfq_id = (int)$rfq_row['id'];
            $quo_id = 'QUO-' . time() . '-' . rand(100, 999) . '-' . $created_quos;
            $quo_num = 'SPH-ABM/MY/2026/0' . rand(100, 999);

            $client_email = $rfq_row['client_email'];
            $client_name = !empty($rfq_row['client_name']) ? $rfq_row['client_name'] : ucwords(str_replace(['.', '_', '-'], ' ', explode('@', $client_email)[0]));
            $company_name = !empty($rfq_row['client_company']) ? $rfq_row['client_company'] : $client_name;

            $date_issued = date('Y-m-d');
            $valid_until = date('Y-m-d', strtotime('+14 days'));
            $item_requested = $rfq_row['item_requested'] ?: $rfq_row['subject'];
            $created_by = 'System Automation Pure PHP';
            $tax_percent = 11.00;

            $stmt_quo = $db_conn->prepare("INSERT INTO quotations (id, rfq_id, quotation_number, client_name, client_email, company_name, date_issued, valid_until, subtotal, discount_total, tax_percent, tax_amount, grand_total, notes, status, ocr_scan_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, 0.00, 0.00, ?, 'in_progress', 'pending', ?)");
            if ($stmt_quo) {
                $stmt_quo->bind_param("sissssssdss", $quo_id, $rfq_id, $quo_num, $client_name, $client_email, $company_name, $date_issued, $valid_until, $tax_percent, $item_requested, $created_by);
                if ($stmt_quo->execute()) {
                    $stmt_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, 1.00, 'Package', 0.00, 0.00, 0.00)");
                    if ($stmt_item) {
                        $stmt_item->bind_param("ss", $quo_id, $item_requested);
                        $stmt_item->execute();
                        $stmt_item->close();
                    }
                    $created_quos++;
                }
                $stmt_quo->close();
            }
        }
    }
    $logs['quotation_sync'] = "Auto-created {$created_quos} new SPH Quotation(s).";

    // ── STEP 4: Pure PHP AI Vision OCR & Document Extraction ───────────────────
    $scanned_quos = 0;
    require_once __DIR__ . '/api_ocr_scan.php';

    $res_ocr = $db_conn->query("
        SELECT q.id, q.client_name, q.client_email,
               r.attachment_url, r.subject, r.message_body, r.item_requested, r.quantity_requested, r.client_company, r.client_phone
        FROM quotations q
        INNER JOIN rfq_requests r ON r.id = q.rfq_id
        WHERE (q.ocr_scan_status IN ('pending', 'skipped', 'waiting', 'waiting_ai_limit') OR q.ocr_scan_status IS NULL)
          AND (q.ocr_scan_status != 'done')
        ORDER BY q.created_at ASC
        LIMIT 2
    ");

    if ($res_ocr && $res_ocr->num_rows > 0) {
        $ocr_keys = [];
        $k_res = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' ORDER BY id ASC");
        if ($k_res) {
            while ($kr = $k_res->fetch_assoc()) {
                $k = trim($kr['api_key']);
                if (!empty($k) && strpos($k, '...') === false) $ocr_keys[] = $k;
            }
        }
        $ocr_keys = array_values(array_unique($ocr_keys));

        while ($q_row = $res_ocr->fetch_assoc()) {
            $quo_id = $q_row['id'];
            $file_url = $q_row['attachment_url'] ?? '';

            // Mark as processing
            $db_conn->query("UPDATE quotations SET ocr_scan_status = 'processing' WHERE id = '" . $db_conn->real_escape_string($quo_id) . "'");

            $quo_ctx = [
                'client_name'        => $q_row['client_name'],
                'client_email'       => $q_row['client_email'],
                'subject'            => $q_row['subject'],
                'message_body'       => $q_row['message_body'],
                'item_requested'     => $q_row['item_requested'],
                'quantity_requested' => $q_row['quantity_requested'],
                'client_company'     => $q_row['client_company'],
                'client_phone'       => $q_row['client_phone']
            ];

            $scan_result = performOCRScan($file_url, $ocr_keys, $quo_ctx);
            $result_json = json_encode($scan_result, JSON_UNESCAPED_UNICODE);

            $inner_st  = $scan_result['scan_status'] ?? 'done';
            $final_st  = in_array($inner_st, ['done', 'low_quality']) ? 'done' : (in_array($inner_st, ['waiting', 'waiting_ai_limit']) ? 'waiting_ai_limit' : 'done');
            $ext_cat   = $scan_result['category_name'] ?? null;
            $ext_impa  = $scan_result['impa_code'] ?? null;

            $upd = $db_conn->prepare("UPDATE quotations SET ocr_scan_status = ?, ocr_scan_result = ?, category_name = ?, impa_code = ? WHERE id = ?");
            if ($upd) {
                $upd->bind_param('sssss', $final_st, $result_json, $ext_cat, $ext_impa, $quo_id);
                $upd->execute();
                $upd->close();
            }

            // Sync extracted items to quotation_items table
            if (!empty($scan_result['items']) && is_array($scan_result['items'])) {
                $db_conn->query("DELETE FROM quotation_items WHERE quotation_id = '" . $db_conn->real_escape_string($quo_id) . "'");
                $ins_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, product_code, category_code, description, specification, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                if ($ins_item) {
                    foreach ($scan_result['items'] as $it) {
                        $p_code  = $it['product_code'] ?? null;
                        $c_code  = $it['category_code'] ?? $ext_impa;
                        $p_desc  = $it['description'] ?? 'Item';
                        $p_spec  = $it['specification'] ?? null;
                        $p_qty   = isset($it['qty']) ? (float)$it['qty'] : 1.0;
                        $p_unit  = $it['unit'] ?? 'Pcs';
                        $p_price = isset($it['unit_price']) ? (float)$it['unit_price'] : 0.0;
                        $p_disc  = isset($it['discount_percent']) ? (float)$it['discount_percent'] : 0.0;
                        $p_tot   = isset($it['total']) ? (float)$it['total'] : ($p_qty * $p_price);

                        $ins_item->bind_param('sssssdsddd', $quo_id, $p_code, $c_code, $p_desc, $p_spec, $p_qty, $p_unit, $p_price, $p_disc, $p_tot);
                        $ins_item->execute();
                    }
                    $ins_item->close();
                }
            }

            $scanned_quos++;
        }
    }
    $logs['ocr_vision_scan'] = "AI Vision OCR scanned {$scanned_quos} quotation(s).";

    // ── STEP 5: Pure PHP IMPA Category Fuzzy Matching ────────────────────────
    $impa_matched = 0;
    $res_impa_empty = $db_conn->query("SELECT id, category_name, notes FROM quotations WHERE impa_code IS NULL OR impa_code = '' LIMIT 10");
    if ($res_impa_empty && $res_impa_empty->num_rows > 0) {
        $impa_rules = [
            '11' => ['clothing', 'linen', 'uniform', 'overall', 'coverall', 'towel', 'glove'],
            '15' => ['rope', 'corpage', 'hawser', 'mooring', 'wire rope'],
            '21' => ['safety', 'lifejacket', 'lifebuoy', 'extinguisher', 'scba', 'helmet'],
            '23' => ['protective', 'ppe', 'goggles', 'earmuff', 'mask', 'safety shoes', 'boot'],
            '25' => ['nautical', 'navigation', 'chart', 'compass', 'binocular', 'flag', 'gps', 'radar'],
            '33' => ['hand tool', 'wrench', 'spanner', 'hammer', 'plier', 'screwdriver', 'socket'],
            '35' => ['measuring', 'gauge', 'caliper', 'thermometer', 'pressure gauge'],
            '37' => ['metal', 'steel', 'plate', 'sheet', 'bar', 'angle', 'pipe', 'stainless steel'],
            '39' => ['medicine', 'medical', 'first aid', 'bandage', 'pharma', 'drug'],
            '45' => ['petroleum', 'lubricant', 'oil', 'grease', 'hydraulic oil', 'fuel oil'],
            '47' => ['paint', 'thinner', 'primer', 'brush', 'roller', 'coating'],
            '49' => ['hardware', 'stationery', 'paper', 'pen', 'office', 'computer', 'printer'],
            '51' => ['cleaning', 'chemical', 'detergent', 'degreaser', 'soap', 'disinfectant', 'test kit'],
            '53' => ['deck', 'winch', 'crane', 'anchor', 'chain'],
            '59' => ['electrical', 'cable', 'wire', 'lamp', 'bulb', 'switch', 'battery', 'led'],
            '61' => ['pump', 'compressor', 'impeller', 'seal', 'air compressor'],
            '63' => ['engine', 'valve', 'vrc', 'indicator', 'solenoid', 'piston', 'turbocharger', 'dryer'],
            '65' => ['valve', 'pipe', 'fitting', 'flange', 'elbow', 'strainer'],
            '67' => ['insulation', 'packing', 'gasket', 'jointing', 'o-ring'],
            '73' => ['boiler', 'heat exchanger', 'burner', 'tube', 'soot blower'],
            '79' => ['provision', 'food', 'meat', 'fish', 'rice', 'water'],
            '81' => ['welding', 'electrode', 'rod', 'torch', 'gas', 'oxygen', 'argon']
        ];

        while ($iq = $res_impa_empty->fetch_assoc()) {
            $txt = strtolower(($iq['category_name'] ?? '') . ' ' . ($iq['notes'] ?? ''));
            foreach ($impa_rules as $icode => $kw_list) {
                foreach ($kw_list as $kw) {
                    if (strpos($txt, $kw) !== false) {
                        $db_conn->query("UPDATE quotations SET impa_code = '{$icode}' WHERE id = '" . $db_conn->real_escape_string($iq['id']) . "'");
                        $impa_matched++;
                        break 2;
                    }
                }
            }
        }
    }
    $logs['impa_matching'] = "Matched IMPA codes for {$impa_matched} quotation(s).";

} catch (Throwable $e) {
    $logs['fatal_error'] = $e->getMessage();
}

$elapsed = round(microtime(true) - $start_time, 2);

echo json_encode([
    'status'          => isset($logs['fatal_error']) ? 'partial_error' : 'success',
    'message'         => '100% Pure PHP Master Engine executed successfully.',
    'elapsed_seconds' => $elapsed,
    'timestamp'       => date('Y-m-d H:i:s'),
    'details'         => $logs
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
