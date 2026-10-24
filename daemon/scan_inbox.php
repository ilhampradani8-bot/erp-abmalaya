<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
/**
 * ABM Malaya ERP — Background AI Inbox Classification Daemon
 * daemon/scan_inbox.php
 *
 * Runs independently or as part of the scan sequence.
 * Queries all rfq_requests WHERE ai_verified = 0, classifies them
 * using Gemini AI, and auto-generates Quotation (SPH) records.
 */

define('DAEMON_MODE', true);
define('LOG_FILE', __DIR__ . '/logs/scan_inbox_' . date('Y-m-d') . '.log');
define('SCAN_LIMIT', 10); // Process up to 10 emails per run with intelligent key rotation

function daemon_log(string $msg): void {
    $dir = dirname(LOG_FILE);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

// Bootstrap
require_once __DIR__ . '/../public/db_connect.php';

if (!$db_conn || $db_conn->connect_error) {
    daemon_log('FATAL: Cannot connect to MySQL — ' . ($db_conn ? $db_conn->connect_error : 'null'));
    exit(1);
}

// Check if user is currently performing a priority manual scan
$lock_check = $db_conn->query("SELECT lock_value FROM system_locks WHERE lock_key = 'manual_scan_active' LIMIT 1");
if ($lock_check && $lock_check->num_rows > 0) {
    $lock_time = (int)$lock_check->fetch_assoc()['lock_value'];
    if (time() - $lock_time < 60) { // Active lock within 60s
        daemon_log('Priority Manual User Scan in progress. Pausing background Inbox daemon.');
        exit(0);
    }
}

daemon_log('AI Inbox Scanner Daemon started.');

// Load Gemini API Keys for Inbox from dedicated gemini_api_keys table
$key_list = [];
$res_keys = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' AND pool_type = 'inbox' ORDER BY id ASC");
if ($res_keys && $res_keys->num_rows > 0) {
    while ($row = $res_keys->fetch_assoc()) {
        $k = trim($row['api_key']);
        if (!empty($k) && strpos($k, '...') === false) {
            $key_list[] = $k;
        }
    }
}

// Fallback if inbox pool empty
if (empty($key_list)) {
    $res_fallback = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' ORDER BY id ASC");
    if ($res_fallback && $res_fallback->num_rows > 0) {
        while ($row = $res_fallback->fetch_assoc()) {
            $k = trim($row['api_key']);
            if (!empty($k) && strpos($k, '...') === false) $key_list[] = $k;
        }
    }
}
$key_list = array_values(array_unique($key_list));

if (empty($key_list)) {
    daemon_log('WARNING: No Gemini API keys found in database. Scan skipped.');
    exit(0);
}
daemon_log('Loaded ' . count($key_list) . ' Gemini Inbox API key(s).');

// Tracker kunci yang sedang kena 429 (global per siklus daemon)
$GLOBALS['exhausted_keys'] = []; // key => unix timestamp kapan boleh dicoba lagi (cooldown 60s)

// AI Classification Function — Smart Key Rotation
function classifyEmail(string $subject, string $body, string $sender, array $key_list): array {
    $body_short = mb_substr($body, 0, 1500);
    $prompt = "You are a professional logistics AI assistant for AB Malaya industry.\n"
            . "Determine if this email is a genuine client request for quotation / RFQ (client_rfq) or spam/junk (junk).\n\n"
            . "=== CRITICAL RULES ===\n"
            . "1. CLASSIFY AS 'client_rfq' ONLY IF it is an incoming purchase request or RFQ from an external client wanting to buy products/services.\n"
            . "2. CLASSIFY AS 'junk' IF the email is: internal outgoing email, request for tender extension, RFI follow-up sent by sales, bank receipt, newsletter, promotion, social media, system alert, password reset, bounce message.\n"
            . "3. Incoming emails with attached purchase specs, RFQ sheets, or item lists are strong indicators of 'client_rfq'.\n\n"
            . "=== EMAIL DATA ===\n"
            . "Subject: $subject\nSender: $sender\nBody:\n$body_short\n\n"
            . "Respond ONLY with valid JSON. JSON format:\n"
            . "{\n"
            . "  \"classification\": \"client_rfq\",\n"
            . "  \"reason\": \"...\",\n"
            . "  \"item_requested\": \"max 8 words summary or None\",\n"
            . "  \"items\": [\n"
            . "    { \"description\": \"Kettlebell 12 kg\", \"quantity\": 5, \"unit\": \"Unit\" }\n"
            . "  ]\n"
            . "}";

    $key_count = count($key_list);
    $errors    = [];
    $now       = time();

    // Cek apakah SEMUA kunci sedang dalam cooldown 429 → abort seluruh siklus
    $active_keys = array_filter($key_list, function($k) use ($now) {
        return !isset($GLOBALS['exhausted_keys'][$k]) || $GLOBALS['exhausted_keys'][$k] <= $now;
    });

    if (empty($active_keys)) {
        daemon_log('ABORT: Semua ' . $key_count . ' kunci Gemini sedang cooldown 429. Siklus dihentikan — tunggu siklus berikutnya.');
        return ['classification' => 'abort_cycle', 'item_requested' => null, 'items' => [], 'verified' => 0, 'error' => 'all_keys_exhausted'];
    }

    $inbox_models = function_exists('getGeminiActiveModels') ? getGeminiActiveModels($active_keys) : [
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash'
    ];

    // Coba setiap kunci aktif (yang belum cooldown) satu kali saja
    foreach ($active_keys as $api_key) {
        $key_short = substr($api_key, -6);
        foreach ($inbox_models as $model_name) {
            $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model_name . ':generateContent?key=' . urlencode($api_key);
            $payload = json_encode([
                'contents'         => [['parts' => [['text' => $prompt]]]],
                'generationConfig' => ['responseMimeType' => 'application/json']
            ]);

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $payload,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_TIMEOUT        => 30,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            ]);
            $resp      = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($http_code === 200 && !empty($resp)) {
                $api_data = json_decode($resp, true);
                $raw_text = $api_data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                $raw_text = trim(preg_replace('/^```json\s*/i', '', preg_replace('/\s*```$/', '', $raw_text)));
                $parsed   = json_decode($raw_text, true);
                if ($parsed && isset($parsed['classification'])) {
                    return [
                        'classification' => $parsed['classification'],
                        'item_requested' => $parsed['item_requested'] ?? null,
                        'items'          => $parsed['items'] ?? [],
                        'verified'       => 1,
                        'error'          => null,
                    ];
                }
            }

            if ($http_code === 429) {
                // Tandai kunci ini cooldown selama 60 detik
                $GLOBALS['exhausted_keys'][$api_key] = $now + 60;
                $errors[] = "[{$model_name}] Key ...{$key_short}: 429 Rate Limit → cooldown 60s";
                break; // Break inner model loop to rotate to next key
            }

            $errors[] = "[{$model_name}] Key ...{$key_short}: HTTP {$http_code}. " . substr($resp, 0, 120);
            sleep(1); // Delay minimal untuk error non-429
        }
    }

    // Cek lagi setelah semua kunci aktif dicoba — jika semua kena 429 sekarang, abort
    $still_active = array_filter($key_list, function($k) {
        return !isset($GLOBALS['exhausted_keys'][$k]) || $GLOBALS['exhausted_keys'][$k] <= time();
    });

    if (empty($still_active)) {
        daemon_log('ABORT: Semua kunci habis setelah percobaan. Siklus dihentikan.');
        return ['classification' => 'abort_cycle', 'item_requested' => null, 'items' => [], 'verified' => 0, 'error' => 'all_keys_exhausted'];
    }

    return ['classification' => 'client_rfq', 'item_requested' => null, 'items' => [], 'verified' => 0, 'error' => implode(' | ', $errors)];
}


// Obvious Junk Pre-filter
function isObviousJunk(string $subject, string $body, string $sender): bool {
    $text = strtolower($subject . ' ' . $body . ' ' . $sender);

    // Auto-junk outgoing request for extension of tender date or internal RFI sent by sales
    if (preg_match('/(extension of tender|request for extension|extension date|penangguhan tender|perpanjangan tender)/i', $text)) {
        return true;
    }

    if (preg_match('/(rfq|sebutharga|tender|bid|quotation|pelawaan|perolehan|estimating|specification|inquiry|requisition)/i', $text)) {
        return false;
    }
    $junk_patterns = [
        'noreply@', 'no-reply@', 'mailer-daemon', 'postmaster@',
        'unsubscribe', 'newsletter', 'password reset', 'account verification',
        'bank transfer', 'payment receipt', 'deposit notice', 'maybank',
        'linkedin', 'facebook', 'instagram', 'twitter', 'tiktok',
        'delivery failure', 'bounce', 'out of office',
    ];
    foreach ($junk_patterns as $p) {
        if (str_contains($text, $p)) return true;
    }
    return false;
}

// Quotation Auto-generator
function autoGenerateQuotation($db_conn, $rfq_row, $items, $item_requested) {
    $rfq_id = (int)$rfq_row['id'];
    $rfq_num = $rfq_row['rfq_number'];

    $check = $db_conn->query("SELECT id FROM quotations WHERE rfq_id = {$rfq_id} LIMIT 1");
    if ($check && $check->num_rows > 0) {
        daemon_log("  -> Quotation already exists for RFQ #{$rfq_num}. Skipping.");
        return;
    }

    $quo_id = 'QUO-' . time() . '-' . rand(10, 99);
    $quo_num = 'QUO-ABM/MY/' . date('Y') . '/0' . rand(100, 999);
    
    $client_email = $rfq_row['client_email'];
    $client_name = explode('@', $client_email)[0];
    $client_name = ucwords(str_replace(['.', '_', '-'], ' ', $client_name));
    $company_name = $client_name;

    $date_issued = date('Y-m-d');
    $valid_until = date('Y-m-d', strtotime('+14 days'));
    $notes = $item_requested ?: $rfq_row['subject'];
    $created_by = 'System Automation Daemon';

    $subtotal = 0.00;
    $items_created = 0;
    $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
    $stmt_quo = $db_conn->prepare("INSERT INTO quotations (id, uuid, rfq_id, quotation_number, client_name, client_email, company_name, date_issued, valid_until, subtotal, discount_total, tax_percent, tax_amount, grand_total, notes, status, ocr_scan_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, 0.00, 0.00, ?, 'in_progress', 'pending', ?)");
    if ($stmt_quo) {
        $stmt_quo->bind_param("ssissssssdss", $quo_id, $uuid, $rfq_id, $quo_num, $client_name, $client_email, $company_name, $date_issued, $valid_until, $tax_percent, $notes, $created_by);
        if (!$stmt_quo->execute()) {
            daemon_log("  -> ERROR executing parent quotation insert: " . $stmt_quo->error);
            return;
        }
        $stmt_quo->close();
    } else {
        daemon_log("  -> ERROR preparing parent quotation: " . $db_conn->error);
        return;
    }
    
    if (!empty($items) && is_array($items)) {
        foreach ($items as $item) {
            $desc = isset($item['description']) ? trim($item['description']) : '';
            if (empty($desc)) continue;

            $qty = isset($item['quantity']) ? (float)$item['quantity'] : 1.00;
            $unit = isset($item['unit']) ? trim($item['unit']) : 'Unit';
            $unit_price = 0.00;

            $search_term = '%' . $desc . '%';
            $stmt_prod = $db_conn->prepare("SELECT unit_price FROM products WHERE product_name LIKE ? OR description LIKE ? LIMIT 1");
            if ($stmt_prod) {
                $stmt_prod->bind_param("ss", $search_term, $search_term);
                $stmt_prod->execute();
                $res_prod = $stmt_prod->get_result();
                if ($res_prod && $res_prod->num_rows > 0) {
                    $prod_row = $res_prod->fetch_assoc();
                    $unit_price = (float)$prod_row['unit_price'];
                }
                $stmt_prod->close();
            }

            $total_item = $qty * $unit_price;
            $subtotal += $total_item;

            $stmt_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, 0.00, ?)");
            if ($stmt_item) {
                $stmt_item->bind_param("ssdsdd", $quo_id, $desc, $qty, $unit, $unit_price, $total_item);
                $stmt_item->execute();
                $stmt_item->close();
                $items_created++;
            }
        }
    }

    if ($items_created === 0) {
        $desc = $item_requested ?: 'Industrial Equipment Specification';
        $qty = 1.00;
        $unit = 'Package';
        $unit_price = 0.00;
        $total_item = 0.00;

        $stmt_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, 0.00, ?)");
        if ($stmt_item) {
            $stmt_item->bind_param("ssdsdd", $quo_id, $desc, $qty, $unit, $unit_price, $total_item);
            $stmt_item->execute();
            $stmt_item->close();
        }
    }

    $tax_amount = round($subtotal * 0.11, 2);
    $grand_total = $subtotal + $tax_amount;

    $stmt_upd = $db_conn->prepare("UPDATE quotations SET subtotal = ?, tax_amount = ?, grand_total = ? WHERE id = ?");
    if ($stmt_upd) {
        $stmt_upd->bind_param("ddds", $subtotal, $tax_amount, $grand_total, $quo_id);
        $stmt_upd->execute();
        $stmt_upd->close();
        daemon_log("  -> SUCCESS: Created Quotation #{$quo_num} with status 'requisition'.");
        appendQuotationHistoryLog($db_conn, $quo_id, 'Create Quotation (AI)', 'Daemon System', null, "RFQ classification complete and Quotation draft successfully created (Grand Total: RM {$grand_total}).");
    }
}

// Load start date cutoff filter & priority rule
$start_date_limit = '';
$res_start = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key IN ('INBOX_RULE_START_DATE', 'imap_start_date', 'info_start_date') AND credential_value != '' ORDER BY id DESC LIMIT 1");
if ($res_start && $res_start->num_rows > 0) {
    $start_date_limit = trim($res_start->fetch_assoc()['credential_value']);
}

$prioritize_pdf = true; // Default prioritize emails with attachments
$res_prio = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'INBOX_RULE_PRIORITIZE_PDF'");
if ($res_prio && $res_prio->num_rows > 0) {
    $prioritize_pdf = trim($res_prio->fetch_assoc()['credential_value']) === 'true';
}

$where_clause = "WHERE ai_verified = 0";
if (!empty($start_date_limit)) {
    $where_clause .= " AND created_at >= '" . $db_conn->real_escape_string($start_date_limit) . " 00:00:00'";
    daemon_log("Ingestion Date Cutoff Active: >= {$start_date_limit}");
}

// Priority sorting: Emails WITH ATTACHMENTS first (Priority 0), then newest emails first (id DESC)
$order_by = "ORDER BY ";
if ($prioritize_pdf) {
    $order_by .= "(CASE WHEN (attachment_url IS NOT NULL AND attachment_url != '' AND attachment_url != 'NONE' AND attachment_url != '[]') THEN 0 ELSE 1 END) ASC, ";
}
$order_by .= "id DESC";

// Main classification loop
$res = $db_conn->query("SELECT id, rfq_number, subject, message_body, client_email, attachment_url FROM rfq_requests {$where_clause} {$order_by} LIMIT " . SCAN_LIMIT);

if (!$res || $res->num_rows === 0) {
    daemon_log('No pending emails to scan. Exiting.');
    exit(0);
}

$total = $res->num_rows;
daemon_log("Found {$total} email(s) pending AI classification.");
$success = 0;
$failed = 0;

while ($row = $res->fetch_assoc()) {
    $rfq_num = $row['rfq_number'];
    $subject = $row['subject'];
    $body    = $row['message_body'];
    $sender  = $row['client_email'];

    $classification = '';
    $item_requested = null;
    $items = [];
    $verified = 0;
    $ai_error = null;

    // ⚡ Blacklist check: If blacklisted, auto mark as deleted and bypass AI
    $bl_check = isEmailBlacklisted($db_conn, $sender);
    if ($bl_check['blacklisted']) {
        $classification = 'blacklisted';
        $verified       = 1;
        $bl_reason      = $bl_check['reason'];
        $ai_error       = 'Otomatis diabaikan oleh mesin: Email masuk dalam daftar Blacklist (' . $bl_reason . ')';
        $db_conn->query("UPDATE rfq_requests SET status = 'deleted', is_blacklisted = 1, blacklist_reason = '" . $db_conn->real_escape_string($bl_reason) . "', ai_verified = 1, ai_classification = 'blacklisted', ai_error = '" . $db_conn->real_escape_string($ai_error) . "' WHERE id = " . intval($row['id']));
        daemon_log("  [BLACKLIST-FILTER] #{$rfq_num} — Ignored by machine. Reason: {$bl_reason}");
        $success++;
        continue;
    }

    if (isObviousJunk($subject, $body, $sender)) {
        $classification = 'junk';
        $verified       = 1;
        daemon_log("  [JUNK-FILTER] #{$rfq_num} — \"{$subject}\"");
    } else {
        $result         = classifyEmail($subject, $body, $sender, $key_list);
        $classification = $result['classification'];
        $item_requested = $result['item_requested'];
        $items          = $result['items'] ?? [];
        $verified       = $result['verified'];
        $ai_error       = $result['error'];

        // ABORT: semua kunci kena rate limit — hentikan siklus, jangan proses email berikutnya
        if ($classification === 'abort_cycle') {
            daemon_log("ABORT CYCLE: Semua {" . count($key_list) . "} kunci rate-limited. Sisa email akan diproses di siklus berikutnya (5 menit lagi).");
            break;
        }

        if ($verified) {
            daemon_log("  [AI-OK] #{$rfq_num} → {$classification}");
            $success++;
        } else {
            daemon_log("  [AI-FAIL] #{$rfq_num} → fallback. Error: " . substr($ai_error ?? '', 0, 120));
            $failed++;
        }
        sleep(3); // jeda antar email agar tidak burst
    }


    $rfq_status = 'masuk';
    if ($verified) {
        if ($classification === 'client_rfq') {
            $rfq_status = 'diproses';
            autoGenerateQuotation($db_conn, $row, $items, $item_requested);
        } else {
            $rfq_status = 'junk';
        }
    }

    $upd = $db_conn->prepare("UPDATE rfq_requests SET ai_verified=?, ai_classification=?, ai_error=?, item_requested=?, status=? WHERE rfq_number=?");
    if ($upd) {
        $ai_err_str = $ai_error ?? '';
        $item_req_str = $item_requested ?? '';
        $upd->bind_param('isssss', $verified, $classification, $ai_err_str, $item_req_str, $rfq_status, $rfq_num);
        if (!$upd->execute()) {
            daemon_log("  -> ERROR updating RFQ #{$rfq_num}: " . $upd->error);
        }
        $upd->close();
        
        if ($verified) {
            if ($classification === 'client_rfq') {
                appendRfqHistoryLog($db_conn, $rfq_num, 'Passed Verification', 'Daemon System', null, 'Email successfully classified as Quotation Request (client_rfq) and Quotation draft created.');
            } else {
                appendRfqHistoryLog($db_conn, $rfq_num, 'Classification (AI)', 'Daemon System', null, 'Email classified as Spam (junk).');
            }
        }
    }
}

daemon_log("Inbox scan complete. Success: {$success} | Failed/Queued: {$failed}");
exit(0);
