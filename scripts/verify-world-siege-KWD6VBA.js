#!/usr/bin/env node
/* verify-world-siege-KWD6VBA.js — client proof for the siege (task KWD6VBA).
   Loads world.html from this worktree in headless Chromium at 320/375/768/1280/1920:
   C1 launcher collision + reach, C2/C3 open-sheet collision/reach/overflow/44px,
   B1-B7 behaviour (soil ask, guest lane, owner-scoped targeting, 3D health bars,
   server verbs, refusal copy, wreck removal + shards + at-risk loot).
   Negative control: --no-forget (wreck never leaves the scene) must go RED.
   USAGE node scripts/verify-world-siege-KWD6VBA.js   EXITS 0 pass · 1 fail · 2 harness */
'use strict';
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920').split(',').map(s => parseInt(s, 10)).filter(Boolean);
const HEIGHT = { 320: 568, 375: 812, 768: 1024, 1280: 800, 1920: 1080 };
const OURS = /siege\.js|world-client\.js|foundry\.js/i;

let pass = 0, fail = 0;
const fails = [];
function check(width, id, ok, detail) {
  if (ok) { pass++; console.log(`  PASS ${width} ${id}${detail ? ' — ' + detail : ''}`); }
  else { fail++; fails.push(`${width} ${id}: ${detail || ''}`); console.log(`  FAIL ${width} ${id}${detail ? ' — ' + detail : ''}`); }
}

function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
}
async function waitPort(port, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const ok = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
    if (ok) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}
async function until(page, fnSrc, ms, arg) {
  try { await page.waitForFunction(fnSrc, { timeout: ms, polling: 100 }, arg); return true; } catch (_) { return false; }
}
// wait until an element's rect is identical across 4 consecutive frames (its
// transition has settled) — bounded, never a bare sleep
async function settle(page, sel) {
  return until(page, (s) => {
    const el = document.querySelector(s); if (!el) return false;
    const r = el.getBoundingClientRect(); const k = [r.top, r.left, r.width, r.height].map(Math.round).join(',');
    window.__st = window.__st || {};
    const prev = window.__st[s];
    if (prev && prev.k === k) { prev.n++; } else { window.__st[s] = { k, n: 0 }; }
    return window.__st[s].n >= 4;
  }, 8000, sel);
}

// in-page geometry helpers, installed once per page
const GEOM = `
window.__geo = {
  vis(el) {
    if (!el || !el.isConnected) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    let p = el; while (p && p !== document.documentElement) { const c = getComputedStyle(p); if (c.display === 'none' || +c.opacity === 0 || c.visibility === 'hidden') return false; p = p.parentElement; }
    const r = el.getBoundingClientRect(); return r.width * r.height > 0;
  },
  z(el) { let p = el, z = 0; while (p && p !== document.body) { const c = getComputedStyle(p); if (c.position !== 'static' && c.zIndex !== 'auto') { z = +c.zIndex; } p = p.parentElement; } return z; },
  fixedEls() {
    const out = [];
    document.querySelectorAll('body *').forEach(el => { const cs = getComputedStyle(el); if (cs.position === 'fixed' && this.vis(el)) out.push(el); });
    return out;
  },
  inter(a, b) { const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return (x > 0.5 && y > 0.5) ? { w: +x.toFixed(1), h: +y.toFixed(1) } : null; },
  name(el) { return el.id ? '#' + el.id : (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '')); },
  // scroll each scroll ancestor by hand so el is in view, clip, hit-test
  reach(el) {
    document.documentElement.style.scrollBehavior = 'auto';
    let r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden)/.test(cs.overflowX + cs.overflowY)) {
        const pr = p.getBoundingClientRect(); r = el.getBoundingClientRect();
        if (p.scrollWidth > p.clientWidth + 1) p.scrollLeft += (r.left - pr.left) - (pr.width - r.width) / 2;
        if (p.scrollHeight > p.clientHeight + 1) p.scrollTop += (r.top - pr.top) - (pr.height - r.height) / 2;
      }
    }
    r = el.getBoundingClientRect();
    let L = Math.max(r.left, 0), T = Math.max(r.top, 0), R = Math.min(r.right, innerWidth), B = Math.min(r.bottom, innerHeight);
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const pr = p.getBoundingClientRect(); L = Math.max(L, pr.left); T = Math.max(T, pr.top); R = Math.min(R, pr.right); B = Math.min(B, pr.bottom); }
    }
    if (R - L < 1 || B - T < 1) return { ok: false, why: 'clipped to nothing' };
    const cx = (L + R) / 2, cy = (T + B) / 2, hit = document.elementFromPoint(cx, cy);
    return { ok: !!hit && (hit === el || el.contains(hit)), why: hit ? this.name(hit) : 'null', rect: { left: L, top: T, right: R, bottom: B } };
  },
};`;


const CONTROL = process.argv.includes('--no-forget');   // negative control: wreck leaves the piece in the scene

async function runWidth(browser, base, width) {
  const height = HEIGHT[width] || 900;
  const page = await browser.newPage();
  const mobile = width < 720;
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && (e.stack || e.message) || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text() + ' @' + ((m.location() || {}).url || '')); });
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (_) {} });
  await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(GEOM);
  const ready = await until(page, () => window.WorldSiege && document.getElementById('sgBtn') && window.VintinuumWorld && window.VintinuumWorld._scene && window.VintinuumWorld._me, 30000);
  if (!ready) { console.log(`  HARNESS ${width}: never readied`); errs.slice(0, 6).forEach(e => console.log('    ' + e.slice(0, 200))); await page.close(); return 'unready'; }

  await until(page, () => { const g = window.__geo, v = document.getElementById('veil'), t = document.getElementById('dvToast'); return !(v && g.vis(v)) && !(t && g.vis(t)); }, 20000);

  // ── C1 resting launcher ──
  const rest = await page.evaluate(() => {
    const g = window.__geo, btn = document.getElementById('sgBtn');
    const reach = g.reach(btn); const br = btn.getBoundingClientRect(); const hits = [];
    const others = new Set(g.fixedEls().concat(Array.from(document.querySelectorAll('.dv-launch'))));
    others.forEach(el => { if (el === btn || el.contains(btn) || btn.contains(el) || el.id === 'stage' || el.id === 'dvScrim') return; if (!g.vis(el)) return; const i = g.inter(br, el.getBoundingClientRect()); if (i) hits.push(g.name(el) + ' ' + i.w + 'x' + i.h); });
    return { reach, hits };
  });
  check(width, 'C1 ⚔ launcher collides with nothing', rest.hits.length === 0, rest.hits.join('; ') || 'clean');
  check(width, 'C1 ⚔ launcher hit-test reaches it', rest.reach.ok, rest.reach.why);

  // ── fixtures: a foreign piece and one of mine beside the player ──
  await page.evaluate(() => {
    const W = window.VintinuumWorld, me = W._me;
    W._render = W._render || null;
    W._renderStruct({ id: 90001, owner_id: 999, kind: 'wall', x: me.x + 1.5, y: 0, z: me.z, rot: 0, meta: { piece: 'wall', mat: 'steel' } });
    W._renderStruct({ id: 90002, owner_id: 5, kind: 'floor', x: me.x - 1.5, y: 0, z: me.z, rot: 0, meta: { piece: 'foundation', mat: 'concrete' } });
    window.__sent = [];
    W.send = (m) => { window.__sent.push(m); return true; };
  });

  // ── B1 open via real click ──
  if (rest.reach.ok) { const r = rest.reach.rect; await page.mouse.click((r.left + r.right) / 2, (r.top + r.bottom) / 2); }
  else await page.evaluate(() => window.WorldSiege.open());
  const opened = await until(page, () => { const s = document.getElementById('sgSheet'); return s && s.classList.contains('open'); }, 4000);
  await settle(page, '#sgSheet');
  if (await page.$('#vwg-pill')) await settle(page, '#vwg-pill');
  check(width, 'B1 launcher opens the siege sheet', opened);
  const soilAsk = await page.evaluate(() => window.__sent.some(m => m.t === 'world:soil'));
  check(width, 'B1 opening asks the server what ground this is (world:soil)', soilAsk);

  // ── B2 guest lane: honest copy, every raid control disabled ──
  const guest = await page.evaluate(() => ({ g: !!window.VintinuumWorld._guest, soil: document.getElementById('sgSoil').textContent,
    dis: ['sgHit', 'sgCourt', 'sgMend'].map(id => document.getElementById(id).disabled) }));
  check(width, 'B2 guest sees why and cannot wage a siege', !guest.g || (/sign in/.test(guest.soil) && guest.dis.every(Boolean)), JSON.stringify(guest));

  // ── become a signed-in raider on blood ground ──
  await page.evaluate(() => {
    const W = window.VintinuumWorld; W._guest = false; W._myUserId = '5';
    window.dispatchEvent(new CustomEvent('vint:world-soil', { detail: { t: 'world:soil:ok', soil: 'march', violence: true, carry: {} } }));
    window.WorldSiege._inject({ t: 'world:state', siege: { hp: { 90002: [80, 200] }, rules: { on: true, reach: 4.5, mendReach: 6, cooldownMs: 1200 } } });
  });
  await new Promise(r => setTimeout(r, 400));
  const armed = await page.evaluate(() => ({ tgt: window.WorldSiege.target(), dis: ['sgHit', 'sgCourt', 'sgMend'].map(id => document.getElementById(id).disabled),
    tgtText: document.getElementById('sgTgt').textContent, bars: window.WorldSiege.bars() }));
  check(width, 'B3 target = nearest FOREIGN piece (never my own)', armed.tgt && armed.tgt.id === 90001, JSON.stringify(armed.tgt));
  check(width, 'B3 strike, court and mend all armed in the march', armed.dis.every(d => !d), JSON.stringify(armed.dis));
  check(width, 'B4 a scarred piece (mine, 80/200) wears a 3D health bar; the whole one does not', armed.bars.length === 1 && armed.bars[0] === '90002', JSON.stringify(armed.bars));

  // ── C2/C3 open-sheet geometry (armed state = the busiest layout) ──
  const openGeo = await page.evaluate(() => {
    const g = window.__geo, sheet = document.getElementById('sgSheet'); const sr = sheet.getBoundingClientRect(); const above = [];
    g.fixedEls().forEach(el => { if (el === sheet || sheet.contains(el) || el.contains(sheet) || el.id === 'dvScrim' || el.id === 'stage') return; if (g.z(el) < 1560) return; const i = g.inter(sr, el.getBoundingClientRect()); if (i) above.push(g.name(el) + ' ' + i.w + 'x' + i.h); });
    document.querySelectorAll('#dvRail .dv-launch').forEach(el => { if (!g.vis(el)) return; const i = g.inter(sr, el.getBoundingClientRect()); if (i) above.push(g.name(el) + ' ' + i.w + 'x' + i.h); });
    const ctrls = Array.from(sheet.querySelectorAll('button')); const unreach = [];
    ctrls.forEach(b => { const rr = g.reach(b); if (!rr.ok) unreach.push(g.name(b) + '→' + rr.why); });
    const rects = ctrls.map(b => ({ n: g.name(b), r: b.getBoundingClientRect() })); const pairs = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const x = g.inter(rects[i].r, rects[j].r); if (x) pairs.push(rects[i].n + '×' + rects[j].n + ' ' + x.w + 'x' + x.h); }
    const small = rects.filter(o => o.r.width > 0 && (o.r.width < 43.5 || o.r.height < 43.5)).map(o => o.n + ' ' + o.r.width.toFixed(0) + 'x' + o.r.height.toFixed(0));
    const out = [];
    sheet.querySelectorAll('.dv-body > *, .dv-body button').forEach(el => { const r = el.getBoundingClientRect(); if (r.right > sr.right + 0.5 || r.left < sr.left - 0.5) out.push(g.name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); });
    const lines = Array.from(sheet.querySelectorAll('.dv-body > *')).map(el => ({ n: g.name(el), r: el.getBoundingClientRect() })).filter(o => o.r.height > 0); const stack = [];
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) { const x = g.inter(lines[i].r, lines[j].r); if (x) stack.push(lines[i].n + '×' + lines[j].n); }
    return { above, unreach, pairs, small, out, stack, n: ctrls.length, inView: sr.top >= -0.5 && sr.bottom <= innerHeight + 0.5 && sr.left >= -0.5 && sr.right <= innerWidth + 0.5 };
  });
  check(width, 'C2 sheet collides with nothing above the scrim', openGeo.above.length === 0, openGeo.above.join('; ') || 'clean');
  check(width, 'C2 sheet sits inside the viewport', openGeo.inView);
  check(width, `C2 all ${openGeo.n} sheet controls reachable`, openGeo.unreach.length === 0, openGeo.unreach.join('; ') || 'all hit');
  check(width, 'C3 no two controls overlap', openGeo.pairs.length === 0, openGeo.pairs.join('; ') || 'clean');
  check(width, 'C3 no two body bands stack', openGeo.stack.length === 0, openGeo.stack.join('; ') || 'clean');
  check(width, 'C3 nothing overflows the sheet horizontally', openGeo.out.length === 0, openGeo.out.join('; ') || 'clean');
  check(width, 'C3 every control ≥44px', openGeo.small.length === 0, openGeo.small.join('; ') || 'all ≥44');

  // ── B5 the hands send the right server verbs ──
  const sent = await page.evaluate(() => {
    window.__sent = [];
    document.getElementById('sgHit').click(); document.getElementById('sgCourt').click(); document.getElementById('sgMend').click();
    return window.__sent;
  });
  check(width, 'B5 strike → world:siege on the foreign piece', sent.some(m => m.t === 'world:siege' && m.id === 90001), JSON.stringify(sent));
  check(width, 'B5 court → world:siege:court on the foreign piece', sent.some(m => m.t === 'world:siege:court' && m.id === 90001));
  check(width, 'B5 mend → world:mend on MY scarred piece', sent.some(m => m.t === 'world:mend' && m.id === 90002));

  // ── B6 a server refusal is spoken in the sheet ──
  const refused = await page.evaluate(() => { window.dispatchEvent(new CustomEvent('vint:world-err', { detail: { t: 'world:err', code: 'piece_on_safe_ground', op: 'siege' } })); return document.getElementById('sgStat').textContent; });
  check(width, 'B6 refusal reason shown (piece_on_safe_ground)', /safe ground/.test(refused), refused);

  // ── B7 hit → bar appears; wreck → piece leaves the scene, bar freed, shards burst ──
  const flow = await page.evaluate(async (control) => {
    const S = window.WorldSiege, W = window.VintinuumWorld;
    S._inject({ t: 'world:siege:hit', id: 90001, kind: 'wall', owner: 999, hp: 168, max: 180, dmg: 12, by: 'you', byUser: '5' });
    const afterHit = S.bars().slice().sort();
    let shardsBefore = 0; W._scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry' && o.geometry.parameters && o.geometry.parameters.width === 0.18) shardsBefore++; });
    S._inject({ t: 'world:siege:hit', id: 90001, kind: 'wall', owner: 999, hp: 0, max: 180, dmg: 12, by: 'you', byUser: '5', wrecked: true });
    if (!control) W.removeStruct(90001);      // what world-client does on world:struct:gone
    S._inject({ t: 'world:struct:gone', id: 90001, by: 'you' });
    await new Promise(r => requestAnimationFrame(() => r()));
    let shards = 0; W._scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry' && o.geometry.parameters && o.geometry.parameters.width === 0.18) shards++; });
    const inScene = W.structList().some(s => String(s.id) === '90001');
    const fd = window.WorldFoundry ? window.WorldFoundry.pieces().some(p => String(p.id) === '90001') : false;
    S._inject({ t: 'world:siege:loot', id: 90001, kind: 'wall', drop: 1, carry: { strand: 1 }, atRisk: true });
    await new Promise(r => setTimeout(r, 350));
    return { afterHit, bars: S.bars(), inScene, fd, shards: shards - shardsBefore, carry: document.getElementById('sgCarry').textContent, log: document.getElementById('sgLog').textContent };
  }, CONTROL);
  check(width, 'B7 a hit raises a health bar over the struck piece', flow.afterHit.indexOf('90001') >= 0, JSON.stringify(flow.afterHit));
  check(width, 'B7 a wrecked piece leaves the scene and the foundry index', !flow.inScene && !flow.fd, JSON.stringify({ inScene: flow.inScene, fd: flow.fd }));
  check(width, 'B7 its health bar is freed', flow.bars.indexOf('90001') < 0, JSON.stringify(flow.bars));
  check(width, 'B7 the wreck bursts into 14 shards', flow.shards === 14, String(flow.shards));
  check(width, 'B7 loot is named AT RISK until banked', /at risk/i.test(flow.carry) && /wrecked a wall/.test(flow.log), flow.carry + ' | ' + flow.log);

  const mine = errs.filter(e => OURS.test(e));
  check(width, 'A3 no page errors from touched files', mine.length === 0, mine.length ? mine.slice(0, 3).join(' | ').slice(0, 500) : `clean (${errs.length} unrelated)`);
  await page.close();
  return 'ok';
}

(async () => {
  const port = await freePort();
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  const kill = () => { try { srv.kill('SIGTERM'); } catch (_) {} };
  process.on('exit', kill);
  if (!(await waitPort(port, 8000))) { console.log('HARNESS: http.server did not start'); kill(); process.exit(2); }
  const base = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let unready = 0;
  try {
    for (const w of WIDTHS) {
      console.log(`── ${w}px ──`);
      const r = await runWidth(browser, base, w);
      if (r === 'unready') unready++;
    }
  } finally { await browser.close(); kill(); }
  console.log(`\n${pass}/${pass + fail} pass` + (fail ? `\nFAILURES:\n  ${fails.join('\n  ')}` : '') + (unready ? `\n${unready} width(s) never readied` : ''));
  process.exit(unready && !fail ? 2 : (fail ? 1 : 0));
})().catch(e => { console.error('HARNESS crash:', e); process.exit(2); });
