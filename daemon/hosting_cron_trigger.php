<?php
/**
 * External Auto-Trigger Daemon for Hosting
 * File: daemon/hosting_cron_trigger.php
 *
 * Runs on VPS to trigger the hosting's daemon & sync continuously
 * without requiring cPanel access.
 */

$urls = [
    'https://erp.abmalaya.com/cron_trigger.php',
    'https://erp.abmalaya.com/api_fetch_live_gmail.php?cron=1'
];

echo "[" . date('Y-m-d H:i:s') . "] Starting External Hosting Daemon Trigger Engine...\n";

while (true) {
    foreach ($urls as $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_USERAGENT => 'ERP-Auto-Sync-Daemon/1.0'
        ]);
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        echo "[" . date('Y-m-d H:i:s') . "] Pinged {$url} -> HTTP {$code}\n";
    }
    
    echo "[" . date('Y-m-d H:i:s') . "] Hosting trigger cycle done. Sleeping 120s...\n";
    sleep(120);
}
