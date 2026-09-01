<?php
// Router script for PHP dev server to handle Adminer URL routing & API endpoints
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve existing API endpoints or static files directly
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    return false;
}

// Route all root and adminer sub-paths to adminer.php
require __DIR__ . '/adminer.php';
exit;
