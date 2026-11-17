// Modals: group form, member form, payments, member detail, payouts
import { api } from './api.js';
import { sfx } from './sound.js';
import { piso } from './mascot.js';
import { state } from './state.js';
import { I } from './icons.js';
import { IPHONES, STORAGE, COLORS, METHODS } from './data.js';
import { proofField, wireProofInput, viewProof } from './payment-proofs.js';
import { correctRelease } from './monthly-draw.js';
import { esc, peso, monthShort, monthLong, dateNice, chip, HEALTH, STATUS, toast, modal, confirmBox, formData, busy, confetti, stamp, initials } from './ui.js';

export const changed = () => window.dispatchEvent(new Event('palu:changed'));
const today = () => state.today || new Date().toISOString().slice(0, 10);

// ======================= GROUP FORM =======================
export function groupForm(existing = null) {
  const g = existing || {};
  const s = state.settings || {};
  const ym = today().slice(0, 7);
  const colorOpts = COLORS.map(([n, h]) => `<option value="${esc(n)}" data-hex="${h}" ${g.color === n ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const body = `
  <form class="form" novalidate>
    <div class="form-cols">
      <div>
        <div class="fieldset-title mono">01 — The iPhone</div>
        <label class="field"><span>iPhone model</span>
          <input name="model" list="dl-models" placeholder="e.g. iPhone 11" value="${esc(g.model || '')}" required autocomplete="off"/>
          <datalist id="dl-models">${IPHONES.map((m) => `<option value="${m}">`).join('')}</datalist>
        </label>
        <div class="row2">
          <label class="field"><span>Storage</span><select name="storage"><option value="">—</option>${STORAGE.map((x) => `<option ${g.storage === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label class="field"><span>Color</span><div class="color-pick"><i class="swatch"></i><select name="color"><option value="">—</option>${colorOpts}</select></div></label>
        </div>
        <label class="field"><span>Variant / condition <em>optional</em></span><input name="variant" placeholder="e.g. Brand new · PH set · Factory unlocked" value="${esc(g.variant || '')}"/></label>
        <label class="field"><span>Group name</span><input name="name" placeholder="e.g. iPhone 11 — Batch 1" value="${esc(g.name || '')}" required/></label>
      </div>
      <div>
        <div class="fieldset-title mono">02 — The paluwagan</div>
        <div class="row2">
          <label class="field"><span>Total price (₱)</span><input name="price" type="number" inputmode="decimal" min="1" step="any" placeholder="30000" value="${g.price ?? ''}" required/></label>
          <label class="field"><span>Members / months</span><input name="slots" type="number" inputmode="numeric" min="2" max="50" step="1" value="${g.slots ?? 12}" required/></label>
        </div>
        <div class="row2">
          <label class="field"><span>Monthly hulog (₱)</span><input name="monthly" type="number" inputmode="decimal" min="1" step="any" placeholder="auto" value="${existing ? g.monthly : ''}"/></label>
          <label class="field"><span>Start month</span><input name="start_month" type="month" value="${esc(g.start_month || ym)}" required/></label>
        </div>
        <div class="fieldset-title mono">03 — Deadline &amp; fines</div>
        <div class="row3">
          <label class="field"><span>Grace days</span><input name="grace_days" type="number" min="0" max="28" step="1" value="${g.grace_days ?? s.default_grace ?? 5}"/></label>
          <label class="field"><span>Late fine (₱)</span><input name="fine_amount" type="number" min="0" step="any" value="${g.fine_amount ?? s.default_fine ?? 100}"/></label>
          <label class="field"><span>+ per day (₱)</span><input name="fine_per_day" type="number" min="0" step="any" value="${g.fine_per_day ?? s.default_fine_per_day ?? 0}"/></label>
        </div>
      </div>
    </div>
    <div class="preview-card"><div class="mono kicker">Preview</div><p class="preview-text"></p></div>
    <label class="field"><span>Notes <em>optional</em></span><textarea name="notes" rows="2" placeholder="Anything to remember about this group">${esc(g.notes || '')}</textarea></label>
    <div class="form-actions">
      <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
      <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Create group'}</button>
    </div>
  </form>`;

  modal({
    title: existing ? 'Edit group' : 'New <em>paluwagan</em> group',
    kicker: existing ? g.name : 'Set up an iPhone batch',
    body,
    wide: true,
    onMount(el, close) {
      const f = el.querySelector('form');
      const sw = el.querySelector('.swatch');
      const pv = el.querySelector('.preview-text');
      let nameTouched = !!existing;
      f.name.addEventListener('input', () => { nameTouched = true; });
      const update = () => {
        const opt = f.color.selectedOptions[0];
        sw.style.background = (opt && opt.dataset.hex) || 'transparent';
        if (!nameTouched && f.model.value) f.name.value = `${f.model.value}${f.storage.value ? ' ' + f.storage.value : ''} — Batch ${new Date().toLocaleString('en', { month: 'short' })}`;
        const price = Number(f.price.value) || 0, slots = Math.max(0, parseInt(f.slots.value) || 0);
        const auto = slots ? Math.round((price / slots) * 100) / 100 : 0;
        f.monthly.placeholder = auto ? `auto: ${auto}` : 'auto';
        const monthly = Number(f.monthly.value) || auto;
        const gd = parseInt(f.grace_days.value) || 0;
        const fine = Number(f.fine_amount.value) || 0, fpd = Number(f.fine_per_day.value) || 0;
        const sm = f.start_month.value;
        let end = '';
        if (sm && slots) {
          const [y, m] = sm.split('-').map(Number);
          const idx = y * 12 + m - 1 + slots - 1;
          end = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
        }
        pv.innerHTML = price && slots
          ? `<b>${slots} members</b> pay <b>${peso(monthly)}</b> every end of month for <b>${slots} months</b> (${monthShort(sm)} → ${monthShort(end)}). Each month, one member takes home the <b>${esc(f.model.value || 'iPhone')}</b>. Payments are accepted until <b>${gd} day${gd === 1 ? '' : 's'}</b> after month-end; after that, a <b>${peso(fine)}</b> fine${fpd ? ` + ${peso(fpd)}/day` : ''} applies.${Math.abs(monthly * slots - price) > 1 ? ` <span class="warn-text">Total collected per member: ${peso(monthly * slots)} (price is ${peso(price)}).</span>` : ''}`
          : 'Fill in the price and number of members to see the breakdown.';
      };
      f.addEventListener('input', update);
      f.addEventListener('change', update);
      update();
      el.querySelector('[data-cancel]').onclick = close;
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(f);
        const opt = f.color.selectedOptions[0];
        d.color_hex = (opt && opt.dataset.hex) || '#2b2b2e';
        const btn = f.querySelector('[type=submit]');
        busy(btn, async () => {
          try {
            if (existing) await api(`/groups/${existing.id}`, { method: 'PUT', body: d });
            else {
              const r = await api('/groups', { method: 'POST', body: d });
              d.id = r.id;
            }
            close();
            sfx.success();
            toast(existing ? 'Group updated' : 'Group created');
            if (!existing) {
              confetti();
              piso.celebrate(`New group "${d.name}" ready! Add members na tayo.`);
              location.hash = `/groups/${d.id}`;
            }
            changed();
          } catch (err) {
            toast(err.message, 'err');
            piso.worry(err.message);
          }
        });
      });
    },
  });
}

// ======================= MEMBER FORM =======================
export function memberForm(group, existing = null, preferredOrder = null) {
  const m = existing || {};
  const taken = new Set((group.members || []).filter((x) => x.id !== m.id).map((x) => x.payout_order));
  const orders = [];
  for (let i = 1; i <= group.slots; i++) {
    const ym = addMonths(group.start_month, i - 1);
    const holder = (group.members || []).find((x) => x.payout_order === i && x.id !== m.id);
    if (existing || !taken.has(i)) orders.push(`<option value="${i}" ${(m.payout_order || preferredOrder) === i ? 'selected' : ''}>Member slot #${i}${holder ? ` (swap with ${esc(holder.name)})` : ''}</option>`);
  }
  const genPin = () => String(Math.floor(1000 + Math.random() * 9000));
  modal({
    title: existing ? `Edit <em>${esc(m.name)}</em>` : 'Add a member',
    kicker: `${group.name} · ${group.model}`,
    body: `
    <form class="form" novalidate>
      <label class="field"><span>Full name</span><input name="name" value="${esc(m.name || '')}" placeholder="Juan Dela Cruz" required autocomplete="off"/></label>
      <div class="row2">
        <label class="field"><span>Mobile number</span><input name="phone" type="tel" inputmode="tel" value="${esc(m.phone || '')}" placeholder="09XX XXX XXXX" required/></label>
        <label class="field"><span>Login PIN ${existing ? '<em>leave blank to keep</em>' : ''}</span><div class="input-btn"><input name="pin" inputmode="numeric" maxlength="6" pattern="\\d*" value="${existing ? '' : genPin()}" placeholder="4–6 digits"/><button type="button" class="btn btn-ghost btn-sm" data-gen>${I.replay}</button></div></label>
      </div>
      <label class="field"><span>Member slot <em>release month is decided by the monthly draw</em></span><select name="payout_order">${orders.join('')}</select></label>
      <label class="field"><span>Address <em>optional</em></span><input name="address" value="${esc(m.address || '')}" placeholder="Barangay, City"/></label>
      <label class="field"><span>Notes <em>optional</em></span><textarea name="notes" rows="2">${esc(m.notes || '')}</textarea></label>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">${existing ? 'Save' : 'Add member'}</button></div>
    </form>`,
    onMount(el, close) {
      const f = el.querySelector('form');
      el.querySelector('[data-cancel]').onclick = close;
      el.querySelector('[data-gen]').onclick = () => { f.pin.value = genPin(); sfx.tick(); };
      f.pin.addEventListener('input', () => { f.pin.value = f.pin.value.replace(/\D/g, '').slice(0, 6); });
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const d = formData(f);
        d.payout_order = Number(d.payout_order);
        if (existing && !d.pin) delete d.pin;
        busy(f.querySelector('[type=submit]'), async () => {
          try {
            if (existing) await api(`/members/${m.id}`, { method: 'PUT', body: d });
            else await api(`/groups/${group.id}/members`, { method: 'POST', body: d });
            close();
            sfx.success();
            toast(existing ? 'Member updated' : `${d.name} added`);
            if (!existing || d.pin) credentialsModal(d.name, d.phone, d.pin);
            if (!existing) piso.say(`Welcome sa group, ${d.name.split(' ')[0]}! Included na sa monthly draw kapag verified na ang hulog ng lahat.`, { mood: 'grin' });
            changed();
          } catch (err) {
            toast(err.message, 'err');
          }
        });
      });
    },
  });
}

function credentialsModal(name, phone, pin) {
  if (!pin) return;
  const url = location.origin;
  const text = `Hi ${name}! Ito ang login mo sa ${state.meta?.business_name || 'PaluPhone'} paluwagan portal:\n${url}\nMobile: ${phone}\nPIN: ${pin}`;
  modal({
    title: 'Member <em>login</em>',
    kicker: 'Share with the member',
    receipt: true,
    body: `
      <div class="cred">
        <div class="cred-row"><span class="mono">PORTAL</span><b>${esc(url)}</b></div>
        <div class="cred-row"><span class="mono">MOBILE</span><b>${esc(phone)}</b></div>
        <div class="cred-row"><span class="mono">PIN</span><b class="cred-pin">${esc(pin)}</b></div>
      </div>
      <p class="muted small">Members can check payments, due dates and draw/release status using this login. The PIN is stored securely and can't be viewed again — reset it anytime.</p>
      <div class="form-actions"><a class="btn btn-ghost" href="sms:${esc(phone)}?body=${encodeURIComponent(text)}">${I.sms} Send via SMS</a><button class="btn btn-primary" data-copy>Copy details</button></div>`,
    onMount(el, close) {
      el.querySelector('[data-copy]').onclick = async () => {
        try { await navigator.clipboard.writeText(text); toast('Copied to clipboard'); close(); } catch { toast('Copy not available — please write it down.', 'info'); }
      };
    },
  });
}

// ======================= PAYMENT =======================
export async function paymentModal({ member_id = null, period = null } = {}) {
  let members;
  try { members = await api('/members'); } catch (e) { toast(e.message, 'err'); return; }
  if (!members.length) {
    toast('Add members to a group first.', 'info');
    piso.say('Wala pang members. Create a group then add members first!', { mood: 'worried' });
    return;
  }
  const byGroup = {};
  for (const m of members) (byGroup[m.group] ||= []).push(m);
  const opts = Object.entries(byGroup).map(([g, ms]) => `<optgroup label="${esc(g)}">${ms.map((m) => `<option value="${m.id}" ${m.id === member_id ? 'selected' : ''}>${esc(m.name)} · #${m.payout_order}${m.summary.overdueCount ? ' ⚠' : ''}</option>`).join('')}</optgroup>`).join('');

  modal({
    title: 'Record <em>payment</em>',
    kicker: 'Official receipt',
    receipt: true,
    body: `
    <form class="form" novalidate>
      <label class="field"><span>Member</span><select name="member_id">${member_id ? '' : '<option value="">Select member…</option>'}${opts}</select></label>
      <label class="field"><span>For the month of</span><select name="period" disabled><option>Select a member first</option></select></label>
      <div class="row2">
        <label class="field"><span>Date paid</span><input type="date" name="paid_on" value="${today()}" max="${today()}"/></label>
        <label class="field"><span>Method</span><select name="method">${METHODS.map((x) => `<option>${x}</option>`).join('')}</select></label>
      </div>
      <div class="row2">
        <label class="field"><span>Hulog amount (₱)</span><input type="number" name="amount" min="0" step="any" inputmode="decimal"/></label>
        <label class="field"><span>Fine paid (₱)</span><input type="number" name="fine" min="0" step="any" inputmode="decimal" value="0"/></label>
      </div>
      <div class="row2">
        <label class="field"><span>Reference # <em>required for non-cash payments</em></span><input name="ref" placeholder="GCash ref no."/></label>
        <label class="field"><span>Note <em>optional</em></span><input name="note"/></label>
      </div>
      ${proofField()}
      <div class="receipt-sum"></div>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-primary" disabled>${I.check} Record payment</button></div>
    </form>`,
    onMount(el, close) {
      const f = el.querySelector('form');
      const sum = el.querySelector('.receipt-sum');
      const submit = f.querySelector('[type=submit]');
      const readProof = wireProofInput(el);
      const proofInput = el.querySelector('[data-proof-file]');
      const updateProofRequirement = () => {
        proofInput.required = f.method.value !== 'Cash';
        f.ref.required = f.method.value !== 'Cash';
      };
      f.method.addEventListener('change', updateProofRequirement);
      updateProofRequirement();
      el.querySelector('[data-cancel]').onclick = close;
      let detail = null;
      let quote = null;
      let seq = 0;

      const renderSum = () => {
        if (!detail || !quote) { sum.innerHTML = ''; return; }
        const p = detail.periods.find((x) => x.period === f.period.value);
        if (!p) { sum.innerHTML = ''; return; }
        const amt = Number(f.amount.value) || 0, fine = Number(f.fine.value) || 0;
        const lateDays = Math.max(0, Math.round((Date.parse(f.paid_on.value) - Date.parse(p.deadline)) / 86400000));
        sum.innerHTML = `
          <div class="rs-line"><span>Monthly hulog · ${monthLong(p.period)}</span><b>${peso(detail.group.monthly)}</b></div>
          <div class="rs-line"><span>Already paid</span><b>${peso(p.paid)}</b></div>
          <div class="rs-line"><span>Remaining balance</span><b>${peso(quote.balance)}</b></div>
          <div class="rs-line"><span>Deadline (incl. ${detail.group.grace_days}-day grace)</span><b>${dateNice(quote.deadline)}</b></div>
          <div class="rs-line ${quote.fine > 0 ? 'rs-warn' : ''}"><span>Fine ${quote.waived ? '(waived)' : lateDays > 0 ? `(${lateDays} day${lateDays > 1 ? 's' : ''} late)` : '(on time)'}</span><b>${peso(quote.fine)}</b></div>
          <div class="rs-total"><span>Collecting now</span><b>${peso(amt + fine)}</b></div>`;
        submit.disabled = !(amt > 0 || fine > 0);
      };

      const loadQuote = async () => {
        const my = ++seq;
        if (!f.member_id.value || !f.period.value) return;
        try {
          const q = await api(`/quote?member_id=${f.member_id.value}&period=${f.period.value}&date=${f.paid_on.value}`);
          if (my !== seq) return;
          quote = q;
          f.amount.value = q.balance;
          f.fine.value = q.fine;
          renderSum();
        } catch (e) { toast(e.message, 'err'); }
      };

      const loadMember = async () => {
        detail = null; quote = null;
        renderSum();
        f.period.disabled = true;
        submit.disabled = true;
        if (!f.member_id.value) { f.period.innerHTML = '<option>Select a member first</option>'; return; }
        try {
          detail = await api(`/members/${f.member_id.value}`);
        } catch (e) { toast(e.message, 'err'); return; }
        const open = detail.periods.filter((p) => p.balance > 0 || p.fineBalance > 0);
        if (!open.length) {
          f.period.innerHTML = '<option value="">All months fully paid 🎉</option>';
          sum.innerHTML = `<div class="rs-done">${esc(detail.name)} has completed all ${detail.periods.length} payments.</div>`;
          return;
        }
        f.period.innerHTML = open.map((p) => `<option value="${p.period}">${monthLong(p.period)} · ${STATUS[p.status].label}${p.balance > 0 ? ` · ${peso(p.balance)} left` : ` · fine ${peso(p.fineBalance)}`}</option>`).join('');
        if (period && open.some((p) => p.period === period)) f.period.value = period;
        f.period.disabled = false;
        await loadQuote();
      };

      f.member_id.addEventListener('change', loadMember);
      f.period.addEventListener('change', loadQuote);
      f.paid_on.addEventListener('change', loadQuote);
      f.amount.addEventListener('input', renderSum);
      f.fine.addEventListener('input', renderSum);
      if (f.member_id.value) loadMember();

      f.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!f.reportValidity()) return;
        const d = formData(f);
        busy(submit, async () => {
          try {
            d.proof = await readProof();
            await api('/payments', { method: 'POST', body: d, timeout: 60000 });
            close();
            const full = Number(d.amount) >= (quote ? quote.balance : 0) - 0.005 && Number(d.amount) > 0;
            stamp(full ? 'PAID' : Number(d.amount) > 0 ? 'PARTIAL' : 'FINE PAID', full ? 'var(--green)' : 'var(--accent)');
            setTimeout(() => { sfx.coin(); confetti(window.innerWidth / 2, window.innerHeight * 0.45); }, 350);
            setTimeout(() => sfx.success(), 650);
            piso.celebrate(`${peso(Number(d.amount) + Number(d.fine || 0))} from ${detail.name.split(' ')[0]} — recorded! 🎉`);
            changed();
          } catch (err) {
            toast(err.message, 'err');
          }
        });
      });
    },
  });
}

// ======================= MEMBER DETAIL =======================
export async function memberDetail(id) {
  let m;
  try { m = await api(`/members/${id}`); } catch (e) { toast(e.message, 'err'); return; }
  const g = m.group;
  const s = m.summary;
  const biz = state.meta?.business_name || 'PaluPhone';
  const remindText = s.next
    ? `Hi ${m.name.split(' ')[0]}! Friendly reminder po from ${biz} 📱 Your paluwagan hulog for ${monthLong(s.next.period)} is ${peso(s.next.balance + (s.next.fineDue || 0))}. Deadline: ${dateNice(s.next.deadline)}. Salamat po!`
    : `Hi ${m.name.split(' ')[0]}! Salamat po for completing your paluwagan with ${biz}! 🎉`;

  const rows = m.periods.map((p) => `
    <div class="tl-row ${p.status} ${p.isPayout ? 'is-payout' : ''}">
      <div class="tl-idx mono">${String(p.index).padStart(2, '0')}</div>
      <div class="tl-main">
        <div class="tl-month">${monthLong(p.period)} ${p.isPayout ? `<span class="badge-payout">${I.gift} payout</span>` : ''}</div>
        <div class="tl-sub mono">due ${dateNice(p.due)} · last day ${dateNice(p.deadline)}</div>
      </div>
      <div class="tl-amt">
        ${chip(p.status)}
        <div class="tl-sub mono">${p.paid > 0 ? `paid ${peso(p.paid)}` : ''}${p.balance > 0 && p.status !== 'future' ? ` · ${peso(p.balance)} left` : ''}${p.fineDue > 0 ? ` · fine ${peso(p.fineDue)}${p.fineBalance > 0 ? ' unpaid' : ' paid'}` : ''}${p.waived ? ' · fine waived' : ''}</div>
      </div>
      <div class="tl-act">
        ${(p.balance > 0 && p.status !== 'future') || p.fineBalance > 0 ? `<button class="btn btn-sm btn-primary" data-pay="${p.period}">Pay</button>` : ''}
        ${p.status === 'future' && p.balance > 0 ? `<button class="btn btn-sm btn-ghost" data-pay="${p.period}">Advance</button>` : ''}
        ${p.fineBalance > 0 && !p.waived ? `<button class="btn btn-sm btn-ghost" data-waive="${p.period}">Waive fine</button>` : ''}
        ${p.waived ? `<button class="btn btn-sm btn-ghost" data-unwaive="${p.period}">Undo waive</button>` : ''}
      </div>
    </div>`).join('');

  const pays = m.periods.flatMap((p) => p.payments).sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1));
  const payRows = pays.length ? pays.map((p) => `
    <tr><td>${dateNice(p.paid_on)}</td><td>${monthShort(p.period)}</td><td class="num">${peso(p.amount)}</td><td class="num">${p.fine ? peso(p.fine) : '—'}</td><td>${esc(p.method || '')}${p.ref ? ` <span class="muted mono small">#${esc(p.ref)}</span>` : ''}${p.proof_id ? `<button class="btn btn-ghost btn-sm" data-proof="${p.proof_id}">View receipt</button>` : ''}</td><td><button class="icon-btn danger" data-delpay="${p.id}" title="Void payment">${I.trash}</button></td></tr>`).join('')
    : `<tr><td colspan="6" class="muted center">No payments yet.</td></tr>`;

  modal({
    title: esc(m.name),
    kicker: `${g.name} · Member #${m.payout_order}`,
    wide: true,
    body: `
      <div class="md-head">
        <div class="avatar avatar-lg" style="--c:${esc(g.color_hex)}">${esc(initials(m.name))}</div>
        <div class="md-meta">
          <div>${chip(s.health, HEALTH)} <span class="mono small muted">${esc(m.phone)}</span></div>
          <div class="muted small">${esc(g.model)} ${esc(g.storage || '')} ${esc(g.color || '')} ${m.address ? '· ' + esc(m.address) : ''}</div>
        </div>
        <div class="md-actions">
          <a class="btn btn-ghost btn-sm" href="tel:${esc(m.phone)}">${I.phone} Call</a>
          <a class="btn btn-ghost btn-sm" href="sms:${esc(m.phone)}?body=${encodeURIComponent(remindText)}">${I.sms} Remind</a>
          <button class="btn btn-ghost btn-sm" data-edit>${I.edit} Edit</button>
          <button class="btn btn-ghost btn-sm danger" data-remove>${I.trash}</button>
        </div>
      </div>
      <div class="stat-row">
        <div class="mini-stat"><span class="mono">PAID MONTHS</span><b>${s.paidCount}<small>/${s.totalPeriods}</small></b><div class="bar"><i style="width:${(s.paidCount / s.totalPeriods) * 100}%"></i></div></div>
        <div class="mini-stat"><span class="mono">TOTAL PAID</span><b>${peso(s.totalPaid)}</b><small class="muted">${peso(s.remaining)} to go</small></div>
        <div class="mini-stat ${s.outstanding > 0 ? 'hot' : ''}"><span class="mono">DUE NOW</span><b>${peso(s.outstanding)}</b><small class="muted">${s.overdueCount ? `${s.overdueCount} overdue month${s.overdueCount > 1 ? 's' : ''}` : 'no overdue'}</small></div>
        <div class="mini-stat ${s.fineBalance > 0 ? 'hot' : ''}"><span class="mono">FINES OWED</span><b>${peso(s.fineBalance)}</b><small class="muted">${peso(s.totalFinesPaid)} paid</small></div>
      </div>
      <div class="payout-strip ${s.payoutReleased ? 'done' : ''}">
        <div>${I.gift}</div>
        <div><b>${s.payoutReleased ? `iPhone released ${dateNice(s.payout.released_on)}` : s.payoutSelected ? `Selected for ${monthLong(s.payoutPeriod)} · awaiting release` : 'Awaiting monthly draw'}</b>
        <div class="muted small">${s.payoutReleased ? (s.payout.imei ? `IMEI/Serial: ${esc(s.payout.imei)}` : 'No IMEI recorded') : s.payoutSelected ? 'Excluded from future draws. Monthly payments continue.' : 'Eligible until selected or released.'}</div></div>
        <div>${s.payoutReleased ? `<button class="btn btn-sm btn-ghost" data-unrelease>Correct release</button>` : s.payoutSelected ? `<button class="btn btn-sm btn-ink" data-release>Mark released</button>` : ''}</div>
      </div>
      <div class="md-cols">
        <div><h4 class="sec-title">Monthly timeline</h4><div class="timeline">${rows}</div></div>
        <div><h4 class="sec-title">Payment history</h4><div class="table-wrap"><table class="table compact"><thead><tr><th>Date</th><th>For</th><th class="num">Amount</th><th class="num">Fine</th><th>Via</th><th></th></tr></thead><tbody>${payRows}</tbody></table></div>
        ${m.notes ? `<h4 class="sec-title">Notes</h4><p class="muted">${esc(m.notes)}</p>` : ''}</div>
      </div>`,
    onMount(el, close) {
      const reopen = () => { close(); changed(); setTimeout(() => memberDetail(id), 340); };
      el.querySelectorAll('[data-proof]').forEach(button => { button.onclick = () => viewProof(button.dataset.proof); });
      el.querySelectorAll('[data-pay]').forEach((b) => (b.onclick = () => { close(); paymentModal({ member_id: m.id, period: b.dataset.pay }); }));
      el.querySelectorAll('[data-waive]').forEach((b) => (b.onclick = async () => {
        if (!(await confirmBox({ title: 'Waive this fine?', text: `The late fine for ${monthLong(b.dataset.waive)} will be removed.`, ok: 'Waive fine' }))) return;
        try { await api('/waivers', { method: 'POST', body: { member_id: m.id, period: b.dataset.waive } }); toast('Fine waived'); reopen(); } catch (e) { toast(e.message, 'err'); }
      }));
      el.querySelectorAll('[data-unwaive]').forEach((b) => (b.onclick = async () => {
        try { await api(`/waivers?member_id=${m.id}&period=${b.dataset.unwaive}`, { method: 'DELETE' }); toast('Waiver removed'); reopen(); } catch (e) { toast(e.message, 'err'); }
      }));
      el.querySelectorAll('[data-delpay]').forEach((b) => (b.onclick = async () => {
        if (!(await confirmBox({ title: 'Void this payment?', text: 'This removes the payment record permanently.', ok: 'Void payment', danger: true }))) return;
        try { await api(`/payments/${b.dataset.delpay}`, { method: 'DELETE' }); toast('Payment voided'); reopen(); } catch (e) { toast(e.message, 'err'); }
      }));
      el.querySelector('[data-edit]').onclick = async () => {
        close();
        try { const full = await api(`/groups/${g.id}`); memberForm(full, full.members.find((x) => x.id === m.id)); } catch (e) { toast(e.message, 'err'); }
      };
      el.querySelector('[data-remove]').onclick = async () => {
        if (!(await confirmBox({ title: `Remove ${m.name}?`, text: 'All of their payment records in this group will also be deleted. This cannot be undone.', ok: 'Remove member', danger: true }))) return;
        try { await api(`/members/${m.id}`, { method: 'DELETE' }); close(); toast('Member removed'); changed(); } catch (e) { toast(e.message, 'err'); }
      };
      const rel = el.querySelector('[data-release]');
      if (rel) rel.onclick = () => { close(); payoutModal(m); };
      const unrel = el.querySelector('[data-unrelease]');
      if (unrel) unrel.onclick = () => correctRelease(m.id, reopen);
    },
  });
}

// ======================= PAYOUT =======================
export function payoutModal(m) {
  const s = m.summary;
  modal({
    title: 'Release <em>iPhone</em>',
    kicker: `${m.name} · ${s.payoutPeriod ? monthLong(s.payoutPeriod) + ' winner' : 'Monthly draw'}`,
    receipt: true,
    body: `
      <form class="form">
        ${s.outstanding > 0 || s.fineBalance > 0 ? `<div class="alert-box">${I.alert}<span>${esc(m.name)} still has ${peso(s.outstanding)} due and ${peso(s.fineBalance)} in fines.</span></div>` : ''}
        <label class="field"><span>Release date</span><input type="date" name="released_on" value="${today()}"/></label>
        <label class="field"><span>IMEI / Serial <em>optional</em></span><input name="imei" placeholder="35XXXXXXXXXXXXX"/></label>
        <label class="field"><span>Note <em>optional</em></span><input name="note" placeholder="e.g. Picked up at store"/></label>
        <div class="form-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">${I.gift} Confirm release</button></div>
      </form>`,
    onMount(el, close) {
      const f = el.querySelector('form');
      el.querySelector('[data-cancel]').onclick = close;
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        busy(f.querySelector('[type=submit]'), async () => {
          try {
            await api('/payouts', { method: 'POST', body: { member_id: m.id, ...formData(f) } });
            close();
            stamp('RELEASED', 'var(--accent)');
            setTimeout(() => { confetti(); sfx.success(); }, 300);
            piso.celebrate(`Congrats ${m.name.split(' ')[0]}! May bagong iPhone na! 📱✨`);
            changed();
          } catch (err) { toast(err.message, 'err'); }
        });
      });
    },
  });
}

export function addMonths(ym, k) {
  const [y, m] = ym.split('-').map(Number);
  const idx = y * 12 + (m - 1) + k;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

