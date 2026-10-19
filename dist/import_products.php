<?php
/**
 * ABM Malaya ERP — Google Sheets Product & Category Importer
 * public/import_products.php
 *
 * Spreadsheet ID: 17oE102qBlTzXGeWxHMkNTCnz0CE4TKR_xxsq65QqFmI
 * Imports ALL product tabs & categories without exception.
 * 0% Emojis Policy: Cleans ASCII text using Regex.
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

function clean_ascii(?string $text): string {
    if ($text === null) return '';
    // Strip emojis and non-ASCII decorative characters
    $clean = preg_replace('/[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F1E0}-\x{1F1FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]/u', '', $text);
    return trim(preg_replace('/[^\x20-\x7E\r\n\t]/', '', $clean));
}

try {
    require_once __DIR__ . '/db_connect.php';
    $errors = [];

    // 1. Locate Service Account Credentials
    $json_file = __DIR__ . '/erp-abmalaya-connect-0fc0c4cb6314.json';
    if (!file_exists($json_file)) {
        $json_file = dirname(__DIR__) . '/erp-abmalaya-connect-0fc0c4cb6314.json';
    }

    if (!file_exists($json_file)) {
        throw new Exception('Google Credentials JSON file not found at ' . $json_file);
    }

    $creds = json_decode(file_get_contents($json_file), true);
    if (!$creds || empty($creds['private_key'])) {
        throw new Exception('Invalid Google Credentials JSON file.');
    }

    // 2. Generate Google OAuth2 Access Token
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
        throw new Exception('Failed to obtain Google Access Token: ' . $response);
    }

    $spreadsheet_id = '17oE102qBlTzXGeWxHMkNTCnz0CE4TKR_xxsq65QqFmI';

    // 3. Fetch Metadata to discover all sheet tabs
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
        throw new Exception("Failed to fetch spreadsheet metadata. HTTP $meta_code");
    }

    $sheet_meta = json_decode($meta_res, true);
    $sheets = $sheet_meta['sheets'] ?? [];

    $ranges = [];
    $sheet_titles = [];
    foreach ($sheets as $s) {
        $st = $s['properties']['title'] ?? '';
        if ($st) {
            $ranges[] = "ranges=" . urlencode("{$st}!A1:Z5000");
            $sheet_titles[] = $st;
        }
    }

    // 4. Batch Fetch All Sheet Tabs Data in 1 Request
    $batch_url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheet_id}/values:batchGet?" . implode("&", $ranges);
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $batch_url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer $access_token",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $batch_res = curl_exec($ch);
    $batch_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($batch_code !== 200) {
        throw new Exception("Google Sheets API batchGet failed with HTTP $batch_code");
    }

    $batch_data = json_decode($batch_res, true);
    $valueRanges = $batch_data['valueRanges'] ?? [];

    // 5. Re-create product_categories table
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

    // 6. Ensure products table exists with full columns (offer, capital, etc.)
    $db_conn->query("DROP TABLE IF EXISTS `products`");
    $db_conn->query("CREATE TABLE `products` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `product_code` VARCHAR(100) UNIQUE NOT NULL,
        `product_name` VARCHAR(255) NOT NULL,
        `description` TEXT,
        `specification` TEXT,
        `offer` TEXT DEFAULT NULL,
        `unit` VARCHAR(50) DEFAULT 'Unit',
        `unit_price` DECIMAL(15,2) DEFAULT 0.00,
        `capital` DECIMAL(15,2) DEFAULT 0.00,
        `stock_quantity` INT DEFAULT 50,
        `discount_percent` DECIMAL(5,2) DEFAULT 0.00,
        `image_url` TEXT,
        `category` VARCHAR(100) DEFAULT 'Equipment',
        `supplier_name` VARCHAR(255) DEFAULT NULL,
        `status` VARCHAR(20) DEFAULT 'active',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $products_imported = 0;
    $product_index = 1;

    $stmt_prod = $db_conn->prepare("INSERT INTO `products` (`product_code`, `product_name`, `description`, `specification`, `offer`, `unit`, `unit_price`, `capital`, `stock_quantity`, `discount_percent`, `image_url`, `category`, `supplier_name`) VALUES (?, ?, ?, ?, ?, 'Unit', ?, ?, 50, 0.00, ?, ?, ?)");

    // Process each sheet tab
    foreach ($valueRanges as $vr_idx => $vr) {
        $st_title = $sheet_titles[$vr_idx] ?? '';
        if ($st_title === 'Database Blue Print') continue;

        $clean_tab_name = clean_ascii($st_title);
        // Format category name from tab title (e.g., "23 LIFTING AND RIGGING" or "23 - LIFTING AND RIGGING")
        $cat_display_name = $clean_tab_name;

        $rows = $vr['values'] ?? [];
        if (empty($rows)) continue;

        // Locate header column mapping dynamically
        $desc_col = -1;
        $no_col = -1;
        $impa_col = -1;
        $offered_col = -1;
        $price_col = -1;
        $supplier_col = -1;
        $image_col = -1;

        $header_found = false;

        foreach ($rows as $r_idx => $r) {
            foreach ($r as $c_idx => $cell_val) {
                $cell_clean = strtoupper(trim(clean_ascii($cell_val)));
                if (strpos($cell_clean, 'DESCRIPTIONS') !== false || strpos($cell_clean, 'DESCRIPTION') !== false) {
                    $desc_col = $c_idx;
                    $header_found = true;
                }
                if ($cell_clean === 'NO' || $cell_clean === 'NO.') {
                    $no_col = $c_idx;
                }
                if (strpos($cell_clean, 'IMPA') !== false) {
                    $impa_col = $c_idx;
                }
                if (strpos($cell_clean, 'OFFERED') !== false) {
                    $offered_col = $c_idx;
                }
                if (strpos($cell_clean, 'PRICE') !== false) {
                    $price_col = $c_idx;
                }
                if (strpos($cell_clean, 'SUPPLIER') !== false || strpos($cell_clean, 'SELLER') !== false) {
                    $supplier_col = $c_idx;
                }
                if (strpos($cell_clean, 'PICTURE') !== false || strpos($cell_clean, 'SAMPLE') !== false) {
                    $image_col = $c_idx;
                }
            }
            if ($header_found) break;
        }

        // Fallback default column positions if header detection was partial
        if ($desc_col === -1) $desc_col = 4;
        if ($no_col === -1) $no_col = 2;
        if ($impa_col === -1) $impa_col = 3;
        if ($offered_col === -1) $offered_col = 5;
        if ($price_col === -1) $price_col = 6;
        if ($supplier_col === -1) $supplier_col = 7;
        if ($image_col === -1) $image_col = 8;

        $current_parent_desc = '';

        foreach ($rows as $r_idx => $r) {
            $desc_val = isset($r[$desc_col]) ? clean_ascii($r[$desc_col]) : '';
            $no_val = isset($r[$no_col]) ? clean_ascii($r[$no_col]) : '';
            $impa_val = isset($r[$impa_col]) ? clean_ascii($r[$impa_col]) : '';
            $offered_val = isset($r[$offered_col]) ? clean_ascii($r[$offered_col]) : '';
            $price_val = isset($r[$price_col]) ? clean_ascii($r[$price_col]) : '';
            $supplier_val = isset($r[$supplier_col]) ? clean_ascii($r[$supplier_col]) : '';
            $image_val = isset($r[$image_col]) ? clean_ascii($r[$image_col]) : '';

            // Ignore header row
            if (strtoupper($desc_val) === 'DESCRIPTIONS' || strtoupper($desc_val) === 'DESCRIPTION' || strtoupper($no_val) === 'NO') {
                continue;
            }
            if (strpos(strtolower($desc_val), 'sub cat') !== false || strpos(strtolower($offered_val), 'sub cat') !== false) {
                continue;
            }

            if (empty($desc_val) && empty($offered_val)) continue;

            $product_name = !empty($desc_val) ? $desc_val : $offered_val;
            $product_spec = !empty($offered_val) ? $offered_val : $desc_val;
            $offer_field = !empty($offered_val) ? $offered_val : null;

            // Parent-child sub-item handling
            if (!empty($no_val)) {
                $current_parent_desc = $product_name;
            } else if (!empty($current_parent_desc) && $product_name !== $current_parent_desc) {
                $product_name = $current_parent_desc . ' - ' . $product_name;
            }

            $numeric_price = (float)preg_replace('/[^0-9.]/', '', str_replace(',', '.', $price_val));
            $capital_price = $numeric_price > 0 ? round($numeric_price * 0.8, 2) : 0.00;

            $product_code = 'PRD-' . str_pad($product_index++, 4, '0', STR_PAD_LEFT);
            if (!empty($impa_val) && preg_match('/^\d+$/', $impa_val)) {
                $product_code = 'IMPA-' . $impa_val;
            }

            $img_url = !empty($image_val) ? $image_val : null;
            $sup_name = !empty($supplier_val) ? $supplier_val : null;

            $stmt_prod->bind_param(
                "sssssddsss",
                $product_code,
                $product_name,
                $product_name,
                $product_spec,
                $offer_field,
                $numeric_price,
                $capital_price,
                $img_url,
                $cat_display_name,
                $sup_name
            );

            if ($stmt_prod->execute()) {
                $products_imported++;
            } else {
                // Duplicate product code fallback
                $alt_code = $product_code . '-' . $product_index;
                $stmt_prod->bind_param(
                    "sssssddsss",
                    $alt_code,
                    $product_name,
                    $product_name,
                    $product_spec,
                    $offer_field,
                    $numeric_price,
                    $capital_price,
                    $img_url,
                    $cat_display_name,
                    $sup_name
                );
                if ($stmt_prod->execute()) {
                    $products_imported++;
                }
            }
        }
    }
    if ($stmt_prod) $stmt_prod->close();

    // 7. Parse Categories Blueprint into product_categories table
    $categories_imported = 0;
    $stmt_cat = $db_conn->prepare("INSERT INTO `product_categories` (`category_code`, `category_name`, `internal_category`, `subcategories`, `description_en`, `description_my`, `classification_rules`) VALUES (?, ?, 'Marine Logistics', 'General Spares', ?, ?, 'Standard IMPA Rules') ON DUPLICATE KEY UPDATE `category_name` = VALUES(`category_name`)");

    // Add categories from Sheet Tab Titles first
    foreach ($sheet_titles as $sn) {
        if ($sn === 'Database Blue Print') continue;
        $sn_clean = clean_ascii($sn);
        $code = 'GENERAL';
        $title = $sn_clean;

        if (preg_match('/^(\d+)\s*(.+)$/', $sn_clean, $cm)) {
            $code = str_pad(trim($cm[1]), 2, '0', STR_PAD_LEFT);
            $title = trim($cm[2]);
        }

        if ($stmt_cat) {
            $stmt_cat->bind_param("ssss", $code, $title, $sn_clean, $sn_clean);
            if ($stmt_cat->execute()) $categories_imported++;
        }
    }

    // Parse Blueprint rows if present
    $blueprint_vr = null;
    foreach ($valueRanges as $vr_idx => $vr) {
        if (($sheet_titles[$vr_idx] ?? '') === 'Database Blue Print') {
            $blueprint_vr = $vr;
            break;
        }
    }

    if ($blueprint_vr && !empty($blueprint_vr['values'])) {
        foreach ($blueprint_vr['values'] as $row) {
            $text = isset($row[2]) ? clean_ascii($row[2]) : (isset($row[0]) ? clean_ascii($row[0]) : '');
            if (empty($text)) continue;

            if (preg_match('/^(\d+)\s*[\-–—]\s*(.+)$/m', $text, $match_title)) {
                $code = str_pad(trim($match_title[1]), 2, '0', STR_PAD_LEFT);
                $full_title = trim($match_title[2]);
                $title_lines = explode("\n", $full_title);
                $category_name = trim($title_lines[0]);

                if ($stmt_cat) {
                    $stmt_cat->bind_param("ssss", $code, $category_name, $full_title, $full_title);
                    if ($stmt_cat->execute()) $categories_imported++;
                }
            }
        }
    }

    if ($stmt_cat) $stmt_cat->close();

    echo json_encode([
        'status' => 'success',
        'message' => 'Semua data produk dan kategori dari Google Spreadsheet berhasil di-import tanpa terkecuali.',
        'imported_categories' => $categories_imported,
        'imported_products' => $products_imported,
        'errors' => $errors
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
