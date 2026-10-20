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

    // 2. Do NOT auto-create invoices from quotations without user action (invoices must only be created explicitly by user)

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

            if (!file_exists($pdf_path) || filesize($pdf_path) < 100) {
                if (file_exists(__DIR__ . '/../public/api_rfq_status.php')) {
                    require_once __DIR__ . '/../public/api_rfq_status.php';
                    if (function_exists('createInvoicePdfFile')) {
                        createInvoicePdfFile($pdf_path, $inv_num, $inv['client_name'] ?? '', $inv['company_name'] ?? '', $inv['grand_total'] ?? 0);
                    }
                }
            }

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
