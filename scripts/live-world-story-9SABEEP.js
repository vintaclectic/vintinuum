#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   LIVE END-TO-END CHECK — WORLD_SPEC Phase 8, the STORY LAYER.  (task 9SABEEP)

   WHY THIS EXISTS BESIDE collision-world-story-9SABEEP.js: that harness is
   deliberately HERMETIC — it serves the repo on 127.0.0.1 and ABORTS every
   request to api.vintaclectic.com, substituting fixtures, so it proves the
   UI's collision + reachability contract and nothing about the deployment.
   This file proves the other half the acceptance asks for: that the PUBLIC
   page at vintinuum.com, talking to the PUBLIC brain, actually renders what
   happened yesterday — and how long reading it takes.

   It asserts VALUES, never shapes (UGP7422): a reader that swallows its own
   errors answers 200 with zeroes, and "41 rows came back" is satisfied by 41
   rows of nothing.  So every check below names a fact out of the live world
   (yesterday's gazette headline, a wallet balance, a diary line, a named peer)
   and requires it on the page.

   It is REPORT-ONLY about the world's content: it never asserts a particular
   headline, only that the page and the paper agree about the SAME day — the
   world writes its own story and a test that pins the story would be red
   every morning.
   ════════════════════════════════════════════════════════════════════════════ */

const PAGE = process.env.STORY_LIVE_PAGE || 'https://vintinuum.com/world.html';
const API  = process.env.STORY_LIVE_API  || 'https://api.vintaclectic.com';
const WPM  = 200;                       // the budget the gazette itself uses

let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (_) { console.error('puppeteer is not installed here; cannot measure.'); process.exit(2); }

let pass = 0; const fails = [];
const is = (label, ok, got) => { if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { fails.push(`${label}${got === undefined ? '' : ` — got ${JSON.stringify(got)}`}`); console.log(`  FAIL  ${label}${got === undefined ? '' : ` — got ${JSON.stringify(got)}`}`); } };

const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/* ── the EDGE, not the story: a bounded retry that hides nothing ──────────
   The public host is reached through a cloudflared named tunnel whose
   individual edge connections CYCLE. MEASURED 2026-11-13 08:39-08:43Z in
   ~/.pm2/logs/vintinuum-named-tunnel-error.log: "Lost connection with the
   edge" -> "Registered tunnel connection" on connIndex 2 and 3 every ~1-2
   minutes (ewr12/ewr13/ewr16), while the SAME brain answered localhost
   /api/health 200 in 1.1ms throughout and the tunnel process never restarted.
   With four edge connections cycling, one request lands on a dropping
   connection and reads 502/000 while the next reads 200 — measured here as
   `pub timeline 502 0.87s` four minutes after `pub timeline 200 2.22s`.

   That is an EDGE defect (owned by task 5WM3QQX), not a story-layer defect, so
   a transient answer is retried a bounded number of times and EVERY retry is
   reported — a flap must never become invisible just because the run went
   green.

   It stays FAIL-CLOSED: after MAX_EDGE_TRIES the real status/error is handed
   back and the assertion that asked for it fails. A host that is genuinely
   down cannot be retried into a pass; only a host that answers correctly on a
   later attempt can. 4xx is never retried (a 404 back issue is a real dead
   link, which is exactly what section 3 exists to catch). */
const MAX_EDGE_TRIES = 4;
let edgeRetries = 0; const edgeRetryLog = [];
const transientStatus = (s) => s === 502 || s === 503 || s === 504 || s === 520 || s === 521 || s === 522 || s === 523 || s === 524;

/* `timeoutMs`, never a caller-built `signal`: AbortSignal.timeout() is
   ONE-SHOT. Passing one in from the call site means the first 60s timeout
   leaves the signal already aborted, so every retry after it aborts
   instantly and the bounded retry silently becomes no retry at all.
   MEASURED before this fix: the gazette front-page fetch aborted and the whole
   run died at 6 checks with "The operation was aborted due to timeout".
   A fresh signal is therefore built per ATTEMPT, inside the loop. */
async function edgeFetch(url, opts = {}) {
  const { timeoutMs = 60000, ...rest } = opts;
  let last = null;
  for (let attempt = 1; attempt <= MAX_EDGE_TRIES; attempt++) {
    let r = null, err = null;
    try { r = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) }); } catch (e) { err = e; }
    if (r && !transientStatus(r.status)) return r;          // answered (200 or a real 4xx)
    last = err ? `${err.name}: ${err.message}` : `HTTP ${r.status}`;
    if (attempt < MAX_EDGE_TRIES) {
      edgeRetries++;
      edgeRetryLog.push(`${String(url).replace(API, '')} attempt ${attempt} -> ${last}`);
      await new Promise((res) => setTimeout(res, 1500 * attempt));
      continue;
    }
    if (r) return r;                                         // exhausted: hand back the real failure
    throw err;
  }
  throw new Error(`edgeFetch exhausted: ${last}`);
}

async function getJson(path) {
  const r = await edgeFetch(API + path, { timeoutMs: 60000 });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

/* THE EDGE FLAP MAKES A SINGLE LONG WAIT A COIN FLIP (task 3WCDCFV, 2026-11-13)
   MEASURED this wake, paired and serial against the SAME brain: localhost
   answered `/api/world/timeline?days=7&per_day=5` 200 in 0.015-0.026s on 6/6
   probes while the PUBLIC host, in the same minutes, returned 000 after 30.00s
   and 502 after 22.43s before recovering to 200 in 0.60-2.21s. The brain is
   healthy; the cloudflared edge drops and re-registers connections every ~1-2
   minutes (owned by 5WM3QQX, NOT this phase).
   The page bounds every band read at 8s via AbortController, so a read issued
   inside a flap window is aborted and the band simply retries on its own 20s
   poll. A SINGLE `waitForFunction(..., 60000)` can therefore straddle one flap
   window and miss: MEASURED, a run aborted at 29 checks with 13
   `net::ERR_ABORTED` band reads across three poll cycles, while a run minutes
   earlier against the SAME deploy passed because it re-opened the band.
   So we wait in CHUNKS and, between chunks, close->open the <details> to force
   a FRESH fetch — exactly what a reader's refresh does, and well inside the
   phase's two-minute budget. It is still BOUNDED: a band that is genuinely
   broken never renders and the check fails. This changes PATIENCE only; every
   assertion below it is untouched. */
async function renderWithRefresh(page, detailsId, predicate, arg, totalMs) {
  const deadline = Date.now() + totalMs;
  await page.evaluate((id) => { const d = document.getElementById(id); if (d && !d.open) d.open = true; }, detailsId);
  let last = null;
  while (Date.now() < deadline) {
    try {
      await page.waitForFunction(predicate, { timeout: Math.min(22000, Math.max(3000, deadline - Date.now())) }, arg);
      return true;
    } catch (e) {
      last = e;
      if (Date.now() >= deadline) break;
      await page.evaluate((id) => { const d = document.getElementById(id); if (d) { d.open = false; d.open = true; } }, detailsId);
    }
  }
  if (last) console.log(`       band #${detailsId} never rendered within ${totalMs}ms (${last.message.split('\n')[0]})`);
  return false;
}

(async () => {
  console.log(`\n═══ LIVE story-layer check — ${PAGE} ← ${API} ═══\n`);

  /* ── 1 · the public brain answers all three Phase 8 surfaces ───────────── */
  console.log('── 1 · the three surfaces answer on the PUBLIC host ──');
  const t0 = Date.now();
  let gaz = await getJson('/api/world/gazette');
  const gazMs = Date.now() - t0;
  is('gazette: the public API lists editions', Array.isArray(gaz.editions) && gaz.editions.length > 0, gaz.editions && gaz.editions.length);
  let newest = (gaz.editions || [])[0] || {};
  is('gazette: the newest edition carries a real headline', words(newest.headline) >= 2, newest.headline);

  const tl = await getJson('/api/world/timeline');
  /* ── READ SKEW ACROSS THE DAY BOUNDARY ────────────────────────────────────
     These are two requests to a LIVING world, and a day rolls every 24 ticks
     (~24 min). The gazette is read first and the timeline second, so a roll
     landing between them reads as disagreement that no defect produced.
     MEASURED 2026-11-13: the run died on {"timeline":397,"paper":396} while
     the SAME brain, queried seconds later, held today 398 / yesterday 397 and
     a day-397 edition published at tick 9552 — i.e. the paper was already
     correct and the two fetches simply sat on opposite sides of tick 9552.

     So when the timeline has moved past the paper by exactly one day, the
     PAPER is re-read once, on the timeline's side of the boundary, and the
     assertion below runs on that consistent snapshot.
     This does NOT weaken the check: the paper must still carry an edition for
     the timeline's own yesterday. A paper that is genuinely a day behind fails
     exactly as before, because the re-read returns the same stale newest. The
     re-read is REPORTED so a roll is never invisible. */
  const tlYesterday = Number(tl.today) - 1;
  if (Number(newest.day) === tlYesterday - 1) {
    console.log(`       day boundary rolled mid-read (paper ${newest.day}, timeline yesterday ${tlYesterday}) — re-reading the paper once`);
    gaz = await getJson('/api/world/gazette');
    newest = (gaz.editions || [])[0] || {};
    console.log(`       paper after re-read: day ${newest.day}`);
  }
  is('timeline: days came back', Array.isArray(tl.days) && tl.days.length > 1, tl.days && tl.days.length);
  const yday = (tl.days || []).find((d) => Number(d.day) === Number(tl.today) - 1);
  is('timeline: YESTERDAY is present as its own day', !!yday, yday && yday.day);
  is('timeline: yesterday carries the gazette headline for that day',
    !!(yday && yday.headline && words(yday.headline) >= 2), yday && yday.headline);
  is('timeline and the paper agree about yesterday',
    !!(yday && newest && Number(yday.day) === Number(newest.day) && yday.headline === newest.headline),
    { timeline: yday && yday.day, paper: newest.day });
  is('timeline: yesterday has beats a human can read',
    !!(yday && Array.isArray(yday.beats) && yday.beats.length >= 1 && words(yday.beats[0].text) >= 4),
    yday && yday.beats && yday.beats.length);

  /* ── 2 · THE PHASE TEST — under two minutes, measured ──────────────────── */
  console.log('\n── 2 · THE PHASE TEST: read what happened yesterday in <2 min ──');
  const frontRes = await edgeFetch(`${API}/uw/gazette.uw/`, { timeoutMs: 60000 });
  const frontHtml = await frontRes.text();
  const frontText = frontHtml.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ');
  const frontWords = words(frontText);
  const readMin = frontWords / WPM;
  console.log(`       gazette front page: ${frontWords} words ≈ ${readMin.toFixed(2)} min at ${WPM}wpm`);
  is('gazette front page is served (200)', frontRes.status === 200, frontRes.status);
  is('gazette front page is readable in under 2 minutes', readMin < 2, `${readMin.toFixed(2)} min`);
  is('gazette front page is not empty prose', frontWords >= 60, frontWords);

  const ydayWords = yday ? words(yday.headline) + (yday.beats || []).reduce((n, b) => n + words(b.text), 0) : 0;
  console.log(`       timeline's yesterday row: ${ydayWords} words ≈ ${(ydayWords / WPM).toFixed(2)} min`);
  is("timeline's yesterday row is readable in under 2 minutes", ydayWords / WPM < 2, `${(ydayWords / WPM).toFixed(2)} min`);
  // Back-issue headlines concern older days; count yesterday's article plus
  // yesterday's timeline, including duplicated prose, for the combined path.
  const articleText = frontText.split(/Back issues/i)[0];
  const combinedWords = words(articleText) + ydayWords;
  is('yesterday article PLUS timeline fit under two minutes at 200wpm',
    combinedWords < 400, { words: combinedWords, minutes: combinedWords / WPM });

  /* ── 3 · every back issue the front page advertises still exists ───────── */
  console.log('\n── 3 · the front page never links an edition the prune removed ──');
  const links = [...new Set([...frontHtml.matchAll(/href="(\/uw\/gazette\.uw\/day-\d+)"/g)].map((m) => m[1]))];
  console.log(`       ${links.length} back-issue link(s) advertised`);
  is('the front page advertises back issues', links.length > 0, links.length);
  const dead = [];
  for (const u of links) {
    // edgeFetch already retried a transient edge answer; a non-200 that
    // survives that is a REAL dead link, and a thrown network error is
    // recorded as such rather than laundered into a null (the benign-return trap).
    const r = await edgeFetch(API + u, { method: 'GET', timeoutMs: 40000 })
      .catch((e) => ({ status: `network: ${e.name}` }));
    if (!r || r.status !== 200) dead.push([u, r && r.status]);
  }
  is('EVERY advertised back issue answers 200 (0 dead links)', dead.length === 0, dead);

  /* ── 4 · the profile is wallet + diary + relationships, with VALUES ───── */
  console.log('\n── 4 · agent profile: wallet, diary, relationships ──');
  const whoRow = (tl.days || []).flatMap((d) => d.beats || []).find((b) => b.agent_id);
  const who = (whoRow && whoRow.agent_id) || 'citizen_ember';
  const prof = await getJson(`/api/world/agent/${encodeURIComponent(who)}`);
  is(`profile: ${who} came back named`, words(prof.name) >= 1, prof.name);
  is('profile: wallet carries a numeric balance', Number.isFinite(Number(prof.wallet && prof.wallet.balance)), prof.wallet && prof.wallet.balance);
  is('profile: wallet explains itself by reason', Array.isArray(prof.wallet && prof.wallet.by_reason) && prof.wallet.by_reason.length > 0, prof.wallet && prof.wallet.by_reason && prof.wallet.by_reason.length);
  is('profile: the cached balance agrees with the journal (drift 0)', Number(prof.wallet && prof.wallet.drift) === 0, prof.wallet && prof.wallet.drift);
  is('profile: the diary holds real sentences, not empty rows',
    Array.isArray(prof.diary) && prof.diary.length > 0 && words(prof.diary[0].text) >= 5,
    prof.diary && prof.diary.length);
  /* ── RELATIONSHIPS: the SHAPE is universal, the VALUES need a peer ────────
     `who` is whichever agent the timeline's first beat happens to name, and an
     agent with NO measured peer is a legitimate state, not a defect: trust is
     DERIVED from completed contracts, transfers, shared orgs and wars fought
     together, so an agent that has not yet interacted scores nothing and
     honestly lists nobody. Phase 7 recorded exactly this — `vintinuum-aria`
     wrote its will to `@mint`, the state, "having no measured peer" — and
     MEASURED here 2026-11-13, vintinuum-aria came back with peers: 0, which
     failed an assertion that demanded values every citizen cannot have.

     So the contract every profile must satisfy (the block exists and is
     well-formed) is asserted on whoever came up, and the VALUES are proven on
     an agent that actually has a peer, found by sampling the live roster. That
     sample is a capability demonstration, deliberately chosen — so it proves
     the surface renders real trust, and NO rate is quoted from it. */
  const peers = (prof.relationships && prof.relationships.peers) || [];
  is('profile: the relationships block is present and well-formed for every agent',
    !!(prof.relationships && Array.isArray(prof.relationships.peers)),
    { agent: who, peers: peers.length });

  let trustWho = peers.length ? who : null;
  let trustPeers = peers.length ? peers : [];
  let sampled = 1, withPeers = peers.length ? 1 : 0;
  if (!trustWho) {
    const roster = await getJson('/api/world/agents?limit=40');
    const ids = (roster.agents || roster || []).map((a) => a.id || a.agent_id).filter(Boolean);
    for (const id of ids.slice(0, 10)) {
      if (id === who) continue;
      const cand = await getJson(`/api/world/agent/${encodeURIComponent(id)}`);
      sampled++;
      const cp = (cand.relationships && cand.relationships.peers) || [];
      if (cp.length) { withPeers++; trustWho = id; trustPeers = cp; break; }
    }
  }
  console.log(`       peer sample: ${withPeers} of ${sampled} agent(s) read carried a measured peer (report, not a rate)`);
  is('profile: SOME live agent carries a measured peer to prove trust with',
    !!trustWho, { sampled, withPeers });
  is(`profile: ${trustWho || 'n/a'} names a peer with a numeric trust`,
    !!(trustPeers[0] && typeof trustPeers[0].agent_id === 'string' && Number.isFinite(Number(trustPeers[0].trust))),
    trustPeers[0] && { peer: trustPeers[0].agent_id, trust: trustPeers[0].trust });
  is('profile: a peer trust is DERIVED, not asserted (its parts are shown)',
    !!(trustPeers[0] && trustPeers[0].parts && Object.keys(trustPeers[0].parts).length >= 3),
    trustPeers[0] && trustPeers[0].parts);

  /* ── 5 · the PUBLIC PAGE renders it — the deployment, not the repo ─────── */
  console.log('\n── 5 · the live page renders the story layer ──');
  const failures = [];
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on('requestfailed', r => { if (r.url().includes('/api/world/')) failures.push(r.url() + ': ' + (r.failure() || {}).errorText); });
    /* THE HOST THE BAND ACTUALLY ASKS (task 3WCDCFV) ────────────────────────
       The story layer shipped reading `window.VINT_API_BASE || ''` — a global
       nothing sets — so every band read went to the PAGE's own origin and got
       404 from GitHub Pages: "The history is unreachable.", forever, in public
       only. Nothing in the suite could see it, because every other check
       either talks to the API directly from node or (in the collision sweep)
       intercepts by PATH before looking at the host.
       So the page's OWN requests are recorded here, and asserted below to go
       to the API origin and to answer 200. This is the ratchet: a base that
       regresses to the page origin fails the run instead of shipping. */
    const bandReqs = [];
    page.on('response', (r) => {
      const u = r.url();
      if (/\/api\/world\/(timeline|agents)/.test(u)) bandReqs.push({ url: u, status: r.status() });
    });
    const markerResponse = await edgeFetch(new URL('commit.json', PAGE), { timeoutMs: 20000 });
    const marker = await markerResponse.json();
    const expectedCommit = process.env.STORY_EXPECT_COMMIT;
    is('public build marker is a git hash', /^[a-f0-9]{7,40}$/.test(marker.commit || ''), marker.commit);
    if (expectedCommit) is('public build marker matches the expected deploy', marker.commit === expectedCommit, marker.commit);
    await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(commit => document.title.includes(commit), { timeout: 20000 }, marker.commit);
    is('live page title carries the public build marker', true, marker.commit);
    // The panel is built by body/world/economy-map.js after the map opens.
    // The real id, read out of body/world/economy-map.js (line 72,
    // `mapButton.id = 'worldMapButton'`) rather than guessed — a plausible
    // name is the most dangerous kind of wrong.
    await page.waitForSelector('#worldMapButton', { timeout: 60000 });
    const opened = await page.evaluate(() => {
      const b = document.getElementById('worldMapButton');
      if (!b) return false;
      const p = document.getElementById('worldMapPanel');
      if (!p || p.hidden) b.click();
      return true;
    });
    is('the live page exposes the world-map control', opened);
    await page.waitForSelector('#worldStory', { timeout: 60000 });
    is('#worldStory exists on the LIVE page', true);
    is('#worldFolk exists on the LIVE page', await page.$('#worldFolk') !== null);

    // open both bands and let them fetch the live brain
    await page.evaluate(() => {
      const s = document.getElementById('worldStory'); if (s) s.open = true;
      const f = document.getElementById('worldFolk');  if (f) f.open = true;
    });
    const storyOk = await renderWithRefresh(page, 'worldStory', () => {
      const b = document.getElementById('worldStoryBody');
      return b && b.querySelector('.wd-day');
    }, null, 150000);
    is('the story band rendered live history within budget', storyOk, storyOk);
    const storyTxt = await page.$eval('#worldStoryBody', (e) => e.textContent);
    is('the story band rendered live history (not the unreachable message)',
      !/unreachable/i.test(storyTxt) && storyTxt.length > 40, storyTxt.slice(0, 80));
    is('the story band names YESTERDAY', /yesterday/i.test(storyTxt));
    is("the story band carries yesterday's own gazette headline",
      !!(yday && yday.headline && storyTxt.includes(yday.headline)), yday && yday.headline);

    const folkOk = await renderWithRefresh(page, 'worldFolk', () => {
      const b = document.getElementById('worldFolkBody');
      return b && b.querySelectorAll('button[data-agent]').length > 0;
    }, null, 150000);
    is('the folk band rendered a live roster within budget', folkOk, folkOk);
    const roster = await page.$$eval('#worldFolkBody button[data-agent]', (b) => b.map((x) => x.getAttribute('data-agent')));
    is('the folk band rendered a live roster', roster.length >= 3, roster.length);

    // The band's own reads must leave the page origin for the brain.
    const apiOrigin = new URL(API).origin;
    const pageOrigin = new URL(PAGE).origin;
    const offHost = bandReqs.filter((r) => new URL(r.url).origin !== apiOrigin);
    const notOk = bandReqs.filter((r) => r.status !== 200);
    console.log(`       the page made ${bandReqs.length} band request(s); origins: ${[...new Set(bandReqs.map((r) => new URL(r.url).origin))].join(', ') || 'none'}`);
    is('the live page made band requests at all', bandReqs.length > 0, bandReqs.length);
    is(`every band request went to the brain (${apiOrigin}), not the page origin (${pageOrigin})`,
      offHost.length === 0, offHost.slice(0, 3));
    /* The ORIGIN assertion above is the ratchet and stays absolute — a base that
       regresses to the page origin fails the run. The STATUS assertion below is
       deliberately not "every request was 200": MEASURED this wake the public
       edge returned 000/30.00s and 502/22.43s on the band's own URLs while
       localhost answered 200 in 0.015-0.026s on 6/6, so an all-200 bar asserts
       the EDGE's health (owned by 5WM3QQX) rather than the story layer's. What
       Phase 8 must prove is that the band CAN read the brain and did — so we
       require a successful 200 from the brain, and REPORT any transient
       failures instead of asserting them away. */
    const okReqs = bandReqs.filter((r) => r.status === 200);
    if (notOk.length) console.log(`       ${notOk.length} transient non-200 band response(s) from the flapping edge: ${notOk.slice(0, 3).map((r) => r.status).join(', ')} (5WM3QQX)`);
    is('the band successfully read the brain on the live page (>=1 request answered 200)',
      okReqs.length > 0, { ok: okReqs.length, transient_failures: notOk.length });

    // Prefer the agent proven above to carry a measured peer: the rendered-trust
    // assertion below compares a NAMED peer and its exact trust against what the
    // page painted, and an agent with no peer cannot satisfy it (see section 4).
    const pick = (trustWho && roster.includes(trustWho)) ? trustWho
      : (roster.includes(who) ? who : roster[0]);
    // Capture the response used by this render: the world can advance between
    // the initial API probe and clicking a citizen, so stale snapshots lie.
    // Same flap discipline as the bands: the click's own fetch is bounded at 8s
    // by the page, so a click landing in a flap window renders nothing. Re-click
    // until it renders, bounded. `renderedProfile` is ALWAYS the response that
    // belongs to the render that actually succeeded — the world advances between
    // ticks, so a stale snapshot would make the value comparisons below lie.
    let renderedProfile = null;
    const profDeadline = Date.now() + 150000;
    while (!renderedProfile && Date.now() < profDeadline) {
      const profileResponse = page.waitForResponse(r => {
        const u = new URL(r.url());
        return u.pathname === `/api/world/agent/${encodeURIComponent(pick)}` && r.status() === 200;
      }, { timeout: 22000 }).catch(() => null);
      await page.click(`#worldFolkBody button[data-agent="${pick}"]`).catch(() => {});
      const resp = await profileResponse;
      if (!resp) continue;
      try {
        await page.waitForFunction(() => {
          const h = document.getElementById('worldProfile');
          return h && h.querySelector('.wd-prof');
        }, { timeout: 15000 });
        renderedProfile = await resp.json();
      } catch (_) { /* flap: re-click and wait again */ }
    }
    is('the live profile rendered within budget', !!renderedProfile, !!renderedProfile);
    if (!renderedProfile) throw new Error('the live profile never rendered within 150s');
    const profTxt = await page.$eval('#worldProfile', (e) => e.textContent);
    is(`clicking ${pick} opened a profile on the LIVE page`, profTxt.length > 30, profTxt.length);
    const walletText = await page.$$eval('#worldProfile .wd-rowline', rows => {
      const row = rows.find(r => r.querySelector('span')?.textContent === 'wallet');
      return row?.querySelector('b')?.textContent;
    });
    const expectedWallet = Number(renderedProfile.wallet?.balance).toLocaleString('en-US');
    is('the live profile wallet equals its actual API balance',
      Number.isFinite(Number(renderedProfile.wallet?.balance)) && walletText === expectedWallet,
      { actual: walletText, expected: expectedWallet });
    is('the live profile shows the selected citizen name',
      profTxt.includes(renderedProfile.name), renderedProfile.name);
    is('the live profile shows a real diary sentence from its response',
      (renderedProfile.diary || []).some(d => profTxt.includes(d.text)), renderedProfile.diary?.length);
    const renderedPeers = renderedProfile.relationships?.peers || [];
    const profileLines = await page.$$eval('#worldProfile li', rows => rows.map(r => r.textContent));
    // Bound to the response THIS render used (the world advances between the
    // probe and the click), and stated against the rendered peer list: if the
    // clicked citizen genuinely has no peer the page has nothing to paint, and
    // that is reported rather than asserted away.
    if (!renderedPeers.length) {
      console.log(`       ${pick} carried no peer in the response this render used — no trust line to compare`);
    }
    is('the live profile shows a named relationship and exact trust',
      renderedPeers.length > 0 && renderedPeers.some(p => profileLines.some(line =>
        line.includes(p.agent_id.replace(/^citizen_/, '')) &&
        line.startsWith(Number(p.trust).toFixed(2) + ' '))), renderedPeers.length);
    is('the live profile shows diary or relationship prose',
      /diary|wrote|peer|trust|knows|remember/i.test(profTxt), profTxt.slice(0, 160));

    // 6 — citizen-written text can never become markup on the live page
    console.log('\n── 6 · no citizen text became markup ──');
    const injected = await page.evaluate(() => {
      const roots = ['worldStoryBody', 'worldFolkBody'].map((i) => document.getElementById(i)).filter(Boolean);
      let bad = 0;
      for (const r of roots) for (const el of r.querySelectorAll('*'))
        if (/^(script|iframe|object|embed|style)$/i.test(el.tagName)) bad++;
      return bad;
    });
    is('no script/iframe/style element grew inside either band', injected === 0, injected);
  } catch (e) {
    console.error('World API request failures:', JSON.stringify(failures));
    throw e;
  } finally { await browser.close(); }

  console.log(`\n${'═'.repeat(66)}`);
  // REPORT, never an assertion: the edge's own behaviour during this run. A
  // green run that needed retries is still green — the story layer answered —
  // but the flap is printed so it cannot hide behind the tally (task 5WM3QQX).
  if (edgeRetries) {
    console.log(`EDGE FLAP (reported, not asserted): ${edgeRetries} transient retry(ies) against ${API}`);
    edgeRetryLog.forEach((l) => console.log('  · ' + l));
  } else {
    console.log(`EDGE: no transient retries needed against ${API}`);
  }
  if (fails.length) { console.log('FAILURES:'); fails.forEach((f) => console.log('  · ' + f)); }
  console.log(`${pass}/${pass + fails.length} pass`);
  console.log(`${'═'.repeat(66)}\n`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('live check aborted:', e && e.message); console.error(`${pass} checks passed before abort; phase acceptance remains unproven.`); process.exit(2); });
