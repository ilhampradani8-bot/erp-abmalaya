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
        // Seed standard 4 team email accounts if missing
        $seed_users = [
            ['USR-101', 'Aiman Zaki', 'aimanzaki@abmalaya.com', 'Admin', 'Sales & Business Development'],
            ['USR-102', 'Info AB Malaya', 'info@abmalaya.com', 'Admin', 'General Executive & Operations'],
            ['USR-103', 'Sales Requisition Team', 'sales@abmalaya.com', 'Karyawan', 'Sales Requisition'],
            ['USR-104', 'Purchasing & Operations', 'purchasing@abmalaya.com', 'Karyawan', 'Purchasing & Supply Chain'],
        ];

        $ins = $db_conn->prepare("INSERT IGNORE INTO users (id, name, email, password, role, department, status) VALUES (?, ?, ?, 'default_hash', ?, ?, 'Active')");
        if ($ins) {
            foreach ($seed_users as $su) {
                $ins->bind_param("sssss", $su[0], $su[1], $su[2], $su[3], $su[4]);
                $ins->execute();
            }
            $ins->close();
        }

        $res = $db_conn->query("SELECT id, name, email, role, department, status, created_at FROM users ORDER BY id ASC");
        $users = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
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


    // POST NEW USER
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php_input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $id = isset($input['id']) ? $input['id'] : 'USR-' . time();
        $name = isset($input['name']) ? $input['name'] : 'Team Member';
        $email = isset($input['email']) ? $input['email'] : 'aimanzaki@abmalaya.com';
        $role = isset($input['role']) ? $input['role'] : 'Sales';
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
