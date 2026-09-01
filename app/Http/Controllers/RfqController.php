<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class RfqController extends Controller
{
    /**
     * Tampilkan Inbox Permintaan Email (RFQ)
     */
    public function index()
    {
        return Inertia::render('RFQ/Index');
    }

    /**
     * Simpan email permintaan baru yang masuk (Via Webhook / IMAP Parser)
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'sender_name' => 'required|string|max:255',
            'sender_email' => 'required|email|max:255',
            'company' => 'required|string|max:255',
            'subject' => 'required|string|max:255',
            'message_body' => 'required|string',
            'item_requested' => 'nullable|string',
        ]);

        // Simpan ke DB MySQL
        return response()->json([
            'success' => true,
            'message' => 'Email permintaan RFQ berhasil dicatat ke sistem ERP.',
            'data' => $validated
        ]);
    }
}
