<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
/**
 * ABM Malaya ERP — Dedicated Product Text Matching Daemon
 * daemon/matching_text_product.php
 *
 * Performs fuzzy token-sort matching between RFQ quotation_items.description and 
 * existing items in the MySQL `products` table (product_name, product_code, description).
 *
 * Attaches existing product_code and unit_price to quotation_items WITHOUT creating
 * duplicate product entries in the database.
 */

define('DAEMON_MODE', true);
define('PROD_LOG_FILE', __DIR__ . '/logs/matching_product_' . date('Y-m-d') . '.log');

function prod_daemon_log(string $msg): void {
    $dir = dirname(PROD_LOG_FILE);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(PROD_LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

require_once __DIR__ . '/../public/db_connect.php';

if (!$db_conn || $db_conn->connect_error) {
    prod_daemon_log('FATAL: Cannot connect to MySQL DB.');
    exit(1);
}

prod_daemon_log('=== Product Text Matching Daemon Started ===');

// Ensure quotation_items table has offer column
$chk_off_col = $db_conn->query("SHOW COLUMNS FROM quotation_items LIKE 'offer'");
if ($chk_off_col && $chk_off_col->num_rows === 0) {
    $db_conn->query("ALTER TABLE quotation_items ADD COLUMN offer TEXT DEFAULT NULL AFTER specification");
}

// Load all existing products into memory for fast fuzzy matching
$products_catalog = [];
$res_p = $db_conn->query("SELECT id, product_code, impa_code, product_name, description, offer, offered_item, specification, unit, unit_price, category FROM products WHERE (product_name IS NOT NULL AND product_name != '') OR (offer IS NOT NULL AND offer != '') OR (offered_item IS NOT NULL AND offered_item != '')");
if ($res_p && $res_p->num_rows > 0) {
    while ($p = $res_p->fetch_assoc()) {
        $offer_val = !empty($p['offer']) ? $p['offer'] : (!empty($p['offered_item']) ? $p['offered_item'] : '');
        $combined_text = trim(($p['product_name'] ?? '') . ' ' . ($p['impa_code'] ?? '') . ' ' . $offer_val . ' ' . ($p['specification'] ?? $p['description'] ?? ''));
        $products_catalog[] = [
            'product_code' => $p['product_code'],
            'impa_code'    => $p['impa_code'] ?? '',
            'product_name' => $p['product_name'],
            'offer'        => $offer_val,
            'description'  => $p['description'] ?? '',
            'specification'=> $p['specification'] ?? '',
            'unit_price'   => (float)($p['unit_price'] ?? 0.00),
            'unit'         => $p['unit'] ?? 'Pcs',
            'tokens'       => array_filter(explode(' ', strtolower(preg_replace('/[^a-zA-Z0-9\s]/', ' ', $combined_text))))
        ];
    }
}

if (empty($products_catalog)) {
    prod_daemon_log('No products found in products catalog. Exiting.');
    exit(0);
}

prod_daemon_log('Loaded ' . count($products_catalog) . ' product(s) (with offer alternatives & IMPA codes) from MySQL catalog.');

// Helper: Calculate Token Overlap & Exact Match Score (0 - 100)
function calculateProductMatchScore(string $rfq_desc, array $prod): int {
    $desc_clean = strtolower(preg_replace('/[^a-zA-Z0-9\s]/', ' ', $rfq_desc));
    
    // 1. FAST-PATH: Exact IMPA 6-digit code match in text
    if (!empty($prod['impa_code']) && strlen(trim($prod['impa_code'])) >= 4) {
        $impa_clean = strtolower(trim($prod['impa_code']));
        if (preg_match('/\b' . preg_quote($impa_clean, '/') . '\b/i', $desc_clean)) {
            return 100; // Instant 100% match on exact IMPA code
        }
    }

    // 2. FAST-PATH: Exact SKU product_code match in text
    if (!empty($prod['product_code'])) {
        $pcode_clean = strtolower(trim($prod['product_code']));
        if (!empty($pcode_clean) && preg_match('/\b' . preg_quote($pcode_clean, '/') . '\b/i', $desc_clean)) {
            return 100; // Instant 100% match on exact product SKU
        }
    }

    // 3. FUZZY TOKEN OVERLAP MATCHING
    $prod_tokens = $prod['tokens'] ?? [];
    $rfq_tokens  = array_filter(explode(' ', $desc_clean));
    
    if (empty($rfq_tokens) || empty($prod_tokens)) return 0;

    $matched = 0;
    foreach ($rfq_tokens as $t) {
        if (strlen($t) < 2) continue; // Skip single letters
        if (in_array($t, $prod_tokens)) {
            $matched++;
        }
    }

    $score = (int)(($matched / max(count($rfq_tokens), 1)) * 100);
    return min($score, 100);
}

// Fetch quotation_items needing product matching (where product_code is null or unit_price = 0)
$sql = "SELECT id, quotation_id, description, specification, offer, quantity, unit_price FROM quotation_items WHERE (product_code IS NULL OR product_code = '' OR unit_price = 0.00) LIMIT 100";
$res_qi = $db_conn->query($sql);

if (!$res_qi || $res_qi->num_rows === 0) {
    prod_daemon_log('No quotation_items needing product matching. All up to date.');
    exit(0);
}

$matched_items = 0;
while ($item = $res_qi->fetch_assoc()) {
    $item_id   = $item['id'];
    $rfq_desc  = trim($item['description'] . ' ' . ($item['specification'] ?? ''));
    $qty       = (float)$item['quantity'];

    if (empty($rfq_desc)) continue;

    $best_product = null;
    $highest_score = 0;

    foreach ($products_catalog as $prod) {
        $score = calculateProductMatchScore($rfq_desc, $prod);
        if ($score > $highest_score) {
            $highest_score = $score;
            $best_product  = $prod;
        }
    }

    // Require at least 65% match confidence
    if ($best_product && $highest_score >= 65) {
        $matched_items++;
        $p_code     = $best_product['product_code'];
        $p_impa     = $best_product['impa_code'];
        $u_price    = $best_product['unit_price'];
        $tot        = $qty * $u_price;
        $offer_text = !empty($best_product['offer']) ? $best_product['offer'] : $best_product['product_name'];

        prod_daemon_log("Match Success [Item ID {$item_id}]: '{$rfq_desc}' -> Product Code {$p_code} | IMPA {$p_impa} (RM {$u_price}) [Score {$highest_score}%] Offered Alternative: '{$offer_text}'");

        // Update quotation_items with product_code, impa_code, unit_price, total, offer and specification if empty
        $upd_qi = $db_conn->prepare("UPDATE quotation_items SET product_code = ?, impa_code = ?, unit_price = ?, total = ?, offer = ?, specification = IF(specification IS NULL OR specification = '', ?, specification) WHERE id = ?");
        if ($upd_qi) {
            $upd_qi->bind_param("sssddssi", $p_code, $p_impa, $u_price, $tot, $offer_text, $offer_text, $item_id);
            $upd_qi->execute();
            $upd_qi->close();
        }
    }
}

prod_daemon_log("=== Product Matching Complete. Matched & Updated Items: {$matched_items} ===");

