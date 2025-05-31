<h1 align="center">Telegram Gemini 👋</h1>
<p align="center">
  <img width="700" align="center" src="https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg" alt="demo"/>
</p>
Bot Telegram yang menggunakan Google Gemini API untuk menjawab pertanyaan dan membuat/mengedit gambar langsung dari Telegram.

## Instalasi dan Penggunaan

### Instalasi di Local/VPS

#### Langkah 1: Clone Repository

```bash
git clone https://github.com/kawainime/TelegramGemini.git
cd TelegramGemini.git
```

#### Langkah 2: Konfigurasi `.env`

1. Salin file contoh environment:

```bash
cp .env.example .env
```

2. Edit file `.env`:

```bash
nano .env
```

Isi dengan token dan API key Anda:

```
TELEGRAM_BOT_TOKEN=
GOOGLE_API_KEY=
GOOGLE_MODEL_TEXT=gemini-2.0-flash
GOOGLE_MODEL_IMAGE=gemini-2.0-flash-preview-image-generation
ADMIN_USER_ID=
DONATION_MESSAGE="<b>Dukung Pengembangan Bot!</b>  \n\nAnda bisa mengirimkan dukungan melalui metode berikut:\n\n<b>Transfer Bank:</b>\nNama Bank: [Nama Bank Anda]\nNomor Rekening: [Nomor Rekening Anda]\nAtas Nama: [Nama Anda]\n\n<b>E-Wallet:</b>\nGoPay/OVO/Dana: [Nomor HP E-wallet Anda]\n\n<i>Terima kasih atas dukungan Anda!</i>"
SAWERIA_LINK="https://saweria.co/" # Opsional, ganti dengan link Saweria Anda
TRAKTEER_LINK="https://trakteer.id/" # Opsional, ganti dengan link Trakteer Anda
KARYAKARSA_LINK="https://karyakarsa.com/" # Opsional, ganti dengan link Karyakarsa Anda
QRIS_IMAGE_URL="https://swamediainc.storage.googleapis.com/swa.co.id/wp-content/uploads/2023/04/27143623/Qris.jpg" # Opsional, ganti dengan URL gambar QRIS Anda
ADMIN_TELEGRAM_USERNAME="GantiUsernameAdmin" # WAJIB: Username Telegram admin tanpa tanda '@'
```

#### Langkah 3: Instal Dependensi

```bash
npm install
```

#### Langkah 4: Jalankan Bot

```bash
node bot.js
```

> **Catatan:** Anda dapat mengedit file `persona.txt` untuk menyesuaikan karakter bot (opsional).

## Cara Penggunaan

Setelah bot aktif, Anda dapat menggunakan perintah berikut di Telegram:

- `/tanya [pertanyaan]` — untuk mengajukan pertanyaan.
- `/gambar [deskripsi gambar]` — untuk membuat gambar dari deskripsi.
- Balas gambar + teks — untuk mengedit gambar.

## More Information
