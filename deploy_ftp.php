<?php
// PHP FTP Deployer Script
$env_lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$env = [];
foreach ($env_lines as $line) {
    if (strpos(trim($line), '#') === 0) continue;
    $parts = explode('=', $line, 2);
    if (count($parts) === 2) {
        $key = trim($parts[0]);
        $val = trim($parts[1], " \t\n\r\0\x0B\"'");
        $env[$key] = $val;
    }
}

$host = isset($env['FTP_HOST']) ? $env['FTP_HOST'] : '';
$user = isset($env['FTP_USER']) ? $env['FTP_USER'] : '';
$pass = isset($env['FTP_PASS']) ? $env['FTP_PASS'] : '';

if ($host === 'ftp.abmalaya.com') {
    $host = '110.4.45.199'; // Fallback to direct IP to bypass DNS blocks!
}

if (empty($host) || empty($user) || empty($pass)) {
    die("FTP Credentials missing in .env\n");
}

echo "Connecting to FTP Host: $host...\n";
$conn = ftp_connect($host);
if (!$conn) {
    die("Failed to connect to $host\n");
}

echo "Logging in as $user...\n";
if (!ftp_login($conn, $user, $pass)) {
    die("FTP Login failed for $user\n");
}

ftp_pasv($conn, true);
$files_to_upload = [
    'public/api_fetch_live_gmail.php' => 'api_fetch_live_gmail.php',
    'public/api_gmail_webhook.php' => 'api_gmail_webhook.php',
    'public/api_quotations.php' => 'api_quotations.php',
    'public/api_rfq_status.php' => 'api_rfq_status.php',
    'public/api_download_attachment.php' => 'api_download_attachment.php',
    'public/api_ocr_scan.php' => 'api_ocr_scan.php',
    'daemon/scan_ai.php' => '../daemon/scan_ai.php',
    'daemon/scan_inbox.php' => '../daemon/scan_inbox.php',
    'daemon/scan_ocr.php' => '../daemon/scan_ocr.php',
];

// Add dist files to upload directly to FTP root
function addDistToUploads($dir, &$list) {
    if (!is_dir($dir)) return;
    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $path = $dir . '/' . $file;
        if (is_dir($path)) {
            addDistToUploads($path, $list);
        } else {
            // Translate dist/... to ...
            $remote_path = substr($path, strlen('dist/'));
            $list[$path] = $remote_path;
        }
    }
}

addDistToUploads('dist', $files_to_upload);

foreach ($files_to_upload as $local => $remote) {
    echo "Uploading $local to $remote...\n";
    
    // Ensure remote directory exists
    $parts = explode('/', $remote);
    if (count($parts) > 1) {
        array_pop($parts);
        $current_dir = '';
        foreach ($parts as $part) {
            $current_dir .= $part . '/';
            @ftp_mkdir($conn, $current_dir);
        }
    }
    
    if (ftp_put($conn, $remote, $local, FTP_BINARY)) {
        echo "Successfully uploaded $local to $remote\n";
    } else {
        echo "FAILED to upload $local to $remote\n";
    }
}

ftp_close($conn);
echo "FTP Deployment Finished!\n";
