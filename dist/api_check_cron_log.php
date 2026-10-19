<?php
header('Content-Type: text/plain');
echo "Checking cron log on hosting...
";
$paths = [
    __DIR__ . '/daemon/logs/cron_trigger_active.log',
    __DIR__ . '/../daemon/logs/cron_trigger_active.log',
    '/home/abmalaya/daemon/logs/cron_trigger_active.log'
];
foreach ($paths as $p) {
    if (file_exists($p)) {
        echo "Found $p: 
" . file_get_contents($p) . "
";
    } else {
        echo "Not found: $p
";
    }
}
