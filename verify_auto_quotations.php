<?php
require_once __DIR__ . '/public/db_connect.php';

echo "=== Verifying Auto-Generated Quotations ===\n";

$res = $db_conn->query("SELECT * FROM quotations ORDER BY created_at DESC");
if ($res && $res->num_rows > 0) {
    while ($row = $res->fetch_assoc()) {
        echo "\nQuotation ID: {$row['id']}\n";
        echo "Quotation Number: {$row['quotation_number']}\n";
        echo "Client: {$row['client_name']} ({$row['client_email']})\n";
        echo "Date Issued: {$row['date_issued']} | Valid Until: {$row['valid_until']}\n";
        echo "Status: {$row['status']} | Grand Total: RM {$row['grand_total']}\n";
        echo "Notes: {$row['notes']}\n";

        // Fetch items
        $res_items = $db_conn->query("SELECT * FROM quotation_items WHERE quotation_id = '{$row['id']}'");
        if ($res_items && $res_items->num_rows > 0) {
            echo "Items:\n";
            while ($item = $res_items->fetch_assoc()) {
                echo "  - {$item['description']} | Qty: {$item['quantity']} | Unit: {$item['unit']} | Price/Unit: RM {$item['unit_price']} | Total: RM {$item['total']}\n";
            }
        } else {
            echo "No items found in quotation_items for this quotation!\n";
        }
    }
} else {
    echo "No quotations with status 'requisition' found in database.\n";
}
