import { api } from './api.js';
import { esc, peso, monthLong, dateNice, toast, modal, busy } from './ui.js';

export const submissionStatus = submission => {
  const label = submission.payment_voided ? 'Approved · payment voided' : ({ pending: 'Pending review', approved: 'Approved', rejected: 'Rejected' }[submission.status] || submission.status);
  return `<span class="chip ${submission.status === 'approved' && !submission.payment_voided ? 'st-paid' : submission.status === 'rejected' || submission.payment_voided ? 'st-overdue' : 'st-grace'}">${esc(label)}</span>`;
};

export function proofField(required = false) {
  return `<label class="field"><span>Proof of payment ${required ? '' : '<em>required for non-cash payments</em>'}</span>
    <input type="file" data-proof-file accept="image/jpeg,image/png,image/webp" ${required ? 'required' : ''} />
    <small class="muted">Upload the original receipt or transfer screenshot. PNG, JPEG or WebP, up to 5 MB.</small>
    <span class="receipt-upload-preview" hidden><img alt="Selected receipt preview" /><small data-proof-name></small></span></label>`;
}

function releaseWhenClosed(el, url) {
  const observer = new MutationObserver(() => {
    if (!el.isConnected) { URL.revokeObjectURL(url); observer.disconnect(); }
  });
  observer.observe(document.getElementById('modal-root'), { childList: true });
}

export function wireProofInput(root) {
  const input = root.querySelector('[data-proof-file]');
  const preview = root.querySelector('.receipt-upload-preview');
  let url;
  const validate = file => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP receipt image.');
    if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('Receipt must be 5 MB or smaller.');
  };
  input.onchange = () => {
    if (url) URL.revokeObjectURL(url);
    preview.hidden = true;
    const file = input.files[0];
    if (!file) return;
    try {
      validate(file);
      url = URL.createObjectURL(file);
      preview.querySelector('img').src = url;
      root.querySelector('[data-proof-name]').textContent = file.name;
      preview.hidden = false;
    } catch (error) { input.value = ''; toast(error.message, 'err'); }
  };
  const observer = new MutationObserver(() => {
    if (!root.isConnected) { if (url) URL.revokeObjectURL(url); observer.disconnect(); }
  });
  observer.observe(document.getElementById('modal-root'), { childList: true });
  return async () => {
    const file = input.files[0];
    if (!file) return undefined;
    validate(file);
    const image = await createImageBitmap(file).catch(() => { throw new Error('This receipt image cannot be opened. Choose a valid image.'); });
    image.close();
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read this receipt. Try selecting it again.'));
      reader.readAsDataURL(file);
    });
    return { name: file.name, type: file.type, data };
  };
}

export async function viewProof(id) {
  try {
    const response = await api(`/payment-proofs/${Number(id)}`, { raw: true });
    const url = URL.createObjectURL(await response.blob());
    const dialog = modal({ title: 'Payment <em>proof</em>', wide: true, body: `<p class="muted small">Compare the receipt with the transfer in your actual account. An image alone does not confirm payment.</p><div class="form-actions"><a class="btn btn-ghost btn-sm" href="${url}" target="_blank" rel="noopener">Open full size</a><a class="btn btn-ghost btn-sm" href="${url}" download="payment-proof">Download image</a></div><img class="receipt-image" src="${url}" alt="Payment receipt uploaded for review" />` });
    releaseWhenClosed(dialog.el, url);
  } catch (error) { toast(error.message, 'err'); }
}

export function submitPaymentModal(slot, today) {
  const open = slot.periods.filter(period => period.balance > 0 || period.fineBalance > 0);
  if (!open.length) { toast('All payments for this membership are complete.', 'info'); return; }
  modal({
    title: 'Submit <em>payment</em>', kicker: slot.group.name, receipt: true,
    body: `<form class="form" data-submit-payment>
      <p class="muted small">Transfer to your seller first, then submit the details and receipt here. Your balance changes only after seller approval.</p>
      <label class="field"><span>Payment month</span><select name="period" required>${open.map(period => `<option value="${period.period}">${monthLong(period.period)} · ${peso(period.balance)} remaining</option>`).join('')}</select></label>
      <div class="row2"><label class="field"><span>Hulog amount (PHP)</span><input type="number" name="amount" min="0" step="0.01" required inputmode="decimal" /></label><label class="field"><span>Fine paid (PHP)</span><input type="number" name="fine" min="0" step="0.01" value="0" required inputmode="decimal" /></label></div>
      <div class="row2"><label class="field"><span>Date transferred</span><input name="paid_on" type="date" value="${esc(today)}" max="${esc(today)}" required /></label><label class="field"><span>Payment method</span><select name="method"><option>GCash</option><option>Maya</option><option>Bank transfer</option><option>Other</option></select></label></div>
      <label class="field"><span>Transaction reference number</span><input name="ref" maxlength="80" required autocomplete="off" placeholder="Reference from the transfer receipt" /></label>
      ${proofField(true)}
      <label class="field"><span>Note <em>optional</em></span><textarea name="note" maxlength="300" rows="2"></textarea></label>
      <div class="form-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">Submit for review</button></div>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const readProof = wireProofInput(el);
      const suggest = () => {
        const period = open.find(period => period.period === form.elements.period.value);
        form.elements.amount.value = period.balance;
        form.elements.fine.value = 0;
      };
      suggest();
      form.elements.period.onchange = suggest;
      el.querySelector('[data-cancel]').onclick = close;
      form.onsubmit = event => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        busy(form.querySelector('[type=submit]'), async () => {
          try {
            const body = Object.fromEntries(new FormData(form));
            body.member_id = slot.member.id;
            body.proof = await readProof();
            await api('/payment-submissions', { method: 'POST', body, timeout: 60000 });
            close();
            toast('Payment submitted. Awaiting seller verification.');
            window.dispatchEvent(new Event('palu:changed'));
          } catch (error) { toast(error.message, 'err'); }
        });
      };
    },
  });
}

export async function reviewSubmission(submission) {
  try {
    const response = await api(`/payment-proofs/${submission.proof_id}`, { raw: true });
    const url = URL.createObjectURL(await response.blob());
    const dialog = modal({
      title: 'Review <em>payment</em>', kicker: `${submission.member} · ${submission.grp}`, wide: true,
      body: `<div class="proof-review-layout"><div><a class="btn btn-ghost btn-sm" href="${url}" target="_blank" rel="noopener">Open receipt full size</a><img class="receipt-image" src="${url}" alt="Submitted payment receipt" /></div>
        <form class="form" data-review-payment>
          <div class="receipt-sum"><div class="rs-line"><span>For month</span><b>${monthLong(submission.period)}</b></div><div class="rs-line"><span>Date transferred</span><b>${dateNice(submission.paid_on)}</b></div><div class="rs-line"><span>Method</span><b>${esc(submission.method)}</b></div><div class="rs-line"><span>Reference</span><b>${esc(submission.ref)}</b></div><div class="rs-line"><span>Hulog / Fine</span><b>${peso(submission.amount)} / ${peso(submission.fine)}</b></div><div class="rs-total"><span>Total transferred</span><b>${peso(submission.amount + submission.fine)}</b></div></div>
          ${submission.note ? `<p class="muted small">Member note: ${esc(submission.note)}</p>` : ''}
          ${submission.duplicate_warning ? `<div class="alert-box">${esc(submission.duplicate_warning)}</div>` : ''}
          <p class="muted small">Check the reference, amount, date and recipient against the transaction in your actual GCash, Maya or bank account. Reused receipts/references are blocked; edited images cannot be reliably detected here.</p>
          <label class="check-field"><input type="checkbox" name="verified" /><span>I confirmed this exact transfer in the receiving account, and its details match this submission.</span></label>
          <label class="field"><span>Review note <em>required when rejecting</em></span><textarea name="review_note" maxlength="500" rows="3" placeholder="Explain any mismatch so the member can correct it"></textarea></label>
          <div class="form-actions"><button type="button" class="btn btn-danger" data-reject>Reject</button><button type="submit" class="btn btn-primary" data-approve ${submission.duplicate_warning ? 'disabled' : ''}>Approve &amp; record</button></div>
        </form></div>`,
      onMount(el, close) {
        const form = el.querySelector('form');
        const approve = form.querySelector('[data-approve]');
        const reject = form.querySelector('[data-reject]');
        const review = async (action, button) => {
          if (action === 'approve' && !form.elements.verified.checked) { toast('Confirm the actual transfer before approval.', 'err'); return; }
          if (action === 'reject' && !form.elements.review_note.value.trim()) { toast('Enter a reason for rejecting this payment.', 'err'); form.elements.review_note.focus(); return; }
          await busy(button, async () => {
            const other = button === approve ? reject : approve;
            const previousDisabled = other.disabled;
            other.disabled = true;
            try {
              await api(`/payment-submissions/${submission.id}/review`, { method: 'POST', body: { action, transaction_verified: form.elements.verified.checked, review_note: form.elements.review_note.value.trim() } });
              close();
              toast(action === 'approve' ? 'Payment verified and recorded.' : 'Submission rejected. The member can see your reason.');
              window.dispatchEvent(new Event('palu:changed'));
            } catch (error) { toast(error.message, 'err'); }
            finally { other.disabled = previousDisabled; }
          });
        };
        form.onsubmit = event => { event.preventDefault(); review('approve', approve); };
        reject.onclick = () => review('reject', reject);
      },
    });
    releaseWhenClosed(dialog.el, url);
  } catch (error) { toast(error.message, 'err'); }
}
