<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

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
                addSystemNotification($db_conn, "SPH Dipindahkan ke Sampah ({$id})", "{$user_name} memindahkan SPH {$id} ke folder sampah (Trash).", 'warning', 'sph', 'quotations_list');
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

        // Batch fetch all quotation items and RFQs to eliminate N+1 queries for instant loading
        $all_quotation_items = [];
        $item_q = $db_conn->query("SELECT id, quotation_id, product_code, category_code, impa_code, description, specification, offer, quantity, unit, unit_price, discount_percent, total FROM quotation_items ORDER BY id ASC");
        if ($item_q) {
            while ($item = $item_q->fetch_assoc()) {
                $q_id = $item['quotation_id'];
                unset($item['quotation_id']);
                $all_quotation_items[$q_id][] = $item;
            }
        }

        $all_rfqs = [];
        $all_rfqs_by_email = [];
        $rfq_q = $db_conn->query("SELECT id, rfq_number, client_name AS sender_name, client_company AS company, client_email AS sender_email, recipient_email, subject, message_body, attachment_url, created_at FROM rfq_requests");
        if ($rfq_q) {
            while ($rfq = $rfq_q->fetch_assoc()) {
                $all_rfqs[$rfq['id']] = $rfq;
                if (!empty($rfq['sender_email'])) {
                    $em = strtolower(trim($rfq['sender_email']));
                    if (!isset($all_rfqs_by_email[$em])) {
                        $all_rfqs_by_email[$em] = $rfq;
                    }
                }
            }
        }

        // Fetch quotations (including new OCR and ACC columns)
        $res = $db_conn->query("SELECT *, ocr_scan_status, ocr_scan_result, approved_by, history_log FROM quotations ORDER BY created_at DESC");
        $data = [];
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $quo_id = $row['id'];
                
                $items_arr = isset($all_quotation_items[$quo_id]) ? $all_quotation_items[$quo_id] : [];
                $unregistered_count = 0;
                $total_items = count($items_arr);

                foreach ($items_arr as &$item) {
                    $desc = strtolower(trim($item['description'] ?? ''));
                    $pcode = strtolower(trim($item['product_code'] ?? ''));
                    $matched = false;
                    if (!empty($pcode) && isset($master_products[$pcode])) {
                        $matched = true;
                    } else if (!empty($desc) && isset($master_products[$desc])) {
                        $matched = true;
                    }
                    $item['is_registered'] = $matched;
                    $item['in_master_product'] = $matched;
                    if (!$matched) {
                        $unregistered_count++;
                    }
                }
                unset($item);
                
                $row['total_items_count'] = $total_items;
                $row['unregistered_items_count'] = $unregistered_count;
                $row['items_details'] = $items_arr;
                $row['items'] = $items_arr;

                // Dynamically calculate and fill subtotal / grand_total if 0 or null
                $cur_sub = isset($row['subtotal']) ? (float)$row['subtotal'] : 0.0;
                $cur_grand = isset($row['grand_total']) ? (float)$row['grand_total'] : 0.0;
                if ($cur_sub <= 0.001 || $cur_grand <= 0.001) {
                    $calc_sub = 0.0;
                    foreach ($items_arr as $it) {
                        $q = isset($it['quantity']) ? (float)$it['quantity'] : 1.0;
                        $p = isset($it['unit_price']) ? (float)$it['unit_price'] : 0.0;
                        $d = isset($it['discount_percent']) ? (float)$it['discount_percent'] : 0.0;
                        $t = isset($it['total']) && (float)$it['total'] > 0 ? (float)$it['total'] : ($q * $p * (1.0 - $d / 100.0));
                        $calc_sub += $t;
                    }
                    if ($calc_sub <= 0.001 && !empty($row['ocr_scan_result'])) {
                        $parsed_ocr = json_decode($row['ocr_scan_result'], true);
                        if (isset($parsed_ocr['subtotal']) && (float)$parsed_ocr['subtotal'] > 0) {
                            $calc_sub = (float)$parsed_ocr['subtotal'];
                        } else if (isset($parsed_ocr['grand_total']) && (float)$parsed_ocr['grand_total'] > 0) {
                            $calc_sub = (float)$parsed_ocr['grand_total'];
                        } else if (isset($parsed_ocr['items']) && is_array($parsed_ocr['items'])) {
                            foreach ($parsed_ocr['items'] as $oit) {
                                $oq = isset($oit['qty']) ? (float)$oit['qty'] : 1.0;
                                $op = isset($oit['unit_price']) ? (float)$oit['unit_price'] : 0.0;
                                $od = isset($oit['discount_percent']) ? (float)$oit['discount_percent'] : 0.0;
                                $ot = isset($oit['total']) && (float)$oit['total'] > 0 ? (float)$oit['total'] : ($oq * $op * (1.0 - $od / 100.0));
                                $calc_sub += $ot;
                            }
                        }
                    }
                    if ($calc_sub > 0.001) {
                        $tax_pct = isset($row['tax_percent']) && is_numeric($row['tax_percent']) ? (float)$row['tax_percent'] : 11.0;
                        $disc_tot = isset($row['discount_total']) ? (float)$row['discount_total'] : 0.0;
                        $tax_amt = ($calc_sub - $disc_tot) * ($tax_pct / 100.0);
                        $grand_tot = ($calc_sub - $disc_tot) + $tax_amt;

                        $row['subtotal'] = $calc_sub;
                        $row['tax_amount'] = $tax_amt;
                        $row['grand_total'] = $grand_tot;

                        // Persist to DB if empty
                        $db_conn->query("UPDATE quotations SET subtotal = {$calc_sub}, tax_amount = {$tax_amt}, grand_total = {$grand_tot} WHERE id = '" . $db_conn->real_escape_string($quo_id) . "'");
                    }
                }
                
                // Set email source from batch map (or email map fallback) without N+1 SQL queries
                if (!empty($row['rfq_id']) && isset($all_rfqs[$row['rfq_id']])) {
                    $row['email_source'] = $all_rfqs[$row['rfq_id']];
                } else if (!empty($row['client_email'])) {
                    $c_email = strtolower(trim($row['client_email']));
                    $row['email_source'] = isset($all_rfqs_by_email[$c_email]) ? $all_rfqs_by_email[$c_email] : null;
                } else {
                    $row['email_source'] = null;
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
                $upd = $db_conn->prepare("UPDATE quotations SET approved_by = ?, status = 'ready_send' WHERE id = ?");
                if ($upd) { $upd->bind_param('ss', $new_json, $quo_id); $upd->execute(); $upd->close(); }
                appendQuotationHistoryLog($db_conn, $quo_id, 'ACC Approval', $user_name, $user_email, "User memberikan ACC approval dan mengubah status ke Siap Kirim (ready_send). Note: {$note}");
                addSystemNotification($db_conn, "ACC Approval SPH ({$quo_id})", "{$user_name} menyetujui SPH {$quo_id} dan siap untuk dikirim ke klien.", 'success', 'sph', 'quotations_list');
            }
            ob_end_clean();
            echo json_encode(['status' => 'success', 'message' => 'Approval recorded and status moved to ready_send.']);
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
                addSystemNotification($db_conn, "Status SPH Berubah ({$quo_id})", "{$user_name} mengubah status SPH {$quo_id} menjadi '{$newStatus}'.", 'info', 'sph', 'quotations_list');
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
                addSystemNotification($db_conn, "SPH Dipulihkan dari Sampah ({$quo_id})", "{$user_name} memulihkan SPH {$quo_id} kembali ke status Draft.", 'info', 'sph', 'quotations_list');
            }
            ob_end_clean();
            echo json_encode(['status' => 'success', 'message' => 'Restored to Draft']);
            exit;
        }

        $id = isset($input['id']) && !empty($input['id']) ? $input['id'] : 'QUO-' . time();
        $quo_num = isset($input['quotation_number']) && !empty($input['quotation_number']) ? $input['quotation_number'] : 'QUO-ABM/MY/2026/0' . rand(100, 999);
        
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

        $client_name = isset($input['client_name']) && !empty($input['client_name']) ? $input['client_name'] : (isset($input['contact_person']) ? $input['contact_person'] : 'Valued Client');

        // Auto-derive company_name from email if not provided or same as client_name
        $raw_company = isset($input['company_name']) && !empty($input['company_name']) ? $input['company_name'] : (isset($input['company']) ? $input['company'] : '');
        if (empty($raw_company) || strtolower(trim($raw_company)) === strtolower(trim($client_name))) {
            // Extract plain email address (handle JSON format)
            $plain_email = $raw_email;
            if (is_string($raw_email) && (strpos($raw_email, '{') === 0 || strpos($raw_email, '[') === 0)) {
                $parsed_email_json = json_decode($raw_email, true);
                if (is_array($parsed_email_json) && !empty($parsed_email_json['selected'])) {
                    $plain_email = $parsed_email_json['selected'];
                }
            }
            $public_domains = ['gmail.com','yahoo.com','outlook.com','hotmail.com','mail.com',
                               'yahoo.co.id','yahoo.co.uk','ymail.com','icloud.com','googlemail.com',
                               'live.com','me.com','aol.com','protonmail.com','zoho.com'];
            if (filter_var($plain_email, FILTER_VALIDATE_EMAIL)) {
                $parts = explode('@', $plain_email, 2);
                $username = $parts[0];
                $domain_full = strtolower($parts[1]);
                if (in_array($domain_full, $public_domains)) {
                    // Public email → use username (name before @), capitalize first letter
                    $derived = ucfirst(strtolower($username));
                } else {
                    // Corporate email → use domain name (after @, strip TLD, capitalize)
                    $domain_parts = explode('.', $domain_full);
                    // Take the first part (main domain name), strip TLD(s)
                    $domain_name = $domain_parts[0];
                    $derived = ucwords(str_replace(['-', '_'], ' ', $domain_name));
                }
                $raw_company = !empty($derived) ? $derived : $client_name;
            } else {
                $raw_company = $client_name;
            }
        }
        $company_name = $raw_company;
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

        $source_file = isset($input['source_file']) && !empty($input['source_file']) ? $input['source_file'] : null;
        $quotation_file = isset($input['quotation_file']) && !empty($input['quotation_file']) ? $input['quotation_file'] : null;

        if (empty($source_file) && !empty($rfq_id_val)) {
            $rfq_att_res = $db_conn->query("SELECT attachment_url FROM rfq_requests WHERE id = {$rfq_id_val} LIMIT 1");
            if ($rfq_att_res && $rfq_att_row = $rfq_att_res->fetch_assoc()) {
                if (!empty($rfq_att_row['attachment_url'])) {
                    $source_file = $rfq_att_row['attachment_url'];
                }
            }
        }

        $status = isset($input['status']) && !empty($input['status']) ? $input['status'] : 'draft';
        $company_address = isset($input['company_address']) ? trim($input['company_address']) : '';
        $footer_text = isset($input['footer_text']) ? trim($input['footer_text']) : null;

        $chk_ftr = $db_conn->query("SHOW COLUMNS FROM quotations LIKE 'footer_text'");
        if ($chk_ftr && $chk_ftr->num_rows === 0) {
            $db_conn->query("ALTER TABLE quotations ADD COLUMN footer_text TEXT DEFAULT NULL AFTER notes");
        }

        $stmt = $db_conn->prepare("INSERT INTO quotations (id, rfq_id, quotation_number, client_name, client_email, client_phone, company_name, company_address, date_issued, valid_until, subtotal, discount_total, tax_percent, tax_amount, grand_total, notes, footer_text, source_file, quotation_file, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rfq_id=VALUES(rfq_id), quotation_number=VALUES(quotation_number), client_name=VALUES(client_name), client_email=VALUES(client_email), client_phone=VALUES(client_phone), company_name=VALUES(company_name), company_address=VALUES(company_address), date_issued=VALUES(date_issued), valid_until=VALUES(valid_until), subtotal=VALUES(subtotal), discount_total=VALUES(discount_total), tax_percent=VALUES(tax_percent), tax_amount=VALUES(tax_amount), grand_total=VALUES(grand_total), notes=VALUES(notes), footer_text=VALUES(footer_text), source_file=COALESCE(VALUES(source_file), source_file), quotation_file=COALESCE(VALUES(quotation_file), quotation_file), status=VALUES(status), created_by=VALUES(created_by)");
        
        if ($stmt) {
            $stmt->bind_param("sisssssssdddddsssssss", $id, $rfq_id_val, $quo_num, $client_name, $client_email, $client_phone, $company_name, $company_address, $date_issued, $valid_until, $subtotal, $discount_total, $tax_percent, $tax_amount, $grand_total, $notes, $footer_text, $source_file, $quotation_file, $status, $created_by);
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
        addSystemNotification($db_conn, ($is_update ? "SPH Diperbarui ({$quo_num})" : "SPH Baru Dibuat ({$quo_num})"), "{$user_name} ({$user_email}) " . ($is_update ? "memperbarui data SPH" : "membuat penawaran SPH baru") . " untuk klien {$client_name} senilai RM " . number_format($grand_total, 2) . ".", 'success', 'sph', 'quotations_list');

        if (isset($input['items']) && is_array($input['items'])) {
            $db_conn->query("DELETE FROM quotation_items WHERE quotation_id = '" . $db_conn->real_escape_string($id) . "'");
            $item_stmt = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, product_code, category_code, impa_code, description, specification, offer, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            if ($item_stmt) {
                foreach ($input['items'] as $it) {
                    $p_code = isset($it['product_code']) ? trim($it['product_code']) : (isset($it['item_code']) ? trim($it['item_code']) : '');
                    $c_code = isset($it['category_code']) && !empty($it['category_code']) ? trim($it['category_code']) : (isset($it['category_name']) ? trim($it['category_name']) : null);
                    $i_code = isset($it['impa_code']) && !empty($it['impa_code']) ? trim($it['impa_code']) : null;
                    $p_desc = isset($it['description']) ? trim($it['description']) : '';
                    
                    // Comprehensive specification field mapping
                    $p_spec = '';
                    if (isset($it['specification']) && trim($it['specification']) !== '') {
                        $p_spec = trim($it['specification']);
                    } else if (isset($it['spec']) && trim($it['spec']) !== '') {
                        $p_spec = trim($it['spec']);
                    } else if (isset($it['specs']) && trim($it['specs']) !== '') {
                        $p_spec = trim($it['specs']);
                    } else if (isset($it['specification_text']) && trim($it['specification_text']) !== '') {
                        $p_spec = trim($it['specification_text']);
                    } else if (isset($it['technical_specification']) && trim($it['technical_specification']) !== '') {
                        $p_spec = trim($it['technical_specification']);
                    } else if (isset($it['item_specification']) && trim($it['item_specification']) !== '') {
                        $p_spec = trim($it['item_specification']);
                    } else if (isset($it['offer']) && trim($it['offer']) !== '') {
                        $p_spec = trim($it['offer']);
                    } else if (isset($it['offered_item']) && trim($it['offered_item']) !== '') {
                        $p_spec = trim($it['offered_item']);
                    }

                    $p_offer= isset($it['offer']) ? trim($it['offer']) : (isset($it['offered_item']) ? trim($it['offered_item']) : '');
                    $p_qty  = isset($it['quantity']) ? (float)$it['quantity'] : (isset($it['qty']) ? (float)$it['qty'] : 1.0);
                    $p_unit = isset($it['unit']) ? trim($it['unit']) : 'Unit';
                    $p_price= isset($it['unit_price']) ? (float)$it['unit_price'] : 0.0;
                    $p_disc = isset($it['discount_percent']) ? (float)$it['discount_percent'] : 0.0;
                    $p_tot  = isset($it['total']) ? (float)$it['total'] : ($p_qty * $p_price);

                    $item_stmt->bind_param("sssssssdsddd", $id, $p_code, $c_code, $i_code, $p_desc, $p_spec, $p_offer, $p_qty, $p_unit, $p_price, $p_disc, $p_tot);
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
