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

error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    echo json_encode(['status' => 'ok']);
    exit;
}

try {
    require_once __DIR__ . '/db_connect.php';

    // ── GET: Return existing scan result ──────────────────────────────────────
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
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
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw   = file_get_contents('php://input');
        $input = json_decode($raw, true) ?: [];
        $quo_id = isset($input['quo_id']) ? trim($input['quo_id']) : '';

        // Actor info from frontend (logged-in user identity)
        $actor_name  = isset($input['actor_name'])  ? trim($input['actor_name'])  : 'Sales Engineer';
        $actor_email = isset($input['actor_email']) ? trim($input['actor_email']) : null; // null = unknown, no dummy

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

        if (empty($attachment_url)) {
            $db_conn->query("UPDATE quotations SET ocr_scan_status = 'skipped', ocr_scan_result = '{\"scan_status\":\"skipped\",\"reason\":\"No attachment file found for this RFQ\"}' WHERE id = '" . $db_conn->real_escape_string($quo_id) . "'");
            ob_end_clean();
            echo json_encode(['status' => 'skipped', 'message' => 'No attachment found — scan skipped.']);
            exit;
        }

        // Load DEDICATED OCR Gemini API Key — separate from inbox/classification keys
        // Key stored as GEMINI_API_KEY_OCR in api_credentials table
        $key_list = [];
        $r_key = $db_conn->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'GEMINI_API_KEY_OCR' LIMIT 1");
        if ($r_key && $r_key->num_rows > 0) {
            $k_row = $r_key->fetch_assoc();
            $v = trim($k_row['credential_value']);
            if (!empty($v)) {
                // Support comma-separated multiple keys under OCR slot
                if (strpos($v, ',') !== false) {
                    $key_list = array_values(array_filter(array_map('trim', explode(',', $v))));
                } else {
                    $key_list[] = $v;
                }
            }
        }

        // If no dedicated OCR key exists, abort — never fall back to inbox keys
        if (empty($key_list)) {
            $db_conn->query("UPDATE quotations SET ocr_scan_status = 'error', ocr_scan_result = '{\"scan_status\":\"error\",\"reason\":\"No dedicated OCR API key (GEMINI_API_KEY_OCR) configured in database\"}' WHERE id = '" . $db_conn->real_escape_string($quo_id) . "'");
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'No dedicated OCR API key found. Add GEMINI_API_KEY_OCR in System Settings.']);
            exit;
        }

        // PRIORITY CONTROL: Set manual_scan lock in MySQL to halt background daemons
        $db_conn->query("INSERT INTO system_locks (lock_key, lock_value) VALUES ('manual_scan_active', '" . time() . "') ON DUPLICATE KEY UPDATE lock_value = '" . time() . "'");

        // Perform OCR scan
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
        $new_status = in_array($inner_status, ['done', 'low_quality']) ? 'done' : 'error';

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
            ? ' [AI rate-limited — native text fallback used]'
            : (strpos($confidence, 'Native') !== false ? ' [native text fallback]' : ' [Gemini AI]');
        $log_action_label = 'Manual OCR Scan ' . strtoupper($new_status);
        $log_details = 'Manual OCR scan triggered by user.'
            . ' Status: ' . strtoupper($new_status)
            . '. Extracted items: ' . $item_count
            . '. Confidence: ' . $confidence
            . $ai_note;
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
 * Perform OCR scan.
 *
 * Pipeline:
 *   1. Resolve file from local disk or download from URL
 *   2. Extract raw text: pdftotext (for PDFs) + Tesseract OCR (for images, or PDF render fallback)
 *   3. ALWAYS send raw text + file to Gemini AI for context understanding & JSON structuring
 *   4. If ALL AI attempts fail: return native regex-parsed items as last resort
 */
function performOCRScan(string $file_url, array $key_list, array $quo_context): array {
    $scanned_at = date('Y-m-d H:i:s');

    // ── Resolve extension from URL ──────────────────────────────────────────
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

    // ── Step 1: Resolve file bytes from local disk or HTTP ──────────────────
    $file_data = false;
    if (strpos($file_url, 'msgno=') !== false) {
        $msgno = $qp['msgno'] ?? '';
        if ($msgno) {
            $files = glob(__DIR__ . '/attachments/msg_' . $msgno . '_*');
            if (!empty($files)) {
                foreach ($files as $fpath) {
                    if (file_exists($fpath) && strtolower(pathinfo($fpath, PATHINFO_EXTENSION)) === $ext) {
                        $file_data = file_get_contents($fpath);
                        break;
                    }
                }
                if ($file_data === false && file_exists($files[0])) {
                    $file_data = file_get_contents($files[0]);
                }
            }
        }
    }
    if ($file_data === false || strlen((string)$file_data) < 100) {
        $ch_dl = curl_init($file_url);
        curl_setopt_array($ch_dl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_USERAGENT      => 'ABMalaya-ERP-OCR/2.0'
        ]);
        $file_data = curl_exec($ch_dl);
        $dl_code   = curl_getinfo($ch_dl, CURLINFO_HTTP_CODE);
        curl_close($ch_dl);
        if ($dl_code !== 200 || !$file_data || strlen($file_data) < 100) {
            return [
                'scan_status' => 'error',
                'reason'      => 'Could not load attachment file (HTTP ' . ($dl_code ?? 0) . '). URL: ' . $file_url,
                'scanned_at'  => $scanned_at,
                'file_url'    => $file_url
            ];
        }
    }

    $file_b64 = base64_encode($file_data);
    $tmp_base = tempnam(sys_get_temp_dir(), 'abm_ocr_');

    // ── Step 2: Extract raw text via Tesseract OCR + pdftotext ─────────────
    $raw_text = '';
    $native_items  = [];
    $native_vessel = null;
    $native_master = null;
    $native_cat    = null;
    $native_notes  = null;

    if ($ext === 'pdf') {
        // 2a. pdftotext — fast, accurate for digital/searchable PDFs
        $tmp_pdf = $tmp_base . '.pdf';
        file_put_contents($tmp_pdf, $file_data);
        $raw_text = (string) shell_exec('pdftotext -layout ' . escapeshellarg($tmp_pdf) . ' - 2>/dev/null');

        // 2b. Tesseract on rendered PNG — for scanned/image PDFs where pdftotext yields little
        if (strlen(trim($raw_text)) < 80 && shell_exec('which pdftoppm 2>/dev/null')) {
            $tmp_png_base = $tmp_base . '_page';
            shell_exec('pdftoppm -r 200 -l 1 -png ' . escapeshellarg($tmp_pdf) . ' ' . escapeshellarg($tmp_png_base) . ' 2>/dev/null');
            $png_files = glob($tmp_png_base . '*.png');
            if (!empty($png_files)) {
                $tess_txt_path = $tmp_base . '_tess';
                shell_exec('tesseract ' . escapeshellarg($png_files[0]) . ' ' . escapeshellarg($tess_txt_path) . ' -l eng --oem 3 --psm 6 2>/dev/null');
                if (file_exists($tess_txt_path . '.txt')) {
                    $raw_text = (string) file_get_contents($tess_txt_path . '.txt');
                    @unlink($tess_txt_path . '.txt');
                }
                foreach ($png_files as $pf) { @unlink($pf); }
            }
        }
        @unlink($tmp_pdf);

    } else {
        // 2c. Tesseract directly on image files
        $tmp_img = $tmp_base . '.' . $ext;
        file_put_contents($tmp_img, $file_data);
        $tess_txt_path = $tmp_base . '_tess';
        shell_exec('tesseract ' . escapeshellarg($tmp_img) . ' ' . escapeshellarg($tess_txt_path) . ' -l eng --oem 3 --psm 6 2>/dev/null');
        if (file_exists($tess_txt_path . '.txt')) {
            $raw_text = (string) file_get_contents($tess_txt_path . '.txt');
            @unlink($tess_txt_path . '.txt');
        }
        @unlink($tmp_img);
    }
    @unlink($tmp_base);

    // 2d. Parse native fallback items from raw text (used if AI fails or rate limited)
    if (!empty($raw_text)) {
        $raw_lines  = explode("\n", $raw_text);
        $curr_block = null;

        foreach ($raw_lines as $line) {
            // Check metadata fields
            if (preg_match('/(?:ITEMS|Name of ordering item|Requisition for|Category|Subject)\s*[:;]\s*(.+?)(?:\s{2,}|$)/i', $line, $cm)) {
                $c_cand = trim($cm[1]);
                if (strlen($c_cand) > 2 && strlen($c_cand) < 100 && stripos($c_cand, 'number') === false) {
                    $native_cat = $c_cand;
                }
            }

            if (preg_match('/Vessel\s*[:;]\s*(.+?)(?:\s{2,}|$)/i', $line, $vm)) {
                $v_cand = trim($vm[1]);
                if (strlen($v_cand) < 50 && stripos($v_cand, 'example') === false && stripos($v_cand, 'code/') === false && stripos($v_cand, 'year/') === false && stripos($v_cand, 'running no') === false) {
                    $native_vessel = $v_cand;
                }
            }
            if (preg_match('/Master(?:\s+name)?\s*[:;]\s*(.+?)(?:\s{2,}|$)/i', $line, $mm)) {
                $m_cand = trim($mm[1]);
                if (strlen($m_cand) < 60 && stripos($m_cand, 'example') === false && stripos($m_cand, 'name of') === false) {
                    $native_master = $m_cand;
                }
            }

            // 1. Single-line item match: "1  PENCIL FABER CASTELL  5 BOXES"
            if (preg_match('/^\s*(\d+)\s{2,}(.+?)\s{2,}(\d[\d.]*\s*(?:PCS|BOXES|UNITS|SET|Pcs|Boxes|MTR|KG|PKGS|PACKAGE|BOX|PACK).*)$/i', $line, $m1)) {
                if ($curr_block) {
                    $native_items[] = [
                        'description'   => implode(' — ', $curr_block['desc_lines']),
                        'qty'           => $curr_block['qty'],
                        'unit'          => $curr_block['unit'],
                        'product_code'  => null,
                        'specification' => null,
                        'unit_price' => null, 'discount_percent' => null, 'total' => null
                    ];
                    $curr_block = null;
                }
                $qty_raw = trim($m1[3]);
                preg_match('/^([\d.]+)/', $qty_raw, $qm);
                $native_items[] = [
                    'description'      => trim($m1[2]),
                    'qty'              => isset($qm[1]) ? (float)$qm[1] : 1.0,
                    'unit'             => trim(preg_replace('/^[\d.]+\s*/', '', $qty_raw)) ?: 'Pcs',
                    'unit_price'       => null,
                    'discount_percent' => null,
                    'total'            => null,
                    'product_code'     => null,
                    'specification'    => null,
                ];
                continue;
            }

            // 2. Multi-line item start: "1   Maker: Oval Corporation, Japan."
            if (preg_match('/^\s*(\d+)\s{2,}(.+)$/', $line, $m2)) {
                $num_val = (int)$m2[1];
                $d_start = trim($m2[2]);
                if ($num_val >= 1 && $num_val <= 500 && strlen($d_start) > 2) {
                    if ($curr_block) {
                        $native_items[] = [
                            'description'   => implode(' — ', $curr_block['desc_lines']),
                            'qty'           => $curr_block['qty'],
                            'unit'          => $curr_block['unit'],
                            'product_code'  => null,
                            'specification' => null,
                            'unit_price' => null, 'discount_percent' => null, 'total' => null
                        ];
                    }
                    $curr_block = [
                        'item_no'    => $num_val,
                        'desc_lines' => [$d_start],
                        'qty'        => 1.0,
                        'unit'       => 'Pcs'
                    ];
                    continue;
                }
            }

            // 3. If currently in a block, process description or quantity line
            if ($curr_block) {
                // Quantity line: "6 PCS" or "1.0 Pcs"
                if (preg_match('/^\s*(\d+[\d.]*)\s*(PCS|BOXES|UNITS|SET|Pcs|Boxes|MTR|KG|PKGS|PACKAGE|BOX|PACK|EA|RLS)\s*$/i', $line, $mq)) {
                    $curr_block['qty']  = (float)$mq[1];
                    $curr_block['unit'] = trim($mq[2]);
                } else {
                    $l_clean = trim($line);
                    if ($l_clean && !preg_match('/(?:Requisition No|Issue to|Vessel|Page \d|HSEMS|NUMBER\s+DESCRIPTION)/i', $l_clean)) {
                        $curr_block['desc_lines'][] = $l_clean;
                    }
                }
            }
        }

        // Flush last block if exists
        if ($curr_block) {
            $native_items[] = [
                'description'   => implode(' — ', $curr_block['desc_lines']),
                'qty'           => $curr_block['qty'],
                'unit'          => $curr_block['unit'],
                'product_code'  => null,
                'specification' => null,
                'unit_price' => null, 'discount_percent' => null, 'total' => null
            ];
        }

        if (preg_match('/Note[s]?:\s*(1\..+)/is', $raw_text, $nm)) {
            $native_notes = trim(str_replace("\n", ' ', $nm[1]));
        }
    }


    // ── Step 3: Build Gemini AI prompt with raw text as grounded context ────
    // AI is ALWAYS called — it understands context, splits desc/spec, resolves IMPA, etc.
    $ctx_client  = $quo_context['client_name']  ?? '';
    $ctx_email   = $quo_context['client_email'] ?? '';
    $ctx_subject = $quo_context['subject']      ?? '';

    // Parse display email from JSON if applicable
    $ctx_email_display = $ctx_email;
    $ce_dec = json_decode($ctx_email, true);
    if (is_array($ce_dec) && !empty($ce_dec['selected'])) {
        $ctx_email_display = $ce_dec['selected'];
    }

    $raw_text_block = (!empty(trim($raw_text)))
        ? "\n\n=== RAW TEXT EXTRACTED BY OCR ENGINE (pdftotext + Tesseract) ===\n" . trim($raw_text) . "\n====================================================\n"
        : '';

    $prompt = <<<PROMPT
You are a precise OCR extraction engine for AB Malaya Industry ERP system — a maritime supply company.
Your task: extract structured procurement data from the attached document (PDF or image).

PIPELINE NOTE: Raw text below was pre-extracted by pdftotext / Tesseract OCR.
Use it as your PRIMARY text source, but also VISUALLY VERIFY against the attached document image for any missed or misread text.
{$raw_text_block}
=== EXTRACTION RULES ===
1. "items": Extract EVERY numbered line item. Each item MUST have:
   - "qty": numeric quantity (float)
   - "unit": unit of measure (BOXES, PCS, SETS, BOTTLES, KG, etc.)
   - "description": product main name / ordering title only
   - "specification": ALL additional details — brand, grade, size, colour, CAS No, pack size, technical params. If none, null.
   - "product_code": article no / CAS no / part no if printed. If none, null.
   - "unit_price", "discount_percent", "total": set from document if present, else null.

2. "notes": Capture ALL special remarks, dispatch instructions, document notes printed verbatim.
3. "delivery_email": Extract ONLY if a dispatch/fleet/delivery email address is EXPLICITLY PRINTED in document (e.g. fleet@domain.com). If not found, set null.
4. "company_name": Vessel name OR ordering company name. null if not found.
5. "client_name": Ordering officer / Master / Captain name. null if not found.
6. "category_name": The ITEMS category label from document (e.g. "VESSEL'S STATIONERY", "DECK CONSUMABLES"). null if not found.
7. "impa_code": IMPA maritime category number based on category_name:
   - 49 = Hardware/Stationery/Office
   - 39 = Medicine/Medical
   - 45 = Petroleum/Lubricants/Oil
   - 73 = Engine/Machinery Spare Parts
   - 53 = Deck/Navigation
   - 51 = Safety Equipment
   - null if cannot determine

=== ANTI-HALLUCINATION RULES ===
- ONLY extract what is EXPLICITLY VISIBLE in the document.
- If a field is absent or unreadable, return null. NEVER guess or invent data.
- Do NOT copy context metadata below into output unless CONFIRMED in document.

=== CONTEXT (email metadata — do NOT use unless confirmed in document) ===
Sender: {$ctx_client} <{$ctx_email_display}>
Subject: {$ctx_subject}

=== OUTPUT FORMAT: Valid JSON only. No markdown. No explanation outside JSON. ===
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

    // ── Step 4: Call Gemini AI (OCR-dedicated key, always) ─────────────────
    // Model preference: try best available models in order
    $ocr_models = [
        'gemini-flash-latest',   // Most available, general quota
        'gemini-3.5-flash',      // High quality
    ];
    $key_count = count($key_list);
    $errors    = [];
    $rate_limited_count = 0;   // how many keys/models hit 429
    $retry_after_secs   = 60;  // default wait suggestion (seconds)

    foreach ($ocr_models as $model_name) {
        for ($i = 0; $i < $key_count; $i++) {
            $api_key = $key_list[$i];
            $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model_name . ':generateContent?key=' . urlencode($api_key);

        $payload = json_encode([
            'contents' => [[
                'parts' => [
                    ['text' => $prompt],
                    ['inline_data' => ['mime_type' => $mime, 'data' => $file_b64]]
                ]
            ]],
            'generationConfig' => [
                'temperature'      => 0.0,
                'topP'             => 0.8,
                'maxOutputTokens'  => 8192,
                'responseMimeType' => 'application/json'
            ]
        ]);

            $resp_headers = [];
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $payload,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_TIMEOUT        => 45,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
                CURLOPT_HEADERFUNCTION => function($ch, $header) use (&$resp_headers) {
                    $parts = explode(':', $header, 2);
                    if (count($parts) === 2) {
                        $resp_headers[strtolower(trim($parts[0]))] = trim($parts[1]);
                    }
                    return strlen($header);
                }
            ]);
            $resp      = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($http_code === 200 && !empty($resp)) {
                $resp_data = json_decode($resp, true);
                $text = $resp_data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                // Strip markdown fencing if present
                $text = trim(preg_replace('/^```json\s*/i', '', preg_replace('/\s*```$/i', '', trim($text))));
                $parsed = json_decode($text, true);
                if (is_array($parsed)) {
                    $parsed['scanned_at']       = $scanned_at;
                    $parsed['file_url']         = $file_url;
                    $parsed['scan_confidence']  = 'high (Gemini AI [' . $model_name . '] + OCR Text)';
                    $parsed['scan_model']       = $model_name;
                    if (empty($parsed['scan_status'])) { $parsed['scan_status'] = 'done'; }
                    return $parsed;
                }
                $errors[] = '[' . $model_name . '] Key …' . substr($api_key, -6) . ': AI returned non-JSON response';
            } elseif ($http_code === 429) {
                $rate_limited_count++;
                // Try to read Retry-After header from Gemini response
                $ra = $resp_headers['retry-after'] ?? $resp_headers['x-ratelimit-reset-requests'] ?? null;
                if ($ra && is_numeric($ra)) {
                    $retry_after_secs = max($retry_after_secs, (int)$ra);
                } else {
                    // Parse from JSON body if present
                    $rb = json_decode($resp, true);
                    $ra_body = $rb['error']['details'][0]['metadata']['retryDelay'] ?? null;
                    if ($ra_body && preg_match('/(\d+)/', $ra_body, $ra_match)) {
                        $retry_after_secs = max($retry_after_secs, (int)$ra_match[1]);
                    }
                }
                $errors[] = '[' . $model_name . '] Key …' . substr($api_key, -6) . ': HTTP 429 (rate limited)';
                sleep(2);
            } elseif ($http_code === 404) {
                $errors[] = '[' . $model_name . '] Model not available (404) — trying next model';
                break; // Skip remaining keys for this model, try next model
            } else {
                $errors[] = '[' . $model_name . '] Key …' . substr($api_key, -6) . ': HTTP ' . $http_code;
                sleep(1);
            }
        } // end key loop
    } // end model loop

    // ── Step 5: AI failed — native text fallback (0% dummy data) ───────────
    if (!empty($native_items)) {
        // Resolve delivery email: extract from raw_text notes if present (e.g. fleet@domain.com)
        $extracted_note_email = null;
        if (!empty($raw_text) && preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i', $raw_text, $em)) {
            $matched_e = trim($em[0]);
            // Exclude sender email if different email is found in notes
            if (!empty($matched_e)) {
                $extracted_note_email = $matched_e;
            }
        }
        $real_email = $extracted_note_email ?: $real_email;

        return [
            'scan_status'     => 'done',
            'scan_confidence' => 'medium (Native Text Fallback — AI unavailable)',
            'document_type'   => 'RFQ Requisition Form',
            'category_name'   => $native_cat,
            'impa_code'       => null,
            'company_name'    => $native_vessel ?: ($quo_context['company_name'] ?? null),
            'client_name'     => $native_master ?: ($quo_context['client_name']  ?? null),
            'delivery_email'  => $real_email,
            'notes'           => $native_notes,
            'items'           => $native_items,
            'ai_errors'       => implode('; ', $errors),
            'ai_rate_limited' => $rate_limited_count > 0,
            'retry_after_secs'=> $rate_limited_count > 0 ? $retry_after_secs : null,
            'scanned_at'      => $scanned_at,
            'file_url'        => $file_url
        ];
    }

    return [
        'scan_status'      => 'error',
        'reason'           => implode('; ', $errors),
        'rate_limited'     => $rate_limited_count > 0,
        'retry_after_secs' => $rate_limited_count > 0 ? $retry_after_secs : null,
        'scanned_at'       => $scanned_at,
        'file_url'         => $file_url
    ];
}
