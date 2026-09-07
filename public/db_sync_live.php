<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/db_connect.php';

    if (!isset($db_conn) || !$db_conn) {
        throw new Exception("Database connection failed via db_connect.php");
    }

    $log = [];

    // 1. Ensure `products` table has all columns
    $db_conn->query("CREATE TABLE IF NOT EXISTS `products` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `product_code` VARCHAR(100) UNIQUE NOT NULL,
        `product_name` VARCHAR(255) NOT NULL,
        `description` TEXT,
        `specification` TEXT,
        `unit` VARCHAR(50) DEFAULT 'Unit',
        `unit_price` DECIMAL(15,2) DEFAULT 0.00,
        `stock_quantity` INT DEFAULT 50,
        `discount_percent` DECIMAL(5,2) DEFAULT 0.00,
        `image_url` TEXT,
        `category` VARCHAR(100) DEFAULT 'Equipment',
        `supplier_name` VARCHAR(255) DEFAULT NULL,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $log[] = "Verified/Created `products` table schema.";

    // Add supplier_name if missing
    $chk_sup = $db_conn->query("SHOW COLUMNS FROM `products` LIKE 'supplier_name'");
    if ($chk_sup && $chk_sup->num_rows === 0) {
        $db_conn->query("ALTER TABLE `products` ADD COLUMN `supplier_name` VARCHAR(255) DEFAULT NULL AFTER `category`");
        $log[] = "Added column `supplier_name` to `products` table.";
    }

    // Add specification if missing
    $chk_spec = $db_conn->query("SHOW COLUMNS FROM `products` LIKE 'specification'");
    if ($chk_spec && $chk_spec->num_rows === 0) {
        $db_conn->query("ALTER TABLE `products` ADD COLUMN `specification` TEXT DEFAULT NULL AFTER `description`");
        $log[] = "Added column `specification` to `products` table.";
    }

    // 2. Ensure `quotation_items` table has category_code and impa_code
    $db_conn->query("CREATE TABLE IF NOT EXISTS `quotation_items` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `quotation_id` VARCHAR(50) NOT NULL,
        `product_code` VARCHAR(100) DEFAULT NULL,
        `category_code` VARCHAR(50) DEFAULT NULL,
        `impa_code` VARCHAR(50) DEFAULT NULL,
        `description` TEXT NOT NULL,
        `specification` TEXT DEFAULT NULL,
        `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1.00,
        `unit` VARCHAR(50) DEFAULT 'Unit',
        `unit_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        `discount_percent` DECIMAL(5,2) DEFAULT 0.00,
        `total` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $chk_cc = $db_conn->query("SHOW COLUMNS FROM `quotation_items` LIKE 'category_code'");
    if ($chk_cc && $chk_cc->num_rows === 0) {
        $db_conn->query("ALTER TABLE `quotation_items` ADD COLUMN `category_code` VARCHAR(50) DEFAULT NULL AFTER `product_code`");
        $log[] = "Added column `category_code` to `quotation_items`.";
    }

    $chk_ic = $db_conn->query("SHOW COLUMNS FROM `quotation_items` LIKE 'impa_code'");
    if ($chk_ic && $chk_ic->num_rows === 0) {
        $db_conn->query("ALTER TABLE `quotation_items` ADD COLUMN `impa_code` VARCHAR(50) DEFAULT NULL AFTER `category_code`");
        $log[] = "Added column `impa_code` to `quotation_items`.";
    }

    $chk_off = $db_conn->query("SHOW COLUMNS FROM `quotation_items` LIKE 'offer'");
    if ($chk_off && $chk_off->num_rows === 0) {
        $db_conn->query("ALTER TABLE `quotation_items` ADD COLUMN `offer` TEXT DEFAULT NULL AFTER `specification`");
        $log[] = "Added column `offer` to `quotation_items`.";
    }


    // 3. Ensure `quotations` table has impa_code
    $chk_qic = $db_conn->query("SHOW COLUMNS FROM `quotations` LIKE 'impa_code'");
    if ($chk_qic && $chk_qic->num_rows === 0) {
        $db_conn->query("ALTER TABLE `quotations` ADD COLUMN `impa_code` VARCHAR(50) DEFAULT NULL AFTER `category_name`");
        $log[] = "Added column `impa_code` to `quotations`.";
    }

    // 4. Ensure `rfq_requests` has ai_verified, ai_classification, ai_error
    $chk_aiv = $db_conn->query("SHOW COLUMNS FROM `rfq_requests` LIKE 'ai_verified'");
    if ($chk_aiv && $chk_aiv->num_rows === 0) {
        $db_conn->query("ALTER TABLE `rfq_requests` ADD COLUMN `ai_verified` TINYINT(1) DEFAULT 0 AFTER `status`");
        $log[] = "Added column `ai_verified` to `rfq_requests`.";
    }

    $chk_aic = $db_conn->query("SHOW COLUMNS FROM `rfq_requests` LIKE 'ai_classification'");
    if ($chk_aic && $chk_aic->num_rows === 0) {
        $db_conn->query("ALTER TABLE `rfq_requests` ADD COLUMN `ai_classification` VARCHAR(50) DEFAULT NULL AFTER `ai_verified`");
        $log[] = "Added column `ai_classification` to `rfq_requests`.";
    }

    $chk_aie = $db_conn->query("SHOW COLUMNS FROM `rfq_requests` LIKE 'ai_error'");
    if ($chk_aie && $chk_aie->num_rows === 0) {
        $db_conn->query("ALTER TABLE `rfq_requests` ADD COLUMN `ai_error` TEXT DEFAULT NULL AFTER `ai_classification`");
        $log[] = "Added column `ai_error` to `rfq_requests`.";
    }

    // 5. Trigger import_products.php locally on live server
    ob_start();
    require __DIR__ . '/import_products.php';
    $import_output = ob_get_clean();
    $log[] = "Product & Category Sheet Import executed successfully.";

    // 6. Ensure system_paper_settings table exists & has header_image_url column
    $db_conn->query("CREATE TABLE IF NOT EXISTS system_paper_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(255) DEFAULT 'AB MALAYA SDN. BHD.',
        company_address TEXT,
        phone VARCHAR(100) DEFAULT '+60 3-8000 1234',
        email VARCHAR(100) DEFAULT 'sales@abmalaya.com',
        logo_url LONGTEXT,
        stamp_url LONGTEXT,
        header_image_url LONGTEXT DEFAULT NULL,
        header_title VARCHAR(255) DEFAULT 'SURAT PENAWARAN HARGA (SPH) / QUOTATION',
        footer_terms TEXT,
        header_color VARCHAR(50) DEFAULT '#0080d0',
        default_notes TEXT,
        header_template VARCHAR(50) DEFAULT 'default',
        table_header_bg VARCHAR(50) DEFAULT '#0f172a',
        table_header_text_color VARCHAR(50) DEFAULT '#ffffff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $chk_hi = $db_conn->query("SHOW COLUMNS FROM system_paper_settings LIKE 'header_image_url'");
    if ($chk_hi && $chk_hi->num_rows === 0) {
        $db_conn->query("ALTER TABLE system_paper_settings ADD COLUMN header_image_url LONGTEXT DEFAULT NULL AFTER stamp_url");
        $log[] = "Added column `header_image_url` to `system_paper_settings`.";
    }

    $db_conn->query("UPDATE system_paper_settings SET company_address = '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.' WHERE id = 1 AND (company_address LIKE '%No. 12%' OR company_address IS NULL OR company_address = '')");
    $log[] = "Verified & synced `system_paper_settings` table.";

    // 7. Optional: Full Database Backup SQL Import (cpanel/database_backup_full.sql)
    if (isset($_GET['import_sql']) && $_GET['import_sql'] === '1') {
        $sql_file = __DIR__ . '/cpanel/database_backup_full.sql';
        if (!file_exists($sql_file)) {
            $sql_file = __DIR__ . '/../cpanel/database_backup_full.sql';
        }
        if (file_exists($sql_file)) {
            $sql_content = file_get_contents($sql_file);
            if (!empty($sql_content)) {
                $db_conn->multi_query($sql_content);
                while ($db_conn->more_results() && $db_conn->next_result()) {
                    // flush multi_query results
                }
                $log[] = "Full database dump (cpanel/database_backup_full.sql) imported into live MySQL database.";
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Remote Database Schema & Google Sheet Products Migration Finished!',
        'details' => $log,
        'import_result' => json_decode($import_output, true) ?? $import_output
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
