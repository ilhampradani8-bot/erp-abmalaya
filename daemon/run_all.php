<?php
/**
 * ABM Malaya ERP — Master Daemon Runner
 * daemon/run_all.php
 *
 * USAGE:
 *   php daemon/run_all.php
 *
 * Runs both: gmail sync (fallback) + AI scan in sequence.
 * Useful for manual testing or initial full rescan.
 */

define('DAEMON_MODE', true);
define('LOG_FILE', __DIR__ . '/logs/run_all_' . date('Y-m-d') . '.log');

function daemon_log(string $msg): void {
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

daemon_log('=== ABM Malaya ERP Daemon — run_all.php ===');

$php = PHP_BINARY ? PHP_BINARY : 'php';
$base = __DIR__;

// Step 1: Sync new emails from Gmail IMAP
daemon_log('[1/3] Running Gmail Sync...');
$sync_out = shell_exec(escapeshellarg($php) . ' ' . escapeshellarg($base . '/sync_gmail.php') . ' 2>&1');
daemon_log($sync_out ?? 'No output from sync_gmail.php');

// Step 2: Run AI Inbox classification on pending emails
daemon_log('[2/3] Running AI Inbox Scan...');
$scan_inbox_out = shell_exec(escapeshellarg($php) . ' ' . escapeshellarg($base . '/scan_inbox.php') . ' 2>&1');
daemon_log($scan_inbox_out ?? 'No output from scan_inbox.php');

// Step 3: Run AI Vision OCR on pending attachments
daemon_log('[3/5] Running AI Vision OCR Scan...');
$scan_ocr_out = shell_exec(escapeshellarg($php) . ' ' . escapeshellarg($base . '/scan_ocr.php') . ' 2>&1');
daemon_log($scan_ocr_out ?? 'No output from scan_ocr.php');

// Step 4: Run Dedicated IMPA Category Text Matching
daemon_log('[4/5] Running IMPA Category Text Matching Daemon...');
$match_impa_out = shell_exec(escapeshellarg($php) . ' ' . escapeshellarg($base . '/matching_text_impa.php') . ' 2>&1');
daemon_log($match_impa_out ?? 'No output from matching_text_impa.php');

// Step 5: Run Dedicated Product Text Matching (attaches existing product codes without creating duplicates)
daemon_log('[5/5] Running Product Text Matching Daemon...');
$match_prod_out = shell_exec(escapeshellarg($php) . ' ' . escapeshellarg($base . '/matching_text_product.php') . ' 2>&1');
daemon_log($match_prod_out ?? 'No output from matching_text_product.php');

daemon_log('=== Done ===');
exit(0);

