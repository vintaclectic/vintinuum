#!/usr/bin/env node
'use strict';
// No live broker calls. Default mode exercises approval controls against an
// isolated API; --browser additionally measures the page at all required widths.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const file = path.resolve(__dirname, '../mercatus.html');
const html = fs.readFileSync(file, 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
const policy = { enabled: false, minConfidence: 70, minMerit: 62, allowBuys: true, allowSells: true, maxSignalAgeMinutes: 10 };
const state = { mode: 'live', requiresApproval: true, halted: false, automation: policy, circuit: { state: 'CLOSED' } };

async function logic() {
  const elements = new Map();
  for (const m of html.matchAll(/id="([^"]+)"/g)) {
    elements.set(m[1], { value: m[1] === 'mcAutoConfidence' ? '70' : '', hidden: false,
      disabled: false, textContent: '', innerHTML: '', dataset: {}, className: '',
      reportValidity() { return this.value !== '' && Number.isInteger(Number(this.value)) && Number(this.value) >= 0 && Number(this.value) <= 100; },
      addEventListener() {} });
  }
  const requests = [];
  let responseStatus = 200;
  let accept = true;
  const context = vm.createContext({
    console, URL, Date, Promise, Map, Set, Math,
    document: { readyState: 'loading', addEventListener() {}, getElementById: id => elements.get(id), activeElement: null },
    window: { addEventListener() {} },
    confirm: () => accept,
    fetch: async (url, opts) => {
      requests.push({ url, ...opts, body: JSON.parse(opts.body) });
      const body = JSON.parse(opts.body);
      return { status: responseStatus, ok: responseStatus === 200, text: async () => JSON.stringify(responseStatus === 200
        ? { automation: { ...policy, ...body } } : { error: 'Mode changed; refresh first' }) };
    },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {}
  });
  vm.runInContext(script, context);
  context.mcPollAll = () => Promise.resolve();
  const c = context, el = id => elements.get(id);
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  c.MC.state = structuredClone(state); c.MC.token = 'test-only'; c.MC.authed = true;
  c.MC.pending = { pending: [] }; c.mcRenderCtl(); c.mcRenderBadges();
  check(el('mcAlertLiveText').innerHTML.includes('Manual approval'), 'live banner describes manual mode');
  el('mcAutoConfidence').value = '101'; c.mcSaveAutomation(true); await settle();
  check(requests.length === 0, 'out-of-range confidence cannot submit');
  el('mcAutoConfidence').value = '73'; accept = false; c.mcSaveAutomation(true); await settle();
  check(requests.length === 0, 'declining live confirmation makes no request');
  accept = true; c.mcSaveAutomation(true); c.mcSaveAutomation(true); await settle();
  check(requests.length === 1, 'double-submit is locked while saving');
  assert.deepEqual(requests[0].body, { enabled: true, minMerit: 73, confirmMode: 'live' }); checks++;
  check(requests[0].headers.Authorization === 'Bearer test-only', 'owner bearer token accompanies policy change');
  check(el('mcBadges').innerHTML.includes('merit ≥ 73'), 'badge reflects server-confirmed threshold');
  check(el('mcAlertLiveText').innerHTML.includes('buys and sells'), 'live banner describes automated order sides');
  check(!el('mcQBody').innerHTML.includes('nothing reaches the broker'), 'empty queue does not claim all orders need review');
  responseStatus = 409; c.mcSaveAutomation(false); await settle();
  check(c.MC.state.automation.enabled, 'failed save preserves confirmed enabled policy');
  check(el('mcAutoOut').textContent.includes('Could not save'), 'mode mismatch is visible');
  check(!el('mcAutoEnable').disabled, 'failed request releases controls');
  responseStatus = 200; el('mcAutoConfidence').value = ''; c.mcSaveAutomation(false); await settle();
  check(!c.MC.state.automation.enabled, 'manual mode can be restored even with invalid draft threshold');
  check(requests.at(-1).body.minMerit === 73, 'disable retains confirmed threshold');
  c.MC.autoDirty = true; el('mcAutoConfidence').value = '82'; c.mcRenderCtl();
  check(el('mcAutoConfidence').value === '82', 'polling preserves unsaved threshold');
  c.MC.errs.state = 'connection failed'; const before = requests.length; c.mcSaveAutomation(true); await settle();
  check(requests.length === before, 'stale state cannot authorize a policy change');
  c.MC.errs = {}; c.MC.session = { linked: false, error: 'circuit_open' }; c.mcRenderCtl();
  check(!el('mcCtlBreaker').disabled, 'broker circuit error allows reset despite older CLOSED state');
  check(el('mcCtlBody').innerHTML.includes('Reset the breaker'), 'broker failure includes recovery instructions');
  c.MC.session = { linked: true }; c.MC.strat = { circuit: { state: 'OPEN' } }; c.mcRenderCtl();
  check(!el('mcCtlBreaker').disabled, 'strategy circuit OPEN also permits reset');
  check(c.mcTradingError('account equity unavailable').includes('order has not been sent'), 'approval equity failure explains result');
  c.MC.state = { mode: 'live', requiresApproval: false }; c.MC.strat = { trading: { automation: { enabled: true } } };
  c.mcRenderCtl(); c.mcRenderBadges();
  check(el('mcAutoEnable').disabled, 'older API without policy cannot enable automation');
  check(el('mcAlertLiveText').innerHTML.includes('unavailable'), 'missing policy is not misreported as manual');
}

async function browser() {
  const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');
  const profile = fs.mkdtempSync('/tmp/mercatus-controls-');
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, pipe: true, userDataDir: profile,
      args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(s => {
      mcStopPolling(); mcStopLoop(); mcPollAll = () => Promise.resolve();
      window.__mcTestInject({ state: s, authed: true, token: 'test-only', pending: { pending: [] },
        session: { linked: false, error: 'circuit_open: ' + 'broker error '.repeat(30) },
        strat: { circuit: { state: 'OPEN' }, config: { scanInterval: 5 } } });
      document.querySelectorAll('details').forEach(el => el.open = true);
    }, state);
    for (const width of [320, 375, 768, 1280, 1920]) {
      await page.setViewport({ width, height: 900 });
      for (const enabled of [false, true]) {
        await page.evaluate(enabled => { MC.state.automation.enabled = enabled; mcRenderAll(); }, enabled);
        const failures = await page.evaluate(() => {
          const out = [];
          if (document.documentElement.scrollWidth > innerWidth) out.push('page horizontal overflow');
          for (const row of document.querySelectorAll('.mc-tr>div')) {
            const label = row.querySelector('i'), value = row.querySelector('b');
            if (!label || !value) continue;
            const a = label.getBoundingClientRect(), b = value.getBoundingClientRect();
            if (a.width && b.width && Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) out.push('label overlaps value');
          }
          const controls = [...document.querySelectorAll('#mcAutomationForm input, #mcAutomationForm button')].map(el => el.getBoundingClientRect());
          for (let i = 0; i < controls.length; i++) {
            const a = controls[i];
            if (a.left < 0 || a.right > innerWidth || a.height < 40) out.push('control outside viewport or too short');
            for (const b of controls.slice(i + 1)) if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) out.push('controls overlap');
          }
          return out;
        });
        assert.deepEqual(failures, [], `${width}px auto=${enabled}`); checks++;
      }
    }
    assert.deepEqual(errors, []); checks++;
    await page.setViewport({ width: 375, height: 900 });
    await page.evaluate(() => document.getElementById('mcAutomationForm').scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: '/tmp/mercatus-controls-375.png' });
  } finally {
    if (browser) await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
(async () => {
  await logic();
  if (process.argv.includes('--browser')) await browser();
  console.log(`Mercatus controls: ${checks} checks passed${process.argv.includes('--browser') ? ' including five viewport widths' : '; browser layout not measured (use --browser)'}`);
})().catch(e => { console.error(e); process.exitCode = 1; });
