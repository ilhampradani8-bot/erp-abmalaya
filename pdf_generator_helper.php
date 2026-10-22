<?php
/**
 * AB Malaya ERP - Pure PHP PDF Generator Helper
 * Generates 100% valid PDF 1.4 documents natively in PHP without Puppeteer/Node.js dependencies.
 * Compatible with cPanel shared hosting, Linux daemons, and web endpoints.
 * Source of truth for all Quotation & Invoice PDFs (Preview & Sent Email Attachment).
 */

if (!function_exists('createQuotationPdfFile')) {
    function createQuotationPdfFile(string $filePath, $quo, $customConn = null): bool {
        global $connection, $db_conn;
        $db = $customConn ?: ($connection ?: $db_conn);

        if (!is_array($quo)) {
            $quo = ['quotation_number' => (string)$quo];
        }

        $qId = $quo['id'] ?? '';
        $qNum = $quo['quotation_number'] ?? 'QUO-001';

        // 1. If database connection exists, hydrate quotation details if missing
        if ($db && (!empty($qId) || !empty($qNum)) && empty($quo['company_name'])) {
            $qEscId = $db->real_escape_string($qId);
            $qEscNum = $db->real_escape_string($qNum);
            $fullQ = $db->query("SELECT * FROM quotations WHERE id = '{$qEscId}' OR quotation_number = '{$qEscNum}' LIMIT 1");
            if ($fullQ && $fRow = $fullQ->fetch_assoc()) {
                $quo = array_merge($fRow, $quo);
                if (empty($qId)) $qId = $fRow['id'] ?? '';
                if (empty($qNum)) $qNum = $fRow['quotation_number'] ?? '';
            }
        }

        $cName = !empty($quo['company_name']) ? $quo['company_name'] : (!empty($quo['client_name']) ? $quo['client_name'] : 'Valued Client');
        $pName = !empty($quo['client_name']) ? $quo['client_name'] : '';
        $cEmail = $quo['client_email'] ?? '';
        $cPhone = !empty($quo['client_phone']) ? $quo['client_phone'] : (!empty($quo['phone']) ? $quo['phone'] : '');
        $date = !empty($quo['date_issued']) ? $quo['date_issued'] : date('Y-m-d');
        $validUntil = !empty($quo['valid_until']) ? $quo['valid_until'] : '14 Days';
        $subtotalVal = (float)($quo['subtotal'] ?? 0);
        $taxPercent = (float)($quo['tax_percent'] ?? 0);
        $taxAmount = (float)($quo['tax_amount'] ?? 0);
        $grandTotalVal = (float)($quo['grand_total'] ?? 0);
        if ($grandTotalVal <= 0 && $subtotalVal > 0) {
            $grandTotalVal = $subtotalVal + $taxAmount;
        }
        $totalFormatted = number_format($grandTotalVal, 2);

        // 2. Extract or query line items
        $items = [];
        if (!empty($quo['items'])) {
            $items = is_string($quo['items']) ? json_decode($quo['items'], true) : $quo['items'];
        }
        if (empty($items) && !empty($quo['items_details'])) {
            $items = is_string($quo['items_details']) ? json_decode($quo['items_details'], true) : $quo['items_details'];
        }

        // If items still empty, query MySQL `quotation_items` table directly
        if (empty($items) && $db && (!empty($qId) || !empty($qNum))) {
            $qEscId = $db->real_escape_string($qId);
            $qEscNum = $db->real_escape_string($qNum);
            $qItems = $db->query("SELECT * FROM quotation_items WHERE quotation_id = '{$qEscId}' OR quotation_id = '{$qEscNum}' ORDER BY id ASC");
            if ($qItems && $qItems->num_rows > 0) {
                $items = [];
                while ($itRow = $qItems->fetch_assoc()) {
                    $items[] = [
                        'product_code' => $itRow['product_code'] ?? '',
                        'category_code' => $itRow['category_code'] ?? '',
                        'impa_code' => $itRow['impa_code'] ?? '',
                        'description' => $itRow['description'] ?? '',
                        'specification' => $itRow['specification'] ?? '',
                        'offer' => $itRow['offer'] ?? '',
                        'quantity' => (float)($itRow['quantity'] ?? 1),
                        'unit' => $itRow['unit'] ?? 'Unit',
                        'unit_price' => (float)($itRow['unit_price'] ?? 0),
                        'discount_percent' => (float)($itRow['discount_percent'] ?? 0),
                        'total' => (float)($itRow['total'] ?? 0)
                    ];
                }
            }
        }

        if (empty($items) || !is_array($items)) {
            $items = [
                [
                    'description' => 'Commercial Industrial Supplies & Engineering Solutions as per RFQ',
                    'quantity' => 1,
                    'unit' => 'Lot',
                    'unit_price' => $grandTotalVal,
                    'total' => $grandTotalVal
                ]
            ];
        }

        // 3. Build Pure PDF 1.4 Graphics Stream
        $stream = "BT\n";
        // Company Header (Navy Blue theme)
        $stream .= "/F2 16 Tf\n 50 788 Td\n (AB MALAYA INDUSTRY) Tj\n";
        $stream .= "/F1 9 Tf\n 0 -13 Td\n (Commercial Quotation & Engineering Solutions Provider) Tj\n";
        $stream .= "0 -11 Td\n (Wisma Rampai, Jalan 34/26, 53300 Kuala Lumpur | Email: sales@abmalaya.com) Tj\n";
        $stream .= "ET\n";
        
        // Header Divider Line
        $stream .= "0.8 w\n 0 0.44 0.75 RG\n 50 750 m 545 750 l S\n 0 0 0 RG\n";

        // Document Title: OFFICIAL COMMERCIAL QUOTATION (STRICTLY NO "SPH")
        $stream .= "BT\n";
        $stream .= "/F2 12 Tf\n 50 726 Td\n (OFFICIAL COMMERCIAL QUOTATION) Tj\n";
        $stream .= "/F2 8.5 Tf\n 0 -16 Td\n (Quotation No  : ) Tj\n /F1 8.5 Tf\n (" . addcslashes($qNum, "()\\") . ") Tj\n";
        $stream .= "/F2 8.5 Tf\n 0 -12 Td\n (Date Issued   : ) Tj\n /F1 8.5 Tf\n (" . addcslashes($date, "()\\") . ") Tj\n";
        $stream .= "/F2 8.5 Tf\n 0 -12 Td\n (Validity      : ) Tj\n /F1 8.5 Tf\n (" . addcslashes($validUntil, "()\\") . ") Tj\n";
        $stream .= "ET\n";

        // Client Details Block (Right Column)
        $stream .= "BT\n";
        $stream .= "/F2 8.5 Tf\n 320 710 Td\n (Client / Bill To:) Tj\n";
        $stream .= "/F1 8.5 Tf\n 0 -12 Td\n (" . addcslashes($cName, "()\\") . ") Tj\n";
        if (!empty($pName) && strcasecmp($pName, $cName) !== 0) {
            $stream .= "0 -11 Td\n (Attn: " . addcslashes($pName, "()\\") . ") Tj\n";
        }
        if (!empty($cEmail)) {
            $stream .= "0 -11 Td\n (Email: " . addcslashes($cEmail, "()\\") . ") Tj\n";
        }
        if (!empty($cPhone) && $cPhone !== '-') {
            $stream .= "0 -11 Td\n (Phone: " . addcslashes($cPhone, "()\\") . ") Tj\n";
        }
        $stream .= "ET\n";

        // Table Header Rectangle (Solid Navy Tint)
        $stream .= "0.0 0.44 0.75 rg\n 50 630 495 18 re f\n 1 1 1 rg\n";
        $stream .= "BT\n";
        $stream .= "/F2 8 Tf\n 55 635 Td\n (NO) Tj\n 24 0 Td\n (DESCRIPTION & SPECIFICATION) Tj\n 246 0 Td\n (QTY) Tj\n 45 0 Td\n (UNIT) Tj\n 40 0 Td\n (UNIT PRICE (MYR)) Tj\n 85 0 Td\n (TOTAL (MYR)) Tj\n";
        $stream .= "ET\n 0 0 0 rg\n";

        // Table Rows
        $y = 612;
        $idx = 1;
        foreach ($items as $it) {
            $desc = trim($it['description'] ?? $it['product_name'] ?? 'Item');
            $impa = !empty($it['impa_code']) ? '[IMPA ' . trim($it['impa_code']) . '] ' : '';
            $fullDesc = substr($impa . $desc, 0, 48);

            $qty = (float)($it['quantity'] ?? 1);
            $unit = substr($it['unit'] ?? 'Unit', 0, 8);
            $uPrice = number_format((float)($it['unit_price'] ?? 0), 2);
            $iTot = number_format((float)($it['total'] ?? ($qty * (float)($it['unit_price'] ?? 0))), 2);

            // Row background zebra stripe (subtle)
            if ($idx % 2 === 0) {
                $stream .= "0.96 0.97 0.98 rg\n 50 " . ($y - 4) . " 495 14 re f\n 0 0 0 rg\n";
            }

            $stream .= "BT\n";
            $stream .= "/F1 7.5 Tf\n 55 {$y} Td\n ({$idx}) Tj\n 24 0 Td\n (" . addcslashes($fullDesc, "()\\") . ") Tj\n 246 0 Td\n ({$qty}) Tj\n 45 0 Td\n (" . addcslashes($unit, "()\\") . ") Tj\n 40 0 Td\n ({$uPrice}) Tj\n 85 0 Td\n ({$iTot}) Tj\n";
            $stream .= "ET\n";

            $y -= 14;
            $idx++;
            if ($idx > 26) break; // Keep cleanly within single page
        }

        // Bottom Table Border
        $stream .= "0.5 w\n 0.8 0.8 0.8 RG\n 50 " . ($y + 6) . " m 545 " . ($y + 6) . " l S\n 0 0 0 RG\n";

        // Grand Total Block
        $yTot = $y - 6;
        $stream .= "0.93 0.95 0.98 rg\n 330 " . ($yTot - 18) . " 215 22 re f\n 0 0 0 rg\n";
        $stream .= "BT\n";
        $stream .= "/F2 9.5 Tf\n 340 " . ($yTot - 12) . " Td\n (GRAND TOTAL : MYR {$totalFormatted}) Tj\n";
        $stream .= "ET\n";

        // Terms & Conditions Block
        $stream .= "BT\n";
        $stream .= "/F2 8 Tf\n 50 115 Td\n (Terms & Conditions:) Tj\n";
        $stream .= "/F1 7.5 Tf\n 0 -11 Td\n (1. All prices quoted in Malaysian Ringgit (MYR). Payment terms as agreed upon purchase order.) Tj\n";
        $stream .= "0 -10 Td\n (2. This is an official electronic commercial quotation issued by AB Malaya Industry ERP.) Tj\n";
        $stream .= "0 -10 Td\n (3. Goods offered are subject to stock availability and standard manufacturer warranty.) Tj\n";
        $stream .= "/F2 8 Tf\n 380 95 Td\n (Authorized Signature:) Tj\n";
        $stream .= "/F1 8 Tf\n 0 -22 Td\n (AB MALAYA SALES & COMMERCIAL TEAM) Tj\n";
        $stream .= "ET\n";

        // 4. Assemble PDF Catalog, Pages, and xref table
        $objects = [];
        $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        $objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
        $objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>";
        $objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
        $objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

        $streamLen = strlen($stream);
        $objects[6] = "<< /Length {$streamLen} >>\nstream\n{$stream}\nendstream";

        $out = "%PDF-1.4\n";
        $xref = [];
        $xref[0] = "0000000000 65535 f \n";

        for ($i = 1; $i <= 6; $i++) {
            $xref[$i] = sprintf("%010d 00000 n \n", strlen($out));
            $out .= "{$i} 0 obj\n" . $objects[$i] . "\nendobj\n";
        }

        $xrefStart = strlen($out);
        $out .= "xref\n0 7\n";
        for ($i = 0; $i <= 6; $i++) {
            $out .= $xref[$i];
        }
        $out .= "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n{$xrefStart}\n%%EOF";

        // 5. Ensure target directories exist and write to primary destination
        @mkdir(dirname($filePath), 0755, true);
        @file_put_contents($filePath, $out);

        // 6. Synchronize exact PDF to both public/uploads/pdf and uploads/pdf
        $cleanFn = basename($filePath);
        $mirrorPaths = [
            __DIR__ . '/uploads/pdf/' . $cleanFn,
            __DIR__ . '/public/uploads/pdf/' . $cleanFn,
            dirname(__DIR__) . '/uploads/pdf/' . $cleanFn,
            dirname(__DIR__) . '/public/uploads/pdf/' . $cleanFn,
            '/root/erp-abmalaya/uploads/pdf/' . $cleanFn,
            '/root/erp-abmalaya/public/uploads/pdf/' . $cleanFn
        ];

        foreach ($mirrorPaths as $mPath) {
            if ($mPath !== $filePath) {
                @mkdir(dirname($mPath), 0755, true);
                @file_put_contents($mPath, $out);
            }
        }

        // 7. Update database record with identical source path
        if ($db && (!empty($qId) || !empty($qNum))) {
            $relUrl = '/uploads/pdf/' . $cleanFn;
            $qEscId = $db->real_escape_string($qId);
            $qEscNum = $db->real_escape_string($qNum);
            $db->query("UPDATE quotations SET quotation_file = '{$relUrl}', pdf_created = 1, pdf_created_at = NOW() WHERE id = '{$qEscId}' OR quotation_number = '{$qEscNum}'");
        }

        return file_exists($filePath) && filesize($filePath) > 100;
    }
}

if (!function_exists('createInvoicePdfFile')) {
    function createInvoicePdfFile(string $filePath, $inv, $customConn = null): bool {
        global $connection, $db_conn;
        $db = $customConn ?: ($connection ?: $db_conn);

        if (!is_array($inv)) {
            $inv = ['invoice_number' => (string)$inv];
        }

        $invId = $inv['id'] ?? '';
        $invNum = $inv['invoice_number'] ?? 'INV-001';

        if ($db && (!empty($invId) || !empty($invNum)) && empty($inv['company_name'])) {
            $iEscId = $db->real_escape_string($invId);
            $iEscNum = $db->real_escape_string($invNum);
            $fullI = $db->query("SELECT * FROM invoices WHERE id = '{$iEscId}' OR invoice_number = '{$iEscNum}' LIMIT 1");
            if ($fullI && $fRow = $fullI->fetch_assoc()) {
                $inv = array_merge($fRow, $inv);
            }
        }

        $cName = $inv['company_name'] ?? 'Client Company';
        $pName = $inv['client_name'] ?? 'Sir/Madam';
        $cEmail = $inv['client_email'] ?? '';
        $date = $inv['invoice_date'] ?? date('Y-m-d');
        $dueDate = $inv['due_date'] ?? date('Y-m-d', strtotime('+14 days'));
        $total = number_format((float)($inv['grand_total'] ?? 0), 2);
        $bankName = $inv['bank_name'] ?? 'PUBLIC BANK';
        $bankAcc = $inv['bank_account_number'] ?? '3818192115';
        $bankOwner = $inv['bank_account_name'] ?? 'AB MALAYA INDUSTRY';

        $items = [];
        if (!empty($inv['items'])) {
            $items = is_string($inv['items']) ? json_decode($inv['items'], true) : $inv['items'];
        }
        if (empty($items)) {
            $items = [
                [
                    'description' => 'Commercial Invoice for Equipment & Engineering Services',
                    'quantity' => 1,
                    'unit_price' => (float)($inv['grand_total'] ?? 0),
                    'total' => (float)($inv['grand_total'] ?? 0)
                ]
            ];
        }

        $stream = "BT\n";
        $stream .= "/F2 16 Tf\n 50 785 Td\n (AB MALAYA INDUSTRY) Tj\n";
        $stream .= "/F1 9 Tf\n 0 -14 Td\n (Commercial Invoicing & Billing Division) Tj\n";
        $stream .= "0 -12 Td\n (Email: sales@abmalaya.com | Web: https://abmalaya.com) Tj\n";
        $stream .= "ET\n";
        $stream .= "0.5 w\n 50 745 m 545 745 l S\n";
        $stream .= "BT\n";
        $stream .= "/F2 13 Tf\n 50 720 Td\n (OFFICIAL COMMERCIAL INVOICE) Tj\n";
        $stream .= "/F2 9 Tf\n 0 -18 Td\n (Invoice No   : ) Tj\n /F1 9 Tf\n (" . addcslashes($invNum, "()\\") . ") Tj\n";
        $stream .= "/F2 9 Tf\n 0 -14 Td\n (Invoice Date : ) Tj\n /F1 9 Tf\n (" . addcslashes($date, "()\\") . ") Tj\n";
        $stream .= "/F2 9 Tf\n 0 -14 Td\n (Due Date     : ) Tj\n /F1 9 Tf\n (" . addcslashes($dueDate, "()\\") . ") Tj\n";
        $stream .= "/F2 9 Tf\n 0 -14 Td\n (Bill To      : ) Tj\n /F1 9 Tf\n (" . addcslashes($cName . ($pName ? " - Attn: " . $pName : ""), "()\\") . ") Tj\n";
        if ($cEmail) {
            $stream .= "/F2 9 Tf\n 0 -14 Td\n (Client Email : ) Tj\n /F1 9 Tf\n (" . addcslashes($cEmail, "()\\") . ") Tj\n";
        }
        $stream .= "ET\n";
        $stream .= "0.9 0.92 0.95 rg\n 50 610 495 18 re f\n";
        $stream .= "0 g\n";
        $stream .= "BT\n";
        $stream .= "/F2 8 Tf\n 55 615 Td\n (NO) Tj\n 25 0 Td\n (DESCRIPTION) Tj\n 260 0 Td\n (QTY) Tj\n 55 0 Td\n (UNIT PRICE (MYR)) Tj\n 85 0 Td\n (TOTAL (MYR)) Tj\n";
        $stream .= "ET\n";
        
        $y = 593;
        $idx = 1;
        foreach ($items as $it) {
            $desc = substr($it['description'] ?? $it['product_name'] ?? 'Item', 0, 48);
            $qty = $it['quantity'] ?? 1;
            $uPrice = number_format((float)($it['unit_price'] ?? 0), 2);
            $iTot = number_format((float)($it['total'] ?? 0), 2);
            
            $stream .= "BT\n";
            $stream .= "/F1 8 Tf\n 55 {$y} Td\n ({$idx}) Tj\n 25 0 Td\n (" . addcslashes($desc, "()\\") . ") Tj\n 260 0 Td\n ({$qty}) Tj\n 55 0 Td\n ({$uPrice}) Tj\n 85 0 Td\n ({$iTot}) Tj\n";
            $stream .= "ET\n";
            
            $y -= 15;
            $idx++;
            if ($idx > 25) break;
        }
        
        $stream .= "0.3 w\n 50 " . ($y + 8) . " m 545 " . ($y + 8) . " l S\n";
        $stream .= "BT\n";
        $stream .= "/F2 11 Tf\n 330 " . ($y - 12) . " Td\n (GRAND TOTAL : MYR {$total}) Tj\n";
        $stream .= "/F2 8 Tf\n 50 120 Td\n (Payment Instructions:) Tj\n";
        $stream .= "/F1 8 Tf\n 0 -11 Td\n (Bank: " . addcslashes($bankName, "()\\") . " | Account: " . addcslashes($bankAcc, "()\\") . " | Beneficiary: " . addcslashes($bankOwner, "()\\") . ") Tj\n";
        $stream .= "0 -10 Td\n (Please send remittance advice to: finance@abmalaya.com) Tj\n";
        $stream .= "/F2 8 Tf\n 380 95 Td\n (Authorized Finance Signature:) Tj\n";
        $stream .= "/F1 8 Tf\n 0 -24 Td\n (AB MALAYA FINANCE DIVISION) Tj\n";
        $stream .= "ET\n";
        
        $objects = [];
        $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
        $objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
        $objects[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>";
        $objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
        $objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
        
        $streamLen = strlen($stream);
        $objects[6] = "<< /Length {$streamLen} >>\nstream\n{$stream}\nendstream";
        
        $out = "%PDF-1.4\n";
        $xref = [];
        $xref[0] = "0000000000 65535 f \n";
        
        for ($i = 1; $i <= 6; $i++) {
            $xref[$i] = sprintf("%010d 00000 n \n", strlen($out));
            $out .= "{$i} 0 obj\n" . $objects[$i] . "\nendobj\n";
        }
        
        $xrefStart = strlen($out);
        $out .= "xref\n0 7\n";
        for ($i = 0; $i <= 6; $i++) {
            $out .= $xref[$i];
        }
        $out .= "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n{$xrefStart}\n%%EOF";
        
        @mkdir(dirname($filePath), 0755, true);
        @file_put_contents($filePath, $out);
        return file_exists($filePath) && filesize($filePath) > 100;
    }
}
