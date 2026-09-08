<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';
$connection = isset($conn) ? $conn : $db_conn;

$type = isset($_GET['type']) ? trim($_GET['type']) : (isset($_POST['type']) ? trim($_POST['type']) : 'quotation');
$id = isset($_GET['id']) ? trim($_GET['id']) : (isset($_POST['id']) ? trim($_POST['id']) : '');
$action = isset($_GET['action']) ? trim($_GET['action']) : (isset($_POST['action']) ? trim($_POST['action']) : 'download');

if (empty($id)) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'error', 'message' => 'Missing document ID.']);
    exit;
}

// 1. Resolve Document Ref No / Filename
$refNo = 'DOC-' . time();
if ($type === 'invoice') {
    $stmt = $connection->prepare("SELECT invoice_number FROM invoices WHERE id = ? OR invoice_number = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("ss", $id, $id);
        $stmt->execute();
        $r = $stmt->get_result();
        if ($r && $row = $r->fetch_assoc()) {
            if (!empty($row['invoice_number'])) $refNo = $row['invoice_number'];
        }
        $stmt->close();
    }
} else {
    $stmt = $connection->prepare("SELECT ref_no FROM quotations WHERE id = ? OR ref_no = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("ss", $id, $id);
        $stmt->execute();
        $r = $stmt->get_result();
        if ($r && $row = $r->fetch_assoc()) {
            if (!empty($row['ref_no'])) $refNo = $row['ref_no'];
        }
        $stmt->close();
    }
}

// Clean filename for PDF output
$safeFilename = preg_replace('/[^A-Za-z0-9_\-]/', '_', $refNo) . '.pdf';
$pdfDir = __DIR__ . '/uploads/pdf/';
if (!file_exists($pdfDir)) {
    @mkdir($pdfDir, 0777, true);
}
$pdfPath = $pdfDir . $safeFilename;
$pdfRelativeUrl = '/uploads/pdf/' . $safeFilename;

// Determine Host URL for Puppeteer renderer
$scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1:8000';

// If running locally or on server port 8000
$targetViewUrl = "http://127.0.0.1:8000/view_doc.php?type=" . urlencode($type) . "&id=" . urlencode($id);

// Execute Puppeteer Headless Chrome script
$nodeScript = __DIR__ . '/../scripts/generate_pdf_puppeteer.cjs';
if (!file_exists($nodeScript)) {
    $nodeScript = __DIR__ . '/scripts/generate_pdf_puppeteer.cjs';
}

$cmd = "node " . escapeshellarg($nodeScript) . " " . escapeshellarg($type) . " " . escapeshellarg($id) . " " . escapeshellarg($pdfPath) . " " . escapeshellarg($targetViewUrl) . " 2>&1";
exec($cmd, $outputArray, $returnCode);

if (!file_exists($pdfPath) || filesize($pdfPath) < 100) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'Failed to generate PDF via Headless Chrome: ' . implode(" ", $outputArray)
    ]);
    exit;
}

// Update quotation status in database upon successful generation
if ($type === 'quotation') {
    $stmt_upd = $connection->prepare("UPDATE quotations SET pdf_created = 1, pdf_created_at = NOW(), status = 'acc' WHERE id = ? OR ref_no = ? OR quotation_number = ?");
    if ($stmt_upd) {
        $stmt_upd->bind_param("sss", $id, $id, $id);
        $stmt_upd->execute();
        $stmt_upd->close();
    }
    
    // Fetch rfq_id to log history
    $stmt_rfq = $connection->prepare("SELECT rfq_id, quotation_number FROM quotations WHERE id = ? OR ref_no = ? OR quotation_number = ? LIMIT 1");
    if ($stmt_rfq) {
        $stmt_rfq->bind_param("sss", $id, $id, $id);
        $stmt_rfq->execute();
        $res_rfq = $stmt_rfq->get_result();
        if ($res_rfq && $row_q = $res_rfq->fetch_assoc()) {
            if (!empty($row_q['rfq_id'])) {
                $clean_rfq_id = (int)str_replace(['GMAIL-LIVE-', 'RFQ-'], '', $row_q['rfq_id']);
                appendRfqHistoryLog($connection, $clean_rfq_id, 'Generate PDF SPH', 'System Generator', 'system@abmalaya.com', "Dokumen PDF SPH {$row_q['quotation_number']} berhasil digenerate dan dikonfirmasi. Status penawaran otomatis masuk ke tab ACC / Approve.");
            }
        }
        $stmt_rfq->close();
    }
}

// Action JSON response for API calls / email attachments
if ($action === 'generate' || $action === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'success',
        'message' => 'PDF generated successfully via Headless Chrome!',
        'filename' => $safeFilename,
        'pdf_url' => $pdfRelativeUrl,
        'pdf_path' => $pdfPath,
        'size' => filesize($pdfPath)
    ]);
    exit;
}

// Action Stream (inline PDF view) or Download (attachment)
while (ob_get_level()) {
    ob_end_clean();
}

header('Content-Type: application/pdf');
header('Cache-Control: private, max-age=0, must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($pdfPath));

if ($action === 'stream') {
    header('Content-Disposition: inline; filename="' . $safeFilename . '"');
} else {
    header('Content-Disposition: attachment; filename="' . $safeFilename . '"');
}

readfile($pdfPath);
exit;
