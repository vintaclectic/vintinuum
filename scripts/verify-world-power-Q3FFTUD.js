#!/usr/bin/env node
/* verify-world-power-Q3FFTUD.js — proof for task Q3FFTUD (Foundry power networks)
   ────────────────────────────────────────────────────────────────────────────
   Server half: ~/vintinuum-api/test/world-power.test.js (graph rules, owner
   scope, autoloom settle + claim lock, world-mvp wiring; --control reverts).
   This harness proves the CLIENT half in headless Chromium, guest + simulated
   server frames, at every width:

   P0  the client power-graph.js is byte-identical to the server's.
   P1  guest sketch (loaded through foundry's real localStorage path):
       node—conduit—node + a doorway on the live corner + a stray conduit →
       nodes are autoloom, conduit powered, doorway autodoor, stray stays dark.
   P2  the light really hangs in the scene: each powered piece carries one
       '__pwr' group of additive meshes in the owner's tint.
   P3  autodoor: the curtain parts (opacity→0) when the player stands in the
       doorway and closes again (opacity>0.25) when they walk away.
   P4  server authority: two server pieces where the verdict powers only the
       node — the adjacent conduit stays DARK (the client never re-decides a
       signed-in world); an empty verdict removes the light; owner tint is the
       stable hashed colour.
   P5  world-client routes world:power → vint:world-power (static) and the page
       adds ZERO DOM (No-Collision: nothing new can overlap anything).
   P6  no page errors from the touched files.
   P7  kill switch ?power=0 → WorldPower.disabled, nothing painted.

   USAGE  node scripts/verify-world-power-Q3FFTUD.js   (VERIFY_WIDTHS=375,1280 …)
   EXITS  0 pass · 1 a check failed · 2 harness could not run
*/
'use strict';
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920').split(',').map(s => parseInt(s, 10)).filter(Boolean);
const HEIGHT = { 320: 640, 375: 812, 768: 1024, 1280: 800, 1920: 1080 };
const OURS = /power-glow\.js|power-graph\.js|foundry\.js|world-client\.js/i;

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
const fs = require('fs');

async function runWidth(browser, base, width, kill) {
  const height = HEIGHT[width] || 900;
  const page = await browser.newPage();
  const mobile = width < 720;
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && (e.stack || e.message) || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text() + ' @' + ((m.location() || {}).url || '')); });
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (_) {} });
  await page.goto(`${base}/world.html${kill ? '?power=0' : ''}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const ready = await until(page, () => window.WorldFoundry && window.WorldPower && window.VintinuumWorld && window.VintinuumWorld._scene && window.VintinuumWorld._me, 30000);
  if (!ready) { console.log(`  HARNESS ${width}: world never readied`); errs.slice(0, 6).forEach(e => console.log('    ' + e.slice(0, 200))); await page.close(); return 'unready'; }

  if (kill) {
    const k = await page.evaluate(() => ({ dis: !!window.WorldPower.disabled, fx: (() => { let n = 0; window.VintinuumWorld._scene.traverse(o => { if (o.name === '__pwr') n++; }); return n; })() }));
    check(width, 'P7 ?power=0 disables the painter', k.dis && k.fx === 0, JSON.stringify(k));
    await page.close(); return 'ok';
  }

  // ── P1/P2: a guest sketch through foundry's real load path ────────────
  const r = await page.evaluate(async () => {
    const W = window.VintinuumWorld, F = window.WorldFoundry, P = window.WorldPower;
    const frames = (n) => new Promise(res => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    F.reset();
    const key = 'vint:foundry:v1:' + ((W.currentWorldId && W.currentWorldId()) || 'hub') + ':guest';
    localStorage.setItem(key, JSON.stringify([
      { id: 'L1', piece: 'node', mat: 'biomech', x: 0, y: 0, z: 0, rot: 0 },
      { id: 'L2', piece: 'conduit', mat: 'biomech', x: 1, y: 0, z: 0, rot: 0 },
      { id: 'L3', piece: 'node', mat: 'biomech', x: 2, y: 0, z: 0, rot: 0 },
      { id: 'L4', piece: 'doorway', mat: 'wood', x: 3, y: 0, z: 0, rot: 0 },
      { id: 'L5', piece: 'conduit', mat: 'biomech', x: 7, y: 0, z: 6, rot: 0 },
    ]));
    window.dispatchEvent(new CustomEvent('vint:world-ready', { detail: { guest: true } }));
    await new Promise(res => setTimeout(res, 400)); await frames(3);
    const out = { applied: P.applied(), pieces: F.pieces().map(p => p.id) };
    const fx = {}; let additive = true;
    ['L1', 'L2', 'L3', 'L4', 'L5'].forEach(id => {
      const m = F.meshOf(id); if (!m) { fx[id] = -1; return; }
      const g = m.children.filter(c => c.name === '__pwr'); fx[id] = g.length;
      g.forEach(x => x.traverse(o => { if (o.isMesh && o.material.blending !== window.VintinuumWorld._THREE.AdditiveBlending) additive = false; }));
    });
    out.fx = fx; out.additive = additive;
    // ── P3 the autodoor curtain
    const door = F.meshOf('L4'), cur = door && door.children.find(c => c.name === '__pwr').userData.curtain;
    const me = W._me, save = { x: me.x, z: me.z };
    const hold = (x, z, n) => new Promise(res => { let i = 0; const f = () => { me.x = x; me.z = z; if (++i >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await hold(-9, -9, 40); out.closed = cur ? +cur.material.opacity.toFixed(3) : null;
    await hold(3, 0.4, 50); out.open = cur ? +cur.material.opacity.toFixed(3) : null; out.openVis = cur ? cur.visible : null;
    await hold(-9, -9, 50); out.reclosed = cur ? +cur.material.opacity.toFixed(3) : null;
    me.x = save.x; me.z = save.z;
    out.tintGuest = P.tintOf('guest');
    return out;
  });
  const a = r.applied;
  check(width, 'P1 both nodes are an autoloom', a.L1 && a.L1.machine === 'autoloom' && a.L3 && a.L3.machine === 'autoloom', JSON.stringify({ L1: a.L1, L3: a.L3 }));
  check(width, 'P1 the joining conduit is powered', a.L2 && a.L2.role === 'conduit', JSON.stringify(a.L2));
  check(width, 'P1 the doorway on the live corner is an autodoor', a.L4 && a.L4.machine === 'autodoor', JSON.stringify(a.L4));
  check(width, 'P1 the stray conduit stays dark', !a.L5 && r.pieces.includes('L5'), 'pieces=' + r.pieces.join(','));
  check(width, 'P2 one additive light group on each powered piece, none on the dark one', r.fx.L1 === 1 && r.fx.L2 === 1 && r.fx.L3 === 1 && r.fx.L4 === 1 && r.fx.L5 === 0 && r.additive, JSON.stringify(r.fx) + ' tint=' + r.tintGuest);
  check(width, 'P3 autodoor curtain closed while away', r.closed > 0.25, 'opacity ' + r.closed);
  check(width, 'P3 curtain parts when the player stands in the doorway', r.open < 0.05 && r.openVis === false, 'opacity ' + r.open + ' visible=' + r.openVis);
  check(width, 'P3 curtain closes again behind them', r.reclosed > 0.25, 'opacity ' + r.reclosed);

  // ── P4 server authority ───────────────────────────────────────────────
  const s = await page.evaluate(async () => {
    const W = window.VintinuumWorld, F = window.WorldFoundry, P = window.WorldPower;
    const mk = (o) => { const g = F.buildFor(o); if (g) W._scene.add(g); return !!g; };
    const built = [mk({ id: 900, owner_id: '42', kind: 'light', x: 8, y: 0, z: -8, rot: 0, meta: { piece: 'node', r: 0 } }),
                   mk({ id: 901, owner_id: '42', kind: 'fence', x: 9, y: 0, z: -8, rot: 0, meta: { piece: 'conduit', r: 0 } })];
    const send = (power) => window.dispatchEvent(new CustomEvent('vint:world-power', { detail: { t: 'world:power', power } }));
    send({ powered: { '900': '42' }, machines: {}, networks: [] });
    await new Promise(res => setTimeout(res, 150));
    const one = P.applied();
    send({ powered: {}, machines: {}, networks: [] });
    await new Promise(res => setTimeout(res, 150));
    const none = P.applied();
    return { built, one900: one['900'] || null, one901: one['901'] || null, none900: none['900'] || null, hashTint: P.tintOf('42'), noneL1: !!none.L1 };
  });
  check(width, 'P4 server verdict lights the node it names', s.built.every(Boolean) && s.one900 && s.one900.owner === '42', JSON.stringify(s.one900));
  check(width, 'P4 adjacent server conduit stays dark — the client never re-decides', s.one901 === null);
  check(width, 'P4 an empty verdict puts the server light out (guest sketch untouched)', s.none900 === null && s.noneL1, JSON.stringify({ none900: s.none900, L1: s.noneL1 }));
  check(width, 'P4 other owners wear a stable hashed tint', /^hsl\(\d+,85%,62%\)$/.test(s.hashTint), s.hashTint);

  const mine = errs.filter(e => OURS.test(e));
  check(width, 'P6 no page errors from touched files', mine.length === 0, mine.slice(0, 3).join(' | ').slice(0, 400) || `clean (${errs.length} unrelated)`);
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
  // P0 + P5 static
  const api = '/home/vinta/vintinuum-api/world/power-graph.js';
  if (fs.existsSync(api)) check('-', 'P0 client power-graph.js is byte-identical to the server solver', fs.readFileSync(api, 'utf8') === fs.readFileSync(path.join(ROOT, 'body/world/power-graph.js'), 'utf8'));
  else console.log('  skip P0 (no vintinuum-api checkout)');
  const wc = fs.readFileSync(path.join(ROOT, 'body/world/world-client.js'), 'utf8');
  check('-', "P5 world-client routes world:power → vint:world-power", /m\.t === 'world:power'[\s\S]{0,400}vint:world-power/.test(wc));
  // No-Collision: the painter lives entirely in the 3D scene. Measured statically
  // (a live DOM count is noise — the world adds toasts/agents while booting).
  const glow = fs.readFileSync(path.join(ROOT, 'body/world/power-glow.js'), 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
  check('-', 'P5 power-glow.js creates no DOM (no document.* / innerHTML / appendChild)', !/\bdocument\.|innerHTML|appendChild|insertAdjacent/.test(glow));
  try {
    for (const w of WIDTHS) {
      console.log(`── ${w}px ──`);
      const r = await runWidth(browser, base, w);
      if (r === 'unready') unready++;
    }
    console.log('── kill switch ──');
    if ((await runWidth(browser, base, 375, true)) === 'unready') unready++;
  } finally { await browser.close(); kill(); }
  console.log(`\n${pass}/${pass + fail} pass` + (fail ? `\nFAILURES:\n  ${fails.join('\n  ')}` : '') + (unready ? `\n${unready} width(s) never readied` : ''));
  process.exit(unready && !fail ? 2 : (fail ? 1 : 0));
})().catch(e => { console.error('HARNESS crash:', e); process.exit(2); });
