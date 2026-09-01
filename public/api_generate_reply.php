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
    $gemini_key = '';
    $res = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'GEMINI_API_KEY'");
    if ($res && $res->num_rows > 0) {
        $gemini_key = $res->fetch_assoc()['credential_value'];
    }
    $api_keys = array_filter(array_map('trim', explode(',', $gemini_key)));
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

    foreach ($api_keys as $key) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" . $key;

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
        curl_setopt($ch, CURLOPT_TIMEOUT,        25);

        $response  = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code === 200) {
            $decoded = json_decode($response, true);
            if (isset($decoded['candidates'][0]['content']['parts'][0]['text'])) {
                $reply_text = trim($decoded['candidates'][0]['content']['parts'][0]['text']);
                break;
            }
        } elseif ($http_code === 429) {
            // Rate limited — try next key
            $last_err = "Key rate-limited (429). Rotating...";
            sleep(1);
            continue;
        } else {
            $last_err = "HTTP {$http_code}: " . substr($response, 0, 400);
        }
    }

    ob_end_clean();

    if (empty($reply_text)) {
        echo json_encode([
            'status'      => 'error',
            'message'     => 'Gemini could not generate a reply. Ensure your API key is valid and has quota.',
            'debug_error' => $last_err
        ]);
    } else {
        echo json_encode([
            'status'      => 'success',
            'reply'       => $reply_text,
            'debug_error' => $last_err
        ]);
    }

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode([
        'status'  => 'error',
        'message' => $e->getMessage()
    ]);
}
