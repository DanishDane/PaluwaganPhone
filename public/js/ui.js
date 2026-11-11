// UI helpers: formatting, toasts, modals, confetti, stamps, counters
import { sfx } from './sound.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const pesoFmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const peso = (n) => '₱' + pesoFmt.format(Number(n) || 0);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthShort = (ym) => (ym ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ’${ym.slice(2, 4)}` : '—');
export const monthLong = (ym) => (ym ? `${MONTHS_L[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : '—');
export const dateNice = (d) => (d ? `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}, ${d.slice(0, 4)}` : '—');
export const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
export const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const STATUS = {
  paid: { label: 'Paid', cls: 'st-paid' },
  late: { label: 'Paid late', cls: 'st-late' },
  current: { label: 'Due this month', cls: 'st-current' },
  grace: { label: 'Grace period', cls: 'st-grace' },
  overdue: { label: 'Overdue', cls: 'st-overdue' },
  future: { label: 'Upcoming', cls: 'st-future' },
};
export const HEALTH = {
  good: { label: 'Good standing', cls: 'st-paid' },
  complete: { label: 'Completed', cls: 'st-paid' },
  grace: { label: 'In grace period', cls: 'st-grace' },
  overdue: { label: 'Overdue', cls: 'st-overdue' },
};
export const chip = (status, map = STATUS) => {
  const s = map[status] || { label: status, cls: '' };
  return `<span class="chip ${s.cls}"><i></i>${esc(s.label)}</span>`;
};

// ---------- toasts ----------
export function toast(msg, type = 'ok') {
  const root = $('#toasts');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-ico">${type === 'ok' ? '✓' : type === 'err' ? '!' : 'i'}</span><span>${esc(msg)}</span>`;
  root.appendChild(t);
  if (type === 'err') sfx.error();
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 400); }, type === 'err' ? 4200 : 2800);
}

// ---------- modal ----------
export function modal({ title, kicker = '', body, wide = false, receipt = false, onMount }) {
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal ${wide ? 'modal-wide' : ''} ${receipt ? 'modal-receipt' : ''}" role="dialog" aria-modal="true">
      <header class="modal-head">
        <div>${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}<h3>${title}</h3></div>
        <button class="icon-btn modal-close" aria-label="Close">✕</button>
      </header>
      <div class="modal-body">${body}</div>
    </div>`;
  root.appendChild(wrap);
  sfx.open();
  requestAnimationFrame(() => wrap.classList.add('in'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sfx.close();
    wrap.classList.remove('in');
    wrap.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => wrap.remove(), 320);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.querySelector('.modal-backdrop').addEventListener('click', close);
  wrap.querySelector('.modal-close').addEventListener('click', close);
  const el = wrap.querySelector('.modal');
  if (onMount) onMount(el, close);
  const first = el.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
  if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 250);
  return { el, close };
}

export function confirmBox({ title = 'Are you sure?', text = '', ok = 'Yes, continue', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: esc(title),
      body: `<p class="muted">${esc(text)}</p><div class="form-actions"><button class="btn btn-ghost" data-no>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(ok)}</button></div>`,
      onMount: (el, close) => {
        el.querySelector('[data-no]').onclick = () => { done = true; close(); resolve(false); };
        el.querySelector('[data-yes]').onclick = () => { done = true; close(); resolve(true); };
      },
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe($('#modal-root'), { childList: true });
  });
}

// form helpers
export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  }
  return o;
}

export async function busy(btn, fn) {
  if (btn.disabled) return;
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('loading');
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = html;
  }
}

// ---------- fx ----------
export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 2, n = 70) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const colors = ['#FF4F1A', '#E9B949', '#127A4B', '#16130F', '#F3EEE3', '#2346D6'];
  const parts = Array.from({ length: n }, () => ({
    x, y, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0], coin: Math.random() < 0.25,
  }));
  let f = 0;
  const step = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (p.coin) { ctx.fillStyle = '#E9B949'; ctx.strokeStyle = '#16130F'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 7, 7 * Math.abs(Math.cos(p.r * 2)) + 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else { ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      ctx.restore();
    }
    if (++f < 150) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

export function stamp(text = 'PAID', color = 'var(--green)') {
  const s = document.createElement('div');
  s.className = 'stamp';
  s.style.setProperty('--stamp', color);
  s.innerHTML = `<span>${esc(text)}</span><small>${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</small>`;
  document.body.appendChild(s);
  setTimeout(() => sfx.stamp(), 180);
  setTimeout(() => s.classList.add('out'), 1300);
  setTimeout(() => s.remove(), 1800);
}

export function countUp(el, to, { money = true, dur = 900 } = {}) {
  const start = performance.now();
  const from = 0;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - k, 4);
    const v = from + (to - from) * e;
    el.textContent = money ? peso(Math.round(v)) : Math.round(v).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
    else el.textContent = money ? peso(to) : Number(to).toLocaleString();
  };
  requestAnimationFrame(step);
}

// Tilt-on-hover for cards with [data-tilt]
export function wireTilt(root = document) {
  $$('[data-tilt]', root).forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-2px)`;
      el.style.setProperty('--mx', `${(x + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(y + 0.5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

export function empty(title, text, action = '') {
  return `<div class="empty"><div class="empty-art"><span></span><span></span><span></span></div><h4>${esc(title)}</h4><p class="muted">${esc(text)}</p>${action}</div>`;
}

