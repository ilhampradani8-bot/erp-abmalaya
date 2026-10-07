<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/db_connect.php';

    // Helper: fetch all users consistently
    function fetch_all_users_list($db_conn) {
        $res = $db_conn->query("SELECT id, name, email, role, department, status, created_at, (CASE WHEN password IS NOT NULL AND password != '' AND password != 'default_hash' THEN 1 ELSE 0 END) AS has_custom_password FROM users ORDER BY id ASC");
        $users = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $row['has_custom_password'] = (bool)$row['has_custom_password'];
                $users[] = $row;
            }
        }
        return $users;
    }

    // GET USERS
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $users = fetch_all_users_list($db_conn);

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
        $id = isset($input['id']) ? trim($input['id']) : (isset($_GET['id']) ? trim($_GET['id']) : '');
        $email = isset($input['email']) ? trim($input['email']) : (isset($_GET['email']) ? trim($_GET['email']) : '');

        if (!empty($id)) {
            $stmt = $db_conn->prepare("DELETE FROM users WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("s", $id);
                $stmt->execute();
                $stmt->close();
            }
        } else if (!empty($email)) {
            $stmt = $db_conn->prepare("DELETE FROM users WHERE LOWER(email) = LOWER(?)");
            if ($stmt) {
                $stmt->bind_param("s", $email);
                $stmt->execute();
                $stmt->close();
            }
        }

        $allUsers = fetch_all_users_list($db_conn);

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'User account deleted successfully',
            'id' => $id,
            'data' => $allUsers
        ]);
        exit;
    }

    // POST NEW / UPDATE USER
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $id = isset($input['id']) ? trim($input['id']) : '';
        $name = isset($input['name']) && trim($input['name']) !== '' ? trim($input['name']) : 'Team Member';
        $email = isset($input['email']) ? trim($input['email']) : '';
        $role = isset($input['role']) ? trim($input['role']) : 'Staff';
        
        $allowed_roles = ['Admin', 'Staff', 'Karyawan', 'Sales Engineer', 'Manager', 'Finance'];
        if (!in_array($role, $allowed_roles)) {
            $role = 'Staff';
        }
        
        $department = isset($input['department']) && trim($input['department']) !== '' ? trim($input['department']) : 'Sales Executive';
        $password = isset($input['password']) ? trim($input['password']) : '';
        $status = isset($input['status']) && in_array($input['status'], ['Active', 'Inactive']) ? $input['status'] : 'Active';

        if (empty($email)) {
            ob_end_clean();
            echo json_encode([
                'status' => 'error',
                'message' => 'Email address is required.'
            ]);
            exit;
        }

        // Check if user already exists in MySQL by ID or Email
        $existing = null;
        if (!empty($id)) {
            $chk = $db_conn->prepare("SELECT id, email, password FROM users WHERE id = ? LIMIT 1");
            if ($chk) {
                $chk->bind_param("s", $id);
                $chk->execute();
                $existing = $chk->get_result()->fetch_assoc();
                $chk->close();
            }
        }

        if (!$existing && !empty($email)) {
            $chk2 = $db_conn->prepare("SELECT id, email, password FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1");
            if ($chk2) {
                $chk2->bind_param("s", $email);
                $chk2->execute();
                $existing = $chk2->get_result()->fetch_assoc();
                $chk2->close();
            }
        }

        $finalUserId = '';
        if ($existing) {
            $finalUserId = $existing['id'];
            if (!empty($password)) {
                $pwdHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
                $stmt = $db_conn->prepare("UPDATE users SET name = ?, email = ?, role = ?, department = ?, status = ?, password = ?, updated_at = NOW() WHERE id = ?");
                $stmt->bind_param("sssssss", $name, $email, $role, $department, $status, $pwdHash, $finalUserId);
            } else {
                $stmt = $db_conn->prepare("UPDATE users SET name = ?, email = ?, role = ?, department = ?, status = ?, updated_at = NOW() WHERE id = ?");
                $stmt->bind_param("ssssss", $name, $email, $role, $department, $status, $finalUserId);
            }
            if ($stmt) {
                $stmt->execute();
                $stmt->close();
            }
        } else {
            // Determine clean next User ID
            if (empty($id) || strpos($id, 'USR-') === false || strlen($id) > 10) {
                $maxRes = $db_conn->query("SELECT id FROM users WHERE id LIKE 'USR-%' ORDER BY id DESC LIMIT 50");
                $nextNum = 1;
                if ($maxRes) {
                    while ($r = $maxRes->fetch_assoc()) {
                        if (preg_match('/USR-(\d+)/', $r['id'], $m)) {
                            $val = intval($m[1]);
                            if ($val >= $nextNum && $val < 900000) {
                                $nextNum = $val + 1;
                            }
                        }
                    }
                }
                $finalUserId = 'USR-' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
            } else {
                $finalUserId = $id;
            }

            $pwdHash = !empty($password) ? password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]) : password_hash('abmalaya2026!', PASSWORD_BCRYPT, ['cost' => 10]);
            $stmt = $db_conn->prepare("INSERT INTO users (id, name, email, password, role, department, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
            if ($stmt) {
                $stmt->bind_param("sssssss", $finalUserId, $name, $email, $pwdHash, $role, $department, $status);
                $stmt->execute();
                $stmt->close();
            }
        }

        // Log user save in audit trail
        @$db_conn->query("INSERT INTO user_activity_logs (user_name, user_email, action, details, ip_address) VALUES ('System Admin', 'admin@abmalaya.com', 'USER_MANAGEMENT', 'User profile {$name} ({$email}) saved/updated.', '{$_SERVER['REMOTE_ADDR']}')");

        $allUsers = fetch_all_users_list($db_conn);
        $savedUser = null;
        foreach ($allUsers as $u) {
            if ($u['id'] === $finalUserId) {
                $savedUser = $u;
                break;
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'User saved successfully',
            'id' => $finalUserId,
            'user' => $savedUser,
            'data' => $allUsers
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

