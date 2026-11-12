// Seller views
import { api, download, session } from './api.js';
import { sfx } from './sound.js';
import { piso } from './mascot.js';
import { state, track, go, greeting } from './state.js';
import { I } from './icons.js';
import { isPro } from './data.js';
import { PhoneScene } from './three-phone.js';
import { esc, peso, monthShort, monthLong, dateNice, chip, HEALTH, STATUS, toast, confirmBox, formData, busy, countUp, wireTilt, empty, initials, daysBetween } from './ui.js';
import { groupForm, memberForm, paymentModal, memberDetail, payoutModal, addMonths } from './modals.js';

const smsLink = (phone, text) => `sms:${esc(phone)}?body=${encodeURIComponent(text)}`;

// ======================= DASHBOARD =======================
export async function viewDashboard(page) {
  const d = await api('/dashboard');
  state.today = d.today;
  const t = d.totals;
  const biz = state.meta.business_name;
  const firstName = (state.me?.name || '').split(' ')[0];
  const pct = t.expectedMonth ? Math.min(100, Math.round((t.collectedForMonth / t.expectedMonth) * 100)) : 0;
  const ym = d.today.slice(0, 7);
  const maxBar = Math.max(1, ...d.series.map((s) => s.amount + s.fines));
  const mix = d.statusMix;
  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);
  const mixColors = { paid: 'var(--green)', late: 'var(--amber)', current: 'var(--ink-3)', grace: 'var(--blue)', overdue: 'var(--red)' };
  let acc = 0;
  const donut = mixTotal
    ? Object.entries(mix).filter(([, v]) => v > 0).map(([k, v]) => {
      const len = (v / mixTotal) * 100;
      const seg = `<circle r="15.915" cx="20" cy="20" fill="none" stroke="${mixColors[k]}" stroke-width="5.5" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${-acc + 25}" class="donut-seg"/>`;
      acc += len;
      return seg;
    }).join('')
    : `<circle r="15.915" cx="20" cy="20" fill="none" stroke="var(--line)" stroke-width="5.5"/>`;
  const dayOfMonth = Number(d.today.slice(8, 10));
  const lastDayNum = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const daysToEnd = lastDayNum - dayOfMonth;

  page.innerHTML = `
  <section class="page-head">
    <div>
      <div class="kicker mono">${dateNice(d.today)} · ${daysToEnd === 0 ? 'Due date today!' : `${daysToEnd} day${daysToEnd > 1 ? 's' : ''} until month-end due`}</div>
      <h1 class="display">${greeting()}, <em>${esc(firstName || 'boss')}</em>.</h1>
    </div>
    <div class="head-actions">
      <button class="btn btn-ghost" data-newgroup>${I.plus} New group</button>
      <button class="btn btn-primary" data-pay>${I.cash} Record payment</button>
    </div>
  </section>

  <section class="dash-hero">
    <div class="hero-card ink" data-reveal>
      <div class="hero-copy">
        <div class="mono kicker light">Collected for ${monthLong(ym)}</div>
        <div class="hero-num" data-count="${t.collectedForMonth}">₱0</div>
        <div class="hero-sub">of <b>${peso(t.expectedMonth)}</b> expected this month</div>
        <div class="progress-track"><i style="--w:${pct}%"></i><span class="mono">${pct}%</span></div>
        <div class="hero-mini">
          <div><span class="mono">MEMBERS</span><b>${t.members}</b></div>
          <div><span class="mono">ACTIVE GROUPS</span><b>${t.activeGroups}</b></div>
          <div><span class="mono">OPEN SLOTS</span><b>${t.openSlots}</b></div>
        </div>
      </div>
      <div class="hero-3d" id="dash3d"></div>
    </div>
    <div class="kpis">
      <div class="kpi" data-tilt data-reveal><span class="mono">TOTAL COLLECTED</span><b data-count="${t.collectedAll}">₱0</b><small>all time</small></div>
      <div class="kpi" data-tilt data-reveal><span class="mono">FINES COLLECTED</span><b data-count="${t.finesAll}">₱0</b><small>${peso(t.finesMonth)} this month</small></div>
      <div class="kpi ${t.outstanding > 0 ? 'kpi-hot' : ''}" data-tilt data-reveal><span class="mono">DUE / UNPAID</span><b data-count="${t.outstanding}">₱0</b><small>${d.overdue.length} overdue · ${d.grace.length} in grace</small></div>
      <div class="kpi ${t.finesOwed > 0 ? 'kpi-hot' : ''}" data-tilt data-reveal><span class="mono">FINES UNPAID</span><b data-count="${t.finesOwed}">₱0</b><small>to collect</small></div>
    </div>
  </section>

  <section class="grid-3">
    <div class="card span-2" data-reveal>
      <div class="card-head"><h3>Collections</h3><span class="mono muted small">last 6 months</span></div>
      <div class="bars">
        ${d.series.map((s, i) => `
          <div class="bar-col ${s.month === ym ? 'now' : ''}" title="${monthLong(s.month)}: ${peso(s.amount)} + ${peso(s.fines)} fines">
            <div class="bar-val mono">${s.amount + s.fines > 0 ? peso(s.amount + s.fines) : ''}</div>
            <div class="bar-stack" style="--h:${((s.amount + s.fines) / maxBar) * 100}%; --d:${i * 70}ms">
              <i class="b-fine" style="flex:${s.fines}"></i><i class="b-amt" style="flex:${s.amount || (s.fines ? 0 : 1)}"></i>
            </div>
            <div class="bar-lbl mono">${monthShort(s.month)}</div>
          </div>`).join('')}
      </div>
      <div class="legend mono small"><span><i style="background:var(--ink)"></i>hulog</span><span><i style="background:var(--accent)"></i>fines</span></div>
    </div>
    <div class="card" data-reveal>
      <div class="card-head"><h3>This month</h3><span class="mono muted small">${mixTotal} member-slots</span></div>
      <div class="donut-wrap">
        <svg viewBox="0 0 40 40" class="donut">${donut}<text x="20" y="21.5" text-anchor="middle" class="donut-num">${mixTotal ? Math.round(((mix.paid + mix.late) / mixTotal) * 100) : 0}%</text><text x="20" y="26" text-anchor="middle" class="donut-lbl">PAID</text></svg>
        <ul class="donut-legend">
          ${Object.entries(mix).map(([k, v]) => `<li><i style="background:${mixColors[k]}"></i>${STATUS[k].label}<b>${v}</b></li>`).join('')}
        </ul>
      </div>
    </div>
  </section>

  <section class="grid-3">
    <div class="card" data-reveal>
      <div class="card-head"><h3><span class="dot dot-red"></span>Overdue</h3><span class="mono muted small">past grace · fined</span></div>
      ${d.overdue.length ? `<ul class="plist">${d.overdue.slice(0, 8).map((o) => `
        <li data-member="${o.id}">
          <div class="avatar sm">${esc(initials(o.name))}</div>
          <div class="pl-main"><b>${esc(o.name)}</b><small class="muted">${esc(o.group)} · ${o.months} mo</small></div>
          <div class="pl-amt"><b class="red">${peso(o.owed + o.fine)}</b><small class="muted mono">incl. ${peso(o.fine)} fine</small></div>
          <a class="icon-btn" title="Send reminder" href="${smsLink(o.phone, `Hi ${o.name.split(' ')[0]}! Paalala po from ${biz}: you have an overdue paluwagan balance of ${peso(o.owed + o.fine)} (incl. ${peso(o.fine)} late fine). Please settle as soon as possible. Salamat po!`)}" data-stop>${I.sms}</a>
        </li>`).join('')}</ul>` : `<div class="empty-sm">${I.check}<span>No overdue members. Ang galing!</span></div>`}
    </div>
    <div class="card" data-reveal>
      <div class="card-head"><h3><span class="dot dot-blue"></span>Grace period</h3><span class="mono muted small">pay before fine</span></div>
      ${d.grace.length ? `<ul class="plist">${d.grace.slice(0, 8).map((o) => {
        const left = daysBetween(d.today, o.deadline);
        return `<li data-member="${o.id}"><div class="avatar sm">${esc(initials(o.name))}</div><div class="pl-main"><b>${esc(o.name)}</b><small class="muted">${esc(o.group)}</small></div><div class="pl-amt"><b>${peso(o.owed)}</b><small class="mono ${left <= 1 ? 'red' : 'muted'}">${left === 0 ? 'last day today' : `${left} day${left > 1 ? 's' : ''} left`}</small></div></li>`;
      }).join('')}</ul>` : `<div class="empty-sm">${I.clock}<span>Nobody in grace period right now.</span></div>`}
    </div>
    <div class="card" data-reveal>
      <div class="card-head"><h3><span class="dot dot-gold"></span>Payouts this month</h3><span class="mono muted small">${monthShort(ym)}</span></div>
      ${d.payoutsDue.length ? `<ul class="plist">${d.payoutsDue.map((o) => `
        <li data-member="${o.id}"><div class="avatar sm gold">${I.gift}</div><div class="pl-main"><b>${esc(o.name)}</b><small class="muted">${esc(o.model)} · ${esc(o.group)}</small></div>
        <div class="pl-amt">${o.released ? '<span class="chip st-paid"><i></i>Released</span>' : '<span class="chip st-current"><i></i>To release</span>'}</div></li>`).join('')}</ul>` : `<div class="empty-sm">${I.gift}<span>No iPhone payouts scheduled this month.</span></div>`}
    </div>
  </section>

  <section class="grid-3">
    <div class="card span-2" data-reveal>
      <div class="card-head"><h3>Recent payments</h3><a href="#/payments" class="link mono small">view all →</a></div>
      ${d.recent.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Member</th><th>Group</th><th>For</th><th class="num">Amount</th></tr></thead><tbody>
      ${d.recent.map((p) => `<tr data-member="${p.member_id}" class="clickable"><td class="mono small">${dateNice(p.paid_on)}</td><td><b>${esc(p.member)}</b></td><td class="muted">${esc(p.group)}</td><td>${monthShort(p.period)}</td><td class="num"><b>${peso(p.amount)}</b>${p.fine ? `<small class="accent"> +${peso(p.fine)}</small>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : empty('No payments yet', 'Recorded payments will show up here.')}
    </div>
    <div class="card" data-reveal>
      <div class="card-head"><h3>Groups</h3><a href="#/groups" class="link mono small">all →</a></div>
      ${d.groups.length ? `<ul class="glist">${d.groups.slice(0, 6).map((g) => `
        <li><a href="#/groups/${g.id}"><span class="phone-dot" style="--c:${esc(g.color_hex)}"></span>
        <span class="gl-main"><b>${esc(g.name)}</b><small class="muted mono">${g.filled}/${g.slots} · ${g.phase === 'active' ? `month ${g.currentIndex}/${g.slots}` : g.phase}</small></span>
        ${g.overdueMembers ? `<span class="chip st-overdue"><i></i>${g.overdueMembers}</span>` : ''}</a></li>`).join('')}</ul>` : empty('No groups yet', 'Create your first iPhone paluwagan group.', `<button class="btn btn-primary btn-sm" data-newgroup>${I.plus} New group</button>`)}
    </div>
  </section>`;

  // interactions
  page.querySelectorAll('[data-newgroup]').forEach((b) => (b.onclick = () => groupForm()));
  page.querySelector('[data-pay]').onclick = () => paymentModal();
  page.querySelectorAll('[data-member]').forEach((el) => el.addEventListener('click', (e) => { if (!e.target.closest('[data-stop]')) memberDetail(Number(el.dataset.member)); }));
  page.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count)));
  wireTilt(page);

  const filled = Math.round((pct / 100) * 12);
  track(new PhoneScene(page.querySelector('#dash3d'), {
    color: '#e8742f', pro: true, coins: 12, filled, cameraZ: 9,
    screen: { title: biz, kicker: monthLong(ym), sub: `${pct}% collected` },
  }));

  // Piso commentary
  const tips = [];
  if (d.overdue.length) tips.push({ text: `${d.overdue.length} member${d.overdue.length > 1 ? 's are' : ' is'} overdue. Top: ${d.overdue[0].name} — ${peso(d.overdue[0].owed + d.overdue[0].fine)}. Remind natin?`, mood: 'worried', actions: [{ label: 'Open member', onClick: () => memberDetail(d.overdue[0].id) }] });
  if (d.grace.length) tips.push({ text: `${d.grace.length} member${d.grace.length > 1 ? 's' : ''} still in grace period — wala pang fine, pero malapit na!`, mood: 'wow' });
  const toRelease = d.payoutsDue.filter((p) => !p.released);
  if (toRelease.length) tips.push({ text: `${toRelease.map((p) => p.name.split(' ')[0]).join(', ')} will receive their iPhone this month! 🎁`, mood: 'grin' });
  if (!d.groups.length) tips.push({ text: 'Start by creating a group — e.g. "iPhone 11, 12 members". I\'ll handle the math!', mood: 'grin', actions: [{ label: 'Create group', onClick: () => groupForm() }] });
  tips.push({ text: `Tip: Due date is every end of month, with a grace period after. Fines apply automatically when it lapses.` });
  tips.push({ text: 'Click me for guidance, or hide me in Settings.', mood: 'grin' });
  piso.setTips(tips);
  if (!sessionStorage.getItem('palu.greeted')) {
    sessionStorage.setItem('palu.greeted', '1');
    setTimeout(() => piso.say(d.overdue.length ? `${greeting()}! Heads up: ${d.overdue.length} overdue today. Click me for details.` : `${greeting()}, ${firstName || 'boss'}! I'm Piso. Click me anytime for tips.`, { mood: d.overdue.length ? 'worried' : 'grin' }), 900);
  }
}

// ======================= GROUPS LIST =======================
export async function viewGroups(page) {
  const groups = await api('/groups');
  let filter = sessionStorage.getItem('palu.gfilter') || 'all';
  const render = () => {
    const list = groups.filter((g) => filter === 'all' || g.phase === filter);
    page.querySelector('.cards-grid').innerHTML = list.length ? list.map((g, i) => `
      <a class="gcard" href="#/groups/${g.id}" data-tilt style="--c:${esc(g.color_hex)}; --i:${i}">
        <div class="gcard-top">
          <div class="mini-phone ${isPro(g.model) ? 'pro' : ''}"><i></i><i></i><i></i></div>
          <div class="gcard-phase mono">${g.phase === 'active' ? `MONTH ${g.currentIndex}/${g.slots}` : g.phase === 'upcoming' ? `STARTS ${monthShort(g.start_month).toUpperCase()}` : 'ENDED'}</div>
        </div>
        <h3>${esc(g.name)}</h3>
        <div class="muted small">${esc(g.model)} ${esc(g.storage || '')} · ${esc(g.color || '')}</div>
        <div class="gcard-nums">
          <div><span class="mono">MONTHLY</span><b>${peso(g.monthly)}</b></div>
          <div><span class="mono">PRICE</span><b>${peso(g.price)}</b></div>
        </div>
        <div class="slots">${Array.from({ length: g.slots }, (_, k) => `<i class="${k < g.filled ? 'on' : ''}"></i>`).join('')}</div>
        <div class="gcard-foot">
          <span class="mono small">${g.filled}/${g.slots} members${g.open ? ` · ${g.open} open` : ' · full'}</span>
          <span>${g.overdueMembers ? `<span class="chip st-overdue"><i></i>${g.overdueMembers} overdue</span>` : g.phase === 'active' ? `<span class="chip st-paid"><i></i>${g.paidThisPeriod}/${g.filled} paid</span>` : ''}</span>
        </div>
      </a>`).join('') : empty(filter === 'all' ? 'No groups yet' : 'Nothing here', filter === 'all' ? 'Create a group for each iPhone model batch — like "iPhone 11 · 12 members".' : 'No groups match this filter.', filter === 'all' ? `<button class="btn btn-primary" data-newgroup>${I.plus} Create first group</button>` : '');
    page.querySelectorAll('[data-newgroup]').forEach((b) => (b.onclick = () => groupForm()));
    wireTilt(page);
  };
  const counts = { all: groups.length, active: 0, upcoming: 0, ended: 0 };
  groups.forEach((g) => counts[g.phase]++);
  page.innerHTML = `
    <section class="page-head">
      <div><div class="kicker mono">${groups.length} group${groups.length === 1 ? '' : 's'}</div><h1 class="display">iPhone <em>groups</em></h1></div>
      <div class="head-actions"><button class="btn btn-primary" data-newgroup>${I.plus} New group</button></div>
    </section>
    <div class="seg" role="tablist">${['all', 'active', 'upcoming', 'ended'].map((k) => `<button data-f="${k}" class="${filter === k ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)} <span class="mono">${counts[k]}</span></button>`).join('')}</div>
    <div class="cards-grid"></div>`;
  page.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => {
    filter = b.dataset.f;
    sessionStorage.setItem('palu.gfilter', filter);
    page.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
    sfx.toggleSw(true);
    render();
  }));
  render();
  piso.setTips([
    { text: 'Each group = one iPhone model batch. Members pay monthly and take turns receiving the iPhone.' },
    { text: 'Monthly hulog is auto-computed: price ÷ members. You can override it too.', mood: 'grin' },
  ]);
}

// ======================= GROUP DETAIL =======================
export async function viewGroup(page, id) {
  const g = await api(`/groups/${id}`);
  const ym = state.today ? state.today.slice(0, 7) : new Date().toISOString().slice(0, 7);
  const tab = sessionStorage.getItem('palu.gtab') || 'board';
  const byOrder = {};
  g.members.forEach((m) => (byOrder[m.payout_order] = m));

  const coinStates = [];
  for (let i = 1; i <= g.slots; i++) {
    const m = byOrder[i];
    if (!m) { coinStates.push('dim'); continue; }
    if (m.summary.overdueCount) coinStates.push('hot');
    else {
      const p = m.periods.find((x) => x.period === ym);
      coinStates.push(p && (p.status === 'paid' || p.status === 'late') ? 'gold' : g.phase === 'ended' && m.summary.health === 'complete' ? 'gold' : 'dim');
    }
  }

  const head = g.periods.map((p) => `<th class="mcol ${p.period === ym ? 'now' : ''}"><span class="mono">${String(p.index).padStart(2, '0')}</span>${monthShort(p.period)}</th>`).join('');
  const sym = { paid: '✓', late: '✓', current: '•', grace: '⏳', overdue: '!', future: '' };
  const rowsHtml = [];
  for (let i = 1; i <= g.slots; i++) {
    const m = byOrder[i];
    if (!m) {
      rowsHtml.push(`<tr class="open-row"><td class="sticky"><div class="mrow"><div class="avatar sm ghost">#${i}</div><div><b class="muted">Open slot</b><small class="mono muted">payout ${monthShort(addMonths(g.start_month, i - 1))}</small></div></div></td><td colspan="${g.slots + 1}"><button class="btn btn-sm btn-ghost" data-addat="${i}">${I.plus} Add member to slot #${i}</button></td></tr>`);
      continue;
    }
    rowsHtml.push(`<tr>
      <td class="sticky"><button class="mrow" data-member="${m.id}"><div class="avatar sm" style="--c:${esc(g.color_hex)}">${esc(initials(m.name))}</div><div><b>${esc(m.name)}</b><small class="mono muted">#${m.payout_order} · ${esc(m.phone)}</small></div></button></td>
      ${m.periods.map((p) => `<td class="mcell"><button class="cell c-${p.status} ${p.isPayout ? 'payout' : ''} ${p.period === ym ? 'now' : ''}" data-cell="${m.id}|${p.period}" title="${esc(m.name)} · ${monthLong(p.period)} · ${STATUS[p.status].label}${p.paid ? ' · paid ' + peso(p.paid) : ''}${p.fineBalance ? ' · fine due ' + peso(p.fineBalance) : ''}">${p.isPayout ? I.gift : sym[p.status]}${p.balance > 0 && p.paid > 0 ? '<s></s>' : ''}</button></td>`).join('')}
      <td class="num"><b>${m.summary.paidCount}/${m.summary.totalPeriods}</b>${m.summary.outstanding + m.summary.fineBalance > 0 ? `<small class="red mono">${peso(m.summary.outstanding + m.summary.fineBalance)}</small>` : ''}</td>
    </tr>`);
  }

  const payoutRows = g.periods.map((p) => {
    const m = byOrder[p.index];
    return `<div class="po-row ${p.period === ym ? 'now' : ''} ${m && m.summary.payoutReleased ? 'done' : ''}">
      <div class="po-idx mono">${String(p.index).padStart(2, '0')}</div>
      <div class="po-month"><b>${monthLong(p.period)}</b><small class="muted mono">${p.period < ym ? 'past' : p.period === ym ? 'this month' : 'upcoming'}</small></div>
      <div class="po-who">${m ? `<button class="link-btn" data-member="${m.id}">${esc(m.name)}</button>` : '<span class="muted">— open slot —</span>'}</div>
      <div class="po-act">${m ? (m.summary.payoutReleased ? `<span class="chip st-paid"><i></i>Released ${dateNice(m.summary.payout.released_on)}</span>` : `<button class="btn btn-sm ${p.period <= ym ? 'btn-ink' : 'btn-ghost'}" data-release="${m.id}">${I.gift} Release iPhone</button>`) : ''}</div>
    </div>`;
  }).join('');

  page.innerHTML = `
    <a href="#/groups" class="back-link mono">${I.back} All groups</a>
    <section class="g-hero" style="--c:${esc(g.color_hex)}">
      <div class="g-hero-copy">
        <div class="kicker mono">${esc(g.model)} ${esc(g.storage || '')} · ${esc(g.color || 'Any color')}${g.variant ? ' · ' + esc(g.variant) : ''}</div>
        <h1 class="display">${esc(g.name)}</h1>
        <div class="g-chips">
          <span class="chip ${g.phase === 'active' ? 'st-current' : g.phase === 'ended' ? 'st-paid' : 'st-future'}"><i></i>${g.phase === 'active' ? `Month ${g.currentIndex} of ${g.slots}` : g.phase === 'upcoming' ? `Starts ${monthLong(g.start_month)}` : 'Ended'}</span>
          <span class="chip"><i></i>${monthShort(g.start_month)} → ${monthShort(g.endMonth)}</span>
          ${g.overdueMembers ? `<span class="chip st-overdue"><i></i>${g.overdueMembers} overdue</span>` : ''}
        </div>
        <div class="g-stats">
          <div><span class="mono">MONTHLY</span><b>${peso(g.monthly)}</b></div>
          <div><span class="mono">PRICE</span><b>${peso(g.price)}</b></div>
          <div><span class="mono">MEMBERS</span><b>${g.filled}<small>/${g.slots}</small></b></div>
          <div><span class="mono">PAID ${monthShort(ym).toUpperCase()}</span><b>${g.phase === 'active' ? `${g.paidThisPeriod}<small>/${g.filled}</small>` : '—'}</b></div>
          <div><span class="mono">COLLECTED</span><b>${peso(g.collected)}</b></div>
          <div><span class="mono">FINES</span><b>${peso(g.fines)}</b></div>
        </div>
        <div class="head-actions">
          <button class="btn btn-primary" data-pay>${I.cash} Record payment</button>
          <button class="btn btn-ghost" data-add ${g.open ? '' : 'disabled'}>${I.plus} Add member</button>
          <button class="icon-btn" data-edit title="Edit group">${I.edit}</button>
          <button class="icon-btn danger" data-del title="Delete group">${I.trash}</button>
        </div>
      </div>
      <div class="g-hero-3d" id="g3d"><div class="coin-tip mono"></div><div class="hint mono">drag to spin · hover coins</div></div>
    </section>

    <div class="seg">
      <button data-tab="board" class="${tab === 'board' ? 'on' : ''}">Payment board</button>
      <button data-tab="payouts" class="${tab === 'payouts' ? 'on' : ''}">Payout schedule</button>
      <button data-tab="rules" class="${tab === 'rules' ? 'on' : ''}">Rules</button>
    </div>

    <div class="tab-pane" data-pane="board" ${tab === 'board' ? '' : 'hidden'}>
      <div class="card flush">
        <div class="legend-row mono small">
          <span><i class="cell c-paid">✓</i>paid</span><span><i class="cell c-late">✓</i>paid late</span><span><i class="cell c-current">•</i>due</span>
          <span><i class="cell c-grace">⏳</i>grace</span><span><i class="cell c-overdue">!</i>overdue</span><span><i class="cell c-future"></i>upcoming</span><span><i class="cell c-future payout">${I.gift}</i>payout month</span>
        </div>
        <div class="matrix-wrap"><table class="matrix"><thead><tr><th class="sticky">Member</th>${head}<th class="num">Paid</th></tr></thead><tbody>${rowsHtml.join('')}</tbody></table></div>
      </div>
    </div>
    <div class="tab-pane" data-pane="payouts" ${tab === 'payouts' ? '' : 'hidden'}><div class="card"><div class="po-list">${payoutRows}</div></div></div>
    <div class="tab-pane" data-pane="rules" ${tab === 'rules' ? '' : 'hidden'}>
      <div class="card rules">
        <ol>
          <li><b>${g.slots} members</b> each pay <b>${peso(g.monthly)}</b> monthly for <b>${g.slots} months</b>.</li>
          <li>Payment is due <b>every end of the month</b> (e.g. ${dateNice(g.periods[0].due)}).</li>
          <li>There is a <b>${g.grace_days}-day grace period</b> — the ${monthShort(g.periods[0].period)} payment can still be made until <b>${dateNice(g.periods[0].deadline)}</b> without a fine.</li>
          <li>Paying after the grace period incurs a <b>${peso(g.fine_amount)}</b> fine${g.fine_per_day ? ` plus <b>${peso(g.fine_per_day)}</b> for every extra day` : ''}.</li>
          <li>Each month, one member receives the <b>${esc(g.model)} ${esc(g.storage || '')}</b> according to their payout turn.</li>
        </ol>
        ${g.notes ? `<p class="muted">${esc(g.notes)}</p>` : ''}
      </div>
    </div>`;

  // events
  page.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    sessionStorage.setItem('palu.gtab', b.dataset.tab);
    page.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    page.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.tab));
    sfx.toggleSw(true);
  }));
  page.querySelector('[data-pay]').onclick = async () => {
    if (!g.members.length) { toast('Add members first.', 'info'); return; }
    paymentModal({ member_id: g.members[0].id });
  };
  page.querySelector('[data-add]').onclick = () => memberForm(g);
  page.querySelectorAll('[data-addat]').forEach((b) => (b.onclick = () => memberForm(g, null, Number(b.dataset.addat))));
  page.querySelector('[data-edit]').onclick = () => groupForm(g);
  page.querySelector('[data-del]').onclick = async () => {
    if (!(await confirmBox({ title: `Delete "${g.name}"?`, text: `This deletes the group, its ${g.filled} members and all their payment records. This cannot be undone.`, ok: 'Delete group', danger: true }))) return;
    try { await api(`/groups/${g.id}`, { method: 'DELETE' }); toast('Group deleted'); go('/groups'); } catch (e) { toast(e.message, 'err'); }
  };
  page.querySelectorAll('[data-member]').forEach((b) => (b.onclick = () => memberDetail(Number(b.dataset.member))));
  page.querySelectorAll('[data-release]').forEach((b) => (b.onclick = () => payoutModal(g.members.find((m) => m.id === Number(b.dataset.release)))));
  page.querySelectorAll('[data-cell]').forEach((b) => (b.onclick = () => {
    const [mid, period] = b.dataset.cell.split('|');
    const m = g.members.find((x) => x.id === Number(mid));
    const p = m.periods.find((x) => x.period === period);
    if (p.balance > 0 || p.fineBalance > 0) paymentModal({ member_id: m.id, period });
    else memberDetail(m.id);
  }));

  const tip = page.querySelector('.coin-tip');
  track(new PhoneScene(page.querySelector('#g3d'), {
    color: g.color_hex, pro: isPro(g.model), coins: g.slots, filled: g.paidThisPeriod, cameraZ: g.slots > 16 ? 10 : 8.6, coinRadius: g.slots > 16 ? 2.9 : 2.45,
    screen: { title: g.model, kicker: g.storage || 'paluwagan', sub: `${peso(g.monthly)}/mo` },
    onCoin: (i) => {
      if (i < 0) { tip.classList.remove('show'); return; }
      const m = byOrder[i + 1];
      sfx.tick();
      if (!m) tip.innerHTML = `#${i + 1} · open slot`;
      else {
        const p = m.periods.find((x) => x.period === ym);
        tip.innerHTML = `#${i + 1} · ${esc(m.name)}<br><span>${m.summary.overdueCount ? 'OVERDUE' : p ? STATUS[p.status].label.toUpperCase() : HEALTH[m.summary.health].label.toUpperCase()}</span>`;
      }
      tip.classList.add('show');
    },
  })).setFilled(g.paidThisPeriod, coinStates);

  piso.setTips([
    { text: 'Click any square on the board to record a payment for that month.', mood: 'grin' },
    { text: 'Gold coins = paid this month. Orange = overdue. Hover the coins on the 3D phone!' },
    { text: `The gift icon marks the month each member receives the ${g.model}.` },
    ...(g.open ? [{ text: `${g.open} slot${g.open > 1 ? 's' : ''} still open in this group.`, actions: [{ label: 'Add member', onClick: () => memberForm(g) }] }] : []),
  ]);
}

// ======================= MEMBERS =======================
export async function viewMembers(page) {
  const members = await api('/members');
  const groups = [...new Map(members.map((m) => [m.group_id, m.group])).entries()];
  let q = '', f = 'all', gid = '';
  page.innerHTML = `
    <section class="page-head">
      <div><div class="kicker mono">${members.length} member slot${members.length === 1 ? '' : 's'}</div><h1 class="display">All <em>members</em></h1></div>
      <div class="head-actions"><button class="btn btn-primary" data-pay>${I.cash} Record payment</button></div>
    </section>
    <div class="toolbar">
      <label class="search">${I.search}<input placeholder="Search name or phone…" data-q/></label>
      <select data-g><option value="">All groups</option>${groups.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join('')}</select>
      <div class="seg">${[['all', 'All'], ['overdue', 'Overdue'], ['grace', 'Grace'], ['good', 'Good'], ['complete', 'Done']].map(([k, l]) => `<button data-f="${k}" class="${k === 'all' ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div class="card flush"><div class="table-wrap"><table class="table members-table"><thead><tr><th>Member</th><th>Group</th><th>Turn</th><th>Payments</th><th class="num">Paid</th><th class="num">Due</th><th>Status</th></tr></thead><tbody></tbody></table></div></div>`;
  const tbody = page.querySelector('tbody');
  const render = () => {
    const list = members.filter((m) => (f === 'all' || m.summary.health === f) && (!gid || m.group_id === Number(gid)) && (!q || m.name.toLowerCase().includes(q) || m.phone.includes(q)));
    tbody.innerHTML = list.length ? list.map((m) => `
      <tr class="clickable" data-member="${m.id}">
        <td><div class="mrow"><div class="avatar sm" style="--c:${esc(m.color_hex)}">${esc(initials(m.name))}</div><div><b>${esc(m.name)}</b><small class="mono muted">${esc(m.phone)}</small></div></div></td>
        <td><div>${esc(m.group)}</div><small class="muted">${esc(m.model)} ${esc(m.storage || '')}</small></td>
        <td class="mono">#${m.payout_order}<small class="muted block">${monthShort(m.summary.payoutPeriod)}</small></td>
        <td><div class="strip">${m.strip.map((s) => `<i class="s-${s}"></i>`).join('')}</div><small class="mono muted">${m.summary.paidCount}/${m.summary.totalPeriods}</small></td>
        <td class="num">${peso(m.summary.totalPaid)}</td>
        <td class="num">${m.summary.outstanding + m.summary.fineBalance > 0 ? `<b class="red">${peso(m.summary.outstanding + m.summary.fineBalance)}</b>` : '<span class="muted">—</span>'}</td>
        <td>${chip(m.summary.health, HEALTH)}</td>
      </tr>`).join('') : `<tr><td colspan="7">${empty(members.length ? 'No matches' : 'No members yet', members.length ? 'Try a different search or filter.' : 'Open a group and add members to its slots.', members.length ? '' : '<a class="btn btn-primary btn-sm" href="#/groups">Go to groups</a>')}</td></tr>`;
    tbody.querySelectorAll('[data-member]').forEach((r) => (r.onclick = () => memberDetail(Number(r.dataset.member))));
  };
  page.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); render(); });
  page.querySelector('[data-g]').addEventListener('change', (e) => { gid = e.target.value; render(); });
  page.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { f = b.dataset.f; page.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b)); sfx.toggleSw(true); render(); }));
  page.querySelector('[data-pay]').onclick = () => paymentModal();
  render();
  const od = members.filter((m) => m.summary.health === 'overdue').length;
  piso.setTips([
    od ? { text: `${od} member${od > 1 ? 's' : ''} overdue. Use the "Overdue" filter, then tap "Remind" to text them.`, mood: 'worried' } : { text: 'Everyone is in good standing. Nice!', mood: 'grin' },
    { text: 'The colored strip shows each member\'s month-by-month payment record.' },
  ]);
}

// ======================= PAYMENTS =======================
export async function viewPayments(page) {
  const [rows, groups] = await Promise.all([api('/payments'), api('/groups')]);
  let gid = '', month = '';
  page.innerHTML = `
    <section class="page-head">
      <div><div class="kicker mono">ledger</div><h1 class="display">Payment <em>records</em></h1></div>
      <div class="head-actions"><button class="btn btn-ghost" data-csv>${I.download} Export CSV</button><button class="btn btn-primary" data-pay>${I.cash} Record payment</button></div>
    </section>
    <div class="toolbar">
      <select data-g><option value="">All groups</option>${groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>
      <label class="field-inline"><span class="mono small">PAID IN</span><input type="month" data-m/></label>
      <button class="btn btn-ghost btn-sm" data-clear>Clear</button>
    </div>
    <div class="totals-bar"></div>
    <div class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Date paid</th><th>Member</th><th>Group</th><th>For month</th><th class="num">Hulog</th><th class="num">Fine</th><th>Method</th><th></th></tr></thead><tbody></tbody></table></div></div>`;
  const tbody = page.querySelector('tbody');
  const totals = page.querySelector('.totals-bar');
  const render = () => {
    const list = rows.filter((r) => (!gid || r.group_id === Number(gid)) && (!month || r.paid_on.startsWith(month)));
    const a = list.reduce((s, r) => s + r.amount, 0), fi = list.reduce((s, r) => s + r.fine, 0);
    totals.innerHTML = `<div><span class="mono">RECORDS</span><b>${list.length}</b></div><div><span class="mono">HULOG</span><b>${peso(a)}</b></div><div><span class="mono">FINES</span><b>${peso(fi)}</b></div><div><span class="mono">TOTAL</span><b>${peso(a + fi)}</b></div>`;
    tbody.innerHTML = list.length ? list.map((r) => `
      <tr><td class="mono small">${dateNice(r.paid_on)}</td><td><button class="link-btn" data-member="${r.member_id}">${esc(r.member)}</button></td><td class="muted">${esc(r.grp)}</td><td>${monthShort(r.period)}</td>
      <td class="num"><b>${peso(r.amount)}</b></td><td class="num">${r.fine ? `<span class="accent">${peso(r.fine)}</span>` : '—'}</td>
      <td>${esc(r.method || '')}${r.ref ? `<small class="mono muted block">#${esc(r.ref)}</small>` : ''}</td>
      <td><button class="icon-btn danger" data-del="${r.id}" title="Void">${I.trash}</button></td></tr>`).join('')
      : `<tr><td colspan="8">${empty('No payments found', rows.length ? 'Try clearing the filters.' : 'Recorded payments will appear here.')}</td></tr>`;
    tbody.querySelectorAll('[data-member]').forEach((b) => (b.onclick = () => memberDetail(Number(b.dataset.member))));
    tbody.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox({ title: 'Void this payment?', text: 'The record will be permanently removed and balances recalculated.', ok: 'Void payment', danger: true }))) return;
      try { await api(`/payments/${b.dataset.del}`, { method: 'DELETE' }); toast('Payment voided'); window.dispatchEvent(new Event('palu:changed')); } catch (e) { toast(e.message, 'err'); }
    }));
  };
  page.querySelector('[data-g]').onchange = (e) => { gid = e.target.value; render(); };
  page.querySelector('[data-m]').onchange = (e) => { month = e.target.value; render(); };
  page.querySelector('[data-clear]').onclick = () => { gid = ''; month = ''; page.querySelector('[data-g]').value = ''; page.querySelector('[data-m]').value = ''; render(); };
  page.querySelector('[data-pay]').onclick = () => paymentModal();
  page.querySelector('[data-csv]').onclick = (e) => busy(e.currentTarget, async () => {
    try { await download('/export/payments.csv', `payments-${state.today || 'export'}.csv`); toast('CSV downloaded'); } catch (err) { toast(err.message, 'err'); }
  });
  render();
  piso.setTips([{ text: 'Export to CSV to open your records in Excel or Google Sheets.' }, { text: 'Made a mistake? Void a payment with the trash icon — balances update automatically.' }]);
}

// ======================= SETTINGS =======================
export async function viewSettings(page, { onRename } = {}) {
  const s = await api('/settings');
  state.settings = s;
  page.innerHTML = `
    <section class="page-head"><div><div class="kicker mono">preferences</div><h1 class="display"><em>Settings</em></h1></div></section>
    <div class="grid-2">
      <form class="card form" data-biz>
        <h3>Business Details</h3>
        <label class="field"><span>Business / Shop Name</span><input name="business_name" value="${esc(s.business_name)}" required/></label>
        <label class="field"><span>Tagline</span><input name="tagline" value="${esc(s.tagline || '')}"/></label>
        
        <div class="fieldset-title mono" style="margin-top:14px">Official Payment Accounts for Members</div>
        <div class="row2">
          <label class="field"><span>GCash Account Name</span><input name="gcash_name" value="${esc(s.gcash_name || '')}" placeholder="e.g. DANISH STORE"/></label>
          <label class="field"><span>GCash Mobile No.</span><input name="gcash_no" value="${esc(s.gcash_no || '')}" placeholder="09XX-XXX-XXXX"/></label>
        </div>
        <div class="row2">
          <label class="field"><span>Maya Account Name</span><input name="maya_name" value="${esc(s.maya_name || '')}" placeholder="e.g. DANISH STORE"/></label>
          <label class="field"><span>Maya Mobile No.</span><input name="maya_no" value="${esc(s.maya_no || '')}" placeholder="09XX-XXX-XXXX"/></label>
        </div>
        <div class="row2">
          <label class="field"><span>Bank Name</span><input name="bank_name" value="${esc(s.bank_name || '')}" placeholder="e.g. BDO / BPI"/></label>
          <label class="field"><span>Bank Account No.</span><input name="bank_acc" value="${esc(s.bank_acc || '')}" placeholder="XXXX-XXXX-XXXX"/></label>
        </div>
        <label class="field"><span>Remittance Instructions</span><textarea name="payment_instructions" rows="2">${esc(s.payment_instructions || '')}</textarea></label>

        <div class="fieldset-title mono" style="margin-top:14px">Defaults for new groups</div>
        <div class="row3">
          <label class="field"><span>Grace days</span><input name="default_grace" type="number" min="0" max="28" value="${esc(s.default_grace)}"/></label>
          <label class="field"><span>Late fine (₱)</span><input name="default_fine" type="number" min="0" step="any" value="${esc(s.default_fine)}"/></label>
          <label class="field"><span>+ per day (₱)</span><input name="default_fine_per_day" type="number" min="0" step="any" value="${esc(s.default_fine_per_day)}"/></label>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Save All Settings</button></div>
      </form>
      <form class="card form" data-pw>
        <h3>Change password</h3>
        <label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required/></label>
        <label class="field"><span>New password</span><input name="next" type="password" minlength="6" autocomplete="new-password" required/></label>
        <div class="form-actions"><button class="btn btn-ink" type="submit">${I.key} Update password</button></div>
      </form>
      <div class="card">
        <h3>Experience</h3>
        <div class="set-row"><div><b>Sound effects</b><small class="muted block">Clicks, chimes and Piso's voice</small></div><button class="switch ${sfx.muted ? '' : 'on'}" data-sound><i></i></button></div>
        <div class="set-row"><div><b>Show Piso</b><small class="muted block">Your interactive mascot</small></div><button class="switch ${localStorage.getItem('palu.piso.hidden') === '1' ? '' : 'on'}" data-piso><i></i></button></div>
        <div class="set-row"><div><b>Startup intro</b><small class="muted block">Watch the boot animation again</small></div><button class="btn btn-ghost btn-sm" data-replay>${I.replay} Replay</button></div>
      </div>
      <div class="card">
        <h3>Data</h3>
        <p class="muted small">Your data is saved in <span class="mono">data/paluphone.db</span> on the computer running the server. Download backups regularly.</p>
        <div class="set-row"><div><b>Payments spreadsheet</b><small class="muted block">CSV for Excel / Google Sheets</small></div><button class="btn btn-ghost btn-sm" data-csv>${I.download} CSV</button></div>
        <div class="set-row"><div><b>Full backup</b><small class="muted block">All groups, members & payments (JSON)</small></div><button class="btn btn-ghost btn-sm" data-backup>${I.download} Backup</button></div>
      </div>
    </div>`;
  const biz = page.querySelector('[data-biz]');
  biz.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(biz.querySelector('[type=submit]'), async () => {
      try {
        const r = await api('/settings', { method: 'PUT', body: formData(biz) });
        state.settings = r;
        state.meta.business_name = r.business_name;
        state.meta.tagline = r.tagline;
        onRename && onRename();
        sfx.success();
        toast('Settings saved');
      } catch (err) { toast(err.message, 'err'); }
    });
  });
  const pw = page.querySelector('[data-pw]');
  pw.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(pw.querySelector('[type=submit]'), async () => {
      try { await api('/password', { method: 'POST', body: formData(pw) }); pw.reset(); sfx.success(); toast('Password updated'); } catch (err) { toast(err.message, 'err'); }
    });
  });
  page.querySelector('[data-sound]').onclick = (e) => { const m = sfx.toggle(); e.currentTarget.classList.toggle('on', !m); window.dispatchEvent(new Event('palu:sound')); };
  page.querySelector('[data-piso]').onclick = (e) => {
    const hidden = localStorage.getItem('palu.piso.hidden') === '1';
    localStorage.setItem('palu.piso.hidden', hidden ? '0' : '1');
    piso.show(hidden);
    e.currentTarget.classList.toggle('on', hidden);
    sfx.toggleSw(hidden);
    if (hidden) piso.say('Yay, I\'m back!', { mood: 'grin' });
  };
  page.querySelector('[data-replay]').onclick = () => { sessionStorage.removeItem('palu.booted'); location.reload(); };
  page.querySelector('[data-csv]').onclick = (e) => busy(e.currentTarget, async () => { try { await download('/export/payments.csv', 'payments.csv'); } catch (err) { toast(err.message, 'err'); } });
  page.querySelector('[data-backup]').onclick = (e) => busy(e.currentTarget, async () => {
    try {
      const data = await api('/backup');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = `paluphone-backup-${state.today || 'today'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Backup downloaded');
    } catch (err) { toast(err.message, 'err'); }
  });
  piso.setTips([{ text: 'Change the fine and grace defaults here. Existing groups keep their own rules.' }]);
}

export { session };

