# Panduan Publikasi Aplikasi GELORA 26 ke Siswa melalui Netlify

Aplikasi **GELORA 26 (Gebyar Literasi & Numerasi SMP Negeri 26 Sijunjung)** telah dikonfigurasi secara khusus agar **100% kompatibel dan siap di-deploy ke Netlify**, baik melalui GitHub maupun melalui unggahan file (Netlify Drop).

---

## 📌 Mengapa Sebelumnya Gagal di Netlify?
1. **Belum Ada File Konfigurasi Netlify (`netlify.toml`):**
   Netlify memerlukan instruksi build agar tahu perintah build (`npm run build`), folder output (`dist`), serta versi Node.js yang sesuai (Node 22).
2. **Missing Rule Redirect SPA (`/* /index.html 200`):**
   Tanpa file `_redirects` atau `netlify.toml`, saat siswa merefresh halaman atau mengakses link, Netlify akan menampilkan pesan *404 Page Not Found*.
3. **Mengunggah Folder Mentah ke Netlify Drop:**
   Jika kode di-download langsung dari AI Studio (berisi file `package.json`, `src/`, dll.), Netlify Drop akan menolak karena Netlify Drop hanya menerima **folder hasil build (`dist`)** yang berisi `index.html`.
4. **Backend API di Netlify (Sudah Diperbaiki!):**
   Sebelumnya login peserta memanggil server Express lokal (`/api/auth/login`). Karena Netlify adalah hosting web statis, pemanggilan API tersebut gagal. **Kini aplikasi sudah dilengkapi Dual-Mode Engine**: aplikasi secara otomatis menggunakan database lokal di browser siswa jika server backend tidak tersedia, sehingga siswa tetap bisa login, mengerjakan soal 4 babak, menghitung skor realtime, dan melihat peringkat tanpa kendala apa pun!

---

## 🚀 Cara 1: Deploy Otomatis via GitHub (Sangat Disarankan)

Metode ini paling praktis karena setiap pembaruan kode di GitHub akan otomatis di-build oleh Netlify:

1. **Upload / Push Kode ke GitHub Anda:**
   - Buat repositori baru di GitHub (misal: `gelora26-smpn26`).
   - Push seluruh file kode dari AI Studio ke repositori tersebut.
2. **Buka Akun Netlify:**
   - Buka [app.netlify.com](https://app.netlify.com/) dan login (bisa login menggunakan akun GitHub).
3. **Tambahkan Proyek:**
   - Klik tombol **"Add new site"** -> **"Import an existing project"**.
   - Pilih **GitHub**, lalu pilih repositori `gelora26-smpn26`.
4. **Pengaturan Build (Sudah Otomatis Terdeteksi):**
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   *(Pengaturan ini otomatis dibaca dari file `netlify.toml` yang sudah kami sediakan).*
5. **Klik "Deploy Site":**
   - Tunggu sekitar 1-2 menit hingga proses build selesai.
   - Netlify akan memberikan URL live resmi, misalnya: `https://gelora26-smpn26.netlify.app`.
6. **Selesai!** Bagikan link tersebut ke siswa.

---

## 📦 Cara 2: Deploy Manual via Netlify Drop (Tanpa GitHub)

Jika Anda mengunduh kode (ZIP) ke laptop/komputer dan ingin langsung mengunggahnya ke Netlify:

1. **Ekstrak File ZIP** di laptop Anda.
2. **Buka Terminal / Command Prompt** di dalam folder hasil ekstrak tersebut.
3. **Jalankan Perintah Build:**
   ```bash
   npm install
   npm run build
   ```
   *(Perintah ini akan membuat folder baru bernama `dist` yang berisi file HTML, JS, dan aset siap pakai).*
4. **Buka Netlify Drop di Browser:**
   - Buka [app.netlify.com/drop](https://app.netlify.com/drop).
5. **Drag & Drop Folder `dist`:**
   - **PENTING:** Tarik dan lepas **hanya folder `dist`** ke area kotak Netlify Drop. Jangan menarik file ZIP atau folder utama!
6. Web Anda langsung live dalam beberapa detik dan siap dibagikan ke siswa!

---

## 📱 Panduan Siswa Saat Membuka Aplikasi

1. Siswa membuka URL Netlify dari HP (Android / iPhone) atau laptop melalui Google Chrome / Safari.
2. Pilih tab **"Peserta Siswa"**.
3. Masukkan **Nomor Peserta** (Contoh: `G26-001` s.d. `G26-020`).
4. Masukkan **PIN** (Standar: `1234`).
5. Klik **"Mulai Kerjakan Soal"**.
6. Siswa langsung mengerjakan paket soal babak yang sedang aktif (Pilihan Ganda Tunggal, Pilihan Ganda Kompleks, Benar/Salah, dan Menjodohkan).
7. Nilai, analisis jawaban benar/salah, dan peringkat akan langsung terhitung seketika!

---

## 🔑 Login Panitia / Guru
- Masuk ke tab **"Panitia Lomba"**.
- Masukkan password: `admin` atau `gelora26`.
- Panitia dapat:
  - Mengatur babak aktif (Penyisihan, 30 Besar, Semifinal, Grand Final).
  - Mengubah, menambah, atau menghapus soal dan kunci jawaban.
  - Menambah nomor peserta baru atau mengimpor data siswa.
  - Membuka **Mode Proyektor Layar Penuh** untuk ditampilkan di infocus aula sekolah.
  - Mengunduh / memulihkan file backup database (`gelora26_backup.json`).

---

## 💡 Mode Server Terpusat (Opsional untuk Real-Time Aula Sekolah)
Jika panitia ingin seluruh HP siswa di kelas/aula terhubung secara real-time ke 1 proyektor guru:
1. Jalankan `npm run start` di laptop panitia yang terhubung ke Wi-Fi sekolah yang sama.
2. Buka menu Panitia -> **"Publikasi Netlify & Server"**.
3. Masukkan IP laptop panitia (contoh: `http://192.168.1.50:3000`) pada kolom **Server Terpusat**.
4. Semua jawaban dan skor siswa dari Netlify akan langsung tersinkronisasi ke laptop proyektor panitia secara live!
