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
        $res = $db_conn->query("SELECT id, name, email, role, department, status, created_at, (CASE WHEN password IS NOT NULL AND password != '' AND password != 'default_hash' THEN 1 ELSE 0 END) AS has_custom_password FROM users ORDER BY id ASC");
        $users = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $row['has_custom_password'] = (bool)$row['has_custom_password'];
                $users[] = $row;
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'data' => $users
        ]);
        exit;
    }


    // DELETE / POST DELETE USER
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE' || ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'delete')) {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }
        $id = isset($input['id']) ? $input['id'] : (isset($_GET['id']) ? $_GET['id'] : '');

        if ($id) {
            $stmt = $db_conn->prepare("DELETE FROM users WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("s", $id);
                $stmt->execute();
                $stmt->close();
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'User deleted from MySQL successfully',
            'id' => $id
        ]);
        exit;
    }

    // POST NEW / UPDATE USER
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $id = isset($input['id']) ? trim($input['id']) : 'USR-' . time();
        $name = isset($input['name']) ? trim($input['name']) : 'Team Member';
        $email = isset($input['email']) ? trim($input['email']) : 'aimanzaki@abmalaya.com';
        $role = isset($input['role']) ? trim($input['role']) : 'Karyawan';
        $allowed_roles = ['Admin', 'Karyawan', 'Sales Engineer', 'Manager', 'Finance'];
        if (!in_array($role, $allowed_roles)) {
            $role = 'Karyawan';
        }
        $department = isset($input['department']) ? trim($input['department']) : 'Sales Executive';
        $password = isset($input['password']) ? trim($input['password']) : '';

        // Check if user already exists
        $chk = $db_conn->prepare("SELECT id, password FROM users WHERE id = ? OR email = ? LIMIT 1");
        $chk->bind_param("ss", $id, $email);
        $chk->execute();
        $existing = $chk->get_result()->fetch_assoc();
        $chk->close();

        if ($existing) {
            $userId = $existing['id'];
            if (!empty($password)) {
                $pwdHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
                $stmt = $db_conn->prepare("UPDATE users SET name = ?, email = ?, role = ?, department = ?, password = ?, updated_at = NOW() WHERE id = ?");
                $stmt->bind_param("ssssss", $name, $email, $role, $department, $pwdHash, $userId);
            } else {
                $stmt = $db_conn->prepare("UPDATE users SET name = ?, email = ?, role = ?, department = ?, updated_at = NOW() WHERE id = ?");
                $stmt->bind_param("sssss", $name, $email, $role, $department, $userId);
            }
            if ($stmt) {
                $stmt->execute();
                $stmt->close();
            }
        } else {
            $pwdHash = !empty($password) ? password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]) : password_hash('abmalaya2026!', PASSWORD_BCRYPT, ['cost' => 10]);
            $stmt = $db_conn->prepare("INSERT INTO users (id, name, email, password, role, department, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Active', NOW(), NOW())");
            if ($stmt) {
                $stmt->bind_param("ssssss", $id, $name, $email, $pwdHash, $role, $department);
                $stmt->execute();
                $stmt->close();
            }
        }

        // Log user save in audit trail
        @$db_conn->query("INSERT INTO user_activity_logs (user_name, user_email, action, details, ip_address) VALUES ('System Admin', 'admin@abmalaya.com', 'USER_MANAGEMENT', 'User profile {$name} ({$email}) saved/updated.', '{$_SERVER['REMOTE_ADDR']}')");

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
