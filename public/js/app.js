// Main application router & shell
import { api, session } from './api.js';
import { sfx, wireGlobalSounds } from './sound.js';
import { piso } from './mascot.js';
import { runBoot } from './boot.js';
import { state, disposeScenes, go } from './state.js';
import { I, coinMark } from './icons.js';
import { viewAuth } from './views-auth.js';
import { viewDashboard, viewGroups, viewGroup, viewMembers, viewPayments, viewSettings } from './views-seller.js';
import { viewPortal } from './views-member.js';
import { paymentModal } from './modals.js';
import { toast, esc } from './ui.js';

const appEl = document.getElementById('app');
const mascotEl = document.getElementById('mascot-root');

async function init() {
  wireGlobalSounds();
  piso.mount(mascotEl);
  if (localStorage.getItem('palu.piso.hidden') === '1') piso.show(false);

  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('palu:logout', logout);
  window.addEventListener('palu:changed', () => renderRoute());
  window.addEventListener('palu:sound', () => updateSoundButtons());

  const prepare = async () => {
    try {
      state.meta = await api('/state');
      state.today = state.meta.today;
      const cur = session.get();
      if (cur?.token) {
        try { state.me = await api('/me'); }
        catch (err) {
          if (err.status !== 401) throw err;
          session.clear();
          state.me = null;
        }
      }
      await renderRoute();
    } catch (err) {
      appEl.innerHTML = `<main class="auth-page"><div class="auth-card startup-error"><h1 class="display">Unable to connect</h1><p class="muted">${esc(err.message)}</p><button class="btn btn-primary" data-retry>Try again</button></div></main>`;
      appEl.querySelector('[data-retry]').onclick = () => location.reload();
    }
  };
  await runBoot({ business_name: 'PaluPhone', tagline: 'iPhone Paluwagan' }, prepare());
}

function updateSoundButtons() {
  document.querySelectorAll('[data-sound-toggle]').forEach((btn) => {
    btn.innerHTML = sfx.muted ? I.soundOff : I.soundOn;
    btn.setAttribute('aria-label', sfx.muted ? 'Unmute sound' : 'Mute sound');
  });
}

function logout() {
  session.clear();
  state.me = null;
  disposeScenes();
  sfx.whoosh();
  toast('Signed out');
  renderRoute();
}

async function renderRoute() {
  if (!state.meta) return;
  disposeScenes();
  piso.hide();
  const hash = location.hash.replace(/^#\/?/, '');
  const [route, param] = hash.split('/');

  // If setup required or not logged in
  if (state.meta?.needsSetup || !state.me) {
    mascotEl.hidden = true;
    appEl.innerHTML = '<main class="auth-page"></main>';
    const page = appEl.querySelector('.auth-page');
    viewAuth(page, {
      needsSetup: !!state.meta?.needsSetup,
      onLogin: (usr) => {
        state.meta.needsSetup = false;
        if (usr.role === 'seller') go('/dashboard');
        else go('/portal');
      },
    });
    return;
  }

  const role = state.me.role; // 'seller' | 'member'
  mascotEl.hidden = false;

  // Build Shell
  appEl.innerHTML = `
    <div class="app-layout">
      <header class="app-topbar">
        <div class="topbar-left">
          <a href="${role === 'seller' ? '#/dashboard' : '#/portal'}" class="brand-link">
            ${coinMark}
            <span class="brand-name"><b>${esc(state.meta?.business_name || 'PaluPhone')}</b> <small class="mono">${role === 'seller' ? 'SELLER' : 'MEMBER'}</small></span>
          </a>
        </div>
        <nav class="topbar-nav">
          ${role === 'seller' ? `
            <a href="#/dashboard" class="nav-item ${route === 'dashboard' || !route ? 'active' : ''}">${I.home} <span>Overview</span></a>
            <a href="#/groups" class="nav-item ${route === 'groups' ? 'active' : ''}">${I.groups} <span>iPhone Groups</span></a>
            <a href="#/members" class="nav-item ${route === 'members' ? 'active' : ''}">${I.users} <span>Members</span></a>
            <a href="#/payments" class="nav-item ${route === 'payments' ? 'active' : ''}">${I.receipt} <span>Ledger</span></a>
            <a href="#/settings" class="nav-item ${route === 'settings' ? 'active' : ''}">${I.gear} <span>Settings</span></a>
          ` : `
            <a href="#/portal" class="nav-item active">${I.phone} <span>My iPhone Hulugan</span></a>
          `}
        </nav>
        <div class="topbar-right">
          ${role === 'seller' ? `<button class="btn btn-sm btn-primary top-pay-btn" data-top-pay>${I.cash} Hulog</button>` : ''}
          <button class="icon-btn" data-sound-toggle aria-label="Toggle sound">${sfx.muted ? I.soundOff : I.soundOn}</button>
          <button class="icon-btn danger" data-logout title="Sign out" aria-label="Sign out">${I.logout}</button>
        </div>
      </header>

      <main class="app-content"></main>
    </div>
  `;

  const content = appEl.querySelector('.app-content');
  appEl.querySelector('[data-logout]').onclick = async () => {
    try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ }
    logout();
  };
  appEl.querySelector('[data-sound-toggle]').onclick = () => {
    sfx.toggle();
    updateSoundButtons();
  };
  const topPay = appEl.querySelector('[data-top-pay]');
  if (topPay) topPay.onclick = () => paymentModal();

  try {
    if (role === 'member') {
      await viewPortal(content);
    } else {
      if (route === 'dashboard' || !route) await viewDashboard(content);
      else if (route === 'groups') {
        if (param) await viewGroup(content, param);
        else await viewGroups(content);
      } else if (route === 'members') await viewMembers(content);
      else if (route === 'payments') await viewPayments(content);
      else if (route === 'settings') {
        await viewSettings(content, {
          onRename: () => {
            const b = appEl.querySelector('.brand-name b');
            if (b) b.textContent = state.meta.business_name;
          },
        });
      } else {
        go('/dashboard');
      }
    }
  } catch (err) {
    console.error('Route error:', err);
    content.innerHTML = `
      <div class="empty">
        <h4>Error loading page</h4>
        <p class="muted">${esc(err.message)}</p>
        <button class="btn btn-primary" onclick="location.hash='#/dashboard'">Back to Safety</button>
      </div>
    `;
  }
}

init();

