# 🚀 ERP ABMALAYA - Executive RFQ & SPH Quotation Portal

Portal ERP Modern & Komprehensif untuk **ABMALAYA.COM (MALAYSIA)** yang menangani seluruh alur operasional maritim & industri:
**Penerimaan Email RFQ Live IMAP ➔ Master Kategori IMPA (Standardisasi Internasional Maritim) ➔ Pemindaian AI Multimodal Gemini ➔ Quotation Builder (Kalkulasi SPH & Pemilih Multi-Barang) ➔ Pengiriman Penawaran PDF Resmi**.

---

## 🌟 Fitur Utama Sistem

1. **RFQ Inbox & Live Gmail IMAP Reader 24/7**:
   - Integrasi langsung dengan Live Gmail IMAP (`abmalayaindustry@gmail.com`).
   - Webhook realtime Pub/Sub (`public/api_gmail_webhook.php`) & Service Daemon Pemindai Latar Belakang (`daemon/run_loop.php`).
   - Filter Tanggal Cutoff (`Info Start From Date Cutoff`) & Filter Prioritas Lampiran PDF.
   - Fitur inspeksi log kesalahan AI 3-titik (*Self-healing retry trace*).

2. **Mesin AI Gemini Multimodal & Smart Key Rotation Pool**:
   - Rotasi otomatis Gemini API Keys dari tabel dedicated `gemini_api_keys` dengan pemantauan kapasitas 24 jam real-time & counter token di System Settings.
   - Mendukung format API Key legacy (`AIzaSy...`) dan format Google AI Studio 2026 (`AQ.Ab8RN6...`).
   - Pemindaian dual mode: mengekstraksi data terstruktur langsung dari teks pesan email (`subject`, `item_requested`, `message_body`) untuk RFQ tanpa lampiran, serta Vision OCR multimodal untuk dokumen fisik (PDF, PNG, JPG).
   - Penanganan *Rate Limit (HTTP 429)* pintar dengan status `waiting_ai_limit` yang otomatis re-queue dan retry saat kuota Gemini reset.
   - Penggunaan model AI aktif: `gemini-3.6-flash`, `gemini-3.5-flash`, dan `gemini-flash-latest`.

3. **Database Change Watcher & System Notification Engine**:
   - Pemantau perubahan data otomatis (`daemon/watch_db_changes.php`) yang mendeteksi perubahan pada tabel `rfq_requests`, `quotations`, `products`, dan `users`.
   - Menghasilkan notifikasi sistem otomatis berformat bahasa Inggris yang dicatat ke dalam tabel `system_notifications`.

4. **Master Katalog Produk & Standardisasi Kode Kategori IMPA**:
   - Penapisan otomatis kode kategori internasional dunia maritim (contoh: IMPA `11` Clothing, IMPA `39` Medicine, IMPA `45` Petroleum, IMPA `49` Hardware, IMPA `51` Cleaning Chemicals, IMPA `79` Provision).
   - Daemon pencocokan teks otomatis (`daemon/matching_text_impa.php`) untuk memberikan kode IMPA pada SPH dan item barang.

5. **Quotation Builder & Pop-Up Pemilih Multi-Barang**:
   - Form pembuatan Surat Penawaran Harga (SPH) interaktif dengan kalkulasi PPN, diskon, dan subtotal otomatis.
   - Pop-Up Pemilih Multi-Barang dari katalog master database.
   - Synchronised history audit trail & log aktivitas scan OCR per SPH.

6. **Tabel Data SPH Quotation (Dropdown Filter, Count Badges & Sticky Header)**:
   - Fitur **Dropdown Filter** terpadu menggantikan tombol tab dengan live count badges (`All`, `Requisition`, `In Progress`, `Quotation`, `ACC Approved`, `Done`, `Trash`).
   - Pemetaan status akurat (`in_progress`, `draft`, `siap_kirim`, `approved`, `done_send`, `junk`).
   - Header tabel melayang permanen (*Sticky Top Header*) saat di-scroll down.
   - Mode Opsi **"Tampilkan Semua Kolom Database (Full)"** pada menu 3-titik yang melebarkan tampilan hingga **21 Kolom MySQL LENGKAP**.

7. **Layanan Server Mandiri 24/7 di Linux VPS (Systemd Services & Cron)**:
   - Berjalan 24 jam non-stop di Linux VPS tanpa perlu membuka IDE / terminal SSH:
     - `mariadb.service` (Port 3306)
     - `erp-php.service` (Port 8000 Multi-Worker)
     - `erp-vite.service` (Port 3000 Production Preview)
     - `erp-daemon.service` (Background Automation Loop per 2 menit)
     - `crontab` fallback (`*/5 * * * * /usr/bin/php /root/erp-abmalaya/daemon/run_all.php`)

---

## 🛠️ Arsitektur & Tech Stack

- **Frontend UI:** React 18 + **TypeScript** (`strict mode`) + Vite 5 + Tailwind CSS.
- **Backend API:** Native PHP Engine (`/usr/bin/php`) — Multi-worker CLI Server & Router.
- **Database Engine:** MariaDB / MySQL (`127.0.0.1:3306`, Database: `abmalaya_erp`).
- **Live Email Sync:** PHP IMAP SSL (`imap.gmail.com:993`).
- **AI Vision Engine:** Google Gemini 3.6 / 3.5 Flash Multimodal Vision API.
- **Icons & Typography:** Lucide React Icons (0% Emoji) + Font Inter & Roboto.

---

## 📁 Struktur Direktori Proyek

```text
erp-abmalaya/
├── cpanel/
│   └── database_schema.sql         # Skema database MySQL abmalaya_erp
├── daemon/
│   ├── run_all.php                 # Master runner daemon per 5 menit
│   ├── run_loop.php                # Continuous loop runner (2-minute interval)
│   ├── scan_inbox.php              # Mesin AI Scanner Inbox + Smart Key Rotation
│   ├── scan_ocr.php                # Mesin Vision OCR Scanner PDF/Gambar
│   ├── watch_db_changes.php        # System Notification & DB Change Detector
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
│       │   ├── Product.tsx         # Master Katalog Produk & IMPA Category Blueprints
│       │   ├── QuotationBuilder.tsx# Form SPH + Multi-Select Product Picker Modal
│       │   ├── QuotationList.tsx   # Tabel SPH (Dropdown Filter + Mode 21 Kolom DB)
│       │   ├── SystemSettings.tsx  # Pengaturan Kredensial & Key Rotation Pool
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

## 🖥️ Cara Menjalankan Layanan & Akses Lingkungan (Dev / Local VPS / Live Hosting)

### 1. Status Service Systemd di Local VPS
Layanan backend, frontend preview, dan background daemon berjalan secara otomatis via `systemd`:
```bash
systemctl status erp-php.service      # Backend API (Port 8000)
systemctl status erp-vite.service     # Frontend SPA (Port 3000)
systemctl status erp-daemon.service   # Background Daemon Service (Loop 2-min)
```

### 2. Monitoring Daemon Logs
Log eksekusi daemon dapat dipantau secara real-time:
```bash
tail -f daemon/logs/watch_db_$(date +%Y-%m-%d).log
tail -f daemon/logs/scan_ocr_$(date +%Y-%m-%d).log
```

### 3. Akses Production Live
- **Portal ERP Live:** `https://erp.abmalaya.com`
- **Local VPS Preview:** `http://202.155.94.144:3000`
- **Local VPS API:** `http://202.155.94.144:8000`

---

## 🗄️ Sinkronisasi & Migrasi Database SQL

Struktur database pada lingkungan lokal/testing VPS (`abmalaya_erp`) disinkronkan identik dengan lingkungan hosting produksi (`abmalaya_abmalaya_erp`):

1. **Skema Terbaru Database:**
   - Skema struktur tabel lengkap: `cpanel/database_schema.sql`

2. **Cara Migrasi & Sync Ke Hosting Produksi:**
   - **Via Adminer GUI Database:** `http://127.0.0.1:8000/adminer.php`
   - **Via Live DB Sync Script:** `https://erp.abmalaya.com/db_sync_live.php?import_sql=1`

---

## 🚀 Alur Build & Deploy FTP Ke Server Hosting

Setiap kali melakukan pembaruan kode dan diminta melakukan deploy oleh user:

1. **Build Production Frontend:**
   ```bash
   npm run build
   ```

2. **Eksekusi Deployment FTP:**
   ```bash
   php deploy_ftp.php
   ```

---

## 🔒 Aturan 0% Dummy Data & Deployment

1. **STRICT ZERO DUMMY DATA DIRECTIVE:**
   - Seluruh data pada portal ERP (RFQ Inbox, Penawaran SPH, preview lampiran, dll.) **WAJIB 100% ASLI** dari Live Gmail IMAP (`abmalayaindustry@gmail.com`) dan MySQL `abmalaya_erp`.
   - Dilarang memasang data buatan, placeholder, atau harga acak tiruan.

2. **STRICT NO AUTO DEPLOY RULE:**
   - Proses **FTP Upload** dan **GitHub Push** hanya boleh dipicu **apabila diminta secara eksplisit oleh pengguna** melalui obrolan chat. Dilarang memicu deployment otomatis.


