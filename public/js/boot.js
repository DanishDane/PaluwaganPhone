// Startup sequence
import { sfx } from './sound.js';
import { PhoneScene } from './three-phone.js';

const LINES = [
  'mounting ledger ……… ok',
  'counting coins ……… ok',
  'checking due dates ……… ok',
  'polishing iPhones ……… ok',
  'waking up Piso ……… ok',
];

export function runBoot(state, ready) {
  const root = document.getElementById('boot');
  const quick = sessionStorage.getItem('palu.booted') === '1';
  return new Promise((resolve) => {
    if (quick) {
      root.innerHTML = '';
      resolve();
      return;
    }
    const name = state.business_name || 'PaluPhone';
    root.innerHTML = `
      <div class="boot">
        <div class="boot-grid"></div>
        <div class="boot-top"><span class="mono">${new Date().getFullYear()} · ${escapeHtml(state.tagline || 'iPhone Paluwagan')}</span><button class="boot-skip mono">skip intro →</button></div>
        <div class="boot-stage"></div>
        <h1 class="boot-title" aria-label="${escapeHtml(name)}">${[...name].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : escapeHtml(c)}</span>`).join('')}</h1>
        <div class="boot-log mono"></div>
        <div class="boot-pct"><span class="mono">loading</span><b>0</b></div>
        <button class="boot-enter" disabled><span class="boot-enter-dot"></span><span class="boot-enter-txt">Preparing…</span></button>
        <div class="boot-curtain"></div>
      </div>`;
    const el = root.querySelector('.boot');
    const stage = el.querySelector('.boot-stage');
    const pct = el.querySelector('.boot-pct b');
    const log = el.querySelector('.boot-log');
    const enter = el.querySelector('.boot-enter');
    let scene = null;
    try {
      scene = new PhoneScene(stage, { color: '#1c1b1f', pro: true, coins: 12, filled: 0, interactive: true, cameraZ: 8.6, screen: { title: name, kicker: 'welcome', sub: 'hulog-hulog lang' } });
    } catch { /* 3D optional */ }

    let p = 0;
    let done = false;
    const t0 = performance.now();
    let li = 0;
    const tick = setInterval(() => {
      const elapsed = performance.now() - t0;
      const target = Math.min(done ? 100 : 92, (elapsed / 2200) * 100);
      p += (target - p) * 0.25 + 0.3;
      p = Math.min(p, target);
      pct.textContent = Math.floor(p);
      const nf = Math.floor((p / 100) * 12);
      if (scene && scene.o.filled !== nf) { scene.setFilled(nf); scene.updateScreen(); }
      const want = Math.floor((p / 100) * LINES.length);
      while (li < want && li < LINES.length) {
        const d = document.createElement('div');
        d.textContent = '> ' + LINES[li++];
        log.appendChild(d);
      }
      if (p >= 99.5 && done) {
        clearInterval(tick);
        pct.textContent = '100';
        el.classList.add('ready');
        enter.disabled = false;
        enter.querySelector('.boot-enter-txt').textContent = 'Loading system…';
        setTimeout(() => leave(false), 380);
      }
    }, 50);

    ready.then(() => { done = true; }, () => { done = true; });

    let leaving = false;
    const leave = (skip = false) => {
      if (leaving) return;
      leaving = true;
      clearInterval(tick);
      sfx.unlock();
      sessionStorage.setItem('palu.booted', '1');
      if (!skip) {
        sfx.boot();
        scene && scene.setFilled(12);
        scene && scene.updateScreen({ kicker: 'ready', sub: 'tara, hulog na!' });
        scene && scene.burst();
      }
      el.classList.add('leaving');
      setTimeout(() => sfx.whoosh(), skip ? 0 : 650);
      setTimeout(() => {
        resolve();
        el.classList.add('gone');
      }, skip ? 250 : 1100);
      setTimeout(() => {
        scene && scene.dispose();
        root.innerHTML = '';
      }, skip ? 900 : 2000);
    };
    el.addEventListener('click', (e) => {
      if (e.target.closest('.boot-skip')) { leave(true); return; }
      if (el.classList.contains('ready')) leave(false);
    });
    window.addEventListener('keydown', function k(e) {
      if (!el.isConnected) return window.removeEventListener('keydown', k);
      if ((e.key === 'Enter' || e.key === ' ') && el.classList.contains('ready')) { leave(false); window.removeEventListener('keydown', k); }
      if (e.key === 'Escape') { leave(true); window.removeEventListener('keydown', k); }
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

