<?php
require_once __DIR__ . "/public/db_connect.php";
if ($db_conn) {
    $start_date_limit = '2026-01-01';
    $query_where = "WHERE r.created_at >= '" . $db_conn->real_escape_string($start_date_limit) . " 00:00:00' AND (r.ai_classification != 'junk' OR r.ai_classification IS NULL)";
    $sql = "SELECT r.*, COALESCE(q.status, 'masuk') AS status FROM rfq_requests r LEFT JOIN quotations q ON q.rfq_id = r.id {$query_where} ORDER BY r.id DESC LIMIT 10";
    echo $sql . "\n";
    $res = $db_conn->query($sql);
    if ($res) {
        echo "Found " . $res->num_rows . " rows.\n";
        while($row = $res->fetch_assoc()) {
            echo $row['id'] . " - " . $row['status'] . "\n";
        }
    } else {
        echo "Query failed: " . $db_conn->error . "\n";
    }
} else {
    echo "No connection";
}
