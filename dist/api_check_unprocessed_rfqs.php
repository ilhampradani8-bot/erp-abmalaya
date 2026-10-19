<?php
header('Content-Type: text/plain');
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once __DIR__ . '/db_connect.php';

$res = $db_conn->query('
    SELECT r.id, r.rfq_number, r.client_name, r.subject, r.status, r.ai_verified, r.ai_classification, r.ai_error, r.created_at
    FROM rfq_requests r
    WHERE r.id IN (115, 118, 119, 134, 150)
');
if (!$res) {
    echo "Query error: " . $db_conn->error;
    exit;
}
while ($row = $res->fetch_assoc()) {
    echo json_encode($row) . PHP_EOL;
}
