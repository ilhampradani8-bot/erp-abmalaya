<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';
$connection = isset($conn) ? $conn : $db_conn;

// Ensure received_by columns exist in clients table
$chkReceived = $connection->query("SHOW COLUMNS FROM clients LIKE 'received_by_name'");
if ($chkReceived && $chkReceived->num_rows === 0) {
    @$connection->query("ALTER TABLE clients ADD COLUMN received_by_name VARCHAR(255) DEFAULT NULL, ADD COLUMN received_by_designation VARCHAR(255) DEFAULT NULL");
}


// Helper to compute official company logo from domain / email
function computeCompanyLogoUrl($email) {
    if (empty($email)) return null;
    $parts = explode('@', $email);
    if (count($parts) >= 2) {
        $domain = strtolower(trim(end($parts)));
        if (!preg_match('/gmail\.com|yahoo\.|hotmail\.|outlook\.|icloud\.|mail\.ru/i', $domain)) {
            return "https://www.google.com/s2/favicons?domain={$domain}&sz=128";
        }
    }
    return "https://unavatar.io/" . urlencode(trim($email)) . "?fallback=false";
}

// Helper to find existing client by exact email, domain (for corporate emails), or exact company name
function findExistingClientRow($connection, $email, $companyName) {
    if (!empty($email) && strpos($email, '@') !== false) {
        $cleanEmail = strtolower(trim($email));
        // 1. Check exact email match in clients.email text
        $stmt = $connection->prepare("SELECT id, company_name, email FROM clients WHERE FIND_IN_SET(?, REPLACE(LOWER(email), ' ', '')) OR LOWER(email) LIKE ? LIMIT 1");
        if ($stmt) {
            $like = "%" . $cleanEmail . "%";
            $stmt->bind_param("ss", $cleanEmail, $like);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && $row = $res->fetch_assoc()) {
                $stmt->close();
                return $row;
            }
            $stmt->close();
        }

        // 2. Check corporate domain match if not a public email domain (gmail, yahoo, etc.)
        $parts = explode('@', $cleanEmail);
        $domain = strtolower(trim(end($parts)));
        if (!empty($domain) && !preg_match('/gmail\.com|yahoo\.|hotmail\.|outlook\.|icloud\.|live\.|ymail\.|aol\.|mail\.com|protonmail\.|zoho\./i', $domain)) {
            $stmtDom = $connection->prepare("SELECT id, company_name, email FROM clients WHERE LOWER(email) LIKE ? LIMIT 1");
            if ($stmtDom) {
                $likeDom = "%@" . $domain . "%";
                $stmtDom->bind_param("s", $likeDom);
                $stmtDom->execute();
                $resDom = $stmtDom->get_result();
                if ($resDom && $rowDom = $resDom->fetch_assoc()) {
                    $stmtDom->close();
                    return $rowDom;
                }
                $stmtDom->close();
            }
        }
    }

    // 3. Check exact company name match
    if (!empty($companyName)) {
        $cleanComp = strtolower(trim($companyName));
        $stmtComp = $connection->prepare("SELECT id, company_name, email FROM clients WHERE LOWER(TRIM(company_name)) = ? LIMIT 1");
        if ($stmtComp) {
            $stmtComp->bind_param("s", $cleanComp);
            $stmtComp->execute();
            $resComp = $stmtComp->get_result();
            if ($resComp && $rowComp = $resComp->fetch_assoc()) {
                $stmtComp->close();
                return $rowComp;
            }
            $stmtComp->close();
        }
    }

    return null;
}

// Helper to auto-sync AI-scanned RFQs and Quotations into clients database
function autoSyncClientsFromRfqsAndQuotations($connection) {
    // 0. Fetch INBOX_RULE_START_DATE setting
    $startDate = '2026-08-27';
    $sRes = @$connection->query("SELECT credential_value FROM api_credentials WHERE credential_key = 'INBOX_RULE_START_DATE' LIMIT 1");
    if ($sRes && $sRow = $sRes->fetch_assoc()) {
        if (!empty($sRow['credential_value'])) {
            $startDate = trim($sRow['credential_value']);
        }
    }

    // 1. Sync from rfq_requests (STRICTLY ai_classification = 'quotation', EXCLUDE 'iklan' and 'waiting', AND DATE >= INBOX_RULE_START_DATE)
    $resRfq = @$connection->query("SELECT r.client_company AS company, r.client_name AS sender_name, r.client_email AS sender_email, r.client_phone AS phone FROM rfq_requests r LEFT JOIN quotations q ON q.rfq_id = r.id WHERE (r.ai_classification = 'client_rfq' OR (COALESCE(q.status, 'masuk') IN ('masuk', 'diproses', 'in_progress', 'penawaran_terkirim', 'deal') AND r.ai_classification != 'junk' AND r.ai_classification != 'other')) AND DATE(r.created_at) >= '$startDate'");
    if ($resRfq) {
        while ($row = $resRfq->fetch_assoc()) {
            $comp = trim($row['company'] ?? '');
            $cName = trim($row['sender_name'] ?? '');
            $cEmail = trim($row['sender_email'] ?? '');
            $cPhone = trim($row['phone'] ?? '');
            if (empty($cEmail) && empty($comp)) continue;

            // Exclude no-reply, marketing, and promotional emails
            if (preg_match('/no-?reply|donotreply|newsletter|marketing|promotions|notifications@|bounce@|mailer-daemon|info@facebook|info@google/i', $cEmail)) {
                continue;
            }

            $existing = findExistingClientRow($connection, $cEmail, $comp);
            if ($existing) {
                // DO NOT overwrite existing company_name! Keep user's manually saved company_name intact!
                $existingEmails = array_map('trim', explode(',', $existing['email'] ?? ''));
                if (!empty($cEmail) && !in_array($cEmail, $existingEmails)) {
                    $existingEmails[] = $cEmail;
                    $newEmails = implode(', ', array_filter($existingEmails));
                    $up = $connection->prepare("UPDATE clients SET email = ? WHERE id = ?");
                    if ($up) {
                        $up->bind_param("si", $newEmails, $existing['id']);
                        $up->execute();
                        $up->close();
                    }
                }
            } else {
                $initialComp = !empty($comp) ? $comp : '';
                if (empty($initialComp) && !empty($cEmail)) {
                    $eParts = explode('@', $cEmail);
                    $dom = strtolower(end($eParts));
                    if (!preg_match('/gmail\.com|yahoo\.|hotmail\.|outlook\.|icloud\.|live\.|ymail\.|aol\.|mail\.com|protonmail\.|zoho\./i', $dom)) {
                        $dParts = explode('.', $dom);
                        $initialComp = strtoupper($dParts[0]);
                    } else {
                        $initialComp = strtoupper($eParts[0]);
                    }
                }
                if (empty($initialComp)) $initialComp = 'New Client';

                $ins = $connection->prepare("INSERT INTO clients (company_name, client_name, email, phone) VALUES (?, ?, ?, ?)");
                if ($ins) {
                    $ins->bind_param("ssss", $initialComp, $cName, $cEmail, $cPhone);
                    $ins->execute();
                    $ins->close();
                }
            }
        }
    }

    // 2. Sync from quotations (DATE >= INBOX_RULE_START_DATE)
    $resQuo = @$connection->query("SELECT company_name, client_name, client_email, client_phone FROM quotations WHERE (DATE(date_issued) >= '$startDate' OR DATE(created_at) >= '$startDate')");
    if ($resQuo) {
        while ($row = $resQuo->fetch_assoc()) {
            $comp = trim($row['company_name'] ?? '');
            $cName = trim($row['client_name'] ?? '');
            $cEmail = trim($row['client_email'] ?? '');
            $cPhone = trim($row['client_phone'] ?? '');
            if (empty($cEmail) && empty($comp)) continue;

            $existing = findExistingClientRow($connection, $cEmail, $comp);
            if ($existing) {
                // DO NOT overwrite existing company_name! Keep user's manually saved company_name intact!
                $existingEmails = array_map('trim', explode(',', $existing['email'] ?? ''));
                if (!empty($cEmail) && !in_array($cEmail, $existingEmails)) {
                    $existingEmails[] = $cEmail;
                    $newEmails = implode(', ', array_filter($existingEmails));
                    $up = $connection->prepare("UPDATE clients SET email = ? WHERE id = ?");
                    if ($up) {
                        $up->bind_param("si", $newEmails, $existing['id']);
                        $up->execute();
                        $up->close();
                    }
                }
            } else {
                $initialComp = !empty($comp) ? $comp : '';
                if (empty($initialComp) && !empty($cEmail)) {
                    $eParts = explode('@', $cEmail);
                    $dom = strtolower(end($eParts));
                    if (!preg_match('/gmail\.com|yahoo\.|hotmail\.|outlook\.|icloud\.|live\.|ymail\.|aol\.|mail\.com|protonmail\.|zoho\./i', $dom)) {
                        $dParts = explode('.', $dom);
                        $initialComp = strtoupper($dParts[0]);
                    } else {
                        $initialComp = strtoupper($eParts[0]);
                    }
                }
                if (empty($initialComp)) $initialComp = 'New Client';

                $ins = $connection->prepare("INSERT INTO clients (company_name, client_name, email, phone) VALUES (?, ?, ?, ?)");
                if ($ins) {
                    $ins->bind_param("ssss", $initialComp, $cName, $cEmail, $cPhone);
                    $ins->execute();
                    $ins->close();
                }
            }
        }
    }
}

try {
    $method = $_SERVER['REQUEST_METHOD'];

    // Handle Signatories API (GET)
    if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'signatories') {
        $comp = trim($_GET['company_name'] ?? '');
        $clientId = intval($_GET['client_id'] ?? 0);
        $signatories = [];

        if (!empty($comp) || $clientId > 0) {
            $stmt = $connection->prepare("SELECT * FROM client_signatories WHERE (client_id > 0 AND client_id = ?) OR (company_name != '' AND LOWER(TRIM(company_name)) = LOWER(TRIM(?))) ORDER BY is_default DESC, id ASC");
            if ($stmt) {
                $stmt->bind_param("is", $clientId, $comp);
                $stmt->execute();
                $res = $stmt->get_result();
                while ($row = $res->fetch_assoc()) {
                    $signatories[] = $row;
                }
                $stmt->close();
            }
        } else {
            $res = $connection->query("SELECT * FROM client_signatories ORDER BY company_name ASC, is_default DESC, id ASC");
            if ($res) {
                while ($row = $res->fetch_assoc()) {
                    $signatories[] = $row;
                }
            }
        }

        ob_end_clean();
        echo json_encode(['status' => 'success', 'data' => $signatories]);
        exit;
    }

    if ($method === 'GET') {
        if (isset($_GET['sync']) && $_GET['sync'] === 'true') {
            autoSyncClientsFromRfqsAndQuotations($connection);
        }

        $result = $connection->query("SELECT * FROM clients ORDER BY company_name ASC");
        $clients = [];
        if ($result) {
            while ($row = $result->fetch_assoc()) {
                // Fetch signatories for this client
                $cId = intval($row['id']);
                $cName = trim($row['company_name'] ?? '');
                $sigs = [];
                $sStmt = $connection->prepare("SELECT * FROM client_signatories WHERE client_id = ? OR LOWER(TRIM(company_name)) = LOWER(TRIM(?)) ORDER BY is_default DESC, id ASC");
                if ($sStmt) {
                    $sStmt->bind_param("is", $cId, $cName);
                    $sStmt->execute();
                    $sRes = $sStmt->get_result();
                    while ($sRow = $sRes->fetch_assoc()) {
                        $sigs[] = $sRow;
                    }
                    $sStmt->close();
                }
                $row['signatories'] = $sigs;
                $clients[] = $row;
            }
        }

        ob_end_clean();
        echo json_encode([
            'status' => 'success',
            'data' => $clients
        ]);
        exit;
    }

    if ($method === 'POST') {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (!$data) {
            $data = $_POST;
        }

        $action = isset($data['action']) ? $data['action'] : 'save';

        // 1. ADD / SAVE SIGNATORY ACTION
        if ($action === 'add_signatory' || $action === 'save_signatory') {

            $sigId = intval($data['id'] ?? 0);
            $clientId = intval($data['client_id'] ?? 0);
            $companyName = trim($data['company_name'] ?? '');
            $name = trim($data['name'] ?? '');
            $designation = trim($data['designation'] ?? '');
            $isDefault = !empty($data['is_default']) ? 1 : 0;

            if (empty($name)) {
                ob_end_clean();
                echo json_encode(['status' => 'error', 'message' => 'Signatory name is required']);
                exit;
            }

            if (empty($companyName) && $clientId > 0) {
                $cQuery = $connection->query("SELECT company_name FROM clients WHERE id = $clientId LIMIT 1");
                if ($cQuery && $cRow = $cQuery->fetch_assoc()) {
                    $companyName = trim($cRow['company_name'] ?? '');
                }
            }

            if ($sigId > 0) {
                $stmt = $connection->prepare("UPDATE client_signatories SET client_id=?, company_name=?, name=?, designation=?, is_default=? WHERE id=?");
                if (!$stmt) {
                    throw new Exception("Database prepare failed for signatory update: " . $connection->error);
                }
                $stmt->bind_param("isssii", $clientId, $companyName, $name, $designation, $isDefault, $sigId);
                $stmt->execute();
                $stmt->close();
            } else {
                $stmt = $connection->prepare("INSERT INTO client_signatories (client_id, company_name, name, designation, is_default) VALUES (?, ?, ?, ?, ?)");
                if (!$stmt) {
                    throw new Exception("Database prepare failed for signatory insert: " . $connection->error);
                }
                $stmt->bind_param("isssi", $clientId, $companyName, $name, $designation, $isDefault);
                $stmt->execute();
                $sigId = $stmt->insert_id;
                $stmt->close();
            }

            // Also update primary client received_by_name / designation if empty or marked default
            if (!empty($companyName) || $clientId > 0) {
                $stmtUp = $connection->prepare("UPDATE clients SET received_by_name=?, received_by_designation=? WHERE id=? OR LOWER(TRIM(company_name))=LOWER(TRIM(?))");
                if ($stmtUp) {
                    $stmtUp->bind_param("ssis", $name, $designation, $clientId, $companyName);
                    $stmtUp->execute();
                    $stmtUp->close();
                }
            }

            ob_end_clean();
            echo json_encode([
                'status' => 'success',
                'message' => 'Signatory saved successfully',
                'data' => [
                    'id' => $sigId,
                    'client_id' => $clientId,
                    'company_name' => $companyName,
                    'name' => $name,
                    'designation' => $designation,
                    'is_default' => $isDefault
                ]
            ]);
            exit;
        }

        // 2. DELETE SIGNATORY ACTION
        if ($action === 'delete_signatory') {
            $sigId = intval($data['id'] ?? 0);
            if ($sigId > 0) {
                $stmt = $connection->prepare("DELETE FROM client_signatories WHERE id = ?");
                if ($stmt) {
                    $stmt->bind_param("i", $sigId);
                    $stmt->execute();
                    $stmt->close();
                }
            }
            ob_end_clean();
            echo json_encode(['status' => 'success', 'message' => 'Signatory deleted successfully']);
            exit;
        }

        $id = isset($data['id']) ? intval($data['id']) : 0;
        $company_name = isset($data['company_name']) ? trim($data['company_name']) : '';
        $client_name = isset($data['client_name']) ? trim($data['client_name']) : '';
        $email = isset($data['email']) ? trim($data['email']) : '';
        $phone = isset($data['phone']) ? trim($data['phone']) : '';
        $address_line1 = isset($data['address_line1']) ? trim($data['address_line1']) : '';
        $address_line2 = isset($data['address_line2']) ? trim($data['address_line2']) : '';
        $city = isset($data['city']) ? trim($data['city']) : '';
        $state = isset($data['state']) ? trim($data['state']) : '';
        $postal_code = isset($data['postal_code']) ? trim($data['postal_code']) : '';
        $country = isset($data['country']) ? trim($data['country']) : 'Malaysia';
        $tax_id = isset($data['tax_id']) ? trim($data['tax_id']) : '';
        $notes = isset($data['notes']) ? trim($data['notes']) : '';
        $received_by_name = isset($data['received_by_name']) ? trim($data['received_by_name']) : null;
        $received_by_designation = isset($data['received_by_designation']) ? trim($data['received_by_designation']) : null;
        $logo_url = isset($data['logo_url']) && !empty($data['logo_url']) ? trim($data['logo_url']) : computeCompanyLogoUrl($email);

        if (empty($company_name)) {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'Company Name is required']);
            exit;
        }

        // 1. Try to find existing record by ID (if valid)
        $targetId = 0;
        if ($id > 0) {
            $checkId = $connection->prepare("SELECT id FROM clients WHERE id = ?");
            if ($checkId) {
                $checkId->bind_param("i", $id);
                $checkId->execute();
                $cRes = $checkId->get_result();
                if ($cRes && $cRow = $cRes->fetch_assoc()) {
                    $targetId = intval($cRow['id']);
                }
                $checkId->close();
            }
        }

        // 2. If not found by ID, try to find existing record by matching email
        if ($targetId === 0 && !empty($email)) {
            $parsedEmails = array_map('trim', explode(',', strtolower($email)));
            foreach ($parsedEmails as $singleE) {
                if (empty($singleE) || strpos($singleE, '@') === false) continue;
                $checkE = $connection->prepare("SELECT id FROM clients WHERE FIND_IN_SET(?, REPLACE(LOWER(email), ' ', '')) OR LOWER(email) LIKE ? LIMIT 1");
                if ($checkE) {
                    $like = "%" . $singleE . "%";
                    $checkE->bind_param("ss", $singleE, $like);
                    $checkE->execute();
                    $eRes = $checkE->get_result();
                    if ($eRes && $eRow = $eRes->fetch_assoc()) {
                        $targetId = intval($eRow['id']);
                        $checkE->close();
                        break;
                    }
                    $checkE->close();
                }
            }
        }

        // 3. If not found by email, try to find existing record by old_company_name or company_name
        $oldCompLookup = !empty($data['old_company_name']) ? trim($data['old_company_name']) : $company_name;
        if ($targetId === 0 && !empty($oldCompLookup)) {
            $checkComp = $connection->prepare("SELECT id FROM clients WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(?)) LIMIT 1");
            if ($checkComp) {
                $checkComp->bind_param("s", $oldCompLookup);
                $checkComp->execute();
                $compRes = $checkComp->get_result();
                if ($compRes && $compRow = $compRes->fetch_assoc()) {
                    $targetId = intval($compRow['id']);
                }
                $checkComp->close();
            }
        }

        if ($targetId > 0) {
            // Fetch previous company_name and email to propagate updates across SQL tables
            $oldCompName = '';
            $oldEmails = '';
            $getOld = $connection->prepare("SELECT company_name, email FROM clients WHERE id = ?");
            if ($getOld) {
                $getOld->bind_param("i", $targetId);
                $getOld->execute();
                $oRes = $getOld->get_result();
                if ($oRow = $oRes->fetch_assoc()) {
                    $oldCompName = trim($oRow['company_name'] ?? '');
                    $oldEmails = trim($oRow['email'] ?? '');
                }
                $getOld->close();
            }

            // Update existing record
            $stmt = $connection->prepare("UPDATE clients SET company_name=?, client_name=?, email=?, phone=?, address_line1=?, address_line2=?, city=?, state=?, postal_code=?, country=?, tax_id=?, logo_url=?, notes=?, received_by_name=?, received_by_designation=? WHERE id=?");
            if (!$stmt) {
                throw new Exception("Database prepare failed for client update: " . $connection->error);
            }
            $stmt->bind_param("sssssssssssssssi", $company_name, $client_name, $email, $phone, $address_line1, $address_line2, $city, $state, $postal_code, $country, $tax_id, $logo_url, $notes, $received_by_name, $received_by_designation, $targetId);

            if ($stmt->execute()) {
                // Also sync updated company_name, client_name, & phone to quotations and rfq_requests tables
                $allEmails = array_map('trim', explode(',', $email . ',' . $oldEmails));
                $allEmails = array_filter(array_unique(array_map('strtolower', $allEmails)));

                if (!empty($company_name)) {
                    // Update quotations table
                    if (!empty($allEmails)) {
                        $inClause = implode(',', array_fill(0, count($allEmails), '?'));
                        $sqlQuo = "UPDATE quotations SET company_name = ?, client_name = COALESCE(NULLIF(?, ''), client_name), client_phone = COALESCE(NULLIF(?, ''), client_phone) WHERE client_email IN ($inClause)";
                        if (!empty($oldCompName)) {
                            $sqlQuo .= " OR company_name = ?";
                        }
                        $stmtQuo = $connection->prepare($sqlQuo);
                        if ($stmtQuo) {
                            $params = array_merge([$company_name, $client_name, $phone], array_values($allEmails));
                            if (!empty($oldCompName)) {
                                $params[] = $oldCompName;
                            }
                            $types = str_repeat("s", count($params));
                            $stmtQuo->bind_param($types, ...$params);
                            $stmtQuo->execute();
                            $stmtQuo->close();
                        }
                    }

                    // Update rfq_requests table
                    if (!empty($allEmails)) {
                        $inClause = implode(',', array_fill(0, count($allEmails), '?'));
                        $sqlRfq = "UPDATE rfq_requests SET client_company = ?, client_name = COALESCE(NULLIF(?, ''), client_name), client_phone = COALESCE(NULLIF(?, ''), client_phone) WHERE client_email IN ($inClause)";
                        if (!empty($oldCompName)) {
                            $sqlRfq .= " OR client_company = ?";
                        }
                        $stmtRfq = $connection->prepare($sqlRfq);
                        if ($stmtRfq) {
                            $params = array_merge([$company_name, $client_name, $phone], array_values($allEmails));
                            if (!empty($oldCompName)) {
                                $params[] = $oldCompName;
                            }
                            $types = str_repeat("s", count($params));
                            $stmtRfq->bind_param($types, ...$params);
                            $stmtRfq->execute();
                            $stmtRfq->close();
                        }
                    }
                }

                ob_end_clean();
                echo json_encode(['status' => 'success', 'message' => 'Client updated successfully', 'id' => $targetId, 'logo_url' => $logo_url]);
                exit;
            } else {
                ob_end_clean();
                echo json_encode(['status' => 'error', 'message' => 'Failed to update client: ' . $stmt->error]);
                exit;
            }
        } else {
            // Insert new client record
            $stmt = $connection->prepare("INSERT INTO clients (company_name, client_name, email, phone, address_line1, address_line2, city, state, postal_code, country, tax_id, logo_url, notes, received_by_name, received_by_designation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            if (!$stmt) {
                throw new Exception("Database prepare failed for client insert: " . $connection->error);
            }
            $stmt->bind_param("sssssssssssssss", $company_name, $client_name, $email, $phone, $address_line1, $address_line2, $city, $state, $postal_code, $country, $tax_id, $logo_url, $notes, $received_by_name, $received_by_designation);

            if ($stmt->execute()) {
                $newId = $stmt->insert_id;
                ob_end_clean();
                echo json_encode(['status' => 'success', 'message' => 'Client added successfully', 'id' => $newId, 'logo_url' => $logo_url]);
                exit;
            } else {
                ob_end_clean();
                echo json_encode(['status' => 'error', 'message' => 'Failed to add client: ' . $stmt->error]);
                exit;
            }
        }
    }
} catch (Throwable $e) {
    if (ob_get_level() > 0) ob_end_clean();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'error',
        'message' => 'API Error: ' . $e->getMessage()
    ]);
    exit;
}
