# 🚀 ERP ABMALAYA - Executive RFQ & SPH Quotation Portal

Portal ERP Modern & Komprehensif untuk **ABMALAYA.COM (MALAYSIA)** yang menangani seluruh alur operasional maritim & industri:
**Penerimaan Email RFQ Live IMAP ➔ Master Kategori IMPA (Standardisasi Internasional Maritim) ➔ Pemindaian AI Multimodal Gemini ➔ Quotation Builder (Kalkulasi SPH & Pemilih Multi-Barang) ➔ Mesin PDF Puppeteer Multi-Halaman ➔ Pengiriman Penawaran PDF Resmi**.

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

3. **Mesin SPH & Commercial Invoice PDF Multi-Halaman (Headless Chrome Puppeteer)**:
   - Generasi PDF resmi Surat Penawaran Harga (SPH) & Invoice berbasis Headless Chrome Puppeteer (`scripts/generate_pdf_puppeteer.cjs` & `public/api_pdf.php`).
   - **Tinggi Header Banner Dinamis (Preservasi Aspect Ratio)**: Perhitungan tinggi container header secara presisi `round(700 * (tinggi / lebar))` pada `view_doc.php`, `InvoiceBuilder.tsx`, dan `QuotationDoc.tsx` sehingga gambar banner tampil sempurna di belakang logo & alamat tanpa tertekan (*gepeng*) atau terpotong (*kepotong*) di batas garis biru tebal (`border-bottom: 2px solid #004f8b`).
   - **Multi-Page Flow A4**: Mendukung penawaran hingga puluhan/ratusan item (`QUO-ABM/MY/2026/0828` dengan 24+ item) secara otomatis terbagi bersih menjadi Halaman 1, 2, 3, dst.
   - **Repeating Header & Footer**: Letterhead Banner (Logo Perusahaan, Alamat, Gambar Banner Header) dan Footer Perusahaan (Logo, Email, Telepon, Website) terulang **100% konsisten pada setiap halaman A4**.
   - **Mesin Auto-Sync Daemon**: Integrasi otomatis `daemon/sync_quotations.php` dan `daemon/sync_invoices.php` yang mengonversi RFQ terverifikasi & SPH ACC menjadi Invoice & PDF resmi di latar belakang via Puppeteer dengan resolusi base URL `<base href="...">` dan penungguan gambar/font (`networkidle0` & `document.fonts.ready`).
   - **Manajemen Aset System Settings**: Fitur modal Lightbox Preview (Eye icon) dan simpan/download file pada setiap kartu upload (Logo, Stempel, Tanda Tangan, & Header Banner).
   - **DB Layout Offsets**: Mengikuti secara presisi konfigurasi `system_paper_settings` & `system_invoice_settings` di database (termasuk JSON `layout_offsets` untuk skala/posisi logo & alamat, `header_title`, `table_header_bg`, `stamp_url`, dan `signature_url`).
   - **High-Speed PDF Caching**: Endpoint `api_pdf.php` melayani preview PDF secara instant (0.01 detik) dari cache file `/uploads/pdf/` dan hanya menjalankan Puppeteer jika terdapat pembaruan/recreate (`force=1`).

4. **Database Change Watcher & System Notification Engine**:
   - Pemantau perubahan data otomatis (`daemon/watch_db_changes.php`) yang mendeteksi perubahan pada tabel `rfq_requests`, `quotations`, `products`, dan `users`.
   - Menghasilkan notifikasi sistem otomatis berformat bahasa Inggris yang dicatat ke dalam tabel `system_notifications`.

5. **Master Katalog Produk, Kode IMPA 6-Digit & Penawaran Alternatif (Offer)**:
   - Pemisahan terstruktur antara SKU internal (`product_code`), Kode IMPA Presisi 6-Digit (`impa_code`), serta Penawaran Alternatif (`offer` / `offered_item`).
   - Dukungan unggah banyak foto produk (*multiple photo upload*) dan konversi Base64 Data URI otomatis untuk rendering gambar tanpa celah.
   - Filter otomatis yang menyembunyikan item berstatus trash/deleted dari daftar aktif.

6. **Mesin Daemon Product Text Matching (Tiered & Fast-Path Matching)**:
   - Daemon dedicated (`daemon/matching_text_product.php`) yang mencocokkan item permintaan RFQ dengan Master Produk:
     - **Tingkat 1 (Fast-Path Exact IMPA / SKU)**: Pencocokan 100% instan untuk Kode IMPA 6-digit atau SKU.
     - **Tingkat 2 (Fuzzy Token Overlap ≥ 65%)**: Pencocokan kemiripan kata kunci pada nama produk, spesifikasi teknis, dan alternatif penawaran (`offer`).
   - Melampirkan `product_code`, `impa_code`, `unit_price`, `offer`, `specification`, dan `total` secara otomatis ke `quotation_items` tanpa duplikasi data.

7. **Engine Cloud Backup Google Sheets Otomatis 24/7**:
   - Skrip daemon latar belakang (`daemon/backup_products_sheets.php`) yang menggunakan Google Service Account JWT OAuth.
   - Otomatis mencadangkan katalog master produk (termasuk kode IMPA, harga modal, harga jual, stok, & link foto) ke private Google Spreadsheet milik `abmalayaindustry@gmail.com`.

8. **Quotation Builder & Tabel Item Rincian**:
   - Form pembuatan Surat Penawaran Harga (SPH) interaktif dengan kalkulasi PPN 11%, diskon, dan subtotal otomatis.
   - Tabel Rincian Item Penawaran lengkap dengan penyesuaian font profesional Inter/System UI dan penanganan otomatis tanggal dokumen (`pdf_created_at` / `date_issued`).

9. **Tabel Data SPH Quotation & High-Contrast Loading Bar**:
   - Fitur **Dropdown Filter** terpadu dengan live count badges (`All`, `Requisition`, `In Progress`, `Quotation`, `ACC Approved`, `Done`, `Trash`).
   - Indikator **Top Progress Bar** paling atas di navbar (`z-[9999]`) beranimasi (NProgress/GitHub style) yang sinkron dengan seluruh pemuatan data dan pembuatan PDF di `QuotationList.tsx`.
   - Optimasi query batch `api_quotations.php` (menghilangkan N+1 SQL queries menjadi 3 batch map) untuk waktu muat halaman dalam milidetik.

10. **Layanan Server Mandiri 24/7 di UTM Virtual Machine (31GB RAM)**:
    - Berjalan 24 jam non-stop di UTM VM (31GB RAM) tanpa perlu membuka IDE / terminal SSH:
      - `mariadb.service` (Port 3306)
      - `erp-php.service` (Port 8000 Multi-Worker)
      - `erp-vite.service` (Port 3000 Production Preview)
      - `erp-daemon.service` (Background Automation Loop per 2 menit)
      - `crontab` fallback (`*/5 * * * * /usr/bin/php /root/erp-abmalaya/daemon/run_all.php`)

11. **Modul Client Email Database & Chat per Perusahaan (`ChatEmail.tsx`)**:
    - **100% Full-Width & Sharp Boxy Theme**: Tampilan antarmuka bertema *clean white* dengan batas sudut tajam (*sharp rectangular borders*) tanpa sisa margin terpotong.
    - **Penapisan Ketat Klasifikasi AI (`ai_classification`)**: Hanya pesan dengan `ai_classification = 'quotation'` (atau terhubung ke tabel `quotations`) yang masuk ke dalam sistem. Pesan berstatus `iklan`, `waiting`, `newsletter`, atau `no-reply` dieksklusi secara total.
    - **Auto-Sync Database Client MySQL (`public/api_clients.php`)**: Otomatis mengekstrak data client hasil scan AI (`rfq_requests` & `quotations`) dan menyimpannya ke dalam tabel MySQL `clients` berdasarkan aturan tanggal `INBOX_RULE_START_DATE` (`2026-08-27`).
    - **Multi-Email per Perusahaan**: Kolom database `clients.email` berformat `TEXT` untuk menampung banyak email perusahaan (misal: *procurement*, *purchasing*, *finance*) lengkap dengan dropdown selector `To:`.
    - **Menu Dropdown Titik 3 (`⋮` / `MoreVertical`)**: Menyatukan seluruh aksi (*Edit Data DB Client*, *Data/File SPH*, *Download SPH PDF*, *Buat Invoice*, dan *AI Auto-Draft SPH*) ke dalam satu tombol menu ringkas.
    - **Tampilan Link Ringkas ID Email & Popup Preview**: Pesan masuk ditampilkan sebagai card link ringkas (`[ID Email: RFQ-XXXX] Subject ↗`) dengan indikator lampiran file & popup preview modal lengkap.
    - **Drawer "Data / File" & Indikator Status**: Menampilkan daftar PDF SPH dengan status pengiriman otomatis (`Ready for Send` vs `Done Send`).
    - **Floating Non-Cutoff Composer**: Kolom input ketikan balasan diatur melayang (*floating sticky bottom z-30*) sehingga selalu tampil utuh di semua resolusi layar.

12. **Optimasi Performa UI Reaktif & Tunnel Cloudflare HTTP/2**:
    - **Perpindahan Navigasi Instan (0ms)**: Menghilangkan delay artificial loading spinner saat berpindah tab.
    - **Optimistic State Updates & Silent Background Sync**: Pengeditan data client langsung memperbarui tampilan lokal dalam 0 milidetik, sementara sinkronisasi data server berjalan halus di latar belakang setiap 10 detik.
    - **Multi-Worker Server & Tunnel HTTP/2**: Konfigurasi `PHP_CLI_SERVER_WORKERS=8` dan Cloudflare Tunnel `http2` untuk akses cepat tanpa rintangan error 524.

---

## 🛠️ Arsitektur & Tech Stack

- **Frontend UI:** React 18 + **TypeScript** (`strict mode`) + Vite 5 + Tailwind CSS.
- **Backend API:** Native PHP Engine (`/usr/bin/php`) — Multi-worker CLI Server & Router.
- **PDF Generation Engine:** Headless Chrome via Puppeteer (`scripts/generate_pdf_puppeteer.cjs`).
- **Database Engine:** MariaDB / MySQL (`127.0.0.1:3306`, Database: `abmalaya_erp`).
- **Live Email Sync:** PHP IMAP SSL (`imap.gmail.com:993`).
- **AI Vision Engine:** Google Gemini 3.6 / 3.5 Flash Multimodal Vision API.
- **Icons & Typography:** Lucide React Icons + Font Inter & System UI Stack.

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
│   ├── api_pdf.php                 # PDF Generator API Endpoint (Stream / Download / Caching)
│   ├── api_quotations.php          # Endpoint MySQL CRUD SPH Quotations (Batch Query Optimized)
│   ├── api_products.php            # Endpoint Master Produk & Kategori IMPA
│   ├── api_clients.php             # Endpoint CRUD & Auto-Sync Client Database MySQL
│   ├── view_doc.php                # Printable HTML Layout for SPH Multi-Page PDF
│   └── router.php                  # Custom router untuk PHP Built-in Server
├── scripts/
│   └── generate_pdf_puppeteer.cjs  # Headless Chrome Puppeteer PDF Generator Script
├── resources/
│   ├── css/
│   │   └── app.css                 # Tailwind CSS & Print styles
│   └── js/
│       ├── components/
│       │   ├── RFQInbox.tsx        # Dashboard RFQ Inbox + Lightbox + AI Rule Filters
│       │   ├── ChatEmail.tsx       # Modul Chat Email Database Full-Width (Multi-Email + AI Filter + Dropdown Menu)
│       │   ├── Product.tsx         # Master Katalog Produk & IMPA Category Blueprints
│       │   ├── QuotationBuilder.tsx# Form SPH + Multi-Select Product Picker Modal
│       │   ├── QuotationList.tsx   # Tabel SPH (Dropdown Filter + Live Progress Bar + PDF Modal)
│       │   ├── SystemSettings.tsx  # Pengaturan Kredensial & Key Rotation Pool
│       │   ├── Header.tsx          # Topbar Navigasi Ringkas
│       │   └── Sidebar.tsx         # Sidebar Menu Navigasi ERP
│       ├── types/
│       │   └── erp.ts              # Definisi Tipe TypeScript Ketat
│       ├── App.tsx                 # Entrypoint Utama SPA + React ErrorBoundary + Instant View Switcher
│       └── main.tsx                # Mount React DOM
├── AGENTS.md                       # Panduan Utama & Aturan Proyek Prosedural
├── package.json                    # Konfigurasi dependensi React & Vite
└── README.md                       # Dokumentasi Proyek
```

---

## 🖥️ Cara Menjalankan Layanan & Akses Lingkungan (Dev / UTM VM 31GB RAM / Live Hosting)

### 1. Status Service Systemd di UTM Virtual Machine (31GB RAM)
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

### 3. Akses Production Live & Local UTM VM (31GB RAM)
- **Portal ERP Live:** `https://erp.abmalaya.com`
- **UTM VM Preview (Host / Network):** `http://172.24.180.133:3000` (`http://localhost:3000`)
- **UTM VM API (Host / Network):** `http://172.24.180.133:8000` (`http://localhost:8000`)
- **Local Database Adminer GUI:** `http://172.24.180.133:8000/adminer.php`

---

## 🗄️ Sinkronisasi & Migrasi Database SQL

Struktur database pada lingkungan UTM VM (31GB RAM) (`abmalaya_erp`) disinkronkan identik dengan lingkungan hosting produksi (`abmalaya_abmalaya_erp`):

1. **Skema Terbaru Database:**
   - Skema struktur tabel lengkap: `cpanel/database_schema.sql`

2. **Cara Migrasi & Sync Ke Hosting Produksi:**
   - **Via Adminer GUI Database:** `http://127.0.0.1:8000/adminer.php`
   - **Via Live DB Sync Script:** `https://erp.abmalaya.com/db_sync_live.php?import_sql=1`

---

## ⏱️ Konfigurasi Cron Job cPanel Hosting (Penarikan Email & Otomasi 24/7)

Untuk memastikan email RFQ baru dari Gmail otomatis ditarik, diklasifikasikan oleh AI, dan dibuatkan draft SPH 24/7 di hosting produksi (meskipun tidak ada pengguna yang membuka browser):

- **Pengaturan Waktu Cron (Common Settings):** Every 5 Minutes (`*/5 * * * *`)
- **Perintah Cron Command (Active cPanel Cron Job):**
  ```bash
  curl -s -L "https://erp.abmalaya.com/cron_trigger.php" >/dev/null 2>&1
  ```

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
