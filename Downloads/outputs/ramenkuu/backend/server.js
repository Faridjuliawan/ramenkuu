require('dotenv').config();
const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ramenkuu-secret-key-2024';

// ─── SSE Clients ──────────────────────────────────────────────────────────────
const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => client.write(msg));
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Database Setup ───────────────────────────────────────────────────────────
const db = new Database(process.env.DB_PATH || 'ramenkuu.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Init Tables ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    email     TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,
    role      TEXT NOT NULL CHECK(role IN ('owner','kasir')),
    active    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS menu (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    price       REAL NOT NULL,
    description TEXT,
    available   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code  TEXT UNIQUE NOT NULL,
    table_no    TEXT,
    customer_name TEXT,
    status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','ready','done','cancelled')),
    note        TEXT,
    total       REAL NOT NULL DEFAULT 0,
    kasir_id    INTEGER REFERENCES users(id),
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id  INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_id   INTEGER NOT NULL REFERENCES menu(id),
    menu_name TEXT NOT NULL,
    price     REAL NOT NULL,
    qty       INTEGER NOT NULL DEFAULT 1,
    subtotal  REAL NOT NULL,
    note      TEXT
  );
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────
function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const hashOwner = bcrypt.hashSync('owner123', 10);
    const hashKasir = bcrypt.hashSync('kasir123', 10);
    db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)`).run('Owner RamenKuu', 'owner@ramenkuu.com', hashOwner, 'owner');
    db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)`).run('Kasir 1', 'kasir@ramenkuu.com', hashKasir, 'kasir');
    console.log('✅ Default users created');
  }

  const menuCount = db.prepare('SELECT COUNT(*) as c FROM menu').get().c;
  if (menuCount === 0) {
    const menus = [
      ['Ramen Tonkotsu', 'Ramen', 45000, 'Kuah babi kaya, telur, chashu'],
      ['Ramen Shoyu', 'Ramen', 42000, 'Kuah kecap asin, ayam, nori'],
      ['Ramen Miso', 'Ramen', 43000, 'Kuah miso, jagung, butter'],
      ['Ramen Spicy', 'Ramen', 45000, 'Kuah pedas level 1-5'],
      ['Gyoza (5 pcs)', 'Side Dish', 20000, 'Pangsit panggang isi daging'],
      ['Karaage', 'Side Dish', 25000, 'Ayam goreng Jepang'],
      ['Takoyaki (6 pcs)', 'Side Dish', 22000, 'Bola gurita'],
      ['Es Teh Jepang', 'Minuman', 12000, 'Teh hijau dingin'],
      ['Ramune', 'Minuman', 18000, 'Soda Jepang'],
      ['Jus Jeruk', 'Minuman', 15000, 'Jus segar'],
    ];
    const ins = db.prepare(`INSERT INTO menu (name, category, price, description) VALUES (?,?,?,?)`);
    menus.forEach(m => ins.run(...m));
    console.log('✅ Default menu created');
  }
}
seedData();

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'Token tidak ada' });
    const token = header.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Akses ditolak' });
      }
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Token tidak valid' });
    }
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function genOrderCode() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `RK-${ymd}-${rand}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: '🍜 RamenKuu Server is running!', version: '1.0.0' });
});

// ── SSE Stream ────────────────────────────────────────────────────────────────
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email & password wajib diisi' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user) return res.status(401).json({ error: 'Email tidak ditemukan' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Password salah' });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    message: 'Login berhasil',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.get('/auth/me', authMiddleware(), (req, res) => {
  res.json({ user: req.user });
});

// ── USERS (owner only) ────────────────────────────────────────────────────────
app.get('/users', authMiddleware(['owner']), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, active, created_at FROM users').all();
  res.json(users);
});

app.post('/users', authMiddleware(['owner']), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Semua field wajib diisi' });
  if (!['owner','kasir'].includes(role)) return res.status(400).json({ error: 'Role harus owner atau kasir' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email sudah digunakan' });

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)').run(name, email, hashed, role);
  res.status(201).json({ message: 'User berhasil dibuat', id: result.lastInsertRowid });
});

app.put('/users/:id', authMiddleware(['owner']), (req, res) => {
  const { name, role, active, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  const newName = name || user.name;
  const newRole = role || user.role;
  const newActive = active !== undefined ? active : user.active;
  const newPassword = password ? bcrypt.hashSync(password, 10) : user.password;

  db.prepare('UPDATE users SET name=?, role=?, active=?, password=? WHERE id=?')
    .run(newName, newRole, newActive, newPassword, req.params.id);
  res.json({ message: 'User berhasil diupdate' });
});

app.delete('/users/:id', authMiddleware(['owner']), (req, res) => {
  if (req.user.id == req.params.id) return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'User berhasil dinonaktifkan' });
});

// ── MENU ──────────────────────────────────────────────────────────────────────
app.get('/menu', (req, res) => {
  const { category, available } = req.query;
  let query = 'SELECT * FROM menu WHERE 1=1';
  const params = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (available !== undefined) { query += ' AND available = ?'; params.push(available === 'true' ? 1 : 0); }
  query += ' ORDER BY category, name';
  res.json(db.prepare(query).all(...params));
});

app.get('/menu/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM menu WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu tidak ditemukan' });
  res.json(item);
});

app.post('/menu', authMiddleware(['owner']), (req, res) => {
  const { name, category, price, description } = req.body;
  if (!name || !category || !price) return res.status(400).json({ error: 'name, category, price wajib diisi' });
  const result = db.prepare('INSERT INTO menu (name, category, price, description) VALUES (?,?,?,?)')
    .run(name, category, price, description || '');
  res.status(201).json({ message: 'Menu berhasil ditambah', id: result.lastInsertRowid });
});

app.put('/menu/:id', authMiddleware(['owner']), (req, res) => {
  const item = db.prepare('SELECT * FROM menu WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Menu tidak ditemukan' });
  const { name, category, price, description, available } = req.body;
  db.prepare('UPDATE menu SET name=?, category=?, price=?, description=?, available=? WHERE id=?')
    .run(name||item.name, category||item.category, price||item.price, description||item.description, available !== undefined ? available : item.available, req.params.id);
  res.json({ message: 'Menu berhasil diupdate' });
});

app.delete('/menu/:id', authMiddleware(['owner']), (req, res) => {
  db.prepare('UPDATE menu SET available = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Menu dinonaktifkan' });
});

// ── ORDERS ────────────────────────────────────────────────────────────────────
app.get('/orders', authMiddleware(), (req, res) => {
  const { status, date } = req.query;
  let query = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  if (date) { query += ' AND date(created_at) = ?'; params.push(date); }
  query += ' ORDER BY created_at DESC';
  const orders = db.prepare(query).all(...params);

  // attach items
  const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const result = orders.map(o => ({ ...o, items: getItems.all(o.id) }));
  res.json(result);
});

app.get('/orders/:id', authMiddleware(), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ ...order, items });
});

app.post('/orders', (req, res) => {
  // endpoint ini bisa dipanggil tanpa login (dari app order pelanggan)
  const { table_no, customer_name, note, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items tidak boleh kosong' });
  }

  // validasi & hitung total
  let total = 0;
  const enrichedItems = [];
  for (const item of items) {
    const menu = db.prepare('SELECT * FROM menu WHERE id = ? AND available = 1').get(item.menu_id);
    if (!menu) return res.status(400).json({ error: `Menu id ${item.menu_id} tidak ditemukan` });
    const qty = item.qty || 1;
    const subtotal = menu.price * qty;
    total += subtotal;
    enrichedItems.push({ menu_id: menu.id, menu_name: menu.name, price: menu.price, qty, subtotal, note: item.note || '' });
  }

  const order_code = genOrderCode();
  const createOrder = db.transaction(() => {
    const res = db.prepare('INSERT INTO orders (order_code, table_no, customer_name, note, total) VALUES (?,?,?,?,?)')
      .run(order_code, table_no || '', customer_name || '', note || '', total);
    const orderId = res.lastInsertRowid;
    const insItem = db.prepare('INSERT INTO order_items (order_id, menu_id, menu_name, price, qty, subtotal, note) VALUES (?,?,?,?,?,?,?)');
    enrichedItems.forEach(i => insItem.run(orderId, i.menu_id, i.menu_name, i.price, i.qty, i.subtotal, i.note));
    return orderId;
  });

  const orderId = createOrder();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  broadcast('new_order', {
    id: order.id,
    order_code: order.order_code,
    table_no: order.table_no,
    customer_name: order.customer_name,
    total: order.total,
    item_count: orderItems.length,
    items: orderItems.map(i => ({ name: i.menu_name, qty: i.qty }))
  });

  res.status(201).json({ message: 'Order berhasil dibuat', order: { ...order, items: orderItems } });
});

app.put('/orders/:id/status', authMiddleware(['owner','kasir']), (req, res) => {
  const { status } = req.body;
  const validStatus = ['pending','processing','ready','done','cancelled'];
  if (!validStatus.includes(status)) return res.status(400).json({ error: 'Status tidak valid' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

  db.prepare("UPDATE orders SET status=?, kasir_id=?, updated_at=datetime('now','localtime') WHERE id=?")
    .run(status, req.user.id, req.params.id);

  broadcast('order_status', { order_code: order.order_code, status });

  res.json({ message: `Status order diupdate ke ${status}` });
});

app.delete('/orders/:id', authMiddleware(['owner']), (req, res) => {
  db.prepare("UPDATE orders SET status='cancelled', updated_at=datetime('now','localtime') WHERE id=?").run(req.params.id);
  res.json({ message: 'Order dibatalkan' });
});

// ── DASHBOARD (owner) ─────────────────────────────────────────────────────────
app.get('/dashboard', authMiddleware(['owner']), (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const todayOrders   = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=? AND status != 'cancelled'").get(targetDate).c;
  const todayRevenue  = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE date(created_at)=? AND status='done'").get(targetDate).s;
  const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status IN ('pending','processing')").get().c;
  const totalMenu     = db.prepare("SELECT COUNT(*) as c FROM menu WHERE available=1").get().c;
  const totalUsers    = db.prepare("SELECT COUNT(*) as c FROM users WHERE active=1").get().c;

  const recentOrders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 10").all();
  const topMenu = db.prepare(`
    SELECT menu_name, SUM(qty) as total_qty, SUM(subtotal) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE date(o.created_at) = ? AND o.status != 'cancelled'
    GROUP BY menu_name ORDER BY total_qty DESC LIMIT 5
  `).all(targetDate);

  res.json({
    date: targetDate,
    summary: { todayOrders, todayRevenue, pendingOrders, totalMenu, totalUsers },
    recentOrders,
    topMenu
  });
});

// ─── Serve Frontend Files ─────────────────────────────────────────────────────
const frontendPosPath = path.join(__dirname, '../frontend-pos/index.html');
const frontendOrderPath = path.join(__dirname, '../frontend-order/index.html');

app.get('/pos', (req, res) => res.sendFile(frontendPosPath));
app.get('/order', (req, res) => res.sendFile(frontendOrderPath));
app.get('/', (req, res) => res.redirect('/order'));

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🍜 RamenKuu Server running on port ${PORT}`);
  console.log(`   Owner login  : owner@ramenkuu.com / owner123`);
  console.log(`   Kasir login  : kasir@ramenkuu.com / kasir123`);
});
