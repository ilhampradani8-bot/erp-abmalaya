<?php
/**
 * ABM Malaya ERP — OCR Scan API Endpoint
 * public/api_ocr_scan.php
 *
 * Triggers Gemini Vision OCR scan for a specific quotation's attached RFQ file.
 * Updates quotations.ocr_scan_status and quotations.ocr_scan_result in MySQL.
 *
 * GET  /api_ocr_scan.php?quo_id=QUO-xxx        — get current scan result
 * POST /api_ocr_scan.php { "quo_id": "QUO-xxx" } — trigger a scan
 */

error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    echo json_encode(['status' => 'ok']);
    exit;
}

try {
    require_once __DIR__ . '/db_connect.php';

    // ── GET: Return existing scan result ──────────────────────────────────────
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $quo_id = isset($_GET['quo_id']) ? trim($_GET['quo_id']) : '';
        if (empty($quo_id)) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'quo_id required']);
            exit;
        }
        $s = $db_conn->prepare("SELECT ocr_scan_status, ocr_scan_result FROM quotations WHERE id = ?");
        if ($s) {
            $s->bind_param('s', $quo_id);
            $s->execute();
            $r = $s->get_result();
            $row = $r->fetch_assoc();
            $s->close();
        }
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'ocr_scan_status' => $row['ocr_scan_status'] ?? 'pending',
            'ocr_scan_result' => $row['ocr_scan_result'] ?? null
        ]);
        exit;
    }

    // ── POST: Trigger OCR Scan ────────────────────────────────────────────────
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw   = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: [];
        $quo_id = isset($input['quo_id']) ? trim($input['quo_id']) : '';

        if (empty($quo_id)) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'quo_id required']);
            exit;
        }

        // Load quotation + its rfq attachment_url
        $s = $db_conn->prepare("
            SELECT q.id, q.rfq_id, q.ocr_scan_status,
                   r.attachment_url, r.client_name, r.client_email, r.subject
            FROM quotations q
            LEFT JOIN rfq_requests r ON r.id = q.rfq_id
            WHERE q.id = ?
            LIMIT 1
        ");
        if (!$s) throw new Exception('DB prepare error');
        $s->bind_param('s', $quo_id);
        $s->execute();
        $res = $s->get_result();
        $quo = $res->fetch_assoc();
        $s->close();

        if (!$quo) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'Quotation not found']);
            exit;
        }

        // Mark as processing
        $db_conn->query("UPDATE quotations SET ocr_scan_status = 'processing' WHERE id = '" . $db_conn->real_escape_string($quo_id) . "'");

        $attachment_url = $quo['attachment_url'] ?? '';

        if (empty($attachment_url)) {
            $db_conn->query("UPDATE quotations SET ocr_scan_status = 'skipped', ocr_scan_result = '{\"scan_status\":\"skipped\",\"reason\":\"No attachment file found for this RFQ\"}' WHERE id = '" . $db_conn->real_escape_string($quo_id) . "'");
            ob_end_clean();
            echo json_encode(['status' => 'skipped', 'message' => 'No attachment found — scan skipped.']);
            exit;
        }

        // Load Gemini API Key
        $gemini_key = '';
        $r_key = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'GEMINI_API_KEY' LIMIT 1");
        if ($r_key && $r_key->num_rows > 0) {
            $gemini_key = trim($r_key->fetch_assoc()['credential_value']);
        }
        $key_list = array_values(array_filter(array_map('trim', explode(',', $gemini_key))));

        if (empty($key_list)) {
            $db_conn->query("UPDATE quotations SET ocr_scan_status = 'error', ocr_scan_result = '{\"scan_status\":\"error\",\"reason\":\"No Gemini API key configured\"}' WHERE id = '" . $db_conn->real_escape_string($quo_id) . "'");
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'No Gemini API key found in database']);
            exit;
        }

        // Perform OCR scan
        $scan_result = performOCRScan($attachment_url, $key_list, $quo);

        // Store result
        $result_json = json_encode($scan_result, JSON_UNESCAPED_UNICODE);
        $new_status = ($scan_result['scan_status'] === 'done') ? 'done' : 'error';

        $upd = $db_conn->prepare("UPDATE quotations SET ocr_scan_status = ?, ocr_scan_result = ? WHERE id = ?");
        if ($upd) {
            $upd->bind_param('sss', $new_status, $result_json, $quo_id);
            $upd->execute();
            $upd->close();
        }

        appendQuotationHistoryLog($db_conn, $quo_id, 'OCR Scan ' . strtoupper($new_status), 'System OCR', 'system@abmalaya.com', "Gemini Vision OCR scan completed. Status: {$new_status}. File: {$attachment_url}");

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'ocr_scan_status' => $new_status,
            'ocr_scan_result' => $scan_result
        ]);
        exit;
    }

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

/**
 * Perform OCR scan using Gemini Vision API.
 * Anti-hallucination prompt: only extracts data EXPLICITLY visible in document.
 */
function performOCRScan(string $file_url, array $key_list, array $quo_context): array {
    $scanned_at = date('Y-m-d H:i:s');

    // Determine MIME type from extension
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

    // Download file content
    $ctx = stream_context_create(['http' => ['timeout' => 20, 'header' => 'User-Agent: ABMalaya-ERP-OCR/1.0']]);
    $file_data = @file_get_contents($file_url, false, $ctx);

    if ($file_data === false || strlen($file_data) < 100) {
        return [
            'scan_status'  => 'error',
            'reason'       => 'Could not download attachment file from URL: ' . $file_url,
            'scanned_at'   => $scanned_at,
            'file_url'     => $file_url
        ];
    }

    $file_b64 = base64_encode($file_data);

    // Anti-hallucination OCR prompt
    $prompt = <<<PROMPT
You are a precise OCR extraction engine for AB Malaya Industry ERP system.
Your task is to extract structured data from the attached document image or PDF.

=== CRITICAL ANTI-HALLUCINATION RULES ===
1. ONLY extract data that is EXPLICITLY and CLEARLY VISIBLE in the document.
2. If a field is NOT present or NOT readable, set its value to null. NEVER guess or invent values.
3. Do NOT fabricate company names, registration numbers, addresses, phone numbers, or item descriptions.
4. Do NOT infer prices if they are not clearly printed/typed.
5. If document is blurry, corrupted, or unreadable, return scan_status: "low_quality".
6. Do NOT add interpretation or assumptions beyond what is literally written.

=== CONTEXT (from email metadata only — do NOT copy these into fields unless confirmed in document) ===
Sender: {$quo_context['client_name']} <{$quo_context['client_email']}>
Email Subject: {$quo_context['subject']}

=== OUTPUT FORMAT ===
Respond ONLY with valid JSON. No markdown, no explanation outside JSON.

{
  "scan_status": "done",
  "scan_confidence": "high",
  "document_type": "RFQ",
  "validity": null,
  "valid_until": null,
  "notes": null,
  "registration_number": null,
  "email": null,
  "phone": null,
  "address_1": null,
  "address_2": null,
  "postcode": null,
  "delivery_address_1": null,
  "delivery_address_2": null,
  "delivery_email": null,
  "items": [
    {
      "qty": 1,
      "unit": "Pcs",
      "description": "Exact text from document",
      "unit_price": null,
      "subtotal": null,
      "tax": null,
      "total": null
    }
  ],
  "grand_total": null,
  "scanned_at": "{$scanned_at}",
  "file_url": "{$file_url}"
}
PROMPT;

    // Try each API key
    $key_count = count($key_list);
    $errors = [];

    for ($i = 0; $i < $key_count * 2; $i++) {
        $api_key = $key_list[$i % $key_count];
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=' . urlencode($api_key);

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
                'temperature'     => 0.0,   // Deterministic — reduces hallucination
                'topP'            => 0.8,
                'maxOutputTokens' => 2048,
                'responseMimeType' => 'application/json'
            ]
        ]);

        $ctx_api = stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  => "Content-Type: application/json\r\n",
                'content' => $payload,
                'timeout' => 45
            ]
        ]);

        $resp = @file_get_contents($url, false, $ctx_api);

        if ($resp === false) {
            $status_code = 500;
            if (isset($http_response_header) && is_array($http_response_header) && count($http_response_header) > 0) {
                if (preg_match('/HTTP\/\d+\.\d+\s+(\d+)/i', $http_response_header[0], $matches)) {
                    $status_code = (int)$matches[1];
                }
            }
            $errors[] = "Key ...{$api_key}: HTTP request failed (Code: {$status_code})";
            if ($status_code === 429) {
                sleep(10); // Wait 10 seconds for rate limit to clear
            } else {
                sleep(2); // Wait 2 seconds before retry
            }
            continue;
        }

        $resp_data = json_decode($resp, true);
        $text = $resp_data['candidates'][0]['content']['parts'][0]['text'] ?? '';

        if (empty($text)) {
            $errors[] = "Key ...{$api_key}: Empty AI response";
            sleep(1);
            continue;
        }

        // Clean JSON from potential markdown wrapping
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

        $errors[] = "Key ...{$api_key}: Invalid JSON in AI response";
        sleep(1);
    }

    return [
        'scan_status' => 'error',
        'reason'      => implode('; ', $errors),
        'scanned_at'  => $scanned_at,
        'file_url'    => $file_url
    ];
}
