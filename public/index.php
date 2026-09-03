<?php
// Serve React ERP Single Page Application (Vite Frontend)
if (file_exists(__DIR__ . '/index.html')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');
    exit;
}
header('Location: /adminer.php');
exit;
