// Branded introduction; the destination is prepared behind the animation.
import { PhoneScene } from './three-phone.js';
import { esc } from './ui.js';

export async function runBoot(metadata, ready = Promise.resolve()) {
  const root = document.getElementById('boot');
  let seen = false;
  try { seen = sessionStorage.getItem('palu.booted') === '1'; } catch { /* Storage is optional. */ }
  if (seen) { await ready; return; }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const name = metadata.business_name || 'PaluPhone';
  root.innerHTML = `
    <div class="boot" aria-label="Welcome to ${esc(name)}">
      <div class="boot-grid"></div>
      <div class="boot-top"><span class="mono">${esc(metadata.tagline || 'iPhone Paluwagan')}</span><button class="boot-skip mono" type="button">Skip intro &rarr;</button></div>
      <div class="boot-stage" aria-hidden="true"></div>
      <h1 class="boot-title" aria-label="${esc(name)}">${[...name].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</h1>
    </div>`;
  const el = root.firstElementChild;
  const app = document.getElementById('app');
  app.inert = true;
  document.body.classList.add('boot-active');
  let scene, timer, finishAnimation;
  const animation = new Promise(resolve => { finishAnimation = resolve; timer = setTimeout(resolve, reduced ? 0 : 2600); });
  const skip = () => { clearTimeout(timer); finishAnimation(); };
  const onKey = e => { if (e.key === 'Escape') skip(); };
  el.querySelector('.boot-skip').addEventListener('click', skip);
  window.addEventListener('keydown', onKey);
  try {
    if (!reduced) scene = new PhoneScene(el.querySelector('.boot-stage'), {
      color: '#1c1b1f', pro: true, coins: 12, filled: 12, interactive: false, cameraZ: 8.6,
      screen: { title: name, kicker: 'welcome', sub: 'iPhone Paluwagan' },
    });
    await Promise.all([animation, ready]);
    try { sessionStorage.setItem('palu.booted', '1'); } catch { /* Storage is optional. */ }
    app.inert = false;
    el.classList.add('leaving');
    await new Promise(resolve => setTimeout(resolve, reduced ? 0 : 650));
  } finally {
    clearTimeout(timer);
    window.removeEventListener('keydown', onKey);
    scene?.dispose();
    root.replaceChildren();
    app.inert = false;
    document.body.classList.remove('boot-active');
  }
}
