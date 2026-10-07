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
$cache_file = __DIR__ . '/.ftp_deploy_cache.json';
$cache = file_exists($cache_file) ? json_decode(file_get_contents($cache_file), true) : [];
if (!is_array($cache)) $cache = [];

$force_all = in_array('--all', $argv) || in_array('--force', $argv);

// Auto-scan folders -> upload to root
function addFolderToUploads($dir, $remote_prefix, &$list, $ignore_heavy = true) {
    if (!is_dir($dir)) return;
    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..' || $file === '.git' || $file === 'node_modules') continue;
        $path = $dir . '/' . $file;
        
        // Skip heavy directories unless needed
        if ($ignore_heavy && (
            strpos($path, 'uploads/pdf') !== false ||
            strpos($path, 'daemon/logs') !== false ||
            strpos($path, 'dist/attachments') !== false ||
            strpos($path, 'public/attachments') !== false ||
            strpos($path, 'exports/') !== false
        )) {
            continue;
        }

        if (is_dir($path)) {
            addFolderToUploads($path, $remote_prefix . $file . '/', $list, $ignore_heavy);
        } else {
            $list[$path] = $remote_prefix . $file;
        }
    }
}

$files_to_upload = [];
addFolderToUploads('dist', '', $files_to_upload, !$force_all);
addFolderToUploads('daemon', '../daemon/', $files_to_upload, !$force_all);
addFolderToUploads('cpanel', '../cpanel/', $files_to_upload, !$force_all);
addFolderToUploads('public', '', $files_to_upload, !$force_all); // public ALWAYS takes priority for backend PHP!

$uploaded_count = 0;
$skipped_count = 0;

foreach ($files_to_upload as $local => $remote) {
    $current_hash = md5_file($local) . '_' . filesize($local);
    
    if (!$force_all && isset($cache[$local]) && $cache[$local] === $current_hash) {
        $skipped_count++;
        continue;
    }

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
        $cache[$local] = $current_hash;
        $uploaded_count++;
    } else {
        echo "FAILED to upload $local to $remote\n";
    }
}

file_put_contents($cache_file, json_encode($cache, JSON_PRETTY_PRINT));
ftp_close($conn);
echo "FTP Deployment Finished! ($uploaded_count uploaded, $skipped_count skipped/unchanged)\n";

