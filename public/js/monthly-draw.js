import { api } from './api.js';
import { esc, peso, monthLong, dateNice, toast, modal, busy } from './ui.js';

const palette = ['#FF4F1A', '#16130F', '#E9B949', '#48433C', '#15803D', '#8A6407'];
const changed = () => window.dispatchEvent(new Event('palu:changed'));
const wrapText = (ctx, text, x, y, width, lineHeight) => {
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > width) { ctx.fillText(line, x, y); y += lineHeight; line = word; }
    else line = next;
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
};

function paintWheel(canvas, members) {
  const ctx = canvas.getContext('2d');
  const count = members.length;
  ctx.clearRect(0, 0, 800, 800);
  if (!count) {
    ctx.fillStyle = '#EFE9DC'; ctx.beginPath(); ctx.arc(400, 400, 390, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#48433C'; ctx.font = '28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No eligible members', 400, 410);
    return;
  }
  const slice = Math.PI * 2 / count;
  members.forEach((member, index) => {
    const start = -Math.PI / 2 + index * slice;
    ctx.beginPath(); ctx.moveTo(400, 400); ctx.arc(400, 400, 390, start, start + slice); ctx.closePath();
    ctx.fillStyle = palette[index % palette.length]; ctx.fill();
    ctx.strokeStyle = '#F4EFE6'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.translate(400, 400); ctx.rotate(start + slice / 2);
    ctx.fillStyle = index % palette.length === 2 ? '#16130F' : '#FFF'; ctx.font = `bold ${count > 24 ? 13 : count > 12 ? 19 : 26}px sans-serif`; ctx.textAlign = 'right';
    const limit = count > 24 ? 15 : 20;
    const label = `#${member.payout_order} ${member.name}`;
    const name = label.length > limit ? label.slice(0, limit - 1) + '…' : label;
    ctx.fillText(name, 355, 8, 275); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(400, 400, 58, 0, Math.PI * 2); ctx.fillStyle = '#F4EFE6'; ctx.fill();
  ctx.strokeStyle = '#16130F'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#16130F'; ctx.font = 'bold 38px serif'; ctx.textAlign = 'center'; ctx.fillText('₱', 400, 414);
}

function announcement(state, draw) {
  const member = draw.eligible.find(member => member.id === draw.member_id);
  return `${state.group.name}\n${monthLong(draw.period)} iPhone draw · Attempt ${draw.revision}\nWinner: ${draw.winner_name}${member ? ` (Member #${member.payout_order})` : ''}\nUnit: ${state.group.model}\n${draw.released_on ? `Released: ${dateNice(draw.released_on)}` : 'Awaiting device release. Please message the seller to arrange handover.'}\nDraw recorded: ${new Date(draw.created).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}\nPrevious winners continue their monthly contributions.`;
}

function downloadCard(state, draw) {
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#F4EFE6'; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#16130F'; ctx.fillRect(0, 0, 1080, 130);
  ctx.fillStyle = '#FFF'; ctx.font = 'bold 38px sans-serif'; ctx.fillText('PaluPhone · Monthly iPhone Draw', 64, 82);
  ctx.fillStyle = '#48433C'; ctx.font = '32px sans-serif';
  let y = wrapText(ctx, state.group.name, 64, 210, 950, 44);
  ctx.fillText(monthLong(draw.period), 64, y + 45);
  ctx.fillStyle = '#FF4F1A'; ctx.font = 'bold 34px sans-serif'; ctx.fillText('THIS MONTH’S WINNER', 64, y + 160);
  ctx.fillStyle = '#16130F'; ctx.font = 'bold 58px sans-serif'; y = wrapText(ctx, draw.winner_name, 64, y + 250, 950, 72);
  ctx.font = '36px sans-serif'; y = wrapText(ctx, state.group.model, 64, y + 60, 950, 46);
  ctx.fillStyle = '#48433C'; ctx.font = '28px sans-serif';
  wrapText(ctx, draw.released_on ? `Released ${dateNice(draw.released_on)}` : 'Please message the seller to arrange device release.', 64, Math.max(y + 90, 800), 950, 40);
  ctx.font = '22px sans-serif'; ctx.fillText(`Recorded ${dateNice(draw.created.slice(0, 10))} · Draw #${draw.id} · Attempt ${draw.revision}`, 64, 1285);
  canvas.toBlob(blob => {
    if (!blob) { toast('Could not create the winner card.', 'err'); return; }
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `iphone-winner-${draw.period}-attempt-${draw.revision}.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function recordMessengerResult(state, groupId) {
  modal({ title: 'Record <em>Messenger winner</em>', kicker: state.group.name,
    body: `<form class="form" data-messenger-winner>
      <p class="muted small">Use this only for a result already decided in your Messenger group. It is saved as an existing Messenger result, with your reason, rather than a random system draw.</p>
      <label class="field"><span>Draw month</span><input name="period" value="${esc(state.period)}" readonly /></label>
      <label class="field"><span>Existing winner</span><select name="member_id" required><option value="">Choose member</option>${state.messenger_eligible.map(member => `<option value="${member.id}">${esc(member.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Reason / Messenger result details</span><textarea name="reason" required maxlength="500" rows="3" placeholder="When was the draw held, and why is it being entered now?"></textarea></label>
      <label class="check-field"><input type="checkbox" name="confirmed" required /><span>This winner was already selected in Messenger. I am recording the existing result.</span></label>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Save existing winner</button></div>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form'); el.querySelector('[data-cancel]').onclick = close;
      form.onsubmit = event => { event.preventDefault(); if (!form.reportValidity()) return;
        busy(form.querySelector('[type=submit]'), async () => {
          try {
            await api(`/groups/${groupId}/draws/messenger`, { method: 'POST', body: { period: state.period, member_id: Number(form.elements.member_id.value), reason: form.elements.reason.value.trim(), confirm_existing_result: form.elements.confirmed.checked } });
            close(); toast('Existing Messenger winner recorded.'); changed();
          } catch (error) { toast(error.message, 'err'); }
        });
      };
    },
  });
}

export function correctRelease(memberId, onSaved = changed) {
  modal({ title: 'Correct <em>release record</em>', body: `<form class="form" data-correct-release><p class="muted">This changes the member back to “Awaiting release.” Their saved winner remains excluded from future draws.</p><label class="field"><span>Reason for correction</span><textarea name="reason" required maxlength="500" rows="3"></textarea></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-danger">Undo release record</button></div></form>`, onMount(el, close) {
    const form = el.querySelector('form'); el.querySelector('[data-cancel]').onclick = close;
    form.onsubmit = event => { event.preventDefault(); if (!form.reportValidity()) return;
      busy(form.querySelector('[type=submit]'), async () => {
        try { await api(`/payouts/${memberId}`, { method: 'DELETE', body: { reason: form.elements.reason.value.trim() } }); close(); toast('Release corrected. Winner retained.'); onSaved(); }
        catch (error) { toast(error.message, 'err'); }
      });
    };
  } });
}

export async function mountMonthlyDraw(root, groupId, releaseWinner) {
  const key = `palu.draw.month.${groupId}`;
  let selected;
  try { selected = sessionStorage.getItem(key) || ''; } catch {}
  let animating = false;
  async function render() {
    try {
      const state = await api(`/groups/${groupId}/draws${selected ? `?period=${encodeURIComponent(selected)}` : ''}`);
      if (!root.isConnected) return;
      selected = state.period;
      const draw = state.draw;
      const wheelMembers = draw ? draw.eligible : state.eligible;
      const pending = state.history.filter(item => !item.released_on);
      root.innerHTML = `<div class="card-head"><div><span class="kicker mono">${esc(state.group.model)} · Monthly draw</span><h3>Spin for this month’s iPhone</h3></div><button class="btn btn-ghost btn-sm" data-draw-refresh>Refresh</button></div>
        <div class="draw-layout"><div class="draw-visual"><div class="wheel-frame"><span class="wheel-pointer" aria-hidden="true"></span><canvas class="draw-wheel" width="800" height="800" aria-label="${wheelMembers.length} ${draw ? 'members in the saved draw' : 'eligible paid members'}. Names are listed beside the wheel."></canvas></div><p class="muted small">${draw ? `Saved result · attempt ${draw.revision}` : `${state.eligible.length} eligible paid members · unpaid members, previous winners and released members excluded`}</p></div>
        <div class="draw-controls"><label class="field"><span>Draw month</span><select data-draw-period>${state.periods.map(period => `<option value="${period}" ${period === state.period ? 'selected' : ''}>${monthLong(period)}</option>`).join('')}</select></label>
          <div class="receipt-sum"><div class="rs-line"><span>Verified monthly hulog</span><b>${peso(state.collected)} / ${peso(state.expected)}</b></div><div class="rs-line"><span>Members settled, including required fines</span><b>${state.paid_count} / ${state.group.slots}</b></div></div>
          ${draw ? `<div class="draw-winner" role="status"><span class="kicker mono">${draw.released_on ? 'Device released' : 'Winner · awaiting release'}</span><h4>${esc(draw.winner_name)}</h4><p class="small muted">${monthLong(draw.period)} · ${draw.source === 'messenger' ? 'Recorded Messenger result' : 'System wheel draw'} · Attempt ${draw.revision}</p><small class="muted">Saved ${dateNice(draw.created.slice(0, 10))}${draw.seller_name ? ` by ${esc(draw.seller_name)}` : ''}</small></div><div class="head-actions"><button class="btn btn-ghost btn-sm" data-copy-winner>Copy announcement</button><button class="btn btn-ghost btn-sm" data-download-winner>Download winner card</button>${!draw.released_on ? `<button class="btn btn-primary btn-sm" data-draw-release="${draw.member_id}">Mark released</button><button class="btn btn-ghost btn-sm" data-spin-again ${state.can_spin_again ? '' : 'disabled'}>Spin again</button>` : ''}</div>` : `<div class="draw-requirements">${state.blockers.length ? `<ul>${state.blockers.map(reason => `<li>${esc(reason)}</li>`).join('')}</ul>` : '<p class="green">Ready to draw from verified paid members. Unpaid names are not included.</p>'}</div><button class="btn btn-primary btn-block" data-spin-wheel ${state.can_spin ? '' : 'disabled'}>Spin &amp; save winner</button><button class="btn btn-ghost btn-sm" data-messenger-result ${!state.messenger_eligible.length || state.period > state.current_period || state.releases.some(item => item.period === state.period) ? 'disabled' : ''}>Record existing Messenger winner</button>`}
          <p class="muted small">You can draw before everyone pays. Only verified monthly hulog and required fines qualify. Spin again replaces an unreleased winner and keeps every attempt in history. Previous winners from other months remain excluded.</p>
          <details class="draw-members"><summary>${draw ? 'Original draw participants' : 'Eligible names'} (${wheelMembers.length})</summary><ul>${wheelMembers.map(member => `<li>${esc(member.name)}</li>`).join('') || '<li>No eligible members</li>'}</ul></details>
        </div></div>
        <div class="draw-release-queue"><h4>Awaiting release (${pending.length})</h4>${pending.map(item => `<div class="submission-row"><div><b>${esc(item.winner_name)}</b><small class="muted block">${monthLong(item.period)} · ${item.source === 'messenger' ? 'Messenger result' : 'Wheel winner'}</small></div><button class="btn btn-primary btn-sm" data-draw-release="${item.member_id}">Mark released</button></div>`).join('') || '<p class="muted small">No winners waiting for handover.</p>'}</div>
        <details class="draw-history"><summary>Draw &amp; release history (${state.history.length})</summary>${state.history.map(item => `<article class="submission-row"><div><b>${monthLong(item.period)} · ${esc(item.winner_name)}</b><small class="muted block">${item.source === 'messenger' ? 'Messenger result' : 'Wheel draw'} · ${dateNice(item.created.slice(0, 10))} · ${esc(item.seller_name)}</small>${item.reason ? `<p class="small muted">${esc(item.reason)}</p>` : ''}<small class="muted">${item.eligible.length} eligible names saved with the result</small></div><span class="chip ${item.released_on ? 'st-paid' : 'st-grace'}">${item.released_on ? `Released ${dateNice(item.released_on)}` : 'Awaiting release'}</span></article>`).join('') || '<p class="muted small">No saved draws yet.</p>'}${state.releases.filter(release => !state.history.some(draw => draw.member_id === release.member_id)).map(release => `<p class="small muted">Existing release: ${esc(release.member)} · ${dateNice(release.released_on)} · excluded from the wheel</p>`).join('')}</details>`;
      const canvas = root.querySelector('canvas'); paintWheel(canvas, wheelMembers);
      const attemptLog = document.createElement('details'); attemptLog.className = 'draw-history';
      attemptLog.innerHTML = `<summary>Spin attempt history (${state.attempts.length})</summary>${state.attempts.map(attempt => {
        const active = state.history.find(item => item.id === attempt.draw_id);
        return `<article class="submission-row"><div><b>Attempt ${attempt.revision} · ${esc(attempt.winner_name)}</b><small class="muted block">${active ? monthLong(active.period) : ''} · ${esc(attempt.seller_name)} · ${dateNice(attempt.created.slice(0, 10))}</small>${attempt.reason ? `<p class="small">${esc(attempt.reason)}</p>` : ''}<small class="muted">${attempt.eligible.length} names saved</small></div><span class="chip ${active?.revision === attempt.revision ? 'st-paid' : 'st-current'}">${active?.revision === attempt.revision ? 'Current result' : 'Superseded'}</span></article>`;
      }).join('') || '<p class="muted small">No spins recorded yet.</p>'}`;
      root.appendChild(attemptLog);
      const corrections = state.release_audit.filter(item => item.action === 'undo_release');
      if (corrections.length) {
        const audit = document.createElement('details'); audit.className = 'draw-history';
        audit.innerHTML = `<summary>Release corrections (${corrections.length})</summary>${corrections.map(item => `<p class="small"><b>${dateNice(item.created.slice(0, 10))} · ${esc(item.seller_name)}</b><br />${esc(item.reason)}</p>`).join('')}`;
        root.appendChild(audit);
      }
      if (draw && wheelMembers.length) {
        const index = wheelMembers.findIndex(member => member.id === draw.member_id);
        canvas.style.transform = `rotate(${-((index + .5) * 360 / wheelMembers.length)}deg)`;
      }
      root.querySelector('[data-draw-period]').onchange = event => {
        if (animating) return;
        selected = event.target.value;
        try { sessionStorage.setItem(key, selected); } catch {}
        render();
      };
      root.querySelector('[data-draw-refresh]').onclick = changed;
      root.querySelectorAll('[data-draw-release]').forEach(button => { button.onclick = () => releaseWinner(Number(button.dataset.drawRelease)); });
      root.querySelector('[data-copy-winner]')?.addEventListener('click', async () => {
        const text = announcement(state, draw);
        try { await navigator.clipboard.writeText(text); toast('Announcement copied. Paste it into Messenger.'); }
        catch { modal({ title: 'Winner announcement', body: `<label class="field"><span>Copy this text into Messenger</span><textarea rows="9" readonly>${esc(text)}</textarea></label>` }); }
      });
      root.querySelector('[data-download-winner]')?.addEventListener('click', () => downloadCard(state, draw));
      root.querySelector('[data-messenger-result]')?.addEventListener('click', () => recordMessengerResult(state, groupId));
      const spin = async (button, body, suffix = '') => {
        if (animating) return;
        animating = true;
        root.querySelectorAll('button, select').forEach(control => { control.disabled = true; });
        try {
          const result = await api(`/groups/${groupId}/draws${suffix}`, { method: 'POST', body });
          if (!root.isConnected) return;
          const saved = result.draw; paintWheel(canvas, saved.eligible);
          const index = saved.eligible.findIndex(member => member.id === saved.member_id);
          const rotation = 1440 - (index + .5) * 360 / saved.eligible.length;
          button.textContent = result.existing ? 'Showing saved winner…' : 'Winner saved · spinning…';
          const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
          const animation = canvas.animate([{ transform: canvas.style.transform || 'rotate(0deg)' }, { transform: `rotate(${rotation}deg)` }], { duration: reduced || result.existing ? 0 : 10000, easing: 'cubic-bezier(.2,.65,.2,1)', fill: 'forwards' });
          await animation.finished;
          if (root.isConnected) { toast(`${saved.winner_name} is selected for ${monthLong(saved.period)}.`); changed(); }
        } catch (error) { if (root.isConnected) { toast(error.message + ' Refresh to check the saved result before trying again.', 'err'); await render(); } }
        finally { animating = false; }
      };
      root.querySelector('[data-spin-wheel]')?.addEventListener('click', event => spin(event.currentTarget, { period: state.period, confirm_draw: true }));
      root.querySelector('[data-spin-again]')?.addEventListener('click', event => {
        const button = event.currentTarget;
        const requestId = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
        modal({ title: 'Spin <em>again</em>', kicker: monthLong(state.period), body: `<form class="form" data-spin-again-form><p>This replaces ${esc(draw.winner_name)} as the current unreleased winner. Only paid members qualify; winners from other months and released members remain excluded. The current winner may be selected again.</p><p class="muted small">${state.reroll_eligible.length} eligible paid members. This attempt and your reason will remain in history.</p><label class="field"><span>Reason for spinning again</span><textarea name="reason" required maxlength="500" rows="3"></textarea></label><label class="check-field"><input type="checkbox" name="confirmed" required /><span>I confirm this spin replaces the current unreleased result.</span></label><div class="form-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Confirm &amp; spin again</button></div></form>`, onMount(el, close) {
          const form = el.querySelector('form'); el.querySelector('[data-cancel]').onclick = close;
          form.onsubmit = e => {
            e.preventDefault(); if (!form.reportValidity() || animating) return;
            form.querySelector('[type=submit]').disabled = true;
            const reason = form.elements.reason.value.trim(); close();
            spin(button, { period: state.period, expected_revision: draw.revision, request_id: requestId, reason, confirm_spin_again: true }, '/spin-again');
          };
        } });
      });
    } catch (error) {
      if (root.isConnected) { root.innerHTML = `<h3>Monthly draw unavailable</h3><p class="muted">${esc(error.message)}</p><button class="btn btn-ghost" data-draw-retry>Try again</button>`; root.querySelector('[data-draw-retry]').onclick = () => { selected = ''; render(); }; }
    }
  }
  await render();
}
