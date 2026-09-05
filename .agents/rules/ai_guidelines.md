# UNIVERSAL AI GOVERNANCE & DEVELOPMENT GUIDELINES (ERP ABMALAYA)

Dokumen ini adalah standar panduan utama yang bersifat universal dan wajib dipatuhi oleh seluruh Asisten AI (Antigravity/Gemini) dalam sesi pengembangan repositori ini.

---

### I. INTEGRITAS DATABASE & CREDENTIAL SAFETY (PERLINDUNGAN UTAMA)
1. **DILARANG MUTASI DATABASE VIA CLI/SCRIPT**:
   - Dilarang keras memutasi, mengedit, atau menghapus data database (`rfq_requests`, `quotations`, `users`, dll) via script CLI `UPDATE`, `DELETE`, atau `INSERT` sepihak.
   - Perubahan status/data data HANYA boleh terjadi melalui alur resmi interaksi pengguna di aplikasi (User UI).
2. **DILARANG MENGEDIT KREDENSIAL & KONFIGURASI SENSITIF**:
   - Dilarang mengedit/mengubah tabel `api_credentials`, file `.env`, kredensial SMTP/IMAP, atau batas daemon (`SCAN_LIMIT = 1`).
   - Rujukan model AI wajib tetap konsisten pada `gemini-1.5-flash`.
3. **DILARANG FTP PUSH OTOMATIS**:
   - Dilarang mengoperasikan `deploy_ftp.php` atau mengunggah perubahan ke hosting FTP tanpa instruksi langsung dari pengguna.

---

### II. ALUR RESPON & TATA KELOLA INSTRUKSI PENGGUNA
1. **PRINSIP "JELASKAN SEBELUM BERBERTINDAK"**:
   - Jika pengguna bertanya, meminta penjelasan, atau menanyakan alasan (*"jelasin"*, *"kenapa"*, *"apa maksudnya"*), AI wajib memberikan penjelasan tekstual yang jujur, ringkas, dan tepat sasaran TANPA mengedit file atau database secara sepihak.
2. **KEPATUHAN PADA BATASAN SPESIFIK**:
   - Ikuti aturan bisnis, layout boundaries, nama status, dan preferensi teknis persis seperti yang diinstruksikan pengguna tanpa menebak-nebak atau mengubah spesifikasi.

---

### III. INTEGRITAS ARSITEKUTUR KODE & SYSTEM LOGIC
1. **DRY & FILTER SINGLE SOURCE OF TRUTH**:
   - Setiap komponen UI yang memiliki filter daftar (misal: RFQ Inbox, Quotation List) WAJIB menggunakan fungsi filter terpusat yang sama untuk daftar item dan badge counter agar angka badge dan item 100% presisi dan identik.
2. **PENAPISAN STATUS SEPARASI MUTLAK**:
   - Status Inbox Baru / Waiting (`masuk`) HANYA boleh tampil di tab `Received`.
   - Status Pengerjaan SPH (`in_progress`, `quotation_build`, `requisition`) HANYA boleh tampil di tab `In Progress`.
   - Dilarang mencampur status pengerjaan ke dalam inbox `Received`.
3. **PRESERVASI KONTRAK API & BUILD SAFETY**:
   - Jangan merusak signature fungsi, tipe TypeScript, atau API contract yang sudah ada.
   - Wajib memverifikasi bahwa kode dikompilasi dengan bersih (`npm run build`) tanpa error TypeScript sebelum menyelesaikan pekerjaan.

---
*Seluruh AI Assistant wajib mematuhi aturan universal ini tanpa terkecuali.*
