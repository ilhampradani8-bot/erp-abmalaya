<?php
/**
 * ABM Malaya ERP — AI Scanner Daemon Wrapper
 * daemon/scan_ai.php
 *
 * USAGE (CLI):
 *   php daemon/scan_ai.php
 *
 * Runs both daemon/scan_inbox.php and daemon/scan_ocr.php in sequence.
 * Serves as a backward-compatible wrapper for cron jobs and webhook integrations.
 */

define('DAEMON_MODE', true);
define('LOG_FILE', __DIR__ . '/logs/scan_ai_wrapper_' . date('Y-m-d') . '.log');

function wrapper_log(string $msg): void {
    $line = '[' . date('Y-m-d H:i:s') . '] [WRAPPER] ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

wrapper_log('AI Scan Wrapper started.');

// Execute scan_inbox.php
wrapper_log('Starting Inbox classification...');
require_once __DIR__ . '/scan_inbox.php';

// Execute scan_ocr.php
wrapper_log('Starting OCR scanning...');
require_once __DIR__ . '/scan_ocr.php';

wrapper_log('AI Scan Wrapper complete.');
