#!/usr/bin/env node
/* verify-court-collision.js — THE COURT SHEET, PROVEN (task NYQAJY5).
   ────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS, AND WHY THE OTHER TWO VERIFIERS DO NOT COVER IT.

   scripts/verify-no-collision.js measures every position:fixed element on the
   page. scripts/verify-vigil-collision.js measures #vintWorldHud and its
   neighbours. NEITHER of them ever opens the Court sheet — so every element
   INSIDE #ctSheet (the roster rows, the action rows, the add form, the key box)
   has always been unmeasured, and the sheet is exactly where this endeavour
   added the most new markup: a third line inside .ct-id (the lane badge) and a
   SECOND .ct-actions row (the key controls).

   Those two additions are precisely the shape that breaks at 320px: a row whose
   identity block now carries four stacked lines beside a wallet cell, and a
   pair of button rows that must both fit a 40px floor. Shipping them on the
   strength of "the page-level sweep was green" would be exactly the
   assume-don't-test failure the No-Collision Law names. So this harness opens
   the sheet, fills it with a deliberately hostile roster, and measures.

   THE HOSTILE ROSTER — every field at its most space-consuming legal value:
   a 60-character name (the server's maxlength), the longest provider label,
   a key hint present (the longest lane string), the longest watch label, a
   four-digit wallet, and a mix of active/paused so both action layouts render.

   WHAT IT ASSERTS
     1. No two elements inside the open sheet overlap (the law, measured).
     2. Nothing inside the sheet overflows the sheet's own box horizontally —
        the row must clip its text, never widen past the pane.
     3. The sheet itself stays within the viewport.
     4. Every interactive control keeps a >=38px touch target (the sheet's own
        floor; .ct-mini authors 40, .ct-input 48).
     5. The roster ACTUALLY RENDERED — guards against a smug pass on an empty
        pane, the way the vigil harness guards with its state-word test.

   Contract-detected, not markup-matched, wherever possible: a future redesign
   of the Court should only fail this file if it genuinely collides.

   USAGE
     node scripts/verify-court-collision.js
     VERIFY_WIDTHS=320,375 node scripts/verify-court-collision.js

   Exits non-zero on any violation, so it can gate the commit.
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);
const HEIGHTS = { 320: 568, 375: 667, 768: 1024, 1280: 800, 1920: 1080 };

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ── THE HOSTILE ROSTER ──────────────────────────────────────────────────────
// Shaped exactly like GET /api/agents/mine. Names are at the 60-char server
// maxlength; providers are chosen for the LONGEST rendered label; credential
// hints are present on some rows (the lane badge's widest string) and absent on
// others (so both lane treatments and both key-button layouts are measured).
const NOW = Math.floor(Date.now() / 1000);
const ROSTER = [
  { id: 'uagent:1', name: 'Aetherhold the Long-Watching Keeper of the Clearing', source: 'api',
    provider_model: 'deepseek:deepseek-reasoner', color: '#6f8dff', form: 'presence-child-refractive',
    status: 'active', visibility: 'world', lumen: 9999, tended_at: NOW - 60,
    credential_hint: 'sk-…4f2a', endpoint_url: null },
  { id: 'uagent:2', name: 'A'.repeat(60), source: 'api',
    provider_model: 'minimax:abab6.5s-chat', color: '#d7a0ff', form: 'presence-sovereign',
    status: 'active', visibility: 'public', lumen: 1234, tended_at: NOW - 86400 * 6,
    credential_hint: 'ey…9911', endpoint_url: 'https://api.minimax.chat/v1' },
  { id: 'uagent:3', name: 'Vesper of the Nine Winters', source: 'openai',
    provider_model: 'gpt:gpt-4o', color: '#66d3ac', form: 'presence-warm',
    status: 'active', visibility: 'world', lumen: 42, tended_at: NOW - 86400 * 20,
    credential_hint: null, endpoint_url: null },
  { id: 'uagent:4', name: 'Corvid', source: 'prompt',
    provider_model: '', color: '#ffd89a', form: 'presence-structural',
    status: 'paused', visibility: 'private', lumen: 0, tended_at: null,
    credential_hint: null, endpoint_url: null },
  { id: 'uagent:5', name: 'Marrow', source: 'claude',
    provider_model: 'claude:claude-sonnet-4-5', color: '#e5885f', form: 'presence-child-electric',
    status: 'active', visibility: 'world', lumen: 777, tended_at: NOW - 86400 * 12,
    credential_hint: 'sk-…0001', endpoint_url: null },
];

// Measure everything inside the open sheet. Unlike the page-level sweep this
// walks the sheet's own subtree and uses ALL boxes (not just position:fixed),
// because inside a sheet the collisions come from flow content that grew.
function auditSheet() {
  const sheet = document.getElementById('ctSheet');
  if (!sheet) return { fatal: 'no #ctSheet' };
  const sr = sheet.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight;

  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    return true;
  }

  // Collect LEAF-ish boxes: elements with no element children, plus the row
  // containers. A parent always "overlaps" its children, so comparing every
  // node against every node would be pure noise — we compare siblings that can
  // actually collide, which is what the law is about.
  const nodes = [];
  const all = sheet.querySelectorAll('*');
  for (const el of all) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    nodes.push({
      el,
      id: el.id || '',
      cls: String(el.className || '').slice(0, 48),
      tag: el.tagName.toLowerCase(),
      x: r.left, y: r.top, w: r.width, h: r.height,
    });
  }

  const hits = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      // skip ancestor/descendant — containment is not collision
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // skip elements that deliberately stack (none authored here, but a future
      // redesign may add one; it must opt in explicitly)
      if (a.el.dataset.overlapOk === 'true' || b.el.dataset.overlapOk === 'true') continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) {
        hits.push({
          a: (a.id || a.tag + '.' + a.cls), b: (b.id || b.tag + '.' + b.cls),
          overlap: Math.round(ox) + 'x' + Math.round(oy),
          aRect: [a.x, a.y, a.w, a.h].map(Math.round).join(','),
          bRect: [b.x, b.y, b.w, b.h].map(Math.round).join(','),
        });
      }
    }
  }

  // horizontal overflow past the sheet's own box — a row that grew instead of clipping
  const spills = [];
  for (const n of nodes) {
    if (n.x < sr.left - 1 || n.x + n.w > sr.right + 1) {
      spills.push({
        el: n.id || n.tag + '.' + n.cls,
        rect: [n.x, n.y, n.w, n.h].map(Math.round).join(','),
        sheet: [sr.left, sr.width].map(Math.round).join(','),
      });
    }
  }

  // touch targets — every control the user can hit must keep a real size
  const small = [];
  for (const el of sheet.querySelectorAll('button, input, a, textarea')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.height < 38) {
      small.push({ el: el.id || el.className || el.tagName, h: Math.round(r.height) });
    }
  }

  return {
    hits, spills, small,
    sheet: { top: Math.round(sr.top), left: Math.round(sr.left), w: Math.round(sr.width), h: Math.round(sr.height) },
    inViewport: sr.left >= -1 && sr.right <= vw + 1 && sr.bottom <= vh + 1,
    nodeCount: nodes.length,
    // DID IT ACTUALLY RENDER? Contract-detected: a populated roster shows agent
    // rows. Without this the harness would pass smugly on an empty pane.
    rowCount: sheet.querySelectorAll('.ct-row').length,
    // the two things this endeavour ADDED — measured, so a silent regression
    // that stops rendering them cannot pass as "no collisions".
    laneCount: sheet.querySelectorAll('.ct-lane').length,
    keyBtnCount: sheet.querySelectorAll('[data-act="key"]').length,
    vw, vh,
  };
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  let checks = 0;

  // 'roster' = the court list (lane badges + both action rows)
  // 'add'    = the bring-one-in form (the key box, the longest form)
  for (const w of WIDTHS) {
    for (const pane of ['roster', 'add']) {
      const tag = `${w}px/${pane}`;
      const page = await browser.newPage();
      page.on('dialog', d => d.dismiss().catch(() => {}));
      await page.setRequestInterception(true);
      page.on('request', req => {
        const u = req.url();
        if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
        req.abort().catch(() => {});
      });
      await page.evaluateOnNewDocument((roster) => {
        try {
          localStorage.setItem('vint_token', 'verify-court-token');
          localStorage.setItem('soul_auth_token', 'verify-court-token');
        } catch (_) {}
        // Serve the roster locally: the Court fetches /api/agents/mine, and this
        // harness runs with no brain. Intercepting fetch is how we drive the
        // REAL rendering path with a payload of our choosing rather than poking
        // markup in by hand (which would prove nothing about the real code).
        const realFetch = window.fetch;
        window.fetch = function (url, init) {
          const u = String(url || '');
          if (u.indexOf('/api/agents/mine') >= 0) {
            return Promise.resolve(new Response(JSON.stringify({ agents: roster }), {
              status: 200, headers: { 'Content-Type': 'application/json' },
            }));
          }
          if (u.indexOf('/api/') >= 0) {
            return Promise.resolve(new Response('{}', {
              status: 200, headers: { 'Content-Type': 'application/json' },
            }));
          }
          return realFetch.apply(this, arguments);
        };
      }, ROSTER);
      await page.setViewport({ width: w, height: HEIGHTS[w] || 800, deviceScaleFactor: 1 });

      try {
        await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1400));   // let the HUD + rail mount

        const opened = await page.evaluate((which) => {
          if (!window.VintCourt || !window.VintCourt.open) return false;
          window.VintCourt.open(which === 'add' ? 'add' : 'roster');
          return true;
        }, pane);
        if (!opened) { failures.push(`${tag}: VintCourt never mounted`); await page.close(); continue; }

        // WAIT FOR QUIESCENCE, don't guess — the sheet animates in (.38s) and
        // the roster arrives asynchronously, so a fixed sleep would sample a
        // transient in one direction or miss one in the other.
        const settled = await page.evaluate(async () => {
          const key = () => {
            const s = document.getElementById('ctSheet');
            if (!s) return '-';
            const r = s.getBoundingClientRect();
            return [r.top, r.height, s.querySelectorAll('.ct-row').length,
                    s.querySelectorAll('.ct-input').length].join(',');
          };
          let last = key(), stable = 0;
          for (let i = 0; i < 80; i++) {
            await new Promise(r => setTimeout(r, 50));
            const now = key();
            if (now === last) { if (++stable >= 5) return true; }
            else { stable = 0; last = now; }
          }
          return false;
        });
        if (!settled) failures.push(`${tag}: the sheet never settled (still moving after ~4s)`);

        const a = await page.evaluate(auditSheet);
        checks++;

        if (a.fatal) { failures.push(`${tag}: ${a.fatal}`); await page.close(); continue; }

        // the anti-smug-pass guards
        if (pane === 'roster') {
          if (a.rowCount < ROSTER.length) {
            failures.push(`${tag}: only ${a.rowCount}/${ROSTER.length} agent rows rendered — measuring an empty pane proves nothing`);
          }
          if (!a.laneCount) failures.push(`${tag}: no .ct-lane rendered — the lane badge is the thing under test`);
          if (!a.keyBtnCount) failures.push(`${tag}: no key control rendered — the key row is the thing under test`);
        } else {
          const hasKeyBox = await page.evaluate(() =>
            !!document.querySelector('#ctSheet #ctKey') ||
            !!document.querySelector('#ctSheet .ct-keybox'));
          // the key field lives behind "+ give them a soul"; open it and re-measure
          if (!hasKeyBox) failures.push(`${tag}: the add pane has no key field`);
        }

        if (!a.inViewport) {
          failures.push(`${tag}: the sheet itself leaves the viewport (${JSON.stringify(a.sheet)})`);
        }
        for (const h of a.hits) {
          failures.push(`${tag}: COLLISION ${h.a} × ${h.b} = ${h.overlap} (${h.aRect} vs ${h.bRect})`);
        }
        for (const s of a.spills) {
          failures.push(`${tag}: OVERFLOW ${s.el} at ${s.rect} spills past the sheet (${s.sheet})`);
        }
        for (const s of a.small) {
          failures.push(`${tag}: TOUCH TARGET ${s.el} is only ${s.h}px tall`);
        }

        // ── the ADD pane's advanced box, where the key field actually lives ──
        if (pane === 'add') {
          const opened2 = await page.evaluate(() => {
            const b = document.getElementById('ctAdvBtn');
            if (!b) return false;
            b.click();
            return true;
          });
          if (opened2) {
            await new Promise(r => setTimeout(r, 400));
            const a2 = await page.evaluate(auditSheet);
            checks++;
            const hasKey = await page.evaluate(() => !!document.getElementById('ctKey'));
            if (!hasKey) failures.push(`${tag}+adv: the key field never appeared`);
            for (const h of a2.hits) {
              failures.push(`${tag}+adv: COLLISION ${h.a} × ${h.b} = ${h.overlap} (${h.aRect} vs ${h.bRect})`);
            }
            for (const s of a2.spills) {
              failures.push(`${tag}+adv: OVERFLOW ${s.el} at ${s.rect} spills past the sheet (${s.sheet})`);
            }
            for (const s of a2.small) {
              failures.push(`${tag}+adv: TOUCH TARGET ${s.el} is only ${s.h}px tall`);
            }
          }
        }

        // ── the KEY pane, reached from a roster row ──────────────────────────
        if (pane === 'roster') {
          const wentToKey = await page.evaluate(() => {
            const b = document.querySelector('#ctSheet [data-act="key"]');
            if (!b) return false;
            b.click();
            return true;
          });
          if (wentToKey) {
            await new Promise(r => setTimeout(r, 500));
            const a3 = await page.evaluate(auditSheet);
            checks++;
            const hasOne = await page.evaluate(() => !!document.getElementById('ctKeyOne'));
            if (!hasOne) failures.push(`${tag}+key: the per-agent key pane never rendered`);
            for (const h of a3.hits) {
              failures.push(`${tag}+key: COLLISION ${h.a} × ${h.b} = ${h.overlap} (${h.aRect} vs ${h.bRect})`);
            }
            for (const s of a3.spills) {
              failures.push(`${tag}+key: OVERFLOW ${s.el} at ${s.rect} spills past the sheet (${s.sheet})`);
            }
            for (const s of a3.small) {
              failures.push(`${tag}+key: TOUCH TARGET ${s.el} is only ${s.h}px tall`);
            }
          }
        }

        process.stdout.write('.');
      } catch (e) {
        failures.push(`${tag}: threw — ${e.message}`);
      }
      await page.close();
    }
  }

  await browser.close();
  srv.close();

  console.log('');
  if (!checks) {
    console.error('\n✗ court collision proof: NOTHING WAS MEASURED — treating as failure.');
    process.exit(1);
  }
  if (failures.length) {
    console.error(`\n✗ court collision proof FAILED — ${failures.length} violation(s):\n`);
    for (const f of failures) console.error('  · ' + f);
    process.exit(1);
  }
  console.log(`\n✓ court collision proof clean — ${checks} sheet renders`);
  console.log(`  widths: ${WIDTHS.join(', ')}`);
  console.log(`  panes: roster (+key), add (+advanced) · hostile roster: 60-char names, 4-digit wallets, keys on file`);
})();
