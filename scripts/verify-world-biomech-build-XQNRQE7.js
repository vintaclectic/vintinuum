#!/usr/bin/env node
/* verify-world-biomech-build-XQNRQE7.js — proof for task XQNRQE7
   ────────────────────────────────────────────────────────────────────────────
   Loads world.html (served from THIS worktree) as a GUEST in headless Chromium
   at each width and asserts:

   A. BIOMECH
      A1  RiggedPresence.probeBiomech ran and the GPU LINKED both biomech
          programs (skinned body + world-space piece): state === 'ok'.
      A2  at least one live mesh in the scene wears a biomech material, and its
          onBeforeCompile actually ran (the program that drew it is ours).
      A3  no shader-compile error and no page error originating from the files
          this task touched (rigged-presence.js, foundry.js, world-client.js).

   B. FOUNDRY (functional, guest = client-only sketch lane)
      B1  the ⬢ foundry launcher exists on the rail and opens #fdSheet (a real
          click at the launcher's hit-tested centre).
      B2  foundation on bare ground → green, places, persists to localStorage.
      B3  a wall then SNAPS onto the foundation's edge at slab height (0.30m).
      B4  a floor·roof then snaps onto the wall top (2.90m).
      B5  a floor nudged out into empty ground is RED with a reason.
      B6  rotate advances 90° steps; every placement fired vint:foundry-place.
      B7  one-sheet law: opening the loom evicts the foundry (ghost removed,
          scrim no longer cleared) and opening the foundry evicts the loom.

   C. NO-COLLISION (measured, not assumed)
      C1  resting (after the boot veil + arrival toast, both pre-existing
          transients that cover ANY launcher at that rail position): the launcher's rect intersects no other visible fixed element
          and no other rail launcher, and a hit-test at its (scroll-revealed,
          clip-aware) centre returns the launcher itself.
      C2  open: the sheet intersects no visible fixed element that sits ABOVE
          the shared scrim (z ≥ 1560 — the rail, #leave …); everything below the
          scrim is the designed modal overlay. Every sheet control is reachable:
          each scroll ancestor is scrolled by hand (never scrollIntoView, it
          scrolls the document too), the rect is clipped to every scrollport,
          and elementFromPoint at the surviving centre must return the control.
      C3  no two sheet controls overlap each other.

   USAGE   node scripts/verify-world-biomech-build-XQNRQE7.js
           VERIFY_WIDTHS=375,1280 node scripts/verify-world-biomech-build-XQNRQE7.js
   EXITS   0 all pass · 1 a check failed · 2 harness could not run (no WebGL,
           server did not start, page never readied)
*/
'use strict';
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = (process.env.VERIFY_WIDTHS || '375,1280').split(',').map(s => parseInt(s, 10)).filter(Boolean);
const HEIGHT = { 320: 640, 375: 812, 768: 1024, 1280: 800, 1920: 1080 };
const OURS = /rigged-presence\.js|foundry\.js|world-client\.js|biomech|WebGLProgram|Shader Error/i;

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

async function runWidth(browser, base, width) {
  const height = HEIGHT[width] || 900;
  const page = await browser.newPage();
  const mobile = width < 720;
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + (e && (e.stack || e.message) || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text() + ' @' + ((m.location() || {}).url || '')); });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.clear(); } catch (_) {}
    window.__bm = null; window.__places = [];
    addEventListener('vint:biomech', e => { window.__bm = e.detail; });
    addEventListener('vint:foundry-place', e => { window.__places.push(e.detail); });
  });
  await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(GEOM);

  const ready = await until(page, () => window.__bm && window.WorldFoundry && document.getElementById('fdBtn') && window.VintinuumWorld && window.VintinuumWorld._scene, 30000);
  if (!ready) {
    const st = await page.evaluate(() => ({ bm: window.__bm, wf: !!window.WorldFoundry, btn: !!document.getElementById('fdBtn'), scene: !!(window.VintinuumWorld && window.VintinuumWorld._scene) }));
    console.log(`  HARNESS ${width}: world never readied ${JSON.stringify(st)}`);
    errs.slice(0, 8).forEach(e => console.log('    ' + e.slice(0, 220)));
    await page.close();
    return 'unready';
  }

  // ── A. biomech ────────────────────────────────────────────────────────
  const bm = await page.evaluate(() => window.__bm);
  check(width, 'A1 biomech programs linked on this GPU', bm.state === 'ok', JSON.stringify(bm));
  // a body needs the rig glb + a few frames; wait for a compiled biomech mesh
  await until(page, () => { let n = 0; window.VintinuumWorld._scene.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.biomech && o.material.userData.__compiled) n++; }); return n > 0; }, 25000);
  const bodies = await page.evaluate(() => {
    let skinned = 0, compiled = 0;
    window.VintinuumWorld._scene.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.biomech) { if (o.isSkinnedMesh) skinned++; if (o.material.userData.__compiled) compiled++; } });
    return { skinned, compiled };
  });
  check(width, 'A2 live skinned bodies wear the compiled biomech material', bodies.skinned > 0 && bodies.compiled > 0, JSON.stringify(bodies));

  // ── C1. resting launcher ──────────────────────────────────────────────
  // RESTING means after the boot transients: the #veil loader and the one-shot
  // "first light" arrival toast. MEASURED (375x812, with ?foundry=0 too): at t0
  // that toast (z1700) sits over the phone rail's band and covers whichever
  // launcher is at x≈94-281 (dvAgentBtn without the foundry) — a pre-existing
  // transient, not this launcher's allocation. Bounded wait, then measure.
  const calm = await until(page, () => {
    const g = window.__geo, v = document.getElementById('veil'), t = document.getElementById('dvToast');
    return !(v && g.vis(v)) && !(t && g.vis(t));
  }, 20000);
  if (!calm) console.log(`  NOTE ${width}: boot veil/toast still visible after 20s — measuring anyway`);
  const rest = await page.evaluate(() => {
    const g = window.__geo, btn = document.getElementById('fdBtn');
    const reach = g.reach(btn);
    const br = btn.getBoundingClientRect();
    const hits = [];
    const others = new Set(g.fixedEls().concat(Array.from(document.querySelectorAll('.dv-launch'))));
    others.forEach(el => {
      if (el === btn || el.contains(btn) || btn.contains(el) || el.id === 'stage' || el.id === 'dvScrim') return;
      if (!g.vis(el)) return;
      const i = g.inter(br, el.getBoundingClientRect()); if (i) hits.push(g.name(el) + ' ' + i.w + 'x' + i.h);
    });
    return { reach, hits };
  });
  check(width, 'C1 launcher collides with nothing', rest.hits.length === 0, rest.hits.join('; ') || 'clean');
  check(width, 'C1 launcher hit-test reaches it', rest.reach.ok, rest.reach.why);

  // ── B1. open via a REAL click on the launcher ────────────────────────
  if (rest.reach.ok) {
    const r = rest.reach.rect;
    await page.mouse.click((r.left + r.right) / 2, (r.top + r.bottom) / 2);
  } else {
    await page.evaluate(() => window.WorldFoundry.open());
  }
  const opened = await until(page, () => window.WorldFoundry.isOpen() && document.getElementById('fdSheet').classList.contains('open'), 5000);
  await settle(page, '#fdSheet');
  if (await page.$('#vwg-pill')) await settle(page, '#vwg-pill');   // VintDock lifts it off the sheet
  check(width, 'B1 launcher opens the foundry sheet', opened);

  // ── C2/C3. open-sheet collisions + reachability ─────────────────────
  const openGeo = await page.evaluate(() => {
    const g = window.__geo, sheet = document.getElementById('fdSheet');
    const sr = sheet.getBoundingClientRect();
    const above = [];
    g.fixedEls().forEach(el => {
      if (el === sheet || sheet.contains(el) || el.contains(sheet) || el.id === 'dvScrim' || el.id === 'stage') return;
      if (g.z(el) < 1560) return;                       // under the scrim: designed overlay
      const i = g.inter(sr, el.getBoundingClientRect()); if (i) above.push(g.name(el) + ' ' + i.w + 'x' + i.h);
    });
    // the rail's launchers are flow children of a fixed rail; test them too
    document.querySelectorAll('#dvRail .dv-launch').forEach(el => { if (!g.vis(el)) return; const i = g.inter(sr, el.getBoundingClientRect()); if (i) above.push(g.name(el) + ' ' + i.w + 'x' + i.h); });
    const ctrls = Array.from(sheet.querySelectorAll('button'));
    const unreach = [];
    ctrls.forEach(b => { const rr = g.reach(b); if (!rr.ok) unreach.push(g.name(b) + (b.dataset.piece || b.dataset.mat ? '[' + (b.dataset.piece || b.dataset.mat) + ']' : '') + '→' + rr.why); });
    // reset horizontal scroll, then pairwise overlap of controls as laid out
    sheet.querySelectorAll('.fd-scroll').forEach(s => { s.scrollLeft = 0; });
    const rects = ctrls.map(b => ({ n: g.name(b) + (b.dataset.piece ? '[' + b.dataset.piece + ']' : b.dataset.mat ? '[' + b.dataset.mat + ']' : ''), r: b.getBoundingClientRect() }));
    const pairs = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const x = g.inter(rects[i].r, rects[j].r); if (x) pairs.push(rects[i].n + '×' + rects[j].n + ' ' + x.w + 'x' + x.h); }
    const small = rects.filter(o => o.r.width > 0 && (o.r.width < 43.5 || o.r.height < 43.5)).map(o => o.n + ' ' + o.r.width.toFixed(0) + 'x' + o.r.height.toFixed(0));
    return { above, unreach, pairs, small, n: ctrls.length, sheetTop: Math.round(sr.top) };
  });
  check(width, 'C2 open sheet collides with nothing above the scrim', openGeo.above.length === 0, openGeo.above.join('; ') || `clean (sheet top ${openGeo.sheetTop}px)`);
  check(width, `C2 all ${openGeo.n} sheet controls reachable`, openGeo.unreach.length === 0, openGeo.unreach.join('; ') || 'all hit');
  check(width, 'C3 no two sheet controls overlap', openGeo.pairs.length === 0, openGeo.pairs.join('; ') || 'clean');
  check(width, 'C3 every sheet control ≥44px touch target', openGeo.small.length === 0, openGeo.small.join('; ') || 'all ≥44');

  // ── B2-B6. snap building, guest sketch lane ─────────────────────────
  const build = await page.evaluate(async () => {
    const F = window.WorldFoundry, out = {};
    const frame = () => new Promise(r => requestAnimationFrame(() => r()));
    F.select('foundation'); await frame(); await frame();
    out.fCand = F.candidate();
    out.fPlaced = F.place();
    F.select('wall'); await frame(); await frame();
    out.wCand = F.candidate();
    out.wPlaced = F.place();
    F.select('floor'); await frame(); await frame();
    out.flCand = F.candidate();
    out.flPlaced = F.place();
    // red: nudge far out into empty ground
    for (let i = 0; i < 4; i++) document.getElementById('fdF').click();
    await frame(); await frame();
    out.redCand = F.candidate();
    out.stat = document.getElementById('fdStat').textContent;
    out.statCls = document.getElementById('fdStat').className;
    // rotation
    F.select('wall'); const r0 = F.candidate().rot; F.rotate(); const r1 = F.candidate().rot;
    out.rot = [r0, r1];
    out.pieces = F.pieces();
    out.places = window.__places.slice();
    let ls = null; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.indexOf('vint:foundry:v1:') === 0) ls = { k, n: JSON.parse(localStorage.getItem(k)).length }; }
    out.ls = ls;
    out.ghostInScene = (() => { let n = 0; window.VintinuumWorld._scene.traverse(o => { if (o.renderOrder === 10) n++; }); return n; })();
    return out;
  });
  const short = c => c && `ok=${c.ok} y=${c.y} key=${c.key} mode=${c.mode}${c.reason ? ' reason="' + c.reason + '"' : ''}`;
  check(width, 'B2 foundation green on bare ground, places', build.fCand.ok && build.fCand.y === 0 && build.fPlaced === true, short(build.fCand));
  check(width, 'B2 sketch persisted to localStorage', !!build.ls && build.ls.n >= 1, JSON.stringify(build.ls));
  check(width, 'B3 wall snaps onto the foundation edge at 0.30m', build.wCand.ok && Math.abs(build.wCand.y - 0.3) < 1e-6 && build.wCand.connected && build.wPlaced === true, short(build.wCand));
  check(width, 'B4 floor·roof snaps onto the wall top at 2.90m', build.flCand.ok && Math.abs(build.flCand.y - 2.9) < 1e-6 && build.flPlaced === true, short(build.flCand));
  check(width, 'B5 floor in empty ground is red with a reason', build.redCand.ok === false && !!build.redCand.reason && build.statCls === 'bad', short(build.redCand) + ` status="${build.stat}"`);
  check(width, 'B6 rotate steps 90°', build.rot[1] === (build.rot[0] + 1) % 4, JSON.stringify(build.rot));
  check(width, 'B6 every placement fired vint:foundry-place (mode local)', build.places.length === 3 && build.places.every(p => p.mode === 'local'), build.places.map(p => p.piece + '@' + p.y).join(', '));
  check(width, 'B1 ghost is in the scene while open', build.ghostInScene > 0, 'ghost meshes ' + build.ghostInScene);

  // close → ghost gone
  await page.keyboard.press('Escape');
  await until(page, () => !window.WorldFoundry.isOpen(), 3000);
  const ghostAfter = await page.evaluate(() => { let n = 0; window.VintinuumWorld._scene.traverse(o => { if (o.renderOrder === 10) n++; }); return n; });
  check(width, 'B1 Escape closes the sheet and removes the ghost', ghostAfter === 0, 'ghost meshes ' + ghostAfter);

  // ── B7. one-sheet law: the foundry and a sibling sheet evict each other ──
  const evict = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const ghosts = () => { let n = 0; window.VintinuumWorld._scene.traverse(o => { if (o.renderOrder === 10) n++; }); return n; };
    const openN = () => document.querySelectorAll('.dv-sheet.open').length;
    const lm = document.getElementById('lmBtn');
    if (!lm) return { skipped: 'no loom launcher' };
    window.WorldFoundry.open(); await wait(450);
    lm.click(); await wait(450);
    const a = { foundry: window.WorldFoundry.isOpen(), loom: !!document.querySelector('#dvLoomSheet.open'), open: openN(), ghosts: ghosts(), fdBody: document.body.classList.contains('fd-open') };
    window.WorldFoundry.open(); await wait(450);
    const b = { foundry: window.WorldFoundry.isOpen(), loom: !!document.querySelector('#dvLoomSheet.open'), open: openN() };
    window.WorldFoundry.close(); await wait(300);
    return { a, b };
  });
  check(width, 'B7 opening the loom evicts the foundry (sheet + ghost + clear scrim)', !evict.skipped && !evict.a.foundry && evict.a.loom && evict.a.open === 1 && evict.a.ghosts === 0 && !evict.a.fdBody, JSON.stringify(evict));
  check(width, 'B7 opening the foundry evicts the loom', !evict.skipped && evict.b.foundry && !evict.b.loom && evict.b.open === 1, JSON.stringify(evict.b || evict));

  // ── A3. errors attributable to this task's files ────────────────────
  const mine = errs.filter(e => OURS.test(e));
  check(width, 'A3 no page/shader errors from touched files', mine.length === 0, mine.length ? mine.slice(0, 4).join(' | ').slice(0, 600) : `clean (${errs.length} unrelated console/page errors on the page)`);
  if (errs.length) errs.slice(0, 5).forEach(e => console.log('    (other) ' + e.slice(0, 200)));
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
