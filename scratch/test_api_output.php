<?php
$_SERVER['REQUEST_METHOD'] = 'GET';
ob_start();
require_once dirname(__DIR__) . '/public/api_quotations.php';
$output = ob_get_clean();

$response = json_decode($output, true);
if ($response && isset($response['data'])) {
    foreach ($response['data'] as $quo) {
        if ($quo['quotation_number'] === 'SPH-ABM/MY/2026/0919') {
            echo "SPH: SPH-ABM/MY/2026/0919\n";
            echo "rfq_id: " . ($quo['rfq_id'] ? $quo['rfq_id'] : 'NULL') . "\n";
            echo "email_source: " . ($quo['email_source'] ? json_encode($quo['email_source'], JSON_PRETTY_PRINT) : 'NULL') . "\n";
        }
    }
} else {
    echo "Failed to decode response: " . substr($output, 0, 500) . "\n";
}
