const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');

test('Fresh installation, authentication, session expiry and deployment assets', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'paluphone-test-'));
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const server = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: directory, SESSION_HOURS: '.0003' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${port}`;
  let logs = '';
  server.stderr.on('data', chunk => { logs += chunk; });
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/healthz')).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const request = (url, body, token, method = 'POST') => fetch(base + '/api' + url, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.deepEqual(await (await fetch(base + '/healthz')).json(), { status: 'ok' }, logs);
    assert.equal((await (await fetch(base + '/api/state')).json()).needsSetup, true);
    assert.equal((await fetch(base + '/api/dashboard')).status, 401);
    assert.equal((await request('/setup', { username: 'owner', name: 'Owner', password: '123' })).status, 400);
    const setup = await request('/setup', { username: 'owner', name: 'Owner', password: 'secure-password', business_name: 'Actual Business' });
    assert.equal(setup.status, 200);
    const { token } = await setup.json();
    assert.equal((await request('/setup', { username: 'other', name: 'Other', password: 'secure-password' })).status, 400);
    assert.equal((await (await fetch(base + '/api/state')).json()).needsSetup, false);
    const settings = await (await request('/settings', null, token, 'GET')).json();
    assert.equal(settings.gcash_no, '');
    assert.equal(settings.bank_acc, '');
    const dashboard = await request('/dashboard', null, token, 'GET');
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.headers.get('cache-control'), 'no-store');
    for (const asset of ['/', '/css/app.css', '/js/app.js', '/js/boot.js', '/vendor/three/build/three.module.js', '/fonts/bricolage/400.css', '/icons/icon.svg', '/manifest.webmanifest']) {
      const response = await fetch(base + asset);
      assert.equal(response.status, 200, asset);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
    assert.equal((await fetch(base + '/icons/missing.png')).status, 404);
    await new Promise(resolve => setTimeout(resolve, 1150));
    assert.equal((await request('/me', null, token, 'GET')).status, 401);
    const login = await request('/login', { username: 'owner', password: 'secure-password' });
    assert.equal(login.status, 200);
    const session = await login.json();
    assert.equal((await request('/logout', {}, session.token)).status, 200);
    assert.equal((await request('/me', null, session.token, 'GET')).status, 401);
  } finally {
    server.kill();
    await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
