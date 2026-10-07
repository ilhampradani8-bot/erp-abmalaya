<?php
// Router script for PHP dev server to handle Adminer URL routing, API endpoints & React SPA
$rawUri = $_SERVER['REQUEST_URI'];
$uri = urldecode(parse_url($rawUri, PHP_URL_PATH));

$publicFile = __DIR__ . $uri;

// 1. If requesting a specific PHP script that exists in public/
if ($uri !== '/' && file_exists($publicFile) && !is_dir($publicFile)) {
    $ext = strtolower(pathinfo($publicFile, PATHINFO_EXTENSION));
    if ($ext === 'php') {
        require $publicFile;
        exit;
    }
    
    // Serve static files (PDF, images, css, js, json, fonts) directly
    $mimes = [
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json',
        'woff2' => 'font/woff2',
        'woff' => 'font/woff',
        'ttf' => 'font/ttf',
        'zip' => 'application/zip',
        'txt' => 'text/plain'
    ];
    if (isset($mimes[$ext])) {
        header("Content-Type: " . $mimes[$ext]);
        header("Content-Length: " . filesize($publicFile));
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
        readfile($publicFile);
        exit;
    }
    return false;
}

// 2. Also check if file exists in root attachments/ or uploads/
$rootFile = dirname(__DIR__) . $uri;
if ($uri !== '/' && file_exists($rootFile) && !is_dir($rootFile)) {
    $ext = strtolower(pathinfo($rootFile, PATHINFO_EXTENSION));
    $mimes = [
        'pdf' => 'application/pdf',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json',
        'woff2' => 'font/woff2',
        'woff' => 'font/woff',
        'ttf' => 'font/ttf',
        'zip' => 'application/zip',
        'txt' => 'text/plain'
    ];
    if (isset($mimes[$ext])) {
        header("Content-Type: " . $mimes[$ext]);
        header("Content-Length: " . filesize($rootFile));
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
        readfile($rootFile);
        exit;
    }
}

// 3. Serve static assets from dist/
if ($uri !== '/' && file_exists(__DIR__ . '/../dist' . $uri) && !is_dir(__DIR__ . '/../dist' . $uri)) {
    $file = __DIR__ . '/../dist' . $uri;
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $mimes = [
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'woff2' => 'font/woff2'
    ];
    if (isset($mimes[$ext])) {
        header("Content-Type: " . $mimes[$ext]);
    }
    readfile($file);
    exit;
}

// 4. Serve React SPA Frontend (dist/index.html or public/index.html)
$distIndex = __DIR__ . '/../dist/index.html';
$publicIndex = __DIR__ . '/index.html';

if ($uri === '/' || strpos($uri, 'adminer') === false) {
    if (file_exists($distIndex)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($distIndex);
        exit;
    }
    if (file_exists($publicIndex)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($publicIndex);
        exit;
    }
}

// 5. Route to adminer.php for database management if explicitly requested
require __DIR__ . '/adminer.php';
exit;
