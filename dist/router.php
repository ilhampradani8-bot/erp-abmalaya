<?php
// Router script for PHP dev server to handle Adminer URL routing, API endpoints & React SPA
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve existing API endpoints or static files directly from public/
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    return false;
}

// Serve static assets from dist/
if ($uri !== '/' && file_exists(__DIR__ . '/../dist' . $uri)) {
    $file = __DIR__ . '/../dist' . $uri;
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    $mimes = [
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'woff2' => 'font/woff2'
    ];
    if (isset($mimes[$ext])) {
        header("Content-Type: " . $mimes[$ext]);
    }
    readfile($file);
    exit;
}

// Serve React SPA Frontend (dist/index.html or public/index.html)
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

// Route to adminer.php for database management if explicitly requested
require __DIR__ . '/adminer.php';
exit;
