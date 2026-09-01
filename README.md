# 🚀 ERP ABMALAYA - Executive RFQ & SPH Quotation Portal

Portal ERP Modern & Komprehensif untuk **ABMALAYA.COM (MALAYSIA)** yang menangani seluruh alur operasional:
**Penerimaan Email RFQ Live IMAP -> Katalog Produk Master (Koneksi Cloud Google Drive) -> Quotation Builder (Kalkulasi SPH & Pemilih Multi-Barang) -> Pengiriman Email Penawaran PDF Resmi**.

---

## 🌟 Fitur Utama Sistem

1. **RFQ Inbox & Live Gmail IMAP Reader**:
   - Integrasi langsung dengan Live Gmail IMAP (`mijdigital2026@gmail.com`).
   - Filter otomatis email RFQ klien terdeteksi (*Primary RFQ*) vs email umum.
   - Pratinjau lampiran ganda langsung di tempat (*Lightbox Viewer* untuk PDF & Gambar PNG/JPG).

2. **Katalog Produk Master & Upload Foto Produk**:
   - Tampilan tabel full-width skeuomorphic ala iTunes Classic (anti-ribet & muat banyak data).
   - Kolom lengkap: Kode Barang, Nama Produk & Spesifikasi, Kategori, Stok (`stock_quantity`), Satuan, Harga Master resmi, dan Diskon Maksimal (%).
   - Dukungan unggah foto produk langsung ke folder fisik `public/uploads/products/` dan link database MySQL.

3. **Google Drive Cloud Sync & Deteksi Konflik (Conflict Resolver)**:
   - Sinkronisasi otomatis data katalog produk ke Google Drive Cloud Backup.
   - Fitur deteksi otomatis jika terjadi perbedaan data antara Drive dan MySQL lokal, lengkap dengan tombol pilihan eksekusi: **"Gunakan Versi MySQL Lokal (Timpa Drive)"** atau **"Gunakan Versi Google Drive (Tarik ke MySQL)"**.

4. **Quotation Builder & Pop-Up Pemilih Multi-Barang (Multi-Select)**:
   - Form pembuatan Surat Penawaran Harga (SPH) interaktif dengan kalkulasi PPN (11%), diskon, dan subtotal otomatis.
   - **Pop-Up Pemilih Multi-Barang**: Pilih banyak produk sekaligus dari master database katalog untuk langsung dimasukkan ke tabel SPH.
   - **Manual Price Entry (Prinsip Harga 0)**: Barang tanpa harga akan disorot warna kuning terkhusus untuk diisi manual atau ditarik dari katalog produk.
   - **Gemini Flash AI OCR Scanner**: Pemindaian teks spesifikasi file PDF RFQ secara otomatis menggunakan AI.

5. **Tabel Quotation Data & Filter Phase (Siap Kirim)**:
   - Tab filter khusus: **Quotation Build (Siap Kirim)** untuk mengelompokkan penawaran yang sudah melewati proses pembangun SPH dan siap dikirim ke klien.

6. **Proteksi Pemulihan Komponen (`ErrorBoundary`)**:
   - Dilengkapi sistem pengaman React `ErrorBoundary` sehingga aplikasi tidak akan pernah mengalami *blank screen*. Jika terjadi kendala runtime di browser, sistem menampilkan kartu pemulihan otomatis beserta rincian error.

---

## 🛠️ Arsitektur & Tech Stack

- **Frontend UI:** React 18 + **TypeScript** (`strict mode`) + Vite 5 + Tailwind CSS.
- **Backend API:** Native PHP Engine (`C:\xampp\php\php.exe`) — Kompatibel 100% dengan **Shared Hosting PHP / cPanel**.
- **Database Engine:** MySQL (`127.0.0.1:3306`, Database: `abmalaya_erp`).
- **Live Email Sync:** PHP IMAP SSL SSL (`imap.gmail.com:993`).
- **Icons & Typography:** Lucide React Icons (0% Emoji) + Font Inter & Roboto.

---

## 📁 Struktur Direktori Proyek

```text
erp-abmalaya/
├── cpanel/
│   └── database_schema.sql         # Skema database MySQL abmalaya_erp
├── public/
│   ├── api_fetch_live_gmail.php    # Endpoint Live IMAP Gmail reader & background sync
│   ├── api_gmail_webhook.php       # Webhook endpoint untuk menerima notifikasi Google Pub/Sub
│   ├── api_quotations.php          # Endpoint MySQL CRUD SPH Quotations
│   ├── api_products.php            # Endpoint Master Produk & Upload Foto
│   ├── api_gdrive_sync.php         # Endpoint Google Drive Cloud Sync & Conflict Resolver
│   ├── api_pdf_ocr.php             # Endpoint Gemini AI PDF OCR Scanner
│   └── uploads/products/           # Direktori penyimpanan fisik foto produk
├── resources/
│   ├── css/
│   │   └── app.css                 # Tailwind CSS & Print styles
│   └── js/
│       ├── components/
│       │   ├── RFQInbox.tsx        # Dashboard RFQ Inbox + Lightbox Attachments + AI Summary/Logs
│       │   ├── ProductCatalog.tsx  # Tabel Katalog Produk + Upload Foto + GDrive Sync
│       │   ├── QuotationBuilder.tsx# Form SPH + Multi-Select Product Picker Modal
│       │   ├── QuotationList.tsx   # Tabel Rekam Data SPH + Filter Siap Kirim
│       │   ├── QuotationDoc.tsx    # Template Cetak SPH PDF Resmi
│       │   ├── EmailReplyModal.tsx # Modal Balasan Email SPH
│       │   ├── Header.tsx          # Topbar Navigation Metrics
│       │   └── Sidebar.tsx         # Sidebar Menu Neumorphic Soft-UI
│       ├── types/
│       │   └── erp.ts              # Definisi Tipe TypeScript Ketat (Anti-Bug)
│       ├── App.tsx                 # Entrypoint Utama SPA + React ErrorBoundary
│       └── main.tsx                # Mount React DOM
├── .gitignore                      # Proteksi AGENTS.md, .env, & uploads dari Git Commit
├── deploy_ftp.php                  # Skrip deployment otomatis FTP menggunakan PHP
├── package.json                    # Konfigurasi dependensi React & Vite
└── README.md                       # Dokumentasi Proyek
```

---

## 🖥️ Cara Menjalankan di Komputer Lokal

Jika perintah `php` atau `npm` tidak dikenali oleh sistem PATH Anda, gunakan alamat absolut executable bawaan XAMPP dan Node.js berikut:

1. **Jalankan Backend PHP Server (Port 8000):**
   ```powershell
   & "C:\xampp\php\php.exe" -S localhost:8000 -t public
   ```

2. **Jalankan Vite Dev Server (Port 5173):**
   ```powershell
   & "C:\Users\ilhampradani\.gemini\antigravity-ide\scratch\node\node-v20.18.0-win-x64\node.exe" node_modules\vite\bin\vite.js --host
   ```

3. **Jalankan Sinkronisasi AI Latar Belakang (Background Scan):**
   ```powershell
   & "C:\xampp\php\php.exe" public/api_fetch_live_gmail.php bg_scan=1
   ```

4. **Jalankan Deployment FTP Otomatis:**
   ```powershell
   & "C:\xampp\php\php.exe" deploy_ftp.php
   ```

5. **Buka Aplikasi di Browser:**
   👉 `http://localhost:5173`

---

## 🔒 Aturan Push Git & FTP Deployment

- Proses **FTP Upload** dan **GitHub Push** hanya boleh dipicu apabila ada permintaan eksplisit dari pengguna. Jangan lakukan otomatisasi deploy tanpa instruksi.

---

## 🔒 Proteksi Keamanan Git Repository

File sensitif **`AGENTS.md`** (berisi kredensial live IMAP & database) telah dimasukkan ke dalam `.gitignore` sehingga **TIDAK AKAN TERNIKAT/TERPUSH** saat Anda menyambungkan repositori ini ke GitHub nanti.
