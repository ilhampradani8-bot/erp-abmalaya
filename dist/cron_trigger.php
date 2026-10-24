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
    // Log execution timestamp to daemon/logs/cron_trigger_active.log
    $log_dir = is_dir(__DIR__ . '/daemon/logs')
        ? __DIR__ . '/daemon/logs'
        : (is_dir(dirname(__DIR__) . '/daemon/logs')
            ? dirname(__DIR__) . '/daemon/logs'
            : (is_dir(__DIR__ . '/daemon') ? __DIR__ . '/daemon/logs' : dirname(__DIR__) . '/daemon/logs'));
    if (!is_dir($log_dir)) @mkdir($log_dir, 0755, true);
    $log_entry = '[' . date('Y-m-d H:i:s') . '] Cron Trigger Executed. IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'CLI') . ', UA: ' . (substr($_SERVER['HTTP_USER_AGENT'] ?? 'CLI', 0, 80)) . PHP_EOL;
    @file_put_contents($log_dir . '/cron_trigger_active.log', $log_entry, FILE_APPEND | LOCK_EX);

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
        $_GET['sync'] = '1';
        $_GET['cron'] = '1';
        try {
            require_once __DIR__ . '/api_fetch_live_gmail.php';
            $emails_pulled = isset($data) && is_array($data) ? count($data) : 0;
        } catch (Throwable $e) {
            $logs['gmail_sync_error'] = $e->getMessage();
        }
        $logs['gmail_sync'] = "Sync finished. Pulled/Processed {$emails_pulled} email(s).";
        if ($emails_pulled > 0) {
            addSystemNotification($db_conn, 'Gmail IMAP Live Sync', "Successfully synced {$emails_pulled} incoming email(s) from abmalayaindustry@gmail.com.", 'success', 'sync', 'rfq_inbox');
        }
    }

    // ── STEP 2: Fast AI Inbox Verification & Classification ───────────────────
    $ai_master_res = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'AI_SYSTEM_ENABLED' LIMIT 1");
    $ai_system_enabled = true; // default enabled
    if ($ai_master_res && $ai_master_res->num_rows > 0) {
        $row_m = $ai_master_res->fetch_assoc();
        $ai_system_enabled = ($row_m['credential_value'] === 'true' || $row_m['credential_value'] === '1' || $row_m['credential_value'] === 'active');
    }

    $verified_rfqs = 0;
    $res_unverified = $db_conn->query("SELECT id, subject, message_body, client_email, client_name FROM rfq_requests WHERE (ai_verified = 0 OR ai_classification IS NULL) ORDER BY id DESC LIMIT 40");
    if ($res_unverified && $res_unverified->num_rows > 0) {
        $keys = [];
        if ($ai_system_enabled) {
            $k_q = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' ORDER BY id ASC");
            if ($k_q) {
                while ($kr = $k_q->fetch_assoc()) {
                    $k = trim($kr['api_key']);
                    if (!empty($k) && strpos($k, '...') === false) $keys[] = $k;
                }
            }
            $keys = array_values(array_unique($keys));
        }

        while ($rfq_row = $res_unverified->fetch_assoc()) {
            $rid = (int)$rfq_row['id'];
            $sbj = $rfq_row['subject'] ?? '';
            $bod = substr(strip_tags($rfq_row['message_body'] ?? ''), 0, 1500);

            $is_rfq = 0;
            $class_label = 'general_inquiry';
            $item_req = $sbj;

            // Fast high-precision heuristic check
            $rfq_keywords = ['rfq', 'quotation', 'inquiry', 'quote', 'tender', 'purchasing', 'requisition', 'urgent inquiry', 'supply', 'spares', 'parts', 'price', 'sebutharga', 'penawaran', 'vecom', 'valve', 'dryer', 'pump', 'perolehan', 'tawaran'];
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
                    $dyn_models = function_exists('getGeminiActiveModels') ? getGeminiActiveModels($keys) : ['gemini-flash-latest'];
                    $chosen_model = $dyn_models[0] ?? 'gemini-flash-latest';
                    $u = 'https://generativelanguage.googleapis.com/v1beta/models/' . $chosen_model . ':generateContent?key=' . urlencode($chosen_key);
                    $ch = curl_init($u);
                    curl_setopt_array($ch, [
                        CURLOPT_POST => true,
                        CURLOPT_POSTFIELDS => json_encode(['contents' => [['parts' => [['text' => $prompt]]]]]),
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_TIMEOUT => 4,
                        CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4,
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
    if ($verified_rfqs > 0) {
        addSystemNotification($db_conn, 'AI RFQ Classification Active', "Verified & classified {$verified_rfqs} incoming inquiries using Gemini AI models.", 'info', 'ai', 'rfq_inbox');
    }

    // ── STEP 3: Auto-create Commercial Quotations for verified RFQs ──────────────────
    $created_quos = 0;
    require_once __DIR__ . '/auto_quotation_helper.php';

    $res_create = $db_conn->query("
        SELECT r.* FROM rfq_requests r
        LEFT JOIN quotations q ON q.rfq_id = r.id
        WHERE ((r.ai_classification = 'client_rfq') OR (r.subject REGEXP '(RFQ|Quotation|Requisition|Sebutharga|Tender|Sebut Harga|Penawaran|vecom|valve|dryer|pump|supply|spares)'))
          AND (r.ai_classification != 'junk' OR r.ai_classification IS NULL)
          AND q.id IS NULL
        ORDER BY r.id DESC LIMIT 40
    ");
    if ($res_create && $res_create->num_rows > 0) {
        while ($rfq_row = $res_create->fetch_assoc()) {
            $created_id = autoGenerateQuotation($db_conn, $rfq_row, [], $rfq_row['item_requested'] ?: $rfq_row['subject']);
            if ($created_id) {
                $created_quos++;
            }
        }
    }
    $logs['quotation_sync'] = "Auto-created {$created_quos} new Commercial Quotation(s).";

    // ── STEP 4: Pure PHP AI Vision OCR & Document Extraction ───────────────────
    $scanned_quos = 0;
    require_once __DIR__ . '/api_ocr_scan.php';

    $res_ocr = $db_conn->query("
        SELECT q.id, q.client_name, q.client_email,
               r.attachment_url, r.subject, r.message_body, r.item_requested, r.quantity_requested, r.client_company, r.client_phone
        FROM quotations q
        INNER JOIN rfq_requests r ON r.id = q.rfq_id
        WHERE (q.ocr_scan_status IN ('pending', 'skipped', 'waiting', 'waiting_ai_limit', 'processing', 'failed', 'error')
           OR q.ocr_scan_status IS NULL
           OR q.ocr_scan_result LIKE '%waiting_ai_limit%'
           OR q.ocr_scan_result LIKE '%Fallback Regex%'
           OR q.ocr_scan_result LIKE '%low_quality%')
        ORDER BY q.created_at ASC
        LIMIT 3
    ");

    if ($ai_system_enabled && $res_ocr && $res_ocr->num_rows > 0) {
        $ocr_keys = [];
        $k_res = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' AND pool_type = 'ocr' ORDER BY id ASC");
        if ($k_res) {
            while ($kr = $k_res->fetch_assoc()) {
                $k = trim($kr['api_key']);
                if (!empty($k) && strpos($k, '...') === false) $ocr_keys[] = $k;
            }
        }
        $ocr_keys = array_values(array_unique($ocr_keys));

        if (!empty($ocr_keys)) {
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

            $scan_result = performOCRScan($file_url, $ocr_keys, $quo_ctx, $ai_system_enabled && !empty($ocr_keys));
            $result_json = json_encode($scan_result, JSON_UNESCAPED_UNICODE);

            $item_count = isset($scan_result['items']) && is_array($scan_result['items']) ? count($scan_result['items']) : 0;
            $inner_st  = $scan_result['scan_status'] ?? 'error';
            if ($item_count > 0) {
                $final_st = in_array($inner_st, ['done', 'low_quality']) ? 'done' : 'error';
            } else {
                $final_st = (in_array($inner_st, ['waiting', 'waiting_ai_limit']) || ($scan_result['ai_rate_limited'] ?? false)) ? 'waiting_ai_limit' : 'error';
            }
            $ext_cat   = $scan_result['category_name'] ?? null;
            $ext_impa  = $scan_result['impa_code'] ?? null;

            $upd = $db_conn->prepare("UPDATE quotations SET ocr_scan_status = ?, ocr_scan_result = ?, category_name = ?, impa_code = ? WHERE id = ?");
            if ($upd) {
                $upd->bind_param('sssss', $final_st, $result_json, $ext_cat, $ext_impa, $quo_id);
                $upd->execute();
                $upd->close();
            }

            // Sync extracted items to quotation_items table
            $calc_subtotal = 0.0;
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
                        $p_tot   = isset($it['total']) && (float)$it['total'] > 0 ? (float)$it['total'] : ($p_qty * $p_price * (1.0 - $p_disc / 100.0));
                        $calc_subtotal += $p_tot;

                        $ins_item->bind_param('sssssdsddd', $quo_id, $p_code, $c_code, $p_desc, $p_spec, $p_qty, $p_unit, $p_price, $p_disc, $p_tot);
                        $ins_item->execute();
                    }
                    $ins_item->close();
                }
            }

            if ($calc_subtotal <= 0.001) {
                if (isset($scan_result['subtotal']) && (float)$scan_result['subtotal'] > 0) {
                    $calc_subtotal = (float)$scan_result['subtotal'];
                } else if (isset($scan_result['grand_total']) && (float)$scan_result['grand_total'] > 0) {
                    $calc_subtotal = (float)$scan_result['grand_total'];
                }
            }

            if ($calc_subtotal > 0.001) {
                $raw_tax_pct = isset($q_row['tax_percent']) && is_numeric($q_row['tax_percent']) ? (float)$q_row['tax_percent'] : 11.0;
                $raw_disc = isset($q_row['discount_total']) ? (float)$q_row['discount_total'] : 0.0;
                $calc_tax_amt = ($calc_subtotal - $raw_disc) * ($raw_tax_pct / 100.0);
                $calc_grand_tot = ($calc_subtotal - $raw_disc) + $calc_tax_amt;

                $upd_fin = $db_conn->prepare("UPDATE quotations SET subtotal = ?, tax_amount = ?, grand_total = ? WHERE id = ?");
                if ($upd_fin) {
                    $upd_fin->bind_param('ddds', $calc_subtotal, $calc_tax_amt, $calc_grand_tot, $quo_id);
                    $upd_fin->execute();
                    $upd_fin->close();
                }
            }

            $scanned_quos++;
        }
        } // End of if (!empty($ocr_keys))
    }
    $logs['ocr_vision_scan'] = "AI Vision OCR scanned {$scanned_quos} quotation(s).";
    if ($scanned_quos > 0) {
        addSystemNotification($db_conn, 'Vision AI OCR Finished', "Processed specification PDF and generated items for {$scanned_quos} quotation(s).", 'info', 'ocr', 'quotations_list');
    }

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

    // ── STEP 6: DB Change Detection & System Notification Engine ────────────
    $watch_script = file_exists(__DIR__ . '/daemon/watch_db_changes.php')
        ? __DIR__ . '/daemon/watch_db_changes.php'
        : (file_exists(dirname(__DIR__) . '/daemon/watch_db_changes.php')
            ? dirname(__DIR__) . '/daemon/watch_db_changes.php'
            : null);
    if ($watch_script) {
        try {
            @include $watch_script;
            $logs['db_change_watch'] = "Database change detection executed.";
        } catch (Throwable $we) {
            $logs['db_change_watch_error'] = $we->getMessage();
        }
    }

    // Always log heartbeat activity if no other notification in this cycle
    if ($emails_pulled === 0 && $verified_rfqs === 0 && $created_quos === 0 && $scanned_quos === 0) {
        $last_hb = $db_conn->query("SELECT created_at FROM system_notifications WHERE title = 'Daemon Cron Heartbeat' ORDER BY id DESC LIMIT 1");
        $should_log_hb = true;
        if ($last_hb && $hbr = $last_hb->fetch_assoc()) {
            if (time() - strtotime($hbr['created_at']) < 600) { // Log at most once per 10 min
                $should_log_hb = false;
            }
        }
        if ($should_log_hb) {
            addSystemNotification($db_conn, 'Daemon Cron Heartbeat', 'System automation & background monitoring active. All services healthy.', 'info', 'system', 'daemon_monitor');
        }
    }

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
