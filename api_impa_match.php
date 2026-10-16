<?php
/**
 * ABM Malaya ERP — IMPA Category Matcher
 * public/api_impa_match.php
 *
 * SEPARATE from OCR scan. Run after scan is done.
 * Takes quo_id → reads category_name from quotations table
 * → fuzzy-matches to IMPA maritime standard → updates DB.
 */

error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean(); echo json_encode(['status' => 'ok']); exit;
}

// ── IMPA Maritime Standard Code Map (internationally fixed) ──────────────────
const IMPA_MAP = [
    '00' => ['GENERAL STORES / MISCELLANEOUS',       ['general', 'misc', 'miscellaneous', 'sundry', 'store']],
    '11' => ['DECK STORES & CONSUMABLES',            ['deck', 'deck store', 'deck consumable', 'mooring', 'rope', 'paint']],
    '13' => ['ELECTRICAL & ELECTRONIC EQUIPMENT',    ['electrical', 'electronic', 'cable', 'battery', 'lamp', 'fuse']],
    '15' => ['SAFETY & FIRE EQUIPMENT',              ['safety', 'fire', 'lifesaving', 'lifeboat', 'raft', 'extinguisher']],
    '25' => ['GALLEY & PROVISION STORES',            ['galley', 'provision', 'food', 'kitchen', 'catering', 'mess', 'cook']],
    '30' => ['MEDICAL & SURGICAL SUPPLIES',          ['medical', 'surgical', 'pharmacy', 'first aid', 'drug', 'bandage']],
    '39' => ['MEDICINE CHEST',                       ['medicine', 'medicine chest', 'ubatan']],
    '45' => ['PETROLEUM PRODUCTS & LUBRICANTS',      ['petroleum', 'oil', 'lubricant', 'grease', 'fuel', 'hydraulic', 'lube', 'chemical', 'solvent']],
    '47' => ['PAINT & VARNISH',                      ['paint', 'varnish', 'coating', 'primer', 'anti-fouling', 'antifouling']],
    '49' => ["HARDWARE, TOOLS & STATIONERY",         ['hardware', 'tool', 'stationary', 'stationery', 'office', 'pen', 'pencil', 'paper', 'bolt', 'nut']],
    '51' => ['SAFETY CLOTHING & PPE',                ['clothing', 'personal protection', 'ppe', 'uniform', 'glove', 'helmet', 'boot', 'coverall']],
    '53' => ['DECK MACHINERY & EQUIPMENT',           ['machinery', 'winch', 'crane', 'anchor', 'windlass', 'capstan', 'steering']],
    '57' => ['NAVIGATION & COMMUNICATION',           ['navigation', 'communication', 'gps', 'radar', 'compass', 'chart', 'radio']],
    '60' => ['ENGINE ROOM CONSUMABLES',              ['engine room', 'consumable', 'filter', 'gasket', 'seal', 'fitting']],
    '63' => ['ENGINE SPARE PARTS',                   ['engine', 'spare part', 'pump', 'valve', 'piston', 'cylinder', 'bearing']],
    '73' => ['BOILER & HEAT EXCHANGER',              ['boiler', 'heat exchanger', 'auxiliary', 'heater', 'evaporator', 'condenser']],
    '75' => ['REFRIGERATION & AIR CONDITIONING',     ['refrigeration', 'air conditioning', 'compressor', 'cooling', 'hvac']],
    '80' => ['ELECTRICAL SPARE PARTS',               ['electrical spare', 'motor', 'generator', 'alternator', 'transformer']],
];

function matchImpaCode(string $raw): array {
    $raw_lower  = strtolower(trim($raw));
    $best_code  = null;
    $best_name  = null;
    $best_score = 0;
    foreach (IMPA_MAP as $code => [$canonical, $keywords]) {
        $score = 0;
        foreach ($keywords as $kw) {
            if (strpos($raw_lower, strtolower($kw)) !== false) {
                $score += strlen($kw);
            }
        }
        if ($score > $best_score) {
            $best_score = $score; $best_code = $code; $best_name = $canonical;
        }
    }
    return [
        'code'       => $best_code,
        'name'       => $best_name,
        'confidence' => $best_score > 0 ? min(100, 50 + $best_score * 2) : 0,
        'raw_input'  => $raw,
    ];
}

try {
    require_once __DIR__ . '/db_connect.php';

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $quo_id = trim($_GET['quo_id'] ?? '');
        if (empty($quo_id)) { ob_end_clean(); echo json_encode(['status'=>'error','message'=>'quo_id required']); exit; }
        $s = $db_conn->prepare("SELECT impa_code, category_name FROM quotations WHERE id = ? LIMIT 1");
        $s->bind_param('s', $quo_id); $s->execute();
        $row = $s->get_result()->fetch_assoc(); $s->close();
        ob_end_clean();
        echo json_encode(['status'=>'success','impa_code'=>$row['impa_code']??null,'category_name'=>$row['category_name']??null]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input  = json_decode(file_get_contents('php://input'), true) ?: [];
        $quo_id = trim($input['quo_id'] ?? '');
        if (empty($quo_id)) { ob_end_clean(); echo json_encode(['status'=>'error','message'=>'quo_id required']); exit; }

        $s = $db_conn->prepare("SELECT id, category_name, ocr_scan_result FROM quotations WHERE id = ? LIMIT 1");
        $s->bind_param('s', $quo_id); $s->execute();
        $quo = $s->get_result()->fetch_assoc(); $s->close();
        if (!$quo) { ob_end_clean(); echo json_encode(['status'=>'error','message'=>'Quotation not found']); exit; }

        // Determine category_name: quotations.category_name OR ocr_scan_result.category_name
        $cat_raw = $quo['category_name'] ?? null;
        if (empty($cat_raw) && !empty($quo['ocr_scan_result'])) {
            $ocr = json_decode($quo['ocr_scan_result'], true);
            $cat_raw = $ocr['category_name'] ?? null;
        }

        if (empty($cat_raw)) {
            ob_end_clean();
            echo json_encode(['status'=>'skipped','message'=>'No category_name to match. Run OCR scan first.']);
            exit;
        }

        $match = matchImpaCode($cat_raw);
        if ($match['code'] === null) {
            ob_end_clean();
            echo json_encode(['status'=>'no_match','message'=>'No IMPA match found.','raw_input'=>$cat_raw]);
            exit;
        }

        // Update quotations
        $upd = $db_conn->prepare("UPDATE quotations SET impa_code = ?, category_name = ? WHERE id = ?");
        $upd->bind_param('sss', $match['code'], $match['name'], $quo_id);
        $upd->execute(); $upd->close();

        // Update quotation_items (only rows without category_code yet)
        $upd2 = $db_conn->prepare("UPDATE quotation_items SET category_code = ? WHERE quotation_id = ? AND (category_code IS NULL OR category_code = '')");
        $upd2->bind_param('ss', $match['code'], $quo_id);
        $upd2->execute();
        $items_upd = $upd2->affected_rows; $upd2->close();

        ob_end_clean();
        echo json_encode([
            'status'        => 'success',
            'impa_code'     => $match['code'],
            'category_name' => $match['name'],
            'confidence'    => $match['confidence'],
            'raw_input'     => $match['raw_input'],
            'items_updated' => $items_upd,
        ]);
        exit;
    }

} catch (Exception $e) {
    ob_end_clean();
    echo json_encode(['status'=>'error','message'=>$e->getMessage()]);
}
