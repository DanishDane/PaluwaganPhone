// Member portal view with clean, modern layout and transparent payment instructions
import { api } from './api.js';
import { sfx } from './sound.js';
import { piso } from './mascot.js';
import { state, track } from './state.js';
import { I } from './icons.js';
import { isPro } from './data.js';
import { PhoneScene } from './three-phone.js';
import { esc, peso, monthShort, monthLong, dateNice, chip, HEALTH, STATUS, daysBetween, toast } from './ui.js';

export async function viewPortal(page) {
  const d = await api('/portal');
  state.today = d.today;
  const slotIdx = Number(sessionStorage.getItem('palu.portal.slot') || 0);
  const active = d.slots[slotIdx] || d.slots[0];
  const g = active.group;
  const m = active.member;
  const s = active.summary;
  const set = d.settings || {};
  const ym = d.today.slice(0, 7);

  // Status mapping
  const coinStates = active.periods.map((p) => {
    if (p.status === 'paid' || p.status === 'late') return 'gold';
    if (p.status === 'overdue') return 'hot';
    return 'dim';
  });

  const dueTotal = s.outstanding + (s.fineBalance || 0);

  // Clean timeline
  const tlRows = active.periods.map((p) => {
    const isPast = p.period < ym;
    const isNow = p.period === ym;
    return `
      <div class="tl-item ${p.status} ${p.isPayout ? 'is-turn' : ''} ${isNow ? 'is-now' : ''}">
        <div class="tl-left">
          <span class="tl-num mono">#${String(p.index).padStart(2, '0')}</span>
          <div class="tl-info">
            <div class="tl-title">
              <b>${monthLong(p.period)}</b>
              ${p.isPayout ? `<span class="badge-turn">${I.gift} Your iPhone Turn!</span>` : ''}
              ${isNow ? `<span class="badge-current">Current Month</span>` : ''}
            </div>
            <div class="tl-dates mono small muted">
              Due Date: ${dateNice(p.due)} · Grace Extension until: ${dateNice(p.deadline)}
            </div>
          </div>
        </div>
        <div class="tl-right">
          <div class="tl-status">${chip(p.status)}</div>
          <div class="tl-figures mono small">
            ${p.paid > 0 ? `<span class="tl-paid">Paid: ${peso(p.paid)}</span>` : ''}
            ${p.balance > 0 && p.status !== 'future' ? `<span class="tl-due">Due: ${peso(p.balance)}</span>` : ''}
            ${p.fineBalance > 0 ? `<span class="tl-fine">Late Fine: ${peso(p.fineBalance)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  page.innerHTML = `
    <!-- Top Welcome Banner -->
    <div class="portal-header">
      <div>
        <div class="kicker mono">${esc(d.business_name)} · Official Member Portal</div>
        <h1 class="display">Kumusta, <em>${esc(d.name.split(' ')[0])}</em>!</h1>
        <p class="muted">Monitor your iPhone paluwagan status, payment due dates, and payout delivery turn.</p>
      </div>

      ${d.slots.length > 1 ? `
        <div class="seg slot-switcher">
          ${d.slots.map((sl, i) => `
            <button data-slot="${i}" class="${i === slotIdx ? 'on' : ''}">
              ${esc(sl.group.model)} (Turn #${sl.member.payout_order})
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Main Payment Summary Banner -->
    <div class="portal-hero ${dueTotal > 0 ? 'has-due' : 'all-good'}">
      <div class="hero-left">
        <div class="hero-status-row">
          <span class="portal-badge ${s.health === 'overdue' ? 'badge-danger' : s.health === 'grace' ? 'badge-warning' : 'badge-success'}">
            ● ${HEALTH[s.health]?.label || s.health}
          </span>
          <span class="portal-badge badge-payout">
            ${I.gift} You receive your ${esc(g.model)} in: <b>${monthLong(s.payoutPeriod)} (Turn #${m.payout_order})</b>
          </span>
        </div>

        <div class="hero-balance-box">
          <span class="kicker mono">Amount Due Right Now</span>
          <div class="balance-display">
            <span class="balance-num ${dueTotal > 0 ? 'red' : 'green'}">${peso(dueTotal)}</span>
            ${dueTotal > 0 ? `<span class="balance-breakdown mono">(${peso(s.outstanding)} monthly hulog + ${peso(s.fineBalance || 0)} late fine)</span>` : '<span class="balance-breakdown mono">All up to date! Walang utang.</span>'}
          </div>
        </div>

        <div class="hero-date-notice">
          ${s.next ? `
            <div class="date-callout">
              <span class="callout-ico">${I.clock}</span>
              <div>
                <b>Hulog Deadline for ${monthLong(s.next.period)}:</b>
                <p>Due every <b>End of Month (${dateNice(s.next.due)})</b> with a <b>${g.grace_days}-day grace extension</b> until <b>${dateNice(s.next.deadline)}</b>.</p>
                <small class="muted">Payments made after ${dateNice(s.next.deadline)} incur a ${peso(g.fine_amount)} late fee.</small>
              </div>
            </div>
          ` : `
            <div class="date-callout callout-done">
              <span class="callout-ico">${I.check}</span>
              <div>
                <b>Congratulations! All 12 payments are complete!</b>
                <p>Thank you for trusting ${esc(d.business_name)}.</p>
              </div>
            </div>
          `}
        </div>

        <div class="hero-stats-strip">
          <div class="stat-pill"><span class="mono">Total Paid</span><b>${peso(s.totalPaid)}</b></div>
          <div class="stat-pill"><span class="mono">Progress</span><b>${s.paidCount} / ${s.totalPeriods} Months</b></div>
          <div class="stat-pill"><span class="mono">Remaining</span><b>${peso(s.remaining)}</b></div>
          <div class="stat-pill"><span class="mono">Monthly Rate</span><b>${peso(g.monthly)}</b></div>
        </div>
      </div>

      <div class="hero-right">
        <div class="device-spec-card">
          <span class="mono kicker">Your Assigned Unit</span>
          <h3>${esc(g.model)} ${esc(g.storage || '')}</h3>
          <p class="muted small">${esc(g.color || 'Original Finish')} · ${esc(g.variant || 'PH Unit / Complete')}</p>
          <div class="portal-3d-box" id="portal3d"></div>
          <div class="payout-status-tag">
            ${s.payoutReleased
              ? `<span class="chip st-paid"><i></i>Unit Handed Over (${dateNice(s.payout.released_on)})</span>`
              : `<span class="chip st-current"><i></i>Claim Turn: #${m.payout_order} of ${g.slots}</span>`}
          </div>
        </div>
      </div>
    </div>

    <!-- How to Pay Section (Transparent Payment Accounts) -->
    <div class="pay-methods-card">
      <div class="card-head">
        <div>
          <span class="kicker mono">How To Settle Your Hulog</span>
          <h3>Official Payment Channels &amp; Remittance</h3>
        </div>
        <span class="secure-tag mono">${I.check} Verified Seller Accounts</span>
      </div>

      <div class="pay-options-grid">
        <!-- GCash -->
        <div class="pay-box">
          <div class="pay-box-head">
            <span class="pay-badge gcash">GCASH</span>
            <button class="btn btn-sm btn-ghost" data-copy="${esc(set.gcash_no || '')}">Copy No.</button>
          </div>
          <div class="pay-box-body">
            <div class="pay-field"><span class="mono small muted">Account Name:</span><b>${esc(set.gcash_name || 'Seller GCash')}</b></div>
            <div class="pay-field"><span class="mono small muted">Mobile No:</span><b class="mono pay-num">${esc(set.gcash_no || '09XX-XXX-XXXX')}</b></div>
          </div>
        </div>

        <!-- Maya -->
        <div class="pay-box">
          <div class="pay-box-head">
            <span class="pay-badge maya">MAYA</span>
            <button class="btn btn-sm btn-ghost" data-copy="${esc(set.maya_no || '')}">Copy No.</button>
          </div>
          <div class="pay-box-body">
            <div class="pay-field"><span class="mono small muted">Account Name:</span><b>${esc(set.maya_name || 'Seller Maya')}</b></div>
            <div class="pay-field"><span class="mono small muted">Mobile No:</span><b class="mono pay-num">${esc(set.maya_no || '09XX-XXX-XXXX')}</b></div>
          </div>
        </div>

        <!-- Bank / Over-The-Counter -->
        <div class="pay-box">
          <div class="pay-box-head">
            <span class="pay-badge bank">BANK TRANSFER</span>
            <button class="btn btn-sm btn-ghost" data-copy="${esc(set.bank_acc || '')}">Copy Acc</button>
          </div>
          <div class="pay-box-body">
            <div class="pay-field"><span class="mono small muted">Bank:</span><b>${esc(set.bank_name || 'BDO / BPI')}</b></div>
            <div class="pay-field"><span class="mono small muted">Account No:</span><b class="mono pay-num">${esc(set.bank_acc || 'XXXX-XXXX-XXXX')}</b></div>
          </div>
        </div>
      </div>

      <div class="pay-notice">
        <span class="notice-badge mono">IMPORTANT</span>
        <p>${esc(set.payment_instructions || 'After sending your payment via GCash, Maya, or Bank, send your reference number or screenshot to the seller. Your dashboard will update with an official receipt.')}</p>
      </div>
    </div>

    <!-- Timeline & Rules -->
    <div class="portal-grid">
      <div class="card timeline-card">
        <div class="card-head">
          <div>
            <span class="kicker mono">Payment History &amp; Schedule</span>
            <h3>12-Month Paluwagan Timeline</h3>
          </div>
          <span class="mono small muted">${s.paidCount} of ${s.totalPeriods} Completed</span>
        </div>
        <div class="clean-timeline">${tlRows}</div>
      </div>

      <div class="card rules-card">
        <div class="card-head">
          <div>
            <span class="kicker mono">Paluwagan Guidelines</span>
            <h3>Transparent Group Rules</h3>
          </div>
        </div>
        <div class="rules-list">
          <div class="rule-item">
            <span class="rule-num mono">01</span>
            <div>
              <b>Monthly Payment: ${peso(g.monthly)}</b>
              <p>Due every end of the calendar month (e.g. April 30, May 31).</p>
            </div>
          </div>
          <div class="rule-item">
            <span class="rule-num mono">02</span>
            <div>
              <b>5-Day Grace Extension</b>
              <p>You may pay up to the 5th day of the next month with zero late fees or penalties.</p>
            </div>
          </div>
          <div class="rule-item">
            <span class="rule-num mono">03</span>
            <div>
              <b>Late Fine: ${peso(g.fine_amount)}${g.fine_per_day ? ` + ${peso(g.fine_per_day)}/day` : ''}</b>
              <p>Applied strictly if payment exceeds the 5-day grace period to protect the entire group.</p>
            </div>
          </div>
          <div class="rule-item">
            <span class="rule-num mono">04</span>
            <div>
              <b>Turn #${m.payout_order} iPhone Release</b>
              <p>Your unit will be released during your turn month (${monthLong(s.payoutPeriod)}), complete with warranty and accessories.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event handlers
  page.querySelectorAll('[data-slot]').forEach((btn) => {
    btn.onclick = () => {
      sessionStorage.setItem('palu.portal.slot', btn.dataset.slot);
      sfx.click();
      viewPortal(page);
    };
  });

  page.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.onclick = async () => {
      const val = btn.dataset.copy;
      if (!val) return;
      try {
        await navigator.clipboard.writeText(val);
        sfx.tick();
        toast('Copied to clipboard: ' + val);
      } catch {
        toast('Manual copy: ' + val, 'info');
      }
    };
  });

  // Render 3D unit preview
  track(new PhoneScene(page.querySelector('#portal3d'), {
    color: g.color_hex,
    pro: isPro(g.model),
    coins: g.slots,
    filled: s.paidCount,
    cameraZ: 8.6,
    screen: {
      title: g.model,
      kicker: `Turn #${m.payout_order}`,
      sub: `${s.paidCount}/${g.slots} paid`,
    },
  })).setFilled(s.paidCount, coinStates);

  // Mascot guidance
  if (dueTotal > 0) {
    piso.say(`Paalala po, ${m.name.split(' ')[0]}: May payment due ka for ${monthLong(s.next?.period)}. Check the GCash / Maya details above!`, { mood: 'worried' });
  } else {
    piso.say(`Magandang araw ${m.name.split(' ')[0]}! Complete and updated ang hulog mo for your ${g.model}!`, { mood: 'grin' });
  }
}
