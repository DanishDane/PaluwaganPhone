// Tiny synthesized sound kit (Web Audio) — no audio files needed.
let ctx = null;
let master = null;
let muted = localStorage.getItem('palu.muted') === '1';
let lastHover = 0;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, to = null, type = 'sine', dur = 0.12, vol = 0.2, attack = 0.004, delay = 0, q = null }) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (q) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = q;
    o.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.15, from = 800, to = 3000, delay = 0, type = 'bandpass' }) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  unlock() { ac(); },
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    localStorage.setItem('palu.muted', muted ? '1' : '0');
    if (!muted) this.click();
    return muted;
  },
  click() {
    tone({ freq: 1800, to: 900, type: 'triangle', dur: 0.05, vol: 0.12 });
    tone({ freq: 140, to: 60, type: 'sine', dur: 0.07, vol: 0.18 });
  },
  hover() {
    const n = performance.now();
    if (n - lastHover < 70) return;
    lastHover = n;
    tone({ freq: 2600, type: 'sine', dur: 0.025, vol: 0.025 });
  },
  toggleSw(on) { tone({ freq: on ? 660 : 440, to: on ? 990 : 330, type: 'triangle', dur: 0.08, vol: 0.12 }); },
  whoosh() { noise({ dur: 0.28, vol: 0.06, from: 400, to: 2400 }); },
  open() { tone({ freq: 520, to: 780, type: 'sine', dur: 0.12, vol: 0.1 }); noise({ dur: 0.15, vol: 0.03, from: 1200, to: 3000 }); },
  close() { tone({ freq: 700, to: 420, type: 'sine', dur: 0.1, vol: 0.08 }); },
  success() {
    [784, 988, 1319].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.13, delay: i * 0.08 }));
  },
  coin() {
    tone({ freq: 1976, type: 'square', dur: 0.08, vol: 0.05, q: 4000 });
    tone({ freq: 2637, type: 'square', dur: 0.35, vol: 0.05, delay: 0.07, q: 5000 });
  },
  stamp() {
    tone({ freq: 120, to: 40, type: 'sine', dur: 0.18, vol: 0.5 });
    noise({ dur: 0.08, vol: 0.25, from: 300, to: 200, type: 'lowpass' });
  },
  error() {
    tone({ freq: 220, type: 'sawtooth', dur: 0.12, vol: 0.06, q: 900 });
    tone({ freq: 165, type: 'sawtooth', dur: 0.2, vol: 0.06, delay: 0.1, q: 900 });
  },
  blip(i = 0) {
    const scale = [523, 587, 659, 784, 880, 988];
    tone({ freq: scale[i % scale.length] * (0.98 + Math.random() * 0.06), type: 'square', dur: 0.04, vol: 0.035, q: 2400 });
  },
  boop() { tone({ freq: 330, to: 660, type: 'sine', dur: 0.14, vol: 0.18 }); },
  tick() { tone({ freq: 3200, type: 'square', dur: 0.012, vol: 0.02, q: 6000 }); },
  boot() {
    const c = ac();
    if (!c || muted) return;
    [261.6, 329.6, 392, 523.3].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 2.2, vol: 0.09, attack: 0.25 + i * 0.05, delay: i * 0.09 }));
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 1.4, vol: 0.04, delay: 0.5 + i * 0.07 }));
    noise({ dur: 1.2, vol: 0.05, from: 200, to: 6000 });
  },
};

// Global wiring: click / hover sounds for anything interactive
export function wireGlobalSounds() {
  const isInteractive = (el) => el && el.closest && el.closest('button, a, [data-sfx], .cell, summary, label.chip, .seg button, select');
  document.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    const el = isInteractive(e.target);
    if (el && !el.closest('[data-nosfx]')) sfx.click();
  }, true);
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = isInteractive(e.target);
    if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) sfx.hover();
  }, true);
  document.addEventListener('focusin', (e) => {
    if (e.target.matches && e.target.matches('input, textarea')) sfx.tick();
  });
}

