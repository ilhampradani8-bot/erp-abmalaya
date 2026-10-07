<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
/**
 * ABM Malaya ERP — Background AI Vision OCR Scanner Daemon
 * daemon/scan_ocr.php
 *
 * Runs independently or as part of the scan sequence.
 * Queries all quotations WHERE ocr_scan_status = 'pending' (and linked RFQ has attachment),
 * performs Gemini Vision OCR scan, and saves the structured meta results.
 */

define('DAEMON_MODE', true);
define('LOG_FILE', __DIR__ . '/logs/scan_ocr_' . date('Y-m-d') . '.log');
define('SCAN_LIMIT', 10); // vision scans per run

function daemon_log(string $msg): void {
    $dir = dirname(LOG_FILE);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

// Bootstrap
require_once __DIR__ . '/../public/db_connect.php';
require_once __DIR__ . '/../public/api_ocr_scan.php';

if (!$db_conn || $db_conn->connect_error) {
    daemon_log('FATAL: Cannot connect to MySQL — ' . ($db_conn ? $db_conn->connect_error : 'null'));
    exit(1);
}

daemon_log('AI OCR Scanner Daemon started.');

// Load Gemini API Keys for OCR from dedicated gemini_api_keys table
$key_list = [];
$res_keys = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' AND pool_type = 'ocr' ORDER BY id ASC");
if ($res_keys && $res_keys->num_rows > 0) {
    while ($row = $res_keys->fetch_assoc()) {
        $k = trim($row['api_key']);
        if (!empty($k) && strpos($k, '...') === false) {
            $key_list[] = $k;
        }
    }
}

// Fallback if OCR pool empty
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
daemon_log('Loaded ' . count($key_list) . ' Gemini OCR API key(s).');

$res = $db_conn->query("
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
    LIMIT 50
");

if (!$res || $res->num_rows === 0) {
    daemon_log('No pending, skipped, or waiting SPH Quotations to scan. Exiting.');
    exit(0);
}

// Check if user is currently performing a priority manual scan
$lock_check = $db_conn->query("SELECT lock_value FROM system_locks WHERE lock_key = 'manual_scan_active' LIMIT 1");
if ($lock_check && $lock_check->num_rows > 0) {
    $lock_time = (int)$lock_check->fetch_assoc()['lock_value'];
    if (time() - $lock_time < 60) {
        daemon_log('Priority Manual User Scan in progress. Pausing background OCR daemon.');
        exit(0);
    }
}

while ($row = $res->fetch_assoc()) {
    $quo_id = $row['id'];
    $file_url = $row['attachment_url'] ?? '';
    
    daemon_log("Starting AI OCR/Text Extraction for SPH: {$quo_id} — Attachment: " . ($file_url ?: 'NONE (Text Inquiry)'));
    
    // Mark as processing
    $db_conn->query("UPDATE quotations SET ocr_scan_status = 'processing' WHERE id = '{$quo_id}'");

    $quo_context = [
        'client_name'        => $row['client_name'],
        'client_email'       => $row['client_email'],
        'subject'            => $row['subject'],
        'message_body'       => $row['message_body'],
        'item_requested'     => $row['item_requested'],
        'quantity_requested' => $row['quantity_requested'],
        'client_company'     => $row['client_company'],
        'client_phone'       => $row['client_phone']
    ];
    
    $scan_result = performOCRScan($file_url, $key_list, $quo_context);
    $result_json = json_encode($scan_result, JSON_UNESCAPED_UNICODE);
    
    $inner_status = $scan_result['scan_status'] ?? 'error';
    $new_status   = in_array($inner_status, ['done', 'low_quality']) ? 'done' : (in_array($inner_status, ['waiting', 'waiting_ai_limit']) ? 'waiting_ai_limit' : 'error');

    if ($new_status === 'waiting_ai_limit') {
        daemon_log("Scan result for SPH {$quo_id}: WAITING_AI_LIMIT (Gemini API rate limited — Re-queued for auto-retry)");
    }

    // Update phone & email if extracted
    $extracted_phone = isset($scan_result['phone']) && !empty($scan_result['phone']) ? trim($scan_result['phone']) : null;
    $extracted_delivery_email = isset($scan_result['delivery_email']) && !empty($scan_result['delivery_email']) ? trim($scan_result['delivery_email']) : (isset($scan_result['email']) && !empty($scan_result['email']) ? trim($scan_result['email']) : null);

    if (!empty($extracted_phone)) {
        $upd_phone = $db_conn->prepare("UPDATE quotations SET client_phone = ? WHERE id = ?");
        if ($upd_phone) {
            $upd_phone->bind_param('ss', $extracted_phone, $quo_id);
            $upd_phone->execute();
            $upd_phone->close();
        }
    }

    if (!empty($extracted_delivery_email)) {
        $raw_ce = $row['client_email'] ?? null;
        if (!empty($raw_ce)) {
            $ce_json = json_decode($raw_ce, true);
            $sender_email = (is_array($ce_json) && !empty($ce_json['selected'])) ? $ce_json['selected'] : (filter_var($raw_ce, FILTER_VALIDATE_EMAIL) ? $raw_ce : null);
        } else {
            $sender_email = null;
        }
        $json_email = json_encode([
            'selected' => $extracted_delivery_email,
            'options' => [
                ['email' => $sender_email, 'source' => 'Sender Email (Live Gmail)'],
                ['email' => $extracted_delivery_email, 'source' => 'Dispatch Email (OCR / Notes)']
            ]
        ], JSON_UNESCAPED_UNICODE);

        $upd_email = $db_conn->prepare("UPDATE quotations SET client_email = ? WHERE id = ?");
        if ($upd_email) {
            $upd_email->bind_param('ss', $json_email, $quo_id);
            $upd_email->execute();
            $upd_email->close();
        }
    }

    $extracted_cat  = $scan_result['category_name'] ?? null;
    $extracted_impa = $scan_result['impa_code']      ?? null;

    $upd = $db_conn->prepare("UPDATE quotations SET ocr_scan_status = ?, ocr_scan_result = ?, category_name = ?, impa_code = ? WHERE id = ?");
    if ($upd) {
        $upd->bind_param('sssss', $new_status, $result_json, $extracted_cat, $extracted_impa, $quo_id);
        $upd->execute();
        $upd->close();
    }

    // AUTO-SYNC EXTRACTED ITEMS TO quotation_items TABLE
    if (!empty($scan_result['items']) && is_array($scan_result['items'])) {
        $db_conn->query("DELETE FROM quotation_items WHERE quotation_id = '" . $db_conn->real_escape_string($quo_id) . "'");
        $ins_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, product_code, category_code, description, specification, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        if ($ins_item) {
            foreach ($scan_result['items'] as $it) {
                $p_code  = $it['product_code'] ?? null;
                $c_code  = $it['category_code'] ?? $extracted_impa;
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

    $item_count = isset($scan_result['items']) && is_array($scan_result['items']) ? count($scan_result['items']) : 0;
    $log_details = "Background OCR/Text Daemon completed scan. Status: " . strtoupper($new_status) . ". Items extracted: " . $item_count;
    if ($new_status === 'error') {
        $log_details .= ". Reason: " . ($scan_result['reason'] ?? 'Unknown error');
    }
    $actor_name = 'Sistem Daemon';
    $actor_email = null;
    appendQuotationHistoryLog($db_conn, $quo_id, 'OCR / Text AI Scan', $actor_name, $actor_email, $log_details);
    
    daemon_log("Finished scan for {$quo_id}. Status: " . strtoupper($new_status) . " ({$item_count} items extracted)");
    
    // Brief pause between items
    sleep(2);
}

daemon_log('AI OCR Scanner Daemon complete.');
exit(0);

