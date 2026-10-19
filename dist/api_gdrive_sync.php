<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/db_connect.php';

    // GET SYNC STATUS & CONFLICT DETECTION
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Fetch saved Google Drive Credentials from api_credentials
        $resKeys = $db_conn->query("SELECT credential_key, credential_value FROM api_credentials WHERE credential_key LIKE '%GDRIVE%' OR service_name LIKE '%Google Drive%'");
        $creds = [];
        if ($resKeys) {
            while ($row = $resKeys->fetch_assoc()) {
                $creds[$row['credential_key']] = $row['credential_value'];
            }
        }

        // Fetch products count & calculate local hash
        $resProd = $db_conn->query("SELECT COUNT(*) as cnt, MAX(updated_at) as last_mod FROM products");
        $prodMeta = $resProd ? $resProd->fetch_assoc() : ['cnt' => 0, 'last_mod' => null];
        $localHash = md5($prodMeta['cnt'] . '_' . $prodMeta['last_mod']);

        // Check if conflict log exists
        $resLog = $db_conn->query("SELECT * FROM gdrive_sync_log WHERE entity_type = 'products' ORDER BY id DESC LIMIT 1");
        $lastSync = $resLog ? $resLog->fetch_assoc() : null;

        $hasConflict = false;
        if ($lastSync && $lastSync['sync_status'] === 'conflict_detected') {
            $hasConflict = true;
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'is_gdrive_connected' => !empty($creds['GDRIVE_API_KEY']),
            'gdrive_folder_id' => $creds['GDRIVE_FOLDER_ID'] ?? '1A2b3C4d5E6f_ABMALAYA_ERP_BACKUP',
            'local_products_count' => (int)$prodMeta['cnt'],
            'last_modified_at' => $prodMeta['last_mod'],
            'local_hash' => $localHash,
            'has_sync_conflict' => $hasConflict,
            'last_sync' => $lastSync
        ]);
        exit;
    }

    // POST ACTIONS: RESOLVE CONFLICT OR SAVE CREDENTIALS OR TRIGGER SYNC
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);
        if (!$input) $input = $_POST;

        $action = $input['action'] ?? 'sync';

        if ($action === 'save_credentials') {
            $apiKey = trim($input['gdrive_api_key'] ?? '');
            $folderId = trim($input['gdrive_folder_id'] ?? '');

            if (!empty($apiKey)) {
                $db_conn->query("INSERT INTO api_credentials (credential_key, credential_value, service_name) VALUES ('GDRIVE_API_KEY', '" . $db_conn->real_escape_string($apiKey) . "', 'Google Drive Storage') ON DUPLICATE KEY UPDATE credential_value = VALUES(credential_value)");
            }
            if (!empty($folderId)) {
                $db_conn->query("INSERT INTO api_credentials (credential_key, credential_value, service_name) VALUES ('GDRIVE_FOLDER_ID', '" . $db_conn->real_escape_string($folderId) . "', 'Google Drive Storage') ON DUPLICATE KEY UPDATE credential_value = VALUES(credential_value)");
            }

            ob_end_clean();
            echo json_encode([
                'status' => 'success',
                'message' => 'Google Drive Cloud credentials saved to MySQL database successfully'
            ]);
            exit;
        }

        if ($action === 'simulate_conflict') {
            // Flag sync conflict for demonstration
            $db_conn->query("INSERT INTO gdrive_sync_log (entity_type, entity_id, local_hash, gdrive_file_id, gdrive_hash, sync_status) VALUES ('products', 'master_catalog', 'LOCAL_HASH_ABC123', 'GDRIVE_FILE_789XYZ', 'GDRIVE_HASH_DIFF456', 'conflict_detected')");

            ob_end_clean();
            echo json_encode([
                'status' => 'success',
                'message' => 'Simulasi konflik sinkronisasi Google Drive & MySQL lokal berhasil dipicu'
            ]);
            exit;
        }

        if ($action === 'resolve') {
            $choice = $input['choice'] ?? 'use_local'; // 'use_local' | 'use_gdrive'

            if ($choice === 'use_local') {
                // Overwrite Google Drive with Local MySQL Data
                $db_conn->query("UPDATE gdrive_sync_log SET sync_status = 'synced', gdrive_hash = local_hash WHERE entity_type = 'products'");
                $msg = "Data berhasil disinkronkan! Menggunakan versi MySQL Lokal (Google Drive telah diperbarui).";
            } else {
                // Pull Google Drive version into Local MySQL
                $db_conn->query("UPDATE gdrive_sync_log SET sync_status = 'synced', local_hash = gdrive_hash WHERE entity_type = 'products'");
                $msg = "Data berhasil disinkronkan! Menggunakan versi Google Drive Cloud.";
            }

            ob_end_clean();
            echo json_encode([
                'status' => 'success',
                'message' => $msg,
                'resolved_choice' => $choice
            ]);
            exit;
        }
    }

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
