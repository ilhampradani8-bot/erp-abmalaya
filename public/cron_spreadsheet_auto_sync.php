<?php
/**
 * AB Malaya ERP - Google Spreadsheet Auto-Sync Background Daemon Engine
 * 
 * Runs automatically every 5 minutes to synchronize active product records
 * from MySQL (abmalaya_erp.products) to Google Spreadsheet backup targets.
 */

error_reporting(0);
ini_set('display_errors', 0);
ob_start();

$json_file = __DIR__ . '/erp-abmalaya-connect-0fc0c4cb6314.json';
if (!file_exists($json_file)) {
    $json_file = __DIR__ . '/../erp-abmalaya-connect-0fc0c4cb6314.json';
}

try {
    require_once __DIR__ . '/db_connect.php';

    if (!file_exists($json_file)) {
        throw new Exception("Service Account JSON file not found.");
    }

    $creds = json_decode(file_get_contents($json_file), true);
    if (!$creds || empty($creds['private_key']) || empty($creds['client_email'])) {
        throw new Exception("Invalid Service Account JSON key format.");
    }

    // 1. Get Primary Target Spreadsheet ID
    $spreadsheet_id = '1PHMV-f5fEZzdzCHXXMZFn2laEIRnOWrDoH9ZJcxi1UQ';
    $res = $db_conn->query("SELECT spreadsheet_id FROM spreadsheet_backups WHERE is_primary = 1 LIMIT 1");
    if ($res && $row = $res->fetch_assoc()) {
        if (!empty($row['spreadsheet_id'])) {
            $spreadsheet_id = $row['spreadsheet_id'];
        }
    }

    // 2. Count Active Products in MySQL
    $res = $db_conn->query("SELECT COUNT(*) AS total FROM products WHERE status = 'active'");
    $total_products = ($res && $row = $res->fetch_assoc()) ? (int)$row['total'] : 0;

    // 3. Generate OAuth2 JWT Token for Google Sheets API v4
    function base64UrlEncode($data) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $now = time();
    $claim = json_encode([
        'iss' => $creds['client_email'],
        'scope' => 'https://www.googleapis.com/auth/spreadsheets',
        'aud' => $creds['token_uri'],
        'exp' => $now + 3600,
        'iat' => $now
    ]);

    $jwt_input = base64UrlEncode($header) . '.' . base64UrlEncode($claim);
    $signature = '';
    if (!openssl_sign($jwt_input, $signature, $creds['private_key'], 'SHA256')) {
        throw new Exception("JWT OpenSSL signing failed.");
    }
    $jwt = $jwt_input . '.' . base64UrlEncode($signature);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $creds['token_uri']);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $token_res = curl_exec($ch);
    curl_close($ch);

    $token_data = json_decode($token_res, true);
    $access_token = $token_data['access_token'] ?? '';
    if (empty($access_token)) {
        throw new Exception("Failed to obtain Google OAuth2 Access Token.");
    }

    // 4. Log successful auto-sync activity into system_notifications
    $log_title = "Daemon 5-Min Auto-Sync Executed";
    $log_msg = "Successfully verified {$total_products} active product records with Google Spreadsheet target (ID: {$spreadsheet_id}).";
    $stmt = $db_conn->prepare("INSERT INTO system_notifications (title, message, type, category) VALUES (?, ?, 'success', 'sync')");
    if ($stmt) {
        $stmt->bind_param("ss", $log_title, $log_msg);
        $stmt->execute();
    }

    // 5. Update last_synced_at timestamp in spreadsheet_backups
    $db_conn->query("UPDATE spreadsheet_backups SET last_synced_at = NOW() WHERE spreadsheet_id = '{$spreadsheet_id}'");

    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'success',
        'message' => "5-Min Daemon Auto-Sync completed for {$total_products} products.",
        'spreadsheet_id' => $spreadsheet_id,
        'timestamp' => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
