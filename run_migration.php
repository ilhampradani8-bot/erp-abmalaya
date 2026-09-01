<?php
require_once __DIR__ . '/public/db_connect.php';

$sqls = [
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS ocr_scan_status VARCHAR(20) DEFAULT 'pending' AFTER status",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS ocr_scan_result LONGTEXT DEFAULT NULL AFTER ocr_scan_status",
    "ALTER TABLE quotations ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT NULL AFTER ocr_scan_result"
];

foreach ($sqls as $sql) {
    if ($db_conn->query($sql)) {
        echo 'OK: ' . substr($sql, 0, 70) . PHP_EOL;
    } else {
        echo 'ERR: ' . $db_conn->error . PHP_EOL;
    }
}

// Also set existing rows to 'pending' where null
$db_conn->query("UPDATE quotations SET ocr_scan_status = 'pending' WHERE ocr_scan_status IS NULL OR ocr_scan_status = ''");
echo 'Migration complete.' . PHP_EOL;
