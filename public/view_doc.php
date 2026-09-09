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
    die("Document ID missing.");
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
    $stmt = $connection->prepare("SELECT * FROM invoices WHERE id = ? OR invoice_number = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("ss", $id, $id);
        $stmt->execute();
        $r = $stmt->get_result();
        if ($r && $row = $r->fetch_assoc()) {
            $doc = $row;
        }
        $stmt->close();
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
}

if (!$doc) {
    die("Document record not found.");
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

$logoX = intval($logoOffsets['x'] ?? 0);
$logoY = intval($logoOffsets['y'] ?? 0);
$logoScale = floatval($logoOffsets['scale'] ?? 1.0);
if ($logoScale <= 0) $logoScale = 1.0;

$addrX = intval($addrOffsets['x'] ?? 0);
$addrY = intval($addrOffsets['y'] ?? 0);

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
$createdBy = (!empty($doc['created_by']) && trim($doc['created_by']) !== '') ? trim($doc['created_by']) : (!empty($activeSettings['authorised_by_name']) ? $activeSettings['authorised_by_name'] : 'Muhammad Aimanuddin Bin Mohd Zaki');
$docNotes = !empty($doc['notes']) ? $doc['notes'] : ($activeSettings['footer_terms'] ?? $activeSettings['default_notes']);

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
            $cls = ($idx === 0) ? 'font-weight: 700; color: #0f172a; font-size: 8.5pt;' : 'color: #1e293b;';
            $out .= '<p style="' . $cls . '">' . htmlspecialchars($line) . '</p>';
        }
        return $out;
    }
    
    $parts = array_filter(array_map('trim', explode(',', $clean)));
    if (count($parts) >= 3) {
        $line1 = implode(', ', array_slice($parts, 0, 2)) . ',';
        $line2 = implode(', ', array_slice($parts, 2, count($parts) - 3)) . ',';
        $line3 = $parts[count($parts) - 1];
        return '<p style="font-weight: 700; color: #0f172a; font-size: 8.5pt;">' . htmlspecialchars($line1) . '</p>' .
               '<p style="color: #1e293b;">' . htmlspecialchars($line2) . '</p>' .
               '<p style="font-weight: 600; color: #0f172a;">' . htmlspecialchars($line3) . '</p>';
    }
    
    return '<p style="font-weight: 600; color: #0f172a;">' . htmlspecialchars($clean) . '</p>';
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
        }
        @page {
            size: A4 portrait;
            margin: 4mm;
        }
        html, body {
            width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #0f172a;
            font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
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

        @media print {
            .items-table tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            .bottom-grid, .signatures-grid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
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
            font-size: 9.5pt;
            padding: 6px 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
            margin-bottom: 8px;
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
            justify-content: space-between;
            align-items: flex-end;
            border-top: 1px solid #cbd5e1;
            padding-top: 12px;
            margin-top: 16px;
            font-size: 8pt;
            gap: 16px;
            page-break-inside: avoid;
            break-inside: avoid;
        }
        .sig-client-box {
            flex: 1;
        }
        .sig-client-line {
            height: 55px;
            border-bottom: 1px solid #94a3b8;
            width: 180px;
            margin-bottom: 4px;
        }
        .sig-issuer-box {
            flex: 1;
            text-align: right;
        }
        .sig-img-container {
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
            margin: 3px 0;
        }
        .sig-img-container img {
            max-height: 55px;
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
<table class="page-layout-table">
    <!-- REPEATING TOP LETTERHEAD HEADER ON EVERY PAGE -->
    <thead class="page-layout-header">
        <tr>
            <td style="padding: 0; border: none; background: #ffffff;">
                <div style="width: 100%; border-bottom: 2px solid #004f8b; padding-bottom: 4px; margin-bottom: 6px; background: #ffffff;">
                    <?php if (!empty($hdrImgUrl)): ?>
                        <div style="width: 100%; margin-bottom: 4px;">
                            <img src="<?= $hdrImgUrl ?>" alt="Header Banner" style="width: 100%; max-height: 70px; object-fit: cover; display: block;">
                        </div>
                    <?php else: ?>
                        <div style="width: 100%; height: 4px; background: linear-gradient(to right, #004f8b, #0070c0, #0080d0); margin-bottom: 4px;"></div>
                    <?php endif; ?>

                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0; padding: 0;">
                        <tr>
                            <!-- Logo Left -->
                            <td style="width: 55%; vertical-align: bottom; text-align: left; padding: 0; border: none;">
                                <div style="margin-left: <?= $logoX ?>px; margin-top: <?= $logoY ?>px;">
                                    <?php if (!empty($logoUrl)): ?>
                                        <img src="<?= $logoUrl ?>" alt="<?= htmlspecialchars($companyName) ?>" style="height: <?= round(48 * $logoScale) ?>px; max-width: 240px; object-fit: contain; display: block;">
                                    <?php else: ?>
                                        <div style="font-weight:900; font-size:16pt; color:#004f8b; text-transform:uppercase;">
                                            <?= htmlspecialchars($companyName) ?>
                                        </div>
                                    <?php endif; ?>
                                </div>
                            </td>

                            <!-- Company Address Right -->
                            <td style="width: 45%; vertical-align: bottom; text-align: right; padding: 0; border: none; font-size: 8pt; line-height: 1.3; color: #1e293b;">
                                <div style="margin-right: <?= $addrX ?>px; margin-top: <?= $addrY ?>px;">
                                    <?= render_dynamic_address($companyAddress) ?>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
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
                    <p style="margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                        <?php echo htmlspecialchars($companyEmail); ?>, <?php echo htmlspecialchars($companyPhone); ?>, <?php echo htmlspecialchars($companyWebsite); ?>
                    </p>
                </footer>
            </td>
        </tr>
    </tfoot>

    <!-- MAIN BODY CONTENT -->
    <tbody class="page-layout-body">
        <tr>
            <td>
                <!-- 2. METADATA SECTION -->
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

                <!-- 3. TITLE STRIP BANNER -->
                <div class="title-strip-banner">
                    <?= htmlspecialchars($headerTitle) ?>
                </div>

                <p class="intro-text">
                    We would like to submit the following commercial quotation and specification list for your review and pricing:
                </p>

                <!-- 4. PRODUCT LINE ITEMS TABLE -->
                <div class="items-table-box">
                    <table class="items-table">
                        <thead class="items-table-header">
                            <tr>
                                <th style="width: 3.5%;" class="text-center">NO.</th>
                                <th style="width: 4.5%;" class="text-center">IMG</th>
                                <th style="width: 11%;" class="font-mono">PRODUCT CODE</th>
                                <th style="width: 7.5%;" class="font-mono">IMPA</th>
                                <th style="width: 15.5%;">PRODUCT NAME</th>
                                <th style="width: 21%;">SPECIFICATION</th>
                                <th style="width: 4%;" class="text-center">QTY</th>
                                <th style="width: 5%;" class="text-center">UNIT</th>
                                <th style="width: 11%;" class="text-right">UNIT PRICE (MYR)</th>
                                <th style="width: 5%;" class="text-center">DISC (%)</th>
                                <th style="width: 12%;" class="text-right">TOTAL (MYR)</th>
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
                                
                                $pCode = $item['product_code'] ?? $item['item_code'] ?? ($catMatch['product_code'] ?? '—');
                                $impaCode = $item['impa_code'] ?? ($catMatch['impa_code'] ?? '—');
                                $specText = $item['specification'] ?? $item['offer'] ?? ($catMatch['specification'] ?? $catMatch['description'] ?? 'Standard Manufacturer Specification');
                                
                                $rawPhotoUrl = $item['image_url'] ?? ($catMatch['image_url'] ?? '');
                                $photoUrl = !empty($rawPhotoUrl) ? get_image_data_uri($rawPhotoUrl) : '';
                            ?>
                            <tr>
                                <td class="text-center font-mono"><?= $no++ ?></td>
                                
                                <!-- Photo Cell -->
                                <td class="text-center">
                                    <?php if (!empty($photoUrl) && strpos($photoUrl, 'unsplash') === false): ?>
                                        <img src="<?= $photoUrl ?>" alt="<?= htmlspecialchars($desc) ?>" class="product-photo">
                                    <?php else: ?>
                                        <div class="no-photo-box">📦</div>
                                    <?php endif; ?>
                                </td>

                                <!-- Product Code -->
                                <td class="font-mono" style="color:#0f172a;"><?= htmlspecialchars($pCode) ?></td>

                                <!-- IMPA Code -->
                                <td class="font-mono" style="color:#581c87;"><?= htmlspecialchars($impaCode) ?></td>

                                <!-- Product Name -->
                                <td style="font-weight: normal; color:#0f172a;"><?= htmlspecialchars($desc) ?></td>

                                <!-- Specification -->
                                <td style="color:#334155; font-size:7.5pt; line-height:1.25;"><?= htmlspecialchars($specText) ?></td>

                                <!-- Quantity -->
                                <td class="text-center font-mono"><?= $qty ?></td>

                                <!-- Unit -->
                                <td class="text-center"><?= $unit ?></td>

                                <!-- Unit Price -->
                                <td class="text-right font-mono"><?= number_format($price, 2) ?></td>

                                <!-- Discount % -->
                                <td class="text-center font-mono"><?= $disc > 0 ? $disc . '%' : '-' ?></td>

                                <!-- Total Price -->
                                <td class="text-right font-mono font-bold"><?= number_format($rowTotal, 2) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

                <!-- 5. TERMS & FINANCIAL SUMMARY GRID (Last Page Only) -->
                <div class="bottom-grid">
                    <!-- Terms & Conditions -->
                    <div class="terms-container">
                        <div class="terms-header">TERMS & CONDITIONS:</div>
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

                <!-- 6. DUAL AUTHORIZATION SIGNATURE BLOCK (Last Page Only) -->
                <div class="signatures-grid">
                    <!-- Client Acceptance -->
                    <div class="sig-client-box">
                        <p style="color:#475569; font-weight:700; text-transform:uppercase; font-size:7.5pt; letter-spacing:0.5px;">CONFIRMED & ACCEPTED BY (CLIENT):</p>
                        <div class="sig-client-line"></div>
                        <p style="font-weight:700; color:#0f172a; margin-top:3px;">NAME: (<?= htmlspecialchars($clientName) ?>)</p>
                        <p class="font-mono" style="color:#475569; font-size:7.5pt;">COMPANY: <?= htmlspecialchars(!empty($clientCompany) ? $clientCompany : 'Client Company') ?></p>
                        <p class="font-mono" style="color:#64748b; font-size:7.5pt;">DATE: ____ / ____ / ________</p>
                    </div>

                    <!-- Issuer Signatory -->
                    <div class="sig-issuer-box">
                        <p style="color:#475569; font-weight:700; text-transform:uppercase; font-size:7.5pt; letter-spacing:0.5px;">Yours faithfully,</p>
                        <p style="font-weight:800; color:#0f172a; text-transform:uppercase; font-size:8.5pt; margin-top:1px;"><?= htmlspecialchars($companyName) ?></p>

                        <div class="sig-img-container">
                            <?php if (!empty($sigUrl)): ?>
                                <img src="<?php echo $sigUrl; ?>" alt="Digital Signature">
                            <?php endif; ?>
                            <?php if (!empty($stampUrl)): ?>
                                <img src="<?php echo $stampUrl; ?>" alt="Company Stamp">
                            <?php endif; ?>
                            <?php if (empty($sigUrl) && empty($stampUrl)): ?>
                                <div style="width:120px; height:40px; border:2px dashed #0070c0; color:#0070c0; font-size:7.5pt; font-weight:900; display:flex; align-items:center; justify-content:center; text-transform:uppercase;">
                                    [STAMP]
                                </div>
                            <?php endif; ?>
                        </div>

                        <p style="font-weight:800; color:#0f172a; margin-top:2px;"><u><?php echo htmlspecialchars($createdBy); ?></u></p>
                        <p class="font-mono" style="color:#64748b; font-size:7.5pt; text-transform:uppercase;">HEAD OF SALES & LOGISTICS</p>
                    </div>
                </div>
            </td>
        </tr>
    </tbody>
</table>
</body>
</html>
