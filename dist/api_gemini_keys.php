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

// Auto-create dedicated gemini_api_keys table with separate columns
$connection->query("CREATE TABLE IF NOT EXISTS gemini_api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_alias VARCHAR(100) NOT NULL,
    api_key TEXT NOT NULL,
    pool_type ENUM('inbox', 'ocr') NOT NULL DEFAULT 'inbox',
    status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Auto-migrate legacy keys from api_credentials into gemini_api_keys if table is empty
$count_res = $connection->query("SELECT COUNT(*) AS total FROM gemini_api_keys");
$total = 0;
if ($count_res && $row_c = $count_res->fetch_assoc()) {
    $total = (int)$row_c['total'];
}

if ($total === 0) {
    $leg_res = $connection->query("SELECT credential_key, credential_value FROM api_credentials WHERE credential_key LIKE 'GEMINI_API_KEY%' ORDER BY id ASC");
    if ($leg_res && $leg_res->num_rows > 0) {
        $idx_inbox = 1;
        $idx_ocr = 1;
        while ($leg_row = $leg_res->fetch_assoc()) {
            $k_name = $leg_row['credential_key'];
            $val = trim($leg_row['credential_value']);
            if (empty($val)) continue;

            $pool = (strpos($k_name, 'OCR') !== false) ? 'ocr' : 'inbox';
            $splitted = array_values(array_filter(array_map('trim', explode(',', $val))));
            foreach ($splitted as $k) {
                if (empty($k) || strpos($k, '...') !== false) continue;
                
                $alias = ($pool === 'ocr') ? "Gemini OCR Key {$idx_ocr}" : "Gemini Inbox Key {$idx_inbox}";
                if ($pool === 'ocr') $idx_ocr++; else $idx_inbox++;

                $stmt_i = $connection->prepare("INSERT INTO gemini_api_keys (key_alias, api_key, pool_type, status) VALUES (?, ?, ?, 'active')");
                if ($stmt_i) {
                    $stmt_i->bind_param("sss", $alias, $k, $pool);
                    $stmt_i->execute();
                    $stmt_i->close();
                }
            }
        }
    }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $res = $connection->query("SELECT id, key_alias, api_key, pool_type, status, updated_at FROM gemini_api_keys ORDER BY pool_type ASC, id ASC");
    $keys = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $keys[] = [
                'id' => (int)$row['id'],
                'key_alias' => $row['key_alias'],
                'api_key' => $row['api_key'],
                'pool_type' => $row['pool_type'],
                'status' => $row['status'],
                'updated_at' => $row['updated_at']
            ];
        }
    }

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'data' => $keys
    ]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!$input) $input = $_POST;

    $action = $input['action'] ?? 'save';

    // Delete single key
    if ($action === 'delete') {
        $id = (int)($input['id'] ?? 0);
        if ($id > 0) {
            $stmt = $connection->prepare("DELETE FROM gemini_api_keys WHERE id = ?");
            $stmt->bind_param("i", $id);
            $stmt->execute();
            $stmt->close();
        }
        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => 'API Key deleted from database!']);
        exit;
    }

    // Helper to keep legacy AI_SYSTEM_ENABLED in sync
    $syncMasterAi = function() use ($connection) {
        $res = $connection->query("SELECT COUNT(*) AS cnt FROM gemini_api_keys WHERE status = 'active'");
        $cnt = 0;
        if ($res && $r = $res->fetch_assoc()) {
            $cnt = (int)$r['cnt'];
        }
        $state = ($cnt > 0) ? 'true' : 'false';
        $connection->query("INSERT INTO api_credentials (credential_key, credential_value, service_name) 
                            VALUES ('AI_SYSTEM_ENABLED', '$state', 'AI Engine Master Switch') 
                            ON DUPLICATE KEY UPDATE credential_value = '$state'");
    };

    // Toggle status
    if ($action === 'toggle_status') {
        $id = (int)($input['id'] ?? 0);
        $new_status = ($input['status'] ?? 'active') === 'active' ? 'active' : 'disabled';
        if ($id > 0) {
            $stmt = $connection->prepare("UPDATE gemini_api_keys SET status = ? WHERE id = ?");
            $stmt->bind_param("si", $new_status, $id);
            $stmt->execute();
            $stmt->close();
        }
        $syncMasterAi();
        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => 'API Key status updated!']);
        exit;
    }

    // Single Add/Edit or Batch Save
    if ($action === 'save_batch' && isset($input['items']) && is_array($input['items'])) {
        $pool = ($input['pool_type'] ?? 'inbox') === 'ocr' ? 'ocr' : 'inbox';
        
        // Clear existing for this pool to maintain exact order
        $del_stmt = $connection->prepare("DELETE FROM gemini_api_keys WHERE pool_type = ?");
        $del_stmt->bind_param("s", $pool);
        $del_stmt->execute();
        $del_stmt->close();

        $stmt = $connection->prepare("INSERT INTO gemini_api_keys (key_alias, api_key, pool_type, status) VALUES (?, ?, ?, ?)");
        foreach ($input['items'] as $idx => $item) {
            $alias = !empty($item['key_alias']) ? trim($item['key_alias']) : (($pool === 'ocr' ? 'Gemini OCR Key ' : 'Gemini Inbox Key ') . ($idx + 1));
            $k_val = trim($item['api_key'] ?? '');
            $st = ($item['status'] ?? 'active') === 'disabled' ? 'disabled' : 'active';
            if (!empty($k_val)) {
                $stmt->bind_param("ssss", $alias, $k_val, $pool, $st);
                $stmt->execute();
            }
        }
        $stmt->close();

        $syncMasterAi();
        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => "Dedicated Gemini API keys table updated for {$pool} pool!"]);
        exit;
    }

    // Single Add or Update
    $id = (int)($input['id'] ?? 0);
    $key_alias = trim($input['key_alias'] ?? '');
    $api_key = trim($input['api_key'] ?? '');
    $pool_type = ($input['pool_type'] ?? 'inbox') === 'ocr' ? 'ocr' : 'inbox';
    $status = ($input['status'] ?? 'active') === 'disabled' ? 'disabled' : 'active';

    if (empty($api_key)) {
        ob_end_clean();
        echo json_encode(['status' => 'error', 'message' => 'API Key string is required']);
        exit;
    }

    if ($id > 0) {
        $stmt = $connection->prepare("UPDATE gemini_api_keys SET key_alias = ?, api_key = ?, pool_type = ?, status = ? WHERE id = ?");
        $stmt->bind_param("ssssi", $key_alias, $api_key, $pool_type, $status, $id);
    } else {
        if (empty($key_alias)) {
            $count_stmt = $connection->prepare("SELECT COUNT(*) AS total FROM gemini_api_keys WHERE pool_type = ?");
            $count_stmt->bind_param("s", $pool_type);
            $count_stmt->execute();
            $c_res = $count_stmt->get_result()->fetch_assoc();
            $count_stmt->close();
            $next_num = ($c_res['total'] ?? 0) + 1;
            $key_alias = ($pool_type === 'ocr' ? 'Gemini OCR Key ' : 'Gemini Inbox Key ') . $next_num;
        }
        $stmt = $connection->prepare("INSERT INTO gemini_api_keys (key_alias, api_key, pool_type, status) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $key_alias, $api_key, $pool_type, $status);
    }

    if ($stmt->execute()) {
        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => 'API Key saved to dedicated gemini_api_keys table!']);
    } else {
        ob_end_clean();
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $stmt->error]);
    }
    $stmt->close();
    exit;
}
