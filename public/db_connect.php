<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
$is_localhost = (!isset($_SERVER['SERVER_NAME']) || $_SERVER['SERVER_NAME'] === 'localhost' || $_SERVER['SERVER_NAME'] === '127.0.0.1' || (isset($_SERVER['HTTP_HOST']) && (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false || strpos($_SERVER['HTTP_HOST'], 'trycloudflare.com') !== false)));

if (!$is_localhost) {
    $db_host = 'localhost';
    $db_user = 'abmalaya_erpuser';
    $db_pass = 'abmalaya2021';
    $db_name = 'abmalaya_abmalaya_erp';
    $db_port = 3306;
} else {
    $db_host = '127.0.0.1';
    $db_user = 'root';
    $db_pass = 'root';
    $db_name = 'abmalaya_erp';
    $db_port = 3306;
}

// Handle mysqli errors gracefully without throwing 500 uncaught exceptions on PHP 8.1+
try {
    @mysqli_report(MYSQLI_REPORT_OFF);
    $db_conn = $conn = @new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
    
    // Auto-fallback if initial connection fails
    if ($db_conn->connect_error || !$db_conn) {
        if ($is_localhost) {
            $db_conn = $conn = @new mysqli('127.0.0.1', 'root', 'root', 'abmalaya_erp', 3306);
        } else {
            // Fallback 1: Try capitalized password "Abmalaya2021"
            $db_conn = $conn = @new mysqli($db_host, $db_user, 'Abmalaya2021', $db_name, $db_port);
            if ($db_conn->connect_error || !$db_conn) {
                // Fallback 2: Try 127.0.0.1 root local DB
                $db_conn = $conn = @new mysqli('127.0.0.1', 'root', 'root', 'abmalaya_erp', 3306);
            }
        }
    }

} catch (Exception $e) {
    if (ob_get_level() > 0) {
        @ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection exception: ' . $e->getMessage()
    ]);
    exit;
}

if (!$db_conn || $db_conn->connect_error) {
    if (ob_get_level() > 0) {
        @ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . ($db_conn ? $db_conn->connect_error : 'MySQL client initialization error')
    ]);
    exit;
}

if (!function_exists('appendRfqHistoryLog')) {
    function appendRfqHistoryLog($db_conn, $rfq_id, $action, $user_name, $user_email, $details) {
        if (!$db_conn || $db_conn->connect_error) return;
        
        // Normalize the lookup key to support numeric ID, sequence suffix, or full RFQ string
        $clean_id = intval(str_replace(['RFQ-', 'GMAIL-LIVE-'], '', $rfq_id));
        $rfq_num = 'RFQ-' . $clean_id;

        // 1. Fetch current history_log
        $current_log = [];
        $stmt = $db_conn->prepare("SELECT id, history_log FROM rfq_requests WHERE id = ? OR rfq_number = ? OR id = ?");
        if ($stmt) {
            $stmt->bind_param("isi", $clean_id, $rfq_num, $rfq_id);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $log_str = $row['history_log'];
                if (!empty($log_str)) {
                    $current_log = json_decode($log_str, true);
                    if (!is_array($current_log)) {
                        $current_log = [];
                    }
                }
            }
            $stmt->close();
        }

        // 2. Create new entry
        $new_entry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'user_name' => $user_name ?: 'System Automation',
            'user_email' => $user_email ?: null,
            'action' => $action,
            'details' => $details
        ];

        // 3. Append to log
        $current_log[] = $new_entry;
        $new_log_str = json_encode($current_log, JSON_UNESCAPED_UNICODE);

        // 4. Update table
        $upd = $db_conn->prepare("UPDATE rfq_requests SET history_log = ? WHERE id = ? OR rfq_number = ? OR id = ?");
        if ($upd) {
            $upd->bind_param("sisi", $new_log_str, $clean_id, $rfq_num, $rfq_id);
            $upd->execute();
            $upd->close();
        }
    }
}

if (!function_exists('appendQuotationHistoryLog')) {
    function appendQuotationHistoryLog($db_conn, $quo_id, $action, $user_name, $user_email, $details) {
        if (!$db_conn || $db_conn->connect_error) return;

        // 1. Fetch current history_log
        $current_log = [];
        $stmt = $db_conn->prepare("SELECT id, history_log FROM quotations WHERE id = ? OR quotation_number = ?");
        if ($stmt) {
            $stmt->bind_param("ss", $quo_id, $quo_id);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $log_str = $row['history_log'];
                if (!empty($log_str)) {
                    $current_log = json_decode($log_str, true);
                    if (!is_array($current_log)) {
                        $current_log = [];
                    }
                }
            }
            $stmt->close();
        }

        // 2. Create new entry
        $new_entry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'user_name' => $user_name ?: 'System Automation',
            'user_email' => $user_email ?: null,
            'action' => $action,
            'details' => $details
        ];

        // 3. Append to log
        $current_log[] = $new_entry;
        $new_log_str = json_encode($current_log, JSON_UNESCAPED_UNICODE);

        // 4. Update table
        $upd = $db_conn->prepare("UPDATE quotations SET history_log = ? WHERE id = ? OR quotation_number = ?");
        if ($upd) {
            $upd->bind_param("sss", $new_log_str, $quo_id, $quo_id);
            $upd->execute();
            $upd->close();
        }
    }
}

if (!function_exists('addSystemNotification')) {
    function addSystemNotification($db_conn, $title, $message, $type = 'info', $category = 'system', $action_link = null) {
        if (!$db_conn || $db_conn->connect_error) return;
        $stmt = $db_conn->prepare("INSERT INTO system_notifications (title, message, type, category, action_link) VALUES (?, ?, ?, ?, ?)");
        if ($stmt) {
            $stmt->bind_param("sssss", $title, $message, $type, $category, $action_link);
            $stmt->execute();
            $stmt->close();
        }
    }
}

if (!function_exists('isEmailBlacklisted')) {
    function isEmailBlacklisted($db_conn, $email) {
        if (!$db_conn || $db_conn->connect_error) {
            return ['blacklisted' => false, 'reason' => null];
        }
        $clean = strtolower(trim((string)$email));
        if (empty($clean)) {
            return ['blacklisted' => false, 'reason' => null];
        }

        // Support extraction from "Name <email@domain.com>"
        if (preg_match('/<([^>]+)>/', $clean, $m)) {
            $clean = trim($m[1]);
        }

        $stmt = $db_conn->prepare("SELECT email, company_name, reason FROM email_blacklist WHERE LOWER(email) = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param("s", $clean);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $res->num_rows > 0) {
                $row = $res->fetch_assoc();
                $stmt->close();
                return [
                    'blacklisted' => true,
                    'email' => $row['email'],
                    'company_name' => $row['company_name'],
                    'reason' => !empty($row['reason']) ? $row['reason'] : 'Blacklisted by administrator'
                ];
            }
            $stmt->close();
        }
        return ['blacklisted' => false, 'reason' => null];
    }
}

