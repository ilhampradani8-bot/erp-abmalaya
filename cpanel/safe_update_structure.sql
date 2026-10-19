-- ==============================================================================
-- AB MALAYA ERP — SAFE PRODUCTION DATABASE MIGRATION (NON-DESTRUCTIVE)
-- Menambah kolom/tabel baru TANPA MENGHAPUS / MERESET data yang sudah ada di MySQL
-- ==============================================================================

-- 1. Pastikan tabel rfq_replies tersedia untuk riwayat percakapan thread
CREATE TABLE IF NOT EXISTS `rfq_replies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rfq_id` INT DEFAULT NULL,
    `rfq_number` VARCHAR(100) DEFAULT NULL,
    `reply_body` TEXT DEFAULT NULL,
    `reply_sender` VARCHAR(255) DEFAULT NULL,
    `client_email` VARCHAR(255) DEFAULT NULL,
    `quotation_id` VARCHAR(100) DEFAULT NULL,
    `quotation_number` VARCHAR(100) DEFAULT NULL,
    `attachment_file` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tambah kolom attachment_file jika rfq_replies sudah ada sebelumnya
SET @col_exist := (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'rfq_replies' 
      AND COLUMN_NAME = 'attachment_file'
);

SET @sql_attach := IF(
    @col_exist = 0, 
    'ALTER TABLE `rfq_replies` ADD COLUMN `attachment_file` VARCHAR(255) DEFAULT NULL AFTER `quotation_number`', 
    'SELECT "Column attachment_file already exists" AS status'
);

PREPARE stmt_attach FROM @sql_attach;
EXECUTE stmt_attach;
DEALLOCATE PREPARE stmt_attach;

-- 3. Pastikan kolom approval_logs dan status di quotations tidak terganggu
SET @quo_col_exist := (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'quotations' 
      AND COLUMN_NAME = 'approval_logs'
);

SET @sql_quo := IF(
    @quo_col_exist = 0, 
    'ALTER TABLE `quotations` ADD COLUMN `approval_logs` LONGTEXT DEFAULT NULL AFTER `status`', 
    'SELECT "Column approval_logs already exists" AS status'
);

PREPARE stmt_quo FROM @sql_quo;
EXECUTE stmt_quo;
DEALLOCATE PREPARE stmt_quo;
