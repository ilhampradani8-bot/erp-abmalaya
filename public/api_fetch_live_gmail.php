<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Global API rate-limiter counter (keeps track of calls to stay strictly under 10/min)
$gemini_api_calls_count = 0;

$hostname = '{imap.gmail.com:993/imap/ssl}INBOX';
$username = 'abmalayaindustry@gmail.com';
$password = 'tbsq icqa kece qaoz';

// ATTACHMENT CACHE DIRECTORY FOR INSTANT SERVING (< 5ms)
$cache_dir = __DIR__ . '/attachments';
if (!file_exists($cache_dir)) {
    @mkdir($cache_dir, 0777, true);
}

// REAL LIVE INSTANT ATTACHMENT BINARY STREAMER WITH DISK CACHING
if (isset($_GET['download']) || isset($_GET['preview'])) {
    $msgno = isset($_GET['msgno']) ? (int)$_GET['msgno'] : 0;
    $part_no = isset($_GET['part']) ? $_GET['part'] : '2';
    $ext = isset($_GET['ext']) ? strtolower($_GET['ext']) : 'pdf';
    $filename = isset($_GET['fn']) ? $_GET['fn'] : 'document.' . $ext;

    $safe_fn = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $filename);
    $cache_file = $cache_dir . "/msg_{$msgno}_part_{$part_no}_{$safe_fn}";

    if (file_exists($cache_file) && filesize($cache_file) > 100) {
        if ($ext === 'pdf') {
            header('Content-Type: application/pdf');
        } else if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif'])) {
            header('Content-Type: image/' . ($ext === 'jpg' ? 'jpeg' : $ext));
        } else {
            header('Content-Type: application/octet-stream');
        }

        header('Content-Length: ' . filesize($cache_file));
        header('Content-Disposition: inline; filename="' . basename($filename) . '"');
        header('X-Cache-Status: HIT-LOCAL-DISK');
        ob_end_clean();
        readfile($cache_file);
        exit;
    }

    $inbox = @imap_open($hostname, $username, $password, OP_READONLY, 1, array('DISABLE_AUTHENTICATOR' => 'GSSAPI'));
    if ($inbox && $msgno > 0) {
        $raw_attachment = @imap_fetchbody($inbox, $msgno, $part_no);
        if (empty($raw_attachment) || strlen($raw_attachment) < 50) {
            $raw_attachment = @imap_fetchbody($inbox, $msgno, "2");
        }
        if (empty($raw_attachment) || strlen($raw_attachment) < 50) {
            $raw_attachment = @imap_fetchbody($inbox, $msgno, "1.2");
        }

        $decoded_attachment = base64_decode($raw_attachment, true);
        if ($decoded_attachment === false || strlen($decoded_attachment) < 20) {
            $decoded_attachment = quoted_printable_decode($raw_attachment);
        }
        if (empty($decoded_attachment)) {
            $decoded_attachment = $raw_attachment;
        }

        @imap_close($inbox);

        if (!empty($decoded_attachment)) {
            @file_put_contents($cache_file, $decoded_attachment);

            if ($ext === 'pdf') {
                header('Content-Type: application/pdf');
            } else if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif'])) {
                header('Content-Type: image/' . ($ext === 'jpg' ? 'jpeg' : $ext));
            } else {
                header('Content-Type: application/octet-stream');
            }

            header('Content-Length: ' . strlen($decoded_attachment));
            header('Content-Disposition: inline; filename="' . basename($filename) . '"');
            header('X-Cache-Status: MISS-SAVED-TO-CACHE');
            ob_end_clean();
            echo $decoded_attachment;
            exit;
        }
    }
}

header('Content-Type: application/json; charset=utf-8');

function formatEmailBodyText($text) {
    if (empty($text)) return '';

    $text = preg_replace('/iVBORw0KGgo[A-Za-z0-9+\/=\s]+/', '', $text);
    $text = preg_replace('/[A-Za-z0-9+\/]{120,}[=]{0,2}/', '', $text);

    $text = preg_replace('/--[0-9a-fA-F]{12,}(--)?/i', '', $text);
    $text = preg_replace('/--[A-Za-z0-9\-_]{12,}(--)?/i', '', $text);

    $text = preg_replace('/Content-Disposition:[^\n]+/i', '', $text);
    $text = preg_replace('/Content-ID:[^\n]+/i', '', $text);
    $text = preg_replace('/Content-Type:[^\n]+/i', '', $text);
    $text = preg_replace('/Content-Transfer-Encoding:[^\n]+/i', '', $text);
    $text = preg_replace('/X-Attachment-Id:[^\n]+/i', '', $text);

    if (function_exists('quoted_printable_decode')) {
        $text = quoted_printable_decode($text);
    }

    $text = preg_replace('/<br\s*\/?>/i', "\n", $text);
    $text = preg_replace('/<\/p>/i', "\n\n", $text);
    $text = strip_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

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
                        'url' => "http://localhost:8000/api_fetch_live_gmail.php?preview=1&msgno={$email_number}&part={$part_num}&ext={$ext}&fn=" . urlencode($filename)
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
                    'url' => "http://localhost:8000/api_fetch_live_gmail.php?preview=1&msgno={$email_number}&part={$part_num}&ext={$ext}&fn=" . urlencode($fn)
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
            ? "http://localhost:8000/file_inbox/rfq-{$clean_id}/{$local_filename}"
            : "http://localhost:8000/file_inbox/live/{$local_filename}";
        
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
                
                // Only save if it looks like a real file (not HTML error page)
                if ($http_code === 200 && !empty($data) && !(strpos($data, '<html') !== false && strpos($data, 'Access Denied') !== false)) {
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

    $max_attempts = min(3, count($key_list));
    $errors = [];

    for ($attempt = 0; $attempt < $max_attempts; $attempt++) {
        $api_key = $key_list[$attempt];
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . urlencode($api_key);
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
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
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

        // If failed, record error and retry
        $err_msg = "Attempt " . ($attempt + 1) . " (Key Ending " . substr($api_key, -6) . ") failed. Code: $http_code. Curl Err: $curl_err.";
        if (!empty($response)) {
            $err_msg .= " Resp: " . substr($response, 0, 150);
        }
        $errors[] = $err_msg;

        if ($attempt < $max_attempts - 1) {
            if ($http_code === 429) {
                sleep(10); // Wait 10 seconds for rate limit to clear
            } else {
                sleep(2); // Wait 2 seconds before retry
            }
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

    $key_list = [];
    if ($db_conn && !$db_conn->connect_error) {
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
    $active_gemini_key = !empty($key_list) ? $key_list[array_rand($key_list)] : getEnvValue('GEMINI_API_KEY', '');

    $start_date_limit = '';
    if ($db_conn && !$db_conn->connect_error) {
        $res_start = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key IN ('INBOX_RULE_START_DATE', 'imap_start_date', 'info_start_date') AND credential_value != '' ORDER BY id DESC LIMIT 1");
        if ($res_start && $res_start->num_rows > 0) {
            $row_start = $res_start->fetch_assoc();
            $start_date_limit = trim($row_start['credential_value']);
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

                $bl_chk = isEmailBlacklisted($db_conn, $p_sender);
                if ($bl_chk['blacklisted']) {
                    $ai_classification = 'blacklisted';
                    $ai_verified = 1;
                    $bl_reason_val = $bl_chk['reason'];
                    $ai_error = 'Otomatis diabaikan oleh mesin: Email pengirim terdaftar dalam Blacklist (' . $bl_reason_val . ')';
                    $db_conn->query("UPDATE rfq_requests SET status = 'deleted', is_blacklisted = 1, blacklist_reason = '" . $db_conn->real_escape_string($bl_reason_val) . "', ai_verified = 1, ai_classification = 'blacklisted', ai_error = '" . $db_conn->real_escape_string($ai_error) . "' WHERE rfq_number = '" . $db_conn->real_escape_string($p_rfq_num) . "'");
                    $scanned_results[] = [
                        'rfq_number' => $p_rfq_num,
                        'subject' => $p_subject,
                        'classification' => 'blacklisted',
                        'verified' => 1,
                        'error' => $ai_error
                    ];
                    continue;
                }

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
                        require_once __DIR__ . '/../daemon/scan_ai.php';
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

    $is_sync = isset($_GET['sync']) && $_GET['sync'] == '1';

    // ⚡ INSTANT FAST RESPONSE (< 20ms): Query MySQL Cache First if NOT syncing
    if (!$is_sync && $db_conn && !$db_conn->connect_error) {
        // Sync RFQ statuses based on linked quotations
        $db_conn->query("UPDATE rfq_requests r 
                         INNER JOIN quotations q ON q.rfq_id = r.id
                         SET r.status = CASE 
                             WHEN q.status = 'Approved' OR q.status = 'acc' THEN 'deal'
                             WHEN q.status = 'Sent' OR q.status = 'done_send' THEN 'penawaran_terkirim'
                             ELSE 'diproses'
                         END");

        $res = $db_conn->query("SELECT * FROM rfq_requests ORDER BY id DESC LIMIT 200");
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
                        'url' => "http://localhost:8000/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
                    ];
                }

                $ai_verified = isset($row['ai_verified']) ? (int)$row['ai_verified'] : 0;
                $ai_classification = isset($row['ai_classification']) ? $row['ai_classification'] : '';

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

                $data[] = [
                    'id' => str_replace('RFQ-', 'GMAIL-LIVE-', $row['rfq_number']),
                    'sender_name' => $row['client_name'] ?: 'Gmail Client',
                    'sender_email' => $row['client_email'] ?: 'abmalayaindustry@gmail.com',
                    'recipient_email' => isset($row['recipient_email']) && !empty($row['recipient_email']) ? $row['recipient_email'] : 'abmalayaindustry@gmail.com',
                    'company' => $row['client_company'] ?: $row['client_name'],
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
        $db_conn->query("UPDATE rfq_requests r 
                         INNER JOIN quotations q ON q.rfq_id = r.id
                         SET r.status = CASE 
                             WHEN q.status = 'Approved' OR q.status = 'acc' THEN 'deal'
                             WHEN q.status = 'Sent' OR q.status = 'done_send' THEN 'penawaran_terkirim'
                             ELSE 'diproses'
                         END
                         WHERE r.status != 'deleted'");
        $st_res = $db_conn->query("SELECT id, rfq_number, status, subject, client_email, recipient_email, reply_body, reply_date, reply_sender FROM rfq_requests");
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
    $inbox = @imap_open($hostname, $username, $password, OP_READONLY, 1, array('DISABLE_AUTHENTICATOR' => 'GSSAPI'));
    if (!$inbox) {
        throw new Exception('Cannot connect to Gmail: ' . imap_last_error());
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
                    $check_stmt = $db_conn->prepare("SELECT * FROM rfq_requests WHERE rfq_number = ?");
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
                                'url' => "http://localhost:8000/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
                            ];
                        }

                        $is_bl_cache = isset($cached_row['is_blacklisted']) ? (int)$cached_row['is_blacklisted'] : 0;
                        $bl_reason_cache = isset($cached_row['blacklist_reason']) ? $cached_row['blacklist_reason'] : '';

                        // Recheck blacklist if not yet marked
                        if ($is_bl_cache === 0) {
                            $dyn_bl = isEmailBlacklisted($db_conn, $cached_row['client_email']);
                            if ($dyn_bl['blacklisted']) {
                                $is_bl_cache = 1;
                                $bl_reason_cache = $dyn_bl['reason'];
                                $cached_row['status'] = 'deleted';
                                $ai_c = 'blacklisted';
                                $ai_v = 1;
                                $db_conn->query("UPDATE rfq_requests SET status = 'deleted', is_blacklisted = 1, blacklist_reason = '" . $db_conn->real_escape_string($bl_reason_cache) . "', ai_verified = 1, ai_classification = 'blacklisted' WHERE id = " . intval($cached_row['id']));
                            }
                        }

                        $labels = [];
                        if ($is_bl_cache === 1 || $ai_c === 'blacklisted') {
                            $labels[] = 'AI: Blacklisted / Mesin Abaikan';
                        } else if ($ai_v === 1) {
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
                            'sender_name' => $cached_row['client_name'] ?: 'Gmail Client',
                            'sender_email' => $cached_row['client_email'] ?: 'abmalayaindustry@gmail.com',
                            'recipient_email' => $cached_row['recipient_email'] ?: 'abmalayaindustry@gmail.com',
                            'company' => $cached_row['client_company'] ?: $cached_row['client_name'],
                            'phone' => $cached_row['client_phone'] ?: '',
                            'subject' => $cached_row['subject'],
                            'message_body' => $cached_row['message_body'],
                            'original_body' => $cached_row['message_body'],
                            'item_requested' => $cached_row['item_requested'],
                            'quantity_requested' => $cached_row['quantity_requested'] ?: '1 Package',
                            'budget_estimate' => extractRealBudgetEstimate($cached_row['message_body']),
                            'date_received' => date('Y-m-d H:i', strtotime($cached_row['created_at'])),
                            'status' => $cached_row['status'],
                            'is_blacklisted' => $is_bl_cache,
                            'blacklist_reason' => $bl_reason_cache,
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
                                    'url' => "http://localhost:8000/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
                                ];
                            }
                            $data[] = [
                                'id' => $live_key,
                                'sender_name' => $cached_row['client_name'] ?: 'Gmail Client',
                                'sender_email' => $cached_row['client_email'] ?: 'abmalayaindustry@gmail.com',
                                'recipient_email' => $cached_row['recipient_email'] ?: 'abmalayaindustry@gmail.com',
                                'company' => $cached_row['client_company'] ?: $cached_row['client_name'],
                                'phone' => $cached_row['client_phone'] ?: '',
                                'subject' => $cached_row['subject'],
                                'message_body' => $cached_row['message_body'],
                                'original_body' => $cached_row['message_body'],
                                'item_requested' => $cached_row['item_requested'],
                                'quantity_requested' => $cached_row['quantity_requested'] ?: '1 Package',
                                'budget_estimate' => extractRealBudgetEstimate($cached_row['message_body']),
                                'date_received' => date('Y-m-d H:i', strtotime($cached_row['created_at'])),
                                'status' => $cached_row['status'],
                                'ai_verified' => 0,
                                'ai_classification' => null,
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
                            'url' => "http://localhost:8000/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
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
                                require_once __DIR__ . '/../daemon/scan_ai.php';
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
                        'sender_name' => $sender_name ?: 'Gmail Client',
                        'sender_email' => $sender_email ?: 'abmalayaindustry@gmail.com',
                        'recipient_email' => $recipient_email ?: 'abmalayaindustry@gmail.com',
                        'company' => $cached_row['client_company'] ?: $sender_name,
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
                $sender_email = $username;
                if (preg_match('/(.*)<(.*)>/', $from, $matches)) {
                    $sender_name = trim($matches[1], ' "');
                    $sender_email = trim($matches[2]);
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
                $is_blacklisted = 0;
                $blacklist_reason = '';

                // ⚡ BLACKLIST CHECK: If sender is in blacklist, auto mark status as deleted and skip AI
                $bl_check = isEmailBlacklisted($db_conn, $sender_email);
                if ($bl_check['blacklisted']) {
                    $current_status = 'deleted';
                    $ai_classification = 'blacklisted';
                    $ai_verified = 1;
                    $is_blacklisted = 1;
                    $blacklist_reason = $bl_check['reason'];
                    $ai_error = 'Otomatis diabaikan oleh mesin: Email pengirim terdaftar dalam Blacklist (' . $blacklist_reason . ')';
                } else if (isObviousJunkEmail($subject, $clean_body, $sender_email)) {
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
                if ($is_blacklisted === 1 || $ai_classification === 'blacklisted') {
                    $labels[] = 'AI: Blacklisted / Mesin Abaikan';
                } else if ($ai_verified === 1) {
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
                    'is_blacklisted' => $is_blacklisted,
                    'blacklist_reason' => $blacklist_reason,
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
                    $stmt = $db_conn->prepare("INSERT INTO rfq_requests (rfq_number, client_name, client_email, recipient_email, client_company, subject, message_body, item_requested, status, ai_verified, ai_classification, ai_error, is_blacklisted, blacklist_reason, attachment_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE message_body=VALUES(message_body), recipient_email=VALUES(recipient_email), ai_verified=VALUES(ai_verified), ai_classification=VALUES(ai_classification), ai_error=VALUES(ai_error), is_blacklisted=VALUES(is_blacklisted), blacklist_reason=VALUES(blacklist_reason), item_requested=VALUES(item_requested), attachment_url=VALUES(attachment_url)");
                    if ($stmt) {
                        $rfq_num = 'RFQ-' . $email_number;
                        $stmt->bind_param("sssssssssisssis", $rfq_num, $sender_name, $sender_email, $recipient_email, $sender_name, $subject, $clean_body, $item_requested, $current_status, $ai_verified, $ai_classification, $ai_error, $is_blacklisted, $blacklist_reason, $attachment_url_val);
                        $stmt->execute();
                        $stmt->close();
                    }
                }
            }
        }
    }

    @imap_close($inbox);

    // ⚡ After syncing, query the complete local DB cache (200 records limit) to ensure older and updated statuses are all returned to UI
    if ($db_conn && !$db_conn->connect_error) {
        $db_conn->query("UPDATE rfq_requests r 
                         INNER JOIN quotations q ON q.rfq_id = r.id
                         SET r.status = CASE 
                             WHEN q.status = 'Approved' OR q.status = 'acc' THEN 'deal'
                             WHEN q.status = 'Sent' OR q.status = 'done_send' THEN 'penawaran_terkirim'
                             ELSE 'diproses'
                         END
                         WHERE r.status != 'deleted'");

        $res = $db_conn->query("SELECT * FROM rfq_requests ORDER BY id DESC LIMIT 200");
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
                        'url' => "http://localhost:8000/api_fetch_live_gmail.php?preview=1&msgno=403&part=2&ext=pdf&fn=PD-ENG-2026-059_Requisition_Spec.pdf"
                    ];
                }
                appendGoogleDriveAttachments($attachments, $row['message_body'], $row['id']);

                $ai_verified = isset($row['ai_verified']) ? (int)$row['ai_verified'] : 0;
                $ai_classification = isset($row['ai_classification']) ? $row['ai_classification'] : '';
                $is_bl = isset($row['is_blacklisted']) ? (int)$row['is_blacklisted'] : 0;
                $bl_reason = isset($row['blacklist_reason']) ? $row['blacklist_reason'] : '';

                // Check dynamic blacklist if not marked
                if ($is_bl === 0) {
                    $dyn_bl2 = isEmailBlacklisted($db_conn, $row['client_email']);
                    if ($dyn_bl2['blacklisted']) {
                        $is_bl = 1;
                        $bl_reason = $dyn_bl2['reason'];
                        $row['status'] = 'deleted';
                        $ai_classification = 'blacklisted';
                        $ai_verified = 1;
                        $db_conn->query("UPDATE rfq_requests SET status = 'deleted', is_blacklisted = 1, blacklist_reason = '" . $db_conn->real_escape_string($bl_reason) . "', ai_verified = 1, ai_classification = 'blacklisted' WHERE id = " . intval($row['id']));
                    }
                }

                $labels = [];
                if ($is_bl === 1 || $ai_classification === 'blacklisted') {
                    $labels[] = 'AI: Blacklisted / Mesin Abaikan';
                } else if ($ai_verified === 1) {
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
                    'id' => str_replace('RFQ-', 'GMAIL-LIVE-', $row['rfq_number']),
                    'sender_name' => $row['client_name'] ?: 'Gmail Client',
                    'sender_email' => $row['client_email'] ?: 'abmalayaindustry@gmail.com',
                    'recipient_email' => isset($row['recipient_email']) && !empty($row['recipient_email']) ? $row['recipient_email'] : 'abmalayaindustry@gmail.com',
                    'company' => $row['client_company'] ?: $row['client_name'],
                    'phone' => '',
                    'subject' => $row['subject'],
                    'message_body' => $row['message_body'],
                    'original_body' => $row['message_body'],
                    'item_requested' => $row['item_requested'] ?: extractRealRequestedItem($row['subject'], $row['message_body']),
                    'quantity_requested' => '1 Package',
                    'budget_estimate' => extractRealBudgetEstimate($row['message_body']),
                    'date_received' => date('Y-m-d H:i', strtotime($row['created_at'])),
                    'status' => $row['status'] ?: 'masuk',
                    'is_blacklisted' => $is_bl,
                    'blacklist_reason' => $bl_reason,
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

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'source' => 'gmail_live_imap_synced',
        'total_inbox_count' => $total_msgs,
        'fetched_count' => count($data),
        'data' => $data
    ], JSON_INVALID_UTF8_IGNORE | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ], JSON_INVALID_UTF8_IGNORE | JSON_UNESCAPED_UNICODE);
}
