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

    // 3. Fetch Google Sheet Category Blueprint & Products Data in a single Batch request
    $spreadsheet_id = '17oE102qBlTzXGeWxHMkNTCnz0CE4TKR_xxsq65QqFmI';
    $batch_url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheet_id}/values:batchGet?ranges=" . urlencode('C1:C100') . "&ranges=" . urlencode('OTHERS!A1:G100');

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
        throw new Exception("Google Sheets API failed with HTTP $sheet_code: " . $sheet_response);
    }

    $batch_data = json_decode($sheet_response, true);
    $valueRanges = $batch_data['valueRanges'] ?? [];
    
    $rows = isset($valueRanges[0]['values']) ? $valueRanges[0]['values'] : [];
    $others_rows = isset($valueRanges[1]['values']) ? $valueRanges[1]['values'] : [];

    if (empty($rows)) {
        throw new Exception('No rows found in the Category Blueprint Google Sheet.');
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

    // 5. Restore products table for actual items
    $db_conn->query("DROP TABLE IF EXISTS `products`");
    $db_conn->query("CREATE TABLE `products` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `product_code` VARCHAR(100) UNIQUE NOT NULL,
        `product_name` VARCHAR(255) NOT NULL,
        `description` TEXT,
        `unit` VARCHAR(50) DEFAULT 'Unit',
        `unit_price` DECIMAL(15,2) DEFAULT 0.00,
        `stock_quantity` INT DEFAULT 50,
        `discount_percent` DECIMAL(5,2) DEFAULT 0.00,
        `image_url` TEXT,
        `category` VARCHAR(100) DEFAULT 'Equipment',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Seed products table from the OTHERS tab (Tab 2) dynamically
    $others_imported = 0;
    if (!empty($others_rows)) {
        $db_conn->query("TRUNCATE TABLE `products`");
        $current_parent = '';
        $product_index = 1;
        
        foreach ($others_rows as $idx_row => $row_val) {
            if ($idx_row < 4) continue;
            if (empty($row_val)) continue;
            
            $no = isset($row_val[2]) ? trim($row_val[2]) : '';
            $impa = isset($row_val[3]) ? trim($row_val[3]) : '';
            $desc = isset($row_val[4]) ? trim($row_val[4]) : '';
            $offered = isset($row_val[5]) ? trim($row_val[5]) : '';
            $price = isset($row_val[6]) ? trim($row_val[6]) : '';
            
            if (empty($desc)) continue;
            if (strtolower($desc) === 'descriptions' || strtolower($no) === 'no') {
                continue;
            }
            if (strpos(strtoupper($desc), 'SUB CAT :') !== false) {
                continue;
            }
            
            $product_name = '';
            $product_desc = $offered;
            $unit_price = (float)str_replace([',', ' '], '', $price);
            
            if (!empty($no)) {
                if (!empty($price)) {
                    $product_name = $desc;
                    $current_parent = '';
                } else {
                    $current_parent = $desc;
                    continue;
                }
            } else {
                if (!empty($price) && !empty($current_parent)) {
                    $product_name = $current_parent . ' - ' . $desc;
                } else {
                    continue;
                }
            }
            
            if (empty($product_name)) continue;
            
            $product_code = 'PRD-GYM-' . str_pad($product_index++, 3, '0', STR_PAD_LEFT);
            if (!empty($impa)) {
                $product_code = 'IMPA-' . $impa;
            }
            
            $stmt_prod = $db_conn->prepare("INSERT INTO `products` (`product_code`, `product_name`, `description`, `unit`, `unit_price`, `stock_quantity`, `discount_percent`, `category`) VALUES (?, ?, ?, 'Unit', ?, 50, 0.00, 'Gym Equipment')");
            if ($stmt_prod) {
                $stmt_prod->bind_param("sssd", $product_code, $product_name, $product_desc, $unit_price);
                if ($stmt_prod->execute()) {
                    $others_imported++;
                } else {
                    $errors[] = "Failed to insert product $product_code ($product_name): " . $stmt_prod->error;
                }
                $stmt_prod->close();
            } else {
                $errors[] = "Failed to prepare statement for product $product_code: " . $db_conn->error;
            }
        }
    } else {
        $errors[] = "OTHERS sheet rows are empty.";
    }

    $imported_count = 0;

    foreach ($rows as $row) {
        if (empty($row[0])) continue;
        $text = trim($row[0]);

        if (!preg_match('/^(\d+)\s*[\-–—]\s*(.+)$/m', $text, $match_title)) {
            continue;
        }

        $code = trim($match_title[1]);
        $full_title = trim($match_title[2]);

        $title_lines = explode("\n", $full_title);
        $category_name = trim($title_lines[0]);
        $category_name = preg_replace('/[^A-Za-z0-9\s\-\&]/', '', $category_name);
        $category_name = trim(preg_replace('/^[?\s\-–—]+/', '', $category_name));

        $internal_cat = '';
        if (preg_match('/AB Malaya Internal Category\s*\n\s*\n\s*(.+)$/mi', $text, $match_int)) {
            $internal_lines = explode("\n", trim($match_int[1]));
            $internal_cat = trim($internal_lines[0]);
        }

        $subcategories = [];
        if (preg_match('/Subcategories\s*\n(.+?)(?:\n\s*\n|Description|$)/si', $text, $match_sub)) {
            $sub_lines = explode("\n", trim($match_sub[1]));
            foreach ($sub_lines as $sub) {
                $sub = trim($sub);
                if (!empty($sub)) $subcategories[] = $sub;
            }
        }
        $subcategories_str = implode(', ', $subcategories);

        $desc_en = '';
        $desc_my = '';
        if (preg_match('/Description\s*\n\s*\n\s*English:\s*\n(.+?)(?:\n\s*\n\s*Bahasa Melayu:|\n\s*\n\s*Classification Rule|$)/si', $text, $match_desc_en)) {
            $desc_en = trim($match_desc_en[1]);
        }
        if (preg_match('/Bahasa Melayu:\s*\n(.+?)(?:\n\s*\n\s*Classification Rule|$)/si', $text, $match_desc_my)) {
            $desc_my = trim($match_desc_my[1]);
        }

        $rules = '';
        if (preg_match('/Classification Rule\s*\n(.+)$/si', $text, $match_rules)) {
            $rules = trim($match_rules[1]);
        }

        // Insert into the category table
        $stmt = $db_conn->prepare("INSERT INTO product_categories (category_code, category_name, internal_category, subcategories, description_en, description_my, classification_rules) VALUES (?, ?, ?, ?, ?, ?, ?)");
        if ($stmt) {
            $stmt->bind_param("sssssss", $code, $category_name, $internal_cat, $subcategories_str, $desc_en, $desc_my, $rules);
            if ($stmt->execute()) {
                $imported_count++;
            } else {
                $errors[] = "Failed to insert Category $code: " . $stmt->error;
            }
            $stmt->close();
        } else {
            $errors[] = "Failed to prepare statement for Category $code: " . $db_conn->error;
        }
    }

    echo json_encode([
        'status' => 'success',
        'message' => 'Successfully imported category blueprint data to product_categories, and restored products database table.',
        'imported_categories' => $imported_count,
        'imported_products' => $others_imported,
        'errors' => $errors
    ]);

} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
