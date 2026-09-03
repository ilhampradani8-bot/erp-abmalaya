<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/db_connect.php';
    $errors = [];

    // 1. Get Google Credentials
    $json_file = __DIR__ . '/erp-abmalaya-connect-0fc0c4cb6314.json';
    if (!file_exists($json_file)) {
        $json_file = __DIR__ . '/../erp-abmalaya-connect-0fc0c4cb6314.json';
    }

    if (!file_exists($json_file)) {
        throw new Exception('Google Credentials JSON file not found.');
    }

    $creds = json_decode(file_get_contents($json_file), true);
    if (!$creds || empty($creds['private_key'])) {
        throw new Exception('Invalid Google Credentials JSON file.');
    }

    // 2. Generate Google OAuth2 Token
    function base64UrlEncode($data) {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);

    $now = time();
    $claim = json_encode([
        'iss' => $creds['client_email'],
        'scope' => 'https://www.googleapis.com/auth/spreadsheets.readonly',
        'aud' => $creds['token_uri'],
        'exp' => $now + 3600,
        'iat' => $now
    ]);

    $jwt_input = base64UrlEncode($header) . '.' . base64UrlEncode($claim);
    $signature = '';
    if (!openssl_sign($jwt_input, $signature, $creds['private_key'], 'SHA256')) {
        throw new Exception('OpenSSL signing failed.');
    }
    $jwt = $jwt_input . '.' . base64UrlEncode($signature);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $creds['token_uri']);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    $token_data = json_decode($response, true);
    $access_token = $token_data['access_token'] ?? '';
    if (empty($access_token)) {
        throw new Exception('Failed to obtain Google Access Token: ' . $response . ' (Curl error: ' . $err . ')');
    }

    $spreadsheet_id = '17oE102qBlTzXGeWxHMkNTCnz0CE4TKR_xxsq65QqFmI';

    // 3. Get Metadata to discover all tabs in the Spreadsheet
    $meta_url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheet_id}";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $meta_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $access_token",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $meta_res = curl_exec($ch);
    $meta_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($meta_code !== 200) {
        throw new Exception("Failed to fetch spreadsheet metadata. HTTP $meta_code: $meta_res");
    }

    $sheet_meta = json_decode($meta_res, true);
    $sheets = $sheet_meta['sheets'] ?? [];

    // Build batch ranges for all sheet tabs
    $ranges = ["C1:C2000"]; // Sheet 1 Blueprint
    $sheet_names = [];
    foreach ($sheets as $s) {
        $st = $s['properties']['title'] ?? '';
        if ($st && strpos($st, 'Blue Print') === false) {
            $ranges[] = "{$st}!A1:I2000";
            $sheet_names[] = $st;
        }
    }


    $batch_query = implode('&ranges=', array_map('urlencode', $ranges));
    $batch_url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheet_id}/values:batchGet?ranges={$batch_query}";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $batch_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $access_token",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $sheet_response = curl_exec($ch);
    $sheet_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($sheet_code !== 200) {
        throw new Exception("Google Sheets API batchGet failed with HTTP $sheet_code: " . $sheet_response);
    }

    $batch_data = json_decode($sheet_response, true);
    $valueRanges = $batch_data['valueRanges'] ?? [];

    $blueprint_rows = isset($valueRanges[0]['values']) ? $valueRanges[0]['values'] : [];
    if (empty($blueprint_rows)) {
        throw new Exception('No rows found in Category Blueprint.');
    }

    // 4. Re-create product_categories table for Google Sheet blueprints
    $db_conn->query("DROP TABLE IF EXISTS `product_categories`");
    $db_conn->query("CREATE TABLE `product_categories` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `category_code` VARCHAR(50) NOT NULL UNIQUE,
        `category_name` VARCHAR(255) NOT NULL,
        `internal_category` VARCHAR(255) NOT NULL,
        `subcategories` TEXT NOT NULL,
        `description_en` TEXT NOT NULL,
        `description_my` TEXT NOT NULL,
        `classification_rules` TEXT NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 5. Restore products table for actual items with supplier_name & image_url
    $db_conn->query("DROP TABLE IF EXISTS `products`");
    $db_conn->query("CREATE TABLE `products` (
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

    // 6. Import Products across ALL Spreadsheet Tabs
    $others_imported = 0;
    $product_index = 1;

    $stmt_prod = $db_conn->prepare("INSERT INTO `products` (`product_code`, `product_name`, `description`, `specification`, `unit`, `unit_price`, `stock_quantity`, `discount_percent`, `image_url`, `category`, `supplier_name`) VALUES (?, ?, ?, ?, 'Unit', ?, 50, 0.00, ?, ?, ?)");

    for ($tab_idx = 1; $tab_idx < count($valueRanges); $tab_idx++) {
        $tab_rows = $valueRanges[$tab_idx]['values'] ?? [];
        $tab_name = $sheet_names[$tab_idx - 1] ?? 'General Equipment';

        $current_parent = '';
        foreach ($tab_rows as $idx_row => $row_val) {
            if ($idx_row < 2) continue; // skip headers
            if (empty($row_val)) continue;

            // Find column indexes safely
            $no       = '';
            $impa     = '';
            $desc     = '';
            $offered  = '';
            $price    = '';
            $supplier = '';
            $image    = '';

            // Detect column offset
            $col_offset = 0;
            foreach ($row_val as $ci => $cv) {
                if (trim($cv) === 'No' || trim($cv) === 'IMPA Code' || trim($cv) === 'DESCRIPTIONS') {
                    $col_offset = $ci > 2 ? $ci - 2 : 0;
                    break;
                }
            }

            $no       = isset($row_val[2 + $col_offset]) ? trim($row_val[2 + $col_offset]) : '';
            $impa     = isset($row_val[3 + $col_offset]) ? trim($row_val[3 + $col_offset]) : '';
            $desc     = isset($row_val[4 + $col_offset]) ? trim($row_val[4 + $col_offset]) : '';
            $offered  = isset($row_val[5 + $col_offset]) ? trim($row_val[5 + $col_offset]) : '';
            $price    = isset($row_val[6 + $col_offset]) ? trim($row_val[6 + $col_offset]) : '';
            $supplier = isset($row_val[7 + $col_offset]) ? trim($row_val[7 + $col_offset]) : '';
            $image    = isset($row_val[8 + $col_offset]) ? trim($row_val[8 + $col_offset]) : '';

            if (empty($desc)) continue;
            if (strtolower($desc) === 'descriptions' || strtolower($no) === 'no' || strtolower($desc) === 'sub cat :') {
                continue;
            }

            $product_name = '';
            $product_spec = !empty($offered) ? $offered : $desc;
            $unit_price   = (float)str_replace([',', ' ', 'RM', 'rm'], '', $price);

            if (!empty($no)) {
                $product_name = $desc;
                $current_parent = $desc;
            } else {
                $product_name = !empty($current_parent) ? ($current_parent . ' - ' . $desc) : $desc;
            }

            if (empty($product_name)) continue;


            $product_code = 'PRD-' . str_pad($product_index++, 4, '0', STR_PAD_LEFT);
            if (!empty($impa) && preg_match('/^\d+$/', $impa)) {
                $product_code = 'IMPA-' . $impa;
            }

            if ($stmt_prod) {
                $img_val = !empty($image) ? $image : null;
                $sup_val = !empty($supplier) ? $supplier : null;

                $stmt_prod->bind_param("ssssdsss", $product_code, $product_name, $product_name, $product_spec, $unit_price, $img_val, $tab_name, $sup_val);
                if ($stmt_prod->execute()) {
                    $others_imported++;
                } else {
                    // Ignore duplicate IMPA code errors, append index
                    $alt_code = $product_code . '-' . $product_index;
                    $stmt_prod->bind_param("ssssdsss", $alt_code, $product_name, $product_name, $product_spec, $unit_price, $img_val, $tab_name, $sup_val);
                    if ($stmt_prod->execute()) $others_imported++;
                }
            }
        }
    }
    if ($stmt_prod) $stmt_prod->close();

    // 7. Parse Categories Blueprint from IMPA Sheet Tab Names & Blueprint rows
    $imported_count = 0;
    $stmt_cat = $db_conn->prepare("INSERT INTO `product_categories` (`category_code`, `category_name`, `internal_category`, `subcategories`, `description_en`, `description_my`, `classification_rules`) VALUES (?, ?, 'Marine Logistics', 'General Spares', ?, ?, 'Standard IMPA Rules') ON DUPLICATE KEY UPDATE `category_name` = VALUES(`category_name`)");

    foreach ($sheet_names as $sn) {
        if (preg_match('/^(\d+)\s*(.+)$/', trim($sn), $cm)) {
            $code = str_pad(trim($cm[1]), 2, '0', STR_PAD_LEFT);
            $cat_title = trim($cm[2]);
            if ($stmt_cat) {
                $stmt_cat->bind_param("ssss", $code, $cat_title, $sn, $sn);
                if ($stmt_cat->execute()) $imported_count++;
            }
        }
    }

    foreach ($blueprint_rows as $row) {
        if (empty($row[0])) continue;
        $text = trim($row[0]);

        if (!preg_match('/^(\d+)\s*[\-–—]\s*(.+)$/m', $text, $match_title)) {
            continue;
        }

        $code = str_pad(trim($match_title[1]), 2, '0', STR_PAD_LEFT);
        $full_title = trim($match_title[2]);
        $title_lines = explode("\n", $full_title);
        $category_name = trim($title_lines[0]);
        $category_name = preg_replace('/[^A-Za-z0-9\s\-\&]/', '', $category_name);

        if ($stmt_cat) {
            $stmt_cat->bind_param("ssss", $code, $category_name, $full_title, $full_title);
            if ($stmt_cat->execute()) $imported_count++;
        }
    }
    if ($stmt_cat) $stmt_cat->close();


    echo json_encode([
        'status' => 'success',
        'message' => 'Successfully imported all product tabs & supplier details from Google Sheets.',
        'imported_categories' => $imported_count,
        'imported_products' => $others_imported,
        'errors' => $errors
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
