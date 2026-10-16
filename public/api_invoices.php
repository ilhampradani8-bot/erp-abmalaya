<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    require_once __DIR__ . '/db_connect.php';
    $conn = isset($db_conn) ? $db_conn : $conn;

    // 1. Auto-create dedicated `invoices` table
    $conn->query("CREATE TABLE IF NOT EXISTS `invoices` (
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
        `footer_text` TEXT DEFAULT NULL,
        `received_by_name` VARCHAR(255) DEFAULT NULL,
        `received_by_designation` VARCHAR(255) DEFAULT NULL,
        `received_by_date` VARCHAR(50) DEFAULT NULL,
        `status` VARCHAR(50) NOT NULL DEFAULT 'unpaid',
        `invoice_file` TEXT DEFAULT NULL,
        `pdf_created` TINYINT(1) DEFAULT 0,
        `pdf_created_at` DATETIME DEFAULT NULL,
        `created_by` VARCHAR(100) DEFAULT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2. Auto-create dedicated `invoice_items` table
    $conn->query("CREATE TABLE IF NOT EXISTS `invoice_items` (
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

    $chk_inv_ftr = $conn->query("SHOW COLUMNS FROM invoices LIKE 'footer_text'");
    if ($chk_inv_ftr && $chk_inv_ftr->num_rows === 0) {
        $conn->query("ALTER TABLE invoices ADD COLUMN footer_text TEXT DEFAULT NULL AFTER notes");
    }

    $method = $_SERVER['REQUEST_METHOD'];

    // DELETE Action
    if ($method === 'DELETE' || (isset($_GET['action']) && $_GET['action'] === 'delete')) {
        $id = $_GET['id'] ?? '';
        if (empty($id)) {
            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true);
            $id = $input['id'] ?? '';
        }

        if (!empty($id)) {
            $stmt = $conn->prepare("DELETE FROM invoices WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("s", $id);
                $stmt->execute();
                $stmt->close();
            }
        }

        ob_end_clean();
        echo json_encode(['status' => 'success', 'message' => 'Invoice deleted successfully']);
        exit;
    }

    // GET Action: List or Single Invoice
    if ($method === 'GET') {
        $id = $_GET['id'] ?? '';
        if (!empty($id)) {
            $stmt = $conn->prepare("SELECT * FROM invoices WHERE id = ? OR invoice_number = ? LIMIT 1");
            $stmt->bind_param("ss", $id, $id);
            $stmt->execute();
            $res = $stmt->get_result();
            $inv = $res->fetch_assoc();
            $stmt->close();

            if ($inv) {
                $items = [];
                $stmt_item = $conn->prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC");
                $stmt_item->bind_param("s", $inv['id']);
                $stmt_item->execute();
                $res_items = $stmt_item->get_result();
                while ($row_item = $res_items->fetch_assoc()) {
                    $items[] = $row_item;
                }
                $stmt_item->close();
                $inv['items'] = $items;
            }

            ob_end_clean();
            echo json_encode(['status' => 'success', 'data' => $inv]);
            exit;
        } else {
            $res = $conn->query("SELECT * FROM invoices ORDER BY created_at DESC");
            $list = [];
            while ($row = $res->fetch_assoc()) {
                $items = [];
                $stmt_item = $conn->prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC");
                $stmt_item->bind_param("s", $row['id']);
                $stmt_item->execute();
                $res_items = $stmt_item->get_result();
                while ($row_item = $res_items->fetch_assoc()) {
                    $items[] = $row_item;
                }
                $stmt_item->close();
                $row['items'] = $items;
                $list[] = $row;
            }

            ob_end_clean();
            echo json_encode(['status' => 'success', 'data' => $list]);
            exit;
        }
    }

    // POST Action: Save / Create / Update Invoice
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        if (!$data) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'Invalid JSON payload']);
            exit;
        }

        $id = trim($data['id'] ?? '');
        if (empty($id)) {
            $id = 'INV-' . time() . '-' . rand(1000, 9999);
        }

        $inv_num = trim($data['invoice_number'] ?? '');
        if (empty($inv_num)) {
            $inv_num = 'ABM/INV/' . date('Ymd') . '/' . rand(100, 999);
        }

        $quo_id = trim($data['quotation_id'] ?? '');
        $po_num = trim($data['po_number'] ?? '');
        $inv_date = trim($data['invoice_date'] ?? date('Y-m-d'));
        $due_date = trim($data['due_date'] ?? date('Y-m-d', strtotime('+14 days')));
        $client_name = trim($data['client_name'] ?? '');
        $client_email = trim($data['client_email'] ?? '');
        $client_phone = trim($data['client_phone'] ?? '');
        $comp_name = trim($data['company_name'] ?? '');
        $bill_addr = trim($data['billing_address'] ?? '');
        $del_comp = trim($data['delivery_company'] ?? '');
        $del_addr = trim($data['delivery_address'] ?? '');
        $del_pic = trim($data['delivery_pic'] ?? '');
        $del_phone = trim($data['delivery_phone'] ?? '');
        $subtotal = floatval($data['subtotal'] ?? 0);
        $disc_total = floatval($data['discount_total'] ?? 0);
        $tax_pct = floatval($data['tax_percent'] ?? 11);
        $tax_amt = floatval($data['tax_amount'] ?? 0);
        $grand_total = floatval($data['grand_total'] ?? 0);
        $bank_name = trim($data['bank_name'] ?? 'PUBLIC BANK');
        $bank_acc = trim($data['bank_account_number'] ?? '3818192115');
        $bank_holder = trim($data['bank_account_name'] ?? 'AB MALAYA INDUSTRY');
        $bank_email = trim($data['bank_email'] ?? 'abmalayaindustry@gmail.com');
        $notes = trim($data['notes'] ?? '');
        $footer_text = trim($data['footer_text'] ?? '');
        $received_by_name = isset($data['received_by_name']) ? trim($data['received_by_name']) : null;
        $received_by_designation = isset($data['received_by_designation']) ? trim($data['received_by_designation']) : null;
        $received_by_date = isset($data['received_by_date']) ? trim($data['received_by_date']) : null;
        $status = trim($data['status'] ?? 'unpaid');
        $created_by = trim($data['created_by'] ?? 'Admin');

        // Check if invoice exists
        $chk = $conn->prepare("SELECT id FROM invoices WHERE id = ?");
        $chk->bind_param("s", $id);
        $chk->execute();
        $exists = $chk->get_result()->num_rows > 0;
        $chk->close();

        if ($exists) {
            $stmt = $conn->prepare("UPDATE invoices SET 
                invoice_number = ?, quotation_id = ?, po_number = ?, invoice_date = ?, due_date = ?, 
                client_name = ?, client_email = ?, client_phone = ?, company_name = ?, billing_address = ?, 
                delivery_company = ?, delivery_address = ?, delivery_pic = ?, delivery_phone = ?, 
                subtotal = ?, discount_total = ?, tax_percent = ?, tax_amount = ?, grand_total = ?, 
                bank_name = ?, bank_account_number = ?, bank_account_name = ?, bank_email = ?, 
                notes = ?, footer_text = ?, received_by_name = ?, received_by_designation = ?, received_by_date = ?, status = ?, created_by = ? WHERE id = ?");

            $stmt->bind_param("ssssssssssssssddddsssssssssssss", 
                $inv_num, $quo_id, $po_num, $inv_date, $due_date, 
                $client_name, $client_email, $client_phone, $comp_name, $bill_addr, 
                $del_comp, $del_addr, $del_pic, $del_phone, 
                $subtotal, $disc_total, $tax_pct, $tax_amt, $grand_total, 
                $bank_name, $bank_acc, $bank_holder, $bank_email, 
                $notes, $footer_text, $received_by_name, $received_by_designation, $received_by_date, $status, $created_by, $id);
            $stmt->execute();
            $stmt->close();
        } else {
            $stmt = $conn->prepare("INSERT INTO invoices (
                id, invoice_number, quotation_id, po_number, invoice_date, due_date, 
                client_name, client_email, client_phone, company_name, billing_address, 
                delivery_company, delivery_address, delivery_pic, delivery_phone, 
                subtotal, discount_total, tax_percent, tax_amount, grand_total, 
                bank_name, bank_account_number, bank_account_name, bank_email, 
                notes, footer_text, received_by_name, received_by_designation, received_by_date, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $stmt->bind_param("ssssssssssssssssddddsssssssssss", 
                $id, $inv_num, $quo_id, $po_num, $inv_date, $due_date, 
                $client_name, $client_email, $client_phone, $comp_name, $bill_addr, 
                $del_comp, $del_addr, $del_pic, $del_phone, 
                $subtotal, $disc_total, $tax_pct, $tax_amt, $grand_total, 
                $bank_name, $bank_acc, $bank_holder, $bank_email, 
                $notes, $footer_text, $received_by_name, $received_by_designation, $received_by_date, $status, $created_by);
            $stmt->execute();
            $stmt->close();
        }

        // Re-insert line items
        $conn->query("DELETE FROM invoice_items WHERE invoice_id = '" . $conn->real_escape_string($id) . "'");
        $items = $data['items'] ?? [];
        if (is_array($items) && count($items) > 0) {
            $stmt_item = $conn->prepare("INSERT INTO invoice_items (
                invoice_id, product_code, description, specification, offer, quantity, unit, unit_price, discount_percent, total, image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            foreach ($items as $item) {
                $p_code = trim($item['product_code'] ?? '');
                $desc = trim($item['description'] ?? 'Item Description');
                $spec = trim($item['specification'] ?? '');
                $offer = trim($item['offer'] ?? $item['offered_item'] ?? '');
                $qty = floatval($item['quantity'] ?? $item['qty'] ?? 1);
                $unit = trim($item['unit'] ?? 'Unit');
                $price = floatval($item['unit_price'] ?? 0);
                $disc = floatval($item['discount_percent'] ?? 0);
                $tot = floatval($item['total'] ?? ($qty * $price * (1 - $disc / 100)));
                $img = trim($item['image_url'] ?? '');

                $stmt_item->bind_param("sssssdsddds", $id, $p_code, $desc, $spec, $offer, $qty, $unit, $price, $disc, $tot, $img);
                $stmt_item->execute();
            }
            $stmt_item->close();
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Invoice saved successfully!',
            'invoice_id' => $id,
            'invoice_number' => $inv_num
        ]);
        exit;
    }

} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
