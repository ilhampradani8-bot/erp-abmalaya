<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 1. Resolve target ZIP file from query params or POST body
$action = isset($_GET['action']) ? trim($_GET['action']) : 'list';
$fn = isset($_GET['fn']) ? trim($_GET['fn']) : '';
$msgno = isset($_GET['msgno']) ? trim($_GET['msgno']) : '';
$entry = isset($_GET['entry']) ? trim($_GET['entry']) : '';
$url = isset($_GET['url']) ? trim($_GET['url']) : '';

if (empty($fn) && !empty($url)) {
    parse_str(parse_url($url, PHP_URL_QUERY) ?? '', $qp);
    if (!empty($qp['fn'])) $fn = $qp['fn'];
    if (!empty($qp['msgno'])) $msgno = $qp['msgno'];
}

$safe_fn = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $fn);
$base_clean = preg_replace('/[^a-zA-Z0-9]/', '', pathinfo($fn, PATHINFO_FILENAME));

// Candidate files on disk
$candidate_files = [
    __DIR__ . "/attachments/msg_{$msgno}_part_2_{$safe_fn}",
    __DIR__ . "/attachments/{$fn}",
    __DIR__ . "/attachments/{$safe_fn}",
    dirname(__DIR__) . "/public/attachments/msg_{$msgno}_part_2_{$safe_fn}",
    dirname(__DIR__) . "/public/attachments/{$fn}",
    dirname(__DIR__) . "/public/attachments/{$safe_fn}",
];

$zip_path = null;
foreach ($candidate_files as $cf) {
    if (file_exists($cf) && is_file($cf) && filesize($cf) > 100) {
        $zip_path = $cf;
        break;
    }
}

// Fuzzy scan in attachments
if (!$zip_path && !empty($base_clean)) {
    $search_dirs = [__DIR__ . '/attachments', dirname(__DIR__) . '/public/attachments'];
    foreach ($search_dirs as $sdir) {
        if (!is_dir($sdir)) continue;
        $files = @scandir($sdir);
        if ($files) {
            foreach ($files as $f) {
                if ($f === '.' || $f === '..') continue;
                if (str_ends_with(strtolower($f), '.zip')) {
                    $f_clean = preg_replace('/[^a-zA-Z0-9]/', '', pathinfo($f, PATHINFO_FILENAME));
                    if (!empty($msgno) && str_contains($f, "msg_{$msgno}_")) {
                        $zip_path = $sdir . '/' . $f;
                        break 2;
                    }
                    if (str_contains($f_clean, $base_clean) || str_contains($base_clean, $f_clean)) {
                        $zip_path = $sdir . '/' . $f;
                        break 2;
                    }
                }
            }
        }
    }
}

if (!$zip_path || !file_exists($zip_path)) {
    if ($action === 'list') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'error', 'message' => 'ZIP archive file not found on server.']);
    } else {
        http_response_code(404);
        echo 'ZIP file not found.';
    }
    exit;
}

// ACTION: VIEW / EXTRACT SINGLE FILE FROM ZIP
if ($action === 'view' || $action === 'stream' || $action === 'download') {
    if (empty($entry)) {
        http_response_code(400);
        echo 'Missing entry parameter.';
        exit;
    }

    $ext = strtolower(pathinfo($entry, PATHINFO_EXTENSION));
    $mimes = [
        'pdf'  => 'application/pdf',
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'txt'  => 'text/plain',
        'csv'  => 'text/csv',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    $contentType = $mimes[$ext] ?? 'application/octet-stream';

    // Extract file bytes: Dual-mode (Native PHP ZipArchive first, Python fallback)
    $data = null;
    if (class_exists('ZipArchive')) {
        $zip = new ZipArchive();
        if ($zip->open($zip_path) === true) {
            $data = $zip->getFromName($entry);
            $zip->close();
        }
    }
    if (($data === null || $data === false) && function_exists('shell_exec')) {
        $py_code = 'import zipfile, sys; z=zipfile.ZipFile(sys.argv[1]); sys.stdout.buffer.write(z.read(sys.argv[2]))';
        $cmd = 'python3 -c ' . escapeshellarg($py_code) . ' ' . escapeshellarg($zip_path) . ' ' . escapeshellarg($entry);
        $data = shell_exec($cmd);
    }

    if ($data === null || $data === false || strlen($data) === 0) {
        http_response_code(404);
        echo 'File entry not found inside ZIP archive.';
        exit;
    }

    while (ob_get_level() > 0) {
        @ob_end_clean();
    }

    $disposition = ($action === 'download') ? 'attachment' : 'inline';
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . strlen($data));
    header('Content-Disposition: ' . $disposition . '; filename="' . rawurlencode(basename($entry)) . '"; filename*=UTF-8\'\'' . rawurlencode(basename($entry)));
    header('Cache-Control: public, max-age=86400');
    echo $data;
    exit;
}

// ACTION: LIST ENTRIES INSIDE ZIP
header('Content-Type: application/json; charset=utf-8');

// Dual-mode list: Native ZipArchive first (cPanel/shared hosting), Python fallback (VPS)
$entries = [];
if (class_exists('ZipArchive')) {
    $zip = new ZipArchive();
    if ($zip->open($zip_path) === true) {
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $stat = $zip->statIndex($i);
            if ($stat && !str_ends_with($stat['name'], '/')) {
                $entries[] = [
                    'name' => $stat['name'],
                    'size' => $stat['size']
                ];
            }
        }
        $zip->close();
    }
}
if (empty($entries) && function_exists('shell_exec')) {
    $py_list_code = 'import zipfile, sys, json
z = zipfile.ZipFile(sys.argv[1])
entries = []
for info in z.infolist():
    if not info.is_dir():
        entries.append({"name": info.filename, "size": info.file_size})
print(json.dumps(entries))';

    $cmd_list = 'python3 -c ' . escapeshellarg($py_list_code) . ' ' . escapeshellarg($zip_path);
    $raw_json = shell_exec($cmd_list);
    $entries = json_decode($raw_json, true) ?: [];
}

$formatted_entries = [];
foreach ($entries as $e) {
    $e_name = $e['name'];
    $e_size = $e['size'];
    $e_ext = strtolower(pathinfo($e_name, PATHINFO_EXTENSION));

    $size_str = $e_size > 1048576 
        ? round($e_size / 1048576, 1) . ' MB' 
        : ($e_size > 1024 ? round($e_size / 1024, 1) . ' KB' : $e_size . ' B');

    $view_url = '/api_zip_contents.php?action=view&fn=' . rawurlencode(basename($zip_path)) . '&entry=' . rawurlencode($e_name);
    $download_url = '/api_zip_contents.php?action=download&fn=' . rawurlencode(basename($zip_path)) . '&entry=' . rawurlencode($e_name);

    $formatted_entries[] = [
        'filename' => $e_name,
        'size_bytes' => $e_size,
        'size_formatted' => $size_str,
        'ext' => $e_ext,
        'is_pdf' => $e_ext === 'pdf',
        'is_image' => in_array($e_ext, ['png', 'jpg', 'jpeg', 'webp']),
        'view_url' => $view_url,
        'download_url' => $download_url,
    ];
}

echo json_encode([
    'status' => 'success',
    'zip_filename' => basename($zip_path),
    'zip_size' => filesize($zip_path),
    'zip_size_formatted' => filesize($zip_path) > 1048576 ? round(filesize($zip_path)/1048576, 1) . ' MB' : round(filesize($zip_path)/1024, 1) . ' KB',
    'total_files' => count($formatted_entries),
    'files' => $formatted_entries,
]);
exit;
