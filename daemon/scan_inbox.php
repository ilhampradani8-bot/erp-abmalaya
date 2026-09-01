<?php
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
define('SCAN_LIMIT', 30);

function daemon_log(string $msg): void {
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

daemon_log('AI Inbox Scanner Daemon started.');

// Load Gemini API Keys from DB
$gemini_key = '';
$res_key = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'GEMINI_API_KEY'");
if ($res_key && $res_key->num_rows > 0) {
    $gemini_key = trim($res_key->fetch_assoc()['credential_value']);
}
$key_list = !empty($gemini_key) ? array_values(array_filter(array_map('trim', explode(',', $gemini_key)))) : [];

if (empty($key_list)) {
    daemon_log('WARNING: No Gemini API keys found in database. Scan skipped.');
    exit(0);
}
daemon_log('Loaded ' . count($key_list) . ' Gemini API key(s).');

// AI Classification Function
function classifyEmail(string $subject, string $body, string $sender, array $key_list): array {
    $body_short = mb_substr($body, 0, 1500);
    $prompt = "You are a professional logistics AI assistant for AB Malaya industry.\n"
            . "Determine if this email is a genuine client request for quote/SPH (client_rfq) or spam/junk (junk).\n\n"
            . "=== CRITICAL RULES ===\n"
            . "1. CLASSIFY AS 'client_rfq' ONLY IF it is a real request to buy, order, query pricing, or request a quote for goods or services.\n"
            . "2. CLASSIFY AS 'junk' IF the email is: bank receipt, newsletter, promotion, social media, system alert, password reset, bounce message.\n"
            . "3. File attachments (requisition sheets, specs, PDF) are strong indicators of 'client_rfq'.\n\n"
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

    $max_attempts = count($key_list) * 2;
    $errors = [];
    $key_count = count($key_list);

    for ($i = 0; $i < $max_attempts; $i++) {
        $api_key  = $key_list[$i % $key_count];
        $key_short = substr($api_key, -6);
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=' . urlencode($api_key);
        $payload = json_encode([
            'contents'        => [['parts' => [['text' => $prompt]]]],
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
            $errors[] = "Key ...{$key_short}: 429 Rate Limit. Waiting 10s...";
            sleep(10);
            continue;
        }

        $errors[] = "Key ...{$key_short}: HTTP {$http_code}. " . substr($resp, 0, 120);
        if ($http_code === 429) {
            sleep(10);
        } else {
            sleep(2);
        }
    }

    return ['classification' => 'client_rfq', 'item_requested' => null, 'items' => [], 'verified' => 0, 'error' => implode(' | ', $errors)];
}

// Obvious Junk Pre-filter
function isObviousJunk(string $subject, string $body, string $sender): bool {
    $text = strtolower($subject . ' ' . $body . ' ' . $sender);
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
    $quo_num = 'SPH-ABM/MY/2026/0' . rand(100, 999);
    
    $client_email = $rfq_row['client_email'];
    $client_name = explode('@', $client_email)[0];
    $client_name = ucwords(str_replace(['.', '_', '-'], ' ', $client_name));
    $company_name = $client_name;

    $date_issued = date('Y-m-d');
    $valid_until = '14 Days';
    $notes = "Auto-generated from RFQ Requisition: " . ($item_requested ?: $rfq_row['subject']);
    $created_by = 'System Automation Daemon';

    $subtotal = 0.00;
    $items_created = 0;
    $tax_percent = 11.00;

    $stmt_quo = $db_conn->prepare("INSERT INTO quotations (id, rfq_id, quotation_number, client_name, client_email, company_name, date_issued, valid_until, subtotal, discount_total, tax_percent, tax_amount, grand_total, notes, status, ocr_scan_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, 0.00, 0.00, ?, 'requisition', 'pending', ?)");
    if ($stmt_quo) {
        $stmt_quo->bind_param("sissssssdss", $quo_id, $rfq_id, $quo_num, $client_name, $client_email, $company_name, $date_issued, $valid_until, $tax_percent, $notes, $created_by);
        $stmt_quo->execute();
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
        daemon_log("  -> SUCCESS: Created SPH #{$quo_num} with status 'requisition'.");
        appendQuotationHistoryLog($db_conn, $quo_id, 'Create SPH (AI)', 'System Automation', 'system@abmalaya.com', "System classified RFQ and automatically created draft SPH (Grand Total: RM {$grand_total}).");
    }
}

// Load start date cutoff filter
$start_date_limit = '';
$res_start = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key IN ('INBOX_RULE_START_DATE', 'imap_start_date', 'info_start_date') AND credential_value != '' ORDER BY id DESC LIMIT 1");
if ($res_start && $res_start->num_rows > 0) {
    $start_date_limit = trim($res_start->fetch_assoc()['credential_value']);
}

$where_clause = "WHERE ai_verified = 0";
if (!empty($start_date_limit)) {
    $where_clause .= " AND created_at >= '" . $db_conn->real_escape_string($start_date_limit) . " 00:00:00'";
    daemon_log("Ingestion Date Cutoff Active: >= {$start_date_limit}");
}

// Main classification loop
$res = $db_conn->query("SELECT id, rfq_number, subject, message_body, client_email, attachment_url FROM rfq_requests {$where_clause} ORDER BY id ASC LIMIT " . SCAN_LIMIT);

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

        if ($verified) {
            daemon_log("  [AI-OK] #{$rfq_num} → {$classification}");
            $success++;
        } else {
            daemon_log("  [AI-FAIL] #{$rfq_num} → fallback. Error: " . substr($ai_error ?? '', 0, 120));
            $failed++;
        }
        sleep(4);
    }

    $rfq_status = 'received';
    if ($verified) {
        if ($classification === 'client_rfq') {
            $rfq_status = 'in_progress';
            autoGenerateQuotation($db_conn, $row, $items, $item_requested);
        } else {
            $rfq_status = 'junk';
        }
    }

    $upd = $db_conn->prepare("UPDATE rfq_requests SET ai_verified=?, ai_classification=?, ai_error=?, item_requested=?, status=? WHERE rfq_number=?");
    if ($upd) {
        $upd->bind_param('isssss', $verified, $classification, $ai_error, $item_requested, $rfq_status, $rfq_num);
        $upd->execute();
        $upd->close();
        
        if ($verified) {
            if ($classification === 'client_rfq') {
                appendRfqHistoryLog($db_conn, $rfq_num, 'Lolos Automation', 'System Automation', 'system@abmalaya.com', 'Email berhasil diklasifikasikan sebagai Permintaan SPH (client_rfq) dan draf Quotation dibuat otomatis.');
            } else {
                appendRfqHistoryLog($db_conn, $rfq_num, 'Otomatis (AI)', 'System Automation', 'system@abmalaya.com', 'Email otomatis diklasifikasikan sebagai Spam (junk).');
            }
        }
    }
}

daemon_log("Inbox scan complete. Success: {$success} | Failed/Queued: {$failed}");
exit(0);
