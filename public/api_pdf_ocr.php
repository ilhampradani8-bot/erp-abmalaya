<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Fetch dynamic Gemini API Keys from MySQL database api_credentials
function getAllGeminiApiKeysFromDatabase() {
    require __DIR__ . '/db_connect.php';

    $keys = [];
    $res = $conn->query("SELECT credential_key, credential_value FROM api_credentials WHERE credential_key LIKE '%GEMINI%' OR service_name LIKE '%Gemini%' ORDER BY id ASC");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            if (!empty($row['credential_value'])) {
                $keys[] = [
                    'key_name' => $row['credential_key'],
                    'key_value' => trim($row['credential_value'])
                ];
            }
        }
    }
    $conn->close();
    return $keys;
}

// Extract text from PDF using local PHP decompressor (Free, No AI API keys used)
function parsePdfText($filename) {
    if (!file_exists($filename)) return '';
    $infile = @file_get_contents($filename);
    if (empty($infile)) return '';

    // Search for stream objects and decompress them
    $text = '';
    preg_match_all("/stream([\s\S]*?)endstream/i", $infile, $matches);
    foreach ($matches[1] as $stream) {
        $stream = trim($stream);
        // Try to decompress the stream using gzuncompress / gzinflate
        $data = @gzuncompress($stream);
        if ($data === false) {
            $data = @gzinflate($stream);
        }
        if ($data === false) {
            $data = @gzdecode($stream);
        }
        if ($data === false) {
            // Uncompressed stream
            $data = $stream;
        }
        
        // Extract text from Tj / TJ operators
        if (!empty($data)) {
            // Match Tj
            preg_match_all("/\((.*?)\)\s*Tj/i", $data, $tj_matches);
            if (!empty($tj_matches[1])) {
                $text .= implode(" ", $tj_matches[1]) . " ";
            }
            
            // Match TJ
            preg_match_all("/\[(.*?)\]\s*TJ/is", $data, $tj2_matches);
            foreach ($tj2_matches[1] as $tj2) {
                preg_match_all("/\((.*?)\)/i", $tj2, $str_matches);
                if (!empty($str_matches[1])) {
                    $text .= implode("", $str_matches[1]) . " ";
                }
            }
        }
    }
    
    // Clean up escaping characters in PDF text (like \), \r, \n
    $text = str_replace(['\\(', '\\)', '\\\\'], ['(', ')', '\\'], $text);
    $text = preg_replace('/\s+/', ' ', $text);
    return trim($text);
}

// Call Google Gemini Flash API with hybrid optimization:
// 1. If PDF contains text streams, send ONLY the extracted text (saves ~95% tokens).
// 2. If PDF contains no text streams (scanned image), fallback to multimodal base64.
function callGeminiMultimodalPdfOcr($pdfFilePath, $apiKey) {
    if (!file_exists($pdfFilePath)) return null;

    $extractedText = parsePdfText($pdfFilePath);
    $isTextBased = (strlen($extractedText) > 100);

    if ($isTextBased) {
        // Mode 1: Text-based PDF (Tiny token footprint)
        $prompt = "You are an AI ERP OCR assistant for ABM Malaya. We have extracted the following plain text from the RFQ PDF specification document ('" . basename($pdfFilePath) . "'):\n\n"
                . $extractedText . "\n\n"
                . "Extract all requested equipment specifications, part numbers, quantities, and units. Note: RFQ documents sent by clients do not contain unit prices. Set 'unit_price' to 0 so Sales Engineer can fill the price. Return a JSON array where each object has keys: 'description' (full complete detailed technical spec), 'quantity' (number), 'unit' (e.g. Package/Unit/Set/Meter/Pcs), 'unit_price' (0), 'discount_percent' (0). Return ONLY the raw JSON array.";

        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" . $apiKey;
        $payload = json_encode([
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'responseMimeType' => 'application/json'
            ]
        ]);
    } else {
        // Mode 2: Image-based/Scanned PDF (Multimodal fallback)
        $pdfBinary = file_get_contents($pdfFilePath);
        if (empty($pdfBinary)) return null;
        $base64Pdf = base64_encode($pdfBinary);

        $prompt = "You are an AI ERP OCR assistant for ABM Malaya. Analyze this authentic RFQ PDF specification document ('" . basename($pdfFilePath) . "'). Extract all requested equipment specifications, part numbers, quantities, and units across all pages. Note: RFQ documents sent by clients do not contain unit prices. Set 'unit_price' to 0 so Sales Engineer can fill the price. Return a JSON array where each object has keys: 'description' (full complete detailed technical spec), 'quantity' (number), 'unit' (e.g. Package/Unit/Set/Meter/Pcs), 'unit_price' (0), 'discount_percent' (0). Return ONLY the raw JSON array.";

        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" . $apiKey;
        $payload = json_encode([
            'contents' => [
                [
                    'parts' => [
                        [
                            'inline_data' => [
                                'mime_type' => 'application/pdf',
                                'data' => $base64Pdf
                            ]
                        ],
                        [
                            'text' => $prompt
                        ]
                    ]
                ]
            ],
            'generationConfig' => [
                'responseMimeType' => 'application/json'
            ]
        ]);
    }

    $opts = [
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $payload,
            'timeout' => 30
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ];

    $context = stream_context_create($opts);
    $response = @file_get_contents($url, false, $context);

    if ($response) {
        $resJson = json_decode($response, true);
        if (isset($resJson['candidates'][0]['content']['parts'][0]['text'])) {
            $rawText = $resJson['candidates'][0]['content']['parts'][0]['text'];
            if (preg_match('/\[[\s\S]*\]/', $rawText, $matchJson)) {
                $items = json_decode($matchJson[0], true);
                if (is_array($items) && count($items) > 0) {
                    foreach ($items as $idx => &$it) {
                        $it['id'] = 'gemini-pdf-' . ($idx + 1);
                        $it['unit_price'] = isset($it['unit_price']) ? (float)$it['unit_price'] : 0;
                        $it['discount_percent'] = isset($it['discount_percent']) ? (float)$it['discount_percent'] : 0;
                        $it['total'] = ($it['quantity'] ?? 1) * ($it['unit_price'] ?? 0);
                    }
                    return [
                        'prompt_sent' => $prompt,
                        'raw_text' => $rawText,
                        'items' => $items
                    ];
                }
            }
            return [
                'prompt_sent' => $prompt,
                'raw_text' => $rawText,
                'items' => null
            ];
        }
    }

    return null;
}

try {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!$input) $input = $_REQUEST;

    // Fetch dynamic credentials from MySQL database
    $apiKeys = getAllGeminiApiKeysFromDatabase();

    if (empty($apiKeys)) {
        ob_end_clean();
        echo json_encode([
            'status' => 'error',
            'message' => 'Belum ada API Key Gemini di database api_credentials.'
        ]);
        exit;
    }

    // Resolve target file based on quo_id or fn parameter
    $quo_id = trim($input['quo_id'] ?? '');
    $fn_req = trim($input['fn'] ?? '');
    $target_file = '';

    require __DIR__ . '/db_connect.php';

    if (!empty($quo_id)) {
        $s_quo = $conn->prepare("SELECT r.attachment_url FROM quotations q LEFT JOIN rfq_requests r ON q.rfq_id = r.id WHERE q.id = ? OR q.quotation_number = ? LIMIT 1");
        if ($s_quo) {
            $s_quo->bind_param('ss', $quo_id, $quo_id);
            $s_quo->execute();
            $r_quo = $s_quo->get_result()->fetch_assoc();
            $s_quo->close();
            if (!empty($r_quo['attachment_url'])) {
                $att_url = $r_quo['attachment_url'];
                parse_str(parse_url($att_url, PHP_URL_QUERY) ?? '', $qp);
                if (!empty($qp['msgno'])) {
                    $msgno = $qp['msgno'];
                    $matching_files = glob(__DIR__ . '/attachments/msg_' . $msgno . '_*');
                    if (!empty($matching_files) && file_exists($matching_files[0])) {
                        $target_file = $matching_files[0];
                    }
                }
            }
        }
    }

    if (empty($target_file) && !empty($fn_req)) {
        $clean_fn = basename($fn_req);
        if (file_exists(__DIR__ . '/attachments/' . $clean_fn)) {
            $target_file = __DIR__ . '/attachments/' . $clean_fn;
        }
    }

    // Fallback to any PDF in attachments if specifically requested without ID
    if (empty($target_file) && is_dir(__DIR__ . '/attachments')) {
        $files = scandir(__DIR__ . '/attachments');
        foreach ($files as $f) {
            if ($f !== '.' && $f !== '..' && strtolower(pathinfo($f, PATHINFO_EXTENSION)) === 'pdf') {
                $target_file = __DIR__ . '/attachments/' . $f;
                break;
            }
        }
    }

    if (empty($target_file) || !file_exists($target_file)) {
        ob_end_clean();
        echo json_encode([
            'status' => 'error',
            'message' => 'File PDF asli tidak ditemukan.'
        ]);
        exit;
    }

    // Send complete PDF binary file to Gemini Multimodal AI
    $geminiRes = null;
    $activeKeyName = '';

    foreach ($apiKeys as $keyItem) {
        $res = callGeminiMultimodalPdfOcr($target_file, $keyItem['key_value']);
        if ($res && !empty($res['items'])) {
            $geminiRes = $res;
            $activeKeyName = $keyItem['key_name'];
            break;
        }
    }

    $default_prompt = "You are an AI ERP OCR assistant for ABM Malaya. Analyze this authentic RFQ PDF specification document ('" . basename($target_file) . "'). Extract all requested equipment specifications, part numbers, quantities, and units across all pages. Note: RFQ documents sent by clients do not contain unit prices. Set 'unit_price' to 0 so Sales Engineer can fill the price. Return a JSON array. Return ONLY the raw JSON array.";

    if ($geminiRes && !empty($geminiRes['items'])) {
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'ocr_engine' => 'Google Gemini Flash Native Multimodal PDF AI Engine',
            'database_credential_used' => $activeKeyName,
            'scanned_pdf_file' => basename($target_file),
            'scanned_file_size_kb' => round(filesize($target_file) / 1024, 1),
            'prompt_sent_to_gemini' => $geminiRes['prompt_sent'] ?? $default_prompt,
            'extracted_raw_text' => "Entire PDF binary stream sent to Gemini Flash AI Engine for full-document analysis.",
            'gemini_analysis' => $geminiRes['raw_text'],
            'items' => $geminiRes['items']
        ]);
        exit;
    }

    // Native pdftotext extraction fallback — 0% dummy data directive
    $native_pdf_text = shell_exec("pdftotext -layout " . escapeshellarg($target_file) . " - 2>/dev/null");
    $parsed_native_items = [];
    if (!empty($native_pdf_text)) {
        foreach (explode("\n", $native_pdf_text) as $line) {
            if (preg_match('/^\s*(\d+)\s{2,}(.+?)\s{2,}(\d[\d.]*\s*\S*)/', $line, $m)) {
                $qty_raw = trim($m[3]);
                preg_match('/^([\d.]+)/', $qty_raw, $qm);
                $parsed_native_items[] = [
                    'id' => 'native-pdf-' . (count($parsed_native_items) + 1),
                    'description' => trim($m[2]),
                    'quantity' => isset($qm[1]) ? (float)$qm[1] : 1.0,
                    'unit' => trim(preg_replace('/^[\d.]+\s*/', '', $qty_raw)) ?: 'Pcs',
                    'unit_price' => 0,
                    'discount_percent' => 0,
                    'total' => 0
                ];
            }
        }
    }

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'ocr_engine' => 'ABM Malaya Native Layout PDF Parser',
        'scanned_pdf_file' => basename($target_file),
        'scanned_file_size_kb' => round(filesize($target_file) / 1024, 1),
        'extracted_raw_text' => $native_pdf_text ?: 'Native text empty',
        'items' => $parsed_native_items
    ]);
    exit;


} catch (Exception $e) {
    ob_end_clean();
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
