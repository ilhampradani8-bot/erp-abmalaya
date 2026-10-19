<?php
header('Content-Type: text/plain');
echo '__DIR__: ' . __DIR__ . PHP_EOL;
echo 'daemon exists: ' . (is_dir(__DIR__ . '/../daemon') ? 'YES' : 'NO') . PHP_EOL;
echo 'public/daemon exists: ' . (is_dir(__DIR__ . '/daemon') ? 'YES' : 'NO') . PHP_EOL;
echo 'scan_ai exists: ' . (file_exists(__DIR__ . '/../daemon/scan_ai.php') ? 'YES' : 'NO') . PHP_EOL;
