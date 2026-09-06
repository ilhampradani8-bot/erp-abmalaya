<?php
/**
 * ERP ABMALAYA — Automated Background Product Catalog Backup Engine to Google Sheets
 * File: daemon/backup_products_sheets.php
 */

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', 0);

if (!defined('DAEMON_MODE')) {
    define('DAEMON_MODE', true);
}

// 1. Helper: Base64Url Encode
function base64UrlEncode($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}

// 2. Helper: Generate Google Service Account JWT OAuth Token
function getGoogleServiceAccountToken($keyFilePath) {
    if (!file_exists($keyFilePath)) {
        throw new Exception("Key JSON file not found at: {$keyFilePath}");
    }
    $keyData = json_decode(file_get_contents($keyFilePath), true);
    if (!$keyData || empty($keyData['private_key']) || empty($keyData['client_email'])) {
        throw new Exception("Invalid key JSON structure in {$keyFilePath}");
    }

    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $now = time();
    $payload = json_encode([
        'iss' => $keyData['client_email'],
        'scope' => 'https://www.googleapis.com/auth/spreadsheets',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
    ]);

    $base64UrlHeader = base64UrlEncode($header);
    $base64UrlPayload = base64UrlEncode($payload);

    $signatureInput = $base64UrlHeader . '.' . $base64UrlPayload;
    $binarySignature = '';
    $success = openssl_sign($signatureInput, $binarySignature, $keyData['private_key'], 'SHA256');

    if (!$success) {
        throw new Exception("Failed to sign JWT with OpenSSL private key.");
    }

    $jwt = $signatureInput . '.' . base64UrlEncode($binarySignature);

    // Exchange JWT for Access Token
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resData = json_decode($response, true);
    if ($httpCode !== 200 || empty($resData['access_token'])) {
        $err = $resData['error_description'] ?? $resData['error'] ?? 'Unknown token exchange error';
        throw new Exception("OAuth Token Failed (HTTP {$httpCode}): {$err}");
    }

    return $resData['access_token'];
}

// Helper: Ensure Sheet Tab Exists or Fallback
function ensureSheetTabExists($accessToken, $spreadsheetId, $sheetName) {
    // Get Spreadsheet Metadata
    $metaUrl = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}?fields=sheets.properties.title";
    $ch = curl_init($metaUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Authorization: Bearer {$accessToken}"],
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $data = json_decode($res, true);
        $existingSheets = [];
        if (!empty($data['sheets'])) {
            foreach ($data['sheets'] as $s) {
                if (isset($s['properties']['title'])) {
                    $existingSheets[] = $s['properties']['title'];
                }
            }
        }

        // If target sheet already exists, return it
        if (in_array($sheetName, $existingSheets)) {
            return $sheetName;
        }

        // Try adding sheet tab
        $batchUrl = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}:batchUpdate";
        $body = json_encode([
            "requests" => [
                [
                    "addSheet" => [
                        "properties" => [
                            "title" => $sheetName
                        ]
                    ]
                ]
            ]
        ]);
        $ch2 = curl_init($batchUrl);
        curl_setopt_array($ch2, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$accessToken}",
                "Content-Type: application/json"
            ],
            CURLOPT_TIMEOUT => 15,
            CURLOPT_SSL_VERIFYPEER => false
        ]);
        $res2 = curl_exec($ch2);
        $code2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);

        if ($code2 === 200) {
            return $sheetName;
        }

        // If fail to add, fallback to first existing sheet
        if (!empty($existingSheets[0])) {
            return $existingSheets[0];
        }
    }

    return 'Sheet1';
}

// 3. Helper: Push Products to Google Sheet
function pushProductsToGoogleSheet($accessToken, $spreadsheetId, $sheetName, $products) {
    // Resolve valid sheet name
    $actualSheetName = ensureSheetTabExists($accessToken, $spreadsheetId, $sheetName);

    // A. Clear Sheet Content
    $range = urlencode($actualSheetName) . "!A1:Z5000";
    $clearUrl = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/{$range}:clear";
    
    $ch = curl_init($clearUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$accessToken}",
            "Content-Type: application/json"
        ],
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    curl_exec($ch);
    curl_close($ch);

    // B. Build Rows Data
    $rows = [];
    $rows[] = [
        "ID Database",
        "Kode Produk (IMPA/PRD)",
        "Nama Produk",
        "Spesifikasi Teknis",
        "Item Penawaran (Offer)",
        "Kategori",
        "Satuan",
        "Harga Modal (MYR)",
        "Harga Jual Master (MYR)",
        "Stok Tersedia",
        "Diskon (%)",
        "Status Record",
        "Waktu Synchronize"
    ];

    foreach ($products as $p) {
        $rows[] = [
            $p['id'] ?? '',
            $p['product_code'] ?? '',
            $p['product_name'] ?? '',
            $p['specification'] ?? $p['description'] ?? '',
            $p['offer'] ?? $p['offered_item'] ?? '',
            $p['category'] ?? '',
            $p['unit'] ?? 'Unit',
            (float)($p['capital_price'] ?? 0),
            (float)($p['unit_price'] ?? 0),
            (int)($p['stock_quantity'] ?? 0),
            (float)($p['discount_percent'] ?? 0),
            $p['status'] ?? 'active',
            date('Y-m-d H:i:s')
        ];
    }

    // C. Write Rows Data
    $updateUrl = "https://sheets.googleapis.com/v4/spreadsheets/{$spreadsheetId}/values/" . urlencode($actualSheetName) . "!A1?valueInputOption=USER_ENTERED";
    $body = json_encode([
        "range" => "{$actualSheetName}!A1",
        "majorDimension" => "ROWS",
        "values" => $rows
    ]);

    $ch = curl_init($updateUrl);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$accessToken}",
            "Content-Type: application/json"
        ],
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resData = json_decode($res, true);
    if ($httpCode !== 200) {
        $msg = $resData['error']['message'] ?? 'Sheet write failed';
        throw new Exception("Google Sheets Write Error (HTTP {$httpCode}): {$msg}");
    }

    return count($products);
}

// 4. Main Daemon Backup Logic
function runProductSpreadsheetBackup($force = false, $targetId = null) {
    $dbHost = '127.0.0.1';
    $dbUser = 'root';
    $dbPass = 'root';
    $dbName = 'abmalaya_erp';

    try {
        $pdo = new PDO("mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);

        // Find targets
        $sql = "SELECT * FROM spreadsheet_backups WHERE 1=1";
        if ($targetId) {
            $sql .= " AND id = " . (int)$targetId;
        } elseif (!$force) {
            $sql .= " AND is_auto_backup = 1";
        }
        $targets = $pdo->query($sql)->fetchAll();

        if (empty($targets)) {
            return ['status' => 'info', 'message' => 'No active backup targets due for backup.'];
        }

        // Fetch active products
        $products = $pdo->query("SELECT * FROM products WHERE status = 'active' OR status IS NULL ORDER BY id ASC")->fetchAll();

        $results = [];

        foreach ($targets as $target) {
            // Check interval if not forced
            if (!$force && !empty($target['last_backup_at'])) {
                $lastTime = strtotime($target['last_backup_at']);
                $intervalSec = ($target['backup_interval_minutes'] ?? 60) * 60;
                if ((time() - $lastTime) < $intervalSec) {
                    continue; // Skip if interval not reached
                }
            }

            // Find JSON Key File
            $keyFileName = $target['key_filename'] ?: 'erp-abmalaya-connect-0fc0c4cb6314.json';
            $keyPath = __DIR__ . '/../' . $keyFileName;
            if (!file_exists($keyPath)) {
                $keyPath = __DIR__ . '/' . $keyFileName;
            }

            try {
                $token = getGoogleServiceAccountToken($keyPath);
                $count = pushProductsToGoogleSheet(
                    $token,
                    $target['spreadsheet_id'],
                    $target['sheet_name'] ?: 'Master_Products',
                    $products
                );

                // Update success
                $stmt = $pdo->prepare("UPDATE spreadsheet_backups SET last_backup_at = NOW(), last_status = 'success', last_error_message = NULL, total_rows_backed_up = ? WHERE id = ?");
                $stmt->execute([$count, $target['id']]);

                // Notification
                $notif = "Backup Otomatis Master Produk (" . count($products) . " item) ke Google Sheets '{$target['title']}' BERHASIL.";
                $pdo->exec("INSERT INTO system_notifications (title, message, category, is_read) VALUES ('Cloud Backup Success', " . $pdo->quote($notif) . ", 'spreadsheet', 0)");

                $results[] = [
                    'id' => $target['id'],
                    'title' => $target['title'],
                    'status' => 'success',
                    'count' => $count
                ];
                echo "[" . date('Y-m-d H:i:s') . "] Backup SUCCESS to '{$target['title']}' ({$count} rows)\n";

            } catch (Exception $e) {
                $errMsg = $e->getMessage();
                $stmt = $pdo->prepare("UPDATE spreadsheet_backups SET last_status = 'failed', last_error_message = ? WHERE id = ?");
                $stmt->execute([$errMsg, $target['id']]);

                $notif = "Backup Master Produk ke Google Sheets '{$target['title']}' GAGAL: {$errMsg}";
                $pdo->exec("INSERT INTO system_notifications (title, message, category, is_read) VALUES ('Cloud Backup Error', " . $pdo->quote($notif) . ", 'spreadsheet', 0)");

                $results[] = [
                    'id' => $target['id'],
                    'title' => $target['title'],
                    'status' => 'failed',
                    'error' => $errMsg
                ];
                echo "[" . date('Y-m-d H:i:s') . "] Backup FAILED for '{$target['title']}': {$errMsg}\n";
            }
        }

        return ['status' => 'success', 'results' => $results];

    } catch (Exception $ex) {
        echo "[" . date('Y-m-d H:i:s') . "] Backup Engine PDO Error: " . $ex->getMessage() . "\n";
        return ['status' => 'error', 'message' => $ex->getMessage()];
    }
}

// Execute if run directly via CLI
if (php_sapi_name() === 'cli' && basename(__FILE__) == basename($_SERVER['PHP_SELF'] ?? '')) {
    echo "[" . date('Y-m-d H:i:s') . "] Running Automated Product Google Sheets Backup Daemon Engine...\n";
    $forceRun = isset($argv[1]) && ($argv[1] === '--force' || $argv[1] === '-f');
    $targetIdArg = isset($argv[2]) ? (int)$argv[2] : null;
    runProductSpreadsheetBackup($forceRun, $targetIdArg);
}
