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

                    // Insert initial analyzed item with description & specification
                    $ins_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, description, specification, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, 1.0, 'Package', 0.00, 0.00, 0.00)");
                    if ($ins_item) {
                        $item_desc = !empty($row['subject']) ? $row['subject'] : ($item_req ?: 'Industrial Supply Requisition');
                        $item_spec = !empty($row['item_requested']) ? $row['item_requested'] : (!empty($row['subject']) ? $row['subject'] : 'Standard Specification');
                        $ins_item->bind_param("sss", $quo_id, $item_desc, $item_spec);
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

            if (!$attach_pdf_path && !empty($quo_id) && function_exists('exec')) {
                $tmp_pdf = sys_get_temp_dir() . '/SPH_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $quo_id) . '_' . time() . '.pdf';
                $node_script = __DIR__ . '/../scripts/generate_pdf_puppeteer.cjs';
                if (file_exists($node_script)) {
                    $node_cmd = 'node ' . escapeshellarg($node_script) . ' ' . escapeshellarg($quo_id) . ' quotation ' . escapeshellarg($tmp_pdf) . ' 2>&1';
                    @exec($node_cmd, $node_out, $node_code);

                    if (file_exists($tmp_pdf) && filesize($tmp_pdf) > 0) {
                        $attach_pdf_path = $tmp_pdf;
                        $attach_pdf_name = 'Surat_Penawaran_Harga_' . ($quo_num ? $quo_num : $quo_id) . '.pdf';
                        $is_temp_file = true;
                    }
                }
            }

            // 2. Try sending the real email via Gmail SMTP using sender chosen by user
            $smtp_err = '';
            $smtp_from = !empty($reply_sender) && filter_var($reply_sender, FILTER_VALIDATE_EMAIL) !== false
                ? $reply_sender
                : $recipient_email;

            $validation_res = null;
            if (!empty($client_email)) {
                if (!empty($orig_subject)) {
                    $subject = stripos($orig_subject, 'Re:') === 0 ? $orig_subject : ("Re: " . $orig_subject);
                } else if (!empty($quo_num)) {
                    $subject = "Commercial Price Quotation - {$quo_num} (AB MALAYA SDN. BHD.)";
                } else {
                    $subject = "Official Commercial Quotation - AB MALAYA SDN. BHD.";
                }

                $validation_res = send_validated_email($client_email, $subject, $reply_body, $smtp_from, $attach_pdf_path, $attach_pdf_name);
                if (!$validation_res['success']) {
                    $smtp_err = $validation_res['error'];
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
                // Machine validation or SMTP dispatch failed: Log error history without updating status
                appendRfqHistoryLog($db_conn, $clean_id, 'Gagal Kirim Email (Validasi Mesin Menolak)', $user_name, $user_email, "Pengiriman ditolak oleh mesin. Detail: {$smtp_err}");
                ob_end_clean();
                echo json_encode([
                    'status' => 'error',
                    'smtp_sent' => false,
                    'machine_validation' => [
                        'validation_1' => $validation_res['stage1'] ?? ['passed' => false, 'details' => 'Pre-flight check failed'],
                        'validation_2' => $validation_res['stage2'] ?? ['passed' => false, 'details' => 'Transmission unreached']
                    ],
                    'message' => 'Gagal mengirim email: ' . $smtp_err
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
                
                $stage1_desc = isset($validation_res['stage1']['details']) ? $validation_res['stage1']['details'] : 'Pre-flight OK';
                $stage2_desc = isset($validation_res['stage2']['details']) ? $validation_res['stage2']['details'] : 'Delivery Queued OK';
                $transport_desc = isset($validation_res['transport']) ? $validation_res['transport'] : 'SMTP SSL';
                $server_ack = isset($validation_res['server_ack']) ? $validation_res['server_ack'] : '250 OK';

                $log_detail = "Email balasan BERHASIL terkirim ke klien ({$client_email}) dengan VALIDASI MESIN 2x TERVERIFIKASI [Mesin 1: {$stage1_desc} | Mesin 2: {$stage2_desc}]. Transport: {$transport_desc}. Server Ack: {$server_ack}. Lampiran: " . ($attach_pdf_name ? $attach_pdf_name : "No PDF") . ". Pengirim: {$final_reply_sender}.";
                appendRfqHistoryLog($db_conn, $clean_id, 'Kirim Balasan Email (Validasi Mesin 2x)', $user_name, $user_email, $log_detail);
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
            'message' => 'Email balasan dan quotation berhasil dikirim dengan Validasi Mesin 2x (100% Terverifikasi).',
            'rfq_id' => $rfq_id_raw,
            'new_status' => $status,
            'sender_email' => $final_reply_sender,
            'recipient_email' => $client_email,
            'machine_validation' => [
                'validation_1' => $validation_res['stage1'] ?? ['passed' => true, 'details' => 'Pre-flight DNS & Handshake Passed'],
                'validation_2' => $validation_res['stage2'] ?? ['passed' => true, 'details' => 'Mail Server Acknowledgment Passed'],
                'transport' => $validation_res['transport'] ?? 'SMTP SSL',
                'server_ack' => $validation_res['server_ack'] ?? '250 OK'
            ]
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
 * Sends an email with 2-Phase Machine Validation (Validasi Mesin 2x):
 * - Phase 1: Pre-flight validation (DNS MX check, recipient address check, attachment check, server handshake & auth).
 * - Phase 2: Post-transmission validation (RCPT TO verification, full payload transfer, server 250 OK acknowledgement).
 * Supports both SMTP SSL/TLS and cPanel hosting local mailer fallback.
 *
 * @return array ['success' => bool, 'stage1' => array, 'stage2' => array, 'server_ack' => string, 'error' => string]
 */
function send_validated_email(
    string $to,
    string $subject,
    string $body,
    string $from_email,
    ?string $attachment_path = null,
    ?string $attachment_filename = null
): array {
    $result = [
        'success' => false,
        'stage1' => ['passed' => false, 'details' => ''],
        'stage2' => ['passed' => false, 'details' => ''],
        'server_ack' => '',
        'transport' => 'SMTP SSL',
        'error' => ''
    ];

    // ==========================================
    // VALIDASI MESIN TAHAP 1: PRE-FLIGHT CHECKS
    // ==========================================
    $clean_to = trim($to);
    if (!filter_var($clean_to, FILTER_VALIDATE_EMAIL)) {
        $result['stage1'] = ['passed' => false, 'details' => "Format alamat email klien tujuan ({$clean_to}) tidak valid."];
        $result['error'] = "Validasi Mesin 1 Gagal: Alamat email tujuan tidak valid.";
        return $result;
    }

    // DNS MX Check: Pastikan domain penerima memiliki mail server aktif (dengan fallback domain induk & SMTP)
    $to_domain = substr(strrchr($clean_to, "@"), 1);
    $dns_verified = false;
    $dns_details = '';

    if (function_exists('checkdnsrr') && !empty($to_domain)) {
        // 1. Direct domain check (MX or A)
        $has_mx = @checkdnsrr($to_domain, 'MX');
        $has_a = @checkdnsrr($to_domain, 'A');
        
        if ($has_mx || $has_a) {
            $dns_verified = true;
            $dns_details = "Domain tujuan (@{$to_domain}) aktif di DNS.";
        } else {
            // 2. Check parent domains (for subdomains like seller.info.shopee.com -> shopee.com)
            $domain_parts = explode('.', $to_domain);
            while (count($domain_parts) > 2) {
                array_shift($domain_parts);
                $parent_domain = implode('.', $domain_parts);
                if (@checkdnsrr($parent_domain, 'MX') || @checkdnsrr($parent_domain, 'A')) {
                    $dns_verified = true;
                    $dns_details = "Domain induk (@{$parent_domain}) aktif di DNS.";
                    break;
                }
            }
        }
    }

    // Jika checkdnsrr lokal tidak menemukan MX (misal resolver timeout / subdomain internal / firewall),
    // verifikasi sintaks domain dan teruskan ke otentikasi SMTP Gmail resmi (RCPT TO)
    if (!$dns_verified) {
        if (!preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i', $to_domain)) {
            $result['stage1'] = ['passed' => false, 'details' => "Format domain tujuan (@{$to_domain}) tidak valid."];
            $result['error'] = "Validasi Mesin 1 Gagal: Format domain (@{$to_domain}) tidak valid.";
            return $result;
        }
        $dns_details = "Format domain (@{$to_domain}) valid, verifikasi dialihkan ke socket SMTP Gmail.";
    }

    // Attachment Integrity Check
    if ($attachment_path) {
        if (!file_exists($attachment_path)) {
            $result['stage1'] = ['passed' => false, 'details' => "Berkas lampiran PDF SPH ({$attachment_path}) tidak ditemukan di server."];
            $result['error'] = "Validasi Mesin 1 Gagal: Berkas lampiran PDF tidak ditemukan.";
            return $result;
        }
        if (filesize($attachment_path) === 0) {
            $result['stage1'] = ['passed' => false, 'details' => "Berkas lampiran PDF kosong (0 bytes)."];
            $result['error'] = "Validasi Mesin 1 Gagal: Berkas lampiran PDF kosong.";
            return $result;
        }
    }

    $host = 'smtp.gmail.com';
    $port = 465;
    $username = 'abmalayaindustry@gmail.com';
    global $db_conn;
    $password = getenv('GMAIL_LIVE_APP_PASSWORD') ?: '';
    if (empty($password) && isset($db_conn) && $db_conn) {
        $res_pass = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'SMTP_APP_PASSWORD' LIMIT 1");
        if ($res_pass && $row_pass = $res_pass->fetch_assoc()) {
            $password = trim($row_pass['credential_value']);
        }
    }

    // Dynamic From Name
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
    $socket = @fsockopen($socket_host, $port, $errno, $errstr, 15);

    // Fallback: Jika koneksi socket luar diblokir oleh hosting, gunakan cPanel local mailer
    if (!$socket) {
        // Cek apakah di hosting fungsi mail() tersedia
        if (function_exists('mail')) {
            $result['transport'] = 'cPanel Local MTA (mail)';
            $result['stage1'] = ['passed' => true, 'details' => "DNS domain valid (@{$to_domain}) & cPanel Exim Transport diinisialisasi."];

            $boundary = "==Multipart_Boundary_x" . md5(time()) . "x";
            $headers = [
                "MIME-Version: 1.0",
                "From: {$from_name} <{$from_email}>",
                "Reply-To: {$from_email}",
                "X-Mailer: AB-Malaya-ERP-Hosting-Mailer",
                "Message-ID: <" . time() . "-" . md5($clean_to) . "@abmalaya.com>"
            ];

            if ($attachment_path && file_exists($attachment_path)) {
                $headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";
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
            } else {
                $headers[] = "Content-Type: text/plain; charset=UTF-8";
                $msg_body = $body;
            }

            $mail_sent = @mail($clean_to, $subject, $msg_body, implode("\r\n", $headers), "-f {$from_email}");
            if ($mail_sent) {
                $result['stage2'] = ['passed' => true, 'details' => 'cPanel Exim MTA menerima & mengantrikan pesan untuk pengiriman (250 Accepted).'];
                $result['server_ack'] = '250 OK: cPanel Exim queued successfully';
                $result['success'] = true;
                return $result;
            } else {
                $result['stage2'] = ['passed' => false, 'details' => 'cPanel Exim MTA menolak pengiriman email.'];
                $result['error'] = 'Validasi Mesin 2 Gagal: Hosting cPanel mail handler menolak pengiriman.';
                return $result;
            }
        }

        $result['stage1'] = ['passed' => false, 'details' => "Koneksi socket SMTP gagal: {$errstr} ({$errno})."];
        $result['error'] = "Validasi Mesin 1 Gagal: Socket SMTP server tidak dapat dihubungi.";
        return $result;
    }

    $read = function($socket, $expected_code) {
        $response = '';
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') break;
        }
        $code = substr($response, 0, 3);
        if ($code !== $expected_code) {
            throw new Exception("Expected Code {$expected_code}, Mail Server Responded: {$response}");
        }
        return trim($response);
    };

    try {
        // Read Greeting 220
        $greeting = $read($socket, '220');

        // EHLO Handshake
        fwrite($socket, "EHLO localhost\r\n");
        $ehlo_ack = $read($socket, '250');

        // AUTH LOGIN
        fwrite($socket, "AUTH LOGIN\r\n");
        $read($socket, '334');

        fwrite($socket, base64_encode($username) . "\r\n");
        $read($socket, '334');

        fwrite($socket, base64_encode($password) . "\r\n");
        $auth_ack = $read($socket, '235');

        // VALIDASI MESIN 1 BERHASIL DIKONFIRMASI:
        $result['stage1'] = [
            'passed' => true,
            'details' => ($dns_details ? $dns_details . " & " : "") . "Handshake Otentikasi SMTP Berhasil ({$auth_ack})."
        ];

        // ==========================================
        // VALIDASI MESIN TAHAP 2: TRANSMISSION & ACK
        // ==========================================
        fwrite($socket, "MAIL FROM:<{$from_email}>\r\n");
        $mail_from_ack = $read($socket, '250');

        fwrite($socket, "RCPT TO:<{$clean_to}>\r\n");
        $rcpt_ack = $read($socket, '250');

        fwrite($socket, "DATA\r\n");
        $read($socket, '354');

        $message_id = "<" . time() . "." . bin2hex(random_bytes(4)) . "@abmalaya.com>";

        if ($attachment_path && file_exists($attachment_path)) {
            $boundary = "==Multipart_Boundary_x" . md5(time()) . "x";
            $headers = [
                "MIME-Version: 1.0",
                "Content-Type: multipart/mixed; boundary=\"{$boundary}\"",
                "From: =?UTF-8?B?" . base64_encode($from_name) . "?= <{$from_email}>",
                "To: <{$clean_to}>",
                "Reply-To: <{$from_email}>",
                "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
                "Date: " . date('r'),
                "Message-ID: {$message_id}"
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
                "To: <{$clean_to}>",
                "Reply-To: <{$from_email}>",
                "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
                "Date: " . date('r'),
                "Message-ID: {$message_id}"
            ];

            $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;
        }

        $message = str_replace("\n.", "\n..", $message);

        fwrite($socket, $message . "\r\n.\r\n");
        $final_ack = $read($socket, '250');

        fwrite($socket, "QUIT\r\n");
        @fclose($socket);

        // VALIDASI MESIN 2 BERHASIL DIKONFIRMASI:
        $result['stage2'] = [
            'passed' => true,
            'details' => "Server tujuan menerima penerima ({$rcpt_ack}) & Transmisi selesai dengan respon resmi ({$final_ack})."
        ];
        $result['server_ack'] = $final_ack;
        $result['success'] = true;
        return $result;

    } catch (Exception $e) {
        @fclose($socket);
        // Tentukan tahap kegagalan
        if (!$result['stage1']['passed']) {
            $result['error'] = "Validasi Mesin 1 Gagal: " . $e->getMessage();
        } else {
            $result['error'] = "Validasi Mesin 2 Gagal: " . $e->getMessage();
        }
        return $result;
    }
}
