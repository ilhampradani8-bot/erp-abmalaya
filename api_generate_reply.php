<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(204);
    exit;
}

try {
    require_once __DIR__ . '/db_connect.php';

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Method not allowed.");
    }

    $raw   = file_get_contents('php://input');
    $input = json_decode($raw, true);

    // ---- Input Fields ----
    $prompt          = isset($input['prompt'])            ? trim($input['prompt'])           : '';
    $language        = isset($input['language'])          ? $input['language']               : 'English';
    $original_subject= isset($input['original_subject'])  ? $input['original_subject']       : '';
    $original_body   = isset($input['original_body'])     ? $input['original_body']          : '';
    $client_name     = isset($input['client_name'])       ? $input['client_name']            : 'Client';
    $client_company  = isset($input['client_company'])    ? $input['client_company']         : '';
    $quo_number      = isset($input['quotation_number'])  ? $input['quotation_number']       : '';
    $quo_total       = isset($input['grand_total'])       ? number_format((float)$input['grand_total'],  2) : '0.00';
    $quo_subtotal    = isset($input['subtotal'])          ? number_format((float)$input['subtotal'],     2) : '0.00';
    $quo_tax_pct     = isset($input['tax_percent'])       ? $input['tax_percent']            : '0';
    $quo_tax_amt     = isset($input['tax_amount'])        ? number_format((float)$input['tax_amount'],   2) : '0.00';
    $quo_valid       = isset($input['valid_until'])       ? $input['valid_until']            : '';
    $quo_issued      = isset($input['date_issued'])       ? $input['date_issued']            : '';
    $currency        = isset($input['currency'])          ? $input['currency']               : 'MYR';
    $items_summary   = isset($input['items_summary'])     ? $input['items_summary']          : '';
    $items_count     = isset($input['items_count'])       ? (int)$input['items_count']       : 0;
    $notes           = isset($input['notes'])             ? trim($input['notes'])            : '';
    $terms           = isset($input['terms_conditions'])  ? trim($input['terms_conditions']) : '';

    // ---- Load Gemini API Keys ----
    $api_keys = [];
    $res_keys = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' ORDER BY id ASC");
    if ($res_keys && $res_keys->num_rows > 0) {
        while ($row_key = $res_keys->fetch_assoc()) {
            $k = trim($row_key['api_key']);
            if (!empty($k) && strpos($k, '...') === false) {
                $api_keys[] = $k;
            }
        }
    }
    $api_keys = array_values(array_unique($api_keys));
    if (empty($api_keys)) {
        throw new Exception("Gemini API key is not configured. Please add it in System Settings.");
    }

    // ---- Build Quotation Context Block ----
    $quotation_block  = "--- QUOTATION PREPARED FOR CLIENT ---\n";
    $quotation_block .= "Quotation No  : {$quo_number}\n";
    $quotation_block .= "Date Issued   : {$quo_issued}\n";
    $quotation_block .= "Valid Until   : {$quo_valid}\n";
    $quotation_block .= "Total Items   : {$items_count} line item(s)\n";
    $quotation_block .= "Subtotal      : {$currency} {$quo_subtotal}\n";
    $quotation_block .= "SST/Tax({$quo_tax_pct}%) : {$currency} {$quo_tax_amt}\n";
    $quotation_block .= "GRAND TOTAL   : {$currency} {$quo_total}\n";
    if (!empty($items_summary)) {
        $quotation_block .= "\nLine Items:\n{$items_summary}\n";
    }
    if (!empty($notes)) {
        $quotation_block .= "\nQuotation Notes:\n{$notes}\n";
    }
    if (!empty($terms)) {
        $quotation_block .= "\nTerms & Conditions:\n{$terms}\n";
    }

    // ---- Build Original Email Block ----
    $company_str = $client_company ? " ({$client_company})" : '';
    $original_email_block  = "--- ORIGINAL CLIENT RFQ EMAIL ---\n";
    $original_email_block .= "Subject : {$original_subject}\n";
    $original_email_block .= "From    : {$client_name}{$company_str}\n";
    $original_email_block .= "Body:\n{$original_body}\n";

    // ---- System Instruction (persona + rules) ----
    $first_name = explode(' ', $client_name)[0];
    $sys_instr  = "You are a senior Sales Manager at AB Malaya Industry Sdn. Bhd., a professional marine logistics and ship supply company in Malaysia.\n\n";
    $sys_instr .= "Your job is to write ONE professional, contextual, and warm reply email to a client's RFQ.\n\n";
    $sys_instr .= "RULES YOU MUST FOLLOW:\n";
    $sys_instr .= "1. Language: Write ENTIRELY in {$language}. Do not mix languages.\n";
    $sys_instr .= "2. Salutation: Address the client by name: use \"{$first_name}\" or a respectful equivalent.\n";
    $sys_instr .= "3. Context: Specifically mention the goods/services the client requested (extract from the email body — e.g. vessel name, oil types, quantities). Make the email feel personalized, not generic.\n";
    $sys_instr .= "4. Quotation: Reference Quotation No. {$quo_number}, valid until {$quo_valid}, grand total {$currency} {$quo_total}.\n";
    $sys_instr .= "5. Tone: Professional yet approachable. Not stiff, not informal.\n";
    $sys_instr .= "6. Structure: Opening → acknowledgment of their request (name the items/vessel) → quotation summary → attachment note → closing offer to assist → signature.\n";
    $sys_instr .= "7. Sign-off: End with AB Malaya Industry Sales & Business Development Team.\n";
    $sys_instr .= "8. Output format: Return ONLY the email body text. Start with the salutation. End with the signature. NO subject line, NO markdown fences, NO preamble, NO meta-commentary.\n";

    if (!empty($prompt)) {
        $sys_instr .= "\n\nADDITIONAL INSTRUCTIONS FROM USER:\n{$prompt}";
    }

    // ---- User Content (context given to AI) ----
    $user_content  = $original_email_block . "\n\n";
    $user_content .= $quotation_block . "\n\n";
    $user_content .= "Based on ALL the context above, now write the professional reply email.";

    // ---- Call Gemini API with key rotation ----
    $reply_text = '';
    $last_err   = '';

    // ---- 1. Call Gemini API with key rotation ----
    $reply_text = '';
    $last_err   = '';
    $model_used = '';

    $gemini_models = ['gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-exp-1206', 'gemini-flash-latest'];

    foreach ($api_keys as $key) {
        if (strpos($key, 'gsk_') === 0) continue; // Skip Groq keys here

        foreach ($gemini_models as $model_name) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model_name . ":generateContent?key=" . urlencode($key);

            $payload = [
                'contents' => [[
                    'parts' => [['text' => $user_content]]
                ]],
                'systemInstruction' => [
                    'parts' => [['text' => $sys_instr]]
                ],
                'generationConfig' => [
                    'temperature'     => 0.72,
                    'maxOutputTokens' => 4096,
                    'topP'            => 0.9
                ]
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST,           true);
            curl_setopt($ch, CURLOPT_POSTFIELDS,     json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER,     ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_IPRESOLVE,      CURL_IPRESOLVE_V4);
            curl_setopt($ch, CURLOPT_TIMEOUT,        8);

            $response  = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($http_code === 200) {
                $decoded = json_decode($response, true);
                if (isset($decoded['candidates'][0]['content']['parts'][0]['text'])) {
                    $reply_text = trim($decoded['candidates'][0]['content']['parts'][0]['text']);
                    $model_used = "Gemini ($model_name)";
                    break 2;
                }
            } elseif ($http_code === 404) {
                continue; // Try next model
            } elseif ($http_code === 429) {
                $last_err = "Gemini key rate-limited (429). Rotating...";
                break; // Try next key
            } else {
                $last_err = "Gemini {$model_name} HTTP {$http_code}: " . substr($response, 0, 200);
            }
        }
    }

    // ---- 2. High-Speed Free Groq AI Fallback if Gemini is Unavailable ----
    if (empty($reply_text)) {
        $groq_keys = [
            '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',
            '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',
            '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',
            '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'
        ];

        // Also append any Groq keys from database
        $res_groq = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE api_key LIKE 'gsk_%'");
        if ($res_groq && $res_groq->num_rows > 0) {
            while ($rg = $res_groq->fetch_assoc()) {
                $groq_keys[] = trim($rg['api_key']);
            }
        }
        $groq_keys = array_values(array_unique(array_filter($groq_keys)));

        $groq_models = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

        foreach ($groq_keys as $gkey) {
            foreach ($groq_models as $gmodel) {
                $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
                curl_setopt_array($ch, [
                    CURLOPT_POST           => true,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT        => 10,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_HTTPHEADER     => [
                        'Authorization: Bearer ' . $gkey,
                        'Content-Type: application/json'
                    ],
                    CURLOPT_POSTFIELDS     => json_encode([
                        'model'       => $gmodel,
                        'messages'    => [
                            ['role' => 'system', 'content' => $sys_instr],
                            ['role' => 'user',   'content' => $user_content]
                        ],
                        'temperature' => 0.7,
                        'max_tokens'  => 2048
                    ])
                ]);
                $gresp = curl_exec($ch);
                $gcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($gcode === 200 && !empty($gresp)) {
                    $gdecoded = json_decode($gresp, true);
                    if (isset($gdecoded['choices'][0]['message']['content'])) {
                        $reply_text = trim($gdecoded['choices'][0]['message']['content']);
                        $model_used = "Groq ($gmodel)";
                        break 2;
                    }
                } else {
                    $last_err = "Groq {$gmodel} HTTP {$gcode}: " . substr($gresp, 0, 200);
                }
            }
        }
    }

    // ---- 3. Smart Contextual Template Fallback if All External AI are Unreachable ----
    if (empty($reply_text)) {
        $first_name = explode(' ', $client_name)[0];
        $is_id_lang = ($language === 'Indonesian' || $language === 'Malay');

        if ($is_id_lang) {
            $reply_text  = "Kepada {$client_name}" . ($client_company ? " ({$client_company})" : "") . ",\n\n";
            $reply_text .= "Terima kasih atas pertanyaan penawaran harga (RFQ) yang telah disampaikan kepada AB MALAYA SDN. BHD.\n\n";
            $reply_text .= "Sehubungan dengan permohonan tersebut, bersama ini kami lampirkan dokumen penawaran resmi kami:\n";
            $reply_text .= "• Nomor Sebutharga / SPH : " . ($quo_number ?: 'SPH-ABM/MY/2026') . "\n";
            $reply_text .= "• Tarikh Dikeluarkan      : " . ($quo_issued ?: date('Y-m-d')) . "\n";
            if (!empty($quo_valid)) {
                $reply_text .= "• Tempoh Sah Laku        : " . $quo_valid . "\n";
            }
            $reply_text .= "• Jumlah Keseluruhan     : {$currency} {$quo_total}\n\n";
            if (!empty($prompt)) {
                $reply_text .= "Catatan Tambahan:\n" . $prompt . "\n\n";
            }
            $reply_text .= "Sila semak dokumen sebutharga terlampir untuk rincian spesifikasi teknikal. Sekiranya pihak tuan memerlukan penjelasan lanjut atau ingin mengesahkan Pesanan Pembelian (PO), sila hubungi kami semula melalui emel ini.\n\n";
            $reply_text .= "Sekian, terima kasih.\n\n";
            $reply_text .= "Yang benar,\n";
            $reply_text .= "Sales & Commercial Division\n";
            $reply_text .= "AB MALAYA SDN. BHD.";
        } else {
            $reply_text  = "Dear {$client_name}" . ($client_company ? " ({$client_company})" : "") . ",\n\n";
            $reply_text .= "Thank you for reaching out to AB MALAYA SDN. BHD. regarding your commercial quotation inquiry.\n\n";
            $reply_text .= "We are pleased to submit our formal quotation for your consideration:\n";
            $reply_text .= "• Quotation Reference : " . ($quo_number ?: 'SPH-ABM/MY/2026') . "\n";
            $reply_text .= "• Date Issued         : " . ($quo_issued ?: date('Y-m-d')) . "\n";
            if (!empty($quo_valid)) {
                $reply_text .= "• Validity Period     : " . $quo_valid . "\n";
            }
            $reply_text .= "• Total Investment    : {$currency} {$quo_total}\n\n";
            if (!empty($prompt)) {
                $reply_text .= "Special Notes:\n" . $prompt . "\n\n";
            }
            $reply_text .= "Please find the detailed quotation schedule attached for your perusal. Should you have any questions or require modifications to the scope of supply, please do not hesitate to contact us.\n\n";
            $reply_text .= "Sincerely,\n";
            $reply_text .= "Sales & Estimating Division\n";
            $reply_text .= "AB MALAYA SDN. BHD.";
        }
        $model_used = "Contextual Smart Template";
    }

    ob_end_clean();

    echo json_encode([
        'status'      => 'success',
        'reply'       => $reply_text,
        'reply_text'  => $reply_text,
        'model_used'  => $model_used,
        'debug_error' => $last_err
    ]);

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode([
        'status'  => 'error',
        'message' => $e->getMessage()
    ]);
}
