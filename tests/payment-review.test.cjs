const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDRsAAAAASUVORK5CYII=';
const proof = (suffix = '') => ({ name: 'receipt.png', type: 'image/png', data: Buffer.concat([Buffer.from(png, 'base64'), Buffer.from(suffix)]).toString('base64') });

test('Private receipt submissions, seller review, duplicates, ledger integrity and persistence', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'paluphone-receipts-'));
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  let server;
  let logs = '';
  async function start() {
    server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: directory, SESSION_HOURS: '12' }, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stderr.on('data', chunk => { logs += chunk; });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/healthz')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Server failed to start: ' + logs);
  }
  async function stop() {
    server.kill();
    await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  }
  const request = (url, body, token, method = body === undefined ? 'GET' : 'POST') => fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const json = async (url, body, token) => {
    const response = await request(url, body, token);
    const result = await response.json();
    assert.equal(response.ok, true, JSON.stringify(result));
    return result;
  };
  try {
    await start();
    const seller = await json('/setup', { username: 'owner', name: 'Owner', password: 'secure-password' });
    const group = await json('/groups', { name: 'Receipts group', model: 'iPhone 16', price: 12000, slots: 12, monthly: 1000, start_month: '2026-01', grace_days: 5, fine_amount: 100, fine_per_day: 0 }, seller.token);
    const member = await json(`/groups/${group.id}/members`, { name: 'First member', phone: '09171234501', pin: '123456' }, seller.token);
    const second = await json(`/groups/${group.id}/members`, { name: 'Second member', phone: '09171234502', pin: '654321' }, seller.token);
    const memberSession = await json('/login', { role: 'member', phone: '09171234501', pin: '123456' });
    const secondSession = await json('/login', { role: 'member', phone: '09171234502', pin: '654321' });
    const body = { member_id: member.id, period: '2026-01', amount: 500, fine: 0, paid_on: '2026-01-31', method: 'GCash', ref: 'GC-1234', proof: proof() };
    let pending;
    let proofId;
    await t.test('Member ownership, uploads, dates and reference validation', async () => {
      assert.equal((await request('/payment-submissions', body)).status, 401);
      assert.equal((await request('/payment-submissions', body, seller.token)).status, 403);
      assert.equal((await request('/payment-submissions', { ...body, member_id: second.id }, memberSession.token)).status, 403);
      for (const override of [
        { proof: undefined }, { proof: { name: 'bad.svg', type: 'image/svg+xml', data: Buffer.from('<svg/>').toString('base64') } },
        { proof: { ...proof(), type: 'image/jpeg' } }, { proof: { ...proof(), data: '!!!!' } },
        { ref: '' }, { ref: '---' }, { amount: 1001 }, { amount: -1 }, { amount: .001 }, { fine: 100 },
        { period: '2028-01' }, { paid_on: '2026-02-30' }, { paid_on: '2099-01-01' }, { method: 'Cash' },
      ]) assert.equal((await request('/payment-submissions', { ...body, ...override }, memberSession.token)).status, 400, JSON.stringify(override));
      assert.equal((await request('/payment-submissions', { ...body, proof: { ...proof(), data: 'A'.repeat(6990512) } }, memberSession.token)).status, 413);
    });
    await t.test('Pending submissions and protected receipt access leave balances unchanged', async () => {
      pending = await json('/payment-submissions', body, memberSession.token);
      assert.equal(pending.status, 'pending');
      const submissions = await json('/payment-submissions', undefined, memberSession.token);
      proofId = submissions[0].proof_id;
      assert.equal(submissions.length, 1);
      assert.equal((await json('/payment-submissions', undefined, secondSession.token)).length, 0);
      assert.equal((await json('/payments', undefined, seller.token)).length, 0);
      assert.equal((await json('/portal', undefined, memberSession.token)).slots[0].summary.totalPaid, 0);
      assert.equal((await request(`/payment-proofs/${proofId}`)).status, 401);
      assert.equal((await request(`/payment-proofs/${proofId}`, undefined, secondSession.token)).status, 404);
      for (const token of [seller.token, memberSession.token]) {
        const image = await request(`/payment-proofs/${proofId}`, undefined, token);
        assert.equal(image.status, 200);
        assert.equal(image.headers.get('content-type'), 'image/png');
        assert.equal(image.headers.get('cache-control'), 'no-store');
        assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(png, 'base64'));
      }
      assert.equal((await request('/payment-submissions', body, memberSession.token)).status, 409);
      assert.equal((await request('/payment-submissions', { ...body, proof: proof('different'), ref: 'gc 1234' }, memberSession.token)).status, 409);
      assert.equal((await request('/payment-submissions', { ...body, ref: 'DIFFERENT' }, memberSession.token)).status, 409);
    });
    await t.test('Approval requires actual-account confirmation and records exactly once', async () => {
      assert.equal((await request(`/payment-submissions/${pending.id}/review`, { action: 'approve', transaction_verified: true }, memberSession.token)).status, 403);
      assert.equal((await request(`/payment-submissions/${pending.id}/review`, { action: 'approve' }, seller.token)).status, 400);
      const results = await Promise.all([1, 2].map(() => request(`/payment-submissions/${pending.id}/review`, { action: 'approve', transaction_verified: true, review_note: 'Matched in receiving account' }, seller.token)));
      assert.deepEqual(results.map(response => response.status).sort(), [200, 409]);
      const payments = await json('/payments', undefined, seller.token);
      assert.equal(payments.length, 1);
      assert.equal(payments[0].amount, 500);
      assert.equal(payments[0].proof_id, proofId);
      const status = (await json('/payment-submissions', undefined, memberSession.token))[0];
      assert.equal(status.status, 'approved');
      assert.equal(status.review_note, 'Matched in receiving account');
      assert.equal(typeof status.reviewed_at, 'string');
      assert.equal((await json('/portal', undefined, memberSession.token)).slots[0].summary.totalPaid, 500);
      assert.equal((await request('/payment-submissions', body, memberSession.token)).status, 409);
    });
    await t.test('Rejection requires a reason, permits correction, and never credits money', async () => {
      const next = { ...body, ref: 'NEW-5678', proof: proof('second') };
      const item = await json('/payment-submissions', next, memberSession.token);
      assert.equal((await request(`/payment-submissions/${item.id}/review`, { action: 'reject' }, seller.token)).status, 400);
      await json(`/payment-submissions/${item.id}/review`, { action: 'reject', review_note: 'Reference does not match the receiving account.' }, seller.token);
      const history = await json('/payment-submissions', undefined, memberSession.token);
      assert.equal(history.find(row => row.id === item.id).status, 'rejected');
      assert.equal((await json('/payments', undefined, seller.token)).length, 1);
      const corrected = await json('/payment-submissions', { ...next, note: 'Corrected month', period: '2026-02' }, memberSession.token);
      assert.equal(corrected.status, 'pending');
    });
    await t.test('Approval rechecks remaining balance after other payments', async () => {
      const next = await json('/payment-submissions', { ...body, amount: 500, ref: 'LAST-500', proof: proof('third') }, memberSession.token);
      await json('/payments', { ...body, amount: 500, method: 'Cash', ref: '', proof: undefined }, seller.token);
      assert.equal((await request(`/payment-submissions/${next.id}/review`, { action: 'approve', transaction_verified: true }, seller.token)).status, 400);
      assert.equal((await json('/payment-submissions', undefined, seller.token)).find(row => row.id === next.id).status, 'pending');
      await json(`/payment-submissions/${next.id}/review`, { action: 'reject', review_note: 'Already settled in cash.' }, seller.token);
    });
    await t.test('Seller-recorded electronic payments need proof, and receipts survive restart and backup', async () => {
      const direct = { ...body, period: '2026-03', ref: 'DIRECT-1', proof: proof('direct') };
      assert.equal((await request('/payments', { ...direct, proof: undefined }, seller.token)).status, 400);
      const payment = await json('/payments', direct, seller.token);
      assert.equal((await request('/payments', direct, seller.token)).status, 409);
      const recorded = (await json('/payments', undefined, seller.token)).find(row => row.id === payment.id);
      assert.equal((await request(`/payment-proofs/${recorded.proof_id}`, undefined, memberSession.token)).status, 200);
      await stop();
      await start();
      assert.equal((await request(`/payment-proofs/${recorded.proof_id}`, undefined, memberSession.token)).status, 200);
      const backup = await json('/backup', undefined, seller.token);
      assert.equal(backup.payment_review.submissions.length, 4);
      assert.ok(backup.payment_review.proofs.some(row => row.id === proofId && row.data === png));
      await request(`/payments/${(await json('/payments', undefined, seller.token)).find(row => row.proof_id === proofId).id}`, undefined, seller.token, 'DELETE');
      assert.equal((await json('/payment-submissions', undefined, memberSession.token)).find(row => row.id === pending.id).payment_voided, 1);
    });
  } finally {
    if (server && server.exitCode === null) await stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
