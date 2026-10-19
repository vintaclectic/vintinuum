#!/usr/bin/env node
/* verify-world-underweb-Y8Z7BAA.js — proof for task Y8Z7BAA (the underweb)
   ────────────────────────────────────────────────────────────────────────────
   Loads world.html (served from THIS worktree) as a GUEST in headless Chromium
   at each width, records EVERY network request the page makes, and asserts:

   A. LAUNCH  A1 the ◈ underweb launcher is on the rail; a real click at its
              hit-tested centre opens #uwSheet.  A2 Escape closes it.
              A3 one-sheet law: the foundry evicts it and it evicts the foundry.
   B. BROWSE  B1 net://index lists the council sites.  B2 typing "aria" + Enter
              renders Aria's page.  B3 search finds atlas by a word only his
              page carries.  B4 publishing a homepage persists and renders it.
   C. MAIL    C1 aria@council.net answers in her voice within 12s.  C2 an
              unknown .net host bounces from postmaster.  C3 a real-world
              address is refused before anything is stored as delivered.
   E. EGRESS  E1 every real-world address form (https, //, javascript:, data:,
              www., dotted host, mailto:) is refused by route() and the typed
              https address renders the world's-edge page.  E2 a hostile
              homepage (<img src=//evil>, <iframe>, https link) renders as
              TEXT: zero img/iframe/a/script/object elements in the sheet.
              E3 ZERO requests to the hostile host, and ZERO requests at all
              whose initiator stack is underweb.js.
   G. NO-COLLISION (measured): resting launcher collides with nothing and
              hit-tests to itself; open sheet (browse, edit and compose views)
              collides with nothing above the scrim, every control reachable
              (hand-scrolled, clip-aware hit-test), no two controls overlap,
              every control ≥44px (inline net:// text links excepted — they are
              words in a sentence, each also offered as a full-width button).

   CONTROL  UW_CONTROL=innerhtml serves underweb.js with ONE change — the two
            plain-text writes in richText() use insertAdjacentHTML instead of
            createTextNode — and must go RED on E2/E3.
   USAGE    node scripts/verify-world-underweb-Y8Z7BAA.js
            VERIFY_WIDTHS=375 UW_CONTROL=innerhtml node scripts/verify-world-underweb-Y8Z7BAA.js
   EXITS    0 all pass · 1 a check failed · 2 harness could not run
*/
'use strict';
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920').split(',').map(s => parseInt(s, 10)).filter(Boolean);
const HEIGHT = { 320: 640, 375: 812, 768: 1024, 1280: 800, 1920: 1080 };
const CONTROL = process.env.UW_CONTROL || '';
const EVIL = 'evil-uw.test';

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


let UW_SRC = fs.readFileSync(path.join(ROOT, 'body/world/underweb.js'), 'utf8');
if (CONTROL === 'innerhtml') {
  const needle = 'node.appendChild(document.createTextNode(s.slice(i, m.index)));';
  if (!UW_SRC.includes(needle)) { console.log('HARNESS: control needle not found'); process.exit(2); }
  const tail = 'if (i < s.length) node.appendChild(document.createTextNode(s.slice(i)));';
  if (!UW_SRC.includes(tail)) { console.log('HARNESS: control tail needle not found'); process.exit(2); }
  // both text-run writes in richText() — the run before a token and the run after the last one
  UW_SRC = UW_SRC.replace(needle, "node.insertAdjacentHTML('beforeend', s.slice(i, m.index));")
                 .replace(tail, "if (i < s.length) node.insertAdjacentHTML('beforeend', s.slice(i));");
  console.log('CONTROL innerhtml: plain text runs now parsed as HTML');
}

async function geoOpen(page, label) {
  await settle(page, '#uwSheet');
  if (await page.$('#vwg-pill')) await settle(page, '#vwg-pill');   // VintDock re-lifts it after a view swap
  return page.evaluate((label) => {
    const g = window.__geo, sheet = document.getElementById('uwSheet');
    const sr = sheet.getBoundingClientRect(), above = [];
    g.fixedEls().forEach(el => {
      if (el === sheet || sheet.contains(el) || el.contains(sheet) || el.id === 'dvScrim' || el.id === 'stage') return;
      if (g.z(el) < 1560) return;
      const i = g.inter(sr, el.getBoundingClientRect()); if (i) above.push(g.name(el) + ' ' + i.w + 'x' + i.h);
    });
    document.querySelectorAll('#dvRail .dv-launch').forEach(el => { if (!g.vis(el)) return; const i = g.inter(sr, el.getBoundingClientRect()); if (i) above.push(g.name(el) + ' ' + i.w + 'x' + i.h); });
    const off = (sr.left < -0.5 || sr.right > innerWidth + 0.5 || sr.bottom > innerHeight + 0.5) ? `sheet off-viewport ${JSON.stringify(sr)}` : '';
    const ctrls = Array.from(sheet.querySelectorAll('button,input,textarea')).filter(c => g.vis(c));
    const unreach = [];
    ctrls.forEach(c => { const r = g.reach(c); if (!r.ok) unreach.push(g.name(c) + '"' + (c.textContent || c.placeholder || '').slice(0, 18) + '"→' + r.why); });
    document.getElementById('uwBody').scrollTop = 0;
    const rects = ctrls.filter(c => !c.classList.contains('uw-il')).map(c => ({ n: g.name(c) + '"' + (c.textContent || c.placeholder || '').slice(0, 14) + '"', r: c.getBoundingClientRect() }));
    const pairs = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const x = g.inter(rects[i].r, rects[j].r); if (x) pairs.push(rects[i].n + '×' + rects[j].n + ' ' + x.w + 'x' + x.h); }
    const small = rects.filter(o => o.r.width < 43.5 || o.r.height < 43.5).map(o => o.n + ' ' + o.r.width.toFixed(0) + 'x' + o.r.height.toFixed(0));
    // horizontal overflow inside the sheet: real geometry, not scrollWidth (lesson 2BXVQEN)
    const wide = Array.from(sheet.querySelectorAll('*')).filter(e => g.vis(e)).map(e => e.getBoundingClientRect()).filter(r => r.right > sr.right + 0.5 || r.left < sr.left - 0.5).length;
    return { label, above, off, unreach, pairs, small, wide, n: ctrls.length };
  }, label);
}
function reportOpen(width, o) {
  check(width, `G2 [${o.label}] sheet collides with nothing above the scrim`, o.above.length === 0 && !o.off, o.above.join('; ') || o.off || 'clean');
  check(width, `G2 [${o.label}] all ${o.n} controls reachable`, o.unreach.length === 0, o.unreach.join('; ') || 'all hit');
  check(width, `G3 [${o.label}] no two controls overlap`, o.pairs.length === 0, o.pairs.join('; ') || 'clean');
  check(width, `G3 [${o.label}] every control ≥44px`, o.small.length === 0, o.small.join('; ') || 'all ≥44');
  check(width, `G3 [${o.label}] nothing overhangs the sheet horizontally`, o.wide === 0, o.wide + ' overhanging');
}

async function runWidth(browser, base, width) {
  const height = HEIGHT[width] || 900;
  const page = await browser.newPage();
  const mobile = width < 720;
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const errs = [], reqs = [];
  await page.setRequestInterception(true);
  page.on('request', req => {
    const ini = req.initiator && req.initiator();
    const stack = ini && ini.stack ? JSON.stringify(ini.stack).slice(0, 4000) : '';
    reqs.push({ url: req.url(), byUs: /underweb\.js/.test(stack) || /underweb\.js/.test((ini && ini.url) || '') });
    if (req.url().endsWith('/body/world/underweb.js')) return req.respond({ status: 200, contentType: 'application/javascript', body: UW_SRC });
    if (req.url().includes(EVIL)) return req.abort();
    req.continue();
  });
  page.on('pageerror', e => errs.push('pageerror: ' + (e && (e.stack || e.message) || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text() + ' @' + ((m.location() || {}).url || '')); });
  await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (_) {} window.__uw = []; addEventListener('vint:underweb', e => window.__uw.push(e.detail)); });
  await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(GEOM);
  const ready = await until(page, () => window.WorldNet && document.getElementById('uwBtn') && window.WorldFoundry && window.VintinuumWorld && window.VintinuumWorld._scene, 30000);
  if (!ready) { console.log(`  HARNESS ${width}: world never readied`); errs.slice(0, 6).forEach(e => console.log('    ' + e.slice(0, 200))); await page.close(); return 'unready'; }

  // ── G1 resting launcher ──
  await until(page, () => { const g = window.__geo, v = document.getElementById('veil'), t = document.getElementById('dvToast'); return !(v && g.vis(v)) && !(t && g.vis(t)); }, 20000);
  await settle(page, '#uwBtn');
  const rest = await page.evaluate(() => {
    const g = window.__geo, btn = document.getElementById('uwBtn'), reach = g.reach(btn), br = btn.getBoundingClientRect(), hits = [];
    new Set(g.fixedEls().concat(Array.from(document.querySelectorAll('.dv-launch')))).forEach(el => {
      if (el === btn || el.contains(btn) || btn.contains(el) || el.id === 'stage' || el.id === 'dvScrim' || !g.vis(el)) return;
      const i = g.inter(br, el.getBoundingClientRect()); if (i) hits.push(g.name(el) + ' ' + i.w + 'x' + i.h);
    });
    return { reach, hits };
  });
  check(width, 'G1 launcher collides with nothing', rest.hits.length === 0, rest.hits.join('; ') || 'clean');
  check(width, 'G1 launcher hit-test reaches it', rest.reach.ok, rest.reach.why);

  // ── A1 open by a real click ──
  if (rest.reach.ok) { const r = rest.reach.rect; await page.mouse.click((r.left + r.right) / 2, (r.top + r.bottom) / 2); }
  else await page.evaluate(() => window.WorldNet.open());
  const opened = await until(page, () => window.WorldNet.isOpen(), 5000);
  await settle(page, '#uwSheet'); if (await page.$('#vwg-pill')) await settle(page, '#vwg-pill');
  check(width, 'A1 launcher click opens the underweb terminal', opened);

  // ── B1 index ──
  const idx = await page.evaluate(() => ({ addr: document.getElementById('uwAddr').value, links: Array.from(document.querySelectorAll('#uwPage .uw-ln')).map(b => b.textContent) }));
  check(width, 'B1 net://index lists the council sites', idx.addr === 'net://index' && ['Aria', 'Atlas', 'Lunex', 'Yuna', 'Vintinuum'].every(n => idx.links.some(l => l.includes(n))), idx.links.length + ' links');
  reportOpen(width, await geoOpen(page, 'browse'));

  // ── B2 type an address ──
  await page.click('#uwAddr', { clickCount: 3 }); await page.keyboard.type('aria'); await page.keyboard.press('Enter');
  const aria = await page.evaluate(() => ({ t: document.querySelector('#uwPage .uw-h1').textContent, addr: document.getElementById('uwAddr').value }));
  check(width, 'B2 typing "aria" + Enter renders her site', /Aria/.test(aria.t) && aria.addr === 'net://aria', JSON.stringify(aria));

  // ── E1 real-world addresses refused ──
  await page.click('#uwAddr', { clickCount: 3 }); await page.keyboard.type(`https://${EVIL}/landing`); await page.keyboard.press('Enter');
  const edge = await page.evaluate(() => ({ t: document.querySelector('#uwPage .uw-h1').textContent, edge: !!document.querySelector('#uwPage.uw-edge'), cur: window.WorldNet.current() }));
  check(width, 'E1 typed https:// address renders the world\'s edge', edge.edge && edge.cur.ok === false, JSON.stringify(edge));
  const forms = await page.evaluate((EVIL) => [`https://${EVIL}`, `http://${EVIL}/x`, `//${EVIL}/x`, 'javascript:alert(1)', 'data:text/html,hi', `www.${EVIL}`, EVIL, `mailto:a@${EVIL}`, `net://${EVIL}`, `net://aria//${EVIL}`, 'ftp://x', `HTTPS://${EVIL}`].map(a => ({ a, ok: window.WorldNet.route(a).ok })), EVIL);
  const leaked = forms.filter(f => f.ok);
  check(width, `E1 all ${forms.length} real-world address forms refused by route()`, leaked.length === 0, leaked.map(f => f.a).join(', ') || 'all refused');

  // ── B3 search ──
  await page.evaluate(() => window.WorldNet.go('net://search?q=lattice'));
  const srch = await page.evaluate(() => Array.from(document.querySelectorAll('#uwPage .uw-ln')).map(b => b.textContent));
  check(width, 'B3 search "lattice" finds Atlas', srch.some(s => /Atlas/.test(s)), srch.join(' | '));

  // ── B4 + E2 publish a hostile homepage through the editor ──
  await page.evaluate(() => window.WorldNet.go('net://you/edit'));
  reportOpen(width, await geoOpen(page, 'edit'));
  const hostile = `hello from my room. see net://atlas and https://${EVIL}/p\n\n<img src="//${EVIL}/pix.png"><iframe src="//${EVIL}/f"></iframe><a href="//${EVIL}/a">x</a><script>window.__pwned=1</script>`;
  await page.type('#uwSiteT', 'my room');
  await page.evaluate((v) => { document.getElementById('uwSiteB').value = v; }, hostile);
  await page.click('#uwPub');
  await new Promise(r => setTimeout(r, 600));
  const site = await page.evaluate((EVIL) => {
    const s = document.getElementById('uwSheet');
    return { t: document.querySelector('#uwPage .uw-h1').textContent, stored: (window.WorldNet.state().site || {}).title,
      bad: s.querySelectorAll('img,iframe,a,script,object,embed,video,audio,link,source').length,
      inert: Array.from(s.querySelectorAll('.uw-out')).map(e => e.textContent), il: Array.from(s.querySelectorAll('.uw-il')).map(e => e.textContent),
      textHasTag: s.textContent.includes('<img src="//' + EVIL), pwned: !!window.__pwned };
  }, EVIL);
  check(width, 'B4 published homepage persists and renders at net://you', site.t === 'my room' && site.stored === 'my room', JSON.stringify({ t: site.t, stored: site.stored }));
  check(width, 'E2 hostile markup renders as text: zero img/iframe/a/script elements', site.bad === 0 && site.textHasTag && !site.pwned, JSON.stringify({ bad: site.bad, textHasTag: site.textHasTag, pwned: site.pwned }));
  check(width, 'E2 real URL inert, net:// link live', site.inert.some(t => t.includes(EVIL) && t.includes('outside')) && site.il.includes('net://atlas'), JSON.stringify({ inert: site.inert, il: site.il }));

  // ── C mail ──
  await page.evaluate(() => window.WorldNet.compose('aria@council.net', 'hello'));
  reportOpen(width, await geoOpen(page, 'compose'));
  await page.type('#uwText', 'I raised my first wall today');
  await page.click('#uwSend');
  const sent = await page.evaluate(() => window.WorldNet.state().sent.length);
  const replied = await until(page, () => window.WorldNet.state().inbox.some(m => m.from === 'aria@council.net' && /^re: hello/.test(m.subj)), 12000);
  const reply = await page.evaluate(() => (window.WorldNet.state().inbox.filter(m => m.from === 'aria@council.net' && /^re:/.test(m.subj))[0] || {}).body);
  check(width, 'C1 aria@council.net writes back in her voice', sent === 1 && replied && /raised my first wall/.test(reply || ''), JSON.stringify(reply));
  const bounce = await page.evaluate(() => { const r = window.WorldNet.send('nobody@nowhere.net', 'hi', 'x'); return r.ok; });
  const bounced = await until(page, () => window.WorldNet.state().inbox.some(m => m.from === 'postmaster@here.net'), 5000);
  check(width, 'C2 unknown .net host bounces from postmaster', bounce && bounced);
  const out = await page.evaluate((EVIL) => { const n = window.WorldNet.state().sent.length; const r = [`a@${EVIL}`, `aria@council.net.${EVIL}`, 'a@gmail.com', `aria@council.net, b@${EVIL}`].map(t => window.WorldNet.send(t, 's', 'b')); return { oks: r.filter(x => x.ok).length, grew: window.WorldNet.state().sent.length - n, why: r[0].why }; }, EVIL);
  check(width, 'C3 real-world mail addresses refused, nothing stored as sent', out.oks === 0 && out.grew === 0, JSON.stringify(out));
  // read a letter through the UI (open the reply)
  await page.click('#uwMinbox');
  const read = await page.evaluate(() => { const it = document.querySelector('#uwSheet .uw-mail'); if (!it) return null; it.click(); return !!document.getElementById('uwLetter'); });
  check(width, 'C1 a letter opens from the inbox list', read === true);
  reportOpen(width, await geoOpen(page, 'letter'));

  // ── A2 / A3 ──
  await page.keyboard.press('Escape');
  check(width, 'A2 Escape closes the terminal', await until(page, () => !window.WorldNet.isOpen(), 3000));
  const ev = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.WorldNet.open(); await wait(400); window.WorldFoundry.open(); await wait(400);
    const a = { uw: window.WorldNet.isOpen(), fd: window.WorldFoundry.isOpen(), n: document.querySelectorAll('.dv-sheet.open').length };
    window.WorldNet.open(); await wait(400);
    const b = { uw: window.WorldNet.isOpen(), fd: window.WorldFoundry.isOpen(), n: document.querySelectorAll('.dv-sheet.open').length };
    window.WorldNet.close(); await wait(300); return { a, b };
  });
  check(width, 'A3 one-sheet law both directions', !ev.a.uw && ev.a.fd && ev.a.n === 1 && ev.b.uw && !ev.b.fd && ev.b.n === 1, JSON.stringify(ev));

  // ── E3 network ──
  await new Promise(r => setTimeout(r, 500));
  const evilReqs = reqs.filter(r => r.url.includes(EVIL)).map(r => r.url);
  const ours = reqs.filter(r => r.byUs).map(r => r.url);
  check(width, `E3 zero requests to ${EVIL}`, evilReqs.length === 0, evilReqs.join(', ') || `clean (${reqs.length} total page requests)`);
  check(width, 'E3 zero requests initiated by underweb.js', ours.length === 0, ours.slice(0, 4).join(', ') || 'none');
  const evs = await page.evaluate(() => window.__uw.map(e => e.kind));
  check(width, 'B vint:underweb events fired for visit/refuse/publish/mail/post', ['visit', 'refuse', 'publish', 'mail', 'post'].every(k => evs.includes(k)), [...new Set(evs)].join(','));
  const mine = errs.filter(e => /underweb/i.test(e));
  check(width, 'no page errors from underweb.js', mine.length === 0, mine.slice(0, 3).join(' | ').slice(0, 400) || `clean (${errs.length} unrelated)`);
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
  try { for (const w of WIDTHS) { console.log(`── ${w}px ──`); if ((await runWidth(browser, base, w)) === 'unready') unready++; } }
  finally { await browser.close(); kill(); }
  console.log(`\n${pass}/${pass + fail} pass` + (fail ? `\nFAILURES:\n  ${fails.join('\n  ')}` : '') + (unready ? `\n${unready} width(s) never readied` : ''));
  process.exit(unready && !fail ? 2 : (fail ? 1 : 0));
})().catch(e => { console.error('HARNESS crash:', e); process.exit(2); });
