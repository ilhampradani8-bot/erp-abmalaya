<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

require_once __DIR__ . '/db_connect.php';
$connection = isset($conn) ? $conn : $db_conn;

$type = isset($_GET['type']) ? trim($_GET['type']) : 'quotation';
$id = isset($_GET['id']) ? trim($_GET['id']) : '';

if (empty($id)) {
    die("Document ID missing.");
}

// Fetch Paper & Invoice Settings
$paperSettings = [
    'company_name' => 'AB MALAYA SDN. BHD.',
    'company_address' => '2-2-40, 2nd Floor Wisma Rampai, Jalan 34/26, Taman Sri Rampai, 53300 Kuala Lumpur.',
    'phone' => '+60 3-8000 1234',
    'email' => 'sales@abmalaya.com',
    'logo_url' => '/favicon.png',
    'stamp_url' => '',
    'signature_url' => '',
    'header_image_url' => '',
    'header_title' => 'SURAT PENAWARAN HARGA (SPH) / COMMERCIAL QUOTATION',
    'footer_terms' => "1. 50% DP payment required after PO is issued.\n2. Remaining 50% payment upon delivery completion.\n3. Quotation valid for 14 days from issue date.",
    'header_color' => '#0080d0',
    'default_notes' => 'Price excludes transport tax unless explicitly stated. All goods remain property of AB Malaya until fully paid.',
    'paper_size' => 'A4',
    'margin_top' => 18,
    'margin_bottom' => 18,
    'margin_left' => 14,
    'margin_right' => 14,
    'font_size' => 9
];

$resP = $connection->query("SELECT * FROM system_paper_settings WHERE id = 1 LIMIT 1");
if ($resP && $rowP = $resP->fetch_assoc()) {
    foreach ($rowP as $k => $v) {
        if ($v !== null) $paperSettings[$k] = $v;
    }
}

$invoiceSettings = [
    'company_name' => 'AB MALAYA INDUSTRY',
    'company_reg_no' => '003320457-D',
    'company_address' => 'No 3. Jalan Melati Utama 1, Taman Melati Utama, 53100 Setapak, Kuala Lumpur',
    'phone' => '+60 3-8000 1234',
    'email' => 'abmalayaindustry@gmail.com',
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
    'margin_top' => 18,
    'margin_bottom' => 18,
    'margin_left' => 14,
    'margin_right' => 14,
    'font_size' => 9
];

$resI = $connection->query("SELECT * FROM system_invoice_settings WHERE id = 1 LIMIT 1");
if ($resI && $rowI = $resI->fetch_assoc()) {
    foreach ($rowI as $k => $v) {
        if ($v !== null) $invoiceSettings[$k] = $v;
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
    $stmt = $connection->prepare("SELECT * FROM quotations WHERE id = ? OR ref_no = ? LIMIT 1");
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

// Decode items
$items = [];
if (!empty($doc['items_json'])) {
    $items = json_decode($doc['items_json'], true);
} elseif (!empty($doc['items'])) {
    $items = json_decode($doc['items'], true);
}

if (!is_array($items)) $items = [];

// Determine Settings by Type
$activeSettings = ($type === 'invoice') ? $invoiceSettings : $paperSettings;
$logoUrl = !empty($activeSettings['logo_url']) ? $activeSettings['logo_url'] : '/favicon.png';
$stampUrl = !empty($activeSettings['stamp_url']) ? $activeSettings['stamp_url'] : '';
$sigUrl = !empty($activeSettings['signature_url']) ? $activeSettings['signature_url'] : '';
$hdrImgUrl = !empty($activeSettings['header_image_url']) ? $activeSettings['header_image_url'] : '';

$mTop = (int)($activeSettings['margin_top'] ?: 18);
$mBot = (int)($activeSettings['margin_bottom'] ?: 18);
$mLeft = (int)($activeSettings['margin_left'] ?: 14);
$mRight = (int)($activeSettings['margin_right'] ?: 14);
$fSize = (int)($activeSettings['font_size'] ?: 9);
$pSize = !empty($activeSettings['paper_size']) ? $activeSettings['paper_size'] : 'A4';

$docRefNo = $type === 'invoice' ? ($doc['invoice_number'] ?? 'INV-ABM') : ($doc['ref_no'] ?? 'SPH-ABM');
$docDate = !empty($doc['issue_date']) ? date('d/m/Y', strtotime($doc['issue_date'])) : date('d/m/Y');
$clientName = $doc['client_name'] ?? $doc['customer_name'] ?? 'Client Company';
$clientEmail = $doc['client_email'] ?? $doc['customer_email'] ?? '';
$clientPhone = $doc['client_phone'] ?? $doc['customer_phone'] ?? '';
$clientAddress = $doc['client_address'] ?? $doc['customer_address'] ?? '';

$subtotal = 0;
foreach ($items as $it) {
    $qty = floatval($it['quantity'] ?? $it['qty'] ?? 1);
    $price = floatval($it['unit_price'] ?? $it['price'] ?? 0);
    $subtotal += ($qty * $price);
}
$taxPercent = floatval($doc['tax_percent'] ?? 0);
$taxAmount = $subtotal * ($taxPercent / 100);
$grandTotal = floatval($doc['total_amount'] ?? ($subtotal + $taxAmount));

ob_end_clean();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title><?= htmlspecialchars($docRefNo) ?> - <?= htmlspecialchars($activeSettings['company_name']) ?></title>
    <style>
        @page {
            size: <?= htmlspecialchars($pSize) ?> portrait;
            margin: <?= $mTop ?>mm <?= $mRight ?>mm <?= $mBot ?>mm <?= $mLeft ?>mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: <?= $fSize ?>pt;
            color: #0f172a;
            background: #ffffff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .page-container {
            width: 100%;
            margin: 0 auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            page-break-inside: auto;
        }
        tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        thead {
            display: table-header-group;
        }
        tfoot {
            display: table-footer-group;
        }
        .header-banner {
            position: relative;
            background: <?= htmlspecialchars($activeSettings['header_color'] ?? '#0080d0') ?>;
            color: #ffffff;
            padding: 16px 20px;
            margin-bottom: 20px;
            border-bottom: 3px solid #004f8b;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .header-banner img.bg {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0.25;
        }
        .header-content {
            position: relative;
            z-index: 10;
            display: flex;
            width: 100%;
            justify-content: space-between;
            align-items: flex-end;
        }
        .logo-box img {
            max-height: 55px;
            max-width: 220px;
            object-fit: contain;
        }
        .doc-title-box {
            text-align: right;
        }
        .doc-title-box h1 {
            font-size: 14pt;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .doc-title-box p {
            font-size: 10pt;
            font-weight: 700;
            opacity: 0.9;
        }
        .meta-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            gap: 20px;
        }
        .meta-card {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            border-radius: 4px;
        }
        .meta-card h3 {
            font-size: 8pt;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 4px;
            font-weight: 800;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 2px;
        }
        .meta-card p {
            font-size: 9pt;
            line-height: 1.35;
        }
        .item-table {
            margin-bottom: 20px;
        }
        .item-table th {
            background-color: <?= htmlspecialchars($activeSettings['table_header_bg'] ?? '#0f172a') ?>;
            color: <?= htmlspecialchars($activeSettings['table_header_text_color'] ?? '#ffffff') ?>;
            padding: 8px;
            font-size: 8.5pt;
            font-weight: 800;
            text-transform: uppercase;
            text-align: left;
            border: 1px solid #334155;
        }
        .item-table td {
            padding: 7px 8px;
            border: 1px solid #cbd5e1;
            font-size: 8.5pt;
            vertical-align: top;
        }
        .item-table tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; }
        .totals-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
        }
        .totals-table {
            width: 280px;
            border-collapse: collapse;
        }
        .totals-table td {
            padding: 5px 8px;
            border-bottom: 1px solid #cbd5e1;
            font-size: 9pt;
        }
        .totals-table tr.grand-total td {
            font-weight: 900;
            font-size: 10pt;
            color: #0284c7;
            border-top: 2px solid #0284c7;
            border-bottom: 2px solid #0284c7;
            background: #f0f9ff;
        }
        .terms-signature-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 25px;
            gap: 20px;
            page-break-inside: avoid;
        }
        .terms-box {
            flex: 1.2;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 10px;
            border-radius: 4px;
            font-size: 8pt;
            white-space: pre-wrap;
            color: #334155;
        }
        .terms-box h4 {
            font-weight: 800;
            text-transform: uppercase;
            color: #0f172a;
            margin-bottom: 4px;
        }
        .sig-box {
            flex: 0.8;
            text-align: right;
            font-size: 8.5pt;
        }
        .sig-img-container {
            height: 65px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            margin: 6px 0;
        }
        .sig-img-container img {
            max-height: 60px;
            max-width: 130px;
            object-fit: contain;
        }
    </style>
</head>
<body>
<div class="page-container">
    <table>
        <thead>
            <tr>
                <td style="border:none; padding:0;">
                    <div class="header-banner">
                        <?php if (!empty($hdrImgUrl)): ?>
                            <img src="<?= htmlspecialchars($hdrImgUrl) ?>" class="bg" alt="Banner">
                        <?php endif; ?>
                        <div class="header-content">
                            <div class="logo-box">
                                <img src="<?= htmlspecialchars($logoUrl) ?>" alt="Logo">
                            </div>
                            <div class="doc-title-box">
                                <h1><?= htmlspecialchars($type === 'invoice' ? ($activeSettings['invoice_title'] ?? 'OFFICIAL INVOICE') : ($activeSettings['header_title'] ?? 'QUOTATION (SPH)')) ?></h1>
                                <p class="font-mono"><?= htmlspecialchars($docRefNo) ?></p>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        </thead>

        <tbody>
            <tr>
                <td style="border:none; padding:0;">
                    <!-- META CLIENT & ISSUER INFO -->
                    <div class="meta-grid">
                        <div class="meta-card">
                            <h3>Issuer / Company:</h3>
                            <p><strong><?= htmlspecialchars($activeSettings['company_name']) ?></strong></p>
                            <p><?= htmlspecialchars($activeSettings['company_address']) ?></p>
                            <p>Tel: <?= htmlspecialchars($activeSettings['phone']) ?> | Email: <?= htmlspecialchars($activeSettings['email']) ?></p>
                        </div>
                        <div class="meta-card">
                            <h3>Billed To / Client:</h3>
                            <p><strong><?= htmlspecialchars($clientName) ?></strong></p>
                            <?php if (!empty($clientAddress)): ?><p><?= htmlspecialchars($clientAddress) ?></p><?php endif; ?>
                            <p>Email: <?= htmlspecialchars($clientEmail) ?> | Tel: <?= htmlspecialchars($clientPhone) ?></p>
                            <p><strong>Date:</strong> <?= htmlspecialchars($docDate) ?></p>
                        </div>
                    </div>

                    <!-- ITEMS TABLE -->
                    <table class="item-table">
                        <thead>
                            <tr>
                                <th style="width:5%;" class="text-center">No</th>
                                <th style="width:45%;">Item Description / Spec</th>
                                <th style="width:10%;" class="text-center">Qty</th>
                                <th style="width:20%;" class="text-right">Unit Price (MYR)</th>
                                <th style="width:20%;" class="text-right">Total Price (MYR)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $no = 1;
                            foreach ($items as $item):
                                $qty = floatval($item['quantity'] ?? $item['qty'] ?? 1);
                                $price = floatval($item['unit_price'] ?? $item['price'] ?? 0);
                                $rowTotal = $qty * $price;
                                $desc = $item['description'] ?? $item['name'] ?? 'Item Product';
                                $code = $item['impa_code'] ?? $item['code'] ?? '';
                            ?>
                            <tr>
                                <td class="text-center font-mono"><?= $no++ ?></td>
                                <td>
                                    <strong><?= htmlspecialchars($desc) ?></strong>
                                    <?php if (!empty($code)): ?>
                                        <br><span class="font-mono" style="font-size:7.5pt; color:#64748b;">IMPA Code: <?= htmlspecialchars($code) ?></span>
                                    <?php endif; ?>
                                </td>
                                <td class="text-center font-mono"><?= $qty ?></td>
                                <td class="text-right font-mono"><?= number_format($price, 2) ?></td>
                                <td class="text-right font-mono"><?= number_format($rowTotal, 2) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>

                    <!-- TOTALS -->
                    <div class="totals-container">
                        <table class="totals-table">
                            <tr>
                                <td>Subtotal:</td>
                                <td class="text-right font-mono">MYR <?= number_format($subtotal, 2) ?></td>
                            </tr>
                            <?php if ($taxPercent > 0): ?>
                            <tr>
                                <td>SST/Tax (<?= $taxPercent ?>%):</td>
                                <td class="text-right font-mono">MYR <?= number_format($taxAmount, 2) ?></td>
                            </tr>
                            <?php endif; ?>
                            <tr class="grand-total">
                                <td>TOTAL AMOUNT:</td>
                                <td class="text-right font-mono">MYR <?= number_format($grandTotal, 2) ?></td>
                            </tr>
                        </table>
                    </div>

                    <!-- TERMS & SIGNATURE BLOCK -->
                    <div class="terms-signature-grid">
                        <div class="terms-box">
                            <h4>Terms & Instructions:</h4>
                            <?php if ($type === 'invoice'): ?>
                                <p><?= htmlspecialchars($activeSettings['remarks_text']) ?></p>
                                <p style="margin-top:4px;"><strong>Bank:</strong> <?= htmlspecialchars($activeSettings['bank_name']) ?> | <strong>Acc:</strong> <?= htmlspecialchars($activeSettings['bank_account_number']) ?> (<?= htmlspecialchars($activeSettings['bank_account_name']) ?>)</p>
                            <?php else: ?>
                                <p><?= htmlspecialchars($activeSettings['footer_terms'] ?? $activeSettings['default_notes']) ?></p>
                            <?php endif; ?>
                        </div>

                        <div class="sig-box">
                            <p style="font-weight:700; text-transform:uppercase;">Yours faithfully,</p>
                            <p style="font-weight:800; text-transform:uppercase; color:#0f172a;"><?= htmlspecialchars($activeSettings['company_name']) ?></p>
                            
                            <div class="sig-img-container">
                                <?php if (!empty($sigUrl)): ?>
                                    <img src="<?= htmlspecialchars($sigUrl) ?>" alt="Signature">
                                <?php endif; ?>
                                <?php if (!empty($stampUrl)): ?>
                                    <img src="<?= htmlspecialchars($stampUrl) ?>" alt="Stamp">
                                <?php endif; ?>
                            </div>

                            <p style="font-weight:800;"><u><?= htmlspecialchars($activeSettings['authorised_by_name'] ?? 'Muhammad Aimanuddin Bin Mohd Zaki') ?></u></p>
                            <p style="font-size:7.5pt; color:#64748b;"><?= htmlspecialchars($activeSettings['authorised_by_title'] ?? 'Procurement Manager / Head of Sales') ?></p>
                        </div>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>
</div>
</body>
</html>
