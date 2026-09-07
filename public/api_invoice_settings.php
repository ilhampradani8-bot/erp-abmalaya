<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';
$connection = isset($conn) ? $conn : $db_conn;

// 1. Auto-create dedicated system_invoice_settings table
$create_sql = "CREATE TABLE IF NOT EXISTS system_invoice_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) DEFAULT 'AB MALAYA INDUSTRY',
    company_reg_no VARCHAR(100) DEFAULT '003320457-D',
    company_address TEXT,
    phone VARCHAR(100) DEFAULT '+60 3-8000 1234',
    email VARCHAR(100) DEFAULT 'abmalayaindustry@gmail.com',
    logo_url LONGTEXT,
    stamp_url LONGTEXT,
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
    layout_offsets LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

$connection->query($create_sql);

// Auto-check columns if table existed prior
$chk_cols = [
    'company_reg_no' => "ALTER TABLE system_invoice_settings ADD COLUMN company_reg_no VARCHAR(100) DEFAULT '003320457-D' AFTER company_name",
    'header_image_url' => "ALTER TABLE system_invoice_settings ADD COLUMN header_image_url LONGTEXT DEFAULT NULL AFTER stamp_url",
    'signature_url' => "ALTER TABLE system_invoice_settings ADD COLUMN signature_url LONGTEXT DEFAULT NULL AFTER stamp_url",
    'remarks_text' => "ALTER TABLE system_invoice_settings ADD COLUMN remarks_text TEXT AFTER bank_email",
    'authorised_by_name' => "ALTER TABLE system_invoice_settings ADD COLUMN authorised_by_name VARCHAR(255) DEFAULT 'Muhammad Aimanuddin Bin Mohd Zaki' AFTER remarks_text",
    'authorised_by_title' => "ALTER TABLE system_invoice_settings ADD COLUMN authorised_by_title VARCHAR(255) DEFAULT 'Procurement Manager / Head of Sales' AFTER authorised_by_name",
    'received_by_label' => "ALTER TABLE system_invoice_settings ADD COLUMN received_by_label VARCHAR(255) DEFAULT 'Received by,' AFTER authorised_by_title",
    'layout_offsets' => "ALTER TABLE system_invoice_settings ADD COLUMN layout_offsets LONGTEXT DEFAULT NULL AFTER table_header_text_color"
];

foreach ($chk_cols as $col => $alter_sql) {
    $c_res = $connection->query("SHOW COLUMNS FROM system_invoice_settings LIKE '$col'");
    if ($c_res && $c_res->num_rows === 0) {
        $connection->query($alter_sql);
    }
}

// 2. Ensure default record id = 1 exists
$chk_res = $connection->query("SELECT COUNT(*) AS total FROM system_invoice_settings");
$total = 0;
if ($chk_res && $row_c = $chk_res->fetch_assoc()) {
    $total = (int)$row_c['total'];
}

if ($total === 0) {
    $default_address = 'No 3. Jalan Melati Utama 1, Taman Melati Utama, 53100 Setapak, Kuala Lumpur';
    $default_remarks = "1. Please make all payment crossed & payable to: PUBLIC BANK; 3818192115 (AB MALAYA INDUSTRY)\n2. PLEASE EMAIL ALL RELEVANT DOCUMENTS TO: abmalayaindustry@gmail.com\n3. Do not forget to keep a copy of any document as a prove of any transaction.\nKindly contact us should you have further enquiries.";

    $stmt_init = $connection->prepare("INSERT INTO system_invoice_settings (
        id, company_name, company_reg_no, company_address, phone, email, 
        logo_url, stamp_url, signature_url, header_image_url, invoice_title, 
        bank_name, bank_account_number, bank_account_name, bank_email, 
        remarks_text, authorised_by_name, authorised_by_title, received_by_label, 
        table_header_bg, table_header_text_color
    ) VALUES (1, 'AB MALAYA INDUSTRY', '003320457-D', ?, '+60 3-8000 1234', 'abmalayaindustry@gmail.com',
        '/favicon.png', '', '', NULL, 'OFFICIAL INVOICE',
        'PUBLIC BANK', '3818192115', 'AB MALAYA INDUSTRY', 'abmalayaindustry@gmail.com',
        ?, 'Muhammad Aimanuddin Bin Mohd Zaki', 'Procurement Manager / Head of Sales', 'Received by,',
        '#0070c0', '#ffffff'
    )");

    if ($stmt_init) {
        $stmt_init->bind_param("ss", $default_address, $default_remarks);
        $stmt_init->execute();
        $stmt_init->close();
    }
}

$method = $_SERVER['REQUEST_METHOD'];

// Handle File Uploads (Logo / Stamp / Signature / Header Image)
if (isset($_FILES['logo_file']) || isset($_FILES['stamp_file']) || isset($_FILES['signature_file']) || isset($_FILES['header_image_file'])) {
    header('Content-Type: application/json; charset=utf-8');
    $upload_dir = __DIR__ . '/uploads/';
    if (!file_exists($upload_dir)) {
        @mkdir($upload_dir, 0777, true);
    }

    $uploaded_paths = [];

    if (isset($_FILES['logo_file']) && $_FILES['logo_file']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['logo_file']['name'], PATHINFO_EXTENSION);
        $filename = 'inv_logo_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
        $target_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['logo_file']['tmp_name'], $target_path)) {
            $uploaded_paths['logo_url'] = '/uploads/' . $filename;
        }
    }

    if (isset($_FILES['stamp_file']) && $_FILES['stamp_file']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['stamp_file']['name'], PATHINFO_EXTENSION);
        $filename = 'inv_stamp_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
        $target_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['stamp_file']['tmp_name'], $target_path)) {
            $uploaded_paths['stamp_url'] = '/uploads/' . $filename;
        }
    }

    if (isset($_FILES['signature_file']) && $_FILES['signature_file']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['signature_file']['name'], PATHINFO_EXTENSION);
        $filename = 'inv_sig_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
        $target_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['signature_file']['tmp_name'], $target_path)) {
            $uploaded_paths['signature_url'] = '/uploads/' . $filename;
        }
    }

    if (isset($_FILES['header_image_file']) && $_FILES['header_image_file']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['header_image_file']['name'], PATHINFO_EXTENSION);
        $filename = 'inv_hdr_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
        $target_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['header_image_file']['tmp_name'], $target_path)) {
            $uploaded_paths['header_image_url'] = '/uploads/' . $filename;
        }
    }

    if (!empty($uploaded_paths)) {
        if (isset($uploaded_paths['logo_url'])) {
            $stmt = $connection->prepare("UPDATE system_invoice_settings SET logo_url = ? WHERE id = 1");
            $stmt->bind_param("s", $uploaded_paths['logo_url']);
            $stmt->execute();
            $stmt->close();
        }
        if (isset($uploaded_paths['stamp_url'])) {
            $stmt = $connection->prepare("UPDATE system_invoice_settings SET stamp_url = ? WHERE id = 1");
            $stmt->bind_param("s", $uploaded_paths['stamp_url']);
            $stmt->execute();
            $stmt->close();
        }
        if (isset($uploaded_paths['signature_url'])) {
            $stmt = $connection->prepare("UPDATE system_invoice_settings SET signature_url = ? WHERE id = 1");
            $stmt->bind_param("s", $uploaded_paths['signature_url']);
            $stmt->execute();
            $stmt->close();
        }
        if (isset($uploaded_paths['header_image_url'])) {
            $stmt = $connection->prepare("UPDATE system_invoice_settings SET header_image_url = ? WHERE id = 1");
            $stmt->bind_param("s", $uploaded_paths['header_image_url']);
            $stmt->execute();
            $stmt->close();
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Invoice asset uploaded successfully to server!',
            'data' => $uploaded_paths
        ]);
        exit;
    }
}

// GET Request: Return settings
if ($method === 'GET') {
    header('Content-Type: application/json; charset=utf-8');
    $res = $connection->query("SELECT * FROM system_invoice_settings WHERE id = 1 LIMIT 1");
    $settings = null;
    if ($res && $row = $res->fetch_assoc()) {
        $settings = $row;
    } else {
        $settings = [
            'id' => 1,
            'company_name' => 'AB MALAYA INDUSTRY',
            'company_reg_no' => '003320457-D',
            'company_address' => 'No 3. Jalan Melati Utama 1, Taman Melati Utama, 53100 Setapak, Kuala Lumpur',
            'phone' => '+60 3-8000 1234',
            'email' => 'abmalayaindustry@gmail.com',
            'logo_url' => '/favicon.png',
            'stamp_url' => '',
            'header_image_url' => null,
            'invoice_title' => 'OFFICIAL INVOICE',
            'bank_name' => 'PUBLIC BANK',
            'bank_account_number' => '3818192115',
            'bank_account_name' => 'AB MALAYA INDUSTRY',
            'bank_email' => 'abmalayaindustry@gmail.com',
            'remarks_text' => "1. Please make all payment crossed & payable to: PUBLIC BANK; 3818192115 (AB MALAYA INDUSTRY)\n2. PLEASE EMAIL ALL RELEVANT DOCUMENTS TO: abmalayaindustry@gmail.com\n3. Do not forget to keep a copy of any document as a prove of any transaction.\nKindly contact us should you have further enquiries.",
            'authorised_by_name' => 'Muhammad Aimanuddin Bin Mohd Zaki',
            'authorised_by_title' => 'Procurement Manager / Head of Sales',
            'received_by_label' => 'Received by,',
            'table_header_bg' => '#0070c0',
            'table_header_text_color' => '#ffffff',
            'layout_offsets' => null
        ];
    }

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'data' => $settings
    ]);
    exit;
}

// POST Request: Update settings
if ($method === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!$input) $input = $_POST;

    // Fast-path: Save layout offsets permanently
    if ((isset($input['action']) && $input['action'] === 'save_layout') || isset($input['layout_offsets'])) {
        $raw_offsets = $input['layout_offsets'] ?? '';
        if (is_array($raw_offsets) || is_object($raw_offsets)) {
            $raw_offsets = json_encode($raw_offsets);
        }
        $escaped = $connection->real_escape_string($raw_offsets);
        $connection->query("UPDATE system_invoice_settings SET layout_offsets = '$escaped' WHERE id = 1");
        if ($connection->affected_rows === 0) {
            $connection->query("INSERT INTO system_invoice_settings (id, layout_offsets) VALUES (1, '$escaped') ON DUPLICATE KEY UPDATE layout_offsets = '$escaped'");
        }
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Invoice Drag & Move layout positions saved permanently to database!',
            'layout_offsets' => $raw_offsets
        ]);
        exit;
    }

    $c_name = trim($input['company_name'] ?? 'AB MALAYA INDUSTRY');
    $c_reg = trim($input['company_reg_no'] ?? '003320457-D');
    $c_addr = trim($input['company_address'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $email = trim($input['email'] ?? '');
    $logo_url = trim($input['logo_url'] ?? '');
    $stamp_url = trim($input['stamp_url'] ?? '');
    $sig_url = trim($input['signature_url'] ?? '');
    $hdr_img_url = trim($input['header_image_url'] ?? '');
    $inv_title = trim($input['invoice_title'] ?? 'OFFICIAL INVOICE');
    $b_name = trim($input['bank_name'] ?? 'PUBLIC BANK');
    $b_acc = trim($input['bank_account_number'] ?? '3818192115');
    $b_holder = trim($input['bank_account_name'] ?? 'AB MALAYA INDUSTRY');
    $b_email = trim($input['bank_email'] ?? 'abmalayaindustry@gmail.com');
    $remarks = trim($input['remarks_text'] ?? '');
    $auth_name = trim($input['authorised_by_name'] ?? 'Muhammad Aimanuddin Bin Mohd Zaki');
    $auth_title = trim($input['authorised_by_title'] ?? 'Procurement Manager / Head of Sales');
    $recv_label = trim($input['received_by_label'] ?? 'Received by,');
    $t_bg = trim($input['table_header_bg'] ?? '#0070c0');
    $t_txt = trim($input['table_header_text_color'] ?? '#ffffff');

    $paper_size = trim($input['paper_size'] ?? 'A4');
    $margin_top = (int)($input['margin_top'] ?? 18);
    $margin_bottom = (int)($input['margin_bottom'] ?? 18);
    $margin_left = (int)($input['margin_left'] ?? 14);
    $margin_right = (int)($input['margin_right'] ?? 14);
    $font_size = (int)($input['font_size'] ?? 9);

    $stmt = $connection->prepare("UPDATE system_invoice_settings SET 
        company_name = ?, company_reg_no = ?, company_address = ?, phone = ?, email = ?, 
        logo_url = ?, stamp_url = ?, signature_url = ?, header_image_url = ?, invoice_title = ?,
        bank_name = ?, bank_account_number = ?, bank_account_name = ?, bank_email = ?,
        remarks_text = ?, authorised_by_name = ?, authorised_by_title = ?, received_by_label = ?,
        table_header_bg = ?, table_header_text_color = ?,
        paper_size = ?, margin_top = ?, margin_bottom = ?, margin_left = ?, margin_right = ?, font_size = ?
        WHERE id = 1");

    if (!$stmt) {
        ob_end_clean();
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $connection->error]);
        exit;
    }

    $stmt->bind_param("ssssssssssssssssssssiiiii", 
        $c_name, $c_reg, $c_addr, $phone, $email, 
        $logo_url, $stamp_url, $sig_url, $hdr_img_url, $inv_title,
        $b_name, $b_acc, $b_holder, $b_email,
        $remarks, $auth_name, $auth_title, $recv_label,
        $t_bg, $t_txt,
        $paper_size, $margin_top, $margin_bottom, $margin_left, $margin_right, $font_size
    );

    if ($stmt->execute()) {
        $stmt->close();
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Invoice settings saved successfully to dedicated system_invoice_settings table!'
        ]);
    } else {
        $err = $stmt->error;
        $stmt->close();
        ob_end_clean();
        echo json_encode(['status' => 'error', 'message' => 'Failed to save invoice settings: ' . $err]);
    }
    exit;
}
