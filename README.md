# 🍜 RamenKuu

Sistem pemesanan dan kasir berbasis web untuk restoran RamenKuu.

## Struktur Repo

```
ramenkuu/
├── backend/          ← Server Node.js + SQLite (deploy ke Railway)
├── frontend-order/   ← App Order untuk pelanggan (buka di browser/tablet meja)
└── frontend-pos/     ← App POS untuk kasir & owner
```

## Cara Deploy

### 1. Backend → Railway

```bash
cd backend
git init
git add .
git commit -m "init backend"
```

Lalu di Railway:
1. New Project → Deploy from GitHub → pilih repo ini
2. Set **Root Directory** ke `backend`
3. Tambahkan Variable: `JWT_SECRET=random_string_panjang`
4. Generate domain → catat URL-nya (contoh: `https://ramenkuu-xxxx.up.railway.app`)

### 2. Update URL API di Frontend

Buka kedua file berikut, cari baris `const API_BASE` dan ganti URL:

- `frontend-order/index.html`
- `frontend-pos/index.html`

```js
const API_BASE = 'https://ramenkuu-xxxx.up.railway.app'; // ganti dengan URL Railway Anda
```

### 3. Frontend → GitHub Pages / Netlify / Vercel (gratis)

Untuk `frontend-order` dan `frontend-pos`, cukup upload file HTML-nya ke hosting statis pilihan Anda.

**Opsi paling mudah — Netlify Drop:**
1. Buka https://app.netlify.com/drop
2. Drag & drop folder `frontend-order` → dapat URL untuk pelanggan
3. Drag & drop folder `frontend-pos` → dapat URL untuk kasir

---

## Akun Default

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Owner | owner@ramenkuu.com     | owner123   |
| Kasir | kasir@ramenkuu.com     | kasir123   |

> Ganti password setelah pertama login via endpoint `PUT /users/:id`

---

## Fitur

### App Order (Pelanggan)
- Lihat menu dengan filter kategori
- Tambah item ke keranjang
- Isi nomor meja & nama pemesan
- Submit order → dapat kode order

### App POS (Kasir / Owner)
- Login dengan akun kasir atau owner
- Lihat semua order real-time (auto refresh 30 detik)
- Update status order: Pending → Proses → Siap → Selesai
- **Owner:** Dashboard penjualan harian & menu terlaris
- **Owner:** Kelola menu (tambah, edit, nonaktifkan)

---

## API Endpoints

Lihat dokumentasi lengkap di `backend/README.md`
