<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$spreadsheet_id = '1PHMV-f5fEZzdzCHXXMZFn2laEIRnOWrDoH9ZJcxi1UQ';

try {
    require_once __DIR__ . '/db_connect.php';

    // OAuth2 Token Helper
    if (!function_exists('getGoogleOAuthToken')) {
        function getGoogleOAuthToken() {
            $json_file = __DIR__ . '/erp-abmalaya-connect-0fc0c4cb6314.json';
            if (!file_exists($json_file)) {
                $json_file = __DIR__ . '/../erp-abmalaya-connect-0fc0c4cb6314.json';
            }
            if (!file_exists($json_file)) {
                throw new Exception("Service Account JSON key file not found.");
            }
            $creds = json_decode(file_get_contents($json_file), true);
            if (!$creds || empty($creds['private_key']) || empty($creds['client_email'])) {
                throw new Exception("Invalid Service Account JSON key format.");
            }

            $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
            $now = time();
            $claim = json_encode([
                'iss' => $creds['client_email'],
                'scope' => 'https://www.googleapis.com/auth/spreadsheets',
                'aud' => $creds['token_uri'],
                'exp' => $now + 3600,
                'iat' => $now
            ]);

            $b64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
            $b64Claim = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($claim));
            $jwt_input = $b64Header . '.' . $b64Claim;
            $signature = '';
            if (!openssl_sign($jwt_input, $signature, $creds['private_key'], 'SHA256')) {
                throw new Exception("OpenSSL JWT signing failed.");
            }
            $jwt = $jwt_input . '.' . str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $creds['token_uri']);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt
            ]));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $token_res = curl_exec($ch);
            curl_close($ch);

            $token_data = json_decode($token_res, true);
            $token = $token_data['access_token'] ?? '';
            if (empty($token)) {
                throw new Exception("Failed to obtain Google OAuth2 Access Token.");
            }
            return $token;
        }
    }

    $action = isset($_GET['action']) ? trim($_GET['action']) : (isset($_POST['action']) ? trim($_POST['action']) : 'status');

    // 1. STATUS & SYNC LOGS
    if ($action === 'status' || $action === 'get_sync_logs') {
        // Fetch recent sync logs from system_notifications table
        $logs = [];
        $res = $db_conn->query("SELECT * FROM system_notifications WHERE category IN ('sync', 'spreadsheet', 'products') ORDER BY id DESC LIMIT 50");
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $logs[] = $row;
            }
        }

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'spreadsheet_id' => $spreadsheet_id,
            'spreadsheet_url' => "https://docs.google.com/spreadsheets/d/{$spreadsheet_id}/edit",
            'last_sync_at' => date('Y-m-d H:i:s'),
            'sync_logs' => $logs
        ]);
        exit;
    }

    // 1B. GET MULTI SPREADSHEET BACKUPS LIST
    if ($action === 'get_backups') {
        $backups = [];
        $res = $db_conn->query("SELECT * FROM spreadsheet_backups ORDER BY is_primary DESC, id ASC");
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $backups[] = $row;
            }
        }
        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'backups' => $backups
        ]);
        exit;
    }

    // 1C. ADD / EDIT BACKUP TARGET
    if ($action === 'add_backup' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_POST;

        $title = trim($input['title'] ?? 'Spreadsheet Backup');
        $sp_id = trim($input['spreadsheet_id'] ?? '');
        $sheet_name = trim($input['sheet_name'] ?? 'Sheet1');
        $sa_email = trim($input['service_account_email'] ?? 'erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com');
        $key_file = trim($input['key_filename'] ?? 'erp-abmalaya-connect-0fc0c4cb6314.json');
        $is_primary = !empty($input['is_primary']) ? 1 : 0;

        if (empty($sp_id)) {
            throw new Exception("Spreadsheet Link or ID is required.");
        }

        // Clean link if URL provided
        if (strpos($sp_id, 'spreadsheets/d/') !== false) {
            preg_match('/spreadsheets\/d\/([a-zA-Z0-9-_]+)/', $sp_id, $matches);
            if (!empty($matches[1])) {
                $sp_id = $matches[1];
            }
        }

        if ($is_primary === 1) {
            $db_conn->query("UPDATE spreadsheet_backups SET is_primary = 0");
        }

        $stmt = $db_conn->prepare("INSERT INTO spreadsheet_backups (title, spreadsheet_id, sheet_name, service_account_email, key_filename, is_primary) VALUES (?, ?, ?, ?, ?, ?)");
        if ($stmt) {
            $stmt->bind_param("sssssi", $title, $sp_id, $sheet_name, $sa_email, $key_file, $is_primary);
            $stmt->execute();
        }

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'message' => 'File backup spreadsheet berhasil ditambahkan!'
        ]);
        exit;
    }

    // 1D. DELETE BACKUP TARGET
    if ($action === 'delete_backup') {
        $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id > 0) {
            $db_conn->query("DELETE FROM spreadsheet_backups WHERE id = {$id} AND is_primary = 0");
        }
        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'message' => 'Backup target removed.'
        ]);
        exit;
    }

    // 1E. SET PRIMARY BACKUP
    if ($action === 'set_primary') {
        $id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id > 0) {
            $db_conn->query("UPDATE spreadsheet_backups SET is_primary = 0");
            $db_conn->query("UPDATE spreadsheet_backups SET is_primary = 1 WHERE id = {$id}");
        }
        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'message' => 'Primary backup updated.'
        ]);
        exit;
    }

    // 1F. TEST CONNECTION TO GOOGLE SHEETS API
    if ($action === 'test_connection') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_REQUEST;
        $sp_id = trim($input['spreadsheet_id'] ?? '');

        if (empty($sp_id)) {
            $id = (int)($input['id'] ?? $_GET['id'] ?? $_POST['id'] ?? 0);
            if ($id > 0) {
                $r = $db_conn->query("SELECT spreadsheet_id FROM spreadsheet_backups WHERE id = {$id}");
                if ($r && $row = $r->fetch_assoc()) {
                    $sp_id = $row['spreadsheet_id'];
                }
            }
        }

        if (empty($sp_id)) {
            throw new Exception("Spreadsheet Link or ID is missing for test connection.");
        }

        if (strpos($sp_id, 'spreadsheets/d/') !== false) {
            preg_match('/spreadsheets\/d\/([a-zA-Z0-9-_]+)/', $sp_id, $matches);
            if (!empty($matches[1])) {
                $sp_id = $matches[1];
            }
        }

        $token = getGoogleOAuthToken();
        $metaUrl = "https://sheets.googleapis.com/v4/spreadsheets/{$sp_id}?fields=properties.title,sheets.properties.title";
        
        $ch = curl_init($metaUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ["Authorization: Bearer {$token}"],
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $resData = json_decode($res, true);

        if ($httpCode !== 200) {
            $err = $resData['error']['message'] ?? 'Failed to access Google Sheet.';
            ob_end_clean();
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'status' => 'error',
                'message' => "Koneksi Gagal (HTTP {$httpCode}): {$err}. Pastikan file di-share ke erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com"
            ]);
            exit;
        }

        $docTitle = $resData['properties']['title'] ?? 'Google Sheet Document';
        $sheetsList = [];
        if (!empty($resData['sheets'])) {
            foreach ($resData['sheets'] as $s) {
                if (isset($s['properties']['title'])) {
                    $sheetsList[] = $s['properties']['title'];
                }
            }
        }

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'message' => "Koneksi Terverifikasi & Safe! Terhubung ke file: '{$docTitle}'",
            'document_title' => $docTitle,
            'service_account' => 'erp-abmalaya@erp-abmalaya-connect.iam.gserviceaccount.com',
            'sheets' => $sheetsList
        ]);
        exit;
    }

    // 1G. RUN BACKUP NOW (MANUAL TRIGGER)
    if ($action === 'run_backup_now') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: $_REQUEST;
        $targetId = (int)($input['id'] ?? 0);

        require_once __DIR__ . '/../daemon/backup_products_sheets.php';
        $res = runProductSpreadsheetBackup(true, $targetId > 0 ? $targetId : null);

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($res);
        exit;
    }



    // 2. MANUAL LIVE SYNC TRIGGER (Pushes 100% Real MySQL Data to Google Sheet)
    if ($action === 'manual_sync') {
        $access_token = getGoogleOAuthToken();

        $rows = [];
        $rows[] = ["Product Code", "Product Name", "Category", "Specification", "Supplier Name", "Unit", "Unit Price (MYR)", "Capital Cost (MYR)", "Stock Quantity", "Discount (%)", "Image URL"];

        $res = $db_conn->query("SELECT * FROM products WHERE status = 'active' ORDER BY id ASC");
        $total = 0;
        if ($res && $res->num_rows > 0) {
            while ($r = $res->fetch_assoc()) {
                $total++;
                $rows[] = [
                    (string)$r['product_code'],
                    (string)$r['product_name'],
                    (string)$r['category'],
                    (string)($r['specification'] ?: $r['description']),
                    (string)$r['supplier_name'],
                    (string)$r['unit'],
                    (float)$r['unit_price'],
                    (float)($r['capital'] ?? 0),
                    (int)$r['stock_quantity'],
                    (float)$r['discount_percent'],
                    (string)$r['image_url']
                ];
            }
        }

        $update_url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheet_id}/values/Sheet1!A1:K" . count($rows) . "?valueInputOption=USER_ENTERED";
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $update_url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            "range" => "Sheet1!A1:K" . count($rows),
            "majorDimension" => "ROWS",
            "values" => $rows
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer $access_token",
            "Content-Type: application/json"
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $up_res = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code !== 200) {
            throw new Exception("Google Sheets API Update Error (HTTP $http_code): $up_res");
        }

        // Record notification log in system_notifications
        $title = "Live Google Sheet Sync Executed";
        $msg = "Pushed {$total} active product records directly to Google Sheet (ID: {$spreadsheet_id}).";
        $stmt = $db_conn->prepare("INSERT INTO system_notifications (title, message, type, category) VALUES (?, ?, 'success', 'spreadsheet')");
        if ($stmt) {
            $stmt->bind_param("ss", $title, $msg);
            $stmt->execute();
        }

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'message' => "Live Google Sheet sync successfully pushed {$total} product records!",
            'synced_count' => $total,
            'spreadsheet_url' => "https://docs.google.com/spreadsheets/d/{$spreadsheet_id}/edit"
        ]);
        exit;
    }

    // 3. CHECK REAL CONFLICTS (100% Real Live Comparison Between MySQL & Google Sheet)
    if ($action === 'check_conflicts') {
        $access_token = getGoogleOAuthToken();

        // Fetch live rows from Google Sheet
        $values_url = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheet_id}/values/Sheet1!A1:K2000";
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $values_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $access_token"]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        $val_res = curl_exec($ch);
        curl_close($ch);

        $val_data = json_decode($val_res, true);
        $cloud_rows = $val_data['values'] ?? [];

        // Build cloud map by Product Code (Col A = index 0)
        $cloud_map = [];
        if (count($cloud_rows) > 1) {
            for ($i = 1; $i < count($cloud_rows); $i++) {
                $row = $cloud_rows[$i];
                $code = trim($row[0] ?? '');
                if (!empty($code)) {
                    $cloud_map[$code] = [
                        'code' => $code,
                        'name' => trim($row[1] ?? ''),
                        'category' => trim($row[2] ?? ''),
                        'spec' => trim($row[3] ?? ''),
                        'supplier' => trim($row[4] ?? ''),
                        'unit' => trim($row[5] ?? ''),
                        'unit_price' => (float)($row[6] ?? 0),
                        'capital' => (float)($row[7] ?? 0),
                        'stock_quantity' => (int)($row[8] ?? 0),
                        'discount_percent' => (float)($row[9] ?? 0)
                    ];
                }
            }
        }

        $conflicts = [];
        $res = $db_conn->query("SELECT * FROM products WHERE status = 'active' ORDER BY id ASC");
        if ($res && $res->num_rows > 0) {
            while ($p = $res->fetch_assoc()) {
                $code = $p['product_code'];
                if (!isset($cloud_map[$code])) {
                    $conflicts[] = [
                        'product_code' => $code,
                        'product_name' => $p['product_name'],
                        'field' => 'Status Record',
                        'local_val' => 'Ada di MySQL',
                        'cloud_val' => 'Belum ada di Sheet (Belum di-Sync)',
                        'status' => 'Data Belum Di-Sync ke Cloud'
                    ];
                } else {
                    $c = $cloud_map[$code];
                    
                    // Compare Stock Quantity
                    if ((int)$p['stock_quantity'] !== (int)$c['stock_quantity']) {
                        $conflicts[] = [
                            'product_code' => $code,
                            'product_name' => $p['product_name'],
                            'field' => 'Stock Quantity',
                            'local_val' => $p['stock_quantity'] . ' ' . $p['unit'],
                            'cloud_val' => $c['stock_quantity'] . ' ' . $c['unit'],
                            'status' => 'Perbedaan Stok Nyata'
                        ];
                    }

                    // Compare Unit Price
                    if (abs((float)$p['unit_price'] - (float)$c['unit_price']) > 0.01) {
                        $conflicts[] = [
                            'product_code' => $code,
                            'product_name' => $p['product_name'],
                            'field' => 'Unit Price (MYR)',
                            'local_val' => 'RM ' . number_format((float)$p['unit_price'], 2),
                            'cloud_val' => 'RM ' . number_format((float)$c['unit_price'], 2),
                            'status' => 'Perbedaan Harga Master'
                        ];
                    }

                    // Compare Capital Cost
                    if (abs((float)($p['capital'] ?? 0) - (float)$c['capital']) > 0.01) {
                        $conflicts[] = [
                            'product_code' => $code,
                            'product_name' => $p['product_name'],
                            'field' => 'Capital Cost (MYR)',
                            'local_val' => 'RM ' . number_format((float)($p['capital'] ?? 0), 2),
                            'cloud_val' => 'RM ' . number_format((float)$c['capital'], 2),
                            'status' => 'Perbedaan Modal Produk'
                        ];
                    }
                }
            }
        }

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'has_conflicts' => count($conflicts) > 0,
            'conflict_count' => count($conflicts),
            'conflicts' => $conflicts
        ]);
        exit;
    }

    // 4. DOWNLOAD FILTERED CSV / TEMPLATE
    if ($action === 'download_csv') {
        $category = isset($_GET['category']) ? trim($_GET['category']) : 'all';
        $search = isset($_GET['q']) ? trim($_GET['q']) : '';
        $is_template = isset($_GET['template']) ? (int)$_GET['template'] : 0;

        ob_end_clean();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="products_export_' . date('Y-m-d') . '.csv"');

        $output = fopen('php://output', 'w');
        // Write CSV Header Row
        fputcsv($output, ['Product Code', 'Product Name', 'Category', 'Specification', 'Supplier Name', 'Unit', 'Unit Price (MYR)', 'Capital Cost (MYR)', 'Stock Quantity', 'Discount (%)', 'Image URL']);

        if ($is_template === 1) {
            // Sample template row
            fputcsv($output, ['PRD-SAMPLE-01', 'Sample High Pressure Hose 350 BAR', 'Hose & Fitting', 'SS316 Ends 2 Inch', 'ABM Industrial Supplies', 'Package', 4500.00, 3200.00, 50, 0, 'https://via.placeholder.com/150']);
        } else {
            $sql = "SELECT * FROM products WHERE status = 'active'";
            if ($category !== 'all' && !empty($category)) {
                $sql .= " AND category = '" . $db_conn->real_escape_string($category) . "'";
            }
            if (!empty($search)) {
                $q = $db_conn->real_escape_string($search);
                $sql .= " AND (product_name LIKE '%{$q}%' OR product_code LIKE '%{$q}%' OR description LIKE '%{$q}%')";
            }
            $sql .= " ORDER BY id DESC";

            $res = $db_conn->query($sql);
            if ($res && $res->num_rows > 0) {
                while ($row = $res->fetch_assoc()) {
                    fputcsv($output, [
                        $row['product_code'],
                        $row['product_name'],
                        $row['category'],
                        $row['specification'] ?: $row['description'],
                        $row['supplier_name'],
                        $row['unit'],
                        $row['unit_price'],
                        $row['capital'] ?? 0.00,
                        $row['stock_quantity'],
                        $row['discount_percent'],
                        $row['image_url']
                    ]);
                }
            }
        }

        fclose($output);
        exit;
    }

    // 5. UPLOAD CSV FILE
    if ($action === 'upload_csv' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
            throw new Exception("Please upload a valid CSV file.");
        }

        $handle = fopen($_FILES['csv_file']['tmp_name'], 'r');
        if (!$handle) throw new Exception("Failed to open uploaded CSV file.");

        $header = fgetcsv($handle);
        $imported_count = 0;

        while (($data = fgetcsv($handle)) !== false) {
            if (count($data) >= 2 && !empty($data[1])) {
                $code = trim($data[0]) ?: 'PRD-' . rand(1000, 9999);
                $name = trim($data[1]);
                $cat = isset($data[2]) ? trim($data[2]) : 'Equipment';
                $spec = isset($data[3]) ? trim($data[3]) : '';
                $supp = isset($data[4]) ? trim($data[4]) : '';
                $unit = isset($data[5]) ? trim($data[5]) : 'Unit';
                $price = isset($data[6]) ? (float)$data[6] : 0.00;
                $capital = isset($data[7]) ? (float)$data[7] : 0.00;
                $stock = isset($data[8]) ? (int)$data[8] : 50;
                $disc = isset($data[9]) ? (float)$data[9] : 0.00;
                $img = isset($data[10]) ? trim($data[10]) : '';

                $stmt = $db_conn->prepare("INSERT INTO products (product_code, product_name, category, specification, supplier_name, unit, unit_price, capital, stock_quantity, discount_percent, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active') ON DUPLICATE KEY UPDATE product_name=VALUES(product_name), category=VALUES(category), specification=VALUES(specification), supplier_name=VALUES(supplier_name), unit=VALUES(unit), unit_price=VALUES(unit_price), capital=VALUES(capital), stock_quantity=VALUES(stock_quantity), discount_percent=VALUES(discount_percent), image_url=VALUES(image_url)");
                if ($stmt) {
                    $stmt->bind_param("ssssssddids", $code, $name, $cat, $spec, $supp, $unit, $price, $capital, $stock, $disc, $img);
                    $stmt->execute();
                    $imported_count++;
                }
            }
        }
        fclose($handle);

        ob_end_clean();
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'success',
            'message' => "Successfully imported {$imported_count} product records from CSV!",
            'imported_count' => $imported_count
        ]);
        exit;
    }

} catch (Exception $e) {
    ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
