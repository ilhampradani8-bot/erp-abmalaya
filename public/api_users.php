<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/db_connect.php';

    // GET USERS
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $res = $db_conn->query("SELECT id, name, email, role, department, status, created_at FROM users ORDER BY created_at ASC");
        $users = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $users[] = $row;
            }
        } else {
            // Seed initial admin user if table empty
            $db_conn->query("INSERT IGNORE INTO users (id, name, email, password, role, department, status) VALUES ('USR-001', 'Ilham Pradani, S.T.', 'ilham@abmalaya.com', 'hash', 'Admin', 'Sales', 'Active')");
            $users[] = [
                'id' => 'USR-001',
                'name' => 'Ilham Pradani, S.T.',
                'email' => 'ilham@abmalaya.com',
                'role' => 'Admin',
                'department' => 'Sales & Business Development',
                'status' => 'Active',
                'created_at' => date('Y-m-d')
            ];
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'data' => $users
        ]);
        exit;
    }

    // POST NEW USER
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php_input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $id = isset($input['id']) ? $input['id'] : 'USR-' . time();
        $name = isset($input['name']) ? $input['name'] : 'New User';
        $email = isset($input['email']) ? $input['email'] : 'user@abmalaya.com';
        $role = isset($input['role']) ? $input['role'] : 'Sales Engineer';
        $department = isset($input['department']) ? $input['department'] : 'Sales';

        $stmt = $db_conn->prepare("INSERT INTO users (id, name, email, password, role, department, status) VALUES (?, ?, ?, 'default_hash', ?, ?, 'Active') ON DUPLICATE KEY UPDATE name=VALUES(name)");
        if ($stmt) {
            $stmt->bind_param("sssss", $id, $name, $email, $role, $department);
            $stmt->execute();
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'User saved to MySQL successfully',
            'id' => $id
        ]);
        exit;
    }

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
