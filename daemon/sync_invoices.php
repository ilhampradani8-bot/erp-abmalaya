<?php
/**
 * ABM Malaya ERP — Dedicated Invoice Auto-Sync & PDF Generation Daemon
 * daemon/sync_invoices.php
 *
 * Automatically converts sent quotations into Invoices in the database
 * and generates official Invoice PDF documents via Headless Chrome / Puppeteer engine.
 */

if (!defined('DAEMON_MODE')) {
    date_default_timezone_set('Asia/Kuala_Lumpur');
}

require_once __DIR__ . '/../public/db_connect.php';

function syncAndGenerateInvoicePDFs($db_conn) {
    if (!$db_conn || $db_conn->connect_error) return 0;

    // 1. Ensure `invoices` & `invoice_items` table structure
    $db_conn->query("CREATE TABLE IF NOT EXISTS `invoices` (
        `id` VARCHAR(50) NOT NULL PRIMARY KEY,
        `invoice_number` VARCHAR(50) NOT NULL UNIQUE,
        `quotation_id` VARCHAR(50) DEFAULT NULL,
        `po_number` VARCHAR(100) DEFAULT NULL,
        `invoice_date` DATE NOT NULL,
        `due_date` DATE DEFAULT NULL,
        `client_name` VARCHAR(100) NOT NULL,
        `client_email` VARCHAR(100) NOT NULL,
        `client_phone` VARCHAR(50) DEFAULT NULL,
        `company_name` VARCHAR(100) NOT NULL,
        `billing_address` TEXT DEFAULT NULL,
        `delivery_company` VARCHAR(100) DEFAULT NULL,
        `delivery_address` TEXT DEFAULT NULL,
        `delivery_pic` VARCHAR(100) DEFAULT NULL,
        `delivery_phone` VARCHAR(50) DEFAULT NULL,
        `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        `discount_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        `tax_percent` DECIMAL(5, 2) NOT NULL DEFAULT 11.00,
        `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        `grand_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        `bank_name` VARCHAR(100) DEFAULT 'PUBLIC BANK',
        `bank_account_number` VARCHAR(100) DEFAULT '3818192115',
        `bank_account_name` VARCHAR(255) DEFAULT 'AB MALAYA INDUSTRY',
        `bank_email` VARCHAR(100) DEFAULT 'abmalayaindustry@gmail.com',
        `notes` TEXT DEFAULT NULL,
        `status` VARCHAR(50) NOT NULL DEFAULT 'unpaid',
        `invoice_file` TEXT DEFAULT NULL,
        `pdf_created` TINYINT(1) DEFAULT 0,
        `pdf_created_at` DATETIME DEFAULT NULL,
        `created_by` VARCHAR(100) DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $db_conn->query("CREATE TABLE IF NOT EXISTS `invoice_items` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `invoice_id` VARCHAR(50) NOT NULL,
        `product_code` VARCHAR(100) DEFAULT NULL,
        `description` TEXT NOT NULL,
        `specification` TEXT DEFAULT NULL,
        `offer` TEXT DEFAULT NULL,
        `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1.00,
        `unit` VARCHAR(50) DEFAULT 'Unit',
        `unit_price` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        `discount_percent` DECIMAL(5, 2) DEFAULT 0.00,
        `total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
        `image_url` TEXT DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Ensure columns exist in invoices table
    $inv_cols = [
        'invoice_file' => "ALTER TABLE invoices ADD COLUMN invoice_file TEXT DEFAULT NULL",
        'pdf_created' => "ALTER TABLE invoices ADD COLUMN pdf_created TINYINT(1) DEFAULT 0",
        'pdf_created_at' => "ALTER TABLE invoices ADD COLUMN pdf_created_at DATETIME DEFAULT NULL"
    ];
    foreach ($inv_cols as $col => $sql) {
        $chk = $db_conn->query("SHOW COLUMNS FROM invoices LIKE '$col'");
        if ($chk && $chk->num_rows === 0) {
            @$db_conn->query($sql);
        }
    }

    $processed = 0;

    // 2. Auto-create Invoices from Sent Quotations
    $quo_res = $db_conn->query("SELECT * FROM quotations WHERE status IN ('penawaran_terkirim', 'done_send', 'sent', 'deal', 'Approved', 'acc') OR pdf_created = 1");
    if ($quo_res && $quo_res->num_rows > 0) {
        while ($q = $quo_res->fetch_assoc()) {
            $quo_id = $q['id'];
            $quo_num = $q['quotation_number'] ?: $quo_id;

            // Check if invoice already created for this quotation
            $chk_inv = $db_conn->query("SELECT id FROM invoices WHERE quotation_id = '" . $db_conn->real_escape_string($quo_id) . "' OR po_number = '" . $db_conn->real_escape_string($quo_num) . "' LIMIT 1");
            if (!$chk_inv || $chk_inv->num_rows === 0) {
                $inv_id = 'INV-' . time() . '-' . rand(100, 999);
                $inv_num = 'INV-ABM/MY/2026/0' . rand(100, 999);
                $inv_date = date('Y-m-d');
                $due_date = date('Y-m-d', strtotime('+14 days'));
                
                $c_name = $q['client_name'] ?: 'Valued Client';
                $c_email = $q['client_email'] ?: 'abmalayaindustry@gmail.com';
                $c_phone = $q['client_phone'] ?? '';
                $comp_name = $q['company_name'] ?: $c_name;
                $bill_addr = $q['address_line1'] ?? '';
                $subtotal = floatval($q['subtotal'] ?? 0);
                $disc_total = floatval($q['discount_total'] ?? 0);
                $tax_pct = floatval($q['tax_percent'] ?? 11);
                $tax_amt = floatval($q['tax_amount'] ?? 0);
                $grand_total = floatval($q['grand_total'] ?? 0);
                $notes = 'Commercial Invoice generated automatically from Quotation SPH #' . $quo_num;
                $created_by = 'Automated Invoice Daemon Machine';

                $stmt_inv = $db_conn->prepare("INSERT INTO invoices (
                    id, invoice_number, quotation_id, po_number, invoice_date, due_date, 
                    client_name, client_email, client_phone, company_name, billing_address, 
                    subtotal, discount_total, tax_percent, tax_amount, grand_total, 
                    notes, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)");

                if ($stmt_inv) {
                    $stmt_inv->bind_param("sssssssssssddddsss", 
                        $inv_id, $inv_num, $quo_id, $quo_num, $inv_date, $due_date, 
                        $c_name, $c_email, $c_phone, $comp_name, $bill_addr, 
                        $subtotal, $disc_total, $tax_pct, $tax_amt, $grand_total, 
                        $notes, $created_by);
                    if ($stmt_inv->execute()) {
                        // Copy Items from quotation_items to invoice_items
                        $q_items = $db_conn->query("SELECT * FROM quotation_items WHERE quotation_id = '" . $db_conn->real_escape_string($quo_id) . "'");
                        if ($q_items && $q_items->num_rows > 0) {
                            $stmt_item = $db_conn->prepare("INSERT INTO invoice_items (
                                invoice_id, product_code, description, specification, offer, quantity, unit, unit_price, discount_percent, total, image_url
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                            while ($qi = $q_items->fetch_assoc()) {
                                $p_code = $qi['product_code'] ?? '';
                                $desc = $qi['description'] ?? 'Product Item';
                                $spec = $qi['specification'] ?? '';
                                $offer = $qi['offer'] ?? '';
                                $qty = floatval($qi['quantity'] ?? 1);
                                $unit = $qi['unit'] ?? 'Unit';
                                $price = floatval($qi['unit_price'] ?? 0);
                                $disc = floatval($qi['discount_percent'] ?? 0);
                                $tot = floatval($qi['total'] ?? 0);
                                $img = $qi['image_url'] ?? '';

                                if ($stmt_item) {
                                    $stmt_item->bind_param("sssssdsddds", $inv_id, $p_code, $desc, $spec, $offer, $qty, $unit, $price, $disc, $tot, $img);
                                    $stmt_item->execute();
                                }
                            }
                            if ($stmt_item) $stmt_item->close();
                        }
                        $processed++;
                    }
                    $stmt_inv->close();
                }
            }
        }
    }

    // 3. Generate PDFs for pending Invoices
    $pdf_dir = __DIR__ . '/../public/uploads/pdf/';
    if (!file_exists($pdf_dir)) {
        @mkdir($pdf_dir, 0777, true);
    }

    $node_script = __DIR__ . '/../scripts/generate_pdf_puppeteer.cjs';
    if (!file_exists($node_script)) {
        $node_script = __DIR__ . '/scripts/generate_pdf_puppeteer.cjs';
    }

    $pending_invs = $db_conn->query("SELECT * FROM invoices WHERE pdf_created = 0 OR invoice_file IS NULL OR invoice_file = '' ORDER BY id DESC LIMIT 10");
    if ($pending_invs && $pending_invs->num_rows > 0) {
        while ($inv = $pending_invs->fetch_assoc()) {
            $inv_id = $inv['id'];
            $inv_num = $inv['invoice_number'] ?: $inv_id;
            $safe_fn = preg_replace('/[^A-Za-z0-9_\-]/', '_', $inv_num) . '.pdf';
            $pdf_path = $pdf_dir . $safe_fn;
            $pdf_url = '/uploads/pdf/' . $safe_fn;

            $target_view_url = "http://127.0.0.1:8000/view_doc.php?type=invoice&id=" . urlencode($inv_id);
            $cmd = "node " . escapeshellarg($node_script) . " invoice " . escapeshellarg($inv_id) . " " . escapeshellarg($pdf_path) . " " . escapeshellarg($target_view_url) . " 2>&1";

            @exec($cmd, $out, $ret);

            if (file_exists($pdf_path) && filesize($pdf_path) > 100) {
                $up = $db_conn->prepare("UPDATE invoices SET pdf_created = 1, pdf_created_at = NOW(), invoice_file = ? WHERE id = ?");
                if ($up) {
                    $up->bind_param("ss", $pdf_url, $inv_id);
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
$inv_count = syncAndGenerateInvoicePDFs($db_conn);
if (php_sapi_name() === 'cli' && basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    echo "[" . date('Y-m-d H:i:s') . "] Invoice Automation Daemon Complete. Processed/Generated {$inv_count} Invoices & PDFs.\n";
}
