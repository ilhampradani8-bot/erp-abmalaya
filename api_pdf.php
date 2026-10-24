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

if (php_sapi_name() === 'cli' && isset($argv) && is_array($argv)) {
    foreach ($argv as $arg) {
        if (strpos($arg, '=') !== false) {
            list($k, $v) = explode('=', $arg, 2);
            $_GET[$k] = $v;
        }
    }
}

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
    $stmt = $connection->prepare("SELECT invoice_number FROM invoices WHERE id = ? OR invoice_number = ? OR quotation_id = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("sss", $id, $id, $id);
        $stmt->execute();
        $r = $stmt->get_result();
        if ($r && $row = $r->fetch_assoc()) {
            if (!empty($row['invoice_number'])) $refNo = $row['invoice_number'];
        }
        $stmt->close();
    }
    if ($refNo === ('DOC-' . time()) && strpos($id, 'ABM/INV') !== false) {
        $refNo = $id;
    }
} else {
    $stmt = $connection->prepare("SELECT quotation_number FROM quotations WHERE id = ? OR quotation_number = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("ss", $id, $id);
        $stmt->execute();
        $r = $stmt->get_result();
        if ($r && $row = $r->fetch_assoc()) {
            if (!empty($row['quotation_number'])) $refNo = $row['quotation_number'];
        }
        $stmt->close();
    }
}

// Clean filename for PDF output
$safeFilename = preg_replace('/[^A-Za-z0-9_\-]/', '_', $refNo) . '.pdf';
$safeFilename = str_ireplace('SPH', 'QUO', $safeFilename);
$safeFilename = preg_replace('/^SPH[\\-_]/i', 'QUO_', $safeFilename);
$pdfDir = __DIR__ . '/uploads/pdf/';
if (!file_exists($pdfDir)) {
    @mkdir($pdfDir, 0777, true);
}
$pdfPath = $pdfDir . $safeFilename;
$pdfRelativeUrl = '/uploads/pdf/' . $safeFilename;

// Determine Host URL dynamically
$scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1:8000';
$targetViewUrl = $scheme . "://" . $host . "/view_doc.php?type=" . urlencode($type) . "&id=" . urlencode($id);

$force = (isset($_GET['force']) && $_GET['force'] === '1') || (isset($_POST['force']) && $_POST['force'] === '1') || $action === 'recreate' || $action === 'stream' || isset($_GET['t']);
$shouldGenerate = $force || !file_exists($pdfPath) || filesize($pdfPath) < 500;

$pdfGeneratedSuccessfully = file_exists($pdfPath) && filesize($pdfPath) >= 500;

if ($shouldGenerate) {
    $nodeScript = __DIR__ . '/../scripts/generate_pdf_puppeteer.cjs';
    if (!file_exists($nodeScript)) {
        $nodeScript = __DIR__ . '/scripts/generate_pdf_puppeteer.cjs';
    }

    if (file_exists($nodeScript) && function_exists('exec')) {
        $cmd = "node " . escapeshellarg($nodeScript) . " " . escapeshellarg($type) . " " . escapeshellarg($id) . " " . escapeshellarg($pdfPath) . " " . escapeshellarg($targetViewUrl) . " 2>&1";
        @exec($cmd, $outputArray, $returnCode);
    }

    if (file_exists($pdfPath) && filesize($pdfPath) >= 100) {
        $pdfGeneratedSuccessfully = true;
    } else {
        // Fallback: Generate real PDF file with pure PHP generator (compatible with cPanel / shared FTP hosts)
        require_once __DIR__ . '/api_rfq_status.php';
        if ($type === 'quotation' && function_exists('createQuotationPdfFile')) {
            $q_stmt = $connection->prepare("SELECT * FROM quotations WHERE id = ? OR quotation_number = ? LIMIT 1");
            if ($q_stmt) {
                $q_stmt->bind_param("ss", $id, $id);
                $q_stmt->execute();
                $q_res = $q_stmt->get_result();
                if ($q_res && $q_row = $q_res->fetch_assoc()) {
                    createQuotationPdfFile($pdfPath, $q_row, $connection);
                }
                $q_stmt->close();
            }
        }
        if (file_exists($pdfPath) && filesize($pdfPath) >= 100) {
            $pdfGeneratedSuccessfully = true;
            $pdfRelativeUrl = '/uploads/pdf/' . $safeFilename;
        } else {
            // Fallback: Use view_doc.php as document URL for hosting without Node.js
            $pdfRelativeUrl = '/view_doc.php?type=' . urlencode($type) . '&id=' . urlencode($id);
            $pdfGeneratedSuccessfully = true;
        }
    }
}

// Update quotation status in database upon successful generation
if ($type === 'quotation') {
    $stmt_upd = $connection->prepare("UPDATE quotations SET pdf_created = 1, pdf_created_at = NOW(), quotation_file = ? WHERE id = ? OR quotation_number = ?");
    if ($stmt_upd) {
        $stmt_upd->bind_param("sss", $pdfRelativeUrl, $id, $id);
        $stmt_upd->execute();
        $stmt_upd->close();
    }
    
    // Fetch rfq_id and created_by to log history
    $stmt_rfq = $connection->prepare("SELECT rfq_id, quotation_number, created_by FROM quotations WHERE id = ? OR quotation_number = ? LIMIT 1");
    if ($stmt_rfq) {
        $stmt_rfq->bind_param("ss", $id, $id);
        $stmt_rfq->execute();
        $res_rfq = $stmt_rfq->get_result();
        if ($res_rfq && $row_q = $res_rfq->fetch_assoc()) {
            if (!empty($row_q['rfq_id'])) {
                $clean_rfq_id = (int)str_replace(['GMAIL-LIVE-', 'RFQ-'], '', $row_q['rfq_id']);
                
                $actor_name = isset($_REQUEST['user_name']) && trim($_REQUEST['user_name']) !== '' 
                    ? trim($_REQUEST['user_name']) 
                    : (!empty($row_q['created_by']) ? $row_q['created_by'] : 'Sistem');
                $actor_email = isset($_REQUEST['user_email']) && trim($_REQUEST['user_email']) !== '' 
                    ? trim($_REQUEST['user_email']) 
                    : null;
                
                if (function_exists('appendRfqHistoryLog')) {
                    appendRfqHistoryLog($connection, $clean_rfq_id, 'Generate PDF Quotation', $actor_name, $actor_email, "Dokumen PDF Quotation {$row_q['quotation_number']} berhasil digenerate.");
                }
            }
        }
        $stmt_rfq->close();
    }
}

// Action JSON response for API calls / email attachments
if ($action === 'generate' || $action === 'json') {
    while (ob_get_level()) {
        ob_end_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'success',
        'message' => 'Quotation Document generated successfully!',
        'filename' => $safeFilename,
        'pdf_url' => $pdfRelativeUrl,
        'pdf_path' => $pdfPath,
        'size' => file_exists($pdfPath) ? filesize($pdfPath) : 0
    ]);
    exit;
}

// Action Stream (inline PDF view) or Download (attachment)
while (ob_get_level()) {
    ob_end_clean();
}

if (file_exists($pdfPath) && filesize($pdfPath) >= 100) {
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
} else {
    // If physical PDF file does not exist, redirect directly to HTML document view
    header('Location: /view_doc.php?type=' . urlencode($type) . '&id=' . urlencode($id));
    exit;
}
