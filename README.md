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

2. **Mesin AI Gemini Multimodal & Smart Key Rotation Pool**:
   - Rotasi otomatis Gemini API Keys dari tabel dedicated `gemini_api_keys` dengan pemantauan kapasitas 24 jam real-time & counter token di System Settings.
   - Pemindaian dual mode: mengekstraksi data terstruktur langsung dari teks pesan email (`subject`, `item_requested`, `message_body`) untuk RFQ tanpa lampiran, serta Vision OCR multimodal untuk dokumen fisik (PDF, PNG, JPG).
   - Penanganan *Rate Limit (HTTP 429)* pintar dengan *Native Regex Fallback Parser* untuk menjamin 100% item RFQ terurai tanpa status terhenti.
   - Penggunaan model AI resmi aktif: `gemini-1.5-flash`, `gemini-1.5-pro`, dan `gemini-2.0-flash` (mematuhi standar panduan `AGENTS.md`).

3. **Master Katalog Produk & Standardisasi Kode Kategori IMPA**:
   - Penapisan otomatis kode kategori internasional dunia maritim (contoh: IMPA `11` Clothing, IMPA `39` Medicine, IMPA `45` Petroleum, IMPA `49` Hardware, IMPA `51` Cleaning Chemicals, IMPA `79` Provision).
   - Daemon pencocokan teks otomatis (`daemon/matching_text_impa.php`) untuk memberikan kode IMPA pada SPH dan item barang.

4. **Quotation Builder & Pop-Up Pemilih Multi-Barang**:
   - Form pembuatan Surat Penawaran Harga (SPH) interaktif dengan kalkulasi PPN, diskon, dan subtotal otomatis.
   - Pop-Up Pemilih Multi-Barang dari katalog master database.
   - Synchronised history audit trail & log aktivitas scan OCR per SPH.


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

## 🖥️ Cara Menjalankan Layanan & Akses Lingkungan (Dev / Local VPS / Public Tunnel)

### 1. Menjalankan Backend PHP Engine (Multi-Worker Mode)
 Server PHP dev menggunakan mode **Multi-Worker (16 Workers)** agar proses sync Live Gmail IMAP & Vision OCR tidak memblokir (*non-blocking*) request API lainnya maupun Adminer:
```bash
PHP_CLI_SERVER_WORKERS=16 php -S 0.0.0.0:8000 -t public public/router.php
```

### 2. Menjalankan Frontend React (Vite Dev Server)
```bash
npm run dev
```

### 3. Mengaktifkan Akses Publik via Cloudflare Tunnels (Quick Tunnel)
Untuk pengujian publik / remote tanpa IP publik statis:
* **Tunnel Frontend (Port 3000):**
  ```bash
  cloudflared tunnel --url http://127.0.0.1:3000
  ```
* **Tunnel Backend API & Adminer (Port 8000):**
  ```bash
  cloudflared tunnel --url http://127.0.0.1:8000
  ```

---

## 🗄️ Sinkronisasi & Migrasi Database SQL (Local Dev vs Production Hosting)

Struktur database pada lingkungan lokal/testing VPS (`abmalaya_erp`) sudah disinkronkan 100% identik dengan lingkungan hosting produksi (`abmalaya_abmalaya_erp`):

1. **Skema Terbaru Database:**
   - Skema struktur tabel lengkap: `cpanel/database_schema.sql`
   - Backup data & struktur lengkap: `cpanel/database_backup_full.sql`

2. **Cara Migrasi & Sync Ke Hosting Produksi:**
   - **Opsi A (Via Migration Script):** Jalankan `php run_migration.php`
   - **Opsi B (Via Adminer / phpMyAdmin):** Import file `cpanel/database_schema.sql` pada database hosting.
   - **Akses Adminer GUI Database:** 
     - Lokal: `http://127.0.0.1:8000/adminer.php`
     - Via Tunnel: `https://<tunnel-url-backend>/adminer.php`
     - Auto Login: Server `127.0.0.1`, User `root`, DB `abmalaya_erp`

---

## 🚀 Alur Build & Deploy FTP Ke Server Hosting

Setiap kali melakukan pembaruan kode dan diminta melakukan deploy:

1. **Build Production Frontend:**
   ```bash
   npm run build
   ```
   *(Menghasilkan bundle React SPA teroptimasi di direktori `dist/`)*

2. **Eksekusi Deployment FTP:**
   ```bash
   php deploy_ftp.php
   ```
   *(Secara otomatis mengunggah `dist/`, `public/`, `daemon/`, dan `cpanel/` ke FTP hosting `110.4.45.199`)*

---

## 🔒 Aturan 0% Dummy Data & Deployment

1. **STRICT ZERO DUMMY DATA DIRECTIVE:**
   - Seluruh data pada portal ERP (RFQ Inbox, Penawaran SPH, preview lampiran, dll.) **WAJIB 100% ASLI** dari Live Gmail IMAP (`abmalayaindustry@gmail.com`) dan MySQL `abmalaya_erp`.
   - Dilarang memasang data buatan, placeholder, atau harga acak tiruan.

2. **STRICT NO AUTO DEPLOY RULE:**
   - Proses **FTP Upload** dan **GitHub Push** hanya boleh dipicu **apabila diminta secara eksplisit oleh pengguna** melalui obrolan chat. Dilarang memicu deployment otomatis.

