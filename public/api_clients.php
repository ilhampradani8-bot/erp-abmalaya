<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    ob_end_clean();
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';
$connection = isset($conn) ? $conn : $db_conn;

// Ensure clients table exists
$connection->query("CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) DEFAULT NULL,
    email TEXT DEFAULT NULL,
    phone VARCHAR(100) DEFAULT NULL,
    address_line1 TEXT DEFAULT NULL,
    address_line2 TEXT DEFAULT NULL,
    city VARCHAR(100) DEFAULT NULL,
    state VARCHAR(100) DEFAULT NULL,
    postal_code VARCHAR(50) DEFAULT NULL,
    country VARCHAR(100) DEFAULT 'Malaysia',
    tax_id VARCHAR(100) DEFAULT NULL,
    logo_url VARCHAR(500) DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Auto-migrate column logo_url if not exists
@$connection->query("ALTER TABLE clients ADD COLUMN logo_url VARCHAR(500) DEFAULT NULL");

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
    $resRfq = @$connection->query("SELECT company, sender_name, sender_email, phone FROM rfq_requests WHERE company IS NOT NULL AND TRIM(company) != '' AND (ai_classification = 'quotation' OR (status IN ('masuk', 'diproses', 'penawaran_terkirim', 'deal') AND ai_classification != 'iklan' AND ai_classification != 'waiting')) AND (DATE(created_at) >= '$startDate' OR DATE(date_received) >= '$startDate')");
    if ($resRfq) {
        while ($row = $resRfq->fetch_assoc()) {
            $comp = trim($row['company'] ?? '');
            $cName = trim($row['sender_name'] ?? '');
            $cEmail = trim($row['sender_email'] ?? '');
            $cPhone = trim($row['phone'] ?? '');
            if (empty($comp)) continue;

            // Exclude no-reply, marketing, and promotional emails
            if (preg_match('/no-?reply|donotreply|newsletter|marketing|promotions|notifications@|bounce@|mailer-daemon|info@facebook|info@google/i', $cEmail)) {
                continue;
            }

            $check = $connection->prepare("SELECT id, email FROM clients WHERE company_name = ?");
            if ($check) {
                $check->bind_param("s", $comp);
                $check->execute();
                $cRes = $check->get_result();
                if ($cRow = $cRes->fetch_assoc()) {
                    $existingEmails = array_map('trim', explode(',', $cRow['email'] ?? ''));
                    if (!empty($cEmail) && !in_array($cEmail, $existingEmails)) {
                        $existingEmails[] = $cEmail;
                        $newEmails = implode(', ', array_filter($existingEmails));
                        $up = $connection->prepare("UPDATE clients SET email = ? WHERE id = ?");
                        if ($up) {
                            $up->bind_param("si", $newEmails, $cRow['id']);
                            $up->execute();
                        }
                    }
                } else {
                    $ins = $connection->prepare("INSERT INTO clients (company_name, client_name, email, phone) VALUES (?, ?, ?, ?)");
                    if ($ins) {
                        $ins->bind_param("ssss", $comp, $cName, $cEmail, $cPhone);
                        $ins->execute();
                    }
                }
            }
        }
    }

    // 2. Sync from quotations (DATE >= INBOX_RULE_START_DATE)
    $resQuo = @$connection->query("SELECT company_name, client_name, client_email, client_phone FROM quotations WHERE company_name IS NOT NULL AND TRIM(company_name) != '' AND (DATE(date_issued) >= '$startDate' OR DATE(created_at) >= '$startDate')");
    if ($resQuo) {
        while ($row = $resQuo->fetch_assoc()) {
            $comp = trim($row['company_name'] ?? '');
            $cName = trim($row['client_name'] ?? '');
            $cEmail = trim($row['client_email'] ?? '');
            $cPhone = trim($row['client_phone'] ?? '');
            if (empty($comp)) continue;

            $check = $connection->prepare("SELECT id, email FROM clients WHERE company_name = ?");
            if ($check) {
                $check->bind_param("s", $comp);
                $check->execute();
                $cRes = $check->get_result();
                if ($cRow = $cRes->fetch_assoc()) {
                    $existingEmails = array_map('trim', explode(',', $cRow['email'] ?? ''));
                    if (!empty($cEmail) && !in_array($cEmail, $existingEmails)) {
                        $existingEmails[] = $cEmail;
                        $newEmails = implode(', ', array_filter($existingEmails));
                        $up = $connection->prepare("UPDATE clients SET email = ? WHERE id = ?");
                        if ($up) {
                            $up->bind_param("si", $newEmails, $cRow['id']);
                            $up->execute();
                        }
                    }
                } else {
                    $ins = $connection->prepare("INSERT INTO clients (company_name, client_name, email, phone) VALUES (?, ?, ?, ?)");
                    if ($ins) {
                        $ins->bind_param("ssss", $comp, $cName, $cEmail, $cPhone);
                        $ins->execute();
                    }
                }
            }
        }
    }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    autoSyncClientsFromRfqsAndQuotations($connection);

    $result = $connection->query("SELECT * FROM clients ORDER BY company_name ASC");
    $clients = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
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
    $logo_url = isset($data['logo_url']) && !empty($data['logo_url']) ? trim($data['logo_url']) : computeCompanyLogoUrl($email);

    if (empty($company_name)) {
        ob_end_clean();
        echo json_encode(['status' => 'error', 'message' => 'Company Name is required']);
        exit;
    }

    if ($id > 0) {
        // Update existing
        $stmt = $connection->prepare("UPDATE clients SET company_name=?, client_name=?, email=?, phone=?, address_line1=?, address_line2=?, city=?, state=?, postal_code=?, country=?, tax_id=?, logo_url=?, notes=? WHERE id=?");
        $stmt->bind_param("sssssssssssssi", $company_name, $client_name, $email, $phone, $address_line1, $address_line2, $city, $state, $postal_code, $country, $tax_id, $logo_url, $notes, $id);
        if ($stmt->execute()) {
            ob_end_clean();
            echo json_encode(['status' => 'success', 'message' => 'Client updated successfully', 'id' => $id, 'logo_url' => $logo_url]);
            exit;
        } else {
            ob_end_clean();
            echo json_encode(['status' => 'error', 'message' => 'Failed to update client: ' . $stmt->error]);
            exit;
        }
    } else {
        // Insert new client
        $stmt = $connection->prepare("INSERT INTO clients (company_name, client_name, email, phone, address_line1, address_line2, city, state, postal_code, country, tax_id, logo_url, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssssssssssss", $company_name, $client_name, $email, $phone, $address_line1, $address_line2, $city, $state, $postal_code, $country, $tax_id, $logo_url, $notes);
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
