<?php
/**
 * ABM Malaya ERP — 24/7 Continuous Background Daemon Loop
 * daemon/run_loop.php
 */
define('DAEMON_MODE', true);
echo "[" . date('Y-m-d H:i:s') . "] Starting 24/7 Continuous Daemon Loop Engine...\n";

while (true) {
    passthru('/usr/bin/php ' . __DIR__ . '/run_all.php');
    echo "[" . date('Y-m-d H:i:s') . "] Daemon cycle completed. Sleeping 120s before next run...\n";
    sleep(120); // 2 minutes interval
}
