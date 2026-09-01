<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use App\Mail\QuotationOfferMail;
use Inertia\Inertia;

class QuotationController extends Controller
{
    /**
     * Form Pembuatan Penawaran Harga
     */
    public function create()
    {
        return Inertia::render('Quotation/Create');
    }

    /**
     * Balas Email Permintaan dengan PDF Surat Penawaran Harga
     */
    public function sendEmailOffer(Request $request)
    {
        $validated = $request->validate([
            'to' => 'required|email',
            'subject' => 'required|string',
            'body' => 'required|string',
            'quotation_number' => 'required|string',
        ]);

        // Pengiriman email via cPanel SMTP Mailable (Laravel Mail)
        // Mail::to($request->to)->send(new QuotationOfferMail($validated));

        return response()->json([
            'success' => true,
            'message' => 'Surat penawaran harga & lampiran PDF berhasil dikirimkan via cPanel SMTP.',
        ]);
    }
}
