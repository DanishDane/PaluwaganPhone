// Authentication view: setup & login (seller / member)
import { api, session } from './api.js';
import { sfx } from './sound.js';
import { piso } from './mascot.js';
import { state, track } from './state.js';
import { I } from './icons.js';
import { PhoneScene } from './three-phone.js';
import { esc, toast, busy } from './ui.js';

export function viewAuth(page, { needsSetup = false, onLogin }) {
  let role = 'seller'; // 'seller' | 'member'

  const render = () => {
    if (needsSetup) {
      page.innerHTML = `
        <div class="auth-wrap">
          <div class="auth-card">
            <div class="auth-head">
              <div class="coin-mark-wrap">${I.phone}</div>
              <h1 class="display">Welcome to <em>PaluPhone</em></h1>
              <p class="muted">Set up your administrator account to start managing your iPhone paluwagan business.</p>
            </div>

            <form class="form" id="setupForm" novalidate>
              <label class="field">
                <span>Business / Shop Name</span>
                <input name="business_name" value="${esc(state.meta?.business_name || 'PaluPhone')}" placeholder="e.g. PaluPhone PH" required />
              </label>
              <label class="field">
                <span>Your Full Name</span>
                <input name="name" placeholder="Admin Seller Name" required />
              </label>
              <label class="field">
                <span>Admin Username</span>
                <input name="username" placeholder="admin" required autocomplete="username" />
              </label>
              <label class="field">
                <span>Admin Password (min. 6 characters)</span>
                <input name="password" type="password" minlength="6" required autocomplete="new-password" />
              </label>
              <button class="btn btn-primary btn-block" type="submit">${I.check} Complete Setup</button>
            </form>
          </div>
          <div class="auth-side" id="auth3d"></div>
        </div>
      `;

      const f = page.querySelector('#setupForm');
      f.onsubmit = (e) => {
        e.preventDefault();
        const d = {
          business_name: f.business_name.value.trim(),
          name: f.name.value.trim(),
          username: f.username.value.trim(),
          password: f.password.value,
        };
        busy(f.querySelector('button'), async () => {
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
            <div class="auth-head">
              <div class="coin-mark-wrap">${I.phone}</div>
              <h1 class="display">Palu<em>Phone</em></h1>
              <p class="muted">iPhone Paluwagan Ledger &amp; Customer Portal</p>
            </div>

            <div class="seg seg-auth">
              <button data-role="seller" class="${role === 'seller' ? 'on' : ''}">Seller / Admin</button>
              <button data-role="member" class="${role === 'member' ? 'on' : ''}">Member Portal</button>
            </div>

            ${role === 'seller' ? `
              <form class="form" id="loginForm" novalidate>
                <label class="field">
                  <span>Username</span>
                  <input name="username" placeholder="admin" required autocomplete="username" />
                </label>
                <label class="field">
                  <span>Password</span>
                  <input name="password" type="password" required autocomplete="current-password" />
                </label>
                <button class="btn btn-primary btn-block" type="submit">Sign In as Seller</button>
              </form>
            ` : `
              <form class="form" id="loginForm" novalidate>
                <label class="field">
                  <span>Registered Mobile Number</span>
                  <input name="phone" type="tel" inputmode="tel" placeholder="09XX XXX XXXX" required />
                </label>
                <label class="field">
                  <span>Member Security PIN (4–6 digits)</span>
                  <input name="pin" type="password" inputmode="numeric" maxlength="6" pattern="\\d*" placeholder="••••" required />
                </label>
                <p class="muted small">Your seller provides your secure PIN upon adding you to an iPhone group.</p>
                <button class="btn btn-primary btn-block" type="submit">Access Member Portal</button>
              </form>
            `}
          </div>
          <div class="auth-side" id="auth3d"></div>
        </div>
      `;

      page.querySelectorAll('[data-role]').forEach((b) => {
        b.onclick = () => {
          role = b.dataset.role;
          sfx.toggleSw(true);
          render();
        };
      });

      const f = page.querySelector('#loginForm');
      f.onsubmit = (e) => {
        e.preventDefault();
        const d = { role };
        if (role === 'seller') {
          d.username = f.username.value.trim();
          d.password = f.password.value;
        } else {
          d.phone = f.phone.value.trim();
          d.pin = f.pin.value.trim();
        }

        busy(f.querySelector('button'), async () => {
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

    const sideEl = page.querySelector('#auth3d');
    if (sideEl) {
      track(new PhoneScene(sideEl, {
        color: '#2b2b2e',
        pro: true,
        coins: 12,
        filled: 7,
        cameraZ: 8.4,
        screen: {
          title: state.meta?.business_name || 'PaluPhone',
          kicker: 'iPhone Hulugan',
          sub: 'End of month + 5d grace',
        },
      }));
    }
  };

  render();
  piso.setTips([
    { text: 'Sellers log in with their username and password.' },
    { text: 'Members can track their turns and payments with their phone number and secret PIN!', mood: 'grin' },
  ]);
}

