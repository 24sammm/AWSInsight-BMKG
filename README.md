# Aplikasi Web Data AWS

Aplikasi web sederhana untuk melihat, memfilter, dan mengekspor data observasi Automatic Weather Station (AWS). Semua pemrosesan data dilakukan di browser. Halaman depan dilindungi **login session** (cookie httpOnly) — tombol **Unggah Data** hanya muncul setelah user masuk.

## Struktur

```
index.html        → landing (login) + aplikasi visualisasi (HTML/JS murni, tidak diubah logikanya)
api/login.js      → POST /api/login   : cek email+password, terbitkan session cookie
api/me.js         → GET  /api/me      : cek apakah user sudah login
api/logout.js     → POST /api/logout  : hapus session cookie
api/_auth.js      → helper bersama (kredensial, token HMAC-SHA256, rate limit)
server.js         → server lokal untuk tes (node server.js), tidak dipakai di Vercel
test_auth.js      → tes endpoint auth tanpa dependency (node test_auth.js)
.env.local        → file rahasia lokal (user & kunci), tidak ikut ke GitHub
```

## User & Password

Tidak ada user yang ditulis di kode. Daftar user dibaca dari environment variable `AWS_USERS` dengan format:

```
AWS_USERS=username1:password1,username2:password2
```

Contoh: `AWS_USERS=adminaws1:@adminawsinsight,operator2:PassLain456`

Selain itu wajib mengisi `AWS_SESSION_SECRET` (kalimat acak panjang, dipakai untuk menandatangani cookie session).

## Cara Menjalankan Lokal

Butuh [Node.js](https://nodejs.org). Dari folder proyek:

1. Buka file `.env.local`, isi daftar user (`AWS_USERS`) dan kunci rahasia (`AWS_SESSION_SECRET`) sesuai keinginanmu.
2. Jalankan di terminal: `node server.js`
3. Buka `http://localhost:3000` di browser, login dengan salah satu user di `AWS_USERS`, lalu unggah data.

(Tes endpoint auth saja tanpa browser: `node test_auth.js`)

Catatan: membuka `index.html` langsung via klik dua kali (file://) tidak bisa menjalankan login — alur login membutuhkan server (lokal via `node server.js` atau produksi di Vercel).

## Deploy ke Vercel

Panduan langkah demi langkah (upload ke GitHub, deploy, set environment variables, troubleshooting) ada di file **`PANDUAN_DEPLOY.txt`**.

Ringkasannya:

1. Upload file proyek ke repo GitHub (tanpa `.env.local` dan `PANDUAN_DEPLOY.txt` — keduanya berisi kredensial).
2. Import repo di [vercel.com](https://vercel.com) (paket Hobby gratis cukup — folder `api/` otomatis menjadi Serverless Functions).
3. Di dashboard Vercel → **Settings → Environment Variables**, tambahkan:
   - `AWS_USERS` — daftar user (format di atas)
   - `AWS_SESSION_SECRET` — kalimat acak panjang
4. **Redeploy** (wajib setelah mengisi environment variables).

Selesai — landing page menampilkan form login, dan tombol Unggah hanya muncul setelah login.

Detail keamanan: session berupa cookie `HttpOnly; Secure; SameSite=Lax` bertanda tangan HMAC-SHA256, berlaku 12 jam, tanpa database. Percobaan login dibatasi 10 kali per 10 menit per IP+email.

## Fitur

- **Tampilan per menit, maks per jam, atau maks per hari** untuk semua parameter.
- **Filter Fklim71**: 1 data per waktu observasi (07.00, 13.00, 18.00 UTC) per hari. Bila menit tepat jam observasi kosong/tidak ada, diambil dari menit terdekat maksimal 10 menit sebelumnya (mis. jendela 06.50–07.00).
- **Isi data kosong otomatis** dari menit terdekat (per parameter), sel yang diisi ditandai kuning.
- **Kartu nilai maksimum** semua parameter beserta waktu kejadiannya.
- **Pilihan baris (basket)** dengan centang, lalu ekspor hanya baris pilihan.
- **Ekspor Excel**: sheet data hasil filter + sheet nilai maksimum.

## Syarat File yang Diunggah

Format yang didukung: **.xlsx**, **.xls**, atau **.csv** (sheet pertama yang dibaca).

| Syarat | Keterangan |
|---|---|
| Baris pertama | Berisi nama kolom (header) |
| Kolom waktu | **Wajib.** Nama kolom mengandung kata *tanggal*, *waktu*, *time*, atau *date*. Nilainya berupa salah satu dari: tanggal-waktu Excel (sel bertipe datetime), teks `YYYY-MM-DD HH:MM`, atau teks `DD/MM/YYYY HH:MM` |
| Kolom parameter | Kolom berisi angka, selain kolom waktu/id/nama/latitude/longitude/no, otomatis ditampilkan berapa pun jumlahnya |
| Kolom nama & id | Opsional. Baris pertama data kolom `Nama` dan `Id` ditampilkan di header halaman (mis. nama stasiun) |

### Contoh struktur

| Id | Nama | Latitude | Longitude | Tanggal | rr | ws_avg | ws_max | wd_avg | tt_air_max | tt_air_avg | tt_air_min | rh_avg | pp_air | sr_avg | sr_max | wl | tt_sea |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 327 | Merak | -6.00 | 106.01 | 01/08/2026 00:01 | 0 | 2.1 | 4.3 | 250 | 27.1 | 26.8 | 26.5 | 82 | 1008.2 | 0 | 0 | 1.2 | 29.1 |
| 327 | Merak | -6.00 | 106.01 | 01/08/2026 00:02 | 0 | 2.3 | 4.0 | 248 | 27.1 | 26.9 | 26.6 | 81 | 1008.1 | 0 | 0 | 1.2 | 29.1 |

### Label kolom yang dikenali

| Nama kolom | Label yang tampil |
|---|---|
| `rr` | Curah Hujan (mm) |
| `ws_avg` | Wind Speed Avg (m/s) |
| `ws_max` | Wind Speed Max (m/s) |
| `wd_avg` | Wind Direction (°) |
| `tt_air_max` | Suhu Max (°C) |
| `tt_air_avg` | Suhu Avg (°C) |
| `tt_air_min` | Suhu Min (°C) |
| `rh_avg` | Relatif Humidity (%) |
| `pp_air` | Tekanan Udara (mbar) |
| `sr_avg` | Solar Radiation Avg (W/m²) |
| `sr_max` | Solar Radiation Max (W/m²) |
| `wl` | Water Level (m) |
| `tt_sea` | Water Temp (°C) |

Kolom dengan nama lain tetap ditampilkan memakai nama aslinya.

### Catatan penting

- Aplikasi **tidak terikat pada satu stasiun/bulan tertentu**. Data apa pun dengan format di atas bisa langsung dipakai; rentang tanggal dan tahun pada filter mengikuti isi file yang diunggah.
- Waktu data dianggap dalam **UTC**.
- Baris dengan waktu tidak valid akan dilewati.
- Nilai kosong (`-` pada tabel) tetap kosong bila opsi isi-otomatis dimatikan atau tidak ada data di sekitarnya.
