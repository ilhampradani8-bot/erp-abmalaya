<?php
// Quick db migration script for live server
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Connect to cPanel local DB
$conn = @mysqli_connect('localhost', 'abmalaya_erpuser', 'abmalaya2021', 'abmalaya_abmalaya_erp');
if (!$conn) {
    $conn = @mysqli_connect('127.0.0.1', 'abmalaya_erpuser', 'abmalaya2021', 'abmalaya_abmalaya_erp');
}

if (!$conn) {
    die("Database connection failed on server: " . mysqli_connect_error());
}

// 1. Add ai_verified if missing
$check = mysqli_query($conn, "SHOW COLUMNS FROM rfq_requests LIKE 'ai_verified'");
if (mysqli_num_rows($check) == 0) {
    $alter = mysqli_query($conn, "ALTER TABLE rfq_requests ADD COLUMN ai_verified TINYINT(1) DEFAULT 0 AFTER status");
    if ($alter) {
        echo "SUCCESS: Column 'ai_verified' added.<br>";
    } else {
        echo "ERROR adding 'ai_verified': " . mysqli_error($conn) . "<br>";
    }
} else {
    echo "SUCCESS: Column 'ai_verified' already exists.<br>";
}

// 2. Add ai_classification if missing
$check = mysqli_query($conn, "SHOW COLUMNS FROM rfq_requests LIKE 'ai_classification'");
if (mysqli_num_rows($check) == 0) {
    $alter = mysqli_query($conn, "ALTER TABLE rfq_requests ADD COLUMN ai_classification VARCHAR(50) DEFAULT NULL AFTER ai_verified");
    if ($alter) {
        echo "SUCCESS: Column 'ai_classification' added.<br>";
    } else {
        echo "ERROR adding 'ai_classification': " . mysqli_error($conn) . "<br>";
    }
} else {
    echo "SUCCESS: Column 'ai_classification' already exists.<br>";
}

// 3. Add ai_error if missing
$check = mysqli_query($conn, "SHOW COLUMNS FROM rfq_requests LIKE 'ai_error'");
if (mysqli_num_rows($check) == 0) {
    $alter = mysqli_query($conn, "ALTER TABLE rfq_requests ADD COLUMN ai_error TEXT DEFAULT NULL AFTER ai_classification");
    if ($alter) {
        echo "SUCCESS: Column 'ai_error' added.<br>";
    } else {
        echo "ERROR adding 'ai_error': " . mysqli_error($conn) . "<br>";
    }
} else {
    echo "SUCCESS: Column 'ai_error' already exists.<br>";
}

mysqli_close($conn);

// Self-destruct for safety
@unlink(__FILE__);
echo "Security Clean: migrate.php has been successfully self-deleted from the server.";
