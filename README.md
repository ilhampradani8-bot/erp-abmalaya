# 🚀 ERP ABMALAYA - Executive RFQ & SPH Quotation Portal

Portal ERP Modern & Komprehensif untuk **ABMALAYA.COM (MALAYSIA)** yang menangani seluruh alur operasional maritim & industri:
**Penerimaan Email RFQ Live IMAP ➔ Master Kategori IMPA (Standardisasi Internasional Maritim) ➔ Pemindaian AI Multimodal Gemini ➔ Quotation Builder (Kalkulasi SPH & Pemilih Multi-Barang) ➔ Pengiriman Penawaran PDF Resmi**.

---

## 🌟 Fitur Utama Sistem

1. **RFQ Inbox & Live Gmail IMAP Reader 24/7**:
   - Integrasi langsung dengan Live Gmail IMAP (`abmalayaindustry@gmail.com`).
   - Webhook realtime Pub/Sub & Cron Job Pemindai Latar Belakang (`daemon/run_all.php`).
   - Filter Tanggal Cutoff (`Info Start From Date Cutoff`) & Filter Prioritas Lampiran PDF.
   - Fitur inspeksi log kesalahan AI 3-titik (*Self-healing retry trace*).

2. **Mesin AI Gemini Multimodal & Smart Key Rotation**:
   - Rotasi otomatis hingga 4 Gemini API Keys tersimpan per baris database terpisah (`GEMINI_API_KEY_1..4`).
   - Deteksi *Rate Limit (429)* pintar dengan *Cooldown Tracker 60-detik* per kunci untuk mencegah kebocoran kuota API.
   - Pemindaian teks email lengkap (Subject, Sender, Body, Recipient) dan Vision OCR dokumen fisik (PDF, PNG, JPG).
   - Aturan klasifikasi ketat untuk memfilter email permohonan perpanjangan tender internal / surat keluar Sales.

3. **Master Katalog Produk & Standardisasi Kode Kategori IMPA**:
   - Sinkronisasi otomatis dengan Google Sheets Cetak Biru Kategori (`Spreadsheet ID: 17oE102qBlTzXGeWxHMkNTCnz0CE4TKR_xxsq65QqFmI`).
   - Pembersihan otomatis data mentah dari emoji dan karakter non-ASCII (0% Emojis Policy).
   - Dukungan kode kategori internasional dunia maritim (contoh: IMPA `39` Medicine, IMPA `45` Petroleum, IMPA `49` Hardware).

4. **Quotation Builder & Pop-Up Pemilih Multi-Barang**:
   - Form pembuatan Surat Penawaran Harga (SPH) interaktif dengan kalkulasi PPN (11%), diskon, dan subtotal otomatis.
   - Pop-Up Pemilih Multi-Barang dari katalog master database.
   - Kalkulasi otomatis mata uang (RM / IDR).

5. **Tabel Data SPH Quotation (Mode 21 Kolom Database MySQL & Header Sticky)**:
   - Header tabel melayang permanen (*Sticky Top Header*) saat di-scroll down.
   - Mode Opsi **"Tampilkan Semua Kolom Database (Full)"** pada menu 3-titik yang melebarkan tampilan hingga **21 Kolom MySQL LENGKAP** (`ID DB`, `SPH Number`, `RFQ ID`, `Client Name`, `Client Email`, `Company Name`, `Date Issued`, `Valid Until`, `Subtotal`, `Discount`, `Tax (%)`, `Tax Amount`, `Grand Total`, `Notes`, `Status`, `OCR Scan`, `Approved By`, `Created By`, `Created At`, dll.).

6. **Layanan Server Mandiri 24/7 di Linux VPS (Systemd Services)**:
   - Berjalan 24 jam non-stop di Linux VPS tanpa perlu membuka IDE / terminal SSH:
     - `mariadb.service` (Port 3306)
     - `erp-php.service` (Port 8000 Multi-Worker)
     - `erp-vite.service` (Port 3000 / 3002 Frontend)
     - `crontab` (`*/5 * * * * php daemon/run_all.php`)

---

## 🛠️ Arsitektur & Tech Stack

- **Frontend UI:** React 18 + **TypeScript** (`strict mode`) + Vite 5 + Tailwind CSS.
- **Backend API:** Native PHP Engine (`/usr/bin/php`) — Multi-worker CLI Server & Router.
- **Database Engine:** MariaDB / MySQL (`127.0.0.1:3306`, Database: `abmalaya_erp`).
- **Live Email Sync:** PHP IMAP SSL (`imap.gmail.com:993`).
- **AI Vision Engine:** Google Gemini 1.5 Flash Multimodal Vision API.
- **Icons & Typography:** Lucide React Icons (0% Emoji) + Font Inter & Roboto.

---

## 📁 Struktur Direktori Proyek

```text
erp-abmalaya/
├── cpanel/
│   └── database_schema.sql         # Skema database MySQL abmalaya_erp
├── daemon/
│   ├── run_all.php                 # Master runner daemon per 5 menit
│   ├── scan_inbox.php              # Mesin AI Scanner Inbox + Smart Key Rotation
│   ├── scan_ocr.php                # Mesin Vision OCR Scanner PDF/Gambar
│   └── logs/                       # Folder log otomatis eksekusi daemon
├── public/
│   ├── api_fetch_live_gmail.php    # Live IMAP Reader & Webhook Sync
│   ├── api_gmail_webhook.php       # Google Cloud Pub/Sub Webhook Push Listener
│   ├── api_quotations.php          # Endpoint MySQL CRUD SPH Quotations
│   ├── api_products.php            # Endpoint Master Produk & Kategori IMPA
│   ├── import_products.php         # Sinkronisasi Cetak Biru Kategori Google Sheets
│   └── router.php                  # Custom router untuk PHP Built-in Server
├── resources/
│   ├── css/
│   │   └── app.css                 # Tailwind CSS & Print styles
│   └── js/
│       ├── components/
│       │   ├── RFQInbox.tsx        # Dashboard RFQ Inbox + Lightbox + AI Rule Filters
│       │   ├── ProductCatalog.tsx  # Master Katalog Produk & IMPA Category Blueprints
│       │   ├── QuotationBuilder.tsx# Form SPH + Multi-Select Product Picker Modal
│       │   ├── QuotationList.tsx   # Tabel SPH (Sticky Header + Mode 21 Kolom DB)
│       │   ├── SystemSettings.tsx  # Pengaturan Kredensial & Filter Date Cutoff
│       │   ├── Header.tsx          # Topbar Navigasi Ringkas
│       │   └── Sidebar.tsx         # Sidebar Menu Neumorphic Soft-UI
│       ├── types/
│       │   └── erp.ts              # Definisi Tipe TypeScript Ketat
│       ├── App.tsx                 # Entrypoint Utama SPA + React ErrorBoundary
│       └── main.tsx                # Mount React DOM
├── AGENTS.md                       # Panduan Utama & Aturan Proyek Prosedural
├── package.json                    # Konfigurasi dependensi React & Vite
└── README.md                       # Dokumentasi Proyek
```

---

## 🖥️ Cara Menjalankan Layanan di Server Linux VPS (24/7)

Sistem sudah terkonfigurasi sebagai **Systemd Services** yang berjalan permanen di latar belakang:

1. **Cek Status Layanan Systemd:**
   ```bash
   systemctl status erp-php.service
   systemctl status erp-vite.service
   systemctl status mariadb.service
   ```

2. **Restart Layanan Jika Ada Pembaruan:**
   ```bash
   systemctl restart erp-php.service
   systemctl restart erp-vite.service
   ```

3. **Buka Portal di Browser:**
   - 🌐 Frontend: `http://202.155.94.144:3000`
   - ⚡ Backend API: `http://202.155.94.144:8000`
   - 🗄️ Database Adminer: `http://202.155.94.144:8000/adminer.php`

---

## 🔒 Aturan 0% Dummy Data & Deployment

1. **STRICT ZERO DUMMY DATA DIRECTIVE:**
   - Seluruh data pada portal ERP (RFQ Inbox, Penawaran SPH, preview lampiran, dll.) **WAJIB 100% ASLI** dari Live Gmail IMAP (`abmalayaindustry@gmail.com`) dan MySQL `abmalaya_erp`.
   - Dilarang memasang data buatan, placeholder, atau harga acak tiruan.

2. **STRICT NO AUTO DEPLOY RULE:**
   - Proses **FTP Upload** dan **GitHub Push** hanya boleh dipicu **apabila diminta secara eksplisit oleh pengguna** melalui obrolan chat. Dilarang memicu deployment otomatis.
