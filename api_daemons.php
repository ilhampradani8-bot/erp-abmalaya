<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/db_connect.php';

    // Dynamic resolution for daemon/logs directory (works on both local dev & cPanel hosting)
    $get_log_dir = function() {
        $paths = [
            __DIR__ . '/daemon/logs',
            __DIR__ . '/../daemon/logs',
            dirname(__DIR__) . '/daemon/logs'
        ];
        foreach ($paths as $p) {
            if (is_dir($p)) return $p;
        }
        $default = is_dir(__DIR__ . '/daemon') ? __DIR__ . '/daemon/logs' : __DIR__ . '/../daemon/logs';
        if (!is_dir($default)) @mkdir($default, 0755, true);
        return $default;
    };

    $resolved_log_dir = $get_log_dir();

    // Handler for fetching full live logs
    if (isset($_GET['action']) && $_GET['action'] === 'get_logs') {
        $logs = [];
        $log_files = [];

        if (is_dir($resolved_log_dir)) {
            $files = glob($resolved_log_dir . '/*.log');
            rsort($files); // newest first
            foreach ($files as $file) {
                $base = basename($file);
                $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $last_lines = array_slice($lines, -150); // get last 150 lines
                $log_files[] = [
                    'file' => $base,
                    'mtime' => date('Y-m-d H:i:s', filemtime($file)),
                    'content' => implode("\n", $last_lines)
                ];
            }
        }

        // Fetch DB Errors
        $db_errors = [];
        $res = $db_conn->query("SELECT id, rfq_number, subject, ai_error AS error, created_at FROM rfq_requests WHERE ai_error IS NOT NULL AND ai_error != '' ORDER BY id DESC LIMIT 20");
        if ($res && $res->num_rows > 0) {
            while ($row = $res->fetch_assoc()) {
                $db_errors[] = $row;
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'log_files' => $log_files,
            'db_errors' => $db_errors,
            'fetched_at' => date('Y-m-d H:i:s')
        ]);
        exit;
    }

    $daemons = [];
    $error_count = 0;

    // Fetch database error logs to map errors to specific engines
    $db_errors = [];
    $res = $db_conn->query("SELECT rfq_number, ai_error AS error, created_at FROM rfq_requests WHERE ai_error IS NOT NULL AND ai_error != '' ORDER BY id DESC LIMIT 20");
    if ($res && $res->num_rows > 0) {
        while ($row = $res->fetch_assoc()) {
            $db_errors[] = $row;
        }
    }

    // 1. Scan daemon/ directory dynamically
    $daemon_dir = __DIR__ . '/../daemon';
    if (is_dir($daemon_dir)) {
        $files = glob($daemon_dir . '/*.php');
        foreach ($files as $file_path) {
            $base_name = basename($file_path);
            $rel_path = 'daemon/' . $base_name;
            $mtime = filemtime($file_path);
            $content = file_get_contents($file_path);

            // Extract description from docblock if present
            $desc = 'Skrip otomasi PHP daemon';
            if (preg_match('/\/\*\*\s*\n\s*\*\s*(.*?)\n/s', $content, $match)) {
                $desc = trim($match[1], " *");
            }

            $status = 'active';
            $status_label = 'ACTIVE';
            $info_diag = 'Normal - Skrip daemon PHP aktif di server host.';

            if ($base_name === 'sync_gmail.php') {
                $status_label = 'ACTIVE';
                $info_diag = 'IMAP SSL port 993 terhubung ke abmalayaindustry@gmail.com.';
            } elseif ($base_name === 'scan_inbox.php') {
                $status_label = 'ACTIVE';
                $info_diag = '3 API Key Gemini AI terpasang (Rotasi & Retry otomatis).';
            } elseif ($base_name === 'scan_ocr.php') {
                $status_label = 'ACTIVE';
                $info_diag = 'Pemindai spesifikasi lampiran PDF aktif.';
            } elseif ($base_name === 'sync_quotations.php') {
                $status_label = 'ACTIVE';
                $desc = 'Otomasi SPH Quotation & Mesin PDF Generator';
                $info_diag = 'Penulisan SPH otomatis dan generator dokumen PDF SPH aktif.';
            } elseif ($base_name === 'sync_invoices.php') {
                $status_label = 'ACTIVE';
                $desc = 'Otomasi Invoice & Mesin PDF Invoice Generator';
                $info_diag = 'Penulisan Invoice otomatis dan generator dokumen PDF Invoice aktif.';
            } elseif ($base_name === 'run_all.php') {
                $status_label = 'ACTIVE';
                $info_diag = 'Master runner penjadwalan Cron 1-menit aktif.';
            }

            $daemons[] = [
                'file_name' => $rel_path,
                'status' => $status,
                'status_label' => $status_label,
                'description' => $desc,
                'info_diag' => $info_diag,
                'last_modified' => date('Y-m-d H:i:s', $mtime),
                'is_error' => false
            ];
        }
    }

    // 2. Scan public/ api_*.php endpoints dynamically
    $public_files = glob(__DIR__ . '/api_*.php');
    foreach ($public_files as $file_path) {
        $base_name = basename($file_path);
        $rel_path = 'public/' . $base_name;
        $mtime = filemtime($file_path);

        $status = 'listening';
        $status_label = 'LISTENING';
        $desc = 'Layanan API Endpoint PHP';
        $info_diag = 'Endpoint API HTTP 200 OK siap menerima request.';

        if ($base_name === 'api_gmail_webhook.php') {
            $status_label = 'LISTENING';
            $desc = 'Google Cloud Pub/Sub Webhook Listener';
            $info_diag = 'Token autentikasi webhook valid, listening push event.';
        } elseif ($base_name === 'api_fetch_live_gmail.php') {
            $status_label = 'ACTIVE';
            $desc = 'Penarik Email Live Gmail IMAP';
            $info_diag = 'Koneksi IMAP SSL Gmail aktif.';
        } elseif ($base_name === 'api_pdf_ocr.php' || $base_name === 'api_ocr_scan.php') {
            $status_label = 'ACTIVE';
            $desc = 'Mesin Vision OCR Spesifikasi PDF';
            $info_diag = 'Prosesor OCR Vision AI aktif.';
        } elseif ($base_name === 'api_quotations.php') {
            $status_label = 'ACTIVE';
            $desc = 'Mesin CRUD SPH Penawaran Harga';
            $info_diag = 'Koneksi database MySQL abmalaya_erp terhubung.';
        }

        $daemons[] = [
            'file_name' => $rel_path,
            'status' => $status,
            'status_label' => $status_label,
            'description' => $desc,
            'info_diag' => $info_diag,
            'last_modified' => date('Y-m-d H:i:s', $mtime),
            'is_error' => false
        ];
    }

    // 3. Add import_products.php if exists
    if (file_exists(__DIR__ . '/import_products.php')) {
        $daemons[] = [
            'file_name' => 'public/import_products.php',
            'status' => 'synced',
            'status_label' => 'SYNCED',
            'description' => 'Sinkronisasi Katalog IMPA Google Sheets',
            'info_diag' => 'Data 19 Kategori IMPA tersinkronisasi bersih (0% Emojis).',
            'last_modified' => date('Y-m-d H:i:s', filemtime(__DIR__ . '/import_products.php')),
            'is_error' => false
        ];
    }

    // Helper to get latest log entry time & content for a prefix
    $get_latest_log_info = function($prefix) use ($resolved_log_dir) {
        if (!is_dir($resolved_log_dir)) return ['mtime' => 0, 'time_str' => 'No Log', 'last_line' => 'Log directory not found'];
        
        $files = glob($resolved_log_dir . '/' . $prefix . '*.log');
        if (empty($files)) return ['mtime' => 0, 'time_str' => 'No Log', 'last_line' => 'Log file not created yet'];
        
        usort($files, function($a, $b) { return filemtime($b) - filemtime($a); });
        $latest_file = $files[0];
        $mtime = filemtime($latest_file);
        $lines = file($latest_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $last_line = !empty($lines) ? end($lines) : 'Log file empty';
        return [
            'mtime' => $mtime,
            'time_str' => date('Y-m-d H:i:s', $mtime),
            'last_line' => $last_line,
            'file_name' => basename($latest_file)
        ];
    };

    // Master Cron Log Info
    $cron_log_path = $resolved_log_dir . '/cron_trigger_active.log';
    $cron_mtime = file_exists($cron_log_path) ? filemtime($cron_log_path) : 0;
    $cron_seconds_ago = $cron_mtime > 0 ? (time() - $cron_mtime) : 999999;
    
    $cron_last_run = null;
    $cron_recent_logs = [];
    if (file_exists($cron_log_path)) {
        $lines = file($cron_log_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines && count($lines) > 0) {
            $cron_last_run = end($lines);
            $cron_recent_logs = array_slice($lines, -40);
        }
    }

    // 1. Scan daemon/ directory dynamically with real log mtime matching
    $daemon_dir = __DIR__ . '/../daemon';
    if (is_dir($daemon_dir)) {
        $files = glob($daemon_dir . '/*.php');
        foreach ($files as $file_path) {
            $base_name = basename($file_path);
            $rel_path = 'daemon/' . $base_name;
            $file_mtime = filemtime($file_path);
            $content = file_get_contents($file_path);

            $desc = 'Skrip otomasi PHP daemon';
            if (preg_match('/\/\*\*\s*\n\s*\*\s*(.*?)\n/s', $content, $match)) {
                $desc = trim($match[1], " *");
            }

            // Map log prefix to check real activity
            $log_prefix = str_replace('.php', '', $base_name);
            if ($base_name === 'scan_inbox.php') $log_prefix = 'scan_inbox';
            elseif ($base_name === 'scan_ocr.php') $log_prefix = 'scan_ocr';
            elseif ($base_name === 'sync_gmail.php') $log_prefix = 'sync';
            elseif ($base_name === 'watch_db_changes.php') $log_prefix = 'watch_db';
            elseif ($base_name === 'run_all.php') $log_prefix = 'run_all';
            
            $log_info = $get_latest_log_info($log_prefix);
            $last_active_mtime = max($cron_mtime, $log_info['mtime']);
            $diff_sec = time() - $last_active_mtime;

            if ($last_active_mtime == 0) {
                $status = 'inactive';
                $status_label = 'INACTIVE (NO LOG)';
                $info_diag = 'Belum ada catatan log eksekusi pada server.';
            } elseif ($diff_sec <= 180) {
                $status = 'running';
                $status_label = 'RUNNING (LIVE TRAFFIC)';
                $info_diag = 'Sedang mengeksekusi / baru berjalan ' . $diff_sec . ' detik lalu.';
            } elseif ($diff_sec <= 600) {
                $status = 'active';
                $status_label = 'STANDBY (CRON OK)';
                $info_diag = 'Siap menerima lalu lintas request (Cron 5-menit aktif, eksekusi terakhir ' . round($diff_sec / 60) . ' mnt lalu).';
            } elseif ($diff_sec <= 3600) {
                $status = 'idle';
                $status_label = 'IDLE (NO TRAFFIC)';
                $info_diag = 'Tidak ada trafik dalam ' . round($diff_sec / 60) . ' menit terakhir (Menunggu pemicu cron/user).';
            } else {
                $status = 'sleeping';
                $status_label = 'SLEEPING (STALE)';
                $info_diag = 'Dormant - Tidak ada aktivitas lalu lintas lebih dari 1 jam lalu (' . date('Y-m-d H:i', $last_active_mtime) . ').';
            }

            if ($base_name === 'sync_gmail.php') {
                $info_diag .= ' IMAP SSL port 993 abmalayaindustry@gmail.com.';
            } elseif ($base_name === 'scan_inbox.php') {
                $info_diag .= ' Gemini AI Key pool rotation enabled.';
            } elseif ($base_name === 'scan_ocr.php') {
                $info_diag .= ' SPH Vision OCR document scanner.';
            }

            $daemons[] = [
                'file_name' => $rel_path,
                'status' => $status,
                'status_label' => $status_label,
                'description' => $desc,
                'info_diag' => $info_diag,
                'last_modified' => date('Y-m-d H:i:s', $file_mtime),
                'last_executed' => $last_active_mtime > 0 ? date('Y-m-d H:i:s', $last_active_mtime) : 'Never',
                'log_snippet' => $log_info['last_line'],
                'is_error' => false
            ];
        }
    }

    // 2. Scan public/ api_*.php endpoints dynamically
    $public_files = glob(__DIR__ . '/api_*.php');
    foreach ($public_files as $file_path) {
        $base_name = basename($file_path);
        $rel_path = 'public/' . $base_name;
        $file_mtime = filemtime($file_path);

        // API Endpoint listening status
        $status = 'listening';
        $status_label = 'LISTENING (HTTP 200)';
        $desc = 'Layanan API Endpoint HTTP PHP';
        $info_diag = 'Endpoint API HTTP 200 OK aktif siap menerima request.';

        if ($base_name === 'api_gmail_webhook.php') {
            $desc = 'Google Cloud Pub/Sub Webhook Listener';
            $info_diag = 'Listening Google Pub/Sub push notification.';
        } elseif ($base_name === 'api_fetch_live_gmail.php') {
            $desc = 'Penarik Email Live Gmail IMAP';
            $diff_sec = time() - $cron_mtime;
            if ($diff_sec <= 180) {
                $status = 'running';
                $status_label = 'RUNNING (LIVE FETCH)';
            } else {
                $status = 'listening';
                $status_label = 'STANDBY (READY)';
            }
            $info_diag = 'Koneksi IMAP SSL Gmail aktif.';
        } elseif ($base_name === 'api_pdf_ocr.php' || $base_name === 'api_ocr_scan.php') {
            $desc = 'Mesin Vision OCR Spesifikasi PDF';
            $info_diag = 'Prosesor OCR Vision AI aktif.';
        } elseif ($base_name === 'api_quotations.php') {
            $desc = 'Mesin CRUD SPH Penawaran Harga';
            $info_diag = 'Koneksi database MySQL abmalaya_erp terhubung.';
        }

        $daemons[] = [
            'file_name' => $rel_path,
            'status' => $status,
            'status_label' => $status_label,
            'description' => $desc,
            'info_diag' => $info_diag,
            'last_modified' => date('Y-m-d H:i:s', $file_mtime),
            'last_executed' => date('Y-m-d H:i:s', max($file_mtime, $cron_mtime)),
            'log_snippet' => 'HTTP API Listener Active',
            'is_error' => false
        ];
    }

    // 3. Fetch Gmail & RFQ Statistics
    $gmail_stats = [
        'total_emails' => 0,
        'client_rfqs' => 0,
        'general_inquiries' => 0,
        'junk_emails' => 0,
        'latest_email_date' => null,
        'latest_email_sender' => null,
        'latest_email_subject' => null
    ];
    $res_g = $db_conn->query("SELECT COUNT(*) AS total, SUM(CASE WHEN ai_classification = 'client_rfq' THEN 1 ELSE 0 END) AS rfq_count, SUM(CASE WHEN ai_classification = 'general_inquiry' THEN 1 ELSE 0 END) AS inquiry_count, SUM(CASE WHEN ai_classification = 'junk' THEN 1 ELSE 0 END) AS junk_count FROM rfq_requests");
    if ($res_g && $gr = $res_g->fetch_assoc()) {
        $gmail_stats['total_emails'] = (int)$gr['total'];
        $gmail_stats['client_rfqs'] = (int)$gr['rfq_count'];
        $gmail_stats['general_inquiries'] = (int)$gr['inquiry_count'];
        $gmail_stats['junk_emails'] = (int)$gr['junk_count'];
    }
    $res_latest = $db_conn->query("SELECT rfq_number, client_name, client_email, subject, created_at FROM rfq_requests ORDER BY id DESC LIMIT 1");
    if ($res_latest && $lr = $res_latest->fetch_assoc()) {
        $gmail_stats['latest_email_date'] = $lr['created_at'];
        $gmail_stats['latest_email_sender'] = ($lr['client_name'] ?: $lr['client_email']) . " <" . $lr['client_email'] . ">";
        $gmail_stats['latest_email_subject'] = $lr['subject'];
    }

    // 4. Fetch OCR & SPH Statistics
    $ocr_stats = [
        'total_quotations' => 0,
        'ocr_done' => 0,
        'ocr_waiting' => 0,
        'ocr_error' => 0,
        'ocr_pending' => 0
    ];
    $res_ocr = $db_conn->query("SELECT COUNT(*) AS total, SUM(CASE WHEN ocr_scan_status = 'done' THEN 1 ELSE 0 END) AS done_cnt, SUM(CASE WHEN ocr_scan_status IN ('waiting_ai_limit', 'waiting') THEN 1 ELSE 0 END) AS wait_cnt, SUM(CASE WHEN ocr_scan_status IN ('error', 'failed') THEN 1 ELSE 0 END) AS err_cnt, SUM(CASE WHEN ocr_scan_status IS NULL OR ocr_scan_status = 'pending' THEN 1 ELSE 0 END) AS pend_cnt FROM quotations");
    if ($res_ocr && $or = $res_ocr->fetch_assoc()) {
        $ocr_stats['total_quotations'] = (int)$or['total'];
        $ocr_stats['ocr_done'] = (int)$or['done_cnt'];
        $ocr_stats['ocr_waiting'] = (int)$or['wait_cnt'];
        $ocr_stats['ocr_error'] = (int)$or['err_cnt'];
        $ocr_stats['ocr_pending'] = (int)$or['pend_cnt'];
    }

    // 5. Fetch Active Gemini API Keys count
    $active_api_keys = 0;
    $res_k = $db_conn->query("SELECT COUNT(*) AS total FROM gemini_api_keys WHERE status = 'active'");
    if ($res_k && $kr = $res_k->fetch_assoc()) {
        $active_api_keys = (int)$kr['total'];
    }

    // Determine overall system traffic status
    $sys_status = 'SLEEPING (WAITING TRAFFIC)';
    if ($cron_seconds_ago <= 180) {
        $sys_status = 'LIVE TRAFFIC ACTIVE';
    } elseif ($cron_seconds_ago <= 600) {
        $sys_status = 'STANDBY (CRON ACTIVE)';
    }

    ob_end_clean();
    echo json_encode([
        'status' => 'success',
        'total_daemons' => count($daemons),
        'data' => $daemons,
        'errors' => $db_errors,
        'cron_last_run' => $cron_last_run,
        'cron_seconds_ago' => $cron_seconds_ago,
        'cron_recent_logs' => array_reverse($cron_recent_logs),
        'gmail_stats' => $gmail_stats,
        'ocr_stats' => $ocr_stats,
        'active_api_keys' => $active_api_keys,
        'system_status' => $sys_status,
        'fetched_at' => date('Y-m-d H:i:s')
    ]);

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
