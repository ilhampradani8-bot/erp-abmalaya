<?php
/**
 * ABM Malaya ERP — User Session Login & Activity Logging API
 * public/api_user_activity.php
 *
 * Records and returns user login sessions and action logs.
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

    // Auto-create user_activity_logs table if not present
    $db_conn->query("
        CREATE TABLE IF NOT EXISTS user_activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_name VARCHAR(100) NOT NULL,
            user_email VARCHAR(100) NOT NULL,
            action_type VARCHAR(50) NOT NULL DEFAULT 'LOGIN',
            details TEXT,
            ip_address VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    // GET: Fetch recent login & activity logs
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $res = $db_conn->query("SELECT id, user_name, user_email, action_type, details, ip_address, created_at FROM user_activity_logs ORDER BY id DESC LIMIT 50");
        $logs = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $logs[] = $row;
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'data' => $logs
        ]);
        exit;
    }

    // POST: Record new user login session or activity
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $user_name   = isset($input['user_name']) ? trim($input['user_name']) : (isset($input['name']) ? trim($input['name']) : 'User');
        $user_email  = isset($input['user_email']) ? trim($input['user_email']) : (isset($input['email']) ? trim($input['email']) : 'aimanzaki@abmalaya.com');
        $action_type = isset($input['action']) ? trim($input['action']) : (isset($input['action_type']) ? trim($input['action_type']) : 'LOGIN');
        $details     = isset($input['details']) ? trim($input['details']) : "User session activated for {$user_email}";
        $ip_address  = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        $stmt = $db_conn->prepare("INSERT INTO user_activity_logs (user_name, user_email, action_type, details, ip_address) VALUES (?, ?, ?, ?, ?)");
        if ($stmt) {
            $stmt->bind_param("sssss", $user_name, $user_email, $action_type, $details, $ip_address);
            $stmt->execute();
            $stmt->close();
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'User session login activity recorded',
            'user_name' => $user_name,
            'user_email' => $user_email,
            'action' => $action_type,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        exit;
    }

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
