// Optional real-browser QA. Use an installed Puppeteer via PUPPETEER_MODULE.
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync, mkdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');

(async () => {
  const data = mkdtempSync(path.join(tmpdir(), 'paluphone-browser-'));
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: data }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base + '/healthz')).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const request = async (url, body, token) => {
      const res = await fetch(base + '/api' + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      const json = await res.json(); assert.equal(res.ok, true, JSON.stringify(json)); return json;
    };
    const seller = await request('/setup', { username: 'owner', password: 'secure-password', name: 'Business Owner', business_name: 'PaluPhone Business With A Long Name' });
    const group = await request('/groups', { name: 'iPhone 16 Pro Max — Monthly Group With A Long Name', model: 'iPhone 16 Pro Max', storage: '256GB', color: 'Black', color_hex: '#16130f', price: 72000, slots: 12, monthly: 6000, start_month: '2026-01', grace_days: 3, fine_amount: 100, fine_per_day: 0 }, seller.token);
    const member = await request(`/groups/${group.id}/members`, { name: 'Maria Santos With A Longer Member Name', phone: '09171234501', pin: '123456', payout_order: 1 }, seller.token);
    await request('/payments', { member_id: member.id, period: '2026-01', amount: 6000, fine: 0, paid_on: '2026-01-31', method: 'GCash' }, seller.token);
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run', '--disable-gpu', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR', error.message); });
    page.on('console', msg => { if (msg.type() === 'error') console.error('CONSOLE', msg.text()); });
    mkdirSync('.artifacts', { recursive: true });
    const measure = async label => {
      await page.evaluate(() => document.fonts.ready);
      const issues = await page.evaluate(() => {
        const result = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) result.push(`document width ${document.documentElement.scrollWidth} > ${innerWidth}`);
        for (const el of document.querySelectorAll('#app *, #modal-root *')) {
          if (el.closest('.table-wrap, .matrix-wrap, .legend-row') || el.tagName === 'CANVAS' || el.tagName === 'OPTION') continue;
          const r = el.getBoundingClientRect();
          if (r.width && r.height && (r.left < -1 || r.right > innerWidth + 1)) result.push(`${el.tagName}.${el.className?.baseVal ?? el.className}: ${Math.round(r.left)}..${Math.round(r.right)}`);
        }
        return result.slice(0, 20);
      });
      assert.deepEqual(issues, [], label);
      console.log('PASS', label);
    };
    const widths = process.env.BROWSER_WIDTHS ? process.env.BROWSER_WIDTHS.split(',').map(Number).filter(width => width > 0) : [320, 375, 390, 700, 768, 900, 1024, 1150, 1440, 1920];
    for (const width of widths) {
      await page.setViewport({ width, height: Number(process.env.BROWSER_HEIGHT || 900) });
      await page.goto(base);
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('.boot') && document.querySelector('#loginForm'));
      assert.equal(await page.$('.boot-pct, .boot-log, .boot-enter'), null);
      await measure(`login ${width}`);
      if (width === 390 || width === 1440) await page.screenshot({ path: `.artifacts/login-${width}.png`, fullPage: true });
      await page.evaluate(session => localStorage.setItem('palu.session', JSON.stringify(session)), seller);
      for (const route of ['dashboard', 'groups', `groups/${group.id}`, 'members', 'payments', 'settings']) {
        await page.goto(base + '/#/' + route);
        await page.reload();
        try { await page.waitForFunction(() => !!document.querySelector('.app-content')?.children.length); }
        catch (err) { console.error(await page.evaluate(() => document.body.innerText)); throw err; }
        await measure(`${route} ${width}`);
        if (route === 'dashboard' && (width === 390 || width === 1440)) await page.screenshot({ path: `.artifacts/dashboard-${width}.png`, fullPage: true });
      }
      await page.goto(base + '/#/groups');
      await page.waitForSelector('[data-newgroup]');
      await page.click('[data-newgroup]');
      await page.waitForSelector('.modal-wrap.in');
      await measure(`group modal ${width}`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.modal-wrap'));
      await page.goto(base + '/#/members');
      await page.waitForSelector('[data-member]');
      await page.click('[data-member]');
      await page.waitForSelector('.modal-wrap.in');
      await measure(`member modal ${width}`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.modal-wrap'));
      const membership = await request('/login', { role: 'member', phone: '09171234501', pin: '123456' });
      await page.evaluate(session => localStorage.setItem('palu.session', JSON.stringify(session)), membership);
      await page.goto('about:blank');
      await page.goto(base + '/#/portal');
      await page.reload();
      await page.waitForSelector('.portal-hero');
      await measure(`member portal ${width}`);
      assert.equal(await page.$eval('.rules-list', el => el.innerText.includes('3-Day Grace Extension')), true);
      await page.evaluate(() => localStorage.clear());
    }
    await page.goto('about:blank');
    await page.goto(base);
    await page.waitForSelector('#loginForm');
    await page.waitForFunction(() => !document.querySelector('.boot'));
    await page.type('[name=username]', 'owner');
    await page.type('[name=password]', 'secure-password');
    await page.click('#loginForm [type=submit]');
    await page.waitForSelector('.app-topbar');
    await page.click('[data-logout]');
    await page.waitForSelector('#loginForm');
    await page.click('[data-role=member]');
    await page.type('[name=phone]', '09171234501');
    await page.type('[name=pin]', '123456');
    await page.click('#loginForm [type=submit]');
    await page.waitForSelector('.portal-hero');
    await page.click('[data-logout]');
    await page.waitForSelector('#loginForm');
    console.log('PASS seller and member sign-in forms and logout');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('about:blank');
    await page.goto(base);
    await page.waitForFunction(() => !document.querySelector('.boot') && !!document.querySelector('#loginForm'));
    console.log('PASS reduced motion startup');
    await page.setRequestInterception(true);
    page.on('request', request => request.url().endsWith('/api/state') ? request.abort() : request.continue());
    await page.goto('about:blank');
    await page.goto(base);
    await page.waitForSelector('[data-retry]');
    console.log('PASS startup connection recovery');
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } finally {
    if (browser) await browser.close();
    server.kill();
    await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
    rmSync(data, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
