<?php
/**
 * ABM Malaya ERP — Gmail IMAP Sync Daemon (CLI Fallback)
 * daemon/sync_gmail.php
 *
 * USAGE:
 *   php daemon/sync_gmail.php
 *
 * Pulls new emails from Gmail IMAP and saves them to MySQL.
 * This is a CLI-safe version of api_fetch_live_gmail.php?sync=1
 * Used as a FALLBACK in case the webhook misses an email.
 *
 * Primary trigger: Google Pub/Sub Webhook → api_gmail_webhook.php
 * Fallback:        Windows Task Scheduler every 15 minutes
 */

define('DAEMON_MODE', true);
define('LOG_FILE', __DIR__ . '/logs/sync_' . date('Y-m-d') . '.log');

function daemon_log(string $msg): void {
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

daemon_log('Gmail Sync Daemon started (fallback mode).');

// ── Trigger the existing sync endpoint via local HTTP ─────────────────────────
// The sync logic lives in api_fetch_live_gmail.php — we call it via localhost
// This avoids duplicating the 900-line IMAP logic here.
$sync_url = 'http://localhost:8000/api_fetch_live_gmail.php?sync=1&daemon=1';

$ch = curl_init($sync_url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 120,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER     => ['X-Daemon-Request: 1'],
]);
$resp     = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_err  = curl_error($ch);
curl_close($ch);

if ($http_code === 200) {
    $data = json_decode($resp, true);
    $count = $data['new_emails'] ?? ($data['count'] ?? '?');
    daemon_log("Sync OK. HTTP {$http_code}. New emails pulled: {$count}");
} else {
    daemon_log("Sync WARNING. HTTP {$http_code}. Curl: {$curl_err}. Response: " . substr($resp, 0, 200));
    daemon_log("Note: PHP server must be running at localhost:8000 for sync to work.");
}

daemon_log('Sync Daemon finished.');
exit(0);
