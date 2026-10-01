<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connect.php';
$connection = isset($conn) ? $conn : $db_conn;

$results = [];

// 1. system_paper_settings table & columns
$connection->query("CREATE TABLE IF NOT EXISTS system_paper_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) DEFAULT 'AB MALAYA SDN. BHD.',
    company_address TEXT,
    phone VARCHAR(100) DEFAULT '+60 3-8000 1234',
    email VARCHAR(100) DEFAULT 'sales@abmalaya.com',
    logo_url LONGTEXT,
    stamp_url LONGTEXT,
    signature_url LONGTEXT DEFAULT NULL,
    header_image_url LONGTEXT DEFAULT NULL,
    header_title VARCHAR(255) DEFAULT 'SURAT PENAWARAN HARGA (SPH) / COMMERCIAL QUOTATION',
    footer_terms TEXT,
    header_color VARCHAR(50) DEFAULT '#0080d0',
    default_notes TEXT,
    header_template VARCHAR(50) DEFAULT 'default',
    table_header_bg VARCHAR(50) DEFAULT '#0f172a',
    table_header_text_color VARCHAR(50) DEFAULT '#ffffff',
    paper_size VARCHAR(20) DEFAULT 'A4',
    margin_top INT DEFAULT 18,
    margin_bottom INT DEFAULT 18,
    margin_left INT DEFAULT 14,
    margin_right INT DEFAULT 14,
    font_size INT DEFAULT 9,
    layout_offsets LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$paper_cols = [
    'signature_url' => "ALTER TABLE system_paper_settings ADD COLUMN signature_url LONGTEXT DEFAULT NULL AFTER stamp_url",
    'header_image_url' => "ALTER TABLE system_paper_settings ADD COLUMN header_image_url LONGTEXT DEFAULT NULL AFTER stamp_url",
    'paper_size' => "ALTER TABLE system_paper_settings ADD COLUMN paper_size VARCHAR(20) DEFAULT 'A4'",
    'margin_top' => "ALTER TABLE system_paper_settings ADD COLUMN margin_top INT DEFAULT 18",
    'margin_bottom' => "ALTER TABLE system_paper_settings ADD COLUMN margin_bottom INT DEFAULT 18",
    'margin_left' => "ALTER TABLE system_paper_settings ADD COLUMN margin_left INT DEFAULT 14",
    'margin_right' => "ALTER TABLE system_paper_settings ADD COLUMN margin_right INT DEFAULT 14",
    'font_size' => "ALTER TABLE system_paper_settings ADD COLUMN font_size INT DEFAULT 9"
];

foreach ($paper_cols as $col => $sql) {
    $res = $connection->query("SHOW COLUMNS FROM system_paper_settings LIKE '$col'");
    if ($res && $res->num_rows === 0) {
        $connection->query($sql);
        $results['system_paper_settings'][] = "Added column $col";
    }
}

// 2. system_invoice_settings table & columns
$connection->query("CREATE TABLE IF NOT EXISTS system_invoice_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) DEFAULT 'AB MALAYA INDUSTRY',
    company_reg_no VARCHAR(100) DEFAULT '003320457-D',
    company_address TEXT,
    phone VARCHAR(100) DEFAULT '+60 3-8000 1234',
    email VARCHAR(100) DEFAULT 'abmalayaindustry@gmail.com',
    logo_url LONGTEXT,
    stamp_url LONGTEXT,
    signature_url LONGTEXT DEFAULT NULL,
    header_image_url LONGTEXT DEFAULT NULL,
    invoice_title VARCHAR(255) DEFAULT 'OFFICIAL INVOICE',
    bank_name VARCHAR(100) DEFAULT 'PUBLIC BANK',
    bank_account_number VARCHAR(100) DEFAULT '3818192115',
    bank_account_name VARCHAR(255) DEFAULT 'AB MALAYA INDUSTRY',
    bank_email VARCHAR(100) DEFAULT 'abmalayaindustry@gmail.com',
    remarks_text TEXT,
    authorised_by_name VARCHAR(255) DEFAULT 'Muhammad Aimanuddin Bin Mohd Zaki',
    authorised_by_title VARCHAR(255) DEFAULT 'Procurement Manager / Head of Sales',
    received_by_label VARCHAR(255) DEFAULT 'Received by,',
    table_header_bg VARCHAR(50) DEFAULT '#0070c0',
    table_header_text_color VARCHAR(50) DEFAULT '#ffffff',
    paper_size VARCHAR(20) DEFAULT 'A4',
    margin_top INT DEFAULT 18,
    margin_bottom INT DEFAULT 18,
    margin_left INT DEFAULT 14,
    margin_right INT DEFAULT 14,
    font_size INT DEFAULT 9,
    layout_offsets LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$invoice_cols = [
    'signature_url' => "ALTER TABLE system_invoice_settings ADD COLUMN signature_url LONGTEXT DEFAULT NULL AFTER stamp_url",
    'header_image_url' => "ALTER TABLE system_invoice_settings ADD COLUMN header_image_url LONGTEXT DEFAULT NULL AFTER stamp_url",
    'paper_size' => "ALTER TABLE system_invoice_settings ADD COLUMN paper_size VARCHAR(20) DEFAULT 'A4'",
    'margin_top' => "ALTER TABLE system_invoice_settings ADD COLUMN margin_top INT DEFAULT 18",
    'margin_bottom' => "ALTER TABLE system_invoice_settings ADD COLUMN margin_bottom INT DEFAULT 18",
    'margin_left' => "ALTER TABLE system_invoice_settings ADD COLUMN margin_left INT DEFAULT 14",
    'margin_right' => "ALTER TABLE system_invoice_settings ADD COLUMN margin_right INT DEFAULT 14",
    'font_size' => "ALTER TABLE system_invoice_settings ADD COLUMN font_size INT DEFAULT 9"
];

foreach ($invoice_cols as $col => $sql) {
    $res = $connection->query("SHOW COLUMNS FROM system_invoice_settings LIKE '$col'");
    if ($res && $res->num_rows === 0) {
        $connection->query($sql);
        $results['system_invoice_settings'][] = "Added column $col";
    }
}

// 3. Update quotations table valid_until column type & add pdf_created tracking columns
$connection->query("ALTER TABLE quotations MODIFY valid_until VARCHAR(50) DEFAULT '14 Days'");
$results['quotations'][] = "Modified valid_until to VARCHAR(50)";

$quo_cols = [
    'source_file' => "ALTER TABLE quotations ADD COLUMN source_file TEXT DEFAULT NULL AFTER notes",
    'quotation_file' => "ALTER TABLE quotations ADD COLUMN quotation_file TEXT DEFAULT NULL AFTER source_file",
    'pdf_created' => "ALTER TABLE quotations ADD COLUMN pdf_created TINYINT(1) DEFAULT 0",
    'pdf_created_at' => "ALTER TABLE quotations ADD COLUMN pdf_created_at DATETIME DEFAULT NULL"
];

foreach ($quo_cols as $col => $sql) {
    $res = $connection->query("SHOW COLUMNS FROM quotations LIKE '$col'");
    if ($res && $res->num_rows === 0) {
        $connection->query($sql);
        $results['quotations'][] = "Added column $col";
    }
}

// 4. clients table for client companies database (TEXT for multi-email support)
$connection->query("CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) DEFAULT NULL,
    email TEXT DEFAULT NULL,
    phone VARCHAR(100) DEFAULT NULL,
    address_line1 TEXT DEFAULT NULL,
    address_line2 TEXT DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    state VARCHAR(100) DEFAULT NULL,
    postal_code VARCHAR(50) DEFAULT NULL,
    country VARCHAR(100) DEFAULT 'Malaysia',
    tax_id VARCHAR(100) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$connection->query("ALTER TABLE clients MODIFY email TEXT DEFAULT NULL");
$connection->query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS received_by_name VARCHAR(255) NULL");
$connection->query("ALTER TABLE clients ADD COLUMN IF NOT EXISTS received_by_designation VARCHAR(255) NULL");

$connection->query("CREATE TABLE IF NOT EXISTS client_signatories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NULL,
    company_name VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(255) NOT NULL,
    is_default TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (client_id),
    INDEX (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$connection->query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS received_by_name VARCHAR(255) NULL");
$connection->query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS received_by_designation VARCHAR(255) NULL");
$connection->query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS received_by_date VARCHAR(50) NULL");
$results['clients'][] = "Ensured clients table, client_signatories, and invoices received_by columns exist";

ob_end_clean();
echo json_encode([
    'status' => 'success',
    'message' => 'Hosting Database migration completed successfully!',
    'details' => $results
]);
