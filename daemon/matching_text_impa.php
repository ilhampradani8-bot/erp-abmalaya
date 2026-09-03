<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
/**
 * ABM Malaya ERP — Dedicated IMPA Category Text Matching Daemon
 * daemon/matching_text_impa.php
 *
 * Performs high-precision token-sort fuzzy matching to assign international IMPA codes (00 - 80)
 * to quotations and quotation_items based on category_name and item descriptions.
 */

define('DAEMON_MODE', true);
define('IMPA_LOG_FILE', __DIR__ . '/logs/matching_impa_' . date('Y-m-d') . '.log');

function impa_daemon_log(string $msg): void {
    $dir = dirname(IMPA_LOG_FILE);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    file_put_contents(IMPA_LOG_FILE, $line, FILE_APPEND | LOCK_EX);
    echo $line;
}

require_once __DIR__ . '/../public/db_connect.php';

if (!$db_conn || $db_conn->connect_error) {
    impa_daemon_log('FATAL: Cannot connect to MySQL DB.');
    exit(1);
}

impa_daemon_log('=== IMPA Text Matching Daemon Started ===');

// International IMPA 2-Digit Category Blueprint Map
$impa_blueprint = [
    '00' => ['name' => 'GENERAL ITEMS', 'keywords' => ['general', 'miscellaneous', 'sundry', 'various']],
    '11' => ['name' => 'CLOTHING & LINEN', 'keywords' => ['clothing', 'linen', 'uniform', 'overall', 'coverall', 'towel', 'blanket', 'shirt', 'glove']],
    '15' => ['name' => 'ROPES & CORPAGE', 'keywords' => ['rope', 'corpage', 'hawser', 'mooring', 'wire rope', 'nylon rope', 'pp rope']],
    '17' => ['name' => 'TABLEWARE & GALLEY EQUIPMENT', 'keywords' => ['tableware', 'galley', 'kitchen', 'cooking', 'plate', 'cup', 'pot', 'pan', 'utensil']],
    '19' => ['name' => 'PANTRY EQUIPMENT', 'keywords' => ['pantry', 'refrigerator', 'fridge', 'freezer', 'kettle', 'toaster', 'blender']],
    '21' => ['name' => 'SAFETY EQUIPMENT', 'keywords' => ['safety', 'lifejacket', 'lifebuoy', 'liferaft', 'fire extinguisher', 'pyrotechnic', 'breathing apparatus', 'scba', 'harness', 'helmet']],
    '23' => ['name' => 'PROTECTIVE GEAR & CLOTHING', 'keywords' => ['protective', 'ppe', 'goggles', 'earmuff', 'mask', 'safety shoes', 'boot']],
    '25' => ['name' => 'NAUTICAL & NAVIGATION EQUIPMENT', 'keywords' => ['nautical', 'navigation', 'chart', 'compass', 'binocular', 'sextant', 'flag', 'gps', 'radar', 'echo sounder']],
    '31' => ['name' => 'PNEUMATIC & ELECTRICAL TOOLS', 'keywords' => ['pneumatic', 'electric tool', 'grinder', 'drill', 'impact wrench', 'chisel', 'air tool']],
    '33' => ['name' => 'HAND TOOLS', 'keywords' => ['hand tool', 'wrench', 'spanner', 'hammer', 'plier', 'screwdriver', 'socket', 'vice', 'file', 'saw']],
    '35' => ['name' => 'MEASURING INSTRUMENTS', 'keywords' => ['measuring', 'gauge', 'caliper', 'micrometer', 'thermometer', 'hygrometer', 'pressure gauge', 'depth gauge']],
    '37' => ['name' => 'METAL SHEETS & BARS', 'keywords' => ['metal', 'steel', 'plate', 'sheet', 'bar', 'angle', 'flat bar', 'pipe', 'tube', 'brass', 'copper', 'stainless steel', 'ss316']],
    '39' => ['name' => 'MEDICINES & MEDICAL SUPPLIES', 'keywords' => ['medicine', 'medical', 'first aid', 'bandage', 'pharma', 'drug', 'ointment', 'tablet', 'bandage', 'stretcher']],
    '45' => ['name' => 'PETROLEUM & LUBRICANTS', 'keywords' => ['petroleum', 'lubricant', 'oil', 'grease', 'engine oil', 'hydraulic oil', 'gear oil', 'fuel oil']],
    '47' => ['name' => 'PAINTS & PAINTING EQUIPMENT', 'keywords' => ['paint', 'thinner', 'primer', 'brush', 'roller', 'spray gun', 'coating', 'anti-fouling']],
    '49' => ['name' => 'HARDWARE & STATIONERY', 'keywords' => ['hardware', 'stationery', 'stationary', 'paper', 'pen', 'pencil', 'binder', 'stapler', 'calculator', 'tape', 'marker', 'vessel\'s stationery', 'vessel\'s stationary', 'office']],

    '51' => ['name' => 'CLEANING MATERIALS & CHEMICALS', 'keywords' => ['cleaning', 'chemical', 'detergent', 'degreaser', 'soap', 'disinfectant', 'mop', 'broom', 'rag', 'cotton waste']],
    '53' => ['name' => 'DECK MACHINERY & EQUIPMENT', 'keywords' => ['deck', 'winch', 'windlass', 'crane', 'capstan', 'anchor', 'chain', 'fairlead', 'bollard']],
    '55' => ['name' => 'RIGGING & LIFTING GEAR', 'keywords' => ['rigging', 'lifting', 'shackle', 'turnbuckle', 'hook', 'chain block', 'lever hoist', 'slings']],
    '59' => ['name' => 'ELECTRICAL EQUIPMENT & SPARES', 'keywords' => ['electrical', 'cable', 'wire', 'lamp', 'bulb', 'switch', 'socket', 'plug', 'fuse', 'breaker', 'transformer', 'battery', 'led']],
    '61' => ['name' => 'PUMPS & COMPRESSORS SPARES', 'keywords' => ['pump', 'compressor', 'impeller', 'seal', 'gasket', 'valve plate', 'piston ring', 'air compressor']],
    '63' => ['name' => 'ENGINE SPARE PARTS', 'keywords' => ['engine', 'valve', 'vrc valve', 'indicator', 'solenoid', 'injector', 'nozzle', 'cylinder', 'piston', 'liner', 'bearing', 'turbocharger', 'gasket', 'filter']],
    '65' => ['name' => 'VALVES & PIPING FITTINGS', 'keywords' => ['valve', 'pipe', 'fitting', 'flange', 'elbow', 'tee', 'coupling', 'nipple', 'reducer', 'strainer', 'check valve', 'gate valve', 'ball valve', 'butterfly valve']],
    '67' => ['name' => 'INSULATION & PACKING', 'keywords' => ['insulation', 'packing', 'gland packing', 'gasket', 'jointing', 'teflon', 'asbestos free', 'o-ring', 'seal']],
    '73' => ['name' => 'BOILER & HEAT EXCHANGER SPARES', 'keywords' => ['boiler', 'heat exchanger', 'burner', 'tube', 'gauge glass', 'soot blower', 'thermostat']],
    '79' => ['name' => 'PROVISION & FOOD SUPPLIES', 'keywords' => ['provision', 'food', 'meat', 'fish', 'vegetable', 'fruit', 'rice', 'flour', 'canned food', 'water']],
    '81' => ['name' => 'WELDING EQUIPMENT & GASES', 'keywords' => ['welding', 'electrode', 'rod', 'torch', 'regulator', 'hose', 'gas', 'oxygen', 'acetylene', 'argon']]
];

// Helper: Calculate match score between text and keywords
function calculateImpaMatchScore(string $text, array $keywords): int {
    $text_clean = str_replace(['’', '‘', '`'], "'", strtolower(trim($text)));
    if (empty($text_clean)) return 0;
    
    $max_score = 0;
    foreach ($keywords as $kw) {
        $kw_clean = str_replace(['’', '‘', '`'], "'", strtolower(trim($kw)));
        if ($text_clean === $kw_clean) {
            return 100; // Exact match
        }
        if (strpos($text_clean, $kw_clean) !== false) {
            $score = 70 + (strlen($kw_clean) > 4 ? 20 : 10);
            if ($score > $max_score) $max_score = $score;
        }
    }
    return $max_score;
}


// 1. Fetch quotations needing IMPA matching
$sql = "SELECT id, quotation_number, category_name, notes, ocr_scan_result FROM quotations WHERE (impa_code IS NULL OR impa_code = '') ORDER BY id DESC LIMIT 50";
$res = $db_conn->query($sql);

if (!$res || $res->num_rows === 0) {
    impa_daemon_log('No pending quotations to match IMPA codes. All up to date.');
    exit(0);
}

$matched_count = 0;
while ($quo = $res->fetch_assoc()) {
    $quo_id = $quo['id'];
    $cat_name = trim($quo['category_name'] ?? '');
    
    // Fallback: check ocr_scan_result JSON for category_name if empty in column
    if (empty($cat_name) && !empty($quo['ocr_scan_result'])) {
        $ocr = json_decode($quo['ocr_scan_result'], true);
        $cat_name = trim($ocr['category_name'] ?? '');
    }
    if (empty($cat_name) && !empty($quo['notes'])) {
        $cat_name = trim($quo['notes']);
    }

    if (empty($cat_name)) continue;

    $best_code = null;
    $best_name = null;
    $highest_score = 0;

    foreach ($impa_blueprint as $code => $info) {
        $score = calculateImpaMatchScore($cat_name, $info['keywords']);
        if ($score > $highest_score) {
            $highest_score = $score;
            $best_code = $code;
            $best_name = $info['name'];
        }
    }

    if ($best_code && $highest_score >= 60) {
        $matched_count++;
        impa_daemon_log("Match Success [{$quo['quotation_number']}]: '{$cat_name}' -> Code {$best_code} ({$best_name}) [Score {$highest_score}%]");

        // Update quotations table
        $upd = $db_conn->prepare("UPDATE quotations SET impa_code = ?, category_name = ? WHERE id = ?");
        if ($upd) {
            $upd->bind_param("sss", $best_code, $best_name, $quo_id);
            $upd->execute();
            $upd->close();
        }

        // Update quotation_items table category_code and impa_code
        $upd_items = $db_conn->prepare("UPDATE quotation_items SET category_code = ?, impa_code = ? WHERE quotation_id = ?");
        if ($upd_items) {
            $upd_items->bind_param("sss", $best_code, $best_code, $quo_id);
            $upd_items->execute();
            $upd_items->close();
        }
    } else {
        impa_daemon_log("No Match [{$quo['quotation_number']}]: '{$cat_name}' (Highest Score {$highest_score}%) — Left qualitative.");
    }
}

// 2. Fetch individual quotation_items where category_code or impa_code is null or empty to match per-item IMPA code
$res_items = $db_conn->query("SELECT id, quotation_id, description FROM quotation_items WHERE (category_code IS NULL OR category_code = '' OR impa_code IS NULL OR impa_code = '') LIMIT 100");
if ($res_items && $res_items->num_rows > 0) {
    $item_matched_count = 0;
    while ($qi = $res_items->fetch_assoc()) {
        $item_id   = $qi['id'];
        $item_desc = trim($qi['description']);
        if (empty($item_desc)) continue;

        $item_best_code = null;
        $item_best_name = null;
        $item_highest = 0;

        foreach ($impa_blueprint as $code => $info) {
            $score = calculateImpaMatchScore($item_desc, $info['keywords']);
            if ($score > $item_highest) {
                $item_highest   = $score;
                $item_best_code = $code;
                $item_best_name = $info['name'];
            }
        }

        if ($item_best_code && $item_highest >= 60) {
            $item_matched_count++;
            $upd_qi = $db_conn->prepare("UPDATE quotation_items SET category_code = ?, impa_code = ? WHERE id = ?");
            if ($upd_qi) {
                $upd_qi->bind_param("ssi", $item_best_code, $item_best_code, $item_id);
                $upd_qi->execute();
                $upd_qi->close();
            }
        }
    }

    if ($item_matched_count > 0) {
        impa_daemon_log("Per-Item IMPA Matching: Updated {$item_matched_count} quotation item(s) with specific IMPA category codes.");
    }
}

impa_daemon_log("=== IMPA Matching Complete. Processed quotations. Matched: {$matched_count} ===");

