<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/db_connect.php';

    $method = $_SERVER['REQUEST_METHOD'];

    // 1. GET: Fetch list of blacklisted emails or check a specific email
    if ($method === 'GET') {
        $check_email = isset($_GET['check_email']) ? trim($_GET['check_email']) : '';
        if (!empty($check_email)) {
            $info = isEmailBlacklisted($db_conn, $check_email);
            ob_end_clean();
            echo json_encode([
                'status' => 'success',
                'data' => $info
            ]);
            exit;
        }

        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $query = "SELECT id, email, company_name, reason, created_by, created_at FROM email_blacklist";
        if (!empty($search)) {
            $s_esc = $db_conn->real_escape_string($search);
            $query .= " WHERE email LIKE '%$s_esc%' OR company_name LIKE '%$s_esc%' OR reason LIKE '%$s_esc%'";
        }
        $query .= " ORDER BY id DESC LIMIT 500";

        $res = $db_conn->query($query);
        $items = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $items[] = $row;
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'count' => count($items),
            'data' => $items
        ]);
        exit;
    }

    // 2. POST / DELETE actions
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!$input) {
        $input = $_POST;
    }

    $action = isset($_GET['action']) ? $_GET['action'] : ($input['action'] ?? ($method === 'POST' ? 'add' : ''));
    if ($method === 'DELETE') {
        $action = 'remove';
    }

    $email = isset($input['email']) ? trim($input['email']) : (isset($_GET['email']) ? trim($_GET['email']) : '');
    $company_name = isset($input['company_name']) ? trim($input['company_name']) : '';
    $reason = isset($input['reason']) ? trim($input['reason']) : '';
    $user_name = isset($input['user_name']) ? trim($input['user_name']) : 'Admin';

    // REMOVE from blacklist (Un-blacklist)
    if ($action === 'remove' || $action === 'unblacklist') {
        $id = isset($input['id']) ? intval($input['id']) : (isset($_GET['id']) ? intval($_GET['id']) : 0);
        if ($id > 0) {
            $stmt = $db_conn->prepare("DELETE FROM email_blacklist WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("i", $id);
                $stmt->execute();
                $stmt->close();
            }
        } else if (!empty($email)) {
            $stmt = $db_conn->prepare("DELETE FROM email_blacklist WHERE LOWER(email) = LOWER(?)");
            if ($stmt) {
                $stmt->bind_param("s", $email);
                $stmt->execute();
                $stmt->close();
            }
        } else {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'Email or ID is required to remove from blacklist']);
            exit;
        }

        // Optionally unmark rfq_requests is_blacklisted flag
        if (!empty($email)) {
            $db_conn->query("UPDATE rfq_requests SET is_blacklisted = 0 WHERE LOWER(client_email) = LOWER('" . $db_conn->real_escape_string($email) . "')");
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Email berhasil dihapus dari blacklist.'
        ]);
        exit;
    }

    // ADD or UPDATE blacklist
    if ($action === 'add' || $action === 'blacklist') {
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'Format alamat email tidak valid']);
            exit;
        }

        if (empty($reason)) {
            $reason = 'Blacklisted by Administrator';
        }

        $stmt = $db_conn->prepare("INSERT INTO email_blacklist (email, company_name, reason, created_by, created_at) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), reason = VALUES(reason), created_by = VALUES(created_by)");
        if ($stmt) {
            $stmt->bind_param("ssss", $email, $company_name, $reason, $user_name);
            $stmt->execute();
            $stmt->close();
        }

        // Update all existing RFQs from this email to deleted & blacklisted
        $stmt_rfq = $db_conn->prepare("UPDATE rfq_requests SET status = 'deleted', is_blacklisted = 1, blacklist_reason = ?, ai_verified = 1, ai_classification = 'blacklisted' WHERE LOWER(client_email) = LOWER(?)");
        if ($stmt_rfq) {
            $stmt_rfq->bind_param("ss", $reason, $email);
            $stmt_rfq->execute();
            $stmt_rfq->close();
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => "Email {$email} berhasil ditambahkan ke blacklist permanen. Pesan masa depan akan otomatis dihapus oleh mesin.",
            'email' => $email,
            'reason' => $reason
        ]);
        exit;
    }

    ob_end_clean();
    echo json_encode(['status' => 'error', 'message' => 'Invalid action specified']);
    exit;

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
