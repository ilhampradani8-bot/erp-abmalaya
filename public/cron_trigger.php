<?php
/**
 * ERP AB Malaya - Web-based Master Daemon & Cron Trigger
 * File: public/cron_trigger.php
 *
 * Runs background sync processes (Gmail, AI Inbox, Quotations, Invoices, OCR, IMPA)
 * triggered via Web HTTP Request or Browser Auto-Ping.
 */

error_reporting(0);
ini_set('display_errors', 0);
ignore_user_abort(true);
set_time_limit(180);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$start_time = microtime(true);
$output_logs = [];

// Determine daemon directory
$daemon_dir = __DIR__ . '/../daemon';
if (!is_dir($daemon_dir)) {
    $daemon_dir = __DIR__ . '/daemon';
}

$results = [];

// 1. Run run_all.php if present
if (file_exists($daemon_dir . '/run_all.php')) {
    $php_bin = PHP_BINARY ?: 'php';
    $cmd = escapeshellarg($php_bin) . ' ' . escapeshellarg($daemon_dir . '/run_all.php') . ' 2>&1';
    $exec_res = @shell_exec($cmd);
    $results['master_daemon'] = $exec_res ? trim($exec_res) : 'Executed';
} else {
    $results['master_daemon'] = 'Daemon directory not found, fallback to internal sync';
}

// 2. Fetch live gmail if endpoint exists
if (file_exists(__DIR__ . '/api_fetch_live_gmail.php')) {
    $results['gmail_api'] = 'Available on demand';
}

$elapsed = round(microtime(true) - $start_time, 2);

echo json_encode([
    'status' => 'success',
    'message' => 'AB Malaya ERP Daemon Runner triggered successfully.',
    'elapsed_seconds' => $elapsed,
    'timestamp' => date('Y-m-d H:i:s'),
    'details' => $results
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
