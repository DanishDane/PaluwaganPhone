const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { DatabaseSync } = require('node:sqlite');

test('Paid-member wheel, audited re-spins, exclusions, Messenger migration and release audit', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'paluphone-draws-'));
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  let server;
  const start = async () => {
    server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: directory, PALU_TODAY: '2026-11-13', SESSION_HOURS: '12' }, stdio: 'ignore' });
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/healthz')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Server did not start');
  };
  const stop = async () => { server.kill(); await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve)); };
  const request = (url, body, token, method = body === undefined ? 'GET' : 'POST') => fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const json = async (url, body, token) => { const response = await request(url, body, token); const data = await response.json(); assert.equal(response.ok, true, JSON.stringify(data)); return data; };
  try {
    await start();
    const seller = await json('/setup', { username: 'owner', name: 'Owner', password: 'secure-password' });
    const groupBody = { name: 'Monthly wheel', model: 'iPhone 16', price: 9000, slots: 3, monthly: 3000, start_month: '2026-10', grace_days: 5, fine_amount: 100, fine_per_day: 0 };
    const group = await json('/groups', groupBody, seller.token);
    const members = [];
    for (let i = 0; i < 3; i++) members.push(await json(`/groups/${group.id}/members`, { name: ['Already released', 'Eligible Maria', 'Eligible Juan'][i], phone: `0917123450${i}`, pin: '123456' }, seller.token));
    const memberSession = await json('/login', { role: 'member', phone: '09171234502', pin: '123456' });
    // Simulate an existing release saved by the previous fixed-turn version.
    await stop();
    const database = new DatabaseSync(path.join(directory, 'paluphone.db'));
    database.prepare('INSERT INTO payouts(group_id,member_id,period,released_on,note) VALUES(?,?,?,?,?)').run(group.id, members[0].id, '2026-10', '2026-10-31', 'Legacy handover');
    database.close();
    await start();
    const drawURL = `/groups/${group.id}/draws`;
    const pay = async (member, period = '2026-11', amount = 3000, paid_on = '2026-11-13', fine = 0) => json('/payments', { member_id: member.id, period, amount, fine, paid_on, method: 'Cash' }, seller.token);
    let draw;
    await t.test('Opening the group never draws; members and unauthenticated users cannot operate the wheel', async () => {
      assert.equal((await request(drawURL)).status, 401);
      assert.equal((await request(drawURL, undefined, memberSession.token)).status, 403);
      assert.equal((await request(drawURL, { period: '2026-11', confirm_draw: true }, memberSession.token)).status, 403);
      const state = await json(drawURL, undefined, seller.token);
      assert.equal(state.history.length, 0);
      assert.equal(state.draw, null);
      assert.equal(state.can_spin, false);
      assert.deepEqual(state.eligible, []);
      assert.equal((await request(drawURL, { period: '2026-11', confirm_draw: true }, seller.token)).status, 409);
      assert.equal((await request(drawURL + '?period=2027-01', undefined, seller.token)).status, 400);
      assert.equal((await request(drawURL, { period: '2026-12', confirm_draw: true }, seller.token)).status, 409);
    });
    await t.test('A paid member enables spin without everyone paying; pending proofs stay off the wheel', async () => {
      await pay(members[1]);
      let state = await json(drawURL, undefined, seller.token);
      assert.equal(state.can_spin, true);
      assert.deepEqual(state.eligible.map(member => member.id), [members[1].id]);
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDRsAAAAASUVORK5CYII=';
      const pending = await json('/payment-submissions', { member_id: members[2].id, period: '2026-11', amount: 3000, fine: 0, paid_on: '2026-11-13', method: 'GCash', ref: 'DRAW-PAYMENT', proof: { name: 'receipt.png', type: 'image/png', data: png } }, memberSession.token);
      assert.equal((await json(drawURL, undefined, seller.token)).paid_count, 1);
      assert.deepEqual((await json(drawURL, undefined, seller.token)).eligible.map(member => member.id), [members[1].id]);
      await json(`/payment-submissions/${pending.id}/review`, { action: 'approve', transaction_verified: true }, seller.token);
      assert.equal((await json(drawURL, undefined, seller.token)).can_spin, true);
      assert.equal((await json(drawURL, undefined, seller.token)).eligible.length, 2);
      await pay(members[0]);
      state = await json(drawURL, undefined, seller.token);
      assert.equal(state.paid_count, 3);
      assert.equal(state.expected, 9000);
      assert.equal(state.collected, 9000);
      assert.equal(state.can_spin, true);
      assert.equal((await request(drawURL, { period: '2026-11' }, seller.token)).status, 400);
    });
    const checkSpinAgain = async () => {
      const before = draw;
      const requestBody = { period: '2026-11', expected_revision: before.revision, request_id: 'a'.repeat(32), confirm_spin_again: true, reason: 'Seller requested another spin before device release.' };
      assert.equal((await request(drawURL + '/spin-again', requestBody, memberSession.token)).status, 403);
      assert.equal((await request(drawURL + '/spin-again', { ...requestBody, reason: '' }, seller.token)).status, 400);
      assert.equal((await request(drawURL + '/spin-again', { ...requestBody, confirm_spin_again: false }, seller.token)).status, 400);
      assert.equal((await request(drawURL + '/spin-again', { ...requestBody, expected_revision: 0 }, seller.token)).status, 409);
      const responses = await Promise.all([
        request(drawURL + '/spin-again', requestBody, seller.token),
        request(drawURL + '/spin-again', { ...requestBody, request_id: 'b'.repeat(32) }, seller.token),
      ]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200,409]);
      const successful = responses.find(response => response.status === 200);
      draw = (await successful.json()).draw;
      assert.equal(draw.revision, 2);
      assert.ok([members[1].id, members[2].id].includes(draw.member_id));
      const state = await json(drawURL, undefined, seller.token);
      assert.equal(state.attempts.length, 2);
      assert.equal(state.attempts.find(attempt => attempt.revision === 1).winner_name, before.winner_name);
      assert.equal(state.attempts.find(attempt => attempt.revision === 2).reason, requestBody.reason);
      const usedId = state.attempts.find(attempt => attempt.revision === 2).request_id;
      const retry = await json(drawURL + '/spin-again', { ...requestBody, request_id: usedId }, seller.token);
      assert.equal(retry.existing, true);
      assert.equal(retry.draw.revision, 2);
      assert.equal((await json(drawURL, undefined, seller.token)).attempts.length, 2);
      if (draw.member_id !== before.member_id) assert.ok(state.eligible.some(member => member.id === before.member_id));
    };
    await t.test('Concurrent spins save exactly one uniform-pool result and immutable snapshots', async () => {
      const results = await Promise.all([1, 2].map(() => json(drawURL, { period: '2026-11', confirm_draw: true, member_id: members[0].id }, seller.token)));
      draw = results[0].draw;
      assert.equal(results[1].draw.id, draw.id);
      assert.ok([members[1].id, members[2].id].includes(draw.member_id));
      assert.equal(draw.eligible.length, 2);
      assert.equal(draw.collection.length, 3);
      assert.equal(draw.source, 'wheel');
      assert.equal(results.filter(result => result.existing).length, 1);
      const state = await json(drawURL, undefined, seller.token);
      assert.equal(state.history.length, 1);
      assert.equal(state.eligible.length, 1);
      assert.ok(!state.eligible.some(member => member.id === draw.member_id));
      assert.equal((await json(drawURL, { period: '2026-11', confirm_draw: true }, seller.token)).draw.id, draw.id);
      const detail = await json(`/members/${draw.member_id}`, undefined, seller.token);
      assert.equal(detail.summary.payoutSelected, true);
      assert.equal(detail.summary.payoutReleased, false);
      assert.equal(detail.summary.payoutPeriod, '2026-11');
      assert.equal(detail.periods.find(period => period.period === '2026-11').isPayout, true);
    });
    await t.test('Spin again requires reason, confirmation and current revision; retries never create extra attempts', checkSpinAgain);
    await t.test('Saved results survive restart and protect group/membership terms', async () => {
      await stop(); await start();
      assert.equal((await json(drawURL, undefined, seller.token)).draw.id, draw.id);
      assert.equal((await request(`/members/${members[2].id}`, undefined, seller.token, 'DELETE')).status, 400);
      assert.equal((await request(`/groups/${group.id}`, undefined, seller.token, 'DELETE')).status, 400);
      assert.equal((await request(`/groups/${group.id}`, { ...groupBody, slots: 4 }, seller.token, 'PUT')).status, 400);
      assert.equal((await request(`/groups/${group.id}`, { ...groupBody, monthly: 4000 }, seller.token, 'PUT')).status, 400);
      assert.equal((await request(`/groups/${group.id}`, { ...groupBody, model: 'Different device' }, seller.token, 'PUT')).status, 400);
      const backup = await json('/backup', undefined, seller.token);
      assert.equal(backup.draws.length, 1);
      assert.equal(backup.draws[0].member_id, draw.member_id);
      assert.equal(backup.draw_attempts.length, 2);
    });
    await t.test('Only winners can be released; correction keeps the winner excluded and records the reason', async () => {
      const remaining = members.find(member => member.id !== members[0].id && member.id !== draw.member_id);
      assert.equal((await request('/payouts', { member_id: remaining.id, released_on: '2026-11-13' }, seller.token)).status, 400);
      assert.equal((await request('/payouts', { member_id: draw.member_id, released_on: '2026-10-31' }, seller.token)).status, 400);
      await json('/payouts', { member_id: draw.member_id, released_on: '2026-11-13', imei: 'TEST-SERIAL-001' }, seller.token);
      assert.equal((await request(drawURL + '/spin-again', { period: '2026-11', expected_revision: draw.revision, request_id: 'c'.repeat(32), confirm_spin_again: true, reason: 'Attempt after release' }, seller.token)).status, 409);
      assert.equal((await request('/payouts', { member_id: draw.member_id }, seller.token)).status, 409);
      assert.equal((await request(`/payouts/${draw.member_id}`, {}, seller.token, 'DELETE')).status, 400);
      await request(`/payouts/${draw.member_id}`, { reason: 'Device handover was entered before collection.' }, seller.token, 'DELETE').then(async response => assert.equal(response.status, 200, await response.text()));
      const state = await json(drawURL, undefined, seller.token);
      assert.equal(state.history[0].released_on, null);
      assert.ok(!state.eligible.some(member => member.id === draw.member_id));
      assert.equal(state.release_audit.filter(item => item.action === 'undo_release').length, 1);
      assert.equal((await json(`/members/${draw.member_id}`, undefined, seller.token)).summary.payoutSelected, true);
      await json('/payouts', { member_id: draw.member_id, released_on: '2026-11-13' }, seller.token);
    });
    await t.test('Messenger winners are explicit, documented and excluded; future imports and reselecting winners are rejected', async () => {
      const remaining = (await json(drawURL, undefined, seller.token)).eligible[0];
      assert.equal((await request(drawURL + '/messenger', { period: '2026-12', member_id: remaining.id, reason: 'Future', confirm_existing_result: true }, seller.token)).status, 400);
      const otherGroup = await json('/groups', { ...groupBody, name: 'Existing Messenger group' }, seller.token);
      const member = await json(`/groups/${otherGroup.id}/members`, { name: 'Prior Messenger winner', phone: '09991234567', pin: '123456' }, seller.token);
      const url = `/groups/${otherGroup.id}/draws/messenger`;
      assert.equal((await request(url, { period: '2026-10', member_id: member.id, confirm_existing_result: true }, seller.token)).status, 400);
      const saved = await json(url, { period: '2026-10', member_id: member.id, confirm_existing_result: true, reason: 'Winner selected in Messenger on October 28.' }, seller.token);
      assert.equal(saved.draw.source, 'messenger');
      assert.ok(!(await json(`/groups/${otherGroup.id}/draws`, undefined, seller.token)).eligible.some(item => item.id === member.id));
      assert.equal((await request(url, { period: '2026-11', member_id: member.id, confirm_existing_result: true, reason: 'Try again' }, seller.token)).status, 400);
      await json('/payouts', { member_id: member.id, released_on: '2026-10-31' }, seller.token);
    });
    await t.test('Only members with settled monthly hulog and fines qualify, even in an unfilled group', async () => {
      const other = await json('/groups', { ...groupBody, name: 'Fine gate', slots: 2, price: 6000 }, seller.token);
      const a = await json(`/groups/${other.id}/members`, { name: 'A', phone: '09990000001', pin: '123456' }, seller.token);
      await pay(a, '2026-10', 3000, '2026-11-13');
      let state = await json(`/groups/${other.id}/draws?period=2026-10`, undefined, seller.token);
      assert.equal(state.can_spin, false);
      assert.equal(state.eligible.length, 0);
      const b = await json(`/groups/${other.id}/members`, { name: 'B', phone: '09990000002', pin: '123456' }, seller.token);
      const bPayment = await pay(b, '2026-10', 3000, '2026-11-13', 100);
      state = await json(`/groups/${other.id}/draws?period=2026-10`, undefined, seller.token);
      assert.equal(state.can_spin, true);
      assert.deepEqual(state.eligible.map(member => member.id), [b.id]);
      const selected = await json(`/groups/${other.id}/draws`, { period: '2026-10', confirm_draw: true }, seller.token);
      assert.equal(selected.draw.member_id, b.id);
      await request(`/payments/${bPayment.id}`, undefined, seller.token, 'DELETE');
      assert.equal((await json(`/groups/${other.id}/draws?period=2026-10`, undefined, seller.token)).can_spin_again, false);
      await json('/waivers', { member_id: a.id, period: '2026-10', reason: 'Waived by seller' }, seller.token);
      state = await json(`/groups/${other.id}/draws?period=2026-10`, undefined, seller.token);
      assert.equal(state.can_spin_again, true);
      assert.deepEqual(state.reroll_eligible.map(member => member.id), [a.id]);
      const replacement = await json(`/groups/${other.id}/draws/spin-again`, { period: '2026-10', confirm_spin_again: true, expected_revision: 1, request_id: 'd'.repeat(32), reason: 'Previous winner payment was voided.' }, seller.token);
      assert.equal(replacement.draw.member_id, a.id);
    });
    await t.test('Correcting a legacy release preserves its original winner', async () => {
      const response = await request(`/payouts/${members[0].id}`, { reason: 'Correcting legacy handover date.' }, seller.token, 'DELETE');
      assert.equal(response.status, 200, await response.text());
      const state = await json(drawURL, undefined, seller.token);
      assert.ok(!state.eligible.some(member => member.id === members[0].id));
      const legacy = state.history.find(item => item.member_id === members[0].id);
      assert.equal(legacy.period, '2026-10');
      assert.equal(legacy.source, 'messenger');
      assert.ok(legacy.eligible.some(member => member.id === members[0].id));
    });
  } finally {
    if (server && server.exitCode === null) await stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
