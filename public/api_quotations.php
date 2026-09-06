<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/db_connect.php';

    // DELETE QUOTATION RECORD
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE' || (isset($_GET['action']) && $_GET['action'] === 'delete')) {
        $id = isset($_GET['id']) ? $_GET['id'] : '';
        if (empty($id)) {
            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true);
            $id = isset($input['id']) ? $input['id'] : '';
        }

        if (!empty($id)) {
            $force = isset($_GET['force']) && $_GET['force'] === 'true';
            if ($force) {
                // Permanent delete
                $stmt = $db_conn->prepare("DELETE FROM quotations WHERE id = ?");
                if ($stmt) {
                    $stmt->bind_param("s", $id);
                    $stmt->execute();
                    $stmt->close();
                }
            } else {
                // Move to junk status
                $stmt = $db_conn->prepare("UPDATE quotations SET status = 'junk' WHERE id = ?");
                if ($stmt) {
                    $stmt->bind_param("s", $id);
                    $stmt->execute();
                    $stmt->close();
                }
                
                // Log history
                $user_name = isset($_GET['user_name']) ? $_GET['user_name'] : 'Admin';
                $user_email = isset($_GET['user_email']) ? $_GET['user_email'] : 'admin@abmalaya.com';
                appendQuotationHistoryLog($db_conn, $id, 'Move to Junk', $user_name, $user_email, "User moved SPH quotation to Trash (Junk status).");
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Quotation deleted successfully from MySQL',
            'deleted_id' => $id
        ]);
        exit;
    }

    // GET ALL QUOTATIONS FROM MYSQL DATABASE WITH COMPACT DETAILS, UNREGISTERED ALERTS & EMAIL SOURCES
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'ai_errors') {
        $errors = [];
        $res = $db_conn->query("SELECT id, rfq_number, subject, client_email, ai_error, created_at FROM rfq_requests WHERE ai_error IS NOT NULL AND ai_error != '' ORDER BY id DESC LIMIT 50");
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $errors[] = $row;
            }
        }
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'data' => $errors
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Fetch master catalog product names/codes to check unregistered items
        $master_products = [];
        $p_res = $db_conn->query("SELECT product_name, product_code FROM products");
        if ($p_res) {
            while ($p = $p_res->fetch_assoc()) {
                $master_products[strtolower(trim($p['product_name']))] = true;
                $p_code = strtolower(trim($p['product_code']));
                if (!empty($p_code)) {
                    $master_products[$p_code] = true;
                }
            }
        }

        // Fetch quotations (including new OCR and ACC columns)
        $res = $db_conn->query("SELECT *, ocr_scan_status, ocr_scan_result, approved_by, history_log FROM quotations ORDER BY created_at DESC");
        $data = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $quo_id = $row['id'];
                
                // Fetch items list including category_code & impa_code
                $items_res = $db_conn->query("SELECT id, product_code, category_code, impa_code, description, specification, quantity, unit, unit_price, discount_percent, total FROM quotation_items WHERE quotation_id = '" . $db_conn->real_escape_string($quo_id) . "'");

                $unregistered_count = 0;
                $total_items = 0;
                $items_arr = [];
                if ($items_res) {
                    while ($item = $items_res->fetch_assoc()) {
                        $total_items++;
                        $desc = strtolower(trim($item['description']));
                        
                        $matched = false;
                        if (!empty($desc)) {
                            if (isset($master_products[$desc])) {
                                $matched = true;
                            } else {
                                foreach ($master_products as $prod_name => $val) {
                                    if (strpos($desc, $prod_name) !== false || strpos($prod_name, $desc) !== false) {
                                        $matched = true;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (!$matched) {
                            $unregistered_count++;
                        }
                        $items_arr[] = $item;
                    }
                }
                
                $row['total_items_count'] = $total_items;
                $row['unregistered_items_count'] = $unregistered_count;
                $row['items_details'] = $items_arr;
                
                // Fetch email source details if rfq_id is set
                $row['email_source'] = null;
                if (!empty($row['rfq_id'])) {
                    $rfq_res = $db_conn->query("SELECT id, rfq_number, client_name AS sender_name, client_email AS sender_email, subject, message_body, attachment_url, created_at FROM rfq_requests WHERE id = " . intval($row['rfq_id']));
                    if ($rfq_res && $rfq_res->num_rows > 0) {
                        $row['email_source'] = $rfq_res->fetch_assoc();
                    }
                }
                
                // Fallback: match by client_email address if no explicit rfq_id link is found
                if (empty($row['email_source']) && !empty($row['client_email'])) {
                    $email_esc = $db_conn->real_escape_string($row['client_email']);
                    $rfq_res = $db_conn->query("SELECT id, rfq_number, client_name AS sender_name, client_email AS sender_email, subject, message_body, attachment_url, created_at FROM rfq_requests WHERE client_email = '{$email_esc}' ORDER BY created_at DESC LIMIT 1");
                    if ($rfq_res && $rfq_res->num_rows > 0) {
                        $row['email_source'] = $rfq_res->fetch_assoc();
                    }
                }
                
                $data[] = $row;
            }
        }

        if (ob_get_level() > 0) {
            @ob_end_clean();
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'fetched_count' => count($data),
            'data' => $data
        ], JSON_UNESCAPED_UNICODE | (defined('JSON_INVALID_UTF8_SUBSTITUTE') ? JSON_INVALID_UTF8_SUBSTITUTE : 0));
        exit;
    }

    // POST SAVE / ACTION HANDLER
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);
        if (!$input) {
            $input = $_POST;
        }

        // ── ACTION: APPROVE ──────────────────────────────────────────────────
        if (isset($input['action']) && $input['action'] === 'approve') {
            $quo_id  = isset($input['id']) ? trim($input['id']) : '';
            $user_name  = isset($input['user_name']) ? $input['user_name'] : 'Admin';
            $user_email = isset($input['user_email']) ? $input['user_email'] : 'admin@abmalaya.com';
            $note    = isset($input['note']) ? $input['note'] : '';

            if (!empty($quo_id)) {
                // Load current approved_by
                $cur = [];
                $s = $db_conn->prepare("SELECT approved_by FROM quotations WHERE id = ?");
                if ($s) { $s->bind_param('s', $quo_id); $s->execute(); $r = $s->get_result(); if ($r && $r->num_rows > 0) { $row = $r->fetch_assoc(); if (!empty($row['approved_by'])) { $cur = json_decode($row['approved_by'], true) ?: []; } } $s->close(); }

                $cur[] = [
                    'timestamp'  => date('Y-m-d H:i:s'),
                    'user_name'  => $user_name,
                    'user_email' => $user_email,
                    'note'       => $note
                ];
                $new_json = json_encode($cur, JSON_UNESCAPED_UNICODE);
                $upd = $db_conn->prepare("UPDATE quotations SET approved_by = ? WHERE id = ?");
                if ($upd) { $upd->bind_param('ss', $new_json, $quo_id); $upd->execute(); $upd->close(); }
                appendQuotationHistoryLog($db_conn, $quo_id, 'ACC Approval', $user_name, $user_email, "User memberikan ACC/persetujuan. Note: {$note}");
            }
            ob_end_clean();
            echo json_encode(['status' => 'success', 'message' => 'Approval recorded.']);
            exit;
        }

        // ── ACTION: STATUS UPDATE ────────────────────────────────────────────
        if (isset($input['action']) && $input['action'] === 'status_update') {
            $quo_id    = isset($input['id']) ? trim($input['id']) : '';
            $newStatus = isset($input['status']) ? $input['status'] : 'draft';
            $user_name  = isset($input['user_name']) ? $input['user_name'] : 'Admin';
            $user_email = isset($input['user_email']) ? $input['user_email'] : 'admin@abmalaya.com';
            if (!empty($quo_id)) {
                $upd = $db_conn->prepare("UPDATE quotations SET status = ? WHERE id = ?");
                if ($upd) { $upd->bind_param('ss', $newStatus, $quo_id); $upd->execute(); $upd->close(); }
                appendQuotationHistoryLog($db_conn, $quo_id, 'Status Update', $user_name, $user_email, "Status diubah menjadi: {$newStatus}");
            }
            ob_end_clean();
            echo json_encode(['status' => 'success', 'message' => "Status updated to {$newStatus}"]);
            exit;
        }

        // ── ACTION: RESTORE (from Trash) ─────────────────────────────────────
        if (isset($input['action']) && $input['action'] === 'restore') {
            $quo_id    = isset($input['id']) ? trim($input['id']) : '';
            $user_name  = isset($input['user_name']) ? $input['user_name'] : 'Admin';
            $user_email = isset($input['user_email']) ? $input['user_email'] : 'admin@abmalaya.com';
            if (!empty($quo_id)) {
                $upd = $db_conn->prepare("UPDATE quotations SET status = 'draft' WHERE id = ?");
                if ($upd) { $upd->bind_param('s', $quo_id); $upd->execute(); $upd->close(); }
                appendQuotationHistoryLog($db_conn, $quo_id, 'Restore from Trash', $user_name, $user_email, "User memulihkan SPH dari Trash ke status Draft.");
            }
            ob_end_clean();
            echo json_encode(['status' => 'success', 'message' => 'Restored to Draft']);
            exit;
        }

        $id = isset($input['id']) && !empty($input['id']) ? $input['id'] : 'QUO-' . time();
        $quo_num = isset($input['quotation_number']) && !empty($input['quotation_number']) ? $input['quotation_number'] : 'SPH-ABM/MY/2026/0' . rand(100, 999);
        
        $rfq_id_raw = null;
        if (isset($input['rfq_id'])) {
            $rfq_id_raw = (int)str_replace(['GMAIL-LIVE-', 'RFQ-'], '', $input['rfq_id']);
        }

        $raw_email = isset($input['client_email']) && !empty($input['client_email']) ? $input['client_email'] : (isset($input['sender_email']) ? $input['sender_email'] : 'client@abmalaya.com');
        
        // Handle client_email as structured JSON or plain string
        if (is_array($raw_email)) {
            $client_email = json_encode($raw_email, JSON_UNESCAPED_UNICODE);
        } else if (is_string($raw_email) && (strpos($raw_email, '{') === 0 || strpos($raw_email, '[') === 0)) {
            $client_email = $raw_email;
        } else {
            $opts = [['email' => $raw_email, 'source' => 'Primary Email']];
            if (isset($input['delivery_email']) && !empty($input['delivery_email']) && $input['delivery_email'] !== $raw_email) {
                $opts[] = ['email' => trim($input['delivery_email']), 'source' => 'Dispatch Email (OCR / Notes)'];
            }
            $client_email = json_encode([
                'selected' => $raw_email,
                'options' => $opts
            ], JSON_UNESCAPED_UNICODE);
        }

        $company_name = isset($input['company_name']) && !empty($input['company_name']) ? $input['company_name'] : (isset($input['company']) ? $input['company'] : $client_name);
        $date_issued = isset($input['date_issued']) && !empty($input['date_issued']) ? $input['date_issued'] : date('Y-m-d');
        $valid_until = isset($input['valid_until']) && !empty($input['valid_until']) ? $input['valid_until'] : '14 Days';
        
        $subtotal = isset($input['subtotal']) ? (float)$input['subtotal'] : 0.00;
        $discount_total = isset($input['discount_total']) ? (float)$input['discount_total'] : 0.00;
        $tax_percent = isset($input['tax_percent']) ? (float)$input['tax_percent'] : 11.00;
        $tax_amount = isset($input['tax_amount']) ? (float)$input['tax_amount'] : 0.00;
        $grand_total = isset($input['grand_total']) ? (float)$input['grand_total'] : 0.00;
        $notes = isset($input['notes']) && !empty($input['notes']) ? $input['notes'] : 'RFQ quotation record';
        $created_by = isset($input['created_by']) && !empty($input['created_by']) ? $input['created_by'] : 'Sesi Tidak Terdeteksi';

        $rfq_id_val = ($rfq_id_raw > 0) ? (int)$rfq_id_raw : null;

        // Check if updating or inserting
        $exists_check = $db_conn->query("SELECT id FROM quotations WHERE id = '" . $db_conn->real_escape_string($id) . "' LIMIT 1");
        $is_update = ($exists_check && $exists_check->num_rows > 0);

        $client_phone = isset($input['client_phone']) && !empty($input['client_phone']) ? $input['client_phone'] : (isset($input['phone']) ? $input['phone'] : null);

        $stmt = $db_conn->prepare("INSERT INTO quotations (id, rfq_id, quotation_number, client_name, client_email, client_phone, company_name, date_issued, valid_until, subtotal, discount_total, tax_percent, tax_amount, grand_total, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?) ON DUPLICATE KEY UPDATE grand_total=VALUES(grand_total), status=VALUES(status), rfq_id=VALUES(rfq_id), client_phone=VALUES(client_phone), client_email=VALUES(client_email)");
        
        if ($stmt) {
            $stmt->bind_param("sissssssdddddss", $id, $rfq_id_val, $quo_num, $client_name, $client_email, $client_phone, $company_name, $date_issued, $valid_until, $subtotal, $discount_total, $tax_percent, $tax_amount, $grand_total, $notes, $created_by);
            $stmt->execute();
            $stmt->close();
        } else {
            throw new Exception("MySQL Prepare Failed: " . $db_conn->error);
        }

        // Log JSON history event with user identity!
        $user_name = isset($input['user_name']) ? $input['user_name'] : 'Admin';
        $user_email = isset($input['user_email']) ? $input['user_email'] : 'admin@abmalaya.com';

        $action_log = $is_update ? 'Update SPH' : 'Create SPH';
        $details_log = $is_update ? "User updated SPH details (Grand Total: RM {$grand_total})." : "User created SPH (Grand Total: RM {$grand_total}).";
        appendQuotationHistoryLog($db_conn, $id, $action_log, $user_name, $user_email, $details_log);

        if (isset($input['items']) && is_array($input['items'])) {
            $db_conn->query("DELETE FROM quotation_items WHERE quotation_id = '" . $db_conn->real_escape_string($id) . "'");
            $item_stmt = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, product_code, description, specification, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            if ($item_stmt) {
                foreach ($input['items'] as $it) {
                    $p_code = isset($it['product_code']) ? trim($it['product_code']) : (isset($it['item_code']) ? trim($it['item_code']) : '');
                    $p_desc = isset($it['description']) ? trim($it['description']) : '';
                    $p_spec = isset($it['specification']) ? trim($it['specification']) : '';
                    $p_qty  = isset($it['quantity']) ? (float)$it['quantity'] : (isset($it['qty']) ? (float)$it['qty'] : 1.0);
                    $p_unit = isset($it['unit']) ? trim($it['unit']) : 'Unit';
                    $p_price= isset($it['unit_price']) ? (float)$it['unit_price'] : 0.0;
                    $p_disc = isset($it['discount_percent']) ? (float)$it['discount_percent'] : 0.0;
                    $p_tot  = isset($it['total']) ? (float)$it['total'] : ($p_qty * $p_price);

                    $item_stmt->bind_param("ssssdsddd", $id, $p_code, $p_desc, $p_spec, $p_qty, $p_unit, $p_price, $p_disc, $p_tot);
                    $item_stmt->execute();
                }
                $item_stmt->close();
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Quotation saved to MySQL and RFQ status updated to diproses',
            'id' => $id,
            'quotation_number' => $quo_num
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
