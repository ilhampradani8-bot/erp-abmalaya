<?php
// Debug script to check OTHERS sheet rows
error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    $json_file = __DIR__ . '/erp-abmalaya-connect-0fc0c4cb6314.json';
    $creds = json_decode(file_get_contents($json_file), true);
    
    // Generate OAuth Token
    function base64UrlEncode($data) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }
    
    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $claim = json_encode([
        'iss' => $creds['client_email'],
        'scope' => 'https://www.googleapis.com/auth/spreadsheets.readonly',
        'aud' => $creds['token_uri'],
        'exp' => time() + 3600,
        'iat' => time()
    ]);
    
    $jwt_input = base64UrlEncode($header) . '.' . base64UrlEncode($claim);
    $signature = '';
    openssl_sign($jwt_input, $signature, $creds['private_key'], 'SHA256');
    $jwt = $jwt_input . '.' . base64UrlEncode($signature);
    
    $ch = curl_init($creds['token_uri']);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);
    
    $access_token = $response['access_token'] ?? '';
    
    $spreadsheet_id = '17oE102qBlTzXGeWxHMkNTCnz0CE4TKR_xxsq65QqFmI';
    $range = 'OTHERS!A1:G100';
    $ch2 = curl_init("https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheet_id}/values/" . urlencode($range));
    curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch2, CURLOPT_HTTPHEADER, ["Authorization: Bearer $access_token"]);
    curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
    $data = json_decode(curl_exec($ch2), true);
    curl_close($ch2);
    
    $rows = $data['values'] ?? [];
    echo "=== Range: OTHERS ===\n";
    echo "Total rows: " . count($rows) . "\n";
    foreach ($rows as $idx => $r) {
        $r_str = trim(implode(', ', $r));
        if (!empty($r_str)) {
            echo "Row $idx: " . json_encode($r) . "\n";
        }
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
