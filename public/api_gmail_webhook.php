<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// 🔒 SECURITY CHECK: Optional secret token to verify authenticity of calls
// e.g. URL: http://domain.com/api_gmail_webhook.php?token=abmalaya_webhook_secret_123
define('WEBHOOK_SECRET_TOKEN', 'abmalaya_webhook_secret_123');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

try {
    $token = isset($_GET['token']) ? $_GET['token'] : '';
    if ($token !== WEBHOOK_SECRET_TOKEN) {
        throw new Exception('Unauthorized: Invalid or missing secure webhook token.');
    }

    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);

    if (!$input || !isset($input['message']['data'])) {
        throw new Exception('Invalid payload format: Pub/Sub message data missing.');
    }

    // Decode Pub/Sub Base64 Data
    $decoded_data = base64_decode($input['message']['data']);
    $msg_payload = json_decode($decoded_data, true);

    if (!$msg_payload || !isset($msg_payload['emailAddress'])) {
        throw new Exception('Invalid decoded data: emailAddress not found.');
    }

    $email_address = $msg_payload['emailAddress'];
    $history_id = isset($msg_payload['historyId']) ? $msg_payload['historyId'] : '';

    // ⚡ Trigger master cron engine (non-blocking) using curl
    $cron_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") 
              . "://" . $_SERVER['HTTP_HOST'] 
              . str_replace('api_gmail_webhook.php', 'cron_trigger.php', $_SERVER['REQUEST_URI']);
    
    $cron_url = preg_replace('/(\?|&)token=[^&]*/', '', $cron_url);

    $ch = curl_init($cron_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5); // Fast timeout to return webhook response immediately
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_exec($ch);
    curl_close($ch);

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'message' => 'Gmail webhook received and sync triggered successfully',
        'email' => $email_address,
        'history_id' => $history_id
    ]);

} catch (Exception $e) {
    ob_end_clean();
    http_response_code(200);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
