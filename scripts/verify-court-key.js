#!/usr/bin/env node
/* verify-court-key.js — THE KEY PANE PROOF (task NYQAJY5).
   ────────────────────────────────────────────────────────────────────────────
   scripts/verify-no-collision.js measures world.html in its RESTING state and
   scripts/verify-one-sheet.js proves only ONE sheet is ever mounted. Neither can
   see the surface this task actually built: the Court's key UI exists only after
   a human signs in, opens the Court, and taps a row's "give them their own mind"
   — three interactions deep, behind an authenticated roster fetch. A sweep of
   the closed page will report green forever while the key box overflows at
   320px, because the key box was never on screen when it measured.

   This script drives that surface directly. It stubs the brain (the page is
   offline here by design) so the roster populates with the two states that
   render DIFFERENT markup — an agent WITH a sealed key (shows the mask + "take
   it back") and one WITHOUT (shows the gold "give them their own mind") — plus
   a prompt-only agent, which must show NO key affordance at all because it has
   no outbound lane to key.

   WHAT IT ASSERTS
     1. no two visible elements inside the Court sheet overlap, at every width
     2. nothing overflows the sheet's own box horizontally (the 320px killer)
     3. a prompt-only agent is offered no key control (we never imply a lane
        that does not exist)
     4. an agent with a key on file shows ONLY its mask — the key itself is
        never present anywhere in the DOM
     5. the Add pane's key box hides itself for a prompt-only provider

   USAGE
     node scripts/verify-court-key.js
     VERIFY_WIDTHS=320,375 node scripts/verify-court-key.js

   Exits non-zero on any violation, so it can gate a commit.
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);

// The sentinel key. It is fed to the stubbed roster as a value the brain would
// NEVER actually return (the real /api/agents/mine ships credential_hint, a
// mask, and never credential_enc) — so if this string ever appears in the DOM,
// the client is leaking a secret it should not even possess.
const NEVER_IN_DOM = 'sk-ant-LEAKCANARY0000000000';

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

const TOKEN_KEYS = ['vint_token', 'soul_auth_token', 'vint_access_token', 'access_token'];

// ── the roster the stubbed brain returns ──────────────────────────────────
// Three agents chosen because they are the three DIFFERENT renders of the row:
// keyed (mask + "take it back"), unkeyed-but-keyable (gold CTA), and lane-less
// (no key control at all). A long name and a long mask are deliberate — dynamic
// content is where containment actually breaks.
const AGENTS = [
  {
    id: 'a-keyed', name: 'Wei-Ling the Unsleeping Cartographer',
    provider: 'deepseek', provider_model: 'deepseek-chat',
    credential_hint: 'sk-…4f2a', endpoint_url: null,
    color: '#6f8dff', form: 'presence-child-refractive', lumen: 128,
    tended_at: Math.floor(Date.now() / 1000) - 60, vigil_total: 12, paused: 0,
  },
  {
    id: 'a-unkeyed', name: 'Nine',
    provider: 'openai', provider_model: 'gpt-4o',
    credential_hint: null, endpoint_url: null,
    color: '#66d3ac', form: 'presence-child-lantern', lumen: 4,
    tended_at: null, vigil_total: 0, paused: 0,
  },
  {
    id: 'a-prompt', name: 'The Hollow Choir',
    provider: 'prompt', provider_model: '',
    credential_hint: null, endpoint_url: null,
    color: '#ffd89a', form: 'presence-child-veil', lumen: 0,
    tended_at: null, vigil_total: 0, paused: 0,
  },
];

// ── the in-page probe ─────────────────────────────────────────────────────
// Measures every VISIBLE element inside the Court sheet and reports (a) any two
// that intersect and (b) any that breaches the sheet's own horizontal box.
// Only leaf-ish siblings matter: an ancestor always "overlaps" its descendant by
// construction, so containment is checked via the parent box instead.
const probe = () => {
  const sheet = document.querySelector('#ctSheet');
  if (!sheet) return { err: 'no #ctSheet' };
  const sr = sheet.getBoundingClientRect();
  if (sr.width === 0 || sr.height === 0) return { err: '#ctSheet not visible' };

  const vis = el => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const all = Array.from(sheet.querySelectorAll('*')).filter(vis);

  const desc = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    const txt = (el.textContent || '').trim().slice(0, 28);
    return `${el.tagName.toLowerCase()}${id}${cls}${txt ? ` "${txt}"` : ''}`;
  };

  // OVERFLOW: any element whose box breaches the sheet's horizontal bounds.
  // 1px absorbs sub-pixel rounding; a real overflow is always more.
  const overflow = [];
  all.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.left < sr.left - 1 || r.right > sr.right + 1) {
      overflow.push({
        el: desc(el),
        by: Math.round(Math.max(sr.left - r.left, r.right - sr.right)),
      });
    }
  });

  // OVERLAP: only between elements that are NOT ancestors of one another, and
  // that actually paint something of their own (text or a background/border).
  // A bare layout wrapper stacking over its own child is not a collision.
  const paints = el => {
    const s = getComputedStyle(el);
    const ownText = Array.from(el.childNodes)
      .some(n => n.nodeType === 3 && n.textContent.trim());
    const bg = s.backgroundImage !== 'none' ||
      (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent');
    const bd = parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0;
    return ownText || bg || bd;
  };
  const painters = all.filter(paints);

  const hits = [];
  for (let i = 0; i < painters.length; i++) {
    for (let j = i + 1; j < painters.length; j++) {
      const a = painters[i], b = painters[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 1 && oy > 1) {
        hits.push({ a: desc(a), b: desc(b), overlap: `${Math.round(ox)}x${Math.round(oy)}` });
      }
    }
  }

  return {
    hits, overflow,
    html: sheet.innerHTML,
    sheetRect: { l: Math.round(sr.left), r: Math.round(sr.right), w: Math.round(sr.width) },
  };
};

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  let checks = 0;

  for (const w of WIDTHS) {
    const page = await browser.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });

    // Sign in, and stub fetch so the Court's roster call resolves offline.
    // The stub is installed BEFORE any page script runs, so court.js sees it as
    // the real thing. NEVER_IN_DOM rides along on the roster payload precisely
    // so we can prove the client never renders it.
    await page.evaluateOnNewDocument((keys, agents, canary) => {
      const fake = 'verify.' + 'a'.repeat(40) + '.token';
      keys.forEach(k => { try { localStorage.setItem(k, fake); } catch (_) {} });
      try {
        localStorage.setItem('vint_user', JSON.stringify({ id: 1, email: 'verify@local', name: 'Verify' }));
        localStorage.setItem('vint_onboarded', '1');
        localStorage.setItem('vwg_seen', '1');
      } catch (_) {}

      const payload = agents.map(a => Object.assign({}, a, { _secret: canary }));
      const orig = window.fetch;
      window.fetch = function (url, opts) {
        const u = String((url && url.url) || url || '');
        const json = (o, status) => Promise.resolve(new Response(
          JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json' } }));
        if (/\/api\/agents\/mine/.test(u))    return json({ agents: payload });
        if (/\/api\/agents\/[^/]+\/key/.test(u)) return json({ ok: true, hint: 'sk-…9z1q' });
        if (/\/api\/agents\//.test(u))        return json({ ok: true, messages: [] });
        if (/\/api\//.test(u))                return json({ ok: true });
        return orig.apply(this, arguments);
      };
    }, TOKEN_KEYS, AGENTS, NEVER_IN_DOM);

    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
      return req.abort();
    });

    try {
      // ?court=1 forces the flag on, so the proof does not silently pass by
      // measuring a Court that was never enabled in this build.
      await page.goto(`${base}/world.html?court=1`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      failures.push({ type: 'LOAD', label: `@${w}px`, msg: e.message });
      await page.close();
      continue;
    }

    // world.html mounts its own surfaces on a timer; let it settle, then open
    // the Court through its real public entry point rather than faking the DOM.
    await new Promise(r => setTimeout(r, 2200));
    const opened = await page.evaluate(async () => {
      const C = window.VintCourt;
      if (!C || typeof C.open !== 'function') return 'no VintCourt.open';
      C.open('roster');
      await new Promise(r => setTimeout(r, 1200));
      return document.querySelector('#ctSheet') ? '' : 'sheet did not mount';
    }).catch(e => 'open threw: ' + e.message);

    if (opened) {
      failures.push({ type: 'OPEN', label: `@${w}px`, msg: opened });
      await page.close();
      continue;
    }

    // ── PANE 1: the roster, where the key affordances live ────────────────
    let res = await page.evaluate(probe);
    checks++;
    const rl = `roster @${w}px`;
    if (res.err) {
      failures.push({ type: 'PROBE', label: rl, msg: res.err });
    } else {
      res.hits.forEach(h => failures.push({ type: 'OVERLAP', label: rl, ...h }));
      res.overflow.forEach(o => failures.push({ type: 'OVERFLOW', label: rl, ...o }));

      // the key affordance appears exactly where a lane exists, and nowhere else
      const hasKeyed   = /data-act="key" data-id="a-keyed"/.test(res.html);
      const hasUnkeyed = /data-act="key" data-id="a-unkeyed"/.test(res.html);
      const hasPrompt  = /data-act="key" data-id="a-prompt"/.test(res.html);
      const hasUnkey   = /data-act="unkey" data-id="a-keyed"/.test(res.html);
      if (!hasKeyed)   failures.push({ type: 'MISSING-KEY-CTA', label: rl, msg: 'keyed agent has no replace control' });
      if (!hasUnkeyed) failures.push({ type: 'MISSING-KEY-CTA', label: rl, msg: 'keyable agent has no "give them their own mind"' });
      if (hasPrompt)   failures.push({ type: 'LANELESS-KEY-CTA', label: rl, msg: 'prompt-only agent was offered a key it cannot use' });
      if (!hasUnkey)   failures.push({ type: 'MISSING-UNKEY', label: rl, msg: 'keyed agent cannot take the key back' });

      // the mask shows; the secret never does
      if (res.html.includes(NEVER_IN_DOM)) {
        failures.push({ type: 'KEY-LEAK', label: rl, msg: 'a raw key value reached the DOM' });
      }
      if (!res.html.includes('sk-…4f2a')) {
        failures.push({ type: 'MISSING-MASK', label: rl, msg: 'the on-file mask is not shown' });
      }
    }

    // ── PANE 2: the key pane itself, opened on the keyed agent ────────────
    const keyOpened = await page.evaluate(async () => {
      const b = document.querySelector('[data-act="key"][data-id="a-keyed"]');
      if (!b) return 'no key button';
      b.click();
      await new Promise(r => setTimeout(r, 600));
      return document.querySelector('#ctKeyOne') ? '' : 'key pane did not render';
    }).catch(e => 'click threw: ' + e.message);

    if (keyOpened) {
      failures.push({ type: 'KEY-PANE', label: `@${w}px`, msg: keyOpened });
    } else {
      res = await page.evaluate(probe);
      checks++;
      const kl = `key-pane @${w}px`;
      if (res.err) failures.push({ type: 'PROBE', label: kl, msg: res.err });
      else {
        res.hits.forEach(h => failures.push({ type: 'OVERLAP', label: kl, ...h }));
        res.overflow.forEach(o => failures.push({ type: 'OVERFLOW', label: kl, ...o }));
        if (res.html.includes(NEVER_IN_DOM)) {
          failures.push({ type: 'KEY-LEAK', label: kl, msg: 'a raw key value reached the key pane' });
        }
        // the field must be a password input — a visible key is a shoulder-surf
        const masked = await page.evaluate(() => {
          const el = document.querySelector('#ctKeyOne');
          return el && el.type === 'password' && el.autocomplete === 'off';
        });
        if (!masked) failures.push({ type: 'UNMASKED-FIELD', label: kl, msg: '#ctKeyOne is not a password field with autocomplete off' });
      }
    }

    // ── PANE 3: Add, where the key box must follow the provider's lane ────
    const addState = await page.evaluate(async () => {
      const C = window.VintCourt;
      if (C && typeof C.open === 'function') C.open('add');
      await new Promise(r => setTimeout(r, 700));

      // start from a provider that HAS a lane, so the box is expected to show
      const pick = async (id) => {
        const el = Array.from(document.querySelectorAll('#ctPaneAdd .ct-prov'))
          .find(x => x.getAttribute('data-p') === id);
        if (!el) return false;
        el.click();
        await new Promise(r => setTimeout(r, 450));
        return true;
      };
      if (!(await pick('openai'))) return { err: 'no openai provider chip' };
      const box = document.querySelector('#ctPaneAdd .ct-keybox');
      if (!box) return { err: 'no key box in Add' };
      const shownForDefault = getComputedStyle(box).display !== 'none';

      // now the prompt-only provider; its key box must disappear
      if (!(await pick('prompt'))) return { err: 'no prompt provider chip' };
      const box2 = document.querySelector('#ctPaneAdd .ct-keybox');
      const hiddenForPrompt = !box2 || getComputedStyle(box2).display === 'none';

      // leave the pane on a keyable provider so the collision probe below
      // measures the box in its VISIBLE state, which is the risky one
      await pick('openai');
      return { shownForDefault, hiddenForPrompt };
    }).catch(e => ({ err: 'add threw: ' + e.message }));

    const al = `add-pane @${w}px`;
    if (addState.err) {
      failures.push({ type: 'ADD-PANE', label: al, msg: addState.err });
    } else {
      checks++;
      if (!addState.shownForDefault) {
        failures.push({ type: 'ADD-KEY-HIDDEN', label: al, msg: 'a keyable provider was offered no key box' });
      }
      if (!addState.hiddenForPrompt) {
        failures.push({ type: 'ADD-KEY-SHOWN', label: al, msg: 'prompt-only provider still shows a key box' });
      }
      // and the Add pane itself must not collide
      res = await page.evaluate(probe);
      if (!res.err) {
        res.hits.forEach(h => failures.push({ type: 'OVERLAP', label: al, ...h }));
        res.overflow.forEach(o => failures.push({ type: 'OVERFLOW', label: al, ...o }));
      }
    }

    await page.close();
    process.stdout.write('.');
  }

  await browser.close();
  srv.close();
  console.log('\n');

  // A run that asserted nothing is a FAILURE, not a pass — the same false green
  // that scripts/verify-one-sheet.js was fixed for in 28b97b3.
  const MIN = WIDTHS.length * 3;
  if (checks < MIN) {
    console.log(`✗ THE KEY PANE PROOF asserted only ${checks} of an expected ${MIN} checks — it verified almost nothing.`);
    failures.forEach(f => console.log(`    ✗ ${f.type} ${f.label} ${f.msg || ''}`));
    process.exit(1);
  }

  if (!failures.length) {
    console.log(`✓ THE KEY PANE PROOF — ${checks} checks across ${WIDTHS.join(', ')}px`);
    console.log('  the key box contains itself, the mask shows, the secret never lands in the DOM,');
    console.log('  and an agent with no lane is never offered a key.');
    process.exit(0);
  }

  console.log(`✗ THE KEY PANE PROOF — ${failures.length} violation(s):`);
  failures.forEach(f => {
    if (f.type === 'OVERLAP')       console.log(`    ✗ ${f.label}  ${f.a}  ×  ${f.b}   overlap ${f.overlap}px`);
    else if (f.type === 'OVERFLOW') console.log(`    ✗ ${f.label}  ${f.el}  breaches the sheet by ${f.by}px`);
    else                            console.log(`    ✗ ${f.type} ${f.label}  ${f.msg || ''}`);
  });
  process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
