// Authentication view: setup & login (seller / member)
import { api, session } from './api.js';
import { sfx } from './sound.js';
import { piso } from './mascot.js';
import { state, track, disposeScenes } from './state.js';
import { I, coinMark } from './icons.js';
import { PhoneScene } from './three-phone.js';
import { esc, toast, busy } from './ui.js';

const FINISHES = [
  { name: 'Cosmic Orange', hex: '#e8742f', accent: '#FF4F1A' },
  { name: 'Black Titanium', hex: '#3b3b3d', accent: '#FF4F1A' },
  { name: 'Sierra Blue', hex: '#a7c1d9', accent: '#6BA3D6' },
  { name: 'Desert Titanium', hex: '#c4a98a', accent: '#E9B949' },
  { name: 'Deep Purple', hex: '#5b4e66', accent: '#B8A9D9' },
];

export function viewAuth(page, { needsSetup = false, onLogin }) {
  let role = 'seller'; // 'seller' | 'member'
  let finishIdx = 1; // Black Titanium default
  let firstRender = true;

  const render = () => {
    disposeScenes();
    const biz = state.meta?.business_name || 'PaluPhone';
    const curFinish = FINISHES[finishIdx];
    const soundBtn = `
      <button type="button" class="icon-btn" data-sound-toggle aria-label="${sfx.muted ? 'Unmute sound' : 'Mute sound'}" title="Toggle sound">
        ${sfx.muted ? I.soundOff : I.soundOn}
      </button>`;

    const showcaseHtml = `
      <div class="auth-showcase">
        <div class="auth-showcase-top">
          <div class="auth-showcase-meta">
            <span class="mono kicker light">Interactive 3D Preview</span>
            <b class="auth-finish-label">${esc(curFinish.name)}</b>
          </div>
          <span class="auth-live-pill mono"><i></i>12-SLOT BATCH</span>
        </div>

        <div class="auth-3d-stage" id="auth3d">
          <div class="hint mono">drag to spin iPhone</div>
        </div>

        <div class="auth-swatches" role="group" aria-label="iPhone finish">
          <span class="mono small">Finish</span>
          <div class="auth-swatch-row">
            ${FINISHES.map((f, idx) => `
              <button type="button" class="auth-swatch ${idx === finishIdx ? 'on' : ''}" data-swatch="${idx}" style="--sw:${f.hex}" aria-label="${esc(f.name)}" title="${esc(f.name)}"></button>
            `).join('')}
          </div>
        </div>

        <div class="auth-pillars">
          <div><span class="mono">GROUP SIZE</span><b>12 Slots / Batch</b></div>
          <div><span class="mono">SCHEDULE</span><b>End of Month + 5d Grace</b></div>
          <div><span class="mono">LEDGER</span><b>Verified Records</b></div>
        </div>
      </div>`;

    if (needsSetup) {
      page.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-card">
            <div class="auth-card-top">
              <div class="auth-brand-pill">${coinMark}<span>${esc(biz)}</span></div>
              ${soundBtn}
            </div>
            <div class="auth-head">
              <div class="kicker mono">First-time setup</div>
              <h1 class="display">Welcome to <em>PaluPhone</em></h1>
              <p class="muted">Set up your administrator account to start managing your iPhone paluwagan business.</p>
            </div>

            <form class="form" id="setupForm" novalidate>
              <label class="field">
                <span>Business / Shop Name</span>
                <div class="input-icon-wrap">
                  <span class="in-ico">${I.groups}</span>
                  <input name="business_name" value="${esc(biz)}" placeholder="e.g. PaluPhone PH" required />
                </div>
              </label>
              <label class="field">
                <span>Your Full Name</span>
                <div class="input-icon-wrap">
                  <span class="in-ico">${I.user}</span>
                  <input name="name" placeholder="Admin Seller Name" required />
                </div>
              </label>
              <label class="field">
                <span>Admin Username</span>
                <div class="input-icon-wrap">
                  <span class="in-ico">${I.key}</span>
                  <input name="username" placeholder="admin" required autocomplete="username" />
                </div>
              </label>
              <label class="field">
                <span>Admin Password (min. 6 characters)</span>
                <div class="input-icon-wrap has-toggle">
                  <span class="in-ico">${I.lock}</span>
                  <input name="password" type="password" minlength="6" placeholder="••••••••" required autocomplete="new-password" />
                  <button type="button" class="pw-toggle" data-toggle-pw aria-label="Show password">${I.eye}</button>
                </div>
              </label>
              <button class="btn btn-primary btn-block auth-submit" type="submit">${I.check} Complete Setup</button>
            </form>

            <div class="auth-foot">
              <span class="auth-foot-ico">${I.shield}</span>
              <p>Creates your local SQLite admin ledger for managing iPhone models, grace rules, fines, and member payouts.</p>
            </div>
          </div>
          ${showcaseHtml}
        </div>
      `;

      const f = page.querySelector('#setupForm');
      f.onsubmit = (e) => {
        e.preventDefault();
        if (!f.reportValidity()) return;
        const d = {
          business_name: f.business_name.value.trim(),
          name: f.name.value.trim(),
          username: f.username.value.trim(),
          password: f.password.value,
        };
        busy(f.querySelector('button[type=submit]'), async () => {
          try {
            const res = await api('/setup', { method: 'POST', body: d });
            session.set(res);
            state.me = res;
            toast('Setup complete! Welcome aboard.');
            sfx.success();
            onLogin && onLogin(res);
          } catch (err) {
            toast(err.message, 'err');
          }
        });
      };
    } else {
      page.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-card">
            <div class="auth-card-top">
              <div class="auth-brand-pill">${coinMark}<span>${esc(biz)}</span></div>
              ${soundBtn}
            </div>
            <div class="auth-head">
              <div class="kicker mono">${role === 'seller' ? 'Seller Console' : 'Customer Portal'}</div>
              <h1 class="display">Palu<em>Phone</em></h1>
              <p class="muted">iPhone Paluwagan Ledger &amp; Customer Portal</p>
            </div>

            <div class="seg seg-auth" role="tablist" aria-label="Account type">
              <button type="button" data-role="seller" class="${role === 'seller' ? 'on' : ''}">${I.key} Seller / Admin</button>
              <button type="button" data-role="member" class="${role === 'member' ? 'on' : ''}">${I.groups} Member Portal</button>
            </div>

            ${role === 'seller' ? `
              <form class="form" id="loginForm" novalidate>
                <label class="field">
                  <span>Username</span>
                  <div class="input-icon-wrap">
                    <span class="in-ico">${I.user}</span>
                    <input name="username" placeholder="admin" required autocomplete="username" />
                  </div>
                </label>
                <label class="field">
                  <span>Password</span>
                  <div class="input-icon-wrap has-toggle">
                    <span class="in-ico">${I.lock}</span>
                    <input name="password" type="password" placeholder="Enter your password" required autocomplete="current-password" />
                    <button type="button" class="pw-toggle" data-toggle-pw aria-label="Show password">${I.eye}</button>
                  </div>
                </label>
                <button class="btn btn-primary btn-block auth-submit" type="submit">Sign In as Seller</button>
              </form>
              <div class="auth-foot">
                <span class="auth-foot-ico">${I.shield}</span>
                <p>Manage iPhone batches, verify GCash/Maya payments, track 5-day grace periods &amp; fines, and record unit releases.</p>
              </div>
            ` : `
              <form class="form" id="loginForm" novalidate>
                <label class="field">
                  <span>Registered Mobile Number</span>
                  <div class="input-icon-wrap">
                    <span class="in-ico">${I.phone}</span>
                    <input name="phone" type="tel" inputmode="tel" placeholder="09XX XXX XXXX" required />
                  </div>
                </label>
                <label class="field">
                  <span>Member Security PIN (4–6 digits)</span>
                  <div class="input-icon-wrap has-toggle">
                    <span class="in-ico">${I.key}</span>
                    <input name="pin" type="password" inputmode="numeric" maxlength="6" pattern="\\d*" placeholder="••••" required />
                    <button type="button" class="pw-toggle" data-toggle-pw aria-label="Show PIN">${I.eye}</button>
                  </div>
                </label>
                <button class="btn btn-primary btn-block auth-submit" type="submit">Access Member Portal</button>
              </form>
              <div class="auth-foot">
                <span class="auth-foot-ico">${I.shield}</span>
                <p>Check your payout turn, month-end due dates, 5-day grace deadline, and official seller GCash/Maya accounts.</p>
              </div>
            `}
          </div>
          ${showcaseHtml}
        </div>
      `;

      page.querySelectorAll('[data-role]').forEach((b) => {
        b.onclick = () => {
          if (role === b.dataset.role) return;
          role = b.dataset.role;
          sfx.toggleSw(true);
          render();
        };
      });

      const f = page.querySelector('#loginForm');
      f.onsubmit = (e) => {
        e.preventDefault();
        if (!f.reportValidity()) return;
        const d = { role };
        if (role === 'seller') {
          d.username = f.username.value.trim();
          d.password = f.password.value;
        } else {
          d.phone = f.phone.value.trim();
          d.pin = f.pin.value.trim();
        }

        busy(f.querySelector('button[type=submit]'), async () => {
          try {
            const res = await api('/login', { method: 'POST', body: d });
            session.set(res);
            state.me = res;
            toast(`Logged in as ${res.name}`);
            sfx.success();
            onLogin && onLogin(res);
          } catch (err) {
            toast(err.message, 'err');
          }
        });
      };
    }

    // Wire password / PIN visibility toggle
    page.querySelectorAll('[data-toggle-pw]').forEach((btn) => {
      btn.onclick = () => {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = show ? I.eyeOff : I.eye;
        btn.setAttribute('aria-label', show ? 'Hide value' : 'Show value');
        sfx.tick();
      };
    });

    // Wire sound toggle on auth card
    const sBtn = page.querySelector('[data-sound-toggle]');
    if (sBtn) {
      sBtn.onclick = () => {
        sfx.toggle();
        sBtn.innerHTML = sfx.muted ? I.soundOff : I.soundOn;
        sBtn.setAttribute('aria-label', sfx.muted ? 'Unmute sound' : 'Mute sound');
        window.dispatchEvent(new Event('palu:sound'));
      };
    }

    // Mount 3D iPhone scene inside the showcase card
    const sideEl = page.querySelector('#auth3d');
    let scene = null;
    if (sideEl) {
      scene = track(new PhoneScene(sideEl, {
        color: curFinish.hex,
        pro: true,
        coins: 12,
        filled: 7,
        intro: firstRender,
        cameraZ: 9.2,
        screen: {
          title: biz,
          kicker: role === 'seller' ? 'Seller Ledger' : 'Member Portal',
          sub: curFinish.name,
          accent: curFinish.accent,
        },
      }));
    }
    firstRender = false;

    // Wire interactive finish swatches
    const finishLabel = page.querySelector('.auth-finish-label');
    page.querySelectorAll('[data-swatch]').forEach((btn) => {
      btn.onclick = () => {
        finishIdx = Number(btn.dataset.swatch);
        const f = FINISHES[finishIdx];
        page.querySelectorAll('[data-swatch]').forEach((x) => x.classList.toggle('on', x === btn));
        if (finishLabel) finishLabel.textContent = f.name;
        if (scene) {
          scene.setColor(f.hex);
          scene.updateScreen({ sub: f.name, accent: f.accent });
        }
        sfx.tick();
      };
    });
  };

  render();
  piso.setTips([
    { text: 'Sellers log in with their username and password.' },
    { text: 'Members can track their turns and payments with their phone number and secret PIN!', mood: 'grin' },
  ]);
}
