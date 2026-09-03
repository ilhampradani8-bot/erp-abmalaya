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

daemon_log('AI OCR Scanner Daemon started.');

// Load Gemini API Keys from DB — dibaca per baris (GEMINI_API_KEY_1, _2, _3, dst.)
$key_list = [];
$res_key = $db_conn->query("SELECT credential_key, credential_value FROM api_credentials WHERE credential_key LIKE 'GEMINI_API_KEY_%' ORDER BY credential_key ASC");
if ($res_key && $res_key->num_rows > 0) {
    while ($row = $res_key->fetch_assoc()) {
        $v = trim($row['credential_value']);
        if (!empty($v)) $key_list[] = $v;
    }
}

// Fallback: format lama (satu baris, pisah koma)
if (empty($key_list)) {
    $res_key2 = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'GEMINI_API_KEY'");
    if ($res_key2 && $res_key2->num_rows > 0) {
        $raw = trim($res_key2->fetch_assoc()['credential_value']);
        $key_list = array_values(array_filter(array_map('trim', explode(',', $raw))));
    }
}

if (empty($key_list)) {
    daemon_log('WARNING: No Gemini API keys found in database. Scan skipped.');
    exit(0);
}
daemon_log('Loaded ' . count($key_list) . ' Gemini API key(s).');

// performOCRScan Helper
function performOCRScan($file_url, array $key_list, array $quo_context) {
    $scanned_at = date('Y-m-d H:i:s');
    $ext = strtolower(pathinfo(parse_url($file_url, PHP_URL_PATH), PATHINFO_EXTENSION));
    $mime_map = [
        'pdf'  => 'application/pdf',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'gif'  => 'image/gif',
        'webp' => 'image/webp',
    ];
    $mime = $mime_map[$ext] ?? 'application/octet-stream';

    // Download using Curl
    $ch_file = curl_init($file_url);
    curl_setopt_array($ch_file, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_USERAGENT      => 'ABMalaya-ERP-OCR/1.0'
    ]);
    $file_data = curl_exec($ch_file);
    $file_code = curl_getinfo($ch_file, CURLINFO_HTTP_CODE);
    curl_close($ch_file);

    if ($file_code !== 200 || !$file_data || strlen($file_data) < 100) {
        return [
            'scan_status'  => 'error',
            'reason'       => "Download failed. HTTP Code: {$file_code} for URL: {$file_url}",
            'scanned_at'   => $scanned_at,
            'file_url'     => $file_url
        ];
    }

    $file_b64 = base64_encode($file_data);

    $prompt = "You are a precise OCR extraction engine for AB Malaya Industry ERP system.\n"
            . "Extract structured data from the attached document image or PDF.\n\n"
            . "1. ITEM DESCRIPTION & SPECIFICATION SPLITTING:\n"
            . "   - 'description': SHORT core item title ONLY (MAX 4-8 WORDS, e.g. 'VALVE POSITION INDICATOR' or 'SOLENOID VALVE'). NEVER put long Maker/Model/Specs text in description!\n"
            . "   - 'product_code': Product/Article Number or CAS No or Ref No if printed (e.g. 'NP145B10' or '1.08325.2500').\n"
            . "   - 'specification': ALL technical details — Maker/Manufacturer, Model Number, Cylinder Capacity, Voltage, Serial Number, and application notes (e.g. 'Maker: Oval Corporation, Japan. Model: NP145B10, calibrated for 74 cc actuator capacity. For Open/Shut valve service...').\n"

            . "2. NOTES & DISPATCH INSTRUCTIONS:\n"
            . "   - 'notes': Capture ALL special remarks, submission instructions, or notes printed on document (e.g. 'Send to fleet@dutamarine.com and file copy onboard. Supplier shall provide latest SDS...').\n"
            . "   - 'delivery_email': If document contains a specific destination/dispatch email in the notes or footer (e.g. 'fleet@dutamarine.com'), set it in 'delivery_email'.\n"
            . "3. VESSEL & CLIENT METADATA:\n"
            . "   - 'company_name': Vessel name or Ordering Company (e.g. 'PERMATA DULANG' or 'Duta Marine').\n"
            . "   - 'client_name': Ordering Officer / Master name if present (e.g. 'Capt Faiz Bin Kamarolzaman').\n\n"
            . "=== CRITICAL ANTI-HALLUCINATION RULES ===\n"
            . "1. ONLY extract data that is EXPLICITLY and CLEARLY VISIBLE in the document.\n"
            . "2. If a field is NOT present or NOT readable, set its value to null. NEVER guess or invent values.\n"
            . "3. Do NOT fabricate company names, registration numbers, addresses, phone numbers, or item descriptions.\n"
            . "4. Do NOT infer prices if they are not clearly printed/typed.\n"
            . "5. If document is blurry, corrupted, or unreadable, return scan_status: 'low_quality'.\n"
            . "6. Do NOT add interpretation or assumptions beyond what is literally written.\n\n"
            . "=== CONTEXT (from email metadata) ===\n"
            . "Sender: {$quo_context['client_name']} <{$quo_context['client_email']}>\n"
            . "Email Subject: {$quo_context['subject']}\n\n"
            . "=== OUTPUT FORMAT ===\n"
            . "Respond ONLY with valid JSON. No markdown, no explanation outside JSON.\n\n"
            . "{\n"
            . "  \"scan_status\": \"done\",\n"
            . "  \"scan_confidence\": \"high\",\n"
            . "  \"document_type\": \"RFQ\",\n"
            . "  \"client_name\": null,\n"
            . "  \"company_name\": null,\n"
            . "  \"registration_number\": null,\n"
            . "  \"email\": null,\n"
            . "  \"phone\": null,\n"
            . "  \"address_1\": null,\n"
            . "  \"address_2\": null,\n"
            . "  \"postcode\": null,\n"
            . "  \"delivery_address_1\": null,\n"
            . "  \"delivery_address_2\": null,\n"
            . "  \"delivery_email\": null,\n"
            . "  \"validity\": null,\n"
            . "  \"valid_until\": null,\n"
            . "  \"notes\": null,\n"
            . "  \"subtotal\": null,\n"
            . "  \"discount_total\": null,\n"
            . "  \"tax_percent\": null,\n"
            . "  \"tax_amount\": null,\n"
            . "  \"grand_total\": null,\n"
            . "  \"items\": [\n"
            . "    {\n"
            . "      \"qty\": 1,\n"
            . "      \"unit\": \"Pcs\",\n"
            . "      \"description\": \"Main product name\",\n"
            . "      \"specification\": \"All technical details, brand, formula, pack size\",\n"
            . "      \"product_code\": \"Article/CAS/Part No\",\n"
            . "      \"unit_price\": null,\n"
            . "      \"discount_percent\": null,\n"
            . "      \"subtotal\": null,\n"
            . "      \"tax\": null,\n"
            . "      \"total\": null\n"
            . "    }\n"
            . "  ],\n"
            . "  \"scanned_at\": \"{$scanned_at}\",\n"
            . "  \"file_url\": \"{$file_url}\"\n"
            . "}";

    $key_count = count($key_list);
    $errors = [];

    for ($i = 0; $i < $key_count * 2; $i++) {
        $api_key = $key_list[$i % $key_count];
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=' . urlencode($api_key);

        $payload = json_encode([
            'contents' => [[
                'parts' => [
                    ['text' => $prompt],
                    [
                        'inline_data' => [
                            'mime_type' => $mime,
                            'data'      => $file_b64
                        ]
                    ]
                ]
            ]],
            'generationConfig' => [
                'temperature'     => 0.0,
                'topP'            => 0.8,
                'maxOutputTokens' => 8192,
                'responseMimeType' => 'application/json'
            ]
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT        => 45,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        ]);
        $resp = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code === 200 && !empty($resp)) {
            $resp_data = json_decode($resp, true);
            $text = $resp_data['candidates'][0]['content']['parts'][0]['text'] ?? '';
            $text = trim(preg_replace('/^```json\s*/i', '', preg_replace('/\s*```$/', '', trim($text))));
            $parsed = json_decode($text, true);
            if (is_array($parsed)) {
                $parsed['scanned_at'] = $scanned_at;
                $parsed['file_url']   = $file_url;
                if (empty($parsed['scan_status'])) {
                    $parsed['scan_status'] = 'done';
                }
                return $parsed;
            }
        }
        $errors[] = "Key " . substr($api_key, -6) . ": HTTP {$http_code}";
        if ($http_code === 429) {
            sleep(10); // Wait 10 seconds for rate limit to clear
        } else {
            sleep(2); // Wait 2 seconds before retry
        }
    }

    return [
        'scan_status' => 'error',
        'reason'      => implode('; ', $errors),
        'scanned_at'  => $scanned_at,
        'file_url'    => $file_url
    ];
}

// Find pending OCR quotations
$res = $db_conn->query("
    SELECT q.id, q.client_name, q.client_email, r.attachment_url, r.subject
    FROM quotations q
    INNER JOIN rfq_requests r ON r.id = q.rfq_id
    WHERE q.ocr_scan_status = 'pending' AND r.attachment_url IS NOT NULL AND r.attachment_url != ''
    ORDER BY q.created_at ASC
    LIMIT " . SCAN_LIMIT
);

if (!$res || $res->num_rows === 0) {
    daemon_log('No pending SPH Quotation files to OCR scan. Exiting.');
    exit(0);
}

// Check if user is currently performing a priority manual scan
$lock_check = $db_conn->query("SELECT lock_value FROM system_locks WHERE lock_key = 'manual_scan_active' LIMIT 1");
if ($lock_check && $lock_check->num_rows > 0) {
    $lock_time = (int)$lock_check->fetch_assoc()['lock_value'];
    if (time() - $lock_time < 60) { // Active lock within 60s
        daemon_log('Priority Manual User Scan in progress. Pausing background OCR daemon.');
        exit(0);
    }
}

while ($row = $res->fetch_assoc()) {
    $quo_id = $row['id'];
    $file_url = $row['attachment_url'];
    
    daemon_log("Starting Vision OCR Scan for SPH: {$quo_id} — File: " . basename($file_url));
    
    // Mark as processing
    $db_conn->query("UPDATE quotations SET ocr_scan_status = 'processing' WHERE id = '{$quo_id}'");

    $quo_context = [
        'client_name' => $row['client_name'],
        'client_email' => $row['client_email'],
        'subject' => $row['subject']
    ];
    
    $scan_result = performOCRScan($file_url, $key_list, $quo_context);
    $result_json = json_encode($scan_result, JSON_UNESCAPED_UNICODE);
    $new_status = ($scan_result['scan_status'] === 'done') ? 'done' : 'error';

    $upd = $db_conn->prepare("UPDATE quotations SET ocr_scan_status = ?, ocr_scan_result = ? WHERE id = ?");
    if ($upd) {
        $upd->bind_param('sss', $new_status, $result_json, $quo_id);
        $upd->execute();
        $upd->close();
    }

    $log_details = "Background OCR Vision Daemon completed scan. Status: " . strtoupper($new_status);
    if ($new_status === 'error') {
        $log_details .= ". Reason: " . ($scan_result['reason'] ?? 'Unknown error');
    }
    appendQuotationHistoryLog($db_conn, $quo_id, 'OCR Vision Scan', 'OCR Daemon', 'system@abmalaya.com', $log_details);
    
    daemon_log("Finished Vision OCR Scan. Status: " . strtoupper($new_status));
    
    // Sleep to avoid rate limits
    sleep(4);
}

daemon_log('AI OCR Scanner Daemon complete.');
exit(0);
