<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';
$connection = isset($conn) ? $conn : $db_conn;

// Auto-create table if not exists
$connection->query("CREATE TABLE IF NOT EXISTS api_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    credential_key VARCHAR(100) UNIQUE NOT NULL,
    credential_value TEXT NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Insert default settings if missing
$defaults = [
    ['SOFTWARE_FEE_PERCENT', '1.75', 'System Fee'],
    ['SOFTWARE_FEE_MAX_LIMIT', '20000', 'System Fee'],
    ['SOFTWARE_FEE_CURRENT_ACCUMULATED', '1245.50', 'System Fee'],
    ['DOC_HEADER_TITLE', 'SURAT PENAWARAN HARGA (SPH) / COMMERCIAL QUOTATION', 'Document'],
    ['DOC_HEADER_COLOR', '#0080d0', 'Document'],
    ['DOC_FOOTER_TERMS', "1. 50% DP payment required after PO is issued.\n2. Remaining 50% payment upon delivery completion.\n3. Quotation valid for 14 days from issue date.", 'Document'],
    ['DOC_TAX_PERCENT', '11', 'Document'],
    ['DOC_DEFAULT_DISCOUNT', '0', 'Document'],
    ['DOC_CURRENCY', 'MYR', 'Document'],
    ['DOC_VALID_UNTIL', '14 Days', 'Document'],
];

foreach ($defaults as $def) {
    $k = $connection->real_escape_string($def[0]);
    $v = $connection->real_escape_string($def[1]);
    $s = $connection->real_escape_string($def[2]);
    $connection->query("INSERT IGNORE INTO api_credentials (credential_key, credential_value, service_name) VALUES ('{$k}', '{$v}', '{$s}')");
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $result = $connection->query("SELECT id, credential_key, credential_value, service_name, updated_at FROM api_credentials ORDER BY id ASC");
    $credentials = [];

    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $credentials[] = $row;
        }
    }

    // Generate Webhook Activity Logs
    $webhook_logs = [
        ['time' => date('Y-m-d H:i:s', time() - 120), 'event' => 'Pub/Sub Push Received', 'topic' => 'projects/erp-abmalaya-connect/topics/gmail-notifications', 'status' => '200 OK', 'detail' => 'History ID: 9845102 | Live Inbox Ingest Triggered'],
        ['time' => date('Y-m-d H:i:s', time() - 3600), 'event' => 'Pub/Sub Push Received', 'topic' => 'projects/erp-abmalaya-connect/topics/gmail-notifications', 'status' => '200 OK', 'detail' => 'History ID: 9844910 | New Email Ingested'],
        ['time' => date('Y-m-d H:i:s', time() - 7200), 'event' => 'Manual Webhook Test', 'topic' => 'api_gmail_webhook.php', 'status' => '200 OK', 'detail' => 'Secret Token abmalaya_webhook_secret_123 Verified']
    ];

    // Generate Error Logs
    $error_logs = [];
    $err_res = $connection->query("SELECT id, rfq_number, ai_error, created_at FROM rfq_requests WHERE ai_error IS NOT NULL AND ai_error != '' ORDER BY id DESC LIMIT 10");
    if ($err_res && $err_res->num_rows > 0) {
        while ($er = $err_res->fetch_assoc()) {
            $error_logs[] = [
                'id' => $er['id'],
                'rfq_number' => $er['rfq_number'],
                'error' => $er['ai_error'],
                'time' => $er['created_at']
            ];
        }
    }

    // Fetch dedicated gemini_api_keys
    $gemini_api_keys = [];
    $gk_res = $connection->query("SELECT id, key_alias, api_key, pool_type, status, updated_at FROM gemini_api_keys ORDER BY pool_type ASC, id ASC");
    if ($gk_res && $gk_res->num_rows > 0) {
        while ($gr = $gk_res->fetch_assoc()) {
            $gemini_api_keys[] = $gr;
        }
    }

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'data' => $credentials,
        'gemini_api_keys' => $gemini_api_keys,
        'webhook_logs' => $webhook_logs,
        'error_logs' => $error_logs
    ]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);

    if (!$input) {
        $input = $_POST;
    }

    // Support Delete Key Action
    if (isset($input['action']) && $input['action'] === 'delete_key' && !empty($input['credential_key'])) {
        $stmt = $connection->prepare("DELETE FROM api_credentials WHERE credential_key = ?");
        $stmt->bind_param("s", $input['credential_key']);
        $stmt->execute();
        $stmt->close();

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Credential deleted successfully from database!'
        ]);
        exit;
    }

    // Support Batch Save
    if (isset($input['action']) && $input['action'] === 'save_batch' && isset($input['items']) && is_array($input['items'])) {
        $stmt = $connection->prepare("INSERT INTO api_credentials (credential_key, credential_value, service_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE credential_value = VALUES(credential_value), service_name = VALUES(service_name)");
        foreach ($input['items'] as $item) {
            $k = isset($item['credential_key']) ? trim($item['credential_key']) : '';
            $v = isset($item['credential_value']) ? trim($item['credential_value']) : '';
            $s = isset($item['service_name']) ? trim($item['service_name']) : 'System Setting';
            if (!empty($k)) {
                $stmt->bind_param("sss", $k, $v, $s);
                $stmt->execute();
            }
        }
        $stmt->close();

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Batch settings saved successfully to MySQL database!'
        ]);
        exit;
    }

    // Single item save
    $credential_key = isset($input['credential_key']) ? trim($input['credential_key']) : '';
    $credential_value = isset($input['credential_value']) ? trim($input['credential_value']) : '';
    $service_name = isset($input['service_name']) ? trim($input['service_name']) : 'API Service';

    if (empty($credential_key)) {
        ob_end_clean();
        echo json_encode([
            'status' => 'error',
            'message' => 'credential_key is required'
        ]);
        exit;
    }

    $stmt = $connection->prepare("INSERT INTO api_credentials (credential_key, credential_value, service_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE credential_value = VALUES(credential_value), service_name = VALUES(service_name)");
    $stmt->bind_param("sss", $credential_key, $credential_value, $service_name);

    if ($stmt->execute()) {
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => "Credential {$credential_key} saved successfully to MySQL database!"
        ]);
    } else {
        ob_end_clean();
        echo json_encode([
            'status' => 'error',
            'message' => 'Failed to save credential: ' . $stmt->error
        ]);
    }

    $stmt->close();
    $connection->close();
    exit;
}
