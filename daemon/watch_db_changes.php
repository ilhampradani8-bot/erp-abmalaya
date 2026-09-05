<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
/**
 * ABM Malaya ERP — Database Change Detection & Notification Engine
 * daemon/watch_db_changes.php
 *
 * Monitors table row inserts and status modifications across MySQL tables:
 * rfq_requests, quotations, products, and users.
 * Automatically inserts structured records into system_notifications table.
 */

define('DAEMON_MODE', true);
define('STATE_FILE', __DIR__ . '/logs/db_watch_state.json');
define('LOG_FILE', __DIR__ . '/logs/watch_db_' . date('Y-m-d') . '.log');

function daemon_watch_log(string $msg): void {
    $dir = dirname(LOG_FILE);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

require_once __DIR__ . '/../public/db_connect.php';

if (!$db_conn || $db_conn->connect_error) {
    daemon_watch_log('FATAL: Cannot connect to MySQL — ' . ($db_conn ? $db_conn->connect_error : 'null'));
    exit(1);
}

// Load previous state
$state = [
    'last_rfq_id' => 0,
    'last_quo_id' => '',
    'quo_statuses' => [],
    'last_product_count' => 0,
    'last_user_count' => 0,
    'initialized' => false
];

if (file_exists(STATE_FILE)) {
    $raw_state = file_get_contents(STATE_FILE);
    $decoded_state = json_decode($raw_state, true);
    if (is_array($decoded_state)) {
        $state = array_merge($state, $decoded_state);
    }
}

// ── 1. Check New RFQs (rfq_requests) ──────────────────────────────────────
$res_rfq = $db_conn->query("SELECT id, client_name, client_email, subject, created_at FROM rfq_requests WHERE id > " . intval($state['last_rfq_id']) . " ORDER BY id ASC");
$max_rfq_id = $state['last_rfq_id'];

if ($res_rfq && $res_rfq->num_rows > 0) {
    while ($row = $res_rfq->fetch_assoc()) {
        $rfq_id = intval($row['id']);
        if ($rfq_id > $max_rfq_id) $max_rfq_id = $rfq_id;

        if ($state['initialized']) {
            $sender = !empty($row['client_name']) ? $row['client_name'] : ($row['client_email'] ?: 'Client');
            $subject = !empty($row['subject']) ? $row['subject'] : 'Inquiry RFQ Baru';
            $msg = "Diterima email RFQ baru dari {$sender} ({$row['client_email']}) — Subjek: \"{$subject}\"";
            
            addSystemNotification($db_conn, "Email RFQ Baru Masuk", $msg, "info", "rfq", "rfq_inbox");
            daemon_watch_log("Detected new RFQ ID {$rfq_id}: {$sender}");
        }
    }
}
$state['last_rfq_id'] = $max_rfq_id;


// ── 2. Check Quotations (quotations) ─────────────────────────────────────
$res_quo = $db_conn->query("SELECT id, quotation_number, client_name, company_name, status, created_at FROM quotations ORDER BY created_at ASC");
$current_quo_statuses = [];

if ($res_quo && $res_quo->num_rows > 0) {
    while ($row = $res_quo->fetch_assoc()) {
        $q_id = $row['id'];
        $q_num = $row['quotation_number'];
        $status = strtolower($row['status'] ?? 'draft');
        $company = !empty($row['company_name']) ? $row['company_name'] : ($row['client_name'] ?: 'Klien');
        
        $current_quo_statuses[$q_id] = [
            'num' => $q_num,
            'company' => $company,
            'status' => $status
        ];

        // Check if this quotation is newly added or changed status
        if ($state['initialized']) {
            if (!isset($state['quo_statuses'][$q_id])) {
                // New quotation created
                $msg = "Draf SPH penawaran baru #{$q_num} telah dibuat untuk {$company}.";
                addSystemNotification($db_conn, "Draf SPH Baru #{$q_num}", $msg, "info", "sph", "quotations_list");
                daemon_watch_log("Detected new SPH #{$q_num} for {$company}");
            } else {
                $old_status = $state['quo_statuses'][$q_id]['status'] ?? '';
                if ($old_status !== $status) {
                    // Status changed!
                    $type = 'info';
                    $title = "Perubahan Status SPH #{$q_num}";
                    if (in_array($status, ['approved', 'acc', 'disetujui'])) {
                        $type = 'success';
                        $title = "ACC Manager Disetujui #{$q_num}";
                        $msg = "Surat Penawaran Harga #{$q_num} ({$company}) telah disetujui (ACC) oleh Manager.";
                    } elseif ($status === 'junk') {
                        $type = 'warning';
                        $title = "SPH Dipindahkan ke Sampah #{$q_num}";
                        $msg = "Surat Penawaran Harga #{$q_num} ({$company}) dipindahkan ke folder Sampah/Junk.";
                    } elseif (in_array($status, ['done_send', 'sent', 'terkirim'])) {
                        $type = 'success';
                        $title = "Penawaran SPH Terkirim #{$q_num}";
                        $msg = "Dokumen SPH #{$q_num} telah dikirim ke email klien {$company}.";
                    } else {
                        $msg = "Status penawaran SPH #{$q_num} ({$company}) diubah dari '{$old_status}' menjadi '{$status}'.";
                    }

                    addSystemNotification($db_conn, $title, $msg, $type, "sph", "quotations_list");
                    daemon_watch_log("Status change detected for SPH #{$q_num}: {$old_status} -> {$status}");
                }
            }
        }
    }
}
$state['quo_statuses'] = $current_quo_statuses;


// ── 3. Check Products Count ───────────────────────────────────────────────
$res_prod = $db_conn->query("SELECT COUNT(*) AS total FROM products");
if ($res_prod && $row = $res_prod->fetch_assoc()) {
    $current_prod_count = intval($row['total']);
    if ($state['initialized'] && $current_prod_count > $state['last_product_count'] && $state['last_product_count'] > 0) {
        $diff = $current_prod_count - $state['last_product_count'];
        $msg = "Berhasil mensinkronkan {$diff} produk baru ke dalam Master Katalog IMPA MySQL.";
        addSystemNotification($db_conn, "Pembaruan Katalog IMPA", $msg, "success", "product", "products");
        daemon_watch_log("Detected {$diff} new IMPA products added.");
    }
    $state['last_product_count'] = $current_prod_count;
}

// First time run initialization
if (!$state['initialized']) {
    $state['initialized'] = true;
    daemon_watch_log("Initialized change detection state successfully.");
}

// Save state
file_put_contents(STATE_FILE, json_encode($state, JSON_PRETTY_PRINT));
daemon_watch_log("DB Change Watcher engine execution completed cleanly.");
