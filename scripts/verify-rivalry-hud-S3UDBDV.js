#!/usr/bin/env node
'use strict';
/* verify-rivalry-hud-S3UDBDV — the tithe sheet, measured at 320/375/768/1280/1920
   with the REAL dirverse-hud.js sheet owner and the REAL rivalry-hud.js. Checks:
   the sheet is inside the viewport, both answers are inside the sheet, the two
   answers never overlap, each is >=44px tall, a long demand never overflows, and
   tapping an answer sends world:rival:answer with the demand id and closes.
   --nowrap control: removes flex-wrap → must go RED at 320. */
const path = require('path');
let puppeteer; try { puppeteer = require('puppeteer'); } catch (_) { puppeteer = require(path.join(process.env.HOME, 'vintinuum-api', 'node_modules', 'puppeteer')); }
const ROOT = path.resolve(__dirname, '..');
const NOWRAP = process.argv.includes('--nowrap');
const LONG = 'LUNEX demands 3 seed stone from you. Pay, or refuse — refusing costs you nothing here, but LUNEX will remember. ' +
  'Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  let pass = 0, fail = 0; const fails = [];
  const ok = (n, c, x) => { if (c) pass++; else { fail++; fails.push(n + (x ? ' — ' + x : '')); } console.log((c ? 'PASS ' : 'FAIL ') + n + (!c && x ? ' — ' + x : '')); };
  for (const [w, h] of [[320, 568], [375, 667], [768, 1024], [1280, 800], [1920, 1080], [393, 420]]) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h });
    await p.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#050812;font-family:sans-serif"></body></html>');
    await p.evaluate(() => { window.__sent = []; window.World = { send: (o) => window.__sent.push(o) }; });
    await p.addScriptTag({ path: path.join(ROOT, 'body/world/dirverse-hud.js') });
    await p.addScriptTag({ path: path.join(ROOT, 'body/world/rivalry-hud.js') });
    if (NOWRAP) await p.addStyleTag({ content: '#rvSheet .rv-row{flex-wrap:nowrap!important}#rvSheet .rv-btn{flex:0 0 180px!important}' });
    await p.evaluate((say) => window.dispatchEvent(new CustomEvent('vint:world-rival', { detail: { t: 'world:rival:demand', id: 77, who: 'LUNEX', item: 'seed_stone', n: 3, ttl: 45, say } })), LONG);
    await new Promise(r => setTimeout(r, 700));
    const m = await p.evaluate(() => {
      const r = el => { const x = el.getBoundingClientRect(); return { l: x.left, t: x.top, r: x.right, b: x.bottom, h: x.height }; };
      const s = document.getElementById('rvSheet'), y = document.getElementById('rvPay'), n = document.getElementById('rvNo'), say = s.querySelector('.rv-say');
      return { open: s.classList.contains('open'), s: r(s), y: r(y), n: r(n), say: r(say), body: r(document.getElementById('rvBody')),
        sayOver: say.scrollWidth > say.clientWidth + 1, vw: innerWidth, vh: innerHeight };
    });
    const L = w + 'x' + h;
    const inside = (a, c) => a.l >= c.l - 0.5 && a.r <= c.r + 0.5 && a.t >= c.t - 0.5 && a.b <= c.b + 0.5;
    const over = (a, c) => Math.max(0, Math.min(a.r, c.r) - Math.max(a.l, c.l)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.t, c.t));
    ok(L + ' sheet opens', m.open);
    ok(L + ' sheet inside viewport', m.s.l >= -0.5 && m.s.r <= m.vw + 0.5 && m.s.b <= m.vh + 0.5 && m.s.t >= -0.5, JSON.stringify(m.s));
    ok(L + ' pay inside sheet', inside(m.y, m.s), JSON.stringify(m.y));
    ok(L + ' refuse inside sheet', inside(m.n, m.s), JSON.stringify(m.n));
    ok(L + ' answers never overlap', over(m.y, m.n) === 0);
    // the demand text scrolls inside .dv-body, so clip its rect to the scroller
    // first — a scrolled-off line is clipped, not painted under the answers.
    const clip = { l: Math.max(m.say.l, m.body.l), t: Math.max(m.say.t, m.body.t), r: Math.min(m.say.r, m.body.r), b: Math.min(m.say.b, m.body.b) };
    ok(L + ' text never overlaps answers', over(clip, m.y) === 0 && over(clip, m.n) === 0);
    ok(L + ' scroller never overlaps answers', over(m.body, m.y) === 0 && over(m.body, m.n) === 0);
    ok(L + ' answers >=44px', m.y.h >= 44 && m.n.h >= 44);
    ok(L + ' demand text does not overflow', !m.sayOver);
    await p.click('#rvNo');
    const after = await p.evaluate(() => ({ sent: window.__sent, open: document.getElementById('rvSheet').classList.contains('open') }));
    ok(L + ' refuse sends the answer and closes', !after.open && after.sent.some(o => o.t === 'world:rival:answer' && o.demandId === 77 && o.pay === false), JSON.stringify(after));
    await p.close();
  }
  await b.close();
  console.log(`\n${pass}/${pass + fail} pass` + (NOWRAP ? ' (control --nowrap)' : ''));
  if (fail) console.log('FAILURES:\n  ' + fails.join('\n  '));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(3); });
