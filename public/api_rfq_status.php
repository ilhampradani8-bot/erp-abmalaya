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

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);
        if (!$input) {
            $input = $_POST;
        }

        $rfq_id_raw = isset($input['rfq_id']) ? $input['rfq_id'] : '';
        $action = isset($input['action']) ? $input['action'] : '';
        $status = isset($input['status']) ? $input['status'] : 'diproses';
        $user_name = (isset($input['user_name']) && !empty($input['user_name'])) ? $input['user_name'] : 'Sesi Tidak Terdeteksi';
        $user_email = (isset($input['user_email']) && !empty($input['user_email'])) ? $input['user_email'] : '';

        $clean_id = (int)str_replace(['GMAIL-LIVE-', 'RFQ-'], '', $rfq_id_raw);
        $rfq_num = $rfq_id_raw;
        if (preg_match('/GMAIL-LIVE-(\d+)/i', $rfq_id_raw, $m)) {
            $rfq_num = 'RFQ-' . $m[1];
        }

        if ($action === 'move_to_requisition') {
            // 1. Update status and classification in rfq_requests table
            $stmt = $db_conn->prepare("UPDATE rfq_requests SET status = 'in_progress', ai_verified = 1, ai_classification = 'client_rfq' WHERE id = ? OR rfq_number = ?");
            if ($stmt) {
                $stmt->bind_param("is", $clean_id, $rfq_num);
                $stmt->execute();
                $stmt->close();
            }

            // 2. Fetch the updated row to pass to auto-generator
            $row = null;
            $stmt_load = $db_conn->prepare("SELECT * FROM rfq_requests WHERE id = ? OR rfq_number = ?");
            if ($stmt_load) {
                $stmt_load->bind_param("is", $clean_id, $rfq_num);
                $stmt_load->execute();
                $res_load = $stmt_load->get_result();
                if ($res_load && $res_load->num_rows > 0) {
                    $row = $res_load->fetch_assoc();
                }
                $stmt_load->close();
            }

            // 3. Find or Create Quotation record in MySQL database
            $quo_row = null;
            $stmt_q = $db_conn->prepare("SELECT * FROM quotations WHERE rfq_id = ? OR rfq_id = ? ORDER BY id DESC LIMIT 1");
            if ($stmt_q) {
                $stmt_q->bind_param("is", $clean_id, $rfq_num);
                $stmt_q->execute();
                $res_q = $stmt_q->get_result();
                if ($res_q && $res_q->num_rows > 0) {
                    $quo_row = $res_q->fetch_assoc();
                }
                $stmt_q->close();
            }

            if (!$quo_row && $row) {
                $quo_id = 'QUO-' . time() . '-' . rand(10, 99);
                $quo_num_str = 'QUO-ABM/MY/' . date('Y') . '/' . sprintf('%04d', rand(1000, 9999));
                $client_email = $row['client_email'] ?? '';
                $client_name = $row['client_name'] ?? (explode('@', $client_email)[0] ?: 'Client');
                $client_name = ucwords(str_replace(['.', '_', '-'], ' ', $client_name));
                $company_name = $row['company_name'] ?? $client_name;
                $date_issued = date('Y-m-d');
                $valid_until = date('Y-m-d', strtotime('+14 days'));
                $item_req = $row['item_requested'] ?: ($row['subject'] ?: 'Industrial Maritime Supply Requisition');
                $created_by = $user_name;

                $ins_q = $db_conn->prepare("INSERT INTO quotations (id, rfq_id, quotation_number, client_name, client_email, company_name, date_issued, valid_until, subtotal, discount_total, tax_percent, tax_amount, grand_total, notes, status, ocr_scan_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, 11.00, 0.00, 0.00, ?, 'in_progress', 'pending', ?)");
                if ($ins_q) {
                    $ins_q->bind_param("sissssssss", $quo_id, $clean_id, $quo_num_str, $client_name, $client_email, $company_name, $date_issued, $valid_until, $item_req, $created_by);
                    $ins_q->execute();
                    $ins_q->close();

                    // Insert initial analyzed item
                    $ins_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, 1.0, 'Package', 0.00, 0.00, 0.00)");
                    if ($ins_item) {
                        $ins_item->bind_param("ss", $quo_id, $item_req);
                        $ins_item->execute();
                        $ins_item->close();
                    }
                }

                // Re-fetch created quotation
                $stmt_q2 = $db_conn->prepare("SELECT * FROM quotations WHERE id = ? LIMIT 1");
                if ($stmt_q2) {
                    $stmt_q2->bind_param("s", $quo_id);
                    $stmt_q2->execute();
                    $res_q2 = $stmt_q2->get_result();
                    if ($res_q2 && $res_q2->num_rows > 0) {
                        $quo_row = $res_q2->fetch_assoc();
                    }
                    $stmt_q2->close();
                }
            }

            // Load items for quotation
            if ($quo_row) {
                $items_list = [];
                $stmt_it = $db_conn->prepare("SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY id ASC");
                if ($stmt_it) {
                    $stmt_it->bind_param("s", $quo_row['id']);
                    $stmt_it->execute();
                    $res_it = $stmt_it->get_result();
                    while ($it = $res_it->fetch_assoc()) {
                        $items_list[] = [
                            'id' => (string)$it['id'],
                            'product_code' => $it['product_code'] ?? null,
                            'category_code' => $it['category_code'] ?? null,
                            'description' => $it['description'],
                            'specification' => $it['specification'] ?? '',
                            'quantity' => (float)$it['quantity'],
                            'unit' => $it['unit'],
                            'unit_price' => (float)$it['unit_price'],
                            'discount_percent' => (float)$it['discount_percent'],
                            'total' => (float)$it['total']
                        ];
                    }
                    $stmt_it->close();
                }
                $quo_row['items'] = $items_list;
            }

            // 4. Log history
            appendRfqHistoryLog($db_conn, $clean_id, 'Pindah Manual oleh User / Admin', $user_name, $user_email, 'Email dipindahkan secara manual oleh user dari tab general (Others) ke Requisition, dan draf SPH dibuat secara otomatis.');

            ob_end_clean();
            echo json_encode([
                'status' => 'success',
                'message' => 'RFQ successfully moved to Requisition and Quotation/SPH auto-generated in database',
                'rfq_id' => $rfq_id_raw,
                'quotation' => $quo_row
            ]);
            exit;
        }

        // Default status update action with optional reply details saving
        $reply_body = isset($input['reply_body']) ? trim($input['reply_body']) : null;
        $reply_sender = isset($input['reply_sender']) ? trim($input['reply_sender']) : null;

        if ($reply_body !== null) {
            // 1. Fetch client_email, recipient_email, and subject from DB or input payload
            $client_email = !empty($input['target_client_email']) && filter_var(trim($input['target_client_email']), FILTER_VALIDATE_EMAIL) !== false
                ? trim($input['target_client_email'])
                : '';
            $recipient_email = '';
            $orig_subject = '';

            // Try loading from rfq_requests table
            $stmt_load = $db_conn->prepare("SELECT client_email, recipient_email, subject FROM rfq_requests WHERE id = ? OR rfq_number = ? LIMIT 1");
            if ($stmt_load) {
                $stmt_load->bind_param("is", $clean_id, $rfq_num);
                $stmt_load->execute();
                $res_load = $stmt_load->get_result();
                if ($res_load && $res_load->num_rows > 0) {
                    $row = $res_load->fetch_assoc();
                    if (empty($client_email)) {
                        $client_email = $row['client_email'];
                    }
                    $recipient_email = $row['recipient_email'];
                    $orig_subject = $row['subject'];
                }
                $stmt_load->close();
            }

            // Find quotation linked to rfq_id or passed explicitly
            $quo_id = isset($input['quotation_id']) ? trim($input['quotation_id']) : '';
            $quo_num = null;
            if (empty($quo_id)) {
                $stmt_q = $db_conn->prepare("SELECT id, quotation_number, client_email, company_name FROM quotations WHERE rfq_id = ? OR rfq_id = ? OR id = ? OR quotation_number = ? ORDER BY id DESC LIMIT 1");
                if ($stmt_q) {
                    $stmt_q->bind_param("ssss", $clean_id, $rfq_num, $rfq_id_raw, $rfq_id_raw);
                    $stmt_q->execute();
                    $res_q = $stmt_q->get_result();
                    if ($res_q && $q_row = $res_q->fetch_assoc()) {
                        $quo_id = $q_row['id'];
                        $quo_num = $q_row['quotation_number'];
                        if (empty($client_email) && !empty($q_row['client_email'])) {
                            $client_email = $q_row['client_email'];
                        }
                    }
                    $stmt_q->close();
                }
            } else {
                $stmt_q2 = $db_conn->prepare("SELECT quotation_number, client_email FROM quotations WHERE id = ? OR quotation_number = ? LIMIT 1");
                if ($stmt_q2) {
                    $stmt_q2->bind_param("ss", $quo_id, $quo_id);
                    $stmt_q2->execute();
                    $res_q2 = $stmt_q2->get_result();
                    if ($res_q2 && $q2_row = $res_q2->fetch_assoc()) {
                        $quo_num = $q2_row['quotation_number'];
                        if (empty($client_email) && !empty($q2_row['client_email'])) {
                            $client_email = $q2_row['client_email'];
                        }
                    }
                    $stmt_q2->close();
                }
            }

            // Clean & fallback if recipient_email is empty / invalid
            if (empty($recipient_email) || filter_var($recipient_email, FILTER_VALIDATE_EMAIL) === false) {
                $recipient_email = 'sales@abmalaya.com';
            }

            // Check if quotation PDF or attached file should be attached
            $attach_pdf_path = null;
            $attach_pdf_name = null;
            $is_temp_file = false;
            
            $custom_attach = isset($input['attachment_file']) ? trim($input['attachment_file']) : '';
            if (!empty($custom_attach)) {
                $possible_paths = [
                    __DIR__ . '/uploads/pdf/' . basename($custom_attach),
                    __DIR__ . '/uploads/' . basename($custom_attach),
                    __DIR__ . '/' . ltrim($custom_attach, '/'),
                    sys_get_temp_dir() . '/' . basename($custom_attach)
                ];
                foreach ($possible_paths as $p) {
                    if (file_exists($p) && filesize($p) > 0) {
                        $attach_pdf_path = $p;
                        $attach_pdf_name = basename($custom_attach);
                        $is_temp_file = false;
                        break;
                    }
                }
            }

            if (!$attach_pdf_path && !empty($quo_id)) {
                $tmp_pdf = sys_get_temp_dir() . '/SPH_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $quo_id) . '_' . time() . '.pdf';
                $node_cmd = 'node ' . escapeshellarg(__DIR__ . '/../scripts/generate_pdf_puppeteer.cjs') . ' ' . escapeshellarg($quo_id) . ' quotation ' . escapeshellarg($tmp_pdf) . ' 2>&1';
                exec($node_cmd, $node_out, $node_code);

                if ($node_code === 0 && file_exists($tmp_pdf) && filesize($tmp_pdf) > 0) {
                    $attach_pdf_path = $tmp_pdf;
                    $attach_pdf_name = 'Surat_Penawaran_Harga_' . ($quo_num ? $quo_num : $quo_id) . '.pdf';
                    $is_temp_file = true;
                }
            }

            // 2. Try sending the real email via Gmail SMTP using sender chosen by user
            $smtp_err = '';
            $smtp_from = !empty($reply_sender) && filter_var($reply_sender, FILTER_VALIDATE_EMAIL) !== false
                ? $reply_sender
                : $recipient_email;

            if (!empty($client_email)) {
                try {
                    if (!empty($orig_subject)) {
                        $subject = stripos($orig_subject, 'Re:') === 0 ? $orig_subject : ("Re: " . $orig_subject);
                    } else if (!empty($quo_num)) {
                        $subject = "Commercial Price Quotation - {$quo_num} (AB MALAYA SDN. BHD.)";
                    } else {
                        $subject = "Official Commercial Quotation - AB MALAYA SDN. BHD.";
                    }
                    send_smtp_email($client_email, $subject, $reply_body, $smtp_from, $attach_pdf_path, $attach_pdf_name);
                } catch (Exception $ex) {
                    $smtp_err = $ex->getMessage();
                }
            } else {
                $smtp_err = "No recipient client email specified for this dispatch.";
            }

            if ($is_temp_file && $attach_pdf_path && file_exists($attach_pdf_path)) {
                @unlink($attach_pdf_path);
            }

            // 3. Determine final from sender: prefer frontend-submitted reply_sender, else fallback to DB recipient_email
            $final_reply_sender = $reply_sender;
            if (empty($final_reply_sender) || filter_var($final_reply_sender, FILTER_VALIDATE_EMAIL) === false) {
                $final_reply_sender = $recipient_email;
            }

            if (!empty($smtp_err)) {
                // SMTP dispatch failed: Log error history without updating status to penawaran_terkirim
                appendRfqHistoryLog($db_conn, $clean_id, 'Gagal Kirim Email', $user_name, $user_email, "Gagal terkirim via Gmail SMTP. Detail: {$smtp_err}");
                ob_end_clean();
                echo json_encode([
                    'status' => 'error',
                    'smtp_sent' => false,
                    'message' => 'Gagal mengirim email via Gmail SMTP: ' . $smtp_err
                ]);
                exit;
            }

            // Ensure rfq_replies table exists for multi-reply history
            $db_conn->query("CREATE TABLE IF NOT EXISTS rfq_replies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rfq_id INT DEFAULT NULL,
                rfq_number VARCHAR(100) DEFAULT NULL,
                reply_body TEXT DEFAULT NULL,
                reply_sender VARCHAR(255) DEFAULT NULL,
                client_email VARCHAR(255) DEFAULT NULL,
                quotation_id VARCHAR(100) DEFAULT NULL,
                quotation_number VARCHAR(100) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Save this reply in rfq_replies table for thread history
            $insReply = $db_conn->prepare("INSERT INTO rfq_replies (rfq_id, rfq_number, reply_body, reply_sender, client_email, quotation_id, quotation_number) VALUES (?, ?, ?, ?, ?, ?, ?)");
            if ($insReply) {
                $insReply->bind_param("issssss", $clean_id, $rfq_num, $reply_body, $final_reply_sender, $client_email, $quo_id, $quo_num);
                $insReply->execute();
                $insReply->close();
            }

            // 4. SMTP dispatch SUCCESS -> Update status in Database
            $stmt = $db_conn->prepare("UPDATE rfq_requests SET status = ?, reply_body = ?, reply_date = NOW(), reply_sender = ? WHERE rfq_number = ? OR id = ?");
            if ($stmt) {
                $stmt->bind_param("ssssi", $status, $reply_body, $final_reply_sender, $rfq_num, $clean_id);
                $stmt->execute();
                $stmt->close();
                
                $log_detail = "Email balasan BERHASIL terkirim ke klien via SMTP ({$client_email}) dengan lampiran PDF SPH (" . ($attach_pdf_name ? $attach_pdf_name : "No PDF attachment") . "). Pengirim: {$final_reply_sender}.";
                appendRfqHistoryLog($db_conn, $clean_id, 'Kirim Balasan Email', $user_name, $user_email, $log_detail);
            }

            // Also update quotation status in database to done_send if quotation was found
            if (!empty($quo_id)) {
                $upd_q = $db_conn->prepare("UPDATE quotations SET status = 'done_send', updated_at = NOW() WHERE id = ? OR quotation_number = ?");
                if ($upd_q) {
                    $upd_q->bind_param("ss", $quo_id, $quo_id);
                    $upd_q->execute();
                    $upd_q->close();
                }
            }
        } else {
            $stmt = $db_conn->prepare("UPDATE rfq_requests SET status = ? WHERE rfq_number = ? OR id = ?");
            if ($stmt) {
                $stmt->bind_param("ssi", $status, $rfq_num, $clean_id);
                $stmt->execute();
                $stmt->close();
                
                // Log history
                $status_labels = [
                    'masuk' => 'Diterima (Received)',
                    'diproses' => 'In Progress (Diproses)',
                    'in_progress' => 'In Progress (Diproses)',
                    'penawaran_terkirim' => 'Sent / Replied (Dikirim / Dibalas)',
                    'deal' => 'Done (Selesai)'
                ];
                $lbl = $status_labels[$status] ?? $status;
                appendRfqHistoryLog($db_conn, $clean_id, 'Update Status Penawaran', $user_name, $user_email, "Status RFQ penawaran diperbarui secara manual ke: {$lbl}.");
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'RFQ status updated successfully in MySQL database',
            'rfq_id' => $rfq_id_raw,
            'new_status' => $status
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

/**
 * Sends a real email via Gmail SMTP using fsockopen socket connection with optional PDF attachment.
 * CPanel compatible, zero third-party library dependencies.
 */
function send_smtp_email(string $to, string $subject, string $body, string $from_email, ?string $attachment_path = null, ?string $attachment_filename = null): bool {
    $host = 'smtp.gmail.com';
    $port = 465; // SSL Port
    $username = 'abmalayaindustry@gmail.com';
    global $db_conn;
    $password = getenv('GMAIL_LIVE_APP_PASSWORD') ?: '';
    if (empty($password) && isset($db_conn) && $db_conn) {
        $res_pass = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'SMTP_APP_PASSWORD' LIMIT 1");
        if ($res_pass && $row_pass = $res_pass->fetch_assoc()) {
            $password = trim($row_pass['credential_value']);
        }
    }
    
    // Choose From Name dynamically based on the targeted alias
    $from_name = 'AB Malaya Industry';
    $low_email = strtolower($from_email);
    if (strpos($low_email, 'sales') !== false) {
        $from_name = 'AB Malaya Sales & Estimating';
    } else if (strpos($low_email, 'info') !== false) {
        $from_name = 'AB Malaya Info Desk';
    } else if (strpos($low_email, 'admin') !== false) {
        $from_name = 'AB Malaya Admin Office';
    }

    $socket_host = "ssl://{$host}";

    $socket = @fsockopen($socket_host, $port, $errno, $errstr, 20);
    if (!$socket) {
        throw new Exception("SMTP socket connection failed: {$errstr} ({$errno})");
    }

    $read = function($socket, $expected_code) {
        $response = '';
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') break;
        }
        $code = substr($response, 0, 3);
        if ($code !== $expected_code) {
            throw new Exception("SMTP Error: Expected {$expected_code}, got {$response}");
        }
        return $response;
    };

    try {
        $read($socket, '220');

        fwrite($socket, "EHLO localhost\r\n");
        $read($socket, '250');

        fwrite($socket, "AUTH LOGIN\r\n");
        $read($socket, '334');

        fwrite($socket, base64_encode($username) . "\r\n");
        $read($socket, '334');

        fwrite($socket, base64_encode($password) . "\r\n");
        $read($socket, '235');

        fwrite($socket, "MAIL FROM:<{$from_email}>\r\n");
        $read($socket, '250');

        fwrite($socket, "RCPT TO:<{$to}>\r\n");
        $read($socket, '250');

        fwrite($socket, "DATA\r\n");
        $read($socket, '354');

        if ($attachment_path && file_exists($attachment_path)) {
            $boundary = "==Multipart_Boundary_x" . md5(time()) . "x";

            $headers = [
                "MIME-Version: 1.0",
                "Content-Type: multipart/mixed; boundary=\"{$boundary}\"",
                "From: =?UTF-8?B?" . base64_encode($from_name) . "?= <{$from_email}>",
                "To: <{$to}>",
                "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
                "Date: " . date('r'),
                "Message-ID: <" . time() . "-" . md5($to) . "@abmalaya.com>"
            ];

            $msg_body  = "--{$boundary}\r\n";
            $msg_body .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $msg_body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
            $msg_body .= $body . "\r\n\r\n";

            $pdf_data = file_get_contents($attachment_path);
            $base64_pdf = chunk_split(base64_encode($pdf_data));

            $msg_body .= "--{$boundary}\r\n";
            $msg_body .= "Content-Type: application/pdf; name=\"" . ($attachment_filename ?: 'SPH_Quotation.pdf') . "\"\r\n";
            $msg_body .= "Content-Transfer-Encoding: base64\r\n";
            $msg_body .= "Content-Disposition: attachment; filename=\"" . ($attachment_filename ?: 'SPH_Quotation.pdf') . "\"\r\n\r\n";
            $msg_body .= $base64_pdf . "\r\n";
            $msg_body .= "--{$boundary}--";

            $message = implode("\r\n", $headers) . "\r\n\r\n" . $msg_body;
        } else {
            $headers = [
                "MIME-Version: 1.0",
                "Content-Type: text/plain; charset=UTF-8",
                "From: =?UTF-8?B?" . base64_encode($from_name) . "?= <{$from_email}>",
                "To: <{$to}>",
                "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
                "Date: " . date('r'),
                "Message-ID: <" . time() . "-" . md5($to) . "@abmalaya.com>"
            ];

            $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;
        }

        $message = str_replace("\n.", "\n..", $message);

        fwrite($socket, $message . "\r\n.\r\n");
        $read($socket, '250');

        fwrite($socket, "QUIT\r\n");
        fclose($socket);

        return true;
    } catch (Exception $e) {
        @fclose($socket);
        throw $e;
    }
}
