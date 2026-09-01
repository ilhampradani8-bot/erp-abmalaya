<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
$rfq_id  = isset($input['rfq_id'])  ? trim($input['rfq_id'])  : '';
$link_id = isset($input['link_id']) ? trim($input['link_id']) : '';

if (empty($rfq_id) || empty($link_id)) {
    echo json_encode(['status' => 'error', 'message' => 'Missing rfq_id or link_id parameter.']);
    exit;
}

$clean_id = intval(str_replace(['RFQ-', 'GMAIL-LIVE-'], '', $rfq_id));
$rfq_num  = 'RFQ-' . $clean_id;

// ── Fetch email body from database ─────────────────────────────────────────
$message_body = '';
$current_ai_error = '';
$db_id = 0;

$stmt = $db_conn->prepare("SELECT id, rfq_number, message_body, ai_error FROM rfq_requests WHERE id = ? OR rfq_number = ?");
if ($stmt) {
    $stmt->bind_param("is", $clean_id, $rfq_num);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res && $res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $message_body     = $row['message_body'];
        $current_ai_error = $row['ai_error'];
        $db_id            = $row['id'];
    }
    $stmt->close();
}

if (empty($message_body)) {
    echo json_encode(['status' => 'error', 'message' => 'RFQ record or email body not found in database.']);
    exit;
}

// ── Find the target link in email body ─────────────────────────────────────
$target_link = null;
$links = extractGoogleDriveLinksFromText($message_body);
foreach ($links as $link) {
    if ($link['id'] === $link_id) {
        $target_link = $link;
        break;
    }
}

if (!$target_link) {
    echo json_encode(['status' => 'error', 'message' => 'Google Drive link ID not found in email body.']);
    exit;
}

if ($target_link['type'] === 'folder') {
    echo json_encode(['status' => 'error', 'message' => 'Google Drive folders cannot be downloaded directly. Please open the link in your browser.']);
    exit;
}

// ── Structured file_inbox directory ───────────────────────────────────────
// Local path : public/file_inbox/rfq-{id}/
// Hosting URL: https://erp.abmalaya.com/public/file_inbox/rfq-{id}/
// ──────────────────────────────────────────────────────────────────────────
$inbox_base = __DIR__ . '/file_inbox';
$rfq_dir    = $inbox_base . '/rfq-' . $clean_id;

if (!file_exists($rfq_dir)) {
    @mkdir($rfq_dir, 0755, true);
}

$ext            = (strpos($target_link['filename'], '.xlsx') !== false) ? 'xlsx' : 'pdf';
$local_filename = $target_link['type'] . '_' . substr($target_link['id'], 0, 12) . '.' . $ext;
$dest_path      = $rfq_dir . '/' . $local_filename;

// Public URL for local dev and production
$local_url_dev  = "http://localhost:8000/file_inbox/rfq-{$clean_id}/{$local_filename}";
$local_url_prod = "https://erp.abmalaya.com/public/file_inbox/rfq-{$clean_id}/{$local_filename}";

try {
    downloadFileWithRetry($target_link['url'], $dest_path);

    appendRfqHistoryLog(
        $db_conn, $clean_id,
        'Download GDrive File',
        'System Downloader', 'system@abmalaya.com',
        "Successfully downloaded linked file to file_inbox/rfq-{$clean_id}/{$local_filename}"
    );

    echo json_encode([
        'status'     => 'success',
        'message'    => 'Attachment downloaded and saved to file_inbox.',
        'filename'   => $local_filename,
        'local_path' => "file_inbox/rfq-{$clean_id}/{$local_filename}",
        'url'        => $local_url_dev,
        'url_prod'   => $local_url_prod,
        'size_mb'    => file_exists($dest_path) ? round(filesize($dest_path) / 1024 / 1024, 2) : 0
    ]);

} catch (Exception $ex) {
    $err_msg  = "GDrive Download Failed for ID {$link_id}: " . $ex->getMessage();
    $new_err  = trim($current_ai_error . " | " . $err_msg, " | ");

    $up_stmt = $db_conn->prepare("UPDATE rfq_requests SET ai_error = ? WHERE id = ?");
    if ($up_stmt) {
        $up_stmt->bind_param("si", $new_err, $db_id);
        $up_stmt->execute();
        $up_stmt->close();
    }

    appendRfqHistoryLog($db_conn, $clean_id, 'GDrive Download Error', 'System Downloader', 'system@abmalaya.com', $err_msg);

    echo json_encode(['status' => 'error', 'message' => $err_msg]);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Downloads a file, resolving Google Drive confirmation page redirects.
 */
function downloadFileWithRetry($url, $dest_path, $attempt = 1) {
    if ($attempt > 3) {
        throw new Exception("Maximum download redirect attempts exceeded.");
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]);

    $data      = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err       = curl_error($ch);
    curl_close($ch);

    if ($http_code !== 200) {
        throw new Exception("HTTP {$http_code} from Google. Curl error: {$err}");
    }

    if (empty($data)) {
        throw new Exception("Received empty response from Google Drive server.");
    }

    // Google Drive virus-scan confirmation redirect
    if (strpos($data, 'confirm=') !== false && preg_match('/confirm=([a-zA-Z0-9_]+)/', $data, $cm)) {
        return downloadFileWithRetry($url . '&confirm=' . $cm[1], $dest_path, $attempt + 1);
    }

    // Safety: reject HTML error pages
    if (strpos($data, '<html') !== false && strpos($data, 'Access Denied') !== false) {
        throw new Exception("Google Drive Access Denied. Ensure the file sharing is set to 'Anyone with the link can view'.");
    }

    file_put_contents($dest_path, $data);
    return true;
}

/**
 * Extracts all downloadable Google Drive & Docs links from text.
 */
function extractGoogleDriveLinksFromText($text) {
    $links = [];

    // drive.google.com/file/d/[FILE_ID]
    if (preg_match_all('/https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i', $text, $m)) {
        foreach (array_unique($m[1]) as $id) {
            $links[] = ['type' => 'file', 'id' => $id, 'url' => "https://drive.google.com/uc?export=download&id={$id}", 'filename' => "gdrive_file_" . substr($id, 0, 8) . ".pdf"];
        }
    }
    // docs.google.com/document/d/[DOC_ID]
    if (preg_match_all('/https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i', $text, $m)) {
        foreach (array_unique($m[1]) as $id) {
            $links[] = ['type' => 'document', 'id' => $id, 'url' => "https://docs.google.com/document/d/{$id}/export?format=pdf", 'filename' => "gdocs_doc_" . substr($id, 0, 8) . ".pdf"];
        }
    }
    // docs.google.com/spreadsheets/d/[SHEET_ID]
    if (preg_match_all('/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i', $text, $m)) {
        foreach (array_unique($m[1]) as $id) {
            $links[] = ['type' => 'spreadsheet', 'id' => $id, 'url' => "https://docs.google.com/spreadsheets/d/{$id}/export?format=xlsx", 'filename' => "gdocs_sheet_" . substr($id, 0, 8) . ".xlsx"];
        }
    }
    // drive.google.com/open?id=[FILE_ID]
    if (preg_match_all('/https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i', $text, $m)) {
        foreach (array_unique($m[1]) as $id) {
            $links[] = ['type' => 'file', 'id' => $id, 'url' => "https://drive.google.com/uc?export=download&id={$id}", 'filename' => "gdrive_file_" . substr($id, 0, 8) . ".pdf"];
        }
    }
    // drive.google.com/drive/folders/[FOLDER_ID]
    if (preg_match_all('/https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/i', $text, $m)) {
        foreach (array_unique($m[1]) as $id) {
            $links[] = ['type' => 'folder', 'id' => $id, 'url' => "https://drive.google.com/drive/folders/{$id}", 'filename' => "gdrive_folder_" . substr($id, 0, 8)];
        }
    }

    return $links;
}
