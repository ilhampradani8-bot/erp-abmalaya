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

// 1. Auto-create dedicated system_paper_settings table
$create_sql = "CREATE TABLE IF NOT EXISTS system_paper_settings (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

$connection->query($create_sql);

// Auto-migrate: Ensure header_image_url & bank settings columns exist in existing database
$chk_hdr_img = $connection->query("SHOW COLUMNS FROM system_paper_settings LIKE 'header_image_url'");
if ($chk_hdr_img && $chk_hdr_img->num_rows === 0) {
    $connection->query("ALTER TABLE system_paper_settings ADD COLUMN header_image_url LONGTEXT DEFAULT NULL AFTER stamp_url");
}

$chk_sig_img = $connection->query("SHOW COLUMNS FROM system_paper_settings LIKE 'signature_url'");
if ($chk_sig_img && $chk_sig_img->num_rows === 0) {
    $connection->query("ALTER TABLE system_paper_settings ADD COLUMN signature_url LONGTEXT DEFAULT NULL AFTER stamp_url");
}

$chk_bank = $connection->query("SHOW COLUMNS FROM system_paper_settings LIKE 'bank_name'");
if ($chk_bank && $chk_bank->num_rows === 0) {
    $connection->query("ALTER TABLE system_paper_settings 
        ADD COLUMN bank_name VARCHAR(100) DEFAULT 'PUBLIC BANK' AFTER header_image_url,
        ADD COLUMN bank_account_number VARCHAR(100) DEFAULT '3818192115' AFTER bank_name,
        ADD COLUMN bank_account_name VARCHAR(255) DEFAULT 'AB MALAYA INDUSTRY' AFTER bank_account_number,
        ADD COLUMN bank_email VARCHAR(100) DEFAULT 'abmalayaindustry@gmail.com' AFTER bank_account_name");
}

$chk_layout = $connection->query("SHOW COLUMNS FROM system_paper_settings LIKE 'layout_offsets'");
if ($chk_layout && $chk_layout->num_rows === 0) {
    $connection->query("ALTER TABLE system_paper_settings ADD COLUMN layout_offsets LONGTEXT DEFAULT NULL AFTER table_header_text_color");
}

// Auto-update legacy company address in database to official Wisma Rampai address
$connection->query("UPDATE system_paper_settings SET company_address = '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.' WHERE id = 1 AND (company_address LIKE '%No. 12%' OR company_address IS NULL OR company_address = '')");

// 2. Ensure default record exists or migrate legacy branding keys from api_credentials
$chk_res = $connection->query("SELECT COUNT(*) AS total FROM system_paper_settings");
$total = 0;
if ($chk_res && $row_c = $chk_res->fetch_assoc()) {
    $total = (int)$row_c['total'];
}

if ($total === 0) {
    // Migration fallback from api_credentials
    $legacy = [
        'company_name' => 'AB MALAYA SDN. BHD.',
        'company_address' => '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.',
        'phone' => '+60 3-8000 1234',
        'email' => 'sales@abmalaya.com',
        'logo_url' => '/favicon.png',
        'stamp_url' => '',
        'signature_url' => '',
        'header_title' => 'SURAT PENAWARAN HARGA (SPH) / QUOTATION',
        'footer_terms' => "1. 50% DP payment required after PO is issued.\n2. Remaining 50% payment upon delivery completion.\n3. Quotation valid for 14 days from issue date.",
        'header_color' => '#0080d0',
        'default_notes' => 'Price excludes transport tax unless explicitly stated. All goods remain property of AB Malaya until fully paid.',
        'header_template' => 'default',
        'table_header_bg' => '#0f172a',
        'table_header_text_color' => '#ffffff'
    ];

    $leg_res = $connection->query("SELECT credential_key, credential_value FROM api_credentials WHERE credential_key LIKE 'COMPANY_%' OR credential_key LIKE 'DOC_%'");
    if ($leg_res && $leg_res->num_rows > 0) {
        while ($lrow = $leg_res->fetch_assoc()) {
            $k = $lrow['credential_key'];
            $v = $lrow['credential_value'];
            if ($k === 'COMPANY_NAME' && !empty($v)) $legacy['company_name'] = $v;
            if ($k === 'COMPANY_ADDRESS' && !empty($v)) $legacy['company_address'] = $v;
            if ($k === 'COMPANY_PHONE' && !empty($v)) $legacy['phone'] = $v;
            if ($k === 'COMPANY_EMAIL' && !empty($v)) $legacy['email'] = $v;
            if ($k === 'COMPANY_LOGO' && !empty($v)) $legacy['logo_url'] = $v;
            if ($k === 'COMPANY_STAMP' && !empty($v)) $legacy['stamp_url'] = $v;
            if ($k === 'DOC_HEADER_TITLE' && !empty($v)) $legacy['header_title'] = $v;
            if ($k === 'DOC_FOOTER_TERMS' && !empty($v)) $legacy['footer_terms'] = $v;
            if ($k === 'DOC_HEADER_COLOR' && !empty($v)) $legacy['header_color'] = $v;
            if ($k === 'DOC_DEFAULT_NOTES' && !empty($v)) $legacy['default_notes'] = $v;
        }
    }

    $stmt_init = $connection->prepare("INSERT INTO system_paper_settings (
        id, company_name, company_address, phone, email, logo_url, stamp_url, signature_url, header_title, footer_terms, header_color, default_notes, header_template, table_header_bg, table_header_text_color
    ) VALUES (1, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)");
    if ($stmt_init) {
        $stmt_init->bind_param("sssssssssssss", 
            $legacy['company_name'], $legacy['company_address'], $legacy['phone'], $legacy['email'], 
            $legacy['logo_url'], $legacy['stamp_url'], $legacy['header_title'], $legacy['footer_terms'], 
            $legacy['header_color'], $legacy['default_notes'], $legacy['header_template'], 
            $legacy['table_header_bg'], $legacy['table_header_text_color']
        );
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
        $filename = 'logo_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
        $target_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['logo_file']['tmp_name'], $target_path)) {
            $uploaded_paths['logo_url'] = '/uploads/' . $filename;
        }
    }

    if (isset($_FILES['stamp_file']) && $_FILES['stamp_file']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['stamp_file']['name'], PATHINFO_EXTENSION);
        $filename = 'stamp_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
        $target_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['stamp_file']['tmp_name'], $target_path)) {
            $uploaded_paths['stamp_url'] = '/uploads/' . $filename;
        }
    }

    if (isset($_FILES['signature_file']) && $_FILES['signature_file']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['signature_file']['name'], PATHINFO_EXTENSION);
        $filename = 'sig_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
        $target_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['signature_file']['tmp_name'], $target_path)) {
            $uploaded_paths['signature_url'] = '/uploads/' . $filename;
        }
    }

    if (isset($_FILES['header_image_file']) && $_FILES['header_image_file']['error'] === UPLOAD_ERR_OK) {
        $ext = pathinfo($_FILES['header_image_file']['name'], PATHINFO_EXTENSION);
        $filename = 'hdr_img_' . time() . '_' . rand(1000, 9999) . '.' . strtolower($ext);
        $target_path = $upload_dir . $filename;
        if (move_uploaded_file($_FILES['header_image_file']['tmp_name'], $target_path)) {
            $uploaded_paths['header_image_url'] = '/uploads/' . $filename;
        }
    }

    if (!empty($uploaded_paths)) {
        if (isset($uploaded_paths['logo_url'])) {
            $stmt = $connection->prepare("UPDATE system_paper_settings SET logo_url = ? WHERE id = 1");
            $stmt->bind_param("s", $uploaded_paths['logo_url']);
            $stmt->execute();
            $stmt->close();
        }
        if (isset($uploaded_paths['stamp_url'])) {
            $stmt = $connection->prepare("UPDATE system_paper_settings SET stamp_url = ? WHERE id = 1");
            $stmt->bind_param("s", $uploaded_paths['stamp_url']);
            $stmt->execute();
            $stmt->close();
        }
        if (isset($uploaded_paths['signature_url'])) {
            $stmt = $connection->prepare("UPDATE system_paper_settings SET signature_url = ? WHERE id = 1");
            $stmt->bind_param("s", $uploaded_paths['signature_url']);
            $stmt->execute();
            $stmt->close();
        }
        if (isset($uploaded_paths['header_image_url'])) {
            $stmt = $connection->prepare("UPDATE system_paper_settings SET header_image_url = ? WHERE id = 1");
            $stmt->bind_param("s", $uploaded_paths['header_image_url']);
            $stmt->execute();
            $stmt->close();
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Image uploaded successfully to server!',
            'data' => $uploaded_paths
        ]);
        exit;
    }
}

// GET Request: Return settings
if ($method === 'GET') {
    header('Content-Type: application/json; charset=utf-8');
    $res = $connection->query("SELECT * FROM system_paper_settings WHERE id = 1 LIMIT 1");
    $settings = null;
    if ($res && $row = $res->fetch_assoc()) {
        $settings = $row;
    } else {
        // Fallback default
        $settings = [
            'id' => 1,
            'company_name' => 'AB MALAYA SDN. BHD.',
            'company_address' => 'No. 12, Jalan Industrial Park, 50000 Kuala Lumpur, Malaysia',
            'phone' => '+60 3-8000 1234',
            'email' => 'sales@abmalaya.com',
            'logo_url' => '/favicon.png',
            'stamp_url' => '',
            'header_title' => 'SURAT PENAWARAN HARGA (SPH) / QUOTATION',
            'footer_terms' => "1. 50% DP payment required after PO is issued.\n2. Remaining 50% payment upon delivery completion.\n3. Quotation valid for 14 days from issue date.",
            'header_color' => '#0080d0',
            'default_notes' => 'Price excludes transport tax unless explicitly stated.',
            'header_template' => 'default',
            'table_header_bg' => '#0f172a',
            'table_header_text_color' => '#ffffff'
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
        $connection->query("UPDATE system_paper_settings SET layout_offsets = '$escaped'");
        if ($connection->affected_rows === 0) {
            $connection->query("INSERT INTO system_paper_settings (id, layout_offsets) VALUES (1, '$escaped') ON DUPLICATE KEY UPDATE layout_offsets = '$escaped'");
        }
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Drag & Move layout positions saved permanently to database!',
            'layout_offsets' => $raw_offsets
        ]);
        exit;
    }


    $c_name = trim($input['company_name'] ?? 'AB MALAYA SDN. BHD.');
    $c_addr = trim($input['company_address'] ?? '');
    $phone = trim($input['phone'] ?? '');
    $email = trim($input['email'] ?? '');
    $logo_url = trim($input['logo_url'] ?? '');
    $stamp_url = trim($input['stamp_url'] ?? '');
    $sig_url = trim($input['signature_url'] ?? '');
    $hdr_img_url = trim($input['header_image_url'] ?? '');
    $b_name = trim($input['bank_name'] ?? 'PUBLIC BANK');
    $b_acc = trim($input['bank_account_number'] ?? '3818192115');
    $b_holder = trim($input['bank_account_name'] ?? 'AB MALAYA INDUSTRY');
    $b_email = trim($input['bank_email'] ?? 'abmalayaindustry@gmail.com');
    $h_title = trim($input['header_title'] ?? '');
    $f_terms = trim($input['footer_terms'] ?? '');
    $h_color = trim($input['header_color'] ?? '#0080d0');
    $d_notes = trim($input['default_notes'] ?? '');
    $h_template = trim($input['header_template'] ?? 'default');
    $t_bg = trim($input['table_header_bg'] ?? '#0f172a');
    $t_txt = trim($input['table_header_text_color'] ?? '#ffffff');

    $paper_size = trim($input['paper_size'] ?? 'A4');
    $margin_top = (int)($input['margin_top'] ?? 18);
    $margin_bottom = (int)($input['margin_bottom'] ?? 18);
    $margin_left = (int)($input['margin_left'] ?? 14);
    $margin_right = (int)($input['margin_right'] ?? 14);
    $font_size = (int)($input['font_size'] ?? 9);

    $stmt = $connection->prepare("UPDATE system_paper_settings SET 
        company_name = ?, company_address = ?, phone = ?, email = ?, 
        logo_url = ?, stamp_url = ?, signature_url = ?, header_image_url = ?,
        bank_name = ?, bank_account_number = ?, bank_account_name = ?, bank_email = ?,
        header_title = ?, footer_terms = ?, 
        header_color = ?, default_notes = ?, header_template = ?, 
        table_header_bg = ?, table_header_text_color = ?,
        paper_size = ?, margin_top = ?, margin_bottom = ?, margin_left = ?, margin_right = ?, font_size = ?
        WHERE id = 1");

    if (!$stmt) {
        ob_end_clean();
        echo json_encode(['status' => 'error', 'message' => 'Database error: ' . $connection->error]);
        exit;
    }

    $stmt->bind_param("ssssssssssssssssssssiiiii", 
        $c_name, $c_addr, $phone, $email, 
        $logo_url, $stamp_url, $sig_url, $hdr_img_url,
        $b_name, $b_acc, $b_holder, $b_email,
        $h_title, $f_terms, 
        $h_color, $d_notes, $h_template, 
        $t_bg, $t_txt,
        $paper_size, $margin_top, $margin_bottom, $margin_left, $margin_right, $font_size
    );

    if ($stmt->execute()) {
        $stmt->close();

        // Also update api_credentials for legacy compatibility
        $sync_map = [
            'COMPANY_NAME' => $c_name,
            'COMPANY_ADDRESS' => $c_addr,
            'COMPANY_PHONE' => $phone,
            'COMPANY_EMAIL' => $email,
            'COMPANY_LOGO' => $logo_url,
            'COMPANY_STAMP' => $stamp_url,
            'DOC_HEADER_TITLE' => $h_title,
            'DOC_FOOTER_TERMS' => $f_terms,
            'DOC_HEADER_COLOR' => $h_color,
            'DOC_DEFAULT_NOTES' => $d_notes
        ];

        foreach ($sync_map as $k => $v) {
            $up_cred = $connection->prepare("UPDATE api_credentials SET credential_value = ? WHERE credential_key = ?");
            if ($up_cred) {
                $up_cred->bind_param("ss", $v, $k);
                $up_cred->execute();
                $up_cred->close();
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'message' => 'Paper & Letterhead settings saved successfully to dedicated system_paper_settings table!'
        ]);
    } else {
        $err = $stmt->error;
        $stmt->close();
        ob_end_clean();
        echo json_encode(['status' => 'error', 'message' => 'Failed to save paper settings: ' . $err]);
    }
    exit;
}
