# WhatsApp Bot Manager & Status Scheduler 🚀

Aplikasi WhatsApp Bot cerdas berbasis **whatsapp-web.js** yang dilengkapi dengan **Dashboard Control Panel Web** interaktif, **Auto-Reply AI**, **Campaign Manager (Broadcast)**, dan **Status Scheduler otomatis (Anti-Bentrok)**.

---

## ✨ Fitur Utama

1. **Dashboard Control Panel:**
    - Tampilan Web UI premium dengan tema gelap (Glassmorphism).
    - Scan QR Code secara real-time langsung dari dashboard.
    - Live console log aktivitas bot.
2. **Live Chats:**
    - Baca dan balas obrolan pelanggan secara real-time langsung dari dashboard panel.
3. **Auto-Reply & AI Assistant:**
    - Auto-reply berdasarkan aturan kata kunci (keyword rules).
    - Asisten AI pintar menggunakan **Google Gemini, OpenAI GPT, atau Claude** yang merotasi API Key secara otomatis jika limit tercapai.
    - Jeda pengetikan alami manusia (_read delay_ dan _typing delay_ dinamis sesuai panjang pesan).
4. **Campaign Manager (Broadcast Massal):**
    - Pengiriman pesan massal terjadwal dengan personalisasi variabel `{name}` dan `{phone}`.
    - Mendukung format **Spintax** (contoh: `{Halo|Hai|Selamat pagi}`) agar isi pesan bervariasi secara acak.
    - **Jeda Aman Acak** (30-60 detik) dan **Batch Cooldown** setiap 10 pesan (60-120 detik) untuk melindungi nomor Anda dari pemblokiran (anti-ban).
5. **Status Scheduler (Penjadwal Status Otomatis & Anti-Bentrok):**
    - Penjadwalan posting status otomatis (teks, gambar, atau video) berbasis ekspresi Cron standar.
    - **Sistem Antrean (Queue System):** Mencegah bentrok eksekusi. Jika ada jadwal status yang berjalan bersamaan atau dipicu instan secara manual, sistem akan mengantre status tersebut dan mempostingnya satu per satu dengan **jeda aman 15 detik**.
    - **Proteksi Bentrok Cron:** Backend menolak pembuatan jadwal aktif baru dengan ekspresi cron yang sama persis untuk mencegah tabrakan eksekusi.

---

## 💻 Cara Menjalankan di Desktop (Windows / Mac / Linux)

### Persyaratan

- Node.js versi `v18.0.0` atau yang lebih tinggi.
- Browser Chrome atau Edge terinstal secara lokal di sistem Anda.

### Langkah-Langkah

1. Clone repositori ini:
    ```bash
    git clone https://github.com/gandisetiawan28/whatsapp-web.js-bot.git
    cd whatsapp-web.js-bot
    ```
2. Pasang semua dependensi proyek:
    ```bash
    npm install
    ```
3. Jalankan server:
    ```bash
    node server.js
    ```
4. Buka browser Anda dan akses alamat:
    ```text
    http://localhost:3000
    ```
5. Scan QR code yang muncul di halaman utama untuk menautkan akun WhatsApp Anda.

---

## 📱 Cara Menjalankan di Android (Termux)

Aplikasi ini telah dioptimalkan secara otomatis untuk berjalan mulus di lingkungan **Termux Android** tanpa grafis (headless) menggunakan browser bawaan Android.

### Langkah-Langkah

1. Instal aplikasi **Termux terbaru** dari **[F-Droid](https://f-droid.org/packages/com.termux/)** _(Jangan gunakan versi Play Store karena sudah usang)_.
2. Buka Termux, pasang `git` dan unduh proyek Anda:
    ```bash
    pkg install git -y
    git clone https://github.com/gandisetiawan28/whatsapp-web.js-bot.git
    cd whatsapp-web.js-bot
    ```
3. Jalankan script installer otomatis yang sudah disediakan:
    ```bash
    bash termux-install.sh
    ```
    _(Script ini akan secara otomatis memperbarui paket Termux, memasang library/repository tambahan, menginstal Node.js & Chromium, mengonfigurasi variabel lingkungan, serta menjalankan `npm install`. Script akan melewati bagian yang sudah terinstal sebelumnya)._
4. Setelah instalasi selesai, jalankan bot dengan perintah:
    ```bash
    node server.js
    ```
5. Buka browser HP Anda (Chrome/Firefox/lainnya) dan akses alamat:
    ```text
    http://localhost:3000
    ```

---

## 📂 Manajemen Folder & Struktur Berkas

- `server.js` - Pintu masuk server utama, mengelola API HTTP Express dan WebSocket Socket.io.
- `services/statusScheduler.js` - Service penanganan cron job penjadwalan status & sistem antrean (Queue).
- `public/` - File antarmuka frontend (HTML, CSS, JS) dashboard bot.
- `status_schedule.json` - Database lokal penyimpan data jadwal status (diabaikan oleh git agar aman).
- `rules.json`, `campaigns.json`, `ai_config.json` - Berkas penyimpanan data auto-reply, kampanye, dan API keys.
- `.gitignore` - Mengabaikan file database lokal dan berkas kredensial sensitif.

---

## 🛠️ Troubleshooting (Penyelesaian Masalah)

### ❌ Error: `cannot download a binary for the provided platform arm64`

Error ini terjadi di Termux karena Puppeteer secara default mencoba mengunduh browser Chromium versi desktop (x86/x64) yang tidak kompatibel dengan arsitektur processor HP (ARM64).

**Cara Mengatasi:**

1. **Pastikan Chromium lokal Termux sudah terpasang:**
    ```bash
    pkg install chromium -y
    ```
2. **Muat ulang konfigurasi file `.bashrc` agar variabel terbaca:**
    ```bash
    source ~/.bashrc
    ```
3. **Atau jalankan bot secara paksa dengan menyertakan variabel secara langsung:**
    ```bash
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true PUPPETEER_EXECUTABLE_PATH=$PREFIX/bin/chromium node server.js
    ```
