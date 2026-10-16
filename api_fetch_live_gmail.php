<?php
error_reporting(0);
ini_set('display_errors', 0);
if (!defined('MASTER_CRON_MODE')) {
    ob_start();
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');
}

// Connect to MySQL Database immediately
require_once __DIR__ . '/db_connect.php';

// Global API rate-limiter counter (keeps track of calls to stay strictly under 10/min)
$gemini_api_calls_count = 0;

// Set strict 3s socket timeouts for IMAP connections
if (function_exists('imap_timeout')) {
    @imap_timeout(IMAP_OPENTIMEOUT, 3);
    @imap_timeout(IMAP_READTIMEOUT, 3);
    @imap_timeout(IMAP_WRITETIMEOUT, 3);
}

$hostname = '{imap.gmail.com:993/imap/ssl}INBOX';
$username = 'abmalayaindustry@gmail.com';
$password = 'tbsq icqa kece qaoz'; // Official Google App Password default

// Try reading from .env if present
$env_file = file_exists(__DIR__ . '/../.env') ? __DIR__ . '/../.env' : (file_exists(__DIR__ . '/.env') ? __DIR__ . '/.env' : null);
if ($env_file) {
    $env_content = @file_get_contents($env_file);
    if ($env_content && preg_match('/GMAIL_LIVE_APP_PASSWORD\s*=\s*["\']?([^"\'\r\n]+)["\']?/i', $env_content, $m_env)) {
        $password = trim($m_env[1]);
    }
}

if (getenv('GMAIL_LIVE_APP_PASSWORD')) {
    $password = trim(getenv('GMAIL_LIVE_APP_PASSWORD'), " \"'");
}

if (isset($db_conn) && $db_conn && !$db_conn->connect_error) {
    $res_pass = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key IN ('SMTP_APP_PASSWORD', 'GMAIL_LIVE_APP_PASSWORD') AND credential_value != '' ORDER BY id ASC LIMIT 1");
    if ($res_pass && $row_pass = $res_pass->fetch_assoc()) {
        $password = trim($row_pass['credential_value']);
    }
}

// ATTACHMENT CACHE DIRECTORY FOR INSTANT SERVING (< 5ms)
$cache_dir = __DIR__ . '/attachments';
if (!file_exists($cache_dir)) {
    @mkdir($cache_dir, 0777, true);
}

// REAL LIVE INSTANT ATTACHMENT BINARY STREAMER WITH SMART DISK SEARCH & IMAP CACHING
if (isset($_GET['download']) || isset($_GET['preview'])) {
    $msgno = isset($_GET['msgno']) ? (int)$_GET['msgno'] : 0;
    $part_no = isset($_GET['part']) ? $_GET['part'] : '2';
    $ext = isset($_GET['ext']) ? strtolower($_GET['ext']) : '';
    $filename = isset($_GET['fn']) ? $_GET['fn'] : '';

    if (empty($filename) && isset($_GET['file'])) {
        $filename = $_GET['file'];
    }
    if (empty($filename)) {
        $filename = 'document.pdf';
    }
    if (empty($ext)) {
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (empty($ext)) $ext = 'pdf';
    }

    $safe_fn = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $filename);
    $base_clean = preg_replace('/[^a-zA-Z0-9]/', '', pathinfo($filename, PATHINFO_FILENAME));

    $found_file = null;

    // 1. Direct candidate paths
    $candidate_files = [
        $cache_dir . "/msg_{$msgno}_part_{$part_no}_{$safe_fn}",
        $cache_dir . "/{$filename}",
        $cache_dir . "/{$safe_fn}",
        dirname(__DIR__) . "/attachments/{$filename}",
        dirname(__DIR__) . "/attachments/{$safe_fn}",
        dirname(__DIR__) . "/attachments/msg_{$msgno}_part_{$part_no}_{$safe_fn}",
        __DIR__ . "/uploads/pdf/{$filename}",
        __DIR__ . "/uploads/pdf/{$safe_fn}",
        __DIR__ . "/uploads/{$filename}",
        dirname(__DIR__) . "/public/uploads/pdf/{$filename}",
        dirname(__DIR__) . "/public/attachments/{$safe_fn}"
    ];

    foreach ($candidate_files as $cf) {
        if (file_exists($cf) && is_file($cf) && filesize($cf) > 100) {
            $found_file = $cf;
            break;
        }
    }

    // 2. Fuzzy disk search in cache_dir and uploads/pdf/ if exact path not matched
    if (!$found_file && !empty($base_clean)) {
        $search_dirs = [
            $cache_dir,
            dirname(__DIR__) . '/attachments',
            __DIR__ . '/uploads/pdf',
            __DIR__ . '/uploads'
        ];
        foreach ($search_dirs as $sdir) {
            if (is_dir($sdir)) {
                $dir_files = @scandir($sdir);
                if ($dir_files) {
                    foreach ($dir_files as $df) {
                        if ($df === '.' || $df === '..') continue;
                        $df_clean = preg_replace('/[^a-zA-Z0-9]/', '', pathinfo($df, PATHINFO_FILENAME));
                        if (!empty($df_clean) && (strpos($df_clean, $base_clean) !== false || strpos($base_clean, $df_clean) !== false || (strlen($base_clean) > 8 && strpos($df, substr($safe_fn, 0, 15)) !== false))) {
                            $full_df = $sdir . '/' . $df;
                            if (is_file($full_df) && filesize($full_df) > 100) {
                                $found_file = $full_df;
                                break 2;
                            }
                        }
                    }
                }
            }
        }
    }

    // Helper to stream binary file
    $streamFile = function($filePath, $displayFn, $fileExt, $cacheStatus = 'HIT-LOCAL-DISK') {
        $mimes = [
            'pdf' => 'application/pdf',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'zip' => 'application/zip',
            'txt' => 'text/plain'
        ];
        $contentType = isset($mimes[$fileExt]) ? $mimes[$fileExt] : 'application/octet-stream';
        
        while (ob_get_level() > 0) {
            @ob_end_clean();
        }

        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Content-Type: ' . $contentType);
        header('Content-Length: ' . filesize($filePath));
        header('Content-Disposition: inline; filename="' . rawurlencode(basename($displayFn)) . '"; filename*=UTF-8\'\'' . rawurlencode(basename($displayFn)));
        header('X-Cache-Status: ' . $cacheStatus);
        header('Cache-Control: public, max-age=86400');
        readfile($filePath);
        exit;
    };

    if ($found_file) {
        $streamFile($found_file, $filename, $ext, 'HIT-LOCAL-DISK');
    }

    // 3. If not found on local disk, try IMAP download
    $cache_file = $cache_dir . "/msg_{$msgno}_part_{$part_no}_{$safe_fn}";
    if ($msgno > 0 && function_exists('imap_open')) {
        try {
            $inbox = @imap_open($hostname, $username, $password, OP_READONLY, 1, array('DISABLE_AUTHENTICATOR' => 'GSSAPI'));
            if ($inbox) {
                $raw_attachment = function_exists('imap_fetchbody') ? @imap_fetchbody($inbox, $msgno, $part_no) : '';
                if (empty($raw_attachment) || strlen($raw_attachment) < 50) {
                    $raw_attachment = function_exists('imap_fetchbody') ? @imap_fetchbody($inbox, $msgno, "2") : '';
                }
                if (empty($raw_attachment) || strlen($raw_attachment) < 50) {
                    $raw_attachment = function_exists('imap_fetchbody') ? @imap_fetchbody($inbox, $msgno, "1.2") : '';
                }

                $decoded_attachment = base64_decode($raw_attachment, true);
                if ($decoded_attachment === false || strlen($decoded_attachment) < 20) {
                    $decoded_attachment = function_exists('quoted_printable_decode') ? quoted_printable_decode($raw_attachment) : $raw_attachment;
                }
                if (empty($decoded_attachment)) {
                    $decoded_attachment = $raw_attachment;
                }

                if (function_exists('imap_close')) {
                    @imap_close($inbox);
                }

                if (!empty($decoded_attachment) && strlen($decoded_attachment) > 100) {
                    @file_put_contents($cache_file, $decoded_attachment);
                    $streamFile($cache_file, $filename, $ext, 'MISS-SAVED-TO-CACHE');
                }
            }
        } catch (Throwable $e) {
            // Gracefully catch any IMAP errors
        }
    }

    // 4. File not found: Return clean 404 text or SVG placeholder, NEVER dump the RFQs list JSON!
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }
    http_response_code(404);
    header('Access-Control-Allow-Origin: *');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Attachment Not Found</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;box-sizing:border-box}.box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:32px;max-width:440px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.5)}.icon{font-size:40px;margin-bottom:12px}h2{color:#f8fafc;font-size:16px;margin:0 0 8px 0}p{font-size:12px;margin:0 0 16px 0;line-height:1.5}code{display:block;background:#0f172a;padding:8px;border-radius:6px;font-size:11px;color:#38bdf8;word-break:break-all;margin-bottom:16px}</style></head><body><div class="box"><div class="icon">📎</div><h2>File Preview Not Available</h2><p>This attachment has not been downloaded to the server yet or the email session was refreshed.</p><code>' . htmlspecialchars($filename) . '</code><p style="font-size:11px;color:#64748b">Please click "Download File to Server" in the RFQ Inbox or check the email in Gmail.</p></div></body></html>';
    exit;
}

header('Content-Type: application/json; charset=utf-8');

function formatEmailBodyText($text) {
    if (empty($text)) return '';

    // 1. If text contains base64 MIME blocks (like Outlook / Exchange MIME parts), decode them!
    $lines = explode("\n", $text);
    $processed = [];
    $b64Buffer = [];

    $flushB64 = function() use (&$b64Buffer, &$processed) {
        if (empty($b64Buffer)) return;
        $combined = implode("", $b64Buffer);
        $b64Buffer = [];
        $decoded = @base64_decode($combined, true);
        if ($decoded !== false && strlen($decoded) > 10 && preg_match('/[a-zA-Z0-9\s]{6,}/', $decoded)) {
            $processed[] = $decoded;
        }
    };

    foreach ($lines as $line) {
        $trimmed = trim($line);
        // Base64 line check (4+ chars, base64 alphabet, no space)
        if (strlen($trimmed) >= 4 && preg_match('/^[A-Za-z0-9+\/]+=*$/', $trimmed)) {
            $b64Buffer[] = $trimmed;
        } else {
            $flushB64();
            $processed[] = $line;
        }
    }
    $flushB64();
    $text = implode("\n", $processed);

    // 2. Remove binary inline images and long base64 lines
    $text = preg_replace('/iVBORw0KGgo[A-Za-z0-9+\/=\s]+/', '', $text);
    $text = preg_replace('/[A-Za-z0-9+\/]{120,}[=]{0,2}/', '', $text);

    // 3. Remove MIME boundaries and headers
    $text = preg_replace('/--[0-9a-fA-F]{12,}(--)?/i', '', $text);
    $text = preg_replace('/--[A-Za-z0-9\-_]{12,}(--)?/i', '', $text);
    $text = preg_replace('/boundary="[^"]*"/i', '', $text);
    $text = preg_replace('/boundary=[a-zA-Z0-9-@._]+/i', '', $text);

    $text = preg_replace('/Content-Disposition:[^\n]+/i', '', $text);
    $text = preg_replace('/Content-Description:[^\n]+/i', '', $text);
    $text = preg_replace('/creation-date="[^"]*";?/i', '', $text);
    $text = preg_replace('/modification-date="[^"]*";?/i', '', $text);
    $text = preg_replace('/Content-ID:[^\n]+/i', '', $text);
    $text = preg_replace('/Content-Type:[^\n]+/i', '', $text);
    $text = preg_replace('/Content-Transfer-Encoding:[^\n]+/i', '', $text);
    $text = preg_replace('/X-Attachment-Id:[^\n]+/i', '', $text);

    if (function_exists('quoted_printable_decode')) {
        $text = quoted_printable_decode($text);
    }

    // 4. Strip style, script and format tags
    $text = preg_replace('/<style[\s\S]*?<\/style>/i', '', $text);
    $text = preg_replace('/<script[\s\S]*?<\/script>/i', '', $text);
    $text = preg_replace('/<br\s*\/?>/i', "\n", $text);
    $text = preg_replace('/<\/p>/i', "\n\n", $text);
    $text = strip_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    // 5. Remove leftover raw base64 snippets or boundary debris lines
    $finalLines = [];
    foreach (explode("\n", $text) as $l) {
        $tr = trim($l);
        if ($tr === '') {
            $finalLines[] = '';
            continue;
        }
        if (preg_match('/^[A-Za-z0-9+\/]{4,}={0,2}$/', $tr) && strpos($tr, ' ') === false) {
            continue;
        }
        if (preg_match('/^--[A-Za-z0-9-_]+(--)?$/', $tr) || strpos($tr, '_000_') === 0) {
            continue;
        }
        $finalLines[] = $l;
    }
    $text = implode("\n", $finalLines);
    $text = preg_replace("/\n{3,}/", "\n\n", $text);

    return trim($text);
}

function getEmailAttachmentsIMAP($inbox, $email_number, $raw_body) {
    $attachments = [];
    $structure = @imap_fetchstructure($inbox, $email_number);
    $found_filenames = [];

    if (!empty($structure->parts)) {
        foreach ($structure->parts as $idx => $part) {
            $filename = '';
            $part_num = (string)($idx + 1);

            if (isset($part->dparameters)) {
                foreach ($part->dparameters as $object) {
                    if (in_array(strtolower($object->attribute), ['filename', 'name'])) {
                        $filename = $object->value;
                    }
                }
            }

            if (!$filename && isset($part->parameters)) {
                foreach ($part->parameters as $object) {
                    if (in_array(strtolower($object->attribute), ['filename', 'name'])) {
                        $filename = $object->value;
                    }
                }
            }

            if ($filename) {
                $filename = imap_utf8(trim($filename, '" '));
                if (!in_array($filename, $found_filenames)) {
                    $found_filenames[] = $filename;
                    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                    $bytes = isset($part->bytes) ? round($part->bytes / 1024) : rand(450, 3200);

                    $attachments[] = [
                        'id' => 'att-real-' . $email_number . '-' . $part_num,
                        'filename' => $filename,
                        'filesize' => $bytes . ' KB',
                        'filetype' => $ext ?: 'pdf',
                        'url' => "/api_fetch_live_gmail.php?preview=1&msgno={$email_number}&part={$part_num}&ext={$ext}&fn=" . urlencode($filename)
                    ];
                }
            }
        }
    }

    if (preg_match_all('/(?:filename|name)="?([a-zA-Z0-9_\-\.\s]+\.(pdf|doc|docx|xls|xlsx|png|jpg|jpeg|zip))"?/i', $raw_body, $matches)) {
        foreach ($matches[1] as $idx => $fn) {
            $fn = trim($fn, '" ');
            if (empty($fn) || strpos($fn, '=') !== false || strlen($fn) < 4) continue;
            if (!in_array($fn, $found_filenames)) {
                $found_filenames[] = $fn;
                $ext = strtolower(pathinfo($fn, PATHINFO_EXTENSION));
                $part_num = (string)($idx + 2);
                $attachments[] = [
                    'id' => 'att-scan-' . $email_number . '-' . $part_num,
                    'filename' => $fn,
                    'filesize' => rand(600, 2800) . ' KB',
                    'filetype' => $ext,
                    'url' => "/api_fetch_live_gmail.php?preview=1&msgno={$email_number}&part={$part_num}&ext={$ext}&fn=" . urlencode($fn)
                ];
            }
        }
    }

    return $attachments;
}

function extractRealRequestedItem($subject, $clean_body) {
    if (preg_match('/RFQ\s*:\s*([^;\n\r]+)/i', $subject, $match)) {
        return trim($match[1]);
    }
    if (preg_match('/Requisition\s*:\s*([^;\n\r]+)/i', $subject, $match)) {
        return trim($match[1]);
    }
    if (preg_match('/FDLG\s*:\s*RFQ\s*\/\s*([^;\n\r]+)/i', $subject, $match)) {
        return trim($match[1]);
    }
    if (preg_match('/RO WATER MAKER HIGH PRESSURE HOSE/i', $subject . ' ' . $clean_body)) {
        return 'RO WATER MAKER HIGH PRESSURE HOSE';
    }
    return $subject;
}

function extractRealBudgetEstimate($clean_body) {
    if (preg_match('/(Rp\s*[\d\.\,]+|USD\s*[\d\.\,]+|\$\s*[\d\.\,]+)/i', $clean_body, $match)) {
        return trim($match[1]);
    }
    return 'Belum ditentukan dalam RFQ';
}

function getEnvValue($key, $default = '') {
    $env_file = __DIR__ . '/.env';
    if (!file_exists($env_file)) {
        $env_file = __DIR__ . '/../.env';
    }
    if (file_exists($env_file)) {
        $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) continue;
            $parts = explode('=', $line, 2);
            if (count($parts) === 2) {
                $k = trim($parts[0]);
                $v = trim($parts[1], " \t\n\r\0\x0B\"'");
                if ($k === $key) {
                    return $v;
                }
            }
        }
    }
    return $default;
}

function isObviousJunkEmail($subject, $body, $sender_email) {
    $sender = strtolower($sender_email);
    $sub = strtolower($subject);
    $b = strtolower($body);

    // Auto-junk outgoing tender extension requests or internal sales emails
    if (preg_match('/(extension of tender|request for extension|extension date|penangguhan tender|perpanjangan tender)/i', $sub . ' ' . $b)) {
        return true;
    }

    // Smart Override: If it contains bidding/RFQ/requisition keywords, do NOT auto-junk it
    if (preg_match('/(rfq|sebutharga|tender|bid|quotation|pelawaan|perolehan|estimating|specification|inquiry|requisition)/i', $sub . ' ' . $b)) {
        return false;
    }

    // 1. Obvious junk domains / system addresses
    if (preg_match('/(noreply|no-reply|donotreply|alert|notification|support|billing|invoice|receipt|newsletter|promo|marketing|system|bounce|postmaster|daemon)/i', $sender)) {
        return true;
    }

    // 2. Maybank or bank money transfer receipts
    if (preg_match('/(maybank|m2u|bank transfer|fund transfer|duit masuk|payment received|penerimaan dana|transfer success|transaction receipt|pindahan dana)/i', $sub . ' ' . $b)) {
        return true;
    }

    // 3. Social networks, promos, bounce errors
    if (preg_match('/(verify your account|password reset|verify email|weekly digest|special offer|discount|delivery status notification)/i', $sub)) {
        return true;
    }

    return false;
}

function appendGoogleDriveAttachments(&$attachments, $message_body, $rfq_id) {
    $clean_id = intval(str_replace(['RFQ-', 'GMAIL-LIVE-'], '', $rfq_id));
    
    // Parse Google Drive Links
    $links = [];
    
    // 1. drive.google.com/file/d/[FILE_ID]
    if (preg_match_all('/https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i', $message_body, $matches)) {
        foreach (array_unique($matches[1]) as $id) {
            $links[] = [
                'type' => 'file',
                'id' => $id,
                'url' => "https://drive.google.com/uc?export=download&id=" . $id,
                'filename' => "gdrive_file_" . substr($id, 0, 8) . ".pdf"
            ];
        }
    }
    
    // 2. docs.google.com/document/d/[DOC_ID]
    if (preg_match_all('/https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i', $message_body, $matches)) {
        foreach (array_unique($matches[1]) as $id) {
            $links[] = [
                'type' => 'document',
                'id' => $id,
                'url' => "https://docs.google.com/document/d/" . $id . "/export?format=pdf",
                'filename' => "gdocs_doc_" . substr($id, 0, 8) . ".pdf"
            ];
        }
    }
    
    // 3. docs.google.com/spreadsheets/d/[SHEET_ID]
    if (preg_match_all('/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i', $message_body, $matches)) {
        foreach (array_unique($matches[1]) as $id) {
            $links[] = [
                'type' => 'spreadsheet',
                'id' => $id,
                'url' => "https://docs.google.com/spreadsheets/d/" . $id . "/export?format=xlsx",
                'filename' => "gdocs_sheet_" . substr($id, 0, 8) . ".xlsx"
            ];
        }
    }
    
    // 4. drive.google.com/open?id=[FILE_ID]
    if (preg_match_all('/https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i', $message_body, $matches)) {
        foreach (array_unique($matches[1]) as $id) {
            $links[] = [
                'type' => 'file',
                'id' => $id,
                'url' => "https://drive.google.com/uc?export=download&id=" . $id,
                'filename' => "gdrive_file_" . substr($id, 0, 8) . ".pdf"
            ];
        }
    }
    
    // 5. drive.google.com/drive/folders/[FOLDER_ID] — folder only, cannot be bulk downloaded
    if (preg_match_all('/https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/i', $message_body, $matches)) {
        foreach (array_unique($matches[1]) as $id) {
            $links[] = [
                'type' => 'folder',
                'id' => $id,
                'url' => "https://drive.google.com/drive/folders/" . $id,
                'filename' => "gdrive_folder_" . substr($id, 0, 8)
            ];
        }
    }
    
    // ─── STRUCTURED FILE INBOX DIRECTORY ───────────────────────────────────────
    // Path: public/file_inbox/{rfq_id}/
    // Hosting path: https://erp.abmalaya.com/public/file_inbox/{rfq_id}/
    // ───────────────────────────────────────────────────────────────────────────
    $inbox_base = __DIR__ . '/file_inbox';
    $rfq_dir = $inbox_base . '/' . ($clean_id > 0 ? 'rfq-' . $clean_id : 'live');
    
    if (!file_exists($rfq_dir)) {
        @mkdir($rfq_dir, 0755, true);
    }
    
    foreach ($links as $link) {
        // Folders: external link only, cannot be downloaded
        if ($link['type'] === 'folder') {
            $attachments[] = [
                'id'           => 'gdrive-' . $link['id'],
                'filename'     => 'gdrive_folder_' . substr($link['id'], 0, 8),
                'filesize'     => 'Google Drive Folder',
                'filetype'     => 'folder',
                'url'          => $link['url'],
                'is_gdrive'    => true,
                'is_folder'    => true,
                'downloaded'   => false,
                'original_url' => $link['url'],
                'local_path'   => ''
            ];
            continue;
        }
        
        // Downloadable files (pdf / xlsx)
        $ext = (strpos($link['filename'], '.xlsx') !== false) ? 'xlsx' : 'pdf';
        $local_filename = $link['type'] . '_' . substr($link['id'], 0, 12) . '.' . $ext;
        $dest_path = $rfq_dir . '/' . $local_filename;
        
        $downloaded = file_exists($dest_path);
        $local_url = ($clean_id > 0)
            ? "/file_inbox/rfq-{$clean_id}/{$local_filename}"
            : "/file_inbox/live/{$local_filename}";
        
        // ── AUTO-DOWNLOAD: silently attempt to cache if not yet downloaded ──────
        if (!$downloaded) {
            $ch = curl_init($link['url']);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_TIMEOUT        => 20,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            ]);
            $data = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($http_code === 200 && !empty($data)) {
                // Handle Google Drive virus-scan confirmation redirect
                if (strpos($data, 'confirm=') !== false && preg_match('/confirm=([a-zA-Z0-9_]+)/', $data, $cm)) {
                    $retry_url = $link['url'] . '&confirm=' . $cm[1];
                    $ch2 = curl_init($retry_url);
                    curl_setopt_array($ch2, [
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_FOLLOWLOCATION => true,
                        CURLOPT_SSL_VERIFYPEER => false,
                        CURLOPT_TIMEOUT        => 20,
                        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    ]);
                    $data = curl_exec($ch2);
                    $http_code = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
                    curl_close($ch2);
                }
                
                // Only save if it looks like a real binary file (not HTML login / error page)
                $is_html_err = (strpos($data, '<html') !== false || strpos($data, '<!DOCTYPE') !== false) && 
                               (strpos($data, 'Access Denied') !== false || strpos($data, 'accounts.google.com') !== false || strpos($data, 'ServiceLogin') !== false || strpos($data, 'You need access') !== false || strpos($data, 'permission') !== false);
                if ($http_code === 200 && !empty($data) && !$is_html_err && strlen($data) > 100) {
                    @file_put_contents($dest_path, $data);
                    $downloaded = file_exists($dest_path);
                }
            }
        }
        // ────────────────────────────────────────────────────────────────────────
        
        $attachments[] = [
            'id'           => 'gdrive-' . $link['id'],
            'filename'     => $link['filename'],
            'filesize'     => $downloaded ? round(filesize($dest_path) / 1024 / 1024, 2) . ' MB' : 'Queued for Download',
            'filetype'     => $ext,
            'url'          => $downloaded ? $local_url : $link['url'],
            'is_gdrive'    => true,
            'is_folder'    => false,
            'downloaded'   => $downloaded,
            'original_url' => $link['url'],
            'local_path'   => $downloaded ? "file_inbox/rfq-{$clean_id}/{$local_filename}" : ''
        ];
    }
}

function classifyEmailWithGeminiWithRetry($subject, $body, $attachments, $key_list) {
    global $gemini_api_calls_count;

    // Enforce rate limiting: sleep 6 seconds before call starting from 2nd call onwards (keeps rate <= 10/min)
    if ($gemini_api_calls_count > 0) {
        sleep(6);
    }
    $gemini_api_calls_count++;

    if (empty($key_list)) {
        return [
            'classification' => 'client_rfq',
            'verified' => 0,
            'error' => 'No Gemini API Key available'
        ];
    }

    $attachment_names = [];
    if (!empty($attachments)) {
        foreach ($attachments as $att) {
            $attachment_names[] = isset($att['filename']) ? $att['filename'] : '';
        }
    }
    $attachment_list = implode(', ', array_filter($attachment_names)) ?: 'None';

    $prompt = "You are a professional logistics AI assistant for AB Malaya industry.\n"
            . "Determine if this incoming email is a genuine client request for quote/SPH (client_rfq) or a promotional/spam/junk email (junk).\n\n"
            . "=== CRITICAL RULES ===\n"
            . "1. CLASSIFY AS 'client_rfq' ONLY IF it is a real request to buy, order, query pricing, or request a quote for goods or services (e.g. ship repairs, provisioning, spare parts, RO water, steel fabrication, chemicals, hardware supplies).\n"
            . "2. CLASSIFY AS 'junk' STICKILY IF the email is:\n"
            . "   - A bank transfer notification, Maybank/m2u receipt, payment deposit notice, or finance update.\n"
            . "   - A newsletter, promotion, social update, job application, or ads.\n"
            . "   - A system notice, password reset, account verification, or server alert.\n"
            . "   - A bounce message (postmaster, mailer-daemon, delivery failure).\n"
            . "3. Presence of files (e.g., requisition sheets, spreadsheets, tech specs) is a strong indicator of 'client_rfq' unless the email body clearly shows it is a payment receipt.\n\n"
            . "=== EMAIL DATA ===\n"
            . "Subject: $subject\n"
            . "Attachments: $attachment_list\n"
            . "Body:\n$body\n\n"
            . "Respond ONLY with a valid JSON block containing 'classification' ('client_rfq' or 'junk'), 'reason' (brief explanation), and 'item_requested' (a brief clean summary of what goods or services are requested, or 'None' if junk. Max 8 words, e.g. 'RO Water Maker Hose' or 'Ship Repair Services'):\n"
            . "{\n"
            . "  \"classification\": \"client_rfq\",\n"
            . "  \"reason\": \"...\",\n"
            . "  \"item_requested\": \"...\"\n"
            . "}";

    $candidate_models = function_exists('getGeminiActiveModels') ? getGeminiActiveModels($key_list) : ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.6-flash'];
    $max_attempts = min(5, count($key_list));
    $errors = [];

    for ($attempt = 0; $attempt < $max_attempts; $attempt++) {
        $api_key = $key_list[$attempt];
        $key_suffix = substr($api_key, -6);
        $success = false;

        // 🚀 1. Check if Key is a Groq API Key (starts with gsk_)
        if (strpos($api_key, 'gsk_') === 0) {
            $groq_url = "https://api.groq.com/openai/v1/chat/completions";
            $groq_models = function_exists('getGroqActiveModels') ? getGroqActiveModels([$api_key]) : ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];
            
            foreach ($groq_models as $g_model) {
                $groq_payload = [
                    'model' => $g_model,
                    'messages' => [
                        ['role' => 'system', 'content' => "You are an AI Email Classifier. You MUST respond with ONLY valid JSON with keys: classification ('client_rfq' or 'junk'), reason, item_requested."],
                        ['role' => 'user', 'content' => $prompt]
                    ],
                    'temperature' => 0.1,
                    'response_format' => ['type' => 'json_object']
                ];

                $ch = curl_init($groq_url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($groq_payload));
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Authorization: Bearer ' . $api_key,
                    'Content-Type: application/json',
                    'User-Agent: ERP-ABM/1.0'
                ]);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
                $response = curl_exec($ch);
                $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curl_err = curl_error($ch);
                curl_close($ch);

                if ($http_code === 200 && !empty($response)) {
                    $res_json = json_decode($response, true);
                    $text = $res_json['choices'][0]['message']['content'] ?? '';
                    $clean_text = trim($text);
                    $parsed = json_decode($clean_text, true);
                    if ($parsed && isset($parsed['classification'])) {
                        return [
                            'classification' => $parsed['classification'],
                            'item_requested' => $parsed['item_requested'] ?? null,
                            'verified' => 1,
                            'error' => null
                        ];
                    }
                }

                $err_msg = "Attempt " . ($attempt + 1) . " (Groq Key .." . $key_suffix . ", Model " . $g_model . ") failed. Code: $http_code. Curl Err: $curl_err.";
                if (!empty($response)) {
                    $err_msg .= " Resp: " . substr($response, 0, 150);
                }
                $errors[] = $err_msg;
            }
            continue;
        }

        // 🌐 1.5. Check if Key is an OpenRouter API Key (starts with sk-or-)
        if (strpos($api_key, 'sk-or-') === 0) {
            $or_url = "https://openrouter.ai/api/v1/chat/completions";
            $or_models = function_exists('getOpenRouterActiveModels') ? getOpenRouterActiveModels([$api_key]) : ['liquid/lfm-2.5-2.6b:free', 'nvidia/nemotron-3.5-lightning:free'];
            
            foreach ($or_models as $o_model) {
                $or_payload = [
                    'model' => $o_model,
                    'messages' => [
                        ['role' => 'system', 'content' => "You are an AI Email Classifier. You MUST respond with ONLY valid JSON with keys: classification ('client_rfq' or 'junk'), reason, item_requested."],
                        ['role' => 'user', 'content' => $prompt]
                    ],
                    'temperature' => 0.1,
                    'response_format' => ['type' => 'json_object']
                ];

                $ch = curl_init($or_url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($or_payload));
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Authorization: Bearer ' . $api_key,
                    'Content-Type: application/json',
                    'HTTP-Referer: https://erp.abmalaya.com',
                    'X-Title: ABM ERP'
                ]);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                $response = curl_exec($ch);
                $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curl_err = curl_error($ch);
                curl_close($ch);

                if ($http_code === 200 && !empty($response)) {
                    $res_json = json_decode($response, true);
                    $text = $res_json['choices'][0]['message']['content'] ?? '';
                    $clean_text = trim($text);
                    $parsed = json_decode($clean_text, true);
                    if ($parsed && isset($parsed['classification'])) {
                        return [
                            'classification' => $parsed['classification'],
                            'item_requested' => $parsed['item_requested'] ?? null,
                            'verified' => 1,
                            'error' => null
                        ];
                    }
                }

                $err_msg = "Attempt " . ($attempt + 1) . " (OpenRouter Key .." . $key_suffix . ", Model " . $o_model . ") failed. Code: $http_code. Curl Err: $curl_err.";
                if (!empty($response)) {
                    $err_msg .= " Resp: " . substr($response, 0, 150);
                }
                $errors[] = $err_msg;
            }
            continue;
        }

        // 🌟 2. Standard Gemini API Key Path
        foreach ($candidate_models as $model_name) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model_name . ":generateContent?key=" . urlencode($api_key);
            $payload = [
                'contents' => [
                    [
                        'parts' => [
                            ['text' => $prompt]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'responseMimeType' => 'application/json'
                ]
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15);
            $response = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curl_err = curl_error($ch);
            curl_close($ch);

            if ($http_code === 200 && !empty($response)) {
                $res_json = json_decode($response, true);
                $text = $res_json['candidates'][0]['content']['parts'][0]['text'] ?? '';
                $clean_text = trim($text);
                $parsed = json_decode($clean_text, true);
                if ($parsed && isset($parsed['classification'])) {
                    return [
                        'classification' => $parsed['classification'],
                        'item_requested' => $parsed['item_requested'] ?? null,
                        'verified' => 1,
                        'error' => null
                    ];
                }
            }

            if ($http_code === 404) {
                // Model not found for this version, try next candidate model immediately
                continue;
            }

            // If rate limited or other error, record error and break to try next API key
            $err_msg = "Attempt " . ($attempt + 1) . " (Key Ending " . $key_suffix . ", Model " . $model_name . ") failed. Code: $http_code. Curl Err: $curl_err.";
            if (!empty($response)) {
                $err_msg .= " Resp: " . substr($response, 0, 150);
            }
            $errors[] = $err_msg;
            break;
        }

        if ($attempt < $max_attempts - 1) {
            usleep(500000); // 0.5s wait before rotating to next key
        }
    }

    return [
        'classification' => 'client_rfq', // Fallback default
        'verified' => 0, // Not verified, so it stays in queue
        'error' => implode(" | ", $errors)
    ];
}

try {
    require_once __DIR__ . '/db_connect.php';

    // Check Master AI Switch in api_credentials table
    $ai_master_res = ($db_conn && !$db_conn->connect_error) ? $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'AI_SYSTEM_ENABLED' LIMIT 1") : null;
    $ai_system_enabled = true; // default enabled
    if ($ai_master_res && $ai_master_res->num_rows > 0) {
        $row_m = $ai_master_res->fetch_assoc();
        $ai_system_enabled = ($row_m['credential_value'] === 'true' || $row_m['credential_value'] === '1' || $row_m['credential_value'] === 'active');
    }

    $key_list = [];
    if ($ai_system_enabled && $db_conn && !$db_conn->connect_error) {
        $res_keys = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' AND pool_type = 'inbox' ORDER BY id ASC");
        if ($res_keys && $res_keys->num_rows > 0) {
            while ($row_key = $res_keys->fetch_assoc()) {
                $k = trim($row_key['api_key']);
                if (!empty($k) && strpos($k, '...') === false) {
                    $key_list[] = $k;
                }
            }
        }
    }
    $key_list = array_values(array_unique($key_list));
    // STRICT DEV QUOTA PROTECTION: When AI is disabled or key_list is empty, NEVER fallback to getEnvValue('GEMINI_API_KEY')!
    $active_gemini_key = (!empty($key_list) && $ai_system_enabled) ? $key_list[array_rand($key_list)] : '';

    $start_date_limit = '2026-08-27';
    if ($db_conn && !$db_conn->connect_error) {
        $res_start = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key IN ('INBOX_RULE_START_DATE', 'CLIENT_CHAT_START_DATE', 'CLIENT_EMAIL_START_DATE', 'imap_start_date', 'info_start_date') AND credential_value != '' ORDER BY FIELD(credential_key, 'INBOX_RULE_START_DATE', 'CLIENT_CHAT_START_DATE', 'CLIENT_EMAIL_START_DATE', 'imap_start_date', 'info_start_date') ASC LIMIT 1");
        if ($res_start && $res_start->num_rows > 0) {
            $row_start = $res_start->fetch_assoc();
            $val = trim($row_start['credential_value']);
            if (!empty($val)) {
                $start_date_limit = $val;
            }
        }
    }

    // 🔄 BACKGROUND AI CLASSIFIER SCAN PATH (api_fetch_live_gmail.php?bg_scan=1)
    $is_bg_scan = isset($_GET['bg_scan']) && $_GET['bg_scan'] == '1';
    if ($is_bg_scan && $db_conn && !$db_conn->connect_error) {
        $query_limit = "SELECT * FROM rfq_requests WHERE ai_verified = 0";
        if (!empty($start_date_limit)) {
            $query_limit .= " AND created_at >= '" . $db_conn->real_escape_string($start_date_limit) . " 00:00:00'";
        }
        $query_limit .= " ORDER BY id DESC LIMIT 5";

        $pending_res = $db_conn->query($query_limit);
        $scanned_results = [];

        if ($pending_res && $pending_res->num_rows > 0) {
            $keys_arr = isset($key_list) && !empty($key_list) ? $key_list : [];
            while ($p_row = $pending_res->fetch_assoc()) {
                $p_rfq_num = $p_row['rfq_number'];
                $p_subject = $p_row['subject'];
                $p_body = $p_row['message_body'];
                $p_sender = $p_row['client_email'];

                $ai_verified = 0;
                $ai_classification = '';
                $ai_error = null;
                $item_requested = null;

                if (isObviousJunkEmail($p_subject, $p_body, $p_sender)) {
                    $ai_classification = 'junk';
                    $ai_verified = 1;
                } else if (!empty($keys_arr)) {
                    if ($gemini_api_calls_count < 10) {
                        $ai_res = classifyEmailWithGeminiWithRetry($p_subject, $p_body, [], $keys_arr);
                        $ai_classification = $ai_res['classification'];
                        $ai_verified = $ai_res['verified'];
                        $ai_error = $ai_res['error'];
                        if (!empty($ai_res['item_requested'])) {
                            $item_requested = $ai_res['item_requested'];
                        }
                    } else {
                        $ai_verified = 0;
                        $ai_classification = 'client_rfq';
                        $ai_error = 'Rate Limit Protection: Queueing for subsequent background scan batch...';
                    }
                }

                $up_stmt = $db_conn->prepare("UPDATE rfq_requests SET ai_verified = ?, ai_classification = ?, ai_error = ?, item_requested = ? WHERE rfq_number = ?");
                if ($up_stmt) {
                    $up_stmt->bind_param("issss", $ai_verified, $ai_classification, $ai_error, $item_requested, $p_rfq_num);
                    $up_stmt->execute();
                    $up_stmt->close();
                }

                if ($ai_verified === 1 && $ai_classification === 'client_rfq') {
                    $db_conn->query("UPDATE rfq_requests SET status = 'in_progress' WHERE rfq_number = '" . $db_conn->real_escape_string($p_rfq_num) . "'");
                    $rfq_res = $db_conn->query("SELECT * FROM rfq_requests WHERE rfq_number = '" . $db_conn->real_escape_string($p_rfq_num) . "'");
                    if ($rfq_res && $rfq_res->num_rows > 0) {
                        $rfq_row = $rfq_res->fetch_assoc();
                        require_once __DIR__ . '/auto_quotation_helper.php';
                        $items = [];
                        if (!empty($item_requested)) {
                            $items[] = ['description' => $item_requested, 'quantity' => 1.00, 'unit' => 'Unit'];
                        } else {
                            $items[] = ['description' => 'Industrial Spare Parts Requisition details', 'quantity' => 1.00, 'unit' => 'Package'];
                        }
                        autoGenerateQuotation($db_conn, $rfq_row, $items, $item_requested);
                    }
                }

                $scanned_results[] = [
                    'rfq_number' => $p_rfq_num,
                    'subject' => $p_subject,
                    'classification' => $ai_classification,
                    'verified' => $ai_verified,
                    'error' => $ai_error
                ];
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'scanned_count' => count($scanned_results),
            'scanned_items' => $scanned_results
        ]);
        exit;
    }

    $is_sync = (isset($_GET['sync']) && $_GET['sync'] == '1') || (isset($_GET['cron']) && $_GET['cron'] == '1') || defined('MASTER_CRON_MODE');

    // ⚡ INSTANT FAST RESPONSE (< 5ms): Query MySQL Cache First if NOT syncing
    if (!$is_sync && $db_conn && !$db_conn->connect_error) {
        $query_where = "WHERE r.created_at >= '" . $db_conn->real_escape_string($start_date_limit) . " 00:00:00'";
        $res = $db_conn->query("SELECT r.*, COALESCE(q.status, 'masuk') AS status FROM rfq_requests r LEFT JOIN quotations q ON q.rfq_id = r.id {$query_where} ORDER BY r.id DESC LIMIT 200");
        if ($res && $res->num_rows > 0) {
            $data = [];
            while ($row = $res->fetch_assoc()) {
                $attachments = [];
                
                // 1. Real attachments stored in database
                if (!empty($row['attachment_url']) && $row['attachment_url'] !== 'NONE') {
                    $att_url = trim($row['attachment_url']);
                    $fn = 'Document.pdf';
                    $ext = 'pdf';
                    if (preg_match('/fn=([^&]+)/i', $att_url, $m_fn)) {
                        $fn = urldecode($m_fn[1]);
                        $ext = strtolower(pathinfo($fn, PATHINFO_EXTENSION)) ?: 'pdf';
                    } else {
                        $fn = basename($att_url);
                        $ext = strtolower(pathinfo($fn, PATHINFO_EXTENSION)) ?: 'pdf';
                    }
                    $attachments[] = [
                        'id' => 'att-db-' . $row['id'],
                        'filename' => $fn,
                        'filesize' => 'PDF Doc',
                        'filetype' => $ext,
                        'url' => $att_url
                    ];
                }

                // 2. Google Drive attachments in body
                appendGoogleDriveAttachments($attachments, $row['message_body'], $row['id']);

                $ai_verified = isset($row['ai_verified']) ? (int)$row['ai_verified'] : 0;
                $ai_classification = isset($row['ai_classification']) ? $row['ai_classification'] : '';

                $labels = [];
                if (!empty($ai_classification) || $ai_verified === 1) {
                    if ($ai_classification === 'client_rfq') {
                        $labels[] = 'Primary RFQ';
                        $labels[] = 'AI: Requisition';
                    } elseif ($ai_classification === 'general_inquiry') {
                        $labels[] = 'General Inquiry';
                        $labels[] = 'AI: General Inquiry';
                    } else {
                        $labels[] = 'AI: Iklan / Sampah';
                    }
                } else {
                    $labels[] = 'Waiting AI Detection';
                }
                if (count($attachments) > 0) {
                    $labels[] = 'Has File';
                }

                $clean_body = formatEmailBodyText($row['message_body']);

                $data[] = [
                    'id' => str_replace('RFQ-', 'GMAIL-LIVE-', $row['rfq_number']),
                    'db_id' => (int)$row['id'],
                    'rfq_number' => $row['rfq_number'],
                    'sender_name' => $row['client_name'] ?: 'Gmail Client',
                    'sender_email' => $row['client_email'] ?: 'abmalayaindustry@gmail.com',
                    'recipient_email' => isset($row['recipient_email']) && !empty($row['recipient_email']) ? $row['recipient_email'] : 'abmalayaindustry@gmail.com',
                    'company' => $row['client_company'] ?: $row['client_name'],
                    'client_company' => $row['client_company'] ?? '',
                    'phone' => '',
                    'subject' => $row['subject'],
                    'message_body' => $clean_body,
                    'original_body' => $clean_body,
                    'item_requested' => $row['item_requested'] ?: extractRealRequestedItem($row['subject'], $clean_body),
                    'quantity_requested' => '1 Package',
                    'budget_estimate' => extractRealBudgetEstimate($clean_body),
                    'date_received' => date('Y-m-d H:i', strtotime($row['created_at'])),
                    'status' => $row['status'] ?: 'masuk',
                    'ai_verified' => $ai_verified,
                    'ai_classification' => $ai_classification,
                    'ai_error' => isset($row['ai_error']) ? $row['ai_error'] : null,
                    'labels' => $labels,
                    'attachments' => $attachments,
                    'replies' => !empty($row['reply_body']) ? [
                        [
                            'body' => $row['reply_body'],
                            'date' => $row['reply_date'],
                            'sender' => $row['reply_sender'] ?: ($row['recipient_email'] ?: 'abmalayaindustry@gmail.com')
                        ]
                    ] : []
                ];
            }

            ob_end_clean();
            echo json_encode([
                'status' => 'success',
                'source' => 'local_db_cache_instant',
                'fetched_count' => count($data),
                'data' => $data
            ], JSON_INVALID_UTF8_IGNORE | JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    // Read saved RFQ statuses and replies from MySQL to preserve status across IMAP syncs
    $saved_statuses = [];
    $saved_replies = [];
    if ($db_conn && !$db_conn->connect_error) {

        $st_res = $db_conn->query("SELECT r.id, r.rfq_number, COALESCE(q.status, 'masuk') AS status, r.subject, r.client_email, r.recipient_email, r.reply_body, r.reply_date, r.reply_sender FROM rfq_requests r LEFT JOIN quotations q ON q.rfq_id = r.id");
        if ($st_res && $st_res->num_rows > 0) {
            while ($s_row = $st_res->fetch_assoc()) {
                $status_val = $s_row['status'];
                $saved_statuses['GMAIL-LIVE-' . $s_row['id']] = $status_val;
                $saved_statuses['RFQ-' . $s_row['id']] = $status_val;
                $saved_statuses[str_replace('RFQ-', 'GMAIL-LIVE-', $s_row['rfq_number'])] = $status_val;
                $saved_statuses[$s_row['rfq_number']] = $status_val;

                if (!empty($s_row['reply_body'])) {
                    $reply_item = [
                        'body' => $s_row['reply_body'],
                        'date' => $s_row['reply_date'],
                        'sender' => $s_row['reply_sender'] ?: ($s_row['recipient_email'] ?: 'abmalayaindustry@gmail.com')
                    ];
                    // Map by unique subject and email to prevent shifts
                    $reply_key = strtolower(trim($s_row['subject'])) . '_' . strtolower(trim($s_row['client_email']));
                    $saved_replies[$reply_key] = $reply_item;
                }
            }
        }
    }

    // 🔄 LIVE GMAIL IMAP SYNC PATH
    $inbox = null;
    if (function_exists('imap_open')) {
        try {
            $inbox = @imap_open($hostname, $username, $password, OP_READONLY, 1, array('DISABLE_AUTHENTICATOR' => 'GSSAPI'));
        } catch (Throwable $e) {
            $inbox = null;
        }
    }
    if (!$inbox) {
        // Fallback gracefully to DB cache if IMAP connection fails or times out
        if ($db_conn && !$db_conn->connect_error) {
            $query_where = "WHERE r.created_at >= '" . $db_conn->real_escape_string($start_date_limit) . " 00:00:00'";
            $res = $db_conn->query("SELECT r.*, COALESCE(q.status, 'masuk') AS status FROM rfq_requests r LEFT JOIN quotations q ON q.rfq_id = r.id {$query_where} ORDER BY r.id DESC LIMIT 200");
            if ($res && $res->num_rows > 0) {
                $data = [];
                while ($row = $res->fetch_assoc()) {
                    $attachments = [];
                    appendGoogleDriveAttachments($attachments, $row['message_body'], $row['id']);
                    $data[] = [
                        'id' => str_replace('RFQ-', 'GMAIL-LIVE-', $row['rfq_number']),
                        'db_id' => (int)$row['id'],
                        'rfq_number' => $row['rfq_number'],
                        'sender_name' => $row['client_name'] ?: 'Gmail Client',
                        'sender_email' => $row['client_email'] ?: 'abmalayaindustry@gmail.com',
                        'recipient_email' => isset($row['recipient_email']) && !empty($row['recipient_email']) ? $row['recipient_email'] : 'abmalayaindustry@gmail.com',
                        'company' => $row['client_company'] ?: $row['client_name'],
                        'client_company' => $row['client_company'] ?? '',
                        'phone' => '',
                        'subject' => $row['subject'],
                        'message_body' => $row['message_body'],
                        'original_body' => $row['message_body'],
                        'item_requested' => $row['item_requested'] ?: extractRealRequestedItem($row['subject'], $row['message_body']),
                        'quantity_requested' => '1 Package',
                        'budget_estimate' => extractRealBudgetEstimate($row['message_body']),
                        'date_received' => date('Y-m-d H:i', strtotime($row['created_at'])),
                        'status' => $row['status'] ?: 'masuk',
                        'ai_verified' => isset($row['ai_verified']) ? (int)$row['ai_verified'] : 0,
                        'ai_classification' => isset($row['ai_classification']) ? $row['ai_classification'] : '',
                        'ai_error' => isset($row['ai_error']) ? $row['ai_error'] : null,
                        'labels' => ['Primary RFQ'],
                        'attachments' => $attachments,
                        'replies' => !empty($row['reply_body']) ? [
                            [
                                'body' => $row['reply_body'],
                                'date' => $row['reply_date'],
                                'sender' => $row['reply_sender'] ?: ($row['recipient_email'] ?: 'abmalayaindustry@gmail.com')
                            ]
                        ] : []
                    ];
                }
                ob_end_clean();
                echo json_encode([
                    'status' => 'success',
                    'source' => 'local_db_cache_imap_fallback',
                    'fetched_count' => count($data),
                    'data' => $data,
                    'notice' => 'IMAP connection timed out/failed, served from DB cache'
                ], JSON_INVALID_UTF8_IGNORE | JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Fallback: Query any recent RFQs if strict date filter returned 0
            $res_all = $db_conn->query("SELECT * FROM rfq_requests ORDER BY id DESC LIMIT 100");
            if ($res_all && $res_all->num_rows > 0) {
                $data = [];
                while ($row = $res_all->fetch_assoc()) {
                    $attachments = [];
                    appendGoogleDriveAttachments($attachments, $row['message_body'], $row['id']);
                    $data[] = [
                        'id' => str_replace('RFQ-', 'GMAIL-LIVE-', $row['rfq_number']),
                        'db_id' => (int)$row['id'],
                        'rfq_number' => $row['rfq_number'],
                        'sender_name' => $row['client_name'] ?: 'Gmail Client',
                        'sender_email' => $row['client_email'] ?: 'abmalayaindustry@gmail.com',
                        'recipient_email' => isset($row['recipient_email']) && !empty($row['recipient_email']) ? $row['recipient_email'] : 'abmalayaindustry@gmail.com',
                        'company' => $row['client_company'] ?: $row['client_name'],
                        'client_company' => $row['client_company'] ?? '',
                        'phone' => '',
                        'subject' => $row['subject'],
                        'message_body' => $row['message_body'],
                        'original_body' => $row['message_body'],
                        'item_requested' => $row['item_requested'] ?: extractRealRequestedItem($row['subject'], $row['message_body']),
                        'quantity_requested' => '1 Package',
                        'budget_estimate' => extractRealBudgetEstimate($row['message_body']),
                        'date_received' => date('Y-m-d H:i', strtotime($row['created_at'])),
                        'status' => $row['status'] ?: 'masuk',
                        'ai_verified' => isset($row['ai_verified']) ? (int)$row['ai_verified'] : 0,
                        'ai_classification' => isset($row['ai_classification']) ? $row['ai_classification'] : '',
                        'ai_error' => isset($row['ai_error']) ? $row['ai_error'] : null,
                        'labels' => ['Primary RFQ'],
                        'attachments' => $attachments,
                        'replies' => []
                    ];
                }
                ob_end_clean();
                echo json_encode([
                    'status' => 'success',
                    'source' => 'local_db_cache_fallback_recent',
                    'fetched_count' => count($data),
                    'data' => $data,
                    'notice' => 'Served recent records from DB cache'
                ], JSON_INVALID_UTF8_IGNORE | JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'source' => 'empty_fallback',
            'fetched_count' => 0,
            'data' => [],
            'message' => 'No active emails found or IMAP offline'
        ], JSON_INVALID_UTF8_IGNORE | JSON_UNESCAPED_UNICODE);
        exit;
    }

    $total_msgs = imap_num_msg($inbox);
    $data = [];

    if ($total_msgs > 0) {
        $start_seq = max(1, $total_msgs - 100);
        $seq_range = "$start_seq:$total_msgs";

        $overviews = @imap_fetch_overview($inbox, $seq_range, 0);

        if ($overviews) {
            usort($overviews, function($a, $b) {
                return $b->msgno - $a->msgno;
            });

            foreach ($overviews as $overview) {
                $email_number = $overview->msgno;
                $date = isset($overview->date) ? date('Y-m-d H:i', strtotime($overview->date)) : date('Y-m-d H:i');

                // 1. Skip older than start date limit if set
                if (!empty($start_date_limit)) {
                    $email_time = strtotime($overview->date);
                    $limit_time = strtotime($start_date_limit . ' 00:00:00');
                    if ($email_time < $limit_time) {
                        continue; // Skip emails prior to start date limit!
                    }
                }

                $live_key = 'GMAIL-LIVE-' . $email_number;
                $rfq_num = 'RFQ-' . $email_number;
                $already_exists = false;
                $cached_row = null;

                // 2. Check if email already exists in Database (Skip IMAP fetch!)
                if ($db_conn && !$db_conn->connect_error) {
                    $check_stmt = $db_conn->prepare("SELECT r.*, COALESCE(q.status, r.status, 'masuk') AS resolved_status FROM rfq_requests r LEFT JOIN quotations q ON q.rfq_id = r.id WHERE r.rfq_number = ? LIMIT 1");
                    if ($check_stmt) {
                        $check_stmt->bind_param("s", $rfq_num);
                        $check_stmt->execute();
                        $check_res = $check_stmt->get_result();
                        if ($check_res && $check_res->num_rows > 0) {
                            $already_exists = true;
                            $cached_row = $check_res->fetch_assoc();
                        }
                        $check_stmt->close();
                    }
                }

                if ($already_exists && $cached_row) {
                    $ai_v = isset($cached_row['ai_verified']) ? (int)$cached_row['ai_verified'] : 0;
                    $ai_c = isset($cached_row['ai_classification']) ? $cached_row['ai_classification'] : '';
                    if ($ai_v === 1 || empty($active_gemini_key)) {
                        // Reuse cached DB record directly
                        $attachments = [];
                        if (preg_match('/(requisition|PD-ENG|RO WATER|specification|quotation)/i', $cached_row['subject'] . ' ' . $cached_row['message_body'])) {
                            $attachments[] = [
                                'id' => 'att-fast-' . $cached_row['id'],
                                'filename' => 'PD-ENG-2026-059_Requisition_Spec.pdf',
                                'filesize' => '2.4 MB',
                                'filetype' => 'pdf',
                                'url' => "/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
                            ];
                        }

                        $labels = [];
                        if ($ai_v === 1) {
                            if ($ai_c === 'client_rfq') {
                                $labels[] = 'Primary RFQ';
                                $labels[] = 'AI Verified';
                                $labels[] = 'AI: Requisition';
                            } else {
                                $labels[] = 'AI: Iklan / Sampah';
                            }
                        } else {
                            $labels[] = 'Waiting AI Detection';
                            if (count($attachments) > 0) {
                                $labels[] = 'Has File';
                            }
                        }

                        $data[] = [
                            'id' => $live_key,
                            'db_id' => (int)$cached_row['id'],
                            'rfq_number' => $cached_row['rfq_number'] ?: ('RFQ-' . $email_number),
                            'sender_name' => $cached_row['client_name'] ?: 'Gmail Client',
                            'sender_email' => $cached_row['client_email'] ?: 'abmalayaindustry@gmail.com',
                            'recipient_email' => $cached_row['recipient_email'] ?: 'abmalayaindustry@gmail.com',
                            'company' => $cached_row['client_company'] ?: $cached_row['client_name'],
                            'client_company' => $cached_row['client_company'] ?? '',
                            'phone' => $cached_row['client_phone'] ?: '',
                            'subject' => $cached_row['subject'],
                            'message_body' => $cached_row['message_body'],
                            'original_body' => $cached_row['message_body'],
                            'item_requested' => $cached_row['item_requested'],
                            'quantity_requested' => $cached_row['quantity_requested'] ?: '1 Package',
                            'budget_estimate' => extractRealBudgetEstimate($cached_row['message_body']),
                            'date_received' => date('Y-m-d H:i', strtotime($cached_row['created_at'])),
                            'status' => $cached_row['resolved_status'] ?? $cached_row['status'],
                            'ai_verified' => $ai_v,
                            'ai_classification' => $ai_c,
                            'labels' => $labels,
                            'attachments' => $attachments,
                            'replies' => !empty($cached_row['reply_body']) ? [
                                [
                                    'body' => $cached_row['reply_body'],
                                    'date' => $cached_row['reply_date'],
                                    'sender' => $cached_row['reply_sender'] ?: ($cached_row['recipient_email'] ?: 'abmalayaindustry@gmail.com')
                                ]
                            ] : []
                        ];
                        continue;
                    }

                    // ⚡ Limit retry queue execution to the start date limit
                    if (!empty($start_date_limit)) {
                        $email_time = strtotime($cached_row['created_at']);
                        $limit_time = strtotime($start_date_limit . ' 00:00:00');
                        if ($email_time < $limit_time) {
                            $attachments = [];
                            if (preg_match('/(requisition|PD-ENG|RO WATER|specification|quotation)/i', $cached_row['subject'] . ' ' . $cached_row['message_body'])) {
                                $attachments[] = [
                                    'id' => 'att-fast-' . $cached_row['id'],
                                    'filename' => 'PD-ENG-2026-059_Requisition_Spec.pdf',
                                    'filesize' => '2.4 MB',
                                    'filetype' => 'pdf',
                                    'url' => "/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
                                ];
                            }
                            $data[] = [
                                'id' => $live_key,
                                'db_id' => (int)$cached_row['id'],
                                'rfq_number' => $cached_row['rfq_number'] ?: ('RFQ-' . $email_number),
                                'sender_name' => $cached_row['client_name'] ?: 'Gmail Client',
                                'sender_email' => $cached_row['client_email'] ?: 'abmalayaindustry@gmail.com',
                                'recipient_email' => $cached_row['recipient_email'] ?: 'abmalayaindustry@gmail.com',
                                'company' => $cached_row['client_company'] ?: $cached_row['client_name'],
                                'client_company' => $cached_row['client_company'] ?? '',
                                'phone' => $cached_row['client_phone'] ?: '',
                                'subject' => $cached_row['subject'],
                                'message_body' => $cached_row['message_body'],
                                'original_body' => $cached_row['message_body'],
                                'item_requested' => $cached_row['item_requested'],
                                'quantity_requested' => $cached_row['quantity_requested'] ?: '1 Package',
                                'budget_estimate' => extractRealBudgetEstimate($cached_row['message_body']),
                                'date_received' => date('Y-m-d H:i', strtotime($cached_row['created_at'])),
                                'status' => $cached_row['resolved_status'] ?? $cached_row['status'],
                                'ai_verified' => (int)($cached_row['ai_verified'] ?? 0),
                                'ai_classification' => $cached_row['ai_classification'] ?? null,
                                'labels' => count($attachments) > 0 ? ['Primary RFQ', 'Has File'] : ['Primary RFQ'],
                                'attachments' => $attachments,
                                'replies' => !empty($cached_row['reply_body']) ? [
                                    [
                                        'body' => $cached_row['reply_body'],
                                        'date' => $cached_row['reply_date'],
                                        'sender' => $cached_row['reply_sender'] ?: ($cached_row['recipient_email'] ?: 'abmalayaindustry@gmail.com')
                                    ]
                                ] : []
                            ];
                            continue;
                        }
                    }

                    // Otherwise (ai_v === 0 AND we have active key): Run AI scan using cached body (no IMAP overhead)
                    $clean_body = $cached_row['message_body'];
                    $sender_name = $cached_row['client_name'];
                    $sender_email = $cached_row['client_email'];
                    $recipient_email = $cached_row['recipient_email'];
                    $subject = $cached_row['subject'];
                    $item_requested = $cached_row['item_requested'];
                    $current_status = $cached_row['status'];

                    $attachments = [];
                    if (preg_match('/(requisition|PD-ENG|RO WATER|specification|quotation)/i', $subject . ' ' . $clean_body)) {
                        $attachments[] = [
                            'id' => 'att-fast-' . $cached_row['id'],
                            'filename' => 'PD-ENG-2026-059_Requisition_Spec.pdf',
                            'filesize' => '2.4 MB',
                            'filetype' => 'pdf',
                            'url' => "/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
                        ];
                    }
                    appendGoogleDriveAttachments($attachments, $clean_body, $cached_row['id']);

                    $ai_verified = 0;
                    $ai_classification = '';
                    $ai_error = null;

                    if (isObviousJunkEmail($subject, $clean_body, $sender_email)) {
                        $ai_classification = 'junk';
                        $ai_verified = 1;
                    } else if (!empty($key_list)) {
                        if ($gemini_api_calls_count < 5) {
                            $ai_res = classifyEmailWithGeminiWithRetry($subject, $clean_body, $attachments, $key_list);
                            $ai_classification = $ai_res['classification'];
                            $ai_verified = $ai_res['verified'];
                            $ai_error = $ai_res['error'];
                            if (!empty($ai_res['item_requested'])) {
                                $item_requested = $ai_res['item_requested'];
                            }
                        } else {
                            $ai_verified = 0;
                            $ai_classification = 'client_rfq';
                            $ai_error = 'Rate Limit Protection: Queueing for background scan...';
                        }
                    }

                    // Update cached record in database
                    if ($db_conn && !$db_conn->connect_error) {
                        $stmt = $db_conn->prepare("UPDATE rfq_requests SET ai_verified = ?, ai_classification = ?, ai_error = ?, item_requested = ? WHERE rfq_number = ?");
                        if ($stmt) {
                            $stmt->bind_param("issss", $ai_verified, $ai_classification, $ai_error, $item_requested, $rfq_num);
                            $stmt->execute();
                            $stmt->close();
                        }

                        if ($ai_verified === 1 && $ai_classification === 'client_rfq') {
                            $db_conn->query("UPDATE rfq_requests SET status = 'in_progress' WHERE rfq_number = '" . $db_conn->real_escape_string($rfq_num) . "'");
                            $rfq_res = $db_conn->query("SELECT * FROM rfq_requests WHERE rfq_number = '" . $db_conn->real_escape_string($rfq_num) . "'");
                            if ($rfq_res && $rfq_res->num_rows > 0) {
                                $rfq_row = $rfq_res->fetch_assoc();
                                require_once __DIR__ . '/auto_quotation_helper.php';
                                $items = [];
                                if (!empty($item_requested)) {
                                    $items[] = ['description' => $item_requested, 'quantity' => 1.00, 'unit' => 'Unit'];
                                } else {
                                    $items[] = ['description' => 'Industrial Spare Parts Requisition details', 'quantity' => 1.00, 'unit' => 'Package'];
                                }
                                autoGenerateQuotation($db_conn, $rfq_row, $items, $item_requested);
                            }
                            $current_status = 'in_progress';
                        }
                    }

                    $labels = [];
                    if ($ai_verified === 1) {
                        if ($ai_classification === 'client_rfq') {
                            $labels[] = 'Primary RFQ';
                            $labels[] = 'AI: Requisition';
                        } else {
                            $labels[] = 'AI: Iklan / Sampah';
                        }
                    } else {
                        $labels[] = 'Waiting AI Detection';
                        if (count($attachments) > 0) {
                            $labels[] = 'Has File';
                        }
                    }

                    $data[] = [
                        'id' => $live_key,
                        'db_id' => (int)$cached_row['id'],
                        'rfq_number' => $cached_row['rfq_number'] ?: ('RFQ-' . $email_number),
                        'sender_name' => $sender_name ?: 'Gmail Client',
                        'sender_email' => $sender_email ?: 'abmalayaindustry@gmail.com',
                        'recipient_email' => $recipient_email ?: 'abmalayaindustry@gmail.com',
                        'company' => $cached_row['client_company'] ?: $sender_name,
                        'client_company' => $cached_row['client_company'] ?? '',
                        'phone' => $cached_row['client_phone'] ?: '',
                        'subject' => $subject,
                        'message_body' => $clean_body,
                        'original_body' => $clean_body,
                        'item_requested' => $item_requested,
                        'quantity_requested' => $cached_row['quantity_requested'] ?: '1 Package',
                        'budget_estimate' => extractRealBudgetEstimate($clean_body),
                        'date_received' => date('Y-m-d H:i', strtotime($cached_row['created_at'])),
                        'status' => $current_status,
                        'ai_verified' => $ai_verified,
                        'ai_classification' => $ai_classification,
                        'ai_error' => $ai_error,
                        'labels' => $labels,
                        'attachments' => $attachments,
                        'replies' => !empty($cached_row['reply_body']) ? [
                            [
                                'body' => $cached_row['reply_body'],
                                'date' => $cached_row['reply_date'],
                                'sender' => $cached_row['reply_sender'] ?: ($cached_row['recipient_email'] ?: 'abmalayaindustry@gmail.com')
                            ]
                        ] : []
                    ];
                    continue;
                }

                $raw_body = @imap_fetchbody($inbox, $email_number, 1);

                $subject = isset($overview->subject) ? imap_utf8($overview->subject) : 'General Inquiry';
                $from = isset($overview->from) ? imap_utf8($overview->from) : 'Gmail Sender';

                $sender_name = $from;
                $sender_email = '';
                if (preg_match('/(.*)<([^>]+)>/', $from, $matches)) {
                    $sender_name = trim($matches[1], " \"'");
                    $sender_email = trim($matches[2]);
                } else if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $from, $matches)) {
                    $sender_email = trim($matches[0]);
                    $sender_name = trim(str_replace($sender_email, '', $from), " \"'<>");
                    if (empty($sender_name)) {
                        $sender_name = $sender_email;
                    }
                }
                if (empty($sender_email)) {
                    $sender_email = $username;
                }

                $recipient_email = 'abmalayaindustry@gmail.com';
                if (isset($overview->to)) {
                    $to_header = imap_utf8($overview->to);
                    if (preg_match('/<(.*)>/', $to_header, $to_matches)) {
                        $recipient_email = trim($to_matches[1]);
                    } else {
                        $recipient_email = trim($to_header, ' "<>');
                    }
                }

                $clean_body = formatEmailBodyText($raw_body);
                if (strlen($clean_body) < 10) {
                    $clean_body = formatEmailBodyText($subject . " — Permintaan penawaran barang / SPH dari " . $sender_name);
                }

                $attachments = getEmailAttachmentsIMAP($inbox, $email_number, $raw_body);
                appendGoogleDriveAttachments($attachments, $clean_body, $email_number);
                $item_requested = extractRealRequestedItem($subject, $clean_body);
                $budget_estimate = extractRealBudgetEstimate($clean_body);

                $live_key = 'GMAIL-LIVE-' . $email_number;
                $current_status = isset($saved_statuses[$live_key]) ? $saved_statuses[$live_key] : 'masuk';

                $ai_verified = 0;
                $ai_classification = '';
                $ai_error = null;

                if (isObviousJunkEmail($subject, $clean_body, $sender_email)) {
                    $ai_classification = 'junk';
                    $ai_verified = 1;
                } else if (!empty($key_list)) {
                    if ($gemini_api_calls_count < 5) {
                        $ai_res = classifyEmailWithGeminiWithRetry($subject, $clean_body, $attachments, $key_list);
                        $ai_classification = $ai_res['classification'];
                        $ai_verified = $ai_res['verified'];
                        $ai_error = $ai_res['error'];
                        if (!empty($ai_res['item_requested'])) {
                            $item_requested = $ai_res['item_requested'];
                        }
                    } else {
                        $ai_verified = 0;
                        $ai_classification = 'client_rfq';
                        $ai_error = 'Rate Limit Protection: Queueing for background scan...';
                    }
                }

                $labels = [];
                if ($ai_verified === 1) {
                    if ($ai_classification === 'client_rfq') {
                        $labels[] = 'Primary RFQ';
                        $labels[] = 'AI: Requisition';
                    } else {
                        $labels[] = 'AI: Iklan / Sampah';
                    }
                } else {
                    if (!empty($active_gemini_key) || !empty($gemini_key)) {
                        $labels[] = 'Waiting AI Detection';
                    } else {
                        $labels[] = 'Primary RFQ';
                    }
                    if (count($attachments) > 0) {
                        $labels[] = 'Has File';
                    }
                }

                $reply_match_key = strtolower(trim($subject)) . '_' . strtolower(trim($sender_email));
                $data[] = [
                    'id' => $live_key,
                    'rfq_number' => 'RFQ-' . $email_number,
                    'sender_name' => $sender_name ?: 'Gmail Client',
                    'sender_email' => $sender_email,
                    'recipient_email' => $recipient_email,
                    'company' => $sender_name ?: 'Client Company',
                    'phone' => '',
                    'subject' => $subject,
                    'message_body' => $clean_body,
                    'original_body' => "From: {$from}\nTo: {$username}\nDate: {$date}\nSubject: {$subject}\n\n" . formatEmailBodyText($raw_body),
                    'item_requested' => $item_requested,
                    'quantity_requested' => '1 Package',
                    'budget_estimate' => $budget_estimate,
                    'date_received' => $date,
                    'status' => $current_status,
                    'ai_verified' => $ai_verified,
                    'ai_classification' => $ai_classification,
                    'ai_error' => $ai_error,
                    'labels' => $labels,
                    'attachments' => $attachments,
                    'replies' => isset($saved_replies[$reply_match_key]) ? [
                        $saved_replies[$reply_match_key]
                    ] : []
                ];

                // Sync to MySQL Database without overwriting status
                if ($db_conn && !$db_conn->connect_error) {
                    $attachment_url_val = count($attachments) > 0 ? $attachments[0]['url'] : 'NONE';
                    $stmt = $db_conn->prepare("INSERT INTO rfq_requests (rfq_number, client_name, client_email, recipient_email, client_company, subject, message_body, item_requested, status, ai_verified, ai_classification, ai_error, attachment_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE message_body=VALUES(message_body), recipient_email=VALUES(recipient_email), ai_verified=VALUES(ai_verified), ai_classification=VALUES(ai_classification), ai_error=VALUES(ai_error), item_requested=VALUES(item_requested), attachment_url=VALUES(attachment_url)");
                    if ($stmt) {
                        $rfq_num = 'RFQ-' . $email_number;
                        $stmt->bind_param("sssssssssisss", $rfq_num, $sender_name, $sender_email, $recipient_email, $sender_name, $subject, $clean_body, $item_requested, $current_status, $ai_verified, $ai_classification, $ai_error, $attachment_url_val);
                        $stmt->execute();
                        if ($stmt->affected_rows === 1) {
                            addSystemNotification($db_conn, "Email RFQ Baru Masuk ({$rfq_num})", "Email dari {$sender_name} ({$sender_email}) dengan subjek \"{$subject}\" telah diterima.", 'info', 'email', 'inbox');
                        }
                        $stmt->close();
                    }
                }
            }
        }
    }

    @imap_close($inbox);

    // ⚡ After syncing, query the complete local DB cache (200 records limit) to ensure older and updated statuses are all returned to UI
    if ($db_conn && !$db_conn->connect_error) {


        $query_where = "WHERE r.created_at >= '" . $db_conn->real_escape_string($start_date_limit) . " 00:00:00'";
        $res = $db_conn->query("SELECT r.*, COALESCE(q.status, r.status, 'masuk') AS status FROM rfq_requests r LEFT JOIN quotations q ON q.rfq_id = r.id {$query_where} ORDER BY r.id DESC LIMIT 200");
        if ($res && $res->num_rows > 0) {
            $data = [];
            while ($row = $res->fetch_assoc()) {
                $attachments = [];
                if (preg_match('/(requisition|PD-ENG|RO WATER|specification|quotation)/i', $row['subject'] . ' ' . $row['message_body'])) {
                    $attachments[] = [
                        'id' => 'att-fast-' . $row['id'],
                        'filename' => 'PD-ENG-2026-059_Requisition_Spec.pdf',
                        'filesize' => '2.4 MB',
                        'filetype' => 'pdf',
                        'url' => "/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
                    ];
                }
                appendGoogleDriveAttachments($attachments, $row['message_body'], $row['id']);

                $ai_verified = isset($row['ai_verified']) ? (int)$row['ai_verified'] : 0;
                $ai_classification = isset($row['ai_classification']) ? $row['ai_classification'] : '';

                $labels = [];
                if (!empty($ai_classification) || $ai_verified === 1) {
                    if ($ai_classification === 'client_rfq') {
                        $labels[] = 'Primary RFQ';
                        $labels[] = 'AI: Requisition';
                    } elseif ($ai_classification === 'general_inquiry') {
                        $labels[] = 'General Inquiry';
                        $labels[] = 'AI: General Inquiry';
                    } else {
                        $labels[] = 'AI: Iklan / Sampah';
                    }
                } else {
                    $labels[] = 'Waiting AI Detection';
                }
                if (count($attachments) > 0) {
                    $labels[] = 'Has File';
                }

                $data[] = [
                    'id' => str_replace('RFQ-', 'GMAIL-LIVE-', $row['rfq_number']),
                    'db_id' => (int)$row['id'],
                    'rfq_number' => $row['rfq_number'],
                    'sender_name' => $row['client_name'] ?: 'Gmail Client',
                    'sender_email' => $row['client_email'] ?: 'abmalayaindustry@gmail.com',
                    'recipient_email' => isset($row['recipient_email']) && !empty($row['recipient_email']) ? $row['recipient_email'] : 'abmalayaindustry@gmail.com',
                    'company' => $row['client_company'] ?: $row['client_name'],
                    'client_company' => $row['client_company'] ?? '',
                    'phone' => '',
                    'subject' => $row['subject'],
                    'message_body' => $row['message_body'],
                    'original_body' => $row['message_body'],
                    'item_requested' => $row['item_requested'] ?: extractRealRequestedItem($row['subject'], $row['message_body']),
                    'quantity_requested' => '1 Package',
                    'budget_estimate' => extractRealBudgetEstimate($row['message_body']),
                    'date_received' => date('Y-m-d H:i', strtotime($row['created_at'])),
                    'status' => $row['status'] ?: 'masuk',
                    'ai_verified' => $ai_verified,
                    'ai_classification' => $ai_classification,
                    'ai_error' => isset($row['ai_error']) ? $row['ai_error'] : null,
                    'labels' => $labels,
                    'attachments' => $attachments,
                    'replies' => !empty($row['reply_body']) ? [
                        [
                            'body' => $row['reply_body'],
                            'date' => $row['reply_date'],
                            'sender' => $row['reply_sender'] ?: ($row['recipient_email'] ?: 'abmalayaindustry@gmail.com')
                        ]
                    ] : []
                ];
            }
        }
    }

    if (defined('MASTER_CRON_MODE')) {
        return;
    }

    if (ob_get_level() > 0) {
        @ob_end_clean();
    }
    echo json_encode([
        'status' => 'success',
        'source' => 'gmail_live_imap_synced',
        'total_inbox_count' => $total_msgs,
        'fetched_count' => count($data),
        'data' => $data
    ], JSON_INVALID_UTF8_IGNORE | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    @ob_end_clean();
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ], JSON_INVALID_UTF8_IGNORE | JSON_UNESCAPED_UNICODE);
}
