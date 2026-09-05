-- ABMALAYA ERP Database Schema (cPanel & Local Production)
-- Database Target: abmalaya_erp

CREATE DATABASE IF NOT EXISTS `abmalaya_erp` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `abmalaya_erp`;

-- 1. Table: users (Account & System Access)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('Admin', 'Sales Engineer', 'Manager', 'Finance') NOT NULL DEFAULT 'Sales Engineer',
  `department` VARCHAR(50) DEFAULT 'Sales',
  `status` ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Table: rfq_requests (Incoming Live RFQs & Customer Inquiries)
CREATE TABLE IF NOT EXISTS `rfq_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rfq_number` VARCHAR(50) NOT NULL UNIQUE,
  `client_name` VARCHAR(100) NOT NULL,
  `client_email` VARCHAR(100) NOT NULL,
  `recipient_email` VARCHAR(100) DEFAULT 'abmalayaindustry@gmail.com',
  `client_company` VARCHAR(100) NOT NULL,
  `client_phone` VARCHAR(30) DEFAULT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `message_body` TEXT NOT NULL,
  `item_requested` VARCHAR(255) NOT NULL,
  `quantity_requested` VARCHAR(50) DEFAULT '1 Package',
  `budget_estimate` DECIMAL(15, 2) DEFAULT 0.00,
  `attachment_url` VARCHAR(255) DEFAULT NULL,
  `status` ENUM('masuk', 'diproses', 'penawaran_terkirim', 'deal', 'batal') NOT NULL DEFAULT 'masuk',
  `ai_verified` TINYINT(1) DEFAULT 0,
  `ai_classification` VARCHAR(50) DEFAULT NULL,
  `ai_error` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Table: quotations (Surat Penawaran Harga / SPH Output)
CREATE TABLE IF NOT EXISTS `quotations` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `quotation_number` VARCHAR(50) NOT NULL UNIQUE,
  `rfq_id` INT DEFAULT NULL,
  `client_name` VARCHAR(100) NOT NULL,
  `client_email` VARCHAR(100) NOT NULL,
  `client_phone` VARCHAR(50) DEFAULT NULL,
  `company_name` VARCHAR(100) NOT NULL,
  `date_issued` DATE NOT NULL,
  `valid_until` DATE NOT NULL,
  `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `tax_percent` DECIMAL(5, 2) NOT NULL DEFAULT 11.00,
  `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
  `ocr_scan_status` VARCHAR(20) DEFAULT 'pending',
  `ocr_scan_result` LONGTEXT DEFAULT NULL,
  `approved_by` TEXT DEFAULT NULL,
  `history_log` TEXT DEFAULT NULL,
  `created_by` VARCHAR(50) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`rfq_id`) REFERENCES `rfq_requests`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Table: quotation_items (Line Items Detail for SPH)
CREATE TABLE IF NOT EXISTS `quotation_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quotation_id` VARCHAR(50) NOT NULL,
  `product_code` VARCHAR(100) DEFAULT NULL,
  `category_code` VARCHAR(50) DEFAULT NULL,
  `impa_code` VARCHAR(50) DEFAULT NULL,
  `description` TEXT NOT NULL,
  `specification` TEXT DEFAULT NULL,
  `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  `unit` VARCHAR(30) DEFAULT 'Unit',
  `unit_price` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `discount_percent` DECIMAL(5, 2) DEFAULT 0.00,
  `total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. Table: company_profile (Company Branding, Logo & Official Stamp)
CREATE TABLE IF NOT EXISTS `company_profile` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_name` VARCHAR(150) NOT NULL,
  `company_address` TEXT NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `company_logo_url` VARCHAR(255) DEFAULT NULL,
  `company_stamp_url` VARCHAR(255) DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Table: api_credentials (API Keys, Tokens & System Service Passwords)
CREATE TABLE IF NOT EXISTS `api_credentials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `credential_key` VARCHAR(100) UNIQUE NOT NULL,
  `credential_value` TEXT NOT NULL,
  `service_name` VARCHAR(100) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Table: products (Master Product Catalog & Pricing Database)
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_code` VARCHAR(100) UNIQUE NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `specification` TEXT,
  `offer` TEXT DEFAULT NULL,
  `unit` VARCHAR(50) DEFAULT 'Unit',
  `unit_price` DECIMAL(15,2) DEFAULT 0.00,
  `capital` DECIMAL(15,2) DEFAULT 0.00,
  `image_url` TEXT,
  `category` VARCHAR(100) DEFAULT 'Equipment',
  `supplier_name` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(20) DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 8. Table: system_notifications (Notification Log & Sync Activity History)
CREATE TABLE IF NOT EXISTS `system_notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('warning', 'info', 'success', 'danger') NOT NULL DEFAULT 'info',
  `category` VARCHAR(50) DEFAULT 'sync',
  `is_read` TINYINT(1) DEFAULT 0,
  `action_link` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Table: spreadsheet_backups (Multi-Spreadsheet Cloud Backup Target Configuration)
CREATE TABLE IF NOT EXISTS `spreadsheet_backups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `spreadsheet_id` VARCHAR(255) NOT NULL,
  `sheet_name` VARCHAR(100) DEFAULT 'Sheet1',
  `service_account_email` VARCHAR(255) DEFAULT 'erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com',
  `key_filename` VARCHAR(255) DEFAULT 'erp-abmalaya-connect-0fc0c4cb6314.json',
  `is_primary` TINYINT(1) DEFAULT 1,
  `status` VARCHAR(20) DEFAULT 'active',
  `last_synced_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial Seed Data
INSERT IGNORE INTO `users` (`id`, `name`, `email`, `password`, `role`, `department`, `status`) VALUES
('USR-001', 'Ilham Pradani, S.T.', 'ilham@abmalaya.com', '$2y$10$e8w3.U1u...demo_password_hash', 'Admin', 'Sales', 'Active'),
('USR-002', 'Sales Executive', 'sales@abmalaya.com', '$2y$10$e8w3.U1u...demo_password_hash', 'Sales Engineer', 'Sales', 'Active');

INSERT IGNORE INTO `company_profile` (`id`, `company_name`, `company_address`, `phone`, `email`, `company_logo_url`, `company_stamp_url`) VALUES
(1, 'PT ABMALAYA NUSA SEJAHTERA (MALAYSIA)', 'Kuala Lumpur Tech Park, Block B-12, Wilayah Persekutuan Kuala Lumpur', '+60 3-8900 4455', 'sales@abmalaya.com', 'https://via.placeholder.com/160x60?text=ABMALAYA+LOGO', 'https://via.placeholder.com/120x120?text=STAMP+SEAL');

INSERT INTO `api_credentials` (`credential_key`, `credential_value`, `service_name`) VALUES
('GEMINI_API_KEY', 'AIzaSyAmuYOX2WFAiT0sACEq8LUqqSx4qJf0DWU', 'Google Gemini AI')
ON DUPLICATE KEY UPDATE `credential_value` = VALUES(`credential_value`);

INSERT IGNORE INTO `products` (`product_code`, `product_name`, `description`, `unit`, `unit_price`, `image_url`, `category`) VALUES
('PRD-001', 'RO WATER MAKER HIGH PRESSURE HOSE - Ref: PD-ENG-2026-059', 'High Pressure Flexible Rubber Hose with SS316 Fitting Ends. Operating Pressure: 350 BAR.', 'Package', 45000000.00, 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&q=80', 'Hose & Fitting'),
('PRD-002', 'SS316 STAINLESS STEEL FITTING ENDS 2 INCH', 'Marine Grade Stainless Steel 316 Fitting Ends for High Pressure Hose 350 BAR', 'Pcs', 7500000.00, 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=300&q=80', 'Fitting'),
('PRD-003', 'HEAVY DUTY INDUSTRIAL WATER MAKER MEMBRANE', 'Reverse Osmosis Desalination Membrane Element 8040 High Rejection', 'Unit', 65000000.00, 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80', 'Membrane');
