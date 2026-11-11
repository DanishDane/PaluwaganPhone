// Seed script with realistic iPhone Paluwagan data
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'paluphone.db');
const db = new DatabaseSync(DB_FILE);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS sellers (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT, pass TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, role TEXT NOT NULL, ref TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pgroups (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, model TEXT NOT NULL, variant TEXT, storage TEXT, color TEXT, color_hex TEXT,
  price REAL NOT NULL, slots INTEGER NOT NULL, monthly REAL NOT NULL, start_month TEXT NOT NULL,
  grace_days INTEGER NOT NULL DEFAULT 5, fine_amount REAL NOT NULL DEFAULT 0, fine_per_day REAL NOT NULL DEFAULT 0,
  notes TEXT, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES pgroups(id) ON DELETE CASCADE,
  name TEXT NOT NULL, phone TEXT NOT NULL, pin TEXT NOT NULL, payout_order INTEGER NOT NULL,
  address TEXT, notes TEXT, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES pgroups(id) ON DELETE CASCADE,
  period TEXT NOT NULL, amount REAL NOT NULL, fine REAL NOT NULL DEFAULT 0, paid_on TEXT NOT NULL,
  method TEXT, ref TEXT, note TEXT, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS waivers (
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE, period TEXT NOT NULL, reason TEXT,
  PRIMARY KEY (member_id, period));
CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES pgroups(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  period TEXT NOT NULL, released_on TEXT NOT NULL, imei TEXT, note TEXT);
`);

const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(String(pw), salt, 64).toString('hex');
const now = new Date().toISOString();

// Create admin
db.prepare('INSERT OR REPLACE INTO sellers (id, username, name, pass) VALUES (?, ?, ?, ?)').run(
  1,
  'admin',
  'Boss Danish',
  hash('admin123')
);

db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('business_name', 'iPaluwagan PH')").run();
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('tagline', 'Original iPhones on Flexible Terms')").run();
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('default_grace', '5')").run();
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('default_fine', '150')").run();
db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('default_fine_per_day', '10')").run();

// Group 1: iPhone 11 (12 Members)
db.prepare(`INSERT OR REPLACE INTO pgroups 
  (id, name, model, variant, storage, color, color_hex, price, slots, monthly, start_month, grace_days, fine_amount, fine_per_day, notes, created)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  1,
  'iPhone 11 — 128GB (Batch 1)',
  'iPhone 11',
  '100% Battery · FU',
  '128GB',
  'Black',
  '#1f1f22',
  24000,
  12,
  2000,
  '2026-06',
  5,
  150,
  10,
  'Official 12-member group for iPhone 11. Due every month-end, grace until 5th.',
  now
);

// Members for Group 1
const membersG1 = [
  { name: 'Maria Santos', phone: '09171234501', pin: '1234', order: 1 },
  { name: 'Juan Dela Cruz', phone: '09171234502', pin: '1234', order: 2 },
  { name: 'Alyssa Valdez', phone: '09171234503', pin: '1234', order: 3 },
  { name: 'Mark Anthony Reyes', phone: '09171234504', pin: '1234', order: 4 },
  { name: 'Cristina Mendoza', phone: '09171234505', pin: '1234', order: 5 },
  { name: 'Paulo Avelino', phone: '09171234506', pin: '1234', order: 6 },
  { name: 'Bea Alonzo', phone: '09171234507', pin: '1234', order: 7 },
  { name: 'Daniel Padilla', phone: '09171234508', pin: '1234', order: 8 },
  { name: 'Kathryn Bernardo', phone: '09171234509', pin: '1234', order: 9 },
  { name: 'Enrique Gil', phone: '09171234510', pin: '1234', order: 10 },
  { name: 'Liza Soberano', phone: '09171234511', pin: '1234', order: 11 },
  { name: 'James Reid', phone: '09171234512', pin: '1234', order: 12 },
];

let mid = 1;
for (const m of membersG1) {
  db.prepare(`INSERT OR REPLACE INTO members 
    (id, group_id, name, phone, pin, payout_order, address, notes, created)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    mid++,
    1,
    m.name,
    m.phone,
    hash(m.pin),
    m.order,
    'Metro Manila',
    'Verified Buyer',
    now
  );
}

// Group 2: iPhone 13 Pro (10 Members)
db.prepare(`INSERT OR REPLACE INTO pgroups 
  (id, name, model, variant, storage, color, color_hex, price, slots, monthly, start_month, grace_days, fine_amount, fine_per_day, notes, created)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  2,
  'iPhone 13 Pro — Sierra Blue (Batch 2)',
  'iPhone 13 Pro',
  '90% BH · Complete Box',
  '256GB',
  'Sierra Blue',
  '#a7c1d9',
  38000,
  10,
  3800,
  '2026-08',
  5,
  200,
  15,
  'High-tier paluwagan group for 13 Pro.',
  now
);

const membersG2 = [
  { name: 'Sarah Geronimo', phone: '09189876501', pin: '1234', order: 1 },
  { name: 'Matteo Guidicelli', phone: '09189876502', pin: '1234', order: 2 },
  { name: 'Anne Curtis', phone: '09189876503', pin: '1234', order: 3 },
  { name: 'Erwan Heussaff', phone: '09189876504', pin: '1234', order: 4 },
  { name: 'Catriona Gray', phone: '09189876505', pin: '1234', order: 5 },
];

for (const m of membersG2) {
  db.prepare(`INSERT OR REPLACE INTO members 
    (id, group_id, name, phone, pin, payout_order, address, notes, created)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    mid++,
    2,
    m.name,
    m.phone,
    hash(m.pin),
    m.order,
    'BGC, Taguig',
    'VIP member',
    now
  );
}

// Add payments for Group 1 (June, July, August, September, October)
// Months: 2026-06, 2026-07, 2026-08, 2026-09, 2026-10
const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
let pid = 1;

for (let i = 1; i <= 12; i++) {
  for (const m of months) {
    // Maria, Juan, Alyssa have perfect records
    if (i <= 3) {
      db.prepare(`INSERT OR REPLACE INTO payments (id, member_id, group_id, period, amount, fine, paid_on, method, ref, note, created)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        pid++, i, 1, m, 2000, 0, `${m}-28`, 'GCash', `GC-${Math.floor(100000 + Math.random() * 900000)}`, 'On-time hulog', now
      );
    } else if (i === 4) {
      // Mark paid late on July with fine
      const isLate = m === '2026-07';
      db.prepare(`INSERT OR REPLACE INTO payments (id, member_id, group_id, period, amount, fine, paid_on, method, ref, note, created)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        pid++, i, 1, m, 2000, isLate ? 150 : 0, isLate ? `${m}-12` : `${m}-27`, 'Maya', `MY-${Math.floor(100000 + Math.random() * 900000)}`, isLate ? 'Paid with 150 late fee' : 'Hulog', now
      );
    } else if (i <= 8) {
      // Paid up to September, October unpaid
      if (m !== '2026-10') {
        db.prepare(`INSERT OR REPLACE INTO payments (id, member_id, group_id, period, amount, fine, paid_on, method, ref, note, created)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          pid++, i, 1, m, 2000, 0, `${m}-30`, 'Cash', 'Store Cash', 'Counter receipt', now
        );
      }
    }
  }
}

// iPhone 11 Payout releases for turns 1, 2, 3
db.prepare(`INSERT OR REPLACE INTO payouts (id, group_id, member_id, period, released_on, imei, note)
  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  1, 1, 1, '2026-06', '2026-06-30', '356891029384711', 'Claimed at branch with box & receipt'
);
db.prepare(`INSERT OR REPLACE INTO payouts (id, group_id, member_id, period, released_on, imei, note)
  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  2, 1, 2, '2026-07', '2026-07-31', '356891029384712', 'Delivered via Lalamove'
);
db.prepare(`INSERT OR REPLACE INTO payouts (id, group_id, member_id, period, released_on, imei, note)
  VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
  3, 1, 3, '2026-08', '2026-08-31', '356891029384713', 'Claimed by Alyssa'
);

console.log('Database seeded with sample iPhone groups, members, payments, and releases successfully!');
