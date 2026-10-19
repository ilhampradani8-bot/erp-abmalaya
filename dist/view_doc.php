<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

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

$type = isset($_GET['type']) ? trim($_GET['type']) : 'quotation';
$id = isset($_GET['id']) ? trim($_GET['id']) : '';

if (empty($id)) {
    ob_end_clean();
    http_response_code(400);
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>No Document Selected</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}
    body{background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:40px;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .icon{font-size:48px;margin-bottom:16px}
    h1{font-size:18px;font-weight:800;color:#0f172a;margin-bottom:8px}
    p{font-size:13px;color:#64748b;line-height:1.6;margin-bottom:20px}
    a{display:inline-block;background:#0070c0;color:#fff;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;text-decoration:none}
    </style></head><body>
    <div class="card">
      <div class="icon">📄</div>
      <h1>No Document Selected</h1>
      <p>Please open a valid Invoice or Quotation document from the ERP system. A document ID is required to render this page.</p>
      <a href="javascript:history.back()">← Go Back</a>
    </div>
    </body></html>';
    exit;
}

// Base64 Image Converter Helper for local files
function get_image_data_uri($url) {
    if (empty($url)) return '';
    if (strpos($url, 'data:image') === 0) return $url;
    
    $cleanUrl = explode('?', $url)[0];
    $path = ltrim($cleanUrl, '/');
    
    $possibleFiles = [
        __DIR__ . '/' . $path,
        __DIR__ . '/public/' . $path,
        dirname(__DIR__) . '/public/' . $path,
        dirname(__DIR__) . '/' . $path,
    ];
    
    foreach ($possibleFiles as $file) {
        if (file_exists($file) && is_file($file)) {
            $mime = 'image/png';
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            if ($ext === 'jpg' || $ext === 'jpeg') $mime = 'image/jpeg';
            elseif ($ext === 'svg') $mime = 'image/svg+xml';
            elseif ($ext === 'webp') $mime = 'image/webp';
            elseif ($ext === 'gif') $mime = 'image/gif';
            
            $bytes = file_get_contents($file);
            if ($bytes !== false) {
                return 'data:' . $mime . ';base64,' . base64_encode($bytes);
            }
        }
    }
    return $url;
}

// Fetch Paper & Invoice Settings from Database
$paperSettings = [
    'company_name' => 'AB MALAYA SDN. BHD.',
    'company_address' => '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.',
    'phone' => '+60 3-8000 1234',
    'email' => 'sales@abmalaya.com',
    'website' => 'abmalaya.com',
    'logo_url' => '/favicon.png',
    'stamp_url' => '',
    'signature_url' => '',
    'header_image_url' => '',
    'header_title' => 'SURAT PENAWARAN HARGA (SPH) / COMMERCIAL QUOTATION',
    'footer_terms' => "1. 50% DP payment required after PO is issued.\n2. Remaining 50% payment upon delivery completion.\n3. Quotation valid for 14 days from issue date.",
    'header_color' => '#0080d0',
    'table_header_bg' => '#0070c0',
    'default_notes' => "1. Prices stated in Malaysian Ringgit (MYR) and valid for 14 days.\n2. Goods remain property of AB Malaya Sdn. Bhd. until fully paid.\n3. Standard 1-year official manufacturer warranty applicable.",
    'paper_size' => 'A4',
    'margin_top' => 4,
    'margin_bottom' => 4,
    'margin_left' => 4,
    'margin_right' => 4,
    'font_size' => 9
];

$resP = $connection->query("SELECT * FROM system_paper_settings WHERE id = 1 LIMIT 1");
if ($resP && $rowP = $resP->fetch_assoc()) {
    foreach ($rowP as $k => $v) {
        if ($v !== null && $v !== '') $paperSettings[$k] = $v;
    }
}

$invoiceSettings = [
    'company_name' => 'AB MALAYA INDUSTRY',
    'company_reg_no' => '003320457-D',
    'company_address' => 'No 3. Jalan Melati Utama 1, Taman Melati Utama, 53100 Setapak, Kuala Lumpur',
    'phone' => '+60 3-8000 1234',
    'email' => 'abmalayaindustry@gmail.com',
    'website' => 'abmalaya.com',
    'logo_url' => '/favicon.png',
    'stamp_url' => '',
    'signature_url' => '',
    'header_image_url' => '',
    'invoice_title' => 'OFFICIAL INVOICE',
    'bank_name' => 'PUBLIC BANK',
    'bank_account_number' => '3818192115',
    'bank_account_name' => 'AB MALAYA INDUSTRY',
    'bank_email' => 'abmalayaindustry@gmail.com',
    'remarks_text' => "1. Please make all payment crossed & payable to: PUBLIC BANK; 3818192115 (AB MALAYA INDUSTRY)\n2. PLEASE EMAIL ALL RELEVANT DOCUMENTS TO: abmalayaindustry@gmail.com\nKindly contact us should you have further enquiries.",
    'authorised_by_name' => 'Muhammad Aimanuddin Bin Mohd Zaki',
    'authorised_by_title' => 'Procurement Manager / Head of Sales',
    'received_by_label' => 'Received by,',
    'paper_size' => 'A4',
    'table_header_bg' => '#0070c0',
    'margin_top' => 4,
    'margin_bottom' => 4,
    'margin_left' => 4,
    'margin_right' => 4,
    'font_size' => 9
];

$resI = $connection->query("SELECT * FROM system_invoice_settings WHERE id = 1 LIMIT 1");
if ($resI && $rowI = $resI->fetch_assoc()) {
    foreach ($rowI as $k => $v) {
        if ($v !== null && $v !== '') $invoiceSettings[$k] = $v;
    }
}

// Fetch Quotation / Invoice Record
$doc = null;
if ($type === 'invoice') {
    $stmt = $connection->prepare("SELECT * FROM invoices WHERE id = ? OR invoice_number = ? OR quotation_id = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("sss", $id, $id, $id);
        $stmt->execute();
        $r = $stmt->get_result();
        if ($r && $row = $r->fetch_assoc()) {
            $doc = $row;
        }
        $stmt->close();
    }
    
    // Fallback 1: Search by suffix (e.g., /205 or 205)
    if (!$doc && strpos($id, '/') !== false) {
        $parts = explode('/', $id);
        $suffix = end($parts);
        if (!empty($suffix)) {
            $stmtLike = $connection->prepare("SELECT * FROM invoices WHERE invoice_number LIKE ? OR quotation_id LIKE ? LIMIT 1");
            if ($stmtLike) {
                $likeParam = '%' . $suffix;
                $stmtLike->bind_param("ss", $likeParam, $likeParam);
                $stmtLike->execute();
                $rLike = $stmtLike->get_result();
                if ($rLike && $rowLike = $rLike->fetch_assoc()) {
                    $doc = $rowLike;
                }
                $stmtLike->close();
            }
        }
    }

    // If no invoice record exists in the database, do not fabricate a fake invoice
    if (!$doc) {
        echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice Not Found</title>
        <style>
        body{font-family:Inter,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:40px;max-width:480px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.05)}
        .icon{font-size:48px;margin-bottom:16px}
        h1{font-size:18px;font-weight:800;color:#1e293b;margin:0 0 8px}
        p{font-size:13px;color:#64748b;line-height:1.6;margin-bottom:20px}
        a{display:inline-block;background:#0070c0;color:#fff;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;text-decoration:none}
        </style></head><body>
        <div class="card">
          <div class="icon">🧾</div>
          <h1>No Invoice Created Yet</h1>
          <p>This invoice has not been created in the ERP system. Please create and save the invoice from the ERP system before viewing or printing.</p>
          <a href="javascript:history.back()">← Go Back</a>
        </div>
        </body></html>';
        exit;
    }
} else {
    $stmt = $connection->prepare("SELECT * FROM quotations WHERE id = ? OR quotation_number = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("ss", $id, $id);
        $stmt->execute();
        $r = $stmt->get_result();
        if ($r && $row = $r->fetch_assoc()) {
            $doc = $row;
        }
        $stmt->close();
    }

    // Fallback 1: Lookup by rfq_id
    if (!$doc) {
        $stmtRfq = $connection->prepare("SELECT * FROM quotations WHERE rfq_id = ? LIMIT 1");
        if ($stmtRfq) {
            $stmtRfq->bind_param("s", $id);
            $stmtRfq->execute();
            $rRfq = $stmtRfq->get_result();
            if ($rRfq && $rowRfq = $rRfq->fetch_assoc()) {
                $doc = $rowRfq;
            }
            $stmtRfq->close();
        }
    }

    // Fallback 2: Suffix or partial match on quotations
    if (!$doc && strlen($id) >= 4) {
        $cleanId = preg_replace('/[^a-zA-Z0-9]/', '', $id);
        $suffix = substr($cleanId, -6);
        $stmtSuffix = $connection->prepare("SELECT * FROM quotations WHERE id LIKE ? OR quotation_number LIKE ? LIMIT 1");
        if ($stmtSuffix) {
            $likePattern = "%$suffix%";
            $stmtSuffix->bind_param("ss", $likePattern, $likePattern);
            $stmtSuffix->execute();
            $rSuffix = $stmtSuffix->get_result();
            if ($rSuffix && $rowSuffix = $rSuffix->fetch_assoc()) {
                $doc = $rowSuffix;
            }
            $stmtSuffix->close();
        }
    }

    // Fallback 3: Lookup in rfq_requests table and generate dynamic draft
    if (!$doc) {
        $stmtReq = $connection->prepare("SELECT * FROM rfq_requests WHERE id = ? OR rfq_number = ? LIMIT 1");
        if ($stmtReq) {
            $stmtReq->bind_param("ss", $id, $id);
            $stmtReq->execute();
            $rReq = $stmtReq->get_result();
            if ($rReq && $rfqRow = $rReq->fetch_assoc()) {
                $doc = [
                    'id' => $id,
                    'rfq_id' => $rfqRow['id'],
                    'quotation_number' => strpos($id, 'QUO-') !== false ? $id : ('SPH-ABM/MY/' . date('Y') . '/' . rand(1000, 9999)),
                    'client_name' => $rfqRow['client_name'] ?? 'Client',
                    'client_email' => $rfqRow['client_email'] ?? '',
                    'client_phone' => $rfqRow['client_phone'] ?? '',
                    'company_name' => $rfqRow['client_company'] ?? 'Client Company',
                    'date_issued' => date('Y-m-d'),
                    'valid_until' => date('Y-m-d', strtotime('+14 days')),
                    'subtotal' => 0.00,
                    'discount_total' => 0.00,
                    'tax_percent' => 11.00,
                    'tax_amount' => 0.00,
                    'grand_total' => 0.00,
                    'notes' => $rfqRow['message_body'] ?? $rfqRow['subject'] ?? '',
                    'status' => 'draft',
                    'source_file' => $rfqRow['attachment_url'] ?? '',
                    'created_by' => 'AB Malaya Sales Team'
                ];
                if (!empty($rfqRow['item_requested'])) {
                    $items[] = [
                        'id' => 'item-rfq-1',
                        'quotation_id' => $id,
                        'description' => $rfqRow['item_requested'],
                        'quantity' => !empty($rfqRow['quantity_requested']) ? floatval($rfqRow['quantity_requested']) : 1,
                        'unit' => 'Package',
                        'unit_price' => !empty($rfqRow['budget_estimate']) ? floatval($rfqRow['budget_estimate']) : 0,
                        'discount_percent' => 0,
                        'total' => !empty($rfqRow['budget_estimate']) ? floatval($rfqRow['budget_estimate']) : 0
                    ];
                }
            }
            $stmtReq->close();
        }
    }
}

if (!$doc) {
    ob_end_clean();
    http_response_code(404);
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Document Record Not Found - AB Malaya ERP</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif}
    body{background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:36px;max-width:480px;width:100%;text-align:center;box-shadow:0 10px 25px -5px rgba(0,0,0,.08)}
    .icon{font-size:48px;margin-bottom:16px}
    h1{font-size:18px;font-weight:800;color:#0f172a;margin-bottom:8px}
    p{font-size:13px;color:#64748b;line-height:1.6;margin-bottom:16px}
    .ref{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:700;background:#f1f5f9;color:#334155;padding:6px 12px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:24px;word-break:break-all}
    .actions{display:flex;gap:10px;justify-content:center}
    .btn{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:9px 18px;border-radius:8px;text-decoration:none;cursor:pointer;border:1px solid transparent}
    .btn-primary{background:#0070c0;color:#fff}
    .btn-secondary{background:#f1f5f9;color:#334155;border-color:#cbd5e1}
    </style></head><body>
    <div class="card">
      <div class="icon">📁</div>
      <h1>Document File Not Available</h1>
      <p>The requested Quotation document has not been generated or does not have an active record in the database yet.</p>
      <div class="ref">Reference ID: ' . htmlspecialchars($id) . '</div>
      <div class="actions">
        <button onclick="window.close()" class="btn btn-primary">Close Window</button>
        <a href="javascript:history.back()" class="btn btn-secondary">← Go Back</a>
      </div>
    </div>
    </body></html>';
    exit;
}

// Fetch Items from DB Items Table (quotation_items / invoice_items)
$items = [];
$quoIdPrimary = $doc['id'] ?? '';
$quoNumSecondary = $doc['quotation_number'] ?? '';

if ($type === 'invoice') {
    $stmtItems = $connection->prepare("SELECT * FROM invoice_items WHERE invoice_id = ? OR invoice_id = ? OR invoice_id = ? ORDER BY id ASC");
    if ($stmtItems) {
        $stmtItems->bind_param("sss", $id, $quoIdPrimary, $quoNumSecondary);
        $stmtItems->execute();
        $resItems = $stmtItems->get_result();
        if ($resItems) {
            while ($rowItem = $resItems->fetch_assoc()) {
                $items[] = $rowItem;
            }
        }
        $stmtItems->close();
    }
    if (empty($items)) {
        $stmtItemsQ = $connection->prepare("SELECT * FROM quotation_items WHERE quotation_id = ? OR quotation_id = ? OR quotation_id = ? ORDER BY id ASC");
        if ($stmtItemsQ) {
            $stmtItemsQ->bind_param("sss", $id, $quoIdPrimary, $quoNumSecondary);
            $stmtItemsQ->execute();
            $resItemsQ = $stmtItemsQ->get_result();
            if ($resItemsQ) {
                while ($rowItemQ = $resItemsQ->fetch_assoc()) {
                    $items[] = $rowItemQ;
                }
            }
            $stmtItemsQ->close();
        }
    }
} else {
    $stmtItems = $connection->prepare("SELECT * FROM quotation_items WHERE quotation_id = ? OR quotation_id = ? OR quotation_id = ? ORDER BY id ASC");
    if ($stmtItems) {
        $stmtItems->bind_param("sss", $id, $quoIdPrimary, $quoNumSecondary);
        $stmtItems->execute();
        $resItems = $stmtItems->get_result();
        if ($resItems) {
            while ($rowItem = $resItems->fetch_assoc()) {
                $items[] = $rowItem;
            }
        }
        $stmtItems->close();
    }
}

// Fallback to JSON columns if items table returns 0 rows
if (empty($items) && !empty($doc['items_json'])) {
    $rawDec = is_string($doc['items_json']) ? json_decode($doc['items_json'], true) : $doc['items_json'];
    if (is_array($rawDec) && count($rawDec) > 0) $items = $rawDec;
}
if (empty($items) && !empty($doc['items'])) {
    $rawDec = is_string($doc['items']) ? json_decode($doc['items'], true) : $doc['items'];
    if (is_array($rawDec) && count($rawDec) > 0) $items = $rawDec;
}
if (empty($items) && !empty($doc['items_details'])) {
    $rawDec = is_string($doc['items_details']) ? json_decode($doc['items_details'], true) : $doc['items_details'];
    if (is_array($rawDec) && count($rawDec) > 0) $items = $rawDec;
}

if (!is_array($items) || count($items) === 0) {
    $fallbackPrice = floatval($doc['total_amount'] ?? $doc['grand_total'] ?? $doc['subtotal'] ?? 0);
    $items = [
        [
            'id' => 'item-1',
            'product_code' => 'ABM-EQ-01',
            'impa_code' => '—',
            'description' => !empty($doc['notes']) ? $doc['notes'] : (!empty($doc['project_reference']) ? $doc['project_reference'] : 'Industrial Supply & Technical Specification'),
            'specification' => 'Standard Industrial Specification',
            'quantity' => 1,
            'unit' => 'Package',
            'unit_price' => $fallbackPrice,
            'discount_percent' => 0,
            'total' => $fallbackPrice
        ]
    ];
}

// Fetch Master Products Catalog for matching photos & IMPA codes
$productsCatalog = [];
$resCat = $connection->query("SELECT product_code, impa_code, product_name, description, specification, offer, unit, unit_price, image_url FROM products");
if ($resCat) {
    while ($rowCat = $resCat->fetch_assoc()) {
        $productsCatalog[] = $rowCat;
    }
}

function find_catalog_product($desc, $catalog) {
    if (empty($desc)) return null;
    $cleanDesc = strtolower(trim($desc));
    foreach ($catalog as $p) {
        $pName = strtolower($p['product_name'] ?? '');
        $pCode = strtolower($p['product_code'] ?? '');
        if (!empty($pCode) && strpos($cleanDesc, $pCode) !== false) return $p;
        if (!empty($pName) && (strpos($cleanDesc, $pName) !== false || strpos($pName, $cleanDesc) !== false)) return $p;
    }
    return null;
}

// Determine Active Branding Settings & Convert to Base64 URIs for 100% Guaranteed Image Rendering
$activeSettings = ($type === 'invoice') ? $invoiceSettings : $paperSettings;
$logoUrl = get_image_data_uri(!empty($activeSettings['logo_url']) ? $activeSettings['logo_url'] : '/favicon.png');
$stampUrl = get_image_data_uri(!empty($activeSettings['stamp_url']) ? $activeSettings['stamp_url'] : '');
$sigUrl = get_image_data_uri(!empty($activeSettings['signature_url']) ? $activeSettings['signature_url'] : '');
$hdrImgUrl = get_image_data_uri(!empty($activeSettings['header_image_url']) ? $activeSettings['header_image_url'] : '');

$companyName = !empty($activeSettings['company_name']) ? $activeSettings['company_name'] : 'AB MALAYA SDN. BHD.';
$companyAddress = !empty($activeSettings['company_address']) ? $activeSettings['company_address'] : '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.';
$companyPhone = !empty($activeSettings['phone']) ? $activeSettings['phone'] : '+60 3-8000 1234';
$companyEmail = !empty($activeSettings['email']) ? $activeSettings['email'] : 'sales@abmalaya.com';
$companyWebsite = !empty($activeSettings['website']) ? $activeSettings['website'] : 'abmalaya.com';
$tableHeaderBg = !empty($activeSettings['table_header_bg']) ? $activeSettings['table_header_bg'] : '#0070c0';

$footerText = !empty($doc['footer_text']) 
    ? trim($doc['footer_text']) 
    : (!empty($activeSettings['footer_text']) 
        ? trim($activeSettings['footer_text']) 
        : "$companyEmail, $companyPhone, $companyWebsite");

$mTop = (int)($activeSettings['margin_top'] ?: 6);
$mBot = (int)($activeSettings['margin_bottom'] ?: 6);
$mLeft = (int)($activeSettings['margin_left'] ?: 6);
$mRight = (int)($activeSettings['margin_right'] ?: 6);
$fSize = (int)($activeSettings['font_size'] ?: 9);
$pSize = !empty($activeSettings['paper_size']) ? $activeSettings['paper_size'] : 'A4';

$layoutOffsets = [];
if (!empty($activeSettings['layout_offsets'])) {
    $parsedOffsets = is_string($activeSettings['layout_offsets']) ? json_decode($activeSettings['layout_offsets'], true) : $activeSettings['layout_offsets'];
    if (is_array($parsedOffsets)) $layoutOffsets = $parsedOffsets;
}

$logoOffsets = ($type === 'invoice') ? ($layoutOffsets['invoice_logo'] ?? []) : ($layoutOffsets['header_logo'] ?? []);
$addrOffsets = ($type === 'invoice') ? ($layoutOffsets['invoice_address'] ?? []) : ($layoutOffsets['header_address'] ?? []);
$titleOffsets = ($type === 'invoice') ? ($layoutOffsets['invoice_title'] ?? []) : [];
$toAddrOffsets = ($type === 'invoice') ? ($layoutOffsets['invoice_to_address'] ?? []) : [];
$metaOffsets = ($type === 'invoice') ? ($layoutOffsets['invoice_meta'] ?? []) : [];

$logoX = intval($logoOffsets['x'] ?? 0);
$logoY = intval($logoOffsets['y'] ?? 0);
$logoScale = floatval($logoOffsets['scale'] ?? 1.0);
if ($logoScale <= 0) $logoScale = 1.0;

$addrX = intval($addrOffsets['x'] ?? 0);
$addrY = intval($addrOffsets['y'] ?? 0);
$addrScale = floatval($addrOffsets['scale'] ?? 1.0);
if ($addrScale <= 0) $addrScale = 1.0;

$titleX = intval($titleOffsets['x'] ?? 0);
$titleY = intval($titleOffsets['y'] ?? 0);

$toAddrX = intval($toAddrOffsets['x'] ?? 0);
$toAddrY = intval($toAddrOffsets['y'] ?? 0);

$metaX = intval($metaOffsets['x'] ?? 0);
$metaY = intval($metaOffsets['y'] ?? 0);

function clean_email_str($emailRaw) {
    if (empty($emailRaw)) return '';
    if (is_string($emailRaw) && strpos($emailRaw, '{') !== false) {
        $json = json_decode($emailRaw, true);
        if (is_array($json)) {
            if (!empty($json['selected'])) return $json['selected'];
            if (!empty($json['email'])) return $json['email'];
            if (isset($json['options']) && is_array($json['options']) && count($json['options']) > 0) {
                return $json['options'][0]['email'] ?? '';
            }
        }
    }
    return is_string($emailRaw) ? trim($emailRaw) : '';
}

$docRefNo = $type === 'invoice' ? ($doc['invoice_number'] ?? 'INV-ABM') : ($doc['quotation_number'] ?? $doc['ref_no'] ?? 'ABM/QUO/2026-001');
$rawDate = !empty($doc['pdf_created_at']) ? $doc['pdf_created_at'] : (!empty($doc['date_issued']) ? $doc['date_issued'] : (!empty($doc['created_at']) ? $doc['created_at'] : date('Y-m-d')));
$docDate = (!empty($rawDate) && $rawDate !== '0000-00-00 00:00:00') ? date('d/m/Y', strtotime($rawDate)) : date('d/m/Y');
$validUntil = $doc['valid_until'] ?? '14 Days';
$headerTitle = !empty($activeSettings['header_title']) ? $activeSettings['header_title'] : ($type === 'invoice' ? 'OFFICIAL INVOICE' : 'SURAT PENAWARAN HARGA (SPH) / COMMERCIAL QUOTATION');
$projectRef = $doc['project_reference'] ?? $doc['notes'] ?? $doc['category_name'] ?? 'INDUSTRIAL & MARITIME EQUIPMENT SUPPLY';

$clientName = $doc['client_name'] ?? $doc['customer_name'] ?? $doc['contact_person'] ?? 'Valued Client';
$clientCompany = $doc['company_name'] ?? $doc['client_company'] ?? '';
$clientEmail = clean_email_str($doc['client_email'] ?? $doc['customer_email'] ?? '');
$clientPhone = $doc['client_phone'] ?? $doc['customer_phone'] ?? $doc['phone'] ?? '';
if ($type === 'invoice') {
    $docNotes = !empty($doc['notes']) ? $doc['notes'] : (!empty($activeSettings['remarks_text']) ? $activeSettings['remarks_text'] : "1. Please make all payment crossed & payable to: " . ($activeSettings['bank_name'] ?? 'PUBLIC BANK') . "; " . ($activeSettings['bank_account_number'] ?? '3818192115') . " (" . ($activeSettings['bank_account_name'] ?? 'AB MALAYA INDUSTRY') . ")\n2. PLEASE EMAIL ALL RELEVANT DOCUMENTS TO: " . ($activeSettings['bank_email'] ?? 'abmalayaindustry@gmail.com') . "\nKindly contact us should you have further enquiries.");
} else {
    $docNotes = !empty($doc['notes']) ? $doc['notes'] : ($activeSettings['footer_terms'] ?? $activeSettings['default_notes']);
}

$receivedByLabel = !empty($activeSettings['received_by_label']) ? $activeSettings['received_by_label'] : 'Received by,';
$receivedByNameLabel = !empty($activeSettings['received_by_name_label']) ? $activeSettings['received_by_name_label'] : 'Name / Designation: ______________________';
$receivedByDateLabel = !empty($activeSettings['received_by_date_label']) ? $activeSettings['received_by_date_label'] : 'Date: ____ / ____ / ________';

$authorisedByName = !empty($doc['authorised_by_name']) ? $doc['authorised_by_name'] : (!empty($activeSettings['authorised_by_name']) ? $activeSettings['authorised_by_name'] : (!empty($doc['created_by']) ? $doc['created_by'] : 'Muhammad Aimanuddin Bin Mohd Zaki'));
$authorisedByTitle = !empty($doc['authorised_by_title']) ? $doc['authorised_by_title'] : (!empty($activeSettings['authorised_by_title']) ? $activeSettings['authorised_by_title'] : 'Procurement Manager / Head of Sales');

// Financial Summaries Calculation
$grossSubtotal = 0;
$discountTotal = 0;

foreach ($items as $it) {
    $q = floatval($it['quantity'] ?? $it['qty'] ?? 1);
    $p = floatval($it['unit_price'] ?? $it['price'] ?? 0);
    $d = floatval($it['discount_percent'] ?? 0);
    $base = $q * $p;
    $disc = $base * ($d / 100);
    $grossSubtotal += $base;
    $discountTotal += $disc;
}

$netBeforeTax = $grossSubtotal - $discountTotal;
$taxPercent = floatval($doc['tax_percent'] ?? 11);
$taxAmount = $netBeforeTax * ($taxPercent / 100);
$grandTotal = !empty($doc['total_amount']) ? floatval($doc['total_amount']) : ($netBeforeTax + $taxAmount);

function format_currency($val) {
    $num = floatval($val);
    return 'MYR ' . number_format($num, 2);
}

function render_dynamic_address($addr) {
    $defaultAddress = '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.';
    $clean = (!empty($addr) && trim($addr) !== '') ? trim($addr) : $defaultAddress;
    
    if (strpos($clean, "\n") !== false) {
        $lines = array_filter(array_map('trim', explode("\n", $clean)));
        $out = '';
        foreach ($lines as $idx => $line) {
            $cls = ($idx === 0) ? 'font-weight: 700; color: #0f172a; font-size: 7.5pt;' : 'color: #1e293b; font-size: 7pt;';
            $out .= '<p style="margin: 0; ' . $cls . '">' . htmlspecialchars($line) . '</p>';
        }
        return $out;
    }
    
    $parts = array_filter(array_map('trim', explode(',', $clean)));
    if (count($parts) >= 3) {
        $line1 = implode(', ', array_slice($parts, 0, 2)) . ',';
        $line2 = implode(', ', array_slice($parts, 2, count($parts) - 3)) . ',';
        $line3 = $parts[count($parts) - 1];
        return '<p style="margin: 0; font-weight: 700; color: #0f172a; font-size: 7.5pt;">' . htmlspecialchars($line1) . '</p>' .
               '<p style="margin: 0; color: #1e293b; font-size: 7pt;">' . htmlspecialchars($line2) . '</p>' .
               '<p style="margin: 0; font-weight: 600; color: #0f172a; font-size: 7pt;">' . htmlspecialchars($line3) . '</p>';
    }
    
    return '<p style="margin: 0; font-weight: 600; color: #0f172a; font-size: 7.5pt;">' . htmlspecialchars($clean) . '</p>';
}

ob_end_clean();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title><?= htmlspecialchars($docRefNo) ?> - <?= htmlspecialchars($companyName) ?></title>
    <style>
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        @page {
            size: <?= htmlspecialchars($pSize) ?> portrait;
            margin: <?= $mTop ?>mm <?= $mRight ?>mm <?= $mBot ?>mm <?= $mLeft ?>mm;
        }
        html, body {
            width: 100%;
            margin: 0;
            padding: 0;
            color: #0f172a;
            font-size: <?= $fSize ?>pt;
            font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        @media screen {
            html {
                background: #475569;
            }
            body {
                background: transparent !important;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                padding: 24px 12px;
                min-height: 100vh;
            }
            .doc-screen-wrapper {
                width: 210mm;
                min-height: 297mm;
                background: #ffffff !important;
                box-shadow: 0 12px 36px rgba(0,0,0,0.3);
                padding: <?= $mTop ?>mm <?= $mRight ?>mm <?= $mBot ?>mm <?= $mLeft ?>mm;
                box-sizing: border-box;
            }
        }

        @media print {
            html, body {
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
            }
            .doc-screen-wrapper {
                width: 100% !important;
                min-height: auto !important;
                box-shadow: none !important;
                padding: 0 !important;
                margin: 0 !important;
                background: transparent !important;
            }
            .items-table tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .bottom-grid, .signatures-grid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
        }

        .page-layout-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin: 0;
            padding: 0;
        }
        .page-layout-header {
            display: table-header-group;
        }
        .page-layout-footer {
            display: table-footer-group;
        }
        .page-layout-body {
            display: table-row-group;
        }
        .page-layout-table > thead > tr > td,
        .page-layout-table > tfoot > tr > td,
        .page-layout-table > tbody > tr > td {
            padding: 0;
            border: none;
            vertical-align: top;
        }

        /* 1. LETTERHEAD BANNER HEADER */
        .letterhead-container {
            position: relative;
            width: 100%;
            overflow: hidden;
            border-bottom: 2px solid #004f8b;
            min-height: 100px;
            margin-bottom: 10px;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            padding-bottom: 6px;
        }
        .letterhead-bg-img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
            z-index: 0;
            opacity: 0.9;
        }
        .letterhead-top-gradient {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(to right, #004f8b, #0070c0, #0080d0);
            z-index: 0;
        }
        .letterhead-content {
            position: relative;
            z-index: 10;
            display: flex;
            width: 100%;
            align-items: flex-end;
            justify-content: space-between;
        }
        .logo-box img {
            height: 55px;
            max-width: 240px;
            object-fit: contain;
        }
        .company-address-box {
            text-align: right;
            font-size: 8pt;
            line-height: 1.3;
            color: #1e293b;
        }

        /* 2. METADATA SECTION */
        .metadata-section {
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 8px;
            margin-bottom: 10px;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
        }
        .meta-table td {
            padding: 2px 0;
            font-size: 8.5pt;
            vertical-align: top;
        }
        .meta-label {
            width: 140px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
        }
        .meta-colon {
            width: 12px;
            font-weight: 700;
            color: #0f172a;
        }
        .meta-val {
            font-weight: 600;
            color: #0f172a;
        }
        .meta-val-bold {
            font-weight: 800;
            color: #0f172a;
        }

        /* 3. TITLE STRIP BANNER */
        .title-strip-banner {
            background-color: <?= htmlspecialchars($tableHeaderBg) ?>;
            color: #ffffff;
            font-weight: 800;
            font-size: 9pt;
            padding: 4px 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
            margin-bottom: 6px;
        }
        .intro-text {
            font-size: 8.5pt;
            color: #334155;
            font-weight: 500;
            margin-bottom: 8px;
        }

        /* 4. PRODUCT LINE ITEMS TABLE */
        .items-table-box {
            border: 1px solid #0f172a;
            margin-bottom: 12px;
            background: #ffffff;
            width: 100%;
            box-sizing: border-box;
        }
        .items-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 7.5pt;
            box-sizing: border-box;
        }
        .items-table-header {
            display: table-header-group;
        }
        .items-table th {
            background-color: <?= htmlspecialchars($tableHeaderBg) ?>;
            color: #ffffff;
            font-weight: 800;
            font-size: 7.5pt;
            text-transform: uppercase;
            padding: 5px 3px;
            border-right: 1px solid #0f172a;
            border-bottom: 1px solid #0f172a;
            text-align: left;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .items-table th:last-child {
            border-right: none;
        }
        .items-table td {
            padding: 5px 4px;
            border-right: 1px solid #0f172a;
            border-bottom: 1px solid #0f172a;
            vertical-align: top;
        }
        .items-table td:last-child {
            border-right: none;
        }
        .items-table tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .items-table tr:last-child td {
            border-bottom: none;
        }
        .items-table tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        .product-photo-full {
            width: 100% !important;
            max-height: 140px !important;
            object-fit: contain !important;
            border: 1px solid #cbd5e1 !important;
            border-radius: 3px !important;
            background-color: #ffffff !important;
            padding: 2px !important;
            margin-top: 4px !important;
            display: block !important;
        }
        .product-photo {
            width: 28px;
            height: 28px;
            object-fit: cover;
            border: 1px solid #cbd5e1;
            display: block;
            margin: 0 auto;
        }
        .no-photo-box {
            width: 28px;
            height: 28px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 7.5pt;
            margin: 0 auto;
        }

        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .font-bold { font-weight: 700; }

        /* 5. TERMS & FINANCIAL SUMMARY GRID */
        .bottom-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 16px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .terms-container {
            flex: 1;
            font-size: 8pt;
        }
        .terms-header {
            font-size: 7.5pt;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #0f172a;
            padding-bottom: 2px;
            margin-bottom: 4px;
        }
        .terms-content {
            color: #334155;
            white-space: pre-line;
            line-height: 1.35;
        }
        .summary-box {
            width: 270px;
            border: 2px solid #0f172a;
            padding: 10px;
            background: #ffffff;
            font-size: 8pt;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
            color: #334155;
        }
        .summary-row.grand-total {
            border-top: 2px solid #0f172a;
            padding-top: 5px;
            margin-bottom: 0;
            font-weight: 900;
            font-size: 10.5pt;
            color: #0f172a;
        }

        /* 6. DUAL AUTHORIZATION SIGNATURE BLOCK */
        .signatures-grid {
            display: flex;
            justify-content: <?= ($type === 'invoice') ? 'space-between' : 'flex-end' ?>;
            align-items: flex-end;
            width: 100%;
            border-top: 1px solid #cbd5e1;
            padding-top: 10px;
            margin-top: 14px;
            font-size: 8pt;
            gap: 16px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .sig-client-box {
            width: 240px;
            max-width: 260px;
            text-align: right;
            margin-left: auto;
        }
        .sig-client-line {
            height: 50px;
            border-bottom: 2px solid #0f172a;
            width: 180px;
            margin-bottom: 4px;
            margin-left: auto;
        }
        .sig-issuer-box {
            width: 250px;
            max-width: 280px;
            text-align: <?= ($type === 'invoice') ? 'left' : 'right' ?>;
            margin-left: <?= ($type === 'invoice') ? '0' : 'auto' ?>;
            margin-right: <?= ($type === 'invoice') ? 'auto' : '0' ?>;
            display: flex;
            flex-direction: column;
            align-items: <?= ($type === 'invoice') ? 'flex-start' : 'flex-end' ?>;
        }
        .sig-img-container {
            height: 55px;
            display: flex;
            align-items: center;
            justify-content: <?= ($type === 'invoice') ? 'flex-start' : 'flex-end' ?>;
            gap: 6px;
            margin: 3px 0;
            width: 100%;
        }
        .sig-img-container img {
            max-height: 52px;
            max-width: 130px;
            object-fit: contain;
        }

        /* 7. FOOTER */
        .footer-container {
            border-top: 1px solid #cbd5e1;
            padding-top: 8px;
            margin-top: 16px;
            text-align: center;
            font-size: 7.5pt;
            color: #64748b;
            page-break-inside: avoid;
        }
        .footer-logo-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            margin-bottom: 3px;
        }
        .footer-logo-row img {
            height: 18px;
            max-height: 18px;
            object-fit: contain;
        }
        .footer-company-name {
            font-weight: 700;
            color: #004f8b;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
<div class="doc-screen-wrapper">
<table class="page-layout-table">
    <!-- REPEATING TOP LETTERHEAD HEADER ON EVERY PAGE -->
    <thead class="page-layout-header">
        <tr>
            <td style="padding: 0; border: none; background: #ffffff;">
                <?php
                $logoHeightPx = max(20, round(44 * $logoScale));
                $hdrHeightPx = $logoHeightPx + 10;
                if (!empty($hdrImgUrl)) {
                    if (strpos($hdrImgUrl, 'data:image') === 0) {
                        $commaPos = strpos($hdrImgUrl, ',');
                        if ($commaPos !== false) {
                            $rawBytes = @base64_decode(substr($hdrImgUrl, $commaPos + 1));
                            if ($rawBytes !== false) {
                                $imgInfo = @getimagesizefromstring($rawBytes);
                                if ($imgInfo && !empty($imgInfo[0]) && $imgInfo[0] > 0) {
                                    $aspectRatio = $imgInfo[1] / $imgInfo[0];
                                    $calcHeight = round(700 * $aspectRatio);
                                    $hdrHeightPx = max($hdrHeightPx, min(180, $calcHeight));
                                }
                            }
                        }
                    } else {
                        $relPath = ltrim(parse_url($hdrImgUrl, PHP_URL_PATH) ?? '', '/');
                        $localPath = __DIR__ . '/' . $relPath;
                        if (!file_exists($localPath)) {
                            $localPath = $_SERVER['DOCUMENT_ROOT'] . '/' . $relPath;
                        }
                        if (file_exists($localPath) && !is_dir($localPath)) {
                            $imgInfo = @getimagesize($localPath);
                            if ($imgInfo && !empty($imgInfo[0]) && $imgInfo[0] > 0) {
                                $aspectRatio = $imgInfo[1] / $imgInfo[0];
                                $calcHeight = round(700 * $aspectRatio);
                                $hdrHeightPx = max($hdrHeightPx, min(180, $calcHeight));
                            }
                        }
                    }
                    $hdrBgStyle = "background-image: url('" . $hdrImgUrl . "'); background-size: cover; background-position: top center; background-repeat: no-repeat;";
                } else {
                    $hdrBgStyle = 'background: linear-gradient(to right, #004f8b, #0070c0, #0080d0);';
                }
                ?>
                <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; padding: 0; border-bottom: 2px solid #004f8b; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                    <tr>
                        <td colspan="2" style="height: <?= $hdrHeightPx ?>px; padding: 4px 0 3px 0; border: none; <?= $hdrBgStyle ?> -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
                            <!-- Logo + Address content rendered ON TOP of banner background -->
                            <table style="width: 100%; height: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; padding: 0;">
                                <tr>
                                    <!-- Logo Left -->
                                    <td style="width: 55%; vertical-align: bottom; text-align: left; padding: 0; border: none;">
                                        <div style="transform: translate(<?= $logoX ?>px, <?= $logoY ?>px); transform-origin: left bottom; position: relative; display: inline-block;">
                                            <?php if (!empty($logoUrl)): ?>
                                                <img src="<?= $logoUrl ?>" alt="<?= htmlspecialchars($companyName) ?>" style="height: <?= $logoHeightPx ?>px; max-width: <?= round(220 * $logoScale) ?>px; object-fit: contain; display: block;">
                                            <?php else: ?>
                                                <div>
                                                    <div style="font-weight: 900; font-size: <?= round(15 * $logoScale) ?>pt; color: #004f8b; text-transform: uppercase;">
                                                        <?= htmlspecialchars($companyName) ?>
                                                    </div>
                                                    <?php if (!empty($activeSettings['company_reg_no'])): ?>
                                                        <span style="font-size: <?= round(10 * $logoScale) ?>px; font-weight: 700; color: #0070c0; font-family: monospace; display: block;">(<?= htmlspecialchars($activeSettings['company_reg_no']) ?>)</span>
                                                    <?php endif; ?>
                                                </div>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                    <!-- Company Address Right -->
                                    <td style="width: 45%; vertical-align: bottom; text-align: right; padding: 0; border: none; font-size: 7.5pt; line-height: 1.25; color: #1e293b;">
                                        <div style="transform: translate(<?= $addrX ?>px, <?= $addrY ?>px) scale(<?= $addrScale ?>); transform-origin: right bottom; position: relative;">
                                            <?= render_dynamic_address($companyAddress) ?>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </thead>

    <!-- REPEATING BOTTOM FOOTER ON EVERY PAGE -->
    <tfoot class="page-layout-footer">
        <tr>
            <td style="padding: 0; border: none; background: #ffffff;">
                <footer style="border-top: 1px solid #cbd5e1; padding-top: 5px; margin-top: 8px; text-align: center; font-size: 7.5pt; color: #64748b; background: #ffffff;">
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px; table-layout: fixed;">
                        <tr>
                            <td style="text-align: center; vertical-align: middle; padding: 0; border: none;">
                                <?php if (!empty($logoUrl)): ?>
                                    <img src="<?php echo $logoUrl; ?>" alt="Logo" style="height: 16px; max-height: 16px; vertical-align: middle; margin-right: 4px; display: inline-block;">
                                <?php endif; ?>
                                <span style="font-weight: 700; color: #004f8b; text-transform: uppercase; vertical-align: middle;"><?php echo htmlspecialchars($companyName); ?></span>
                            </td>
                        </tr>
                    </table>
                    <p style="margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-line;">
                        <?php echo htmlspecialchars($footerText); ?>
                    </p>
                </footer>
            </td>
        </tr>
    </tfoot>

    <!-- MAIN BODY CONTENT -->
    <tbody class="page-layout-body">
        <tr>
            <td>
                <div style="box-sizing: border-box;">
                    <div>
                        <?php if ($type === 'invoice'): ?>
                            <!-- 1. TITLE STRIP BANNER FOR INVOICE -->
                            <div style="transform: translate(<?= $titleX ?>px, <?= $titleY ?>px);">
                                <div class="title-strip-banner">
                                    <?= htmlspecialchars($headerTitle) ?>
                                </div>
                            </div>

                            <!-- 2. 2-COLUMN ADDRESS & METADATA SECTION (MATCHING EXACT INVOICEBUILDER LAYOUT) -->
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 8pt; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px;">
                                <tr>
                                    <!-- LEFT COLUMN: TO (BILLING ADDRESS) -->
                                    <td style="width: 58%; vertical-align: top; padding: 0 16px 8px 0; border: none;">
                                        <div style="transform: translate(<?= $toAddrX ?>px, <?= $toAddrY ?>px); line-height: 1.4;">
                                            <div style="margin-bottom: 2px;">
                                                <span style="font-weight: 700; text-transform: uppercase;">TO: </span>
                                                <span style="font-weight: 800; text-transform: uppercase;"><?= htmlspecialchars($doc['company_name'] ?? $clientCompany ?? '—') ?></span>
                                            </div>
                                            <?php if (!empty($doc['billing_address'])): ?>
                                                <div style="color: #1e293b; white-space: pre-line; margin-bottom: 3px; font-size: 7.5pt; line-height: 1.25;">
                                                    <?= htmlspecialchars($doc['billing_address']) ?>
                                                </div>
                                            <?php endif; ?>
                                            <?php if (!empty($doc['client_name'] ?? $clientName)): ?>
                                                <div style="margin-top: 2px;">
                                                    <span style="font-weight: 700;">Attention: </span>
                                                    <span style="font-weight: 500;"><?= htmlspecialchars($doc['client_name'] ?? $clientName) ?></span>
                                                </div>
                                            <?php endif; ?>
                                            <?php if (!empty($clientEmail)): ?>
                                                <div>
                                                    <span style="font-weight: 700;">Email: </span>
                                                    <span style="color: #004f8b; text-decoration: underline;"><?= htmlspecialchars($clientEmail) ?></span>
                                                </div>
                                            <?php endif; ?>
                                            <?php if (!empty($doc['client_phone'] ?? $clientPhone)): ?>
                                                <div>
                                                    <span style="font-weight: 700;">Cont. Numb : </span>
                                                    <span style="font-family: monospace;"><?= htmlspecialchars($doc['client_phone'] ?? $clientPhone) ?></span>
                                                </div>
                                            <?php endif; ?>
                                        </div>
                                    </td>

                                    <!-- RIGHT COLUMN: INVOICE METADATA & DELIVERY (SHIPPING ADDRESS) -->
                                    <td style="width: 42%; vertical-align: top; padding: 0 0 8px 0; border: none;">
                                        <div style="transform: translate(<?= $metaX ?>px, <?= $metaY ?>px); line-height: 1.35;">
                                            <!-- INVOICE METADATA -->
                                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 8pt; border: none;">
                                                <tr>
                                                    <td style="font-weight: 700; width: 38%; padding: 1px 0; border: none;">Invoice No. :</td>
                                                    <td style="font-weight: 800; font-family: monospace; padding: 1px 0; border: none;"><?= htmlspecialchars($docRefNo) ?></td>
                                                </tr>
                                                <tr>
                                                    <td style="font-weight: 700; padding: 1px 0; border: none;">Invoice Date :</td>
                                                    <td style="padding: 1px 0; border: none;"><?= htmlspecialchars($docDate) ?></td>
                                                </tr>
                                                <tr>
                                                    <td style="font-weight: 700; padding: 1px 0; border: none;">PO Numb :</td>
                                                    <td style="font-weight: 800; font-family: monospace; padding: 1px 0; border: none;"><?= htmlspecialchars($doc['po_number'] ?? '—') ?></td>
                                                </tr>
                                            </table>

                                            <!-- DELIVERY (SHIPPING ADDRESS) -->
                                            <div style="margin-top: 4px;">
                                                <div style="margin-bottom: 2px;">
                                                    <span style="font-weight: 700; text-transform: uppercase;">DELIVERY: </span>
                                                    <span style="font-weight: 800;"><?= htmlspecialchars($doc['delivery_company'] ?? $doc['company_name'] ?? $clientCompany ?? '—') ?></span>
                                                </div>
                                                <?php if (!empty($doc['delivery_address'] ?? $doc['billing_address'])): ?>
                                                    <div style="color: #1e293b; white-space: pre-line; margin-bottom: 3px; font-size: 7.5pt; line-height: 1.25;">
                                                        <?= htmlspecialchars($doc['delivery_address'] ?? $doc['billing_address']) ?>
                                                    </div>
                                                <?php endif; ?>
                                                <?php if (!empty($doc['delivery_pic'] ?? $clientName)): ?>
                                                    <div style="margin-top: 2px;">
                                                        <span style="font-weight: 700;">PIC – </span>
                                                        <span><?= htmlspecialchars($doc['delivery_pic'] ?? $clientName) ?></span>
                                                    </div>
                                                <?php endif; ?>
                                                <?php if (!empty($doc['delivery_phone'] ?? $clientPhone)): ?>
                                                    <div>
                                                        <span style="font-weight: 700;">Contact No. : </span>
                                                        <span style="font-family: monospace;"><?= htmlspecialchars($doc['delivery_phone'] ?? $clientPhone) ?></span>
                                                    </div>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        <?php else: ?>
                            <!-- 2. METADATA SECTION (QUOTATION) -->
                            <section class="metadata-section">
                                <table class="meta-table">
                                    <tr>
                                        <td class="meta-label">Ref No.</td>
                                        <td class="meta-colon">:</td>
                                        <td class="meta-val-bold font-mono"><?= htmlspecialchars($docRefNo) ?></td>
                                    </tr>
                                    <tr>
                                        <td class="meta-label">Date</td>
                                        <td class="meta-colon">:</td>
                                        <td class="meta-val font-mono"><?= htmlspecialchars($docDate) ?> (Valid: <?= htmlspecialchars($validUntil) ?>)</td>
                                    </tr>
                                    <tr>
                                        <td class="meta-label">Project Reference</td>
                                        <td class="meta-colon">:</td>
                                        <td class="meta-val"><?= htmlspecialchars($projectRef) ?></td>
                                    </tr>
                                    <tr>
                                        <td class="meta-label">Attention</td>
                                        <td class="meta-colon">:</td>
                                        <td class="meta-val-bold">
                                            <?= htmlspecialchars($clientName) ?> <?= !empty($clientCompany) ? '(' . htmlspecialchars($clientCompany) . ')' : '' ?>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="meta-label">Tel No.</td>
                                        <td class="meta-colon">:</td>
                                        <td class="meta-val font-mono"><?= htmlspecialchars(!empty($clientPhone) ? $clientPhone : '—') ?></td>
                                    </tr>
                                    <tr>
                                        <td class="meta-label">Email</td>
                                        <td class="meta-colon">:</td>
                                        <td class="meta-val font-mono"><?= htmlspecialchars(!empty($clientEmail) ? $clientEmail : 'sales@abmalaya.com') ?></td>
                                    </tr>
                                </table>
                            </section>

                            <!-- 3. TITLE STRIP BANNER FOR QUOTATION -->
                            <div class="title-strip-banner">
                                <?= htmlspecialchars($headerTitle) ?>
                            </div>

                            <p class="intro-text">
                                We would like to submit the following commercial quotation and specification list for your review and pricing:
                            </p>
                        <?php endif; ?>

                        <!-- 4. PRODUCT LINE ITEMS TABLE -->
                        <div class="items-table-box">
                            <table class="items-table">
                                <thead class="items-table-header">
                                    <tr>
                                        <th style="width: 4%;" class="text-center">NO.</th>
                                        <th style="width: 38%;">ITEM</th>
                                        <th style="width: 6%;" class="text-center">QTY</th>
                                        <th style="width: 7%;" class="text-center">UNIT</th>
                                        <th style="width: 20%;">OFFERED ITEM</th>
                                        <th style="width: 11%;" class="text-right">UNIT PRICE (MYR)</th>
                                        <th style="width: 14%;" class="text-right">TOTAL PRICE (MYR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php 
                                    $no = 1;
                                    foreach ($items as $idx => $item):
                                        $qty = floatval($item['quantity'] ?? $item['qty'] ?? 1);
                                        $unit = htmlspecialchars($item['unit'] ?? $item['uom'] ?? 'Unit');
                                        $price = floatval($item['unit_price'] ?? $item['price'] ?? 0);
                                        $disc = floatval($item['discount_percent'] ?? 0);
                                        $rowTotal = $qty * $price * (1 - $disc / 100);
                                        
                                        $desc = $item['description'] ?? $item['product_name'] ?? $item['name'] ?? 'Industrial Equipment Supply';
                                        $catMatch = find_catalog_product($desc, $productsCatalog);
                                        
                                        $specText = $item['specification'] ?? ($catMatch['specification'] ?? $catMatch['description'] ?? 'Standard Manufacturer Specification');
                                        $offeredItemText = $item['offer'] ?? $item['offered_item'] ?? $item['offer_name'] ?? '—';
                                        
                                        $rawPhotoUrl = $item['image_url'] ?? ($catMatch['image_url'] ?? '');
                                        $photoUrl = !empty($rawPhotoUrl) ? get_image_data_uri($rawPhotoUrl) : '';
                                    ?>
                                    <tr>
                                        <td class="text-center font-mono"><?= $no++ ?></td>
                                        
                                        <!-- ITEM Column: Stacked Product Name, Specification, and Full-Width Photo -->
                                        <td style="color:#0f172a; vertical-align: top;">
                                            <div style="font-weight: bold; color: #0f172a; font-size: 8pt; margin-bottom: 2px; line-height: 1.2;">
                                                <?= htmlspecialchars($desc) ?>
                                            </div>
                                            <div style="color: #475569; font-size: 7.5pt; line-height: 1.2; margin-bottom: 4px;">
                                                <?= htmlspecialchars($specText) ?>
                                            </div>
                                            <?php if (!empty($photoUrl) && strpos($photoUrl, 'unsplash') === false): ?>
                                                <img src="<?= $photoUrl ?>" alt="<?= htmlspecialchars($desc) ?>" class="product-photo-full">
                                            <?php endif; ?>
                                        </td>

                                        <!-- Quantity -->
                                        <td class="text-center font-mono"><?= $qty ?></td>

                                        <!-- Unit -->
                                        <td class="text-center"><?= $unit ?></td>

                                        <!-- Offered Item / Name Offered -->
                                        <td style="color:#0f172a; vertical-align: top;"><?= htmlspecialchars($offeredItemText) ?></td>

                                        <!-- Unit Price -->
                                        <td class="text-right font-mono"><?= number_format($price, 2) ?></td>

                                        <!-- Total Price -->
                                        <td class="text-right font-mono font-bold"><?= number_format($rowTotal, 2) ?></td>
                                    </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- 5 & 6. CLOSING SECTION (TERMS, FINANCIAL SUMMARY & SIGNATURES ANCHORED AT BOTTOM OF PAGE) -->
                    <div style="margin-top: 12px; padding-top: 6px;">
                        <!-- TERMS & FINANCIAL SUMMARY GRID -->
                        <div class="bottom-grid">
                            <!-- Terms & Conditions / Remarks -->
                            <div class="terms-container">
                                <div class="terms-header"><?= ($type === 'invoice') ? 'REMARKS & BANK PAYMENT INSTRUCTIONS:' : 'TERMS & CONDITIONS:' ?></div>
                                <div class="terms-content"><?= htmlspecialchars($docNotes) ?></div>
                            </div>

                            <!-- Financial Summary Box -->
                            <div class="summary-box">
                                <div class="summary-row">
                                    <span style="font-weight:600;">GROSS SUBTOTAL:</span>
                                    <span class="font-mono font-bold"><?= format_currency($grossSubtotal) ?></span>
                                </div>

                                <?php if ($discountTotal > 0): ?>
                                <div class="summary-row" style="color:#b45309;">
                                    <span style="font-weight:600;">TOTAL DISCOUNT:</span>
                                    <span class="font-mono font-bold">-<?= format_currency($discountTotal) ?></span>
                                </div>
                                <?php endif; ?>

                                <div class="summary-row">
                                    <span style="font-weight:600;">VAT TAX (<?= $taxPercent ?>%):</span>
                                    <span class="font-mono font-bold"><?= format_currency($taxAmount) ?></span>
                                </div>

                                <div class="summary-row grand-total">
                                    <span>GRAND TOTAL:</span>
                                    <span class="font-mono" style="color:#0070c0;"><?= format_currency($grandTotal) ?></span>
                                </div>
                            </div>
                        </div>

                        <!-- AUTHORIZATION SIGNATURE BLOCK -->
                        <div class="signatures-grid" style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; gap: 16px;">
                            <!-- Issuer Signatory -->
                            <div class="sig-issuer-box" style="<?= ($type === 'invoice') ? 'text-align: left;' : 'text-align: right; margin-left: auto;' ?>">
                                <p style="color:#475569; font-weight:700; text-transform:uppercase; font-size:7.5pt; letter-spacing:0.5px;">Yours faithfully,</p>
                                <p style="font-weight:800; color:#0f172a; text-transform:uppercase; font-size:8.5pt; margin-top:1px;"><?= htmlspecialchars($companyName) ?></p>

                                <div class="sig-img-container" style="display: flex; align-items: center; <?= ($type === 'invoice') ? 'justify-content: flex-start;' : 'justify-content: flex-end;' ?> gap: 12px; margin: 4px 0;">
                                    <?php if (!empty($stampUrl)): ?>
                                        <img src="<?php echo $stampUrl; ?>" alt="Company Stamp" style="max-height: 52px; max-width: 130px; object-fit: contain;">
                                    <?php endif; ?>
                                    <?php if (!empty($sigUrl)): ?>
                                        <img src="<?php echo $sigUrl; ?>" alt="Digital Signature" style="max-height: 52px; max-width: 130px; object-fit: contain;">
                                    <?php endif; ?>
                                    <?php if (empty($sigUrl) && empty($stampUrl)): ?>
                                        <div style="width:120px; height:40px; border:2px dashed #0070c0; color:#0070c0; font-size:7.5pt; font-weight:900; display:flex; align-items:center; justify-content:center; text-transform:uppercase;">
                                            [STAMP & SIGNATURE]
                                        </div>
                                    <?php endif; ?>
                                </div>

                                <p style="font-weight:800; color:#0f172a; margin-top:2px;"><u><?= htmlspecialchars($authorisedByName); ?></u></p>
                                <p class="font-mono" style="color:#64748b; font-size:7.5pt; text-transform:uppercase;"><?= htmlspecialchars($authorisedByTitle); ?></p>
                            </div>

                            <?php if ($type === 'invoice'): ?>
                            <!-- Client Receiver Signatory (Received by, Name / Designation, Date) -->
                            <div class="sig-client-box" style="text-align: right; margin-left: auto;">
                                <p style="font-weight:700; color:#334155; text-transform:uppercase; font-size:7.5pt; letter-spacing:0.5px;"><?= htmlspecialchars($receivedByLabel) ?></p>
                                <div style="height: 48px; border-bottom: 2px solid #0f172a; width: 190px; margin: 4px 0 4px auto;"></div>
                                <?php if (!empty($doc['received_by_name'])): ?>
                                    <p style="font-weight:700; color:#0f172a; font-size:8pt; margin-top:2px;"><u><?= htmlspecialchars($doc['received_by_name']) ?></u></p>
                                    <?php if (!empty($doc['received_by_designation'])): ?>
                                        <p class="font-mono" style="color:#64748b; font-size:7.5pt; text-transform:uppercase;"><?= htmlspecialchars($doc['received_by_designation']) ?></p>
                                    <?php endif; ?>
                                    <p class="font-mono" style="color:#64748b; font-size:7.5pt; margin-top:2px;">Date: <?= htmlspecialchars(!empty($doc['received_by_date']) ? $doc['received_by_date'] : '____ / ____ / ________') ?></p>
                                <?php else: ?>
                                    <p style="font-weight:700; color:#0f172a; font-size:7.5pt;"><?= htmlspecialchars($receivedByNameLabel) ?></p>
                                    <p class="font-mono" style="color:#64748b; font-size:7.5pt;"><?= htmlspecialchars($receivedByDateLabel) ?></p>
                                <?php endif; ?>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    </tbody>
</table>
</div>
<?php if (isset($_GET['print']) && ($_GET['print'] == '1' || $_GET['print'] === 'direct')): ?>
<script>
window.addEventListener('load', function() {
    setTimeout(function() {
        try {
            window.focus();
            window.print();
        } catch (e) {
            console.error('Auto-print error:', e);
        }
    }, 350);
});
</script>
<?php endif; ?>
</body>
</html>
