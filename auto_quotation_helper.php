<?php
/**
 * ERP AB Malaya - Auto Quotation Generation Helper
 * File: public/auto_quotation_helper.php
 *
 * Standalone, pure PHP helper to automatically convert incoming RFQs into SPH Quotations
 * with status 'in_progress' without depending on missing CLI/daemon paths.
 */

if (!function_exists('autoGenerateQuotation')) {
    function autoGenerateQuotation($db_conn, $rfq_row, $items = [], $item_requested = '') {
        if (!isset($db_conn) || !$db_conn || !is_array($rfq_row)) {
            return false;
        }

        $rfq_id = (int)$rfq_row['id'];
        $rfq_num = $rfq_row['rfq_number'] ?? ('RFQ-' . $rfq_id);

        // 1. Check if quotation already exists for this RFQ
        $check = $db_conn->prepare("SELECT id, quotation_number, status FROM quotations WHERE rfq_id = ? LIMIT 1");
        if ($check) {
            $check->bind_param("i", $rfq_id);
            $check->execute();
            $check_res = $check->get_result();
            if ($check_res && $check_res->num_rows > 0) {
                $existing = $check_res->fetch_assoc();
                $check->close();
                // Ensure RFQ status in rfq_requests is synced to in_progress
                $db_conn->query("UPDATE rfq_requests SET status = 'in_progress', ai_verified = 1 WHERE id = {$rfq_id}");
                return $existing['id'];
            }
            $check->close();
        }

        // 2. Generate unique IDs and numbers
        $quo_id = 'QUO-' . time() . '-' . rand(100, 999);
        $quo_num = 'QUO-ABM/MY/' . date('Y') . '/' . sprintf('%04d', rand(100, 9999));

        $client_email = !empty($rfq_row['client_email']) ? $rfq_row['client_email'] : 'abmalayaindustry@gmail.com';
        $client_name = !empty($rfq_row['client_name']) ? $rfq_row['client_name'] : ucwords(str_replace(['.', '_', '-'], ' ', explode('@', $client_email)[0]));
        $company_name = !empty($rfq_row['client_company']) ? $rfq_row['client_company'] : $client_name;

        $date_issued = date('Y-m-d');
        $valid_until = date('Y-m-d', strtotime('+14 days'));
        $notes = !empty($item_requested) ? $item_requested : (!empty($rfq_row['item_requested']) ? $rfq_row['item_requested'] : ($rfq_row['subject'] ?? 'Industrial Spare Parts Requisition'));
        $created_by = 'System Automation Pure PHP';
        $tax_percent = 11.00;
        $subtotal = 0.00;
        $items_created = 0;

        // 3. Insert parent quotation draft with status 'in_progress'
        $stmt_quo = $db_conn->prepare("INSERT INTO quotations (id, rfq_id, quotation_number, client_name, client_email, company_name, date_issued, valid_until, subtotal, discount_total, tax_percent, tax_amount, grand_total, notes, status, ocr_scan_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, 0.00, 0.00, ?, 'in_progress', 'pending', ?)");
        if ($stmt_quo) {
            $stmt_quo->bind_param("sissssssdss", $quo_id, $rfq_id, $quo_num, $client_name, $client_email, $company_name, $date_issued, $valid_until, $tax_percent, $notes, $created_by);
            if (!$stmt_quo->execute()) {
                error_log("Failed to insert auto-quotation: " . $stmt_quo->error);
                $stmt_quo->close();
                return false;
            }
            $stmt_quo->close();
        } else {
            error_log("Failed to prepare auto-quotation: " . $db_conn->error);
            return false;
        }

        // 4. Insert quotation items
        if (!empty($items) && is_array($items)) {
            foreach ($items as $item) {
                $desc = isset($item['description']) ? trim($item['description']) : '';
                if (empty($desc)) continue;
                $qty = isset($item['quantity']) ? (float)$item['quantity'] : 1.00;
                $unit = isset($item['unit']) ? trim($item['unit']) : 'Unit';
                $unit_price = isset($item['unit_price']) ? (float)$item['unit_price'] : 0.00;

                if ($unit_price <= 0.00) {
                    $search_term = '%' . $desc . '%';
                    $stmt_prod = $db_conn->prepare("SELECT unit_price FROM products WHERE product_name LIKE ? OR description LIKE ? LIMIT 1");
                    if ($stmt_prod) {
                        $stmt_prod->bind_param("ss", $search_term, $search_term);
                        $stmt_prod->execute();
                        $res_prod = $stmt_prod->get_result();
                        if ($res_prod && $res_prod->num_rows > 0) {
                            $prod_row = $res_prod->fetch_assoc();
                            $unit_price = (float)$prod_row['unit_price'];
                        }
                        $stmt_prod->close();
                    }
                }

                $total_item = $qty * $unit_price;
                $subtotal += $total_item;

                $stmt_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, 0.00, ?)");
                if ($stmt_item) {
                    $stmt_item->bind_param("ssdsdd", $quo_id, $desc, $qty, $unit, $unit_price, $total_item);
                    $stmt_item->execute();
                    $stmt_item->close();
                    $items_created++;
                }
            }
        }

        if ($items_created === 0) {
            $desc = !empty($notes) ? $notes : 'Industrial Equipment Specification';
            $qty = 1.00;
            $unit = 'Package';
            $unit_price = 0.00;
            $total_item = 0.00;

            $stmt_item = $db_conn->prepare("INSERT INTO quotation_items (quotation_id, description, quantity, unit, unit_price, discount_percent, total) VALUES (?, ?, ?, ?, ?, 0.00, ?)");
            if ($stmt_item) {
                $stmt_item->bind_param("ssdsdd", $quo_id, $desc, $qty, $unit, $unit_price, $total_item);
                $stmt_item->execute();
                $stmt_item->close();
            }
        }

        // 5. Update subtotal & grand total
        $tax_amount = round($subtotal * ($tax_percent / 100), 2);
        $grand_total = $subtotal + $tax_amount;

        $stmt_upd = $db_conn->prepare("UPDATE quotations SET subtotal = ?, tax_amount = ?, grand_total = ? WHERE id = ?");
        if ($stmt_upd) {
            $stmt_upd->bind_param("ddds", $subtotal, $tax_amount, $grand_total, $quo_id);
            $stmt_upd->execute();
            $stmt_upd->close();
        }

        // 6. ⚡ Explicitly synchronize status in rfq_requests to 'in_progress' and ai_verified = 1
        $db_conn->query("UPDATE rfq_requests SET status = 'in_progress', ai_verified = 1 WHERE id = {$rfq_id}");

        // 7. Generate synchronized quotation PDF file into uploads/pdf/
        $pdf_helper = __DIR__ . '/public/pdf_generator_helper.php';
        if (file_exists($pdf_helper)) {
            require_once $pdf_helper;
            $safe_qname = preg_replace('/[^A-Za-z0-9_\-]/', '_', $quo_num) . '.pdf';
            $target_pdf_path = __DIR__ . '/uploads/pdf/' . $safe_qname;
            if (function_exists('createQuotationPdfFile')) {
                createQuotationPdfFile($target_pdf_path, [
                    'id' => $quo_id,
                    'quotation_number' => $quo_num,
                    'client_name' => $client_name,
                    'client_email' => $client_email,
                    'company_name' => $company_name,
                    'subtotal' => $subtotal,
                    'tax_amount' => $tax_amount,
                    'grand_total' => $grand_total,
                    'date_issued' => $date_issued,
                    'valid_until' => $valid_until,
                ], $db_conn);
                $db_conn->query("UPDATE quotations SET quotation_file = '/uploads/pdf/{$safe_qname}', pdf_created = 1, pdf_created_at = NOW() WHERE id = '{$quo_id}'");
            }
        }

        // 8. System notification
        if (function_exists('addSystemNotification')) {
            addSystemNotification($db_conn, "New Quotation Draft #{$quo_num}", "Auto-generated quotation draft for {$company_name} ({$client_email}).", 'info', 'quotation', 'quotations_list');
        }

        // 9. History log
        if (function_exists('appendQuotationHistoryLog')) {
            appendQuotationHistoryLog($db_conn, $quo_id, 'Create Quotation (AI)', 'System Automation', null, "Draft Quotation otomatis dibuat dari RFQ {$rfq_num} (Grand Total: RM {$grand_total}).");
        }

        return $quo_id;
    }
}
