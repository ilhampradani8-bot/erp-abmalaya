/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.6.23-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: abmalaya_erp
-- ------------------------------------------------------
-- Server version	10.6.23-MariaDB-0ubuntu0.22.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `api_credentials`
--

DROP TABLE IF EXISTS `api_credentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `api_credentials` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `credential_key` varchar(100) NOT NULL,
  `credential_value` text NOT NULL,
  `service_name` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `credential_key` (`credential_key`)
) ENGINE=InnoDB AUTO_INCREMENT=6392 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `client_signatories`
--

DROP TABLE IF EXISTS `client_signatories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `client_signatories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_id` int(11) DEFAULT 0,
  `company_name` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `designation` varchar(255) DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_client_id` (`client_id`),
  KEY `idx_company_name` (`company_name`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `clients`
--

DROP TABLE IF EXISTS `clients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) NOT NULL,
  `client_name` varchar(255) DEFAULT NULL,
  `email` text DEFAULT NULL,
  `phone` varchar(100) DEFAULT NULL,
  `address_line1` text DEFAULT NULL,
  `address_line2` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `postal_code` varchar(50) DEFAULT NULL,
  `country` varchar(100) DEFAULT 'Malaysia',
  `tax_id` varchar(100) DEFAULT NULL,
  `logo_url` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `received_by_name` varchar(255) DEFAULT NULL,
  `received_by_designation` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `company_profile`
--

DROP TABLE IF EXISTS `company_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_profile` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(150) NOT NULL,
  `company_address` text NOT NULL,
  `phone` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `company_logo_url` varchar(255) DEFAULT NULL,
  `company_stamp_url` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_blacklist`
--

DROP TABLE IF EXISTS `email_blacklist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_blacklist` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `company_name` varchar(150) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `created_by` varchar(100) DEFAULT 'Admin',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `gemini_api_keys`
--

DROP TABLE IF EXISTS `gemini_api_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `gemini_api_keys` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key_alias` varchar(100) NOT NULL,
  `api_key` text NOT NULL,
  `pool_type` enum('inbox','ocr') NOT NULL DEFAULT 'inbox',
  `status` enum('active','disabled') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice_items`
--

DROP TABLE IF EXISTS `invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `invoice_id` varchar(50) NOT NULL,
  `product_code` varchar(100) DEFAULT NULL,
  `description` text NOT NULL,
  `specification` text DEFAULT NULL,
  `offer` text DEFAULT NULL,
  `quantity` decimal(12,2) NOT NULL DEFAULT 1.00,
  `unit` varchar(50) DEFAULT 'Unit',
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_percent` decimal(5,2) DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `image_url` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  CONSTRAINT `invoice_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` varchar(50) NOT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `quotation_id` varchar(50) DEFAULT NULL,
  `po_number` varchar(100) DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `client_name` varchar(100) NOT NULL,
  `client_email` varchar(100) NOT NULL,
  `client_phone` varchar(50) DEFAULT NULL,
  `company_name` varchar(100) NOT NULL,
  `billing_address` text DEFAULT NULL,
  `delivery_company` varchar(100) DEFAULT NULL,
  `delivery_address` text DEFAULT NULL,
  `delivery_pic` varchar(100) DEFAULT NULL,
  `delivery_phone` varchar(50) DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_percent` decimal(5,2) NOT NULL DEFAULT 11.00,
  `tax_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `bank_name` varchar(100) DEFAULT 'PUBLIC BANK',
  `bank_account_number` varchar(100) DEFAULT '3818192115',
  `bank_account_name` varchar(255) DEFAULT 'AB MALAYA INDUSTRY',
  `bank_email` varchar(100) DEFAULT 'abmalayaindustry@gmail.com',
  `notes` text DEFAULT NULL,
  `footer_text` text DEFAULT NULL,
  `received_by_name` varchar(255) DEFAULT NULL,
  `received_by_designation` varchar(255) DEFAULT NULL,
  `received_by_date` varchar(50) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'unpaid',
  `invoice_file` text DEFAULT NULL,
  `pdf_created` tinyint(1) DEFAULT 0,
  `pdf_created_at` datetime DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_categories`
--

DROP TABLE IF EXISTS `product_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category_code` varchar(50) NOT NULL,
  `category_name` varchar(255) NOT NULL,
  `internal_category` varchar(255) NOT NULL,
  `subcategories` text NOT NULL,
  `description_en` text NOT NULL,
  `description_my` text NOT NULL,
  `classification_rules` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_code` (`category_code`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_change_logs`
--

DROP TABLE IF EXISTS `product_change_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_change_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `product_code` varchar(100) NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `actor_name` varchar(100) NOT NULL,
  `actor_email` varchar(100) NOT NULL,
  `changes_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_code` varchar(100) NOT NULL,
  `impa_code` varchar(50) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `specification` text DEFAULT NULL,
  `offer` text DEFAULT NULL,
  `unit` varchar(50) DEFAULT 'Unit',
  `unit_price` decimal(15,2) DEFAULT 0.00,
  `capital` decimal(15,2) DEFAULT 0.00,
  `stock_quantity` int(11) DEFAULT 50,
  `discount_percent` decimal(5,2) DEFAULT 0.00,
  `image_url` text DEFAULT NULL,
  `category` varchar(100) DEFAULT 'Equipment',
  `supplier_name` varchar(255) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_code` (`product_code`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quotation_items`
--

DROP TABLE IF EXISTS `quotation_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotation_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quotation_id` varchar(50) NOT NULL,
  `product_code` varchar(100) DEFAULT NULL,
  `category_code` varchar(50) DEFAULT NULL,
  `impa_code` varchar(50) DEFAULT NULL,
  `description` text NOT NULL,
  `specification` text DEFAULT NULL,
  `offer` text DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit` varchar(30) DEFAULT 'Unit',
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_percent` decimal(5,2) DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `quotation_id` (`quotation_id`),
  CONSTRAINT `quotation_items_ibfk_1` FOREIGN KEY (`quotation_id`) REFERENCES `quotations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=445 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quotations`
--

DROP TABLE IF EXISTS `quotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `quotations` (
  `id` varchar(50) NOT NULL,
  `uuid` varchar(64) DEFAULT NULL,
  `quotation_number` varchar(50) NOT NULL,
  `rfq_id` int(11) DEFAULT NULL,
  `client_name` varchar(100) NOT NULL,
  `client_email` text DEFAULT NULL,
  `client_phone` varchar(50) DEFAULT NULL,
  `company_name` varchar(100) NOT NULL,
  `company_address` text DEFAULT NULL,
  `category_name` varchar(100) DEFAULT NULL,
  `impa_code` varchar(20) DEFAULT NULL,
  `date_issued` date NOT NULL,
  `valid_until` varchar(50) DEFAULT '14 Days',
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax_percent` decimal(5,2) NOT NULL DEFAULT 11.00,
  `tax_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `footer_text` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `approval_logs` longtext DEFAULT NULL,
  `ocr_scan_status` varchar(20) DEFAULT 'pending',
  `ocr_scan_result` longtext DEFAULT NULL,
  `approved_by` text DEFAULT NULL,
  `history_log` text DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `source_file` text DEFAULT NULL,
  `quotation_file` text DEFAULT NULL,
  `pdf_created` tinyint(1) DEFAULT 0,
  `pdf_created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quotation_number` (`quotation_number`),
  KEY `rfq_id` (`rfq_id`),
  KEY `idx_quotations_uuid` (`uuid`),
  CONSTRAINT `quotations_ibfk_1` FOREIGN KEY (`rfq_id`) REFERENCES `rfq_requests` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rfq_replies`
--

DROP TABLE IF EXISTS `rfq_replies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `rfq_replies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rfq_id` int(11) DEFAULT NULL,
  `rfq_number` varchar(100) DEFAULT NULL,
  `reply_body` text DEFAULT NULL,
  `reply_sender` varchar(255) DEFAULT NULL,
  `client_email` varchar(255) DEFAULT NULL,
  `quotation_id` varchar(100) DEFAULT NULL,
  `quotation_number` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `attachment_file` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rfq_requests`
--

DROP TABLE IF EXISTS `rfq_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `rfq_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uuid` varchar(64) DEFAULT NULL,
  `email_uid` bigint(20) DEFAULT NULL,
  `message_id` varchar(255) DEFAULT NULL,
  `rfq_number` varchar(50) NOT NULL,
  `client_name` varchar(100) NOT NULL,
  `client_email` varchar(100) NOT NULL,
  `recipient_email` varchar(100) DEFAULT 'abmalayaindustry@gmail.com',
  `client_company` varchar(100) NOT NULL,
  `client_phone` varchar(30) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `message_body` text NOT NULL,
  `item_requested` varchar(255) NOT NULL,
  `quantity_requested` varchar(50) DEFAULT '1 Package',
  `budget_estimate` decimal(15,2) DEFAULT 0.00,
  `attachment_url` varchar(255) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'masuk',
  `ai_verified` tinyint(1) DEFAULT 0,
  `ai_classification` varchar(50) DEFAULT NULL,
  `ai_error` text DEFAULT NULL,
  `is_blacklisted` tinyint(1) DEFAULT 0,
  `blacklist_reason` text DEFAULT NULL,
  `reply_body` longtext DEFAULT NULL,
  `reply_date` datetime DEFAULT NULL,
  `reply_sender` varchar(150) DEFAULT NULL,
  `history_log` longtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `rfq_number` (`rfq_number`),
  KEY `idx_rfq_uuid` (`uuid`),
  KEY `idx_rfq_email_uid` (`email_uid`),
  KEY `idx_rfq_message_id` (`message_id`)
) ENGINE=InnoDB AUTO_INCREMENT=107 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `spreadsheet_backups`
--

DROP TABLE IF EXISTS `spreadsheet_backups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `spreadsheet_backups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `spreadsheet_id` varchar(255) NOT NULL,
  `sheet_name` varchar(100) DEFAULT 'Sheet1',
  `service_account_email` varchar(255) DEFAULT 'erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com',
  `key_filename` varchar(255) DEFAULT 'erp-abmalaya-connect-0fc0c4cb6314.json',
  `is_primary` tinyint(1) DEFAULT 1,
  `is_auto_backup` tinyint(1) DEFAULT 1,
  `backup_interval_minutes` int(11) DEFAULT 60,
  `status` varchar(20) DEFAULT 'active',
  `last_synced_at` datetime DEFAULT NULL,
  `last_backup_at` datetime DEFAULT NULL,
  `last_status` varchar(50) DEFAULT NULL,
  `last_error_message` text DEFAULT NULL,
  `total_rows_backed_up` int(11) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_invoice_settings`
--

DROP TABLE IF EXISTS `system_invoice_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_invoice_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) DEFAULT 'AB MALAYA INDUSTRY',
  `company_reg_no` varchar(100) DEFAULT '003320457-D',
  `company_address` text DEFAULT NULL,
  `phone` varchar(100) DEFAULT '+60 3-8000 1234',
  `email` varchar(100) DEFAULT 'abmalayaindustry@gmail.com',
  `website` varchar(150) DEFAULT 'abmalaya.com',
  `logo_url` longtext DEFAULT NULL,
  `stamp_url` longtext DEFAULT NULL,
  `signature_url` longtext DEFAULT NULL,
  `header_image_url` longtext DEFAULT NULL,
  `invoice_title` varchar(255) DEFAULT 'OFFICIAL INVOICE',
  `bank_name` varchar(100) DEFAULT 'PUBLIC BANK',
  `bank_account_number` varchar(100) DEFAULT '3818192115',
  `bank_account_name` varchar(255) DEFAULT 'AB MALAYA INDUSTRY',
  `bank_email` varchar(100) DEFAULT 'abmalayaindustry@gmail.com',
  `remarks_text` text DEFAULT NULL,
  `footer_text` text DEFAULT NULL,
  `authorised_by_name` varchar(255) DEFAULT 'Muhammad Aimanuddin Bin Mohd Zaki',
  `authorised_by_title` varchar(255) DEFAULT 'Procurement Manager / Head of Sales',
  `received_by_label` varchar(255) DEFAULT 'Received by,',
  `received_by_name_label` varchar(255) DEFAULT 'Name / Designation: ______________________',
  `received_by_date_label` varchar(255) DEFAULT 'Date: ____ / ____ / ________',
  `table_header_bg` varchar(50) DEFAULT '#0070c0',
  `table_header_text_color` varchar(50) DEFAULT '#ffffff',
  `layout_offsets` longtext DEFAULT NULL,
  `paper_size` varchar(50) DEFAULT 'A4',
  `margin_top` int(11) DEFAULT 18,
  `margin_bottom` int(11) DEFAULT 18,
  `margin_left` int(11) DEFAULT 14,
  `margin_right` int(11) DEFAULT 14,
  `font_size` int(11) DEFAULT 9,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_locks`
--

DROP TABLE IF EXISTS `system_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_locks` (
  `lock_key` varchar(50) NOT NULL,
  `lock_value` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`lock_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_notifications`
--

DROP TABLE IF EXISTS `system_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `type` enum('warning','info','success','danger') NOT NULL DEFAULT 'info',
  `category` varchar(50) DEFAULT 'sync',
  `is_read` tinyint(1) DEFAULT 0,
  `action_link` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_paper_settings`
--

DROP TABLE IF EXISTS `system_paper_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_paper_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) DEFAULT 'AB MALAYA SDN. BHD.',
  `company_address` text DEFAULT NULL,
  `phone` varchar(100) DEFAULT '+60 3-8000 1234',
  `email` varchar(100) DEFAULT 'sales@abmalaya.com',
  `logo_url` longtext DEFAULT NULL,
  `stamp_url` longtext DEFAULT NULL,
  `signature_url` longtext DEFAULT NULL,
  `header_image_url` longtext DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT 'PUBLIC BANK',
  `bank_account_number` varchar(100) DEFAULT '3818192115',
  `bank_account_name` varchar(255) DEFAULT 'AB MALAYA INDUSTRY',
  `bank_email` varchar(100) DEFAULT 'abmalayaindustry@gmail.com',
  `header_title` varchar(255) DEFAULT 'SURAT PENAWARAN HARGA (SPH) / QUOTATION',
  `footer_terms` text DEFAULT NULL,
  `footer_text` text DEFAULT NULL,
  `header_color` varchar(50) DEFAULT '#0080d0',
  `default_notes` text DEFAULT NULL,
  `header_template` varchar(50) DEFAULT 'default',
  `table_header_bg` varchar(50) DEFAULT '#0f172a',
  `table_header_text_color` varchar(50) DEFAULT '#ffffff',
  `layout_offsets` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `paper_size` varchar(50) DEFAULT 'A4',
  `margin_top` int(11) DEFAULT 18,
  `margin_bottom` int(11) DEFAULT 18,
  `margin_left` int(11) DEFAULT 14,
  `margin_right` int(11) DEFAULT 14,
  `font_size` int(11) DEFAULT 9,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_activity_logs`
--

DROP TABLE IF EXISTS `user_activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_name` varchar(100) NOT NULL,
  `user_email` varchar(100) NOT NULL,
  `action_type` varchar(50) NOT NULL DEFAULT 'LOGIN',
  `details` text DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(128) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'Admin',
  `device_info` text DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `token_2` (`token`),
  KEY `expires_at` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('Admin','Sales Engineer','Manager','Finance') NOT NULL DEFAULT 'Sales Engineer',
  `department` varchar(50) DEFAULT 'Sales',
  `status` enum('Active','Inactive','Suspended') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-22 19:45:36
