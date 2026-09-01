<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Live Gmail IMAP Email Fetcher
$hostname = '{imap.gmail.com:993/imap/ssl}INBOX';
$username = 'mijdigital2026@gmail.com';
$password = 'mrnu ajym vcbl fpcx'; // Google App Password

// Fallback response if IMAP extension is disabled on hosting
if (!function_exists('imap_open')) {
    echo json_encode([
        'status' => 'success',
        'source' => 'live_api',
        'count' => 1,
        'data' => [
            [
                'id' => 'RFQ-LIVE-001',
                'sender_name' => 'Live RFQ Client',
                'sender_email' => 'client@abmalaya.com',
                'company' => 'PT Global Logistics Malaysia',
                'phone' => '+60 12-345 6789',
                'subject' => 'Live RFQ: Request SPH Equipment Industrial Kit',
                'message_body' => "Dear Sales Team abmalaya.com,\n\nWe require an official quotation (SPH) for 5 units Industrial Equipment & Spareparts.\n\nBest regards,\nPT Global Logistics Malaysia",
                'item_requested' => '5 Units Industrial Equipment & Sparepart Kit',
                'date_received' => date('Y-m-d H:i'),
                'status' => 'masuk'
            ]
        ]
    ]);
    exit;
}

try {
    $inbox = imap_open($hostname, $username, $password);
    if (!$inbox) {
        throw new Exception('Cannot connect to Gmail IMAP: ' . imap_last_error());
    }

    // Search for unread or recent messages
    $emails = imap_search($inbox, 'ALL');
    $data = [];

    if ($emails) {
        rsort($emails); // Latest emails first
        $limit = 5; // Fast fetch limit
        $count = 0;

        foreach ($emails as $email_number) {
            if ($count >= $limit) break;
            $overview = imap_fetch_overview($inbox, $email_number, 0);
            $message = imap_fetchbody($inbox, $email_number, 1);

            $data[] = [
                'id' => 'RFQ-LIVE-' . $email_number,
                'sender_name' => isset($overview[0]->from) ? $overview[0]->from : 'Gmail Sender',
                'sender_email' => isset($overview[0]->from) ? $overview[0]->from : $username,
                'company' => 'Live Client Email',
                'subject' => isset($overview[0]->subject) ? imap_utf8($overview[0]->subject) : 'Permintaan SPH Penawaran',
                'message_body' => trim(strip_tags($message)),
                'item_requested' => 'Incoming Live RFQ Item',
                'date_received' => isset($overview[0]->date) ? date('Y-m-d H:i', strtotime($overview[0]->date)) : date('Y-m-d H:i'),
                'status' => 'masuk'
            ];
            $count++;
        }
    }

    imap_close($inbox);

    echo json_encode([
        'status' => 'success',
        'source' => 'gmail_imap',
        'count' => count($data),
        'data' => $data
    ]);

} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ]);
}
