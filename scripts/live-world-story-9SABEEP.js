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

async function getJson(path) {
  const r = await fetch(API + path, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

(async () => {
  console.log(`\n═══ LIVE story-layer check — ${PAGE} ← ${API} ═══\n`);

  /* ── 1 · the public brain answers all three Phase 8 surfaces ───────────── */
  console.log('── 1 · the three surfaces answer on the PUBLIC host ──');
  const t0 = Date.now();
  const gaz = await getJson('/api/world/gazette');
  const gazMs = Date.now() - t0;
  is('gazette: the public API lists editions', Array.isArray(gaz.editions) && gaz.editions.length > 0, gaz.editions && gaz.editions.length);
  const newest = (gaz.editions || [])[0] || {};
  is('gazette: the newest edition carries a real headline', words(newest.headline) >= 2, newest.headline);

  const tl = await getJson('/api/world/timeline');
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
  const frontRes = await fetch(`${API}/uw/gazette.uw/`, { signal: AbortSignal.timeout(60000) });
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
    const r = await fetch(API + u, { method: 'GET', signal: AbortSignal.timeout(40000) }).catch(() => null);
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
  const peers = (prof.relationships && prof.relationships.peers) || [];
  is('profile: relationships name peers with trust', peers.length > 0 && typeof peers[0].agent_id === 'string' && Number.isFinite(Number(peers[0].trust)), peers.length);
  is('profile: a peer trust is DERIVED, not asserted (its parts are shown)',
    !!(peers[0] && peers[0].parts && Object.keys(peers[0].parts).length >= 3), peers[0] && peers[0].parts);

  /* ── 5 · the PUBLIC PAGE renders it — the deployment, not the repo ─────── */
  console.log('\n── 5 · the live page renders the story layer ──');
  const failures = [];
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on('requestfailed', r => { if (r.url().includes('/api/world/')) failures.push(r.url() + ': ' + (r.failure() || {}).errorText); });
    const markerResponse = await fetch(new URL('commit.json', PAGE), { signal: AbortSignal.timeout(20000) });
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
    await page.waitForFunction(() => {
      const b = document.getElementById('worldStoryBody');
      return b && b.querySelector('.wd-day');
    }, { timeout: 60000 });
    const storyTxt = await page.$eval('#worldStoryBody', (e) => e.textContent);
    is('the story band rendered live history (not the unreachable message)',
      !/unreachable/i.test(storyTxt) && storyTxt.length > 40, storyTxt.slice(0, 80));
    is('the story band names YESTERDAY', /yesterday/i.test(storyTxt));
    is("the story band carries yesterday's own gazette headline",
      !!(yday && yday.headline && storyTxt.includes(yday.headline)), yday && yday.headline);

    await page.waitForFunction(() => {
      const b = document.getElementById('worldFolkBody');
      return b && b.querySelectorAll('button[data-agent]').length > 0;
    }, { timeout: 60000 });
    const roster = await page.$$eval('#worldFolkBody button[data-agent]', (b) => b.map((x) => x.getAttribute('data-agent')));
    is('the folk band rendered a live roster', roster.length >= 3, roster.length);

    const pick = roster.includes(who) ? who : roster[0];
    // Capture the response used by this render: the world can advance between
    // the initial API probe and clicking a citizen, so stale snapshots lie.
    const profileResponse = page.waitForResponse(r => {
      const u = new URL(r.url());
      return u.pathname === `/api/world/agent/${encodeURIComponent(pick)}` && r.status() === 200;
    }, { timeout: 60000 });
    await page.click(`#worldFolkBody button[data-agent="${pick}"]`);
    const renderedProfile = await (await profileResponse).json();
    await page.waitForFunction(() => {
      const h = document.getElementById('worldProfile');
      return h && h.querySelector('.wd-prof');
    }, { timeout: 60000 });
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
    is('the live profile shows a named relationship and exact trust',
      renderedPeers.some(p => profileLines.some(line =>
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
  if (fails.length) { console.log('FAILURES:'); fails.forEach((f) => console.log('  · ' + f)); }
  console.log(`${pass}/${pass + fails.length} pass`);
  console.log(`${'═'.repeat(66)}\n`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('live check aborted:', e && e.message); console.error(`${pass} checks passed before abort; phase acceptance remains unproven.`); process.exit(2); });
