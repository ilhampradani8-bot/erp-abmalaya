<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $result = $conn->query("SELECT * FROM system_notifications ORDER BY id DESC");
    $notifications = [];
    $unread_count = 0;

    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $row['id'] = (int)$row['id'];
            $row['is_read'] = (int)$row['is_read'];
            if ($row['is_read'] === 0) $unread_count++;
            $notifications[] = $row;
        }
    }

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'unread_count' => $unread_count,
        'data' => $notifications
    ]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!$input) $input = $_POST;

    $action = isset($input['action']) ? $input['action'] : 'create';

    if ($action === 'mark_as_read') {
        $id = isset($input['id']) ? (int)$input['id'] : 0;
        if ($id > 0) {
            $conn->query("UPDATE system_notifications SET is_read = 1 WHERE id = {$id}");
        } else {
            $conn->query("UPDATE system_notifications SET is_read = 1");
        }

        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => 'Notifications marked as read.']);
        exit;
    }

    // Default action: Create Notification
    $title = isset($input['title']) ? trim($input['title']) : 'System Notification';
    $message = isset($input['message']) ? trim($input['message']) : '';
    $type = isset($input['type']) ? trim($input['type']) : 'info';
    $category = isset($input['category']) ? trim($input['category']) : 'system';
    $action_link = isset($input['action_link']) ? trim($input['action_link']) : null;

    $stmt = $conn->prepare("INSERT INTO system_notifications (title, message, type, category, action_link) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $title, $message, $type, $category, $action_link);

    if ($stmt->execute()) {
        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => 'Notification logged to MySQL database!']);
    } else {
        ob_end_clean();
        echo json_encode(['status' => 'error', 'message' => $stmt->error]);
    }
    $stmt->close();
    $conn->close();
    exit;
}

if ($method === 'DELETE') {
    $conn->query("TRUNCATE TABLE system_notifications");
    ob_end_clean();
    echo json_encode(['status' => 'success', 'message' => 'Notification history cleared.']);
    exit;
}
