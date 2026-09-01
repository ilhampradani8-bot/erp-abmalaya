<?php
// Script to apply database migration to remote live DB
error_reporting(E_ALL);
ini_set('display_errors', 1);

$host = '110.4.45.199';
$user = 'abmalaya_erpuser';
$pass = 'abmalaya2021';
$db   = 'abmalaya_abmalaya_erp';

echo "Connecting to remote database at $host...\n";
$conn = @mysqli_connect($host, $user, $pass, $db);
if (!$conn) {
    die("CONNECTION FAILED: " . mysqli_connect_error() . "\n(Note: cPanel servers usually block remote MySQL connections on port 3306 unless your IP is whitelisted in remote database access settings).\n");
}

echo "Successfully connected to remote database!\n";

// 1. Check if 'ai_error' column exists in rfq_requests
$result = mysqli_query($conn, "SHOW COLUMNS FROM rfq_requests LIKE 'ai_error'");
if (mysqli_num_rows($result) == 0) {
    echo "Column 'ai_error' is missing in rfq_requests table. Adding it now...\n";
    $alter = mysqli_query($conn, "ALTER TABLE rfq_requests ADD COLUMN ai_error TEXT DEFAULT NULL AFTER ai_classification");
    if ($alter) {
        echo "SUCCESS: Column 'ai_error' successfully added to remote DB!\n";
    } else {
        echo "FAILED to add column: " . mysqli_error($conn) . "\n";
    }
} else {
    echo "Column 'ai_error' already exists in remote DB.\n";
}

mysqli_close($conn);
echo "Database check completed.\n";
