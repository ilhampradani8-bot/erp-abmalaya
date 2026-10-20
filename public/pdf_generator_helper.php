<?php
/**
 * AB Malaya ERP - Pure PHP PDF Generator Helper
 * Generates 100% valid PDF 1.4 documents natively in PHP without Puppeteer/Node.js dependencies.
 * Compatible with cPanel shared hosting, Linux daemons, and web endpoints.
 */

if (!function_exists('createQuotationPdfFile')) {
    function createQuotationPdfFile(string $filePath, $quo): bool {
        if (!is_array($quo)) {
            $quo = ['quotation_number' => (string)$quo];
        }
        $qNum = $quo['quotation_number'] ?? 'QUO-001';
        $cName = $quo['company_name'] ?? 'Client Company';
        $pName = $quo['client_name'] ?? 'Sir/Madam';
        $cEmail = $quo['client_email'] ?? '';
        $date = $quo['date_issued'] ?? date('Y-m-d');
        $total = number_format((float)($quo['grand_total'] ?? 0), 2);
        
        $items = [];
        if (!empty($quo['items'])) {
            $items = is_string($quo['items']) ? json_decode($quo['items'], true) : $quo['items'];
        }
        if (empty($items) && !empty($quo['items_details'])) {
            $items = is_string($quo['items_details']) ? json_decode($quo['items_details'], true) : $quo['items_details'];
        }
        if (empty($items) || !is_array($items)) {
            $items = [
                [
                    'description' => 'Commercial Product / Service Proposal as per RFQ',
                    'quantity' => 1,
                    'unit_price' => (float)($quo['grand_total'] ?? 0),
                    'total' => (float)($quo['grand_total'] ?? 0)
                ]
            ];
        }

        $stream = "BT\n";
        $stream .= "/F2 16 Tf\n 50 785 Td\n (AB MALAYA INDUSTRY) Tj\n";
        $stream .= "/F1 9 Tf\n 0 -14 Td\n (Commercial Quotation & Engineering Solutions Provider) Tj\n";
        $stream .= "0 -12 Td\n (Email: sales@abmalaya.com | Web: https://abmalaya.com) Tj\n";
        $stream .= "ET\n";
        $stream .= "0.5 w\n 50 745 m 545 745 l S\n";
        $stream .= "BT\n";
        $stream .= "/F2 13 Tf\n 50 720 Td\n (OFFICIAL COMMERCIAL QUOTATION (SPH)) Tj\n";
        $stream .= "/F2 9 Tf\n 0 -18 Td\n (Quotation No : ) Tj\n /F1 9 Tf\n (" . addcslashes($qNum, "()\\") . ") Tj\n";
        $stream .= "/F2 9 Tf\n 0 -14 Td\n (Date Issued  : ) Tj\n /F1 9 Tf\n (" . addcslashes($date, "()\\") . ") Tj\n";
        $stream .= "/F2 9 Tf\n 0 -14 Td\n (Client Name  : ) Tj\n /F1 9 Tf\n (" . addcslashes($cName . ($pName ? " - Attn: " . $pName : ""), "()\\") . ") Tj\n";
        if ($cEmail) {
            $stream .= "/F2 9 Tf\n 0 -14 Td\n (Client Email : ) Tj\n /F1 9 Tf\n (" . addcslashes($cEmail, "()\\") . ") Tj\n";
        }
        $stream .= "ET\n";
        $stream .= "0.9 0.92 0.95 rg\n 50 625 495 18 re f\n";
        $stream .= "0 g\n";
        $stream .= "BT\n";
        $stream .= "/F2 8 Tf\n 55 630 Td\n (NO) Tj\n 25 0 Td\n (DESCRIPTION) Tj\n 260 0 Td\n (QTY) Tj\n 55 0 Td\n (UNIT PRICE (MYR)) Tj\n 85 0 Td\n (TOTAL (MYR)) Tj\n";
        $stream .= "ET\n";
        
        $y = 608;
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
        $stream .= "/F2 8 Tf\n 50 110 Td\n (Terms & Conditions:) Tj\n";
        $stream .= "/F1 8 Tf\n 0 -11 Td\n (1. Prices quoted in Malaysian Ringgit (MYR). Payment terms as per agreement.) Tj\n";
        $stream .= "0 -10 Td\n (2. This is an electronically issued quotation verified by AB Malaya Industry ERP.) Tj\n";
        $stream .= "/F2 8 Tf\n 380 90 Td\n (Authorized Signature:) Tj\n";
        $stream .= "/F1 8 Tf\n 0 -24 Td\n (AB MALAYA SALES & COMMERCIAL TEAM) Tj\n";
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

if (!function_exists('createInvoicePdfFile')) {
    function createInvoicePdfFile(string $filePath, $inv): bool {
        if (!is_array($inv)) {
            $inv = ['invoice_number' => (string)$inv];
        }
        $invNum = $inv['invoice_number'] ?? 'INV-001';
        $cName = $inv['company_name'] ?? 'Client Company';
        $pName = $inv['client_name'] ?? 'Sir/Madam';
        $cEmail = $inv['client_email'] ?? '';
        $date = $inv['invoice_date'] ?? date('Y-m-d');
        $dueDate = $inv['due_date'] ?? date('Y-m-d', strtotime('+14 days'));
        $total = number_format((float)($inv['grand_total'] ?? 0), 2);
        $subtotal = number_format((float)($inv['subtotal'] ?? $inv['grand_total'] ?? 0), 2);
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
