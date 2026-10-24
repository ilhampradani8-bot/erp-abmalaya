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

-- 4. Pastikan flag AI_SYSTEM_ENABLED tersinkronisasi aktif jika ada kunci di gemini_api_keys
UPDATE `api_credentials` 
SET `credential_value` = 'true' 
WHERE `credential_key` = 'AI_SYSTEM_ENABLED';

-- Aktifkan kunci resmi Gemini berawalan AIzaSy jika ada
UPDATE `gemini_api_keys` 
SET `status` = 'active' 
WHERE `api_key` LIKE 'AIzaSy%' AND `status` = 'disabled';

-- 5. Tambah kolom uuid, email_uid, message_id ke rfq_requests jika belum ada
SET @col_rfq_uuid := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rfq_requests' AND COLUMN_NAME = 'uuid');
SET @sql_rfq_uuid := IF(@col_rfq_uuid = 0, 'ALTER TABLE `rfq_requests` ADD COLUMN `uuid` VARCHAR(64) DEFAULT NULL AFTER `id`, ADD KEY `idx_rfq_uuid` (`uuid`)', 'SELECT "Column rfq_requests.uuid already exists" AS status');
PREPARE stmt_rfq_uuid FROM @sql_rfq_uuid; EXECUTE stmt_rfq_uuid; DEALLOCATE PREPARE stmt_rfq_uuid;

SET @col_rfq_euid := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rfq_requests' AND COLUMN_NAME = 'email_uid');
SET @sql_rfq_euid := IF(@col_rfq_euid = 0, 'ALTER TABLE `rfq_requests` ADD COLUMN `email_uid` BIGINT DEFAULT NULL AFTER `uuid`, ADD KEY `idx_rfq_email_uid` (`email_uid`)', 'SELECT "Column rfq_requests.email_uid already exists" AS status');
PREPARE stmt_rfq_euid FROM @sql_rfq_euid; EXECUTE stmt_rfq_euid; DEALLOCATE PREPARE stmt_rfq_euid;

SET @col_rfq_msgid := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rfq_requests' AND COLUMN_NAME = 'message_id');
SET @sql_rfq_msgid := IF(@col_rfq_msgid = 0, 'ALTER TABLE `rfq_requests` ADD COLUMN `message_id` VARCHAR(255) DEFAULT NULL AFTER `email_uid`, ADD KEY `idx_rfq_message_id` (`message_id`)', 'SELECT "Column rfq_requests.message_id already exists" AS status');
PREPARE stmt_rfq_msgid FROM @sql_rfq_msgid; EXECUTE stmt_rfq_msgid; DEALLOCATE PREPARE stmt_rfq_msgid;

-- 6. Tambah kolom uuid ke quotations jika belum ada
SET @col_quo_uuid := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME = 'uuid');
SET @sql_quo_uuid := IF(@col_quo_uuid = 0, 'ALTER TABLE `quotations` ADD COLUMN `uuid` VARCHAR(64) DEFAULT NULL AFTER `id`, ADD KEY `idx_quotations_uuid` (`uuid`)', 'SELECT "Column quotations.uuid already exists" AS status');
PREPARE stmt_quo_uuid FROM @sql_quo_uuid; EXECUTE stmt_quo_uuid; DEALLOCATE PREPARE stmt_quo_uuid;

-- 7. Tambah kolom is_auto_backup dan backup_interval_minutes ke spreadsheet_backups jika belum ada
SET @col_ss_auto := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'spreadsheet_backups' AND COLUMN_NAME = 'is_auto_backup');
SET @sql_ss_auto := IF(@col_ss_auto = 0, 'ALTER TABLE `spreadsheet_backups` ADD COLUMN `is_auto_backup` TINYINT(1) DEFAULT 1 AFTER `is_active`', 'SELECT "Column spreadsheet_backups.is_auto_backup already exists" AS status');
PREPARE stmt_ss_auto FROM @sql_ss_auto; EXECUTE stmt_ss_auto; DEALLOCATE PREPARE stmt_ss_auto;

SET @col_ss_interval := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'spreadsheet_backups' AND COLUMN_NAME = 'backup_interval_minutes');
SET @sql_ss_interval := IF(@col_ss_interval = 0, 'ALTER TABLE `spreadsheet_backups` ADD COLUMN `backup_interval_minutes` INT DEFAULT 60 AFTER `is_auto_backup`', 'SELECT "Column spreadsheet_backups.backup_interval_minutes already exists" AS status');
PREPARE stmt_ss_interval FROM @sql_ss_interval; EXECUTE stmt_ss_interval; DEALLOCATE PREPARE stmt_ss_interval;

-- 8. Standarisasi DOC_HEADER_TITLE ke COMMERCIAL QUOTATION (QUO)
UPDATE `api_credentials`
SET `credential_value` = 'COMMERCIAL QUOTATION (QUO)'
WHERE `credential_key` = 'DOC_HEADER_TITLE';

-- 9. Tambah kolom logo_url ke clients jika belum ada
SET @col_clients_logo := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'logo_url');
SET @sql_clients_logo := IF(@col_clients_logo = 0, 'ALTER TABLE `clients` ADD COLUMN `logo_url` TEXT DEFAULT NULL AFTER `tax_id`', 'SELECT "Column clients.logo_url already exists" AS status');
PREPARE stmt_clients_logo FROM @sql_clients_logo; EXECUTE stmt_clients_logo; DEALLOCATE PREPARE stmt_clients_logo;

-- 10. Tambah kolom received_by_name dan received_by_designation ke clients jika belum ada
SET @col_clients_rcv := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'received_by_name');
SET @sql_clients_rcv := IF(@col_clients_rcv = 0, 'ALTER TABLE `clients` ADD COLUMN `received_by_name` VARCHAR(255) DEFAULT NULL AFTER `notes`, ADD COLUMN `received_by_designation` VARCHAR(255) DEFAULT NULL AFTER `received_by_name`', 'SELECT "Columns received_by already exist" AS status');
PREPARE stmt_clients_rcv FROM @sql_clients_rcv; EXECUTE stmt_clients_rcv; DEALLOCATE PREPARE stmt_clients_rcv;

-- 11. Pastikan tabel client_signatories tersedia
CREATE TABLE IF NOT EXISTS `client_signatories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `client_id` INT DEFAULT 0,
  `company_name` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `designation` VARCHAR(255) DEFAULT NULL,
  `is_default` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_client_id` (`client_id`),
  KEY `idx_company_name` (`company_name`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

