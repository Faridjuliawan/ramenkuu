# 🍜 RamenKuu Server

Backend API untuk aplikasi **RamenKuu Order** dan **RamenKuu POS**.

---

## 🚀 Deploy ke Railway (Step by Step)

### 1. Buat akun Railway
Buka https://railway.app → Sign up dengan GitHub

### 2. Upload ke GitHub dulu
```bash
# Di folder ramenkuu-server:
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/USERNAME/ramenkuu-server.git
git push -u origin main
```

### 3. Deploy di Railway
1. Buka https://railway.app/new
2. Pilih **"Deploy from GitHub repo"**
3. Pilih repo `ramenkuu-server`
4. Railway otomatis detect Node.js dan deploy

### 4. Set Environment Variable di Railway
Di dashboard Railway → project → **Variables** → tambahkan:
```
JWT_SECRET = isi_dengan_random_string_panjang
```

### 5. Dapatkan URL publik
Railway → project → **Settings** → **Domains** → Generate Domain

URL Anda akan berbentuk: `https://ramenkuu-server-xxxx.railway.app`

---

## 🔐 Akun Default

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Owner | owner@ramenkuu.com     | owner123   |
| Kasir | kasir@ramenkuu.com     | kasir123   |

> **Ganti password setelah pertama login!**

---

## 📡 API Endpoints

### Auth
| Method | Endpoint       | Akses  | Keterangan         |
|--------|----------------|--------|--------------------|
| POST   | /auth/login    | Publik | Login, dapat token |
| GET    | /auth/me       | Login  | Info user aktif    |

**Login request:**
```json
POST /auth/login
{
  "email": "owner@ramenkuu.com",
  "password": "owner123"
}
```
**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": { "id": 1, "name": "Owner RamenKuu", "role": "owner" }
}
```

> Untuk endpoint yang butuh login, tambahkan header:
> `Authorization: Bearer <token>`

---

### Menu
| Method | Endpoint       | Akses  | Keterangan              |
|--------|----------------|--------|-------------------------|
| GET    | /menu          | Publik | List semua menu         |
| GET    | /menu/:id      | Publik | Detail menu             |
| POST   | /menu          | Owner  | Tambah menu baru        |
| PUT    | /menu/:id      | Owner  | Edit menu               |
| DELETE | /menu/:id      | Owner  | Nonaktifkan menu        |

**Query params GET /menu:**
- `?category=Ramen` — filter by kategori
- `?available=true` — filter yang tersedia saja

---

### Orders
| Method | Endpoint              | Akses       | Keterangan           |
|--------|-----------------------|-------------|----------------------|
| GET    | /orders               | Login       | List semua order     |
| GET    | /orders/:id           | Login       | Detail order         |
| POST   | /orders               | **Publik**  | Buat order baru      |
| PUT    | /orders/:id/status    | Kasir/Owner | Update status order  |
| DELETE | /orders/:id           | Owner       | Batalkan order       |

**Buat order baru (dari app pelanggan):**
```json
POST /orders
{
  "table_no": "5",
  "customer_name": "Budi",
  "note": "Tidak pakai bawang",
  "items": [
    { "menu_id": 1, "qty": 2, "note": "extra chashu" },
    { "menu_id": 5, "qty": 1 }
  ]
}
```

**Status order yang valid:**
`pending` → `processing` → `ready` → `done` / `cancelled`

---

### Users (Owner only)
| Method | Endpoint    | Akses | Keterangan           |
|--------|-------------|-------|----------------------|
| GET    | /users      | Owner | List semua user      |
| POST   | /users      | Owner | Tambah kasir/owner   |
| PUT    | /users/:id  | Owner | Edit user            |
| DELETE | /users/:id  | Owner | Nonaktifkan user     |

---

### Dashboard (Owner only)
| Method | Endpoint    | Akses | Keterangan              |
|--------|-------------|-------|-------------------------|
| GET    | /dashboard  | Owner | Ringkasan hari ini      |

**Query:** `?date=2024-01-15` (opsional, default hari ini)

**Response:**
```json
{
  "summary": {
    "todayOrders": 12,
    "todayRevenue": 540000,
    "pendingOrders": 3,
    "totalMenu": 10,
    "totalUsers": 2
  },
  "topMenu": [...],
  "recentOrders": [...]
}
```

---

## 🔧 Jalankan Lokal (untuk testing)

```bash
# Install dependencies
npm install

# Buat file .env
cp .env.example .env

# Jalankan server
npm start

# Atau dengan auto-reload
npm run dev
```

Server berjalan di: http://localhost:3000

---

## 📁 Struktur File

```
ramenkuu-server/
├── server.js        ← Backend utama
├── package.json     ← Dependencies
├── railway.toml     ← Config Railway
├── .env.example     ← Template env vars
├── .gitignore
└── README.md
```
