// PaluPhone — iPhone Paluwagan management server
// Run: npm start (Node 22.13+ required for built-in SQLite)

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const L = require('./lib/ledger');

const PORT = Number(process.env.PORT) || 3000;
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
if (!Number.isFinite(SESSION_HOURS) || SESSION_HOURS <= 0) throw new Error('SESSION_HOURS must be a positive number.');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
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

// ---------- helpers ----------
const now = () => new Date().toISOString();
const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(String(pw), salt, 64).toString('hex');
const verify = (pw, stored) => {
  if (!stored || !stored.includes(':')) return false;
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex');
  const b = crypto.scryptSync(String(pw), salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const normPhone = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('63')) d = '0' + d.slice(2);
  if (d.length === 10 && d.startsWith('9')) d = '0' + d;
  return d;
};
const plain = (row) => (row ? { ...row } : row);
const all = (sql, ...a) => db.prepare(sql).all(...a).map(plain);
const one = (sql, ...a) => plain(db.prepare(sql).get(...a));
const run = (sql, ...a) => db.prepare(sql).run(...a);

function getSettings() {
  const s = {
    business_name: 'PaluPhone',
    default_grace: '5',
    default_fine: '100',
    default_fine_per_day: '0',
    currency: 'PHP',
    tagline: 'iPhone Paluwagan',
    gcash_name: '',
    gcash_no: '',
    maya_name: '',
    maya_no: '',
    bank_name: '',
    bank_acc: '',
    payment_instructions: 'After transferring your payment, use Submit payment below to upload your receipt and transaction reference. Your seller will verify the transfer before it is recorded.'
  };
  for (const r of all('SELECT key, value FROM settings')) s[r.key] = r.value;
  return s;
}
function setSetting(k, v) {
  run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, String(v));
}

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
const bad = (msg) => { throw new HttpError(400, msg); };
const num = (v, name, { min = 0, int = false, required = true } = {}) => {
  if ((v === undefined || v === null || v === '') && !required) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) bad(`${name} must be a number`);
  if (int && !Number.isInteger(n)) bad(`${name} must be a whole number`);
  if (n < min) bad(`${name} must be at least ${min}`);
  return n;
};
const str = (v, name, { required = true, max = 200 } = {}) => {
  const s = String(v ?? '').trim();
  if (required && !s) bad(`${name} is required`);
  if (s.length > max) bad(`${name} is too long`);
  return s;
};
const isYm = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

// ---------- data loaders ----------
function loadAll() {
  return {
    groups: all('SELECT * FROM pgroups ORDER BY created DESC'),
    members: all('SELECT id, group_id, name, phone, payout_order, address, notes, created FROM members ORDER BY payout_order'),
    payments: all('SELECT * FROM payments ORDER BY paid_on DESC, id DESC'),
    waivers: all('SELECT * FROM waivers'),
    payouts: all('SELECT * FROM payouts'),
    draws: all('SELECT * FROM monthly_draws ORDER BY period DESC'),
    draw_attempts: all('SELECT * FROM draw_attempts ORDER BY id DESC'),
    release_audit: all('SELECT * FROM release_audit ORDER BY id DESC'),
  };
}

function enrichGroup(g, data, today) {
  const members = data.members.filter((m) => m.group_id === g.id);
  const payments = data.payments.filter((p) => p.group_id === g.id);
  const currentYm = today.slice(0, 7);
  const endYm = L.addMonths(g.start_month, g.slots - 1);
  const periods = L.groupPeriods(g);
  const curIndex = periods.findIndex((p) => p.period === currentYm) + 1; // 0 if outside
  const em = members.map((m) => {
    const payout = data.payouts.find((p) => p.member_id === m.id);
    const draw = data.draws.find(draw => draw.member_id === m.id);
    const c = L.computeMember(g, m, payments, data.waivers, payout, today, draw);
    return { ...m, ...c };
  });
  let phase = 'active';
  if (currentYm < g.start_month) phase = 'upcoming';
  else if (currentYm > endYm) phase = 'ended';
  const collected = L.round2(payments.reduce((s, p) => s + Number(p.amount), 0));
  const fines = L.round2(payments.reduce((s, p) => s + Number(p.fine || 0), 0));
  const target = L.round2(g.monthly * g.slots * g.slots);
  const paidThisPeriod = em.filter((m) => {
    const p = m.periods.find((x) => x.period === currentYm);
    return p && (p.status === 'paid' || p.status === 'late');
  }).length;
  return {
    ...g,
    members: em,
    periods,
    endMonth: endYm,
    currentIndex: curIndex,
    phase,
    filled: members.length,
    open: g.slots - members.length,
    collected,
    fines,
    target,
    paidThisPeriod,
    overdueMembers: em.filter((m) => m.summary.overdueCount > 0).length,
    graceMembers: em.filter((m) => m.summary.graceCount > 0).length,
    complete: phase === 'ended' && em.every((m) => m.summary.health === 'complete'),
  };
}

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(['/api/payment-submissions', '/api/payments'], express.json({ limit: '8mb' }));
app.use(express.json({ limit: '1mb' }));
app.get('/healthz', (req, res) => {
  try { db.prepare('SELECT 1').get(); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'unavailable' }); }
});

// Static: app shell + vendored libs (works fully offline)
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.use('/fonts/instrument-serif', express.static(path.join(__dirname, 'node_modules/@fontsource/instrument-serif')));
app.use('/fonts/bricolage', express.static(path.join(__dirname, 'node_modules/@fontsource/bricolage-grotesque')));
app.use('/fonts/jetbrains', express.static(path.join(__dirname, 'node_modules/@fontsource/jetbrains-mono')));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const api = express.Router();
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out !== undefined) res.json(out);
  } catch (e) {
    next(e);
  }
};

function auth(role) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    const s = token && one('SELECT * FROM sessions WHERE token = ?', token);
    if (!s) return res.status(401).json({ error: 'Please log in again.' });
    if (Date.now() - Date.parse(s.created) >= SESSION_HOURS * 3600000) {
      run('DELETE FROM sessions WHERE token = ?', token);
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    if (role && s.role !== role) return res.status(403).json({ error: 'Not allowed.' });
    req.session = s;
    next();
  };
}
const seller = auth('seller');
const paymentReview = require('./lib/payment-review')({ db, L, api, seller, auth, wrap, HttpError, bad, num, str, memberOr404, groupOr404, now });
const monthlyDraws = require('./lib/monthly-draws')({ db, L, api, seller, wrap, HttpError, bad, str, groupOr404, memberOr404, now });

api.get('/state', wrap(() => {
  const s = getSettings();
  return { needsSetup: !one('SELECT id FROM sellers LIMIT 1'), business_name: s.business_name, tagline: s.tagline, today: L.todayStr() };
}));

api.post('/setup', wrap((req) => {
  if (one('SELECT id FROM sellers LIMIT 1')) bad('Setup already completed.');
  const username = str(req.body.username, 'Username', { max: 40 }).toLowerCase();
  const name = str(req.body.name, 'Your name', { max: 80 });
  const password = String(req.body.password || '');
  if (password.length < 6) bad('Password must be at least 6 characters.');
  run('INSERT INTO sellers(username, name, pass) VALUES(?, ?, ?)', username, name, hash(password));
  if (req.body.business_name) setSetting('business_name', str(req.body.business_name, 'Business name', { max: 60 }));
  const seller = one('SELECT id FROM sellers WHERE username = ?', username);
  const token = crypto.randomBytes(24).toString('hex');
  run('INSERT INTO sessions VALUES(?, ?, ?, ?)', token, 'seller', String(seller.id), now());
  return { token, role: 'seller', name };
}));

const attempts = new Map();
function throttle(key) {
  for (const [k, value] of attempts) if (Date.now() - value.t > 10 * 60 * 1000) attempts.delete(k);
  const a = attempts.get(key) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 10 * 60 * 1000) { a.n = 0; a.t = Date.now(); }
  a.n++;
  attempts.set(key, a);
  if (a.n > 15) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
}

api.post('/login', wrap((req) => {
  const role = req.body.role === 'member' ? 'member' : 'seller';
  throttle(req.ip + role);
  const token = crypto.randomBytes(24).toString('hex');
  if (role === 'seller') {
    const s = one('SELECT * FROM sellers WHERE username = ?', String(req.body.username || '').trim().toLowerCase());
    if (!s || !verify(req.body.password || '', s.pass)) throw new HttpError(401, 'Wrong username or password.');
    run('INSERT INTO sessions VALUES(?, ?, ?, ?)', token, 'seller', String(s.id), now());
    return { token, role, name: s.name };
  }
  const phone = normPhone(req.body.phone);
  const pin = String(req.body.pin || '');
  const rows = all('SELECT id, name, pin FROM members WHERE phone = ?', phone).filter((m) => verify(pin, m.pin));
  if (!phone || !rows.length) throw new HttpError(401, 'Phone number or PIN is incorrect.');
  run('INSERT INTO sessions VALUES(?, ?, ?, ?)', token, 'member', JSON.stringify(rows.map((r) => r.id)), now());
  return { token, role, name: rows[0].name };
}));

api.post('/logout', auth(), wrap((req) => {
  run('DELETE FROM sessions WHERE token = ?', req.session.token);
  return { ok: true };
}));

api.get('/me', auth(), wrap((req) => {
  const s = req.session;
  if (s.role === 'seller') {
    const u = one('SELECT id, username, name FROM sellers WHERE id = ?', Number(s.ref));
    if (!u) throw new HttpError(401, 'Please log in again.');
    return { role: 'seller', ...u };
  }
  const ids = JSON.parse(s.ref);
  const m = ids.length ? one('SELECT name FROM members WHERE id = ?', ids[0]) : null;
  if (!m) throw new HttpError(401, 'Please log in again.');
  return { role: 'member', name: m.name };
}));

// ----- dashboard -----
api.get('/dashboard', seller, wrap(() => {
  const today = L.todayStr();
  const data = loadAll();
  const groups = data.groups.map((g) => enrichGroup(g, data, today));
  const ym = today.slice(0, 7);
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(L.addMonths(ym, -i));
  const series = months.map((m) => ({
    month: m,
    amount: L.round2(data.payments.filter((p) => p.paid_on.slice(0, 7) === m).reduce((s, p) => s + Number(p.amount), 0)),
    fines: L.round2(data.payments.filter((p) => p.paid_on.slice(0, 7) === m).reduce((s, p) => s + Number(p.fine || 0), 0)),
  }));
  const flat = groups.flatMap((g) => g.members.map((m) => ({ g, m })));
  const overdue = flat.filter(({ m }) => m.summary.overdueCount > 0).map(({ g, m }) => ({
    id: m.id, name: m.name, phone: m.phone, group: g.name, group_id: g.id, model: g.model,
    owed: m.summary.outstanding, fine: m.summary.fineBalance, months: m.summary.overdueCount,
  })).sort((a, b) => b.owed + b.fine - (a.owed + a.fine));
  const grace = flat.filter(({ m }) => m.summary.graceCount > 0 && !m.summary.overdueCount).map(({ g, m }) => ({
    id: m.id, name: m.name, group: g.name, group_id: g.id, owed: m.summary.outstanding, deadline: m.summary.next && m.summary.next.deadline,
  }));
  const payoutsDue = flat.filter(({ m }) => m.summary.payoutSelected && !m.summary.payoutReleased).map(({ g, m }) => ({
    id: m.id, name: m.name, group: g.name, group_id: g.id, model: `${g.model} ${g.storage || ''}`.trim(), released: m.summary.payoutReleased,
  }));
  const statusMix = { paid: 0, late: 0, current: 0, grace: 0, overdue: 0 };
  for (const { m } of flat) {
    const p = m.periods.find((x) => x.period === ym);
    if (p && statusMix[p.status] !== undefined) statusMix[p.status]++;
  }
  return {
    today,
    totals: {
      collectedMonth: series[series.length - 1].amount,
      finesMonth: series[series.length - 1].fines,
      collectedAll: L.round2(data.payments.reduce((s, p) => s + Number(p.amount), 0)),
      finesAll: L.round2(data.payments.reduce((s, p) => s + Number(p.fine || 0), 0)),
      activeGroups: groups.filter((g) => g.phase !== 'ended').length,
      members: data.members.length,
      openSlots: groups.reduce((s, g) => s + g.open, 0),
      outstanding: L.round2(flat.reduce((s, { m }) => s + m.summary.outstanding, 0)),
      expectedMonth: L.round2(groups.filter((g) => g.phase === 'active').reduce((s, g) => s + g.monthly * g.filled, 0)),
      collectedForMonth: L.round2(flat.reduce((s, { m }) => { const p = m.periods.find((x) => x.period === ym); return s + (p ? p.paid : 0); }, 0)),
      finesOwed: L.round2(flat.reduce((s, { m }) => s + m.summary.fineBalance, 0)),
    },
    series,
    statusMix,
    overdue,
    grace,
    payoutsDue,
    recent: data.payments.slice(0, 8).map((p) => {
      const m = data.members.find((x) => x.id === p.member_id);
      const g = data.groups.find((x) => x.id === p.group_id);
      return { ...p, member: m ? m.name : '—', group: g ? g.name : '—' };
    }),
    groups: groups.map((g) => ({
      id: g.id, name: g.name, model: g.model, storage: g.storage, color: g.color, color_hex: g.color_hex, slots: g.slots, filled: g.filled,
      phase: g.phase, currentIndex: g.currentIndex, paidThisPeriod: g.paidThisPeriod, overdueMembers: g.overdueMembers,
    })),
  };
}));

// ----- groups -----
function readGroup(body, existing) {
  const s = getSettings();
  const g = {
    name: str(body.name, 'Group name', { max: 80 }),
    model: str(body.model, 'iPhone model', { max: 60 }),
    variant: str(body.variant, 'Variant', { required: false, max: 60 }),
    storage: str(body.storage, 'Storage', { required: false, max: 20 }),
    color: str(body.color, 'Color', { required: false, max: 40 }),
    color_hex: /^#[0-9a-fA-F]{6}$/.test(body.color_hex || '') ? body.color_hex : '#2b2b2e',
    price: num(body.price, 'Price', { min: 1 }),
    slots: num(body.slots, 'Number of members', { min: 2, int: true }),
    start_month: String(body.start_month || ''),
    grace_days: num(body.grace_days ?? s.default_grace, 'Grace days', { min: 0, int: true }),
    fine_amount: num(body.fine_amount ?? s.default_fine, 'Fine', { min: 0 }),
    fine_per_day: num(body.fine_per_day ?? s.default_fine_per_day, 'Fine per day', { min: 0 }),
    notes: str(body.notes, 'Notes', { required: false, max: 1000 }),
  };
  if (g.slots > 50) bad('Maximum of 50 members per group.');
  if (g.grace_days > 28) bad('Grace period can be at most 28 days.');
  if (!isYm(g.start_month)) bad('Start month is required.');
  g.monthly = body.monthly ? num(body.monthly, 'Monthly payment', { min: 1 }) : L.round2(g.price / g.slots);
  if (existing) {
    const count = one('SELECT COUNT(*) AS c FROM members WHERE group_id = ?', existing.id).c;
    if (g.slots < count) bad(`This group already has ${count} members. Remove members first to reduce slots.`);
    const maxOrder = one('SELECT MAX(payout_order) AS m FROM members WHERE group_id = ?', existing.id).m || 0;
    if (g.slots < maxOrder) bad(`A member holds payout #${maxOrder}. Change their order first.`);
  }
  return g;
}

api.get('/groups', seller, wrap(() => {
  const today = L.todayStr();
  const data = loadAll();
  return data.groups.map((g) => {
    const e = enrichGroup(g, data, today);
    delete e.members;
    return e;
  });
}));

api.post('/groups', seller, wrap((req) => {
  const g = readGroup(req.body);
  const r = run(`INSERT INTO pgroups(name, model, variant, storage, color, color_hex, price, slots, monthly, start_month, grace_days, fine_amount, fine_per_day, notes, created)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, g.name, g.model, g.variant, g.storage, g.color, g.color_hex, g.price, g.slots, g.monthly, g.start_month, g.grace_days, g.fine_amount, g.fine_per_day, g.notes, now());
  return { id: Number(r.lastInsertRowid) };
}));

function groupOr404(id) {
  const g = one('SELECT * FROM pgroups WHERE id = ?', Number(id));
  if (!g) throw new HttpError(404, 'Group not found.');
  return g;
}

api.get('/groups/:id', seller, wrap((req) => {
  const g = groupOr404(req.params.id);
  return enrichGroup(g, loadAll(), L.todayStr());
}));

api.put('/groups/:id', seller, wrap((req) => {
  const ex = groupOr404(req.params.id);
  const g = readGroup(req.body, ex);
  if (one('SELECT id FROM monthly_draws WHERE group_id=? LIMIT 1', ex.id) && (g.slots !== ex.slots || g.start_month !== ex.start_month || g.monthly !== ex.monthly || g.model !== ex.model || g.storage !== ex.storage || g.price !== ex.price)) bad('Member count, start month, monthly hulog, device model, storage and price cannot change after a saved draw.');
  run(`UPDATE pgroups SET name=?, model=?, variant=?, storage=?, color=?, color_hex=?, price=?, slots=?, monthly=?, start_month=?, grace_days=?, fine_amount=?, fine_per_day=?, notes=? WHERE id=?`,
    g.name, g.model, g.variant, g.storage, g.color, g.color_hex, g.price, g.slots, g.monthly, g.start_month, g.grace_days, g.fine_amount, g.fine_per_day, g.notes, ex.id);
  return { ok: true };
}));

api.delete('/groups/:id', seller, wrap((req) => {
  const g = groupOr404(req.params.id);
  if (one('SELECT id FROM monthly_draws WHERE group_id=? LIMIT 1', g.id)) bad('Groups with saved draw history cannot be deleted.');
  run('DELETE FROM pgroups WHERE id = ?', g.id);
  return { ok: true };
}));

// ----- members -----
function memberOr404(id) {
  const m = one('SELECT * FROM members WHERE id = ?', Number(id));
  if (!m) throw new HttpError(404, 'Member not found.');
  return m;
}

api.get('/members', seller, wrap(() => {
  const today = L.todayStr();
  const data = loadAll();
  return data.groups.flatMap((g) => {
    const e = enrichGroup(g, data, today);
    return e.members.map((m) => ({
      id: m.id, name: m.name, phone: m.phone, payout_order: m.payout_order, group_id: g.id, group: g.name, model: g.model,
      storage: g.storage, color_hex: g.color_hex, monthly: g.monthly, summary: m.summary,
      strip: m.periods.map((p) => p.status),
    }));
  });
}));

api.post('/groups/:id/members', seller, wrap((req) => {
  const g = groupOr404(req.params.id);
  const count = one('SELECT COUNT(*) AS c FROM members WHERE group_id = ?', g.id).c;
  if (count >= g.slots) bad(`This group is full (${g.slots}/${g.slots}). Increase slots or create a new group.`);
  const name = str(req.body.name, 'Name', { max: 80 });
  const phone = normPhone(req.body.phone);
  if (phone.length < 7) bad('Enter a valid phone number.');
  const pin = String(req.body.pin || '');
  if (!/^\d{4,6}$/.test(pin)) bad('PIN must be 4 to 6 digits.');
  const taken = new Set(all('SELECT payout_order FROM members WHERE group_id = ?', g.id).map((r) => r.payout_order));
  let order = req.body.payout_order ? num(req.body.payout_order, 'Payout order', { min: 1, int: true }) : 0;
  if (order > g.slots) bad(`Payout order must be between 1 and ${g.slots}.`);
  if (order && taken.has(order)) bad(`Payout #${order} is already taken.`);
  if (!order) { order = 1; while (taken.has(order)) order++; }
  const r = run('INSERT INTO members(group_id, name, phone, pin, payout_order, address, notes, created) VALUES(?,?,?,?,?,?,?,?)',
    g.id, name, phone, hash(pin), order, str(req.body.address, 'Address', { required: false, max: 300 }), str(req.body.notes, 'Notes', { required: false, max: 1000 }), now());
  return { id: Number(r.lastInsertRowid), payout_order: order };
}));

api.get('/members/:id', seller, wrap((req) => {
  const m = memberOr404(req.params.id);
  const g = enrichGroup(groupOr404(m.group_id), loadAll(), L.todayStr());
  const em = g.members.find((x) => x.id === m.id);
  delete g.members;
  return { ...em, group: g };
}));

api.put('/members/:id', seller, wrap((req) => {
  const m = memberOr404(req.params.id);
  const g = groupOr404(m.group_id);
  const name = str(req.body.name ?? m.name, 'Name', { max: 80 });
  const phone = normPhone(req.body.phone ?? m.phone);
  if (phone.length < 7) bad('Enter a valid phone number.');
  const order = num(req.body.payout_order ?? m.payout_order, 'Payout order', { min: 1, int: true });
  if (order > g.slots) bad(`Payout order must be between 1 and ${g.slots}.`);
  let pinHash = m.pin;
  if (req.body.pin) {
    if (!/^\d{4,6}$/.test(String(req.body.pin))) bad('PIN must be 4 to 6 digits.');
    pinHash = hash(req.body.pin);
  }
  db.exec('BEGIN');
  try {
    if (order !== m.payout_order) {
      const other = one('SELECT id FROM members WHERE group_id = ? AND payout_order = ? AND id != ?', g.id, order, m.id);
      if (other) {
        if (one('SELECT id FROM payouts WHERE member_id IN (?, ?)', other.id, m.id)) bad('Cannot swap: one of these members already received their iPhone.');
        run('UPDATE members SET payout_order = ? WHERE id = ?', m.payout_order, other.id);
      }
    }
    run('UPDATE members SET name=?, phone=?, pin=?, payout_order=?, address=?, notes=? WHERE id=?', name, phone, pinHash, order,
      str(req.body.address ?? m.address, 'Address', { required: false, max: 300 }), str(req.body.notes ?? m.notes, 'Notes', { required: false, max: 1000 }), m.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { ok: true };
}));

api.delete('/members/:id', seller, wrap((req) => {
  const m = memberOr404(req.params.id);
  if (one('SELECT id FROM monthly_draws WHERE group_id=? LIMIT 1', m.group_id)) bad('Members cannot be removed from a group with saved draw history.');
  run('DELETE FROM members WHERE id = ?', m.id);
  return { ok: true };
}));

// ----- payments -----
api.get('/quote', seller, wrap((req) => {
  const m = memberOr404(req.query.member_id);
  const g = groupOr404(m.group_id);
  const date = isDate(req.query.date) ? req.query.date : L.todayStr();
  const data = loadAll();
  const c = L.computeMember(g, m, data.payments.filter((p) => p.member_id === m.id), data.waivers, null, date);
  const p = c.periods.find((x) => x.period === req.query.period);
  if (!p) bad('Invalid period.');
  // fine if completed on `date`
  const f = p.completedOn ? { fine: p.fineDue } : L.fineFor(g, p.deadline, date);
  const fine = p.waived ? 0 : f.fine;
  return { balance: p.balance, fine: L.round2(Math.max(0, fine - p.finePaid)), deadline: p.deadline, due: p.due, waived: p.waived };
}));

api.post('/payments', seller, wrap(req => paymentReview.createPayment(req.body)));

api.get('/payments', seller, wrap((req) => {
  let rows = all(`SELECT p.*, m.name AS member, m.phone, g.name AS grp, g.model FROM payments p
    JOIN members m ON m.id = p.member_id JOIN pgroups g ON g.id = p.group_id ORDER BY p.paid_on DESC, p.id DESC`);
  if (req.query.group_id) rows = rows.filter((r) => r.group_id === Number(req.query.group_id));
  if (req.query.month) rows = rows.filter((r) => r.paid_on.startsWith(req.query.month));
  return rows;
}));

api.delete('/payments/:id', seller, wrap((req) => {
  const r = run('DELETE FROM payments WHERE id = ?', Number(req.params.id));
  if (!r.changes) throw new HttpError(404, 'Payment not found.');
  return { ok: true };
}));

api.get('/export/payments.csv', seller, (req, res, next) => {
  try {
    const rows = all(`SELECT p.paid_on, m.name, m.phone, g.name AS grp, g.model, p.period, p.amount, p.fine, p.method, p.ref, p.note FROM payments p
      JOIN members m ON m.id = p.member_id JOIN pgroups g ON g.id = p.group_id ORDER BY p.paid_on DESC, p.id DESC`);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Date Paid,Member,Phone,Group,Model,For Month,Amount,Fine,Method,Reference,Note']
      .concat(rows.map((r) => [r.paid_on, r.name, r.phone, r.grp, r.model, r.period, r.amount, r.fine, r.method, r.ref, r.note].map(esc).join(','))).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${L.todayStr()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (e) { next(e); }
});

// ----- waivers & payouts -----
api.post('/waivers', seller, wrap((req) => {
  const m = memberOr404(req.body.member_id);
  const period = String(req.body.period || '');
  if (!isYm(period)) bad('Invalid month.');
  run('INSERT OR REPLACE INTO waivers(member_id, period, reason) VALUES(?,?,?)', m.id, period, str(req.body.reason, 'Reason', { required: false, max: 200 }));
  return { ok: true };
}));
api.delete('/waivers', seller, wrap((req) => {
  run('DELETE FROM waivers WHERE member_id = ? AND period = ?', Number(req.query.member_id), String(req.query.period || ''));
  return { ok: true };
}));

api.post('/payouts', seller, wrap(req => monthlyDraws.release(req.body, Number(req.session.ref))));
api.delete('/payouts/:memberId', seller, wrap(req => monthlyDraws.undoRelease(req.params.memberId, req.body, Number(req.session.ref))));

// ----- settings -----
api.get('/settings', seller, wrap(() => getSettings()));
api.put('/settings', seller, wrap((req) => {
  const b = req.body;
  if (b.business_name !== undefined) setSetting('business_name', str(b.business_name, 'Business name', { max: 60 }));
  if (b.tagline !== undefined) setSetting('tagline', str(b.tagline, 'Tagline', { required: false, max: 80 }));
  if (b.default_grace !== undefined) setSetting('default_grace', num(b.default_grace, 'Default grace days', { min: 0, int: true }));
  if (b.default_fine !== undefined) setSetting('default_fine', num(b.default_fine, 'Default fine', { min: 0 }));
  if (b.default_fine_per_day !== undefined) setSetting('default_fine_per_day', num(b.default_fine_per_day, 'Default fine per day', { min: 0 }));
  if (b.gcash_name !== undefined) setSetting('gcash_name', str(b.gcash_name, 'GCash Name', { required: false, max: 80 }));
  if (b.gcash_no !== undefined) setSetting('gcash_no', str(b.gcash_no, 'GCash No', { required: false, max: 40 }));
  if (b.maya_name !== undefined) setSetting('maya_name', str(b.maya_name, 'Maya Name', { required: false, max: 80 }));
  if (b.maya_no !== undefined) setSetting('maya_no', str(b.maya_no, 'Maya No', { required: false, max: 40 }));
  if (b.bank_name !== undefined) setSetting('bank_name', str(b.bank_name, 'Bank Name', { required: false, max: 80 }));
  if (b.bank_acc !== undefined) setSetting('bank_acc', str(b.bank_acc, 'Bank Account', { required: false, max: 80 }));
  if (b.payment_instructions !== undefined) setSetting('payment_instructions', str(b.payment_instructions, 'Payment Instructions', { required: false, max: 500 }));
  return getSettings();
}));
api.post('/password', seller, wrap((req) => {
  const s = one('SELECT * FROM sellers WHERE id = ?', Number(req.session.ref));
  if (!verify(req.body.current || '', s.pass)) bad('Current password is incorrect.');
  if (String(req.body.next || '').length < 6) bad('New password must be at least 6 characters.');
  run('UPDATE sellers SET pass = ? WHERE id = ?', hash(req.body.next), s.id);
  run('DELETE FROM sessions WHERE role = ? AND ref = ? AND token != ?', 'seller', String(s.id), req.session.token);
  return { ok: true };
}));
api.get('/backup', seller, wrap(() => {
  const d = loadAll();
  return { exported: now(), settings: getSettings(), ...d, payment_review: paymentReview.backup() };
}));

// ----- member portal -----
api.get('/portal', auth('member'), wrap((req) => {
  const ids = JSON.parse(req.session.ref);
  const today = L.todayStr();
  const data = loadAll();
  const settings = getSettings();
  const slots = [];
  for (const id of ids) {
    const m = data.members.find((x) => x.id === id);
    if (!m) continue;
    const g = data.groups.find((x) => x.id === m.group_id);
    const e = enrichGroup(g, data, today);
    const em = e.members.find((x) => x.id === id);
    slots.push({
      member: { id: em.id, name: em.name, payout_order: em.payout_order },
      periods: em.periods.map(({ payments, ...p }) => ({ ...p, payments: payments.map(({ id, amount, fine, paid_on, method, proof_id, ref }) => ({ id, amount, fine, paid_on, method, proof_id, ref })) })),
      summary: em.summary,
      group: {
        name: g.name, model: g.model, variant: g.variant, storage: g.storage, color: g.color, color_hex: g.color_hex, price: g.price, slots: g.slots, monthly: g.monthly,
        start_month: g.start_month, endMonth: e.endMonth, grace_days: g.grace_days, fine_amount: g.fine_amount, fine_per_day: g.fine_per_day, filled: e.filled, phase: e.phase,
        currentIndex: e.currentIndex, paidThisPeriod: e.paidThisPeriod,
      },
    });
  }
  if (!slots.length) throw new HttpError(401, 'Your membership was removed. Contact your seller.');
  return {
    today,
    business_name: settings.business_name,
    name: slots[0].member.name,
    settings: {
      gcash_name: settings.gcash_name,
      gcash_no: settings.gcash_no,
      maya_name: settings.maya_name,
      maya_no: settings.maya_no,
      bank_name: settings.bank_name,
      bank_acc: settings.bank_acc,
      payment_instructions: settings.payment_instructions
    },
    slots
  };
}));

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// SPA fallback
app.get(/^\/(?!api|vendor|fonts).*/, (req, res) => {
  if (path.extname(req.path)) return res.sendStatus(404);
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
});

const server = app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`\n  PaluPhone is running\n  ➜ This computer:  http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  ➜ Phones on Wi-Fi: http://${ip}:${PORT}`);
  console.log('');
});

function shutdown() {
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
