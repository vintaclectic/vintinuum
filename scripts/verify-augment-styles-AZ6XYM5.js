#!/usr/bin/env node
/*
 * verify-augment-styles-AZ6XYM5.js: proves the flesh/machine style-pack system.
 *
 *   A. (node, no browser) body/world/augment-styles.js validation: every field of
 *      an untrusted pack is clamped or refused, built-ins cannot be clobbered,
 *      import / export / share-link round-trip, and wearing state persists.
 *   B. (real world.html in headless chromium, swiftshader WebGL) the guest's own
 *      body wears the house style, the augment shader compiles with no GL error,
 *      the Being Forge's STYLE tab dresses you in a feminine pack, and the pane
 *      is collision-free at 320/375/768/1280/1920.
 *
 * Usage: node scripts/verify-augment-styles-AZ6XYM5.js [--shots DIR]
 *        --control-old-tabs  reverts the tab nowrap/ellipsis CSS to show the
 *                            320px tab check can go red.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
const CONTROL = process.argv.includes('--control-old-tabs');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, info) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; fails.push(name + (info ? ' — ' + info : '')); console.log('  FAIL ' + name + (info ? ' — ' + info : '')); }
}

// ── A. pure validation, in a sandbox ─────────────────────────────────────────
function sandbox(hash) {
  const store = {};
  const ctx = {
    console, JSON, Math, Number, String, Array, Object, isFinite, Error, RegExp,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    escape, unescape, encodeURIComponent, decodeURIComponent,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    location: { origin: 'https://vintinuum.com', pathname: '/world.html', search: '', hash: hash || '' },
    history: { replaceState() {} },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    events: [],
  };
  ctx.dispatchEvent = (e) => ctx.events.push(e);
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'body/world/augment-styles.js'), 'utf8'), ctx);
  return ctx;
}

console.log('A. augment-styles.js validation');
{
  const c = sandbox();
  const WS = c.WorldStyles;
  ok('A1 exposes WorldStyles', !!WS);
  ok('A2 six built-ins, four feminine', WS.list().length === 6 && WS.list().filter(p => p.body === 'femme').length === 4);
  ok('A3 default self = house style', WS.selfId() === 'sovereign-circuit');
  const throws = (f) => { try { f(); return false; } catch (_) { return true; } };
  ok('A4 refuses a non-object', throws(() => WS.register('x')) && throws(() => WS.register([1])));
  ok('A5 refuses a nameless pack', throws(() => WS.register({ skin: '#ffffff' })));
  ok('A6 refuses the reserved id classic', throws(() => WS.register({ name: 'Classic' })));
  const p = WS.register({ name: '<img src=x onerror=alert(1)>Evil', coverage: 9, glow: -4, skin: 'red; }', pattern: 'eval', body: 'robot',
    build: { height: 50, bust: 'NaN' }, extra: 'function(){}' });
  ok('A7 strips angle brackets from the name', p.name.indexOf('<') < 0 && p.name.indexOf('>') < 0, p.name);
  ok('A8 clamps coverage/glow into range', p.coverage === 1 && p.glow === 0);
  ok('A9 bad colour falls back to a hex default', /^#[0-9a-f]{6}$/.test(p.skin));
  ok('A10 unknown pattern/body fall back', p.pattern === 'circuit' && p.body === 'any');
  ok('A11 build clamped (height ≤1.1, NaN→0)', p.build.height === 1.1 && p.build.bust === 0);
  ok('A12 unknown keys dropped', !('extra' in p));
  const clash = WS.register({ id: 'nocturne-chrome', name: 'Nocturne Chrome' });
  ok('A13 a colliding id cannot clobber a built-in', clash.id !== 'nocturne-chrome' && WS.get('nocturne-chrome').builtin === true, clash.id);
  const got = WS.importText(JSON.stringify({ packs: [{ name: 'Alpha' }, { bogus: true }, { name: 'Beta', body: 'femme' }] }));
  ok('A14 import keeps the good packs, skips the bad', got.length === 2 && !!WS.get('beta'));
  ok('A15 import of garbage throws', throws(() => WS.importText('not json')));
  const exp = JSON.parse(WS.exportText('tidal-ceramic'));
  ok('A16 export round-trips and omits builtin flag', exp.id === 'tidal-ceramic' && !('builtin' in exp));
  const url = WS.shareUrl('ember-filigree');
  const decoded = JSON.parse(WS._decodeShare(url.split('#style=')[1]));
  ok('A17 share link encodes the pack', /^https:\/\/vintinuum\.com\/world\.html#style=[A-Za-z0-9_-]+$/.test(url) && decoded.id === 'ember-filigree');
  WS.setSelf('beta'); WS.setAgent('aria', 'neon-saint');
  ok('A18 wearing persists (self + agent)', WS.selfId() === 'beta' && WS.agentId('aria') === 'neon-saint');
  WS.remove('beta');
  ok('A19 removing the worn pack returns self to the house', WS.selfId() === 'sovereign-circuit' && !WS.get('beta'));
  ok('A20 built-ins cannot be removed', WS.remove('neon-saint') === false && !!WS.get('neon-saint'));
  ok('A21 setAgent(null) undresses an agent', WS.setAgent('aria', null) === null && WS.agentId('aria') === null);
  // a share link opened in a fresh browser lands the look and wears it
  const enc = url.split('#style=')[1];
  const c2 = sandbox('#style=' + enc);
  ok('A22 opening a share link imports + wears it', c2.WorldStyles.selfId().indexOf('ember-filigree') === 0 && !!c2.WorldStyles.lastShared);
}

// ── B. the real world ────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/world.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(fp, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('nf'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}
function overlap(a, b) {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0.5 && y > 0.5;
}

(async () => {
  let puppeteer;
  try { puppeteer = require(path.join(process.env.HOME, 'vintinuum-api', 'node_modules', 'puppeteer')); }
  catch (_) { puppeteer = require('puppeteer'); }
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/world.html`;
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  console.log('B. world.html');
  const BPS = [{ w: 320, h: 568 }, { w: 375, h: 667 }, { w: 768, h: 1024 }, { w: 1280, h: 800 }, { w: 1920, h: 1080 }];
  try {
    for (let bi = 0; bi < BPS.length; bi++) {
      const bp = BPS[bi];
      const page = await browser.newPage();
      const glErrors = [];
      page.on('console', m => { const t = m.text(); if (/Shader Error|WebGLProgram|ERROR: 0:/i.test(t)) glErrors.push(t.slice(0, 300)); });
      page.on('pageerror', () => {});
      await page.setViewport({ width: bp.w, height: bp.h, deviceScaleFactor: 1, isMobile: bp.w <= 859, hasTouch: bp.w <= 859 });
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (_) {} });
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const tag = '@' + bp.w;
      let rigOk = true;
      try {
        await page.waitForFunction('window.VintinuumWorld && VintinuumWorld._selfRig && VintinuumWorld._selfRig.styleId && VintinuumWorld._selfRig.styleId()', { timeout: 40000 });
      } catch (_) { rigOk = false; }
      if (bi === 0 || bi === 3) {
        const sid = await page.evaluate(() => window.VintinuumWorld && VintinuumWorld._selfRig && VintinuumWorld._selfRig.styleId && VintinuumWorld._selfRig.styleId());
        ok('B1' + tag + ' your body wears the house style', rigOk && sid === 'sovereign-circuit', String(sid));
        const matInfo = await page.evaluate(() => {
          const r = VintinuumWorld._selfRig; const out = [];
          r.root.traverse(o => { if (o.isSkinnedMesh) out.push(o.material && o.material.userData && o.material.userData.augment); });
          return out;
        });
        ok('B2' + tag + ' both skinned meshes carry augment material', matInfo.length >= 2 && matInfo.every(x => x === 'sovereign-circuit'), JSON.stringify(matInfo));
        await new Promise(r => setTimeout(r, 1200));
        const prog = await page.evaluate(() => {
          // walk renderer programs if exposed; fall back to "no GL error logged"
          const R = window.VintinuumWorld && (VintinuumWorld._renderer || VintinuumWorld.renderer);
          if (!R || !R.info || !R.info.programs) return null;
          return R.info.programs.filter(p => /augment-v1/.test(p.cacheKey || '')).length;
        });
        ok('B3' + tag + ' augment shader compiled with no GL error', glErrors.length === 0 && (prog === null || prog > 0), glErrors[0] || ('programs=' + prog));
      }
      // open the forge → STYLE tab
      const opened = await page.evaluate(() => { try { return !!VintinuumWorld.editHead(); } catch (e) { return false; } });
      ok('B4' + tag + ' the Being Forge opens', opened);
      if (CONTROL) await page.addStyleTag({ content: '#vintHeadEd .he-tab{white-space:normal!important;overflow:visible!important;letter-spacing:3px!important;font-size:14px!important;}' });
      await page.evaluate(() => { const b = [...document.querySelectorAll('#vintHeadEd .he-tab')].find(x => x.dataset.pane === 'style'); b && b.click(); });
      await new Promise(r => setTimeout(r, 200));
      const lay = await page.evaluate(() => {
        const ed = document.getElementById('vintHeadEd');
        const R = e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height }; };
        // measure the label's real ink width with a Range: an ellipsis-truncated
        // label does NOT always report scrollWidth > clientWidth (measured: "COLO…"
        // at 320px passed that test), so compare text width to the content box.
        const tabs = [...ed.querySelectorAll('.he-tab')].map(t => {
          const cs = getComputedStyle(t); const rg = document.createRange(); rg.selectNodeContents(t);
          const inner = t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          return { txt: t.textContent, tw: rg.getBoundingClientRect().width, inner, clip: rg.getBoundingClientRect().width > inner + 0.5, h: t.scrollHeight > t.clientHeight + 1, r: R(t) };
        });
        const pane = ed.querySelector('.he-pane.on');
        const paneR = R(pane);
        const cards = [...pane.querySelectorAll('.st-card')].map(R);
        const blocks = [...pane.children].filter(c => getComputedStyle(c).display !== 'none').map(R);
        const wide = [...pane.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > paneR.right + 1 || r.left < paneR.left - 1); }).map(e => e.className || e.tagName);
        const body = ed.querySelector('.he-body');
        return { ed: R(ed), vw: innerWidth, vh: innerHeight, tabs, cards, blocks, wide, hOverflow: body.scrollWidth > body.clientWidth + 1, nCards: cards.length };
      });
      const floats = await page.evaluate(() => {
        const ids = ['editHeadBtn', 'leave'];
        const out = [];
        const ed = document.getElementById('vintHeadEd').getBoundingClientRect();
        const els = ids.map(i => document.getElementById(i)).concat([...document.querySelectorAll('[class*="vwg"],#vwg-pill')]);
        els.forEach(e => { if (!e) return; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          if (r.width && r.height && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05) out.push({ id: e.id || e.className, r: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }); });
        return { ed: { left: ed.left, right: ed.right, top: ed.top, bottom: ed.bottom }, out };
      });
      const fh = [];
      floats.out.forEach((a, i) => { if (overlap(a.r, floats.ed)) fh.push(a.id + '×forge');
        floats.out.forEach((b, j) => { if (i < j && overlap(a.r, b.r)) fh.push(a.id + '×' + b.id); }); });
      ok('B13' + tag + ' docked floats clear the forge and each other (STYLE pane open)', fh.length === 0, fh.join(', '));
      ok('B5' + tag + ' forge panel inside the viewport', lay.ed.left >= 0 && lay.ed.right <= lay.vw && lay.ed.top >= 0 && lay.ed.bottom <= lay.vh, JSON.stringify(lay.ed));
      ok('B6' + tag + ' four tabs, none clipped or wrapped', lay.tabs.length === 4 && lay.tabs.every(t => !t.clip && !t.h), JSON.stringify(lay.tabs.filter(t => t.clip || t.h).map(t => t.txt + ' ' + t.tw.toFixed(1) + '>' + t.inner.toFixed(1))));
      ok('B7' + tag + ' tabs do not overlap each other', lay.tabs.every((a, i) => lay.tabs.every((b, j) => i >= j || !overlap(a.r, b.r))));
      ok('B8' + tag + ' wardrobe shows classic + 6 looks', lay.nCards === 7, 'cards=' + lay.nCards);
      let cardHit = 0; lay.cards.forEach((a, i) => lay.cards.forEach((b, j) => { if (i < j && overlap(a, b)) cardHit++; }));
      ok('B9' + tag + ' no two style cards overlap', cardHit === 0, 'pairs=' + cardHit);
      let blockHit = 0; lay.blocks.forEach((a, i) => lay.blocks.forEach((b, j) => { if (i < j && a.h > 0 && b.h > 0 && overlap(a, b)) blockHit++; }));
      ok('B10' + tag + ' pane blocks stack without overlap', blockHit === 0, 'pairs=' + blockHit);
      ok('B11' + tag + ' nothing in the pane spills sideways', lay.wide.length === 0 && !lay.hOverflow, lay.wide.slice(0, 4).join(','));
      // dress yourself in a feminine look
      const worn = await page.evaluate(async () => {
        const c = document.querySelector('#vintHeadEd .st-card[data-style="nocturne-chrome"]');
        if (!c) return 'no-card';
        c.click();
        await new Promise(r => setTimeout(r, 100));
        const on = c.classList.contains('on') || (document.querySelector('#vintHeadEd .st-card[data-style="nocturne-chrome"]') || {}).classList.contains('on');
        return { rig: VintinuumWorld._selfRig && VintinuumWorld._selfRig.styleId(), saved: localStorage.getItem('vint:styles:self'), on };
      });
      ok('B12' + tag + ' tapping Nocturne Chrome dresses your body + persists', worn && worn.rig === 'nocturne-chrome' && /nocturne-chrome/.test(worn.saved || '') && worn.on, JSON.stringify(worn));
      if (SHOTS && (bi === 0 || bi === 3)) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `forge-style-${bp.w}.png`) });
        await page.evaluate(() => { try { HeadEditor.close(); } catch (_) {} });
        await new Promise(r => setTimeout(r, 600));
        await page.screenshot({ path: path.join(SHOTS, `body-femme-${bp.w}.png`) });
      }
      await page.close();
    }
  } finally {
    await browser.close(); srv.close();
  }
  console.log(`\n${pass}/${pass + fail} pass`);
  if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
