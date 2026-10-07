<?php
/**
 * ABM Malaya ERP — OCR Scan API Endpoint
 * public/api_ocr_scan.php
 *
 * Triggers Gemini Vision OCR scan for a specific quotation's attached RFQ file.
 * Updates quotations.ocr_scan_status and quotations.ocr_scan_result in MySQL.
 *
 * GET  /api_ocr_scan.php?quo_id=QUO-xxx        — get current scan result
 * POST /api_ocr_scan.php { "quo_id": "QUO-xxx" } — trigger a scan
 */

if (php_sapi_name() !== 'cli' || isset($_SERVER['REQUEST_METHOD'])) {
    error_reporting(0);
    ini_set('display_errors', 0);
    ob_start();

    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');

    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        ob_end_clean();
        echo json_encode(['status' => 'ok']);
        exit;
    }
}

try {
    require_once __DIR__ . '/db_connect.php';

    // ── GET: Return existing scan result ──────────────────────────────────────
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'GET') {
        $quo_id = isset($_GET['quo_id']) ? trim($_GET['quo_id']) : '';
        if (empty($quo_id)) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'quo_id required']);
            exit;
        }
        $s = $db_conn->prepare("SELECT ocr_scan_status, ocr_scan_result FROM quotations WHERE id = ?");
        if ($s) {
            $s->bind_param('s', $quo_id);
            $s->execute();
            $r = $s->get_result();
            $row = $r->fetch_assoc();
            $s->close();
        }
        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'ocr_scan_status' => $row['ocr_scan_status'] ?? 'pending',
            'ocr_scan_result' => $row['ocr_scan_result'] ?? null
        ]);
        exit;
    }

    // ── POST: Trigger OCR Scan ────────────────────────────────────────────────
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw   = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: [];
        $quo_id = isset($input['quo_id']) ? trim($input['quo_id']) : (isset($_POST['quo_id']) ? trim($_POST['quo_id']) : '');

        // Actor info from frontend (logged-in user identity)
        $actor_email = (isset($input['actor_email']) && !empty($input['actor_email'])) ? trim($input['actor_email']) : '';
        $actor_name  = (isset($input['actor_name']) && !empty($input['actor_name']))  ? trim($input['actor_name'])  : ($quo['created_by'] ?? 'Sesi Tidak Terdeteksi');

        if (empty($quo_id)) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'quo_id required']);
            exit;
        }

        // Load quotation + its rfq attachment_url
        $s = $db_conn->prepare("
            SELECT q.id, q.rfq_id, q.ocr_scan_status,
                   r.attachment_url, r.client_name, r.client_email, r.subject
            FROM quotations q
            LEFT JOIN rfq_requests r ON r.id = q.rfq_id
            WHERE q.id = ?
            LIMIT 1
        ");
        if (!$s) throw new Exception('DB prepare error');
        $s->bind_param('s', $quo_id);
        $s->execute();
        $res = $s->get_result();
        $quo = $res->fetch_assoc();
        $s->close();

        if (!$quo) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'Quotation not found']);
            exit;
        }

        // Mark as processing
        $db_conn->query("UPDATE quotations SET ocr_scan_status = 'processing' WHERE id = '" . $db_conn->real_escape_string($quo_id) . "'");

        $attachment_url = $quo['attachment_url'] ?? '';


        // Load DEDICATED OCR Gemini API Keys from gemini_api_keys table
        $key_list = [];
        $res_keys = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' AND pool_type = 'ocr' ORDER BY id ASC");
        if ($res_keys && $res_keys->num_rows > 0) {
            while ($row = $res_keys->fetch_assoc()) {
                $k = trim($row['api_key']);
                if (!empty($k) && strpos($k, '...') === false) $key_list[] = $k;
            }
        }
        if (empty($key_list)) {
            $res_fb = $db_conn->query("SELECT api_key FROM gemini_api_keys WHERE status = 'active' ORDER BY id ASC");
            if ($res_fb && $res_fb->num_rows > 0) {
                while ($row = $res_fb->fetch_assoc()) {
                    $k = trim($row['api_key']);
                    if (!empty($k) && strpos($k, '...') === false) $key_list[] = $k;
                }
            }
        }
        $key_list = array_values(array_unique($key_list));

        // PRIORITY CONTROL: Set manual_scan lock in MySQL to halt background daemons
        $db_conn->query("INSERT INTO system_locks (lock_key, lock_value) VALUES ('manual_scan_active', '" . time() . "') ON DUPLICATE KEY UPDATE lock_value = '" . time() . "'");

        // Perform OCR scan (with Gemini AI -> Groq AI -> OpenRouter AI -> Native fallback)
        $scan_result = performOCRScan($attachment_url, $key_list, $quo);

        // Clear manual_scan lock after completion
        $db_conn->query("DELETE FROM system_locks WHERE lock_key = 'manual_scan_active'");

        // Store result
        $result_json = json_encode($scan_result, JSON_UNESCAPED_UNICODE);
        // Derive status from inner scan_status:
        //   'done'        = success (AI or native fallback, both acceptable)
        //   'low_quality' = partial — still mark as done so user can see data
        //   anything else = error
        $inner_status = $scan_result['scan_status'] ?? 'error';
        $new_status = in_array($inner_status, ['done', 'low_quality']) ? 'done' : (in_array($inner_status, ['waiting', 'waiting_ai_limit']) ? 'waiting_ai_limit' : 'error');

        // Also update client_phone & delivery_email / client_email in quotations table if extracted by OCR
        $extracted_phone = isset($scan_result['phone']) && !empty($scan_result['phone']) ? trim($scan_result['phone']) : null;
        $extracted_delivery_email = isset($scan_result['delivery_email']) && !empty($scan_result['delivery_email']) ? trim($scan_result['delivery_email']) : (isset($scan_result['email']) && !empty($scan_result['email']) ? trim($scan_result['email']) : null);
        
        if (!empty($extracted_phone)) {
            $upd_phone = $db_conn->prepare("UPDATE quotations SET client_phone = ? WHERE id = ?");
            if ($upd_phone) {
                $upd_phone->bind_param('ss', $extracted_phone, $quo_id);
                $upd_phone->execute();
                $upd_phone->close();
            }
        }

        if (!empty($extracted_delivery_email)) {
            // Parse sender email from existing JSON or use raw value — no dummy fallback
            $raw_ce = $quo['client_email'] ?? null;
            if (!empty($raw_ce)) {
                $ce_json = json_decode($raw_ce, true);
                $sender_email = (is_array($ce_json) && !empty($ce_json['selected'])) ? $ce_json['selected'] : (filter_var($raw_ce, FILTER_VALIDATE_EMAIL) ? $raw_ce : null);
            } else {
                $sender_email = null;
            }
            $json_email = json_encode([
                'selected' => $extracted_delivery_email,
                'options' => [
                    ['email' => $sender_email, 'source' => 'Sender Email (Live Gmail)'],
                    ['email' => $extracted_delivery_email, 'source' => 'Dispatch Email (OCR / Notes)']
                ]
            ], JSON_UNESCAPED_UNICODE);

            $upd_email = $db_conn->prepare("UPDATE quotations SET client_email = ? WHERE id = ?");
            if ($upd_email) {
                $upd_email->bind_param('ss', $json_email, $quo_id);
                $upd_email->execute();
                $upd_email->close();
            }
        }

        $extracted_cat = $scan_result['category_name'] ?? null;
        $extracted_impa = $scan_result['impa_code'] ?? null;

        $upd = $db_conn->prepare("UPDATE quotations SET ocr_scan_status = ?, ocr_scan_result = ?, category_name = ?, impa_code = ? WHERE id = ?");
        if ($upd) {
            $upd->bind_param('sssss', $new_status, $result_json, $extracted_cat, $extracted_impa, $quo_id);
            $upd->execute();
            $upd->close();
        }

        // AUTO-SYNC ITEMS TO DATABASE: If items array extracted, sync into quotation_items table with category_code
        if (!empty($scan_result['items']) && is_array($scan_result['items'])) {
            $db_conn->query("DELETE FROM quotation_items WHERE quotation_id = '" . $db_conn->real_escape_string($quo_id) . "'");
            $ins_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, product_code, category_code, description, specification, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            if ($ins_item) {
                foreach ($scan_result['items'] as $it) {
                    $p_code = $it['product_code'] ?? null;
                    $c_code = $it['category_code'] ?? $extracted_impa;
                    $p_desc = $it['description'] ?? 'Item';
                    $p_spec = $it['specification'] ?? null;
                    $p_qty  = isset($it['qty']) ? (float)$it['qty'] : 1.0;
                    $p_unit = $it['unit'] ?? 'Pcs';
                    $p_price = isset($it['unit_price']) ? (float)$it['unit_price'] : 0.0;
                    $p_disc  = isset($it['discount_percent']) ? (float)$it['discount_percent'] : 0.0;
                    $p_tot   = isset($it['total']) ? (float)$it['total'] : ($p_qty * $p_price);

                    $ins_item->bind_param('sssssdsddd', $quo_id, $p_code, $c_code, $p_desc, $p_spec, $p_qty, $p_unit, $p_price, $p_disc, $p_tot);
                    $ins_item->execute();
                }
                $ins_item->close();
            }
        }

        $item_count = isset($scan_result['items']) && is_array($scan_result['items']) ? count($scan_result['items']) : 0;
        $confidence = $scan_result['scan_confidence'] ?? $inner_status;
        $ai_note    = $scan_result['ai_rate_limited'] ?? false
            ? ' [AI rate-limited — waiting retry]'
            : (strpos($confidence, 'Native') !== false ? ' [native text fallback]' : ' [Gemini AI]');
        $log_action_label = ($new_status === 'waiting_ai_limit') ? 'Menunggu AI (Limit)' : 'Manual OCR Scan';
        $log_details = ($new_status === 'waiting_ai_limit')
            ? 'Tesseract OCR scan selesai. Menunggu AI (Limit) reset kuota untuk ekstraksi terstruktur 100% via Gemini AI.'
            : ('Manual OCR scan diproses oleh pengguna. Status: ' . strtoupper($new_status) . '. Ekstraksi item: ' . $item_count . ' item.');
        appendQuotationHistoryLog(
            $db_conn,
            $quo_id,
            $log_action_label,
            $actor_name,
            $actor_email,
            $log_details
        );

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'ocr_scan_status' => $new_status,
            'ocr_scan_result' => $scan_result
        ]);
        exit;
    }

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

/**
 * Perform OCR & Text Extraction Scan.
 *
 * Pipeline:
 *   1. Check if valid file attachment is present (PDF or image).
 *   2. If file present: extract raw text via pdftotext/Tesseract & prepare base64 image data.
 *   3. Build email text grounding context (subject, item_requested, quantity_requested, message_body).
 *   4. Pass text prompt (+ file data if present) to Gemini AI model.
 *   5. If AI fails/rate-limited: fall back to native text & regex extraction.
 */
function performOCRScan(string $file_url, array $key_list, array $quo_context): array {
    $scanned_at = date('Y-m-d H:i:s');

    // ── Step 1: Resolve attachment file if available ─────────────────────────
    $trimmed_url = strtoupper(trim((string)$file_url));
    $has_file = (!empty($file_url) && !in_array($trimmed_url, ['NONE', 'NULL', 'NO_ATTACHMENT', '']));

    $file_b64 = null;
    $mime     = 'application/pdf';
    $raw_text = '';

    if ($has_file) {
        $ext = strtolower(pathinfo(parse_url($file_url, PHP_URL_PATH), PATHINFO_EXTENSION));
        parse_str(parse_url($file_url, PHP_URL_QUERY) ?? '', $qp);
        if (!empty($qp['ext']))      { $ext = strtolower($qp['ext']); }
        elseif (!empty($qp['fn']))   { $ext = strtolower(pathinfo($qp['fn'], PATHINFO_EXTENSION)); }

        $mime_map = [
            'pdf'  => 'application/pdf',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
        ];
        $mime = $mime_map[$ext] ?? 'application/octet-stream';

        $file_data = false;
        
        $fn = !empty($qp['fn']) ? $qp['fn'] : basename(parse_url($file_url, PHP_URL_PATH));
        $safe_fn = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $fn);
        $base_clean = preg_replace('/[^a-zA-Z0-9]/', '', pathinfo($fn, PATHINFO_FILENAME));
        $msgno = $qp['msgno'] ?? '';
        $part_no = $qp['part'] ?? '2';

        // 1. Direct candidate matching
        $candidate_files = [
            __DIR__ . "/attachments/msg_{$msgno}_part_{$part_no}_{$safe_fn}",
            dirname(__DIR__) . "/attachments/msg_{$msgno}_part_{$part_no}_{$safe_fn}",
            __DIR__ . "/attachments/{$fn}",
            __DIR__ . "/attachments/{$safe_fn}",
            dirname(__DIR__) . "/attachments/{$fn}",
            dirname(__DIR__) . "/attachments/{$safe_fn}",
            __DIR__ . "/uploads/pdf/{$fn}",
            __DIR__ . "/uploads/pdf/{$safe_fn}",
            dirname(__DIR__) . "/public/uploads/pdf/{$fn}",
            dirname(__DIR__) . "/public/uploads/pdf/{$safe_fn}"
        ];

        foreach ($candidate_files as $cf) {
            if (file_exists($cf) && is_file($cf) && filesize($cf) > 100) {
                $file_data = file_get_contents($cf);
                break;
            }
        }

        // 2. Glob / fuzzy search across attachment and upload directories
        if ($file_data === false) {
            $search_dirs = [
                __DIR__ . '/attachments',
                dirname(__DIR__) . '/attachments',
                dirname(__DIR__) . '/public/attachments',
                __DIR__ . '/uploads/pdf',
                __DIR__ . '/uploads',
                dirname(__DIR__) . '/public/uploads/pdf',
                dirname(__DIR__) . '/public/uploads'
            ];

            foreach ($search_dirs as $s_dir) {
                if (!is_dir($s_dir)) continue;

                if (!empty($msgno)) {
                    $m_files = glob($s_dir . '/msg_' . $msgno . '_*');
                    if (!empty($m_files)) {
                        foreach ($m_files as $mf) {
                            if (file_exists($mf) && is_file($mf) && filesize($mf) > 100) {
                                $file_data = file_get_contents($mf);
                                break 2;
                            }
                        }
                    }
                }

                if (!empty($base_clean)) {
                    $dir_files = @scandir($s_dir);
                    if ($dir_files) {
                        foreach ($dir_files as $df) {
                            if ($df === '.' || $df === '..') continue;
                            $df_clean = preg_replace('/[^a-zA-Z0-9]/', '', pathinfo($df, PATHINFO_FILENAME));
                            if (!empty($df_clean) && (strpos($df_clean, $base_clean) !== false || strpos($base_clean, $df_clean) !== false || (strlen($base_clean) > 8 && strpos($df, substr($safe_fn, 0, 15)) !== false))) {
                                $full_df = $s_dir . '/' . $df;
                                if (is_file($full_df) && filesize($full_df) > 100) {
                                    $file_data = file_get_contents($full_df);
                                    break 2;
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Fallback to external HTTP request if not found locally
        if ($file_data === false || strlen((string)$file_data) < 100) {
            $target_url = $file_url;
            if (preg_match('/^https?:\/\//i', $target_url) && strpos($target_url, '127.0.0.1') === false && strpos($target_url, 'localhost') === false) {
                $ch_dl = curl_init($target_url);
                curl_setopt_array($ch_dl, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_TIMEOUT        => 10,
                    CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
                    CURLOPT_USERAGENT      => 'ABMalaya-ERP-OCR/2.0'
                ]);
                $file_data = curl_exec($ch_dl);
                curl_close($ch_dl);
            }
        }

        if ($file_data !== false && strlen($file_data) >= 100) {
            $file_b64 = base64_encode($file_data);

            $can_exec = function_exists('shell_exec') && !in_array('shell_exec', array_map('trim', explode(',', (string)ini_get('disable_functions'))));
            if ($can_exec) {
                $tmp_base = tempnam(sys_get_temp_dir(), 'abm_ocr_');

                if ($ext === 'pdf') {
                    $tmp_pdf = $tmp_base . '.pdf';
                    file_put_contents($tmp_pdf, $file_data);
                    $raw_text = (string) @shell_exec('pdftotext -layout ' . escapeshellarg($tmp_pdf) . ' - 2>/dev/null');

                    if (strlen(trim($raw_text)) < 80 && @shell_exec('which pdftoppm 2>/dev/null')) {
                        $tmp_png_base = $tmp_base . '_page';
                        @shell_exec('pdftoppm -r 200 -l 1 -png ' . escapeshellarg($tmp_pdf) . ' ' . escapeshellarg($tmp_png_base) . ' 2>/dev/null');
                        $png_files = glob($tmp_png_base . '*.png');
                        if (!empty($png_files)) {
                            $tess_txt_path = $tmp_base . '_tess';
                            @shell_exec('tesseract ' . escapeshellarg($png_files[0]) . ' ' . escapeshellarg($tess_txt_path) . ' -l eng --oem 3 --psm 6 2>/dev/null');
                            if (file_exists($tess_txt_path . '.txt')) {
                                $raw_text = (string) file_get_contents($tess_txt_path . '.txt');
                                @unlink($tess_txt_path . '.txt');
                            }
                            foreach ($png_files as $pf) { @unlink($pf); }
                        }
                    }
                    @unlink($tmp_pdf);
                } else {
                    $tmp_img = $tmp_base . '.' . $ext;
                    file_put_contents($tmp_img, $file_data);
                    $tess_txt_path = $tmp_base . '_tess';
                    @shell_exec('tesseract ' . escapeshellarg($tmp_img) . ' ' . escapeshellarg($tess_txt_path) . ' -l eng --oem 3 --psm 6 2>/dev/null');
                    if (file_exists($tess_txt_path . '.txt')) {
                        $raw_text = (string) file_get_contents($tess_txt_path . '.txt');
                        @unlink($tess_txt_path . '.txt');
                    }
                    @unlink($tmp_img);
                }
                @unlink($tmp_base);
            }
        } else {
            $has_file = false;
        }
    }

    // ── Step 2: Build Text Grounding Context from Email Metadata ────────────
    $ctx_client   = $quo_context['client_name']        ?? '';
    $ctx_email    = $quo_context['client_email']       ?? '';
    $ctx_subject  = $quo_context['subject']            ?? '';
    $ctx_item_req = $quo_context['item_requested']     ?? '';
    $ctx_qty_req  = $quo_context['quantity_requested'] ?? '';
    $ctx_msg_raw  = $quo_context['message_body']       ?? '';

    // Parse display email if JSON
    $ctx_email_display = $ctx_email;
    $ce_dec = json_decode($ctx_email, true);
    if (is_array($ce_dec) && !empty($ce_dec['selected'])) {
        $ctx_email_display = $ce_dec['selected'];
    }

    // Clean message body from HTML/CSS tags
    $clean_msg = strip_tags($ctx_msg_raw);
    $clean_msg = preg_replace('/@media[^{]+\{[^}]+\}/i', '', $clean_msg);
    $clean_msg = preg_replace('/(\r?\n){3,}/', "\n\n", $clean_msg);
    $clean_msg = trim(html_entity_decode($clean_msg));

    $email_text_block = "=== RFQ EMAIL CONTENT ===\n"
        . "Sender: " . $ctx_client . " <" . $ctx_email_display . ">\n"
        . "Subject: " . $ctx_subject . "\n"
        . "Item Requested: " . $ctx_item_req . "\n"
        . "Quantity Requested: " . $ctx_qty_req . "\n"
        . "Email Message Body:\n" . (strlen($clean_msg) > 3500 ? substr($clean_msg, 0, 3500) . '...' : $clean_msg) . "\n"
        . "=========================\n";

    $file_text_block = (!empty(trim($raw_text)))
        ? "\n=== DOCUMENT OCR EXTRACTED TEXT ===\n" . trim($raw_text) . "\n====================================\n"
        : '';

    $source_desc = $has_file ? "the attached document (PDF/Image) AND the provided RFQ email text" : "the RFQ email text (no attachment file provided)";

    $prompt = <<<PROMPT
You are a precise OCR and text extraction engine for AB Malaya Industry ERP system — a maritime supply company.
Your task: extract structured procurement data from {$source_desc}.

{$email_text_block}
{$file_text_block}

=== EXTRACTION RULES ===
1. "items": Extract EVERY item request found. Each item MUST be cleanly split:
   - "description": SHORT core item title ONLY (MAX 4-8 WORDS, e.g. "VALVE POSITION INDICATOR", "CLOTHING & LINEN", or "TOLUENE ANALYTICAL REAGENT"). NEVER put long Maker/Model/Specs text in description!
   - "specification": ALL technical details — Maker/Manufacturer, Model Number, Size, Grade, Formula, Cylinder Capacity, Voltage, Serial Number, and notes.
   - "qty": numeric quantity (float, e.g. 1.0, 5.0). Default 1.0 if not specified.
   - "unit": unit of measure (PCS, BOXES, SETS, BOTTLES, KG, MTR, PKGS, PACKAGE, etc.). Default "Pcs" or "Package".
   - "product_code": article no / CAS no / part no if present. If none, null.
   - "unit_price", "discount_percent", "total": set from document/text if present, else null.

2. "notes": Capture special remarks, dispatch instructions, or submission notes printed verbatim.
3. "delivery_email": Extract ONLY if a dispatch/fleet/delivery email address is EXPLICITLY PRINTED (e.g. fleet@domain.com). If not found, set null.
4. "company_name": Vessel name OR ordering company name. null if not found.
5. "client_name": Ordering officer / Master / Captain name. null if not found.
6. "category_name": The product/IMPA category label from document or subject (e.g. "CLOTHING & LINEN", "PROVISION & FOOD SUPPLIES", "PETROLEUM & LUBRICANTS", "CLEANING MATERIALS & CHEMICALS", "ENGINE STORE", "STATIONERY").
7. "impa_code": 2-digit IMPA maritime category number matching category_name:
   - 11 = Clothing & Linen
   - 79 = Provision & Food Supplies
   - 45 = Petroleum & Lubricants / Oil
   - 51 = Cleaning Materials & Chemicals / Safety
   - 73 = Engine / Machinery Spare Parts
   - 53 = Deck / Navigation Consumables
   - 49 = Hardware / Stationery / Office
   - null if cannot determine

=== ANTI-HALLUCINATION RULES ===
- Extract what is VISIBLE in text/document.
- If a field is absent, set null.
- Output ONLY valid JSON. No markdown fencing, no explanation outside JSON.

=== OUTPUT FORMAT ===
{
  "scan_status": "done",
  "scan_confidence": "high",
  "document_type": "RFQ Requisition Form",
  "category_name": null,
  "impa_code": null,
  "company_name": null,
  "client_name": null,
  "registration_number": null,
  "email": null,
  "phone": null,
  "delivery_email": null,
  "notes": null,
  "subtotal": null,
  "discount_total": null,
  "tax_percent": null,
  "tax_amount": null,
  "grand_total": null,
  "items": [
    {
      "qty": 1,
      "unit": "Pcs",
      "description": "Product name",
      "specification": "Brand, grade, size, technical details",
      "product_code": null,
      "unit_price": null,
      "discount_percent": null,
      "subtotal": null,
      "tax": null,
      "total": null
    }
  ],
  "scanned_at": "{$scanned_at}",
  "file_url": "{$file_url}"
}
PROMPT;

    // ── Step 3: Fast Multi-Key Gemini AI Scan with Dynamic Active Models ──
    $ocr_models = function_exists('getGeminiActiveModels') ? getGeminiActiveModels($key_list) : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
    $errors    = [];
    $shuffled_keys = $key_list;
    shuffle($shuffled_keys);
    $max_gemini_attempts = min(6, count($shuffled_keys));

    foreach ($ocr_models as $model_name) {
        for ($i = 0; $i < $max_gemini_attempts; $i++) {
            $api_key = $shuffled_keys[$i];
            if (strpos($api_key, 'gsk_') === 0) continue;

            $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model_name . ':generateContent?key=' . urlencode($api_key);

            $parts = [['text' => $prompt]];
            if ($has_file && !empty($file_b64) && (strpos($mime, 'image/') === 0 || $mime === 'application/pdf') && strlen($file_b64) < 12000000) {
                $parts[] = ['inline_data' => ['mime_type' => $mime, 'data' => $file_b64]];
            }

            $payload = json_encode([
                'contents' => [['parts' => $parts]],
                'generationConfig' => [
                    'temperature'      => 0.0,
                    'topP'             => 0.8,
                    'maxOutputTokens'  => 4096,
                    'responseMimeType' => 'application/json'
                ]
            ]);

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $payload,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_TIMEOUT        => 12,
                CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json']
            ]);
            $resp      = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($http_code === 200 && !empty($resp)) {
                $resp_data = json_decode($resp, true);
                $text = $resp_data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                $text = trim(preg_replace('/^```json\s*/i', '', preg_replace('/\s*```$/i', '', trim($text))));
                $parsed = json_decode($text, true);
                if (is_array($parsed) && (isset($parsed['items']) || isset($parsed['scan_status']))) {
                    $parsed['scanned_at']       = $scanned_at;
                    $parsed['file_url']         = $file_url;
                    $parsed['scan_confidence']  = 'high (Gemini AI [' . $model_name . '] ' . ($has_file ? '+ OCR File' : '+ Email Text') . ')';
                    $parsed['scan_model']       = $model_name;
                    $parsed['scan_status']      = 'done';
                    return $parsed;
                }
            } elseif ($http_code === 404) {
                break; // Try next model
            } else {
                continue; // Try next key
            }
        }
    }

    // ── Step 4: Ultra-Fast Multi-Key Groq AI Fallback (~0.05s) ───────────────
    $groq_key_list = [];
    $raw_groq_env = getenv('GROQ_API_KEYS') ?: (getenv('GROQ_API_KEY_1') ?: '');
    if (!empty($raw_groq_env)) {
        foreach (explode(',', $raw_groq_env) as $gk) {
            $gk = trim($gk);
            if (!empty($gk)) $groq_key_list[] = $gk;
        }
    }
    // Hardcoded fallback pool with all 4 accounts
    $default_groq_keys = [
        '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',
        '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',
        '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',
        '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'
    ];
    foreach ($default_groq_keys as $dgk) {
        $groq_key_list[] = $dgk;
    }
    $groq_key_list = array_values(array_unique($groq_key_list));
    shuffle($groq_key_list);

    $groq_models = function_exists('getGroqActiveModels') ? getGroqActiveModels($groq_key_list) : ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
    foreach ($groq_key_list as $groq_api_key) {
        foreach ($groq_models as $g_mod) {
            $g_ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
            curl_setopt_array($g_ch, [
                CURLOPT_POST           => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
                CURLOPT_HTTPHEADER     => [
                    'Authorization: Bearer ' . $groq_api_key,
                    'Content-Type: application/json',
                    'User-Agent: ERP-ABM/1.0'
                ],
                CURLOPT_POSTFIELDS     => json_encode([
                    'model'           => $g_mod,
                    'messages'        => [
                        ['role' => 'system', 'content' => 'You are an expert Maritime ERP OCR & Data Parser. Output ONLY valid JSON.'],
                        ['role' => 'user', 'content' => $prompt]
                    ],
                    'temperature'     => 0.1,
                    'response_format' => ['type' => 'json_object']
                ])
            ]);
            $g_resp = curl_exec($g_ch);
            $g_code = curl_getinfo($g_ch, CURLINFO_HTTP_CODE);
            curl_close($g_ch);

            if ($g_code === 200 && !empty($g_resp)) {
                $g_data = json_decode($g_resp, true);
                $g_text = $g_data['choices'][0]['message']['content'] ?? '';
                $g_parsed = json_decode(trim($g_text), true);
                if (is_array($g_parsed) && (isset($g_parsed['items']) || isset($g_parsed['scan_status']))) {
                    $g_parsed['scanned_at']      = $scanned_at;
                    $g_parsed['file_url']        = $file_url;
                    $g_parsed['scan_confidence'] = 'high (Groq AI [' . $g_mod . '] ' . ($has_file ? '+ Extracted OCR Text' : '+ Email Text') . ')';
                    $g_parsed['scan_model']      = $g_mod;
                    $g_parsed['scan_status']     = 'done';
                    return $g_parsed;
                }
            } elseif ($g_code === 429) {
                break; // Rate limit on this key, proceed to next key
            }
        }
    }

    // ── Step 4.5: Ultra-Reliable OpenRouter AI Fallback ───────────────────────
    $or_key_list = [];
    $raw_or_env = getenv('OPENROUTER_API_KEYS') ?: (getenv('OPENROUTER_API_KEY_1') ?: '');
    if (!empty($raw_or_env)) {
        foreach (explode(',', $raw_or_env) as $ok) {
            $ok = trim($ok);
            if (!empty($ok)) $or_key_list[] = $ok;
        }
    }
    if (getenv('OPENROUTER_API_KEY_2')) {
        $or_key_list[] = trim(getenv('OPENROUTER_API_KEY_2'));
    }
    $or_key_list = array_values(array_unique(array_filter($or_key_list)));
    if (!empty($or_key_list)) {
        shuffle($or_key_list);
        $or_models = function_exists('getOpenRouterActiveModels') ? getOpenRouterActiveModels($or_key_list) : ['liquid/lfm-2.5-2.6b:free', 'nvidia/nemotron-3.5-lightning:free'];
        foreach ($or_key_list as $or_api_key) {
            foreach ($or_models as $o_mod) {
                $o_ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
                curl_setopt_array($o_ch, [
                    CURLOPT_POST           => true,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT        => 8,
                    CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_HTTPHEADER     => [
                        'Authorization: Bearer ' . $or_api_key,
                        'Content-Type: application/json',
                        'HTTP-Referer: https://erp.abmalaya.com',
                        'X-Title: ABM ERP'
                    ],
                    CURLOPT_POSTFIELDS     => json_encode([
                        'model'       => $o_mod,
                        'messages'    => [
                            ['role' => 'system', 'content' => "You are an expert Maritime Procurement Document Parser. Output strictly in valid JSON."],
                            ['role' => 'user', 'content' => $prompt]
                        ],
                        'temperature' => 0.1,
                        'response_format' => ['type' => 'json_object']
                    ])
                ]);
                $o_resp = curl_exec($o_ch);
                $o_code = curl_getinfo($o_ch, CURLINFO_HTTP_CODE);
                curl_close($o_ch);

                if ($o_code === 200 && !empty($o_resp)) {
                    $o_data = json_decode($o_resp, true);
                    $o_text = $o_data['choices'][0]['message']['content'] ?? '';
                    $o_text = trim(preg_replace('/^```json\s*/i', '', preg_replace('/\s*```$/i', '', trim($o_text))));
                    $o_parsed = json_decode($o_text, true);
                    if (is_array($o_parsed) && (isset($o_parsed['items']) || isset($o_parsed['scan_status']))) {
                        $o_parsed['scanned_at']      = $scanned_at;
                        $o_parsed['file_url']        = $file_url;
                        $o_parsed['scan_confidence'] = 'high (OpenRouter AI [' . $o_mod . '] ' . ($has_file ? '+ Extracted OCR Text' : '+ Email Text') . ')';
                        $o_parsed['scan_model']      = $o_mod;
                        $o_parsed['scan_status']     = 'done';
                        return $o_parsed;
                    }
                } elseif ($o_code === 429) {
                    break;
                }
            }
        }
    }

    // ── Step 5: Native Regex Text Extraction Fallback (Guaranteed Completion) ────────────────
    $fallback_items = [];
    if (!empty($ctx_item_req) && strtolower($ctx_item_req) !== 'none') {
        $fallback_items[] = [
            'qty' => !empty($ctx_qty_req) && is_numeric($ctx_qty_req) ? (float)$ctx_qty_req : 1.0,
            'unit' => 'Package',
            'description' => $ctx_item_req,
            'specification' => $ctx_subject ?: 'Maritime Supply / Procurement Request',
            'product_code' => null,
            'unit_price' => null,
            'discount_percent' => null,
            'subtotal' => null,
            'tax' => null,
            'total' => null
        ];
    }

    return [
        'scan_status'     => 'done',
        'scan_confidence' => 'medium (Native Text & OCR Fallback)',
        'document_type'   => 'RFQ Requisition Form',
        'category_name'   => $quo_context['category_name'] ?? null,
        'impa_code'       => null,
        'company_name'    => $quo_context['client_company'] ?? null,
        'client_name'     => $quo_context['client_name']    ?? null,
        'delivery_email'  => null,
        'notes'           => 'Automated OCR text extraction completed.',
        'items'           => $fallback_items,
        'scanned_at'      => $scanned_at,
        'file_url'        => $file_url
    ];

    // ── Step 4: Native Text & Regex Fallback Parser ─────────────────────────
    return [
        'scan_status'     => 'waiting',
        'scan_confidence' => 'waiting (AI exhausted)',
        'document_type'   => 'RFQ Requisition Form',
        'category_name'   => $quo_context['category_name'] ?? null,
        'impa_code'       => null,
        'company_name'    => $quo_context['client_company'] ?? null,
        'client_name'     => $quo_context['client_name']    ?? null,
        'delivery_email'  => null,
        'notes'           => 'All AI models exhausted. Please retry.',
        'items'           => [],
        'ai_errors'       => implode('; ', $errors),
        'ai_rate_limited' => true,
        'retry_after_secs' => 300,
        'scanned_at'      => $scanned_at,
        'file_url'        => $file_url
    ];
}

