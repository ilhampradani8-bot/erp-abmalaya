<?php
require_once dirname(__DIR__) . '/public/db_connect.php';

echo "=== CHECKING RFQ REQUESTS IDs ===\n";
$res = $db_conn->query("SELECT id, rfq_number, client_email FROM rfq_requests ORDER BY id DESC LIMIT 20");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo "ID: {$row['id']} | Number: {$row['rfq_number']} | Email: {$row['client_email']}\n";
    }
} else {
    echo "Error: " . $db_conn->error . "\n";
}

echo "\n=== CHECKING QUOTATIONS RFQ_ID RELATIONSHIP ===\n";
$res_quo = $db_conn->query("SELECT id, quotation_number, rfq_id, client_email FROM quotations");
if ($res_quo) {
    while ($row = $res_quo->fetch_assoc()) {
        echo "Quotation Number: {$row['quotation_number']} | rfq_id: {$row['rfq_id']} | client_email: {$row['client_email']}\n";
    }
}
