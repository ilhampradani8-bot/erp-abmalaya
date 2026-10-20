<?php
/**
 * ABM Malaya ERP — Dedicated Quotation Auto-Sync Daemon
 * daemon/sync_quotations.php
 *
 * Automatically syncs all verified AI Requisition emails (client_rfq)
 * into the quotations table as 'in_progress' status without requiring manual clicks.
 */

if (!defined('DAEMON_MODE')) {
    date_default_timezone_set('Asia/Kuala_Lumpur');
}

require_once __DIR__ . '/../public/db_connect.php';

function syncVerifiedClientRfqsToQuotations($db_conn) {
    if (!$db_conn || $db_conn->connect_error) return 0;

    $res = $db_conn->query("SELECT * FROM rfq_requests WHERE ai_verified = 1 AND ai_classification = 'client_rfq'");
    if (!$res || $res->num_rows === 0) {
        return 0;
    }

    $processed = 0;
    while ($row = $res->fetch_assoc()) {
        $rfq_id = (int)$row['id'];
        $rfq_num = $row['rfq_number'];

        // 1. Check if quotation entry already exists in quotations table
        $check = $db_conn->query("SELECT id, quotation_number FROM quotations WHERE rfq_id = {$rfq_id} LIMIT 1");
        $quo_exists = ($check && $check->num_rows > 0);
        $insert_error = null;

        if (!$quo_exists) {
            $quo_id = 'QUO-' . time() . '-' . rand(100, 999) . '-' . $processed;
            $quo_num = 'SPH-ABM/MY/2026/0' . rand(100, 999);
            
            $client_email = $row['client_email'];
            $client_name = explode('@', $client_email)[0];
            $client_name = ucwords(str_replace(['.', '_', '-'], ' ', $client_name));
            $company_name = $client_name;

            $date_issued = date('Y-m-d');
            $valid_until = date('Y-m-d', strtotime('+14 days'));
            $item_requested = $row['item_requested'] ?? '';
            $notes = $item_requested ?: $row['subject'];
            $created_by = 'System Automation Daemon';
            $tax_percent = 11.00;

            $stmt_quo = $db_conn->prepare("INSERT INTO quotations (id, rfq_id, quotation_number, client_name, client_email, company_name, date_issued, valid_until, subtotal, discount_total, tax_percent, tax_amount, grand_total, notes, status, ocr_scan_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, 0.00, 0.00, ?, 'in_progress', 'pending', ?)");
            if ($stmt_quo) {
                $stmt_quo->bind_param("sissssssdss", $quo_id, $rfq_id, $quo_num, $client_name, $client_email, $company_name, $date_issued, $valid_until, $tax_percent, $notes, $created_by);
                if ($stmt_quo->execute()) {
                    $desc = $item_requested ?: 'Industrial Equipment Specification';
                    $stmt_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, 1.00, 'Package', 0.00, 0.00, 0.00)");
                    if ($stmt_item) {
                        $stmt_item->bind_param("ss", $quo_id, $desc);
                        $stmt_item->execute();
                        $stmt_item->close();
                    }
                    $processed++;
                } else {
                    $insert_error = $stmt_quo->error ?: 'Unknown MySQL execution error on quotations table';
                }
                $stmt_quo->close();
            } else {
                $insert_error = $db_conn->error ?: 'Failed to prepare quotation insert statement';
            }
        }

        // 2. TWO-WAY VALIDATION: Confirm directly from quotations table that the quotation really exists
        $verify = $db_conn->query("SELECT id, quotation_number FROM quotations WHERE rfq_id = {$rfq_id} LIMIT 1");
        if ($verify && $verify->num_rows > 0) {
            $v_row = $verify->fetch_assoc();
            $v_quo_id = $v_row['id'];
            $v_quo_num = $v_row['quotation_number'];
            
            // Validated 2-way: Safe to mark in_progress in rfq_requests!
            $up_stmt = $db_conn->prepare("UPDATE rfq_requests SET status = 'in_progress', quotation_id = ?, quotation_number = ?, ai_error = NULL WHERE id = ?");
            if ($up_stmt) {
                $up_stmt->bind_param("ssi", $v_quo_id, $v_quo_num, $rfq_id);
                $up_stmt->execute();
                $up_stmt->close();
            }
        } else {
            // TWO-WAY VALIDATION FAILED: Quotation was NOT created!
            // Do NOT mark in_progress! Record error into rfq_requests.ai_error and system_notifications
            $daemon_err = "Daemon Error: Validasi 2-Arah Gagal - Data penawaran gagal masuk ke daftar quotations. " . ($insert_error ? "Detail: {$insert_error}" : "");
            $db_conn->query("UPDATE rfq_requests SET ai_error = '" . $db_conn->real_escape_string($daemon_err) . "' WHERE id = {$rfq_id}");

            // Log error to system_notifications
            $notif_stmt = $db_conn->prepare("INSERT INTO system_notifications (title, message, type, category, action_link) VALUES (?, ?, 'danger', 'daemon', 'inbox')");
            if ($notif_stmt) {
                $n_title = "Daemon Error: RFQ #{$rfq_num}";
                $notif_stmt->bind_param("ss", $n_title, $daemon_err);
                $notif_stmt->execute();
                $notif_stmt->close();
            }
        }
    }

    // Auto-generate PDF files for pending quotations
    $pdf_dir = __DIR__ . '/../public/uploads/pdf/';
    if (!file_exists($pdf_dir)) {
        @mkdir($pdf_dir, 0777, true);
    }
    $node_script = __DIR__ . '/../scripts/generate_pdf_puppeteer.cjs';
    $pending_quos = $db_conn->query("SELECT * FROM quotations WHERE pdf_created = 0 OR quotation_file IS NULL OR quotation_file = '' ORDER BY id DESC LIMIT 10");
    if ($pending_quos && $pending_quos->num_rows > 0) {
        while ($q = $pending_quos->fetch_assoc()) {
            $q_id = $q['id'];
            $q_num = $q['quotation_number'] ?: $q_id;
            $safe_fn = preg_replace('/[^A-Za-z0-9_\-]/', '_', $q_num) . '.pdf';
            $pdf_path = $pdf_dir . $safe_fn;
            $pdf_url = '/uploads/pdf/' . $safe_fn;

            $target_view_url = "http://127.0.0.1:8000/view_doc.php?type=quotation&id=" . urlencode($q_id);
            $cmd = "node " . escapeshellarg($node_script) . " quotation " . escapeshellarg($q_id) . " " . escapeshellarg($pdf_path) . " " . escapeshellarg($target_view_url) . " 2>&1";

            @exec($cmd, $out, $ret);

            if (!file_exists($pdf_path) || filesize($pdf_path) < 100) {
                if (file_exists(__DIR__ . '/../public/pdf_generator_helper.php')) {
                    require_once __DIR__ . '/../public/pdf_generator_helper.php';
                    if (function_exists('createQuotationPdfFile')) {
                        createQuotationPdfFile($pdf_path, $q);
                    }
                }
            }

            if (file_exists($pdf_path) && filesize($pdf_path) > 100) {
                $up = $db_conn->prepare("UPDATE quotations SET pdf_created = 1, pdf_created_at = NOW(), quotation_file = ? WHERE id = ?");
                if ($up) {
                    $up->bind_param("ss", $pdf_url, $q_id);
                    $up->execute();
                    $up->close();
                    $processed++;
                }
            }
        }
    }

    return $processed;
}

// Execute sync if run directly
$synced_count = syncVerifiedClientRfqsToQuotations($db_conn);
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    echo "[" . date('Y-m-d H:i:s') . "] Quotation Sync & PDF Automation Complete. Auto-synced {$synced_count} RFQs & PDFs to quotations table.\n";
}
