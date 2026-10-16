<?php
header('Content-Type: text/plain');
require_once __DIR__ . '/db_connect.php';

echo "=== CHECKING RFQ REQUESTS ON HOSTING ===\n";
$res = $db_conn->query("
    SELECT r.id, r.rfq_number, r.client_name, r.client_company, r.subject, r.status, r.ai_verified, r.ai_classification, r.created_at,
           q.id AS quotation_id, q.quotation_number, q.status AS quotation_status
    FROM rfq_requests r
    LEFT JOIN quotations q ON q.rfq_id = r.id
    ORDER BY r.id DESC
    LIMIT 30
");

if (!$res) {
    echo "Query error: " . $db_conn->error . "\n";
    exit;
}

printf("%-5s | %-15s | %-12s | %-12s | %-15s | %-15s | %s\n", "ID", "RFQ_NUM", "STATUS", "AI_CLASS", "QUO_ID", "QUO_STATUS", "SUBJECT");
echo str_repeat("-", 105) . "\n";

while ($row = $res->fetch_assoc()) {
    printf("%-5s | %-15s | %-12s | %-12s | %-15s | %-15s | %s\n",
        $row['id'],
        $row['rfq_number'] ?: '-',
        $row['status'] ?: 'null',
        $row['ai_classification'] ?: 'null',
        $row['quotation_id'] ?: 'NO QUO',
        $row['quotation_status'] ?: '-',
        substr($row['subject'] ?: '', 0, 30)
    );
}

echo "\n=== SUMMARY OF RFQ STATUSES ===\n";
$sum_res = $db_conn->query("SELECT status, count(*) as cnt FROM rfq_requests GROUP BY status");
while ($r = $sum_res->fetch_assoc()) {
    echo "Status: " . ($r['status'] ?: 'NULL') . " => " . $r['cnt'] . "\n";
}

echo "\n=== SUMMARY OF AI CLASSIFICATION ===\n";
$ai_sum = $db_conn->query("SELECT ai_verified, ai_classification, count(*) as cnt FROM rfq_requests GROUP BY ai_verified, ai_classification");
while ($r = $ai_sum->fetch_assoc()) {
    echo "ai_verified: " . $r['ai_verified'] . ", ai_class: " . ($r['ai_classification'] ?: 'NULL') . " => " . $r['cnt'] . "\n";
}

echo "\n=== RFQS CLASSIFIED AS 'client_rfq' WITHOUT QUOTATIONS ===\n";
$miss_res = $db_conn->query("
    SELECT r.id, r.rfq_number, r.status, r.client_name, r.subject
    FROM rfq_requests r
    LEFT JOIN quotations q ON q.rfq_id = r.id
    WHERE r.ai_classification = 'client_rfq' AND q.id IS NULL
");
while ($r = $miss_res->fetch_assoc()) {
    echo "RFQ ID: " . $r['id'] . " | " . $r['rfq_number'] . " | Status: " . $r['status'] . " | " . $r['subject'] . "\n";
}
