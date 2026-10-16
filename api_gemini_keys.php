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

// Check Master AI Switch in api_credentials table
$ai_master_res = $connection->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'AI_SYSTEM_ENABLED' LIMIT 1");
$ai_system_enabled = true; // default enabled
if ($ai_master_res && $ai_master_res->num_rows > 0) {
    $row_master = $ai_master_res->fetch_assoc();
    $ai_system_enabled = ($row_master['credential_value'] === 'true' || $row_master['credential_value'] === '1' || $row_master['credential_value'] === 'active');
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $res = $connection->query("SELECT id, key_alias, api_key, pool_type, status, updated_at FROM gemini_api_keys ORDER BY pool_type ASC, id ASC");
    $keys = [];
    $inbox_active = 0;
    $ocr_active = 0;
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $st = $row['status'];
            if ($st === 'active') {
                if ($row['pool_type'] === 'ocr') $ocr_active++;
                else $inbox_active++;
            }
            $keys[] = [
                'id' => (int)$row['id'],
                'key_alias' => $row['key_alias'],
                'api_key' => $row['api_key'],
                'pool_type' => $row['pool_type'],
                'status' => $st,
                'updated_at' => $row['updated_at']
            ];
        }
    }

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'ai_system_enabled' => (bool)$ai_system_enabled,
        'inbox_active_count' => $inbox_active,
        'ocr_active_count' => $ocr_active,
        'data' => $keys
    ]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!$input) $input = $_POST;

    $action = $input['action'] ?? 'save';

    // Master Switch Toggle: AI_SYSTEM_ENABLED
    if ($action === 'set_master_status') {
        $raw_st = $input['status'] ?? 'active';
        $new_master_val = ($raw_st === 'active' || $raw_st === 'true' || $raw_st === true) ? 'true' : 'false';

        // Check if row exists
        $chk_master = $connection->query("SELECT id FROM api_credentials WHERE credential_key = 'AI_SYSTEM_ENABLED' LIMIT 1");
        if ($chk_master && $chk_master->num_rows > 0) {
            $stmt = $connection->prepare("UPDATE api_credentials SET credential_value = ? WHERE credential_key = 'AI_SYSTEM_ENABLED'");
            $stmt->bind_param("s", $new_master_val);
            $stmt->execute();
            $stmt->close();
        } else {
            $stmt = $connection->prepare("INSERT INTO api_credentials (credential_key, credential_value, service_name) VALUES ('AI_SYSTEM_ENABLED', ?, 'AI Engine Master Switch')");
            $stmt->bind_param("s", $new_master_val);
            $stmt->execute();
            $stmt->close();
        }

        // If explicitly set to disabled, also toggle all keys to disabled
        if ($new_master_val === 'false' && (!isset($input['keys_only']) || !$input['keys_only'])) {
            $connection->query("UPDATE gemini_api_keys SET status = 'disabled'");
        } elseif ($new_master_val === 'true' && isset($input['enable_all_keys']) && $input['enable_all_keys']) {
            $connection->query("UPDATE gemini_api_keys SET status = 'active'");
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'ai_system_enabled' => ($new_master_val === 'true'),
            'message' => 'Master AI Engine status updated to ' . ($new_master_val === 'true' ? 'ACTIVE' : 'DISABLED') . '!'
        ]);
        exit;
    }

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
        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => 'API Key status updated!']);
        exit;
    }

    // Bulk Toggle All Status (Enable All / Disable All)
    if ($action === 'toggle_all' || $action === 'bulk_toggle_status') {
        $pool = isset($input['pool_type']) && in_array($input['pool_type'], ['ocr', 'inbox']) ? $input['pool_type'] : null;
        $new_status = ($input['status'] ?? 'active') === 'active' ? 'active' : 'disabled';
        if ($pool) {
            $stmt = $connection->prepare("UPDATE gemini_api_keys SET status = ? WHERE pool_type = ?");
            $stmt->bind_param("ss", $new_status, $pool);
            $stmt->execute();
            $stmt->close();
        } else {
            $stmt = $connection->prepare("UPDATE gemini_api_keys SET status = ?");
            $stmt->bind_param("s", $new_status);
            $stmt->execute();
            $stmt->close();

            // Also synchronize AI_SYSTEM_ENABLED in api_credentials if pool is all
            $master_val = ($new_status === 'active') ? 'true' : 'false';
            $chk_m = $connection->query("SELECT id FROM api_credentials WHERE credential_key = 'AI_SYSTEM_ENABLED' LIMIT 1");
            if ($chk_m && $chk_m->num_rows > 0) {
                $connection->query("UPDATE api_credentials SET credential_value = '{$master_val}' WHERE credential_key = 'AI_SYSTEM_ENABLED'");
            } else {
                $connection->query("INSERT INTO api_credentials (credential_key, credential_value, service_name) VALUES ('AI_SYSTEM_ENABLED', '{$master_val}', 'AI Engine Master Switch')");
            }
        }
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'ai_system_enabled' => ($new_status === 'active'),
            'message' => "All API keys status updated to " . strtoupper($new_status) . "!"
        ]);
        exit;
    }

    // Single Add/Edit or Batch Save
    $batch_items = isset($input['items']) && is_array($input['items']) ? $input['items'] : (isset($input['keys']) && is_array($input['keys']) ? $input['keys'] : null);
    if (($action === 'save_batch' || $batch_items !== null) && $batch_items !== null) {
        $pool = ($input['pool_type'] ?? 'inbox') === 'ocr' ? 'ocr' : 'inbox';
        
        // Clear existing for this pool to maintain exact order
        $del_stmt = $connection->prepare("DELETE FROM gemini_api_keys WHERE pool_type = ?");
        $del_stmt->bind_param("s", $pool);
        $del_stmt->execute();
        $del_stmt->close();

        $stmt = $connection->prepare("INSERT INTO gemini_api_keys (key_alias, api_key, pool_type, status) VALUES (?, ?, ?, ?)");
        $saved_keys = 0;
        foreach ($batch_items as $idx => $item) {
            $alias = !empty($item['alias']) ? trim($item['alias']) : (!empty($item['key_alias']) ? trim($item['key_alias']) : (($pool === 'ocr' ? 'Gemini OCR Key ' : 'Gemini Inbox Key ') . ($idx + 1)));
            $k_val = trim($item['api_key'] ?? ($item['key'] ?? ''));
            $st = ($item['status'] ?? 'active') === 'disabled' ? 'disabled' : 'active';
            if (!empty($k_val)) {
                $stmt->bind_param("ssss", $alias, $k_val, $pool, $st);
                $stmt->execute();
                $saved_keys++;
            }
        }
        $stmt->close();

        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => "Dedicated Gemini API keys table updated ({$saved_keys} keys) for {$pool} pool!"]);
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
