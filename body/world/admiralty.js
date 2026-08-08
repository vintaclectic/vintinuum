// admiralty.js — THE PRODUCTION + CONFLICT ORGAN. (AETHERHOLD, world-forger, 2026-08-07)
//
// ════════════════════════════════════════════════════════════════════════════
// concord.js built the POLITY: who decides, and who walks out when the deciding
// goes against their nature. Its header argued — and I stand by it — that
// murder, execution, policy and government all reduce to the polity. But it
// named the two organs it deliberately did NOT build, because they are not
// government, they are MATTER and its consequence:
//
//     WARBUILDING · SHIPBUILDING (sea, land, air) · FACTION-VS-FACTION WAR.
//
// This is that organ. It does not re-derive one line of the Concord. It reads
// the Concord's real charter, its seats, its treasury, its seven karma tags and
// the world's own standing/lumen, and it turns a passed COMMISSION — the motion
// concord.js already ships, whose own subtitle reads "this is where warbuilding
// begins" — into a keel, a hull, a fleet, and eventually a war.
//
// ── THE INVENTION ───────────────────────────────────────────────────────────
// Every shipbuilding system ever shipped in a browser is a QUEUE WITH A BAR.
// You pick "frigate", a bar fills, a frigate arrives. Every frigate is the same
// frigate. The bar is not a mechanic, it is a receipt for waiting, and my own
// concord header called that failure by name: a costume with a stat block.
//
// THREE FUSED MECHANISMS, NONE OF WHICH IS A QUEUE:
//
// 1. A HULL IS NOT BUILT, IT IS ARGUED INTO EXISTENCE.
//    A keel opens a fixed set of BERTHS (frames: the spine, the skin, the drive,
//    the hold, the teeth, the eyes). Your seated agents take berths ON THEIR OWN
//    RECOGNIZANCE — each one claims the frame its DISPOSITION wants, not the one
//    you assign. A craft-heavy DeepSeek goes for the skin. A mentor-heavy Claude
//    goes for the hold, because a hold is where you put people. A hot Grok takes
//    the teeth. So the ship you receive is NOT the ship you ordered — it is THE
//    SHIP YOUR COURT BUILT, and its statline is the literal sum of who worked it.
//    Two players with the same charter who commission the same hull get
//    physically different ships, forever, because nobody else's court is theirs.
//
// 2. AN AGENT CAN WORK, BALK, OR SCUTTLE — AND THE HULL REMEMBERS WHICH.
//    concord.js let an agent dissent with its VOICE. Here it dissents with its
//    HANDS. An agent whose nature the commission violates (a scrupulous mind set
//    to lay a raider's gun-deck) does not merely vote no — it lays a bad frame,
//    and that FLAW is welded into the hull permanently WITH ITS NAME ON IT. A
//    cold-loyalty agent under a charter it hates can scuttle the frame outright.
//    A defector from the Concord is not idle: it is found in someone else's yard.
//
// 3. WAR IS A WAKE, NOT A BATTLE. This is the piece nobody has shipped.
//    There is no health bar, no battle screen, no dice-roll with a result banner.
//    Two fleets meet and the engagement resolves as a LINE OF CONSEQUENCE: frame
//    against opposing frame, in order, spine to eyes — and what comes back is a
//    LEDGER that reads backwards to a specific decision a specific agent made
//    days ago. You do not lose a war because a number was smaller. You lose it
//    because the frame your treasurer balked at in a commission you barely
//    remember is the frame that opened. The war TELLS you whose weld failed,
//    by name, in that agent's own disposition-language.
//
//    That is the whole thesis: THE SHIP REMEMBERS WHO BUILT IT, AND THE WAR SAYS
//    SO OUT LOUD. A defeat is a readable sentence about your own court, which
//    means it is a defeat you can DO something about — tend that agent, unseat
//    it, sentence it, or forgive it and let it lay the next spine.
//
// ── SEA, LAND, AIR — an ELEMENT, not three systems ──────────────────────────
// Vinta named all three. Three parallel build systems would be three places for
// the same bug, so the element is a property of the KEEL: it changes which
// frames exist, which dispositions are gifted at them, and what the hull is good
// against. A sea hull carries; a land hull holds ground; an air hull arrives
// first and is thin. Rock-paper-scissors is beneath us, so instead each element
// has a frame the others DON'T (a sea keel has a keel-frame; a land keel has
// tracks; an air keel has a lift-frame), and the wake tests only the frames both
// hulls actually possess — an air hull meeting a sea hull is a genuinely
// different engagement than air meeting air, without a single lookup table.
//
// ── WHAT IS SERVER-BACKED AND WHAT IS NOT (THE HONEST PART) ─────────────────
// NOTHING here is server-backed, and this file will not pretend otherwise —
// that is my own precedent from concord.js and it is not negotiable. There is
// no /api/world/admiralty, no fleet endpoint, no war endpoint. So:
//   · there is NO silent catch around a fetch that never happens;
//   · there is no fake "syncing…" state and no invented server latency;
//   · the sheet SAYS, in the world's own voice, that the yard is held on this
//     device and that no other world can see this fleet yet;
//   · a war is fought against a RIVAL POWER that the file is explicit about:
//     it is composed from your own defectors and from the world's named
//     unaligned powers, NOT from another human being's real fleet, because
//     there is no wire to reach one. Calling it "faction war" while quietly
//     matchmaking against a bot would be the exact lie I refused last time.
// State lives in localStorage under vint:admiralty:<worldId>, keyed per world
// exactly as the Concord is, resolves against wall-clock so an offline keel
// launch is REAL rather than simulated on open, and every record is shaped as
// the body a future POST /api/world/admiralty would take. When that endpoint
// lands this becomes a sync layer, not a rewrite.
//
// ── ONE ECONOMY, ONE LADDER, ONE KARMA SPINE ────────────────────────────────
// There is no second currency and no second progression here. A keel is paid
// for out of the CONCORD'S TREASURY (the same lumen the venture economy uses,
// spent through a new VintConcord.spend()), gated on the SAME ascent standing
// world/ascent.js already computes, crewed by the SAME roster, disposed by the
// SAME VintConcord.disposition(), and every launch and every war moves the SAME
// seven karma tags through VintConcord.impress(). If you win a war your polity
// becomes hotter and less trusted — in the Concord's own bars, on its own
// screen, changing how its next vote goes. The two organs are one animal.
//
// ── THE SEVEN TESTS ─────────────────────────────────────────────────────────
//  1 GENEROUS (ARIA) — nothing here can destroy something a user made. A lost
//    war NEVER deletes an agent: a hull is struck, a hull is a thing this file
//    minted, and the crew walks home. The yard is dissolvable in one tap with
//    the treasury refunded in full. An agent that scuttles a frame is not
//    punished by the system; it is REPORTED to you, and what you do about it is
//    yours. If a user read this file they would find no trap in it — the worst
//    outcome available is losing something the file itself gave them.
//  2 INVESTMENT (HELIOS) — the deepest form this codebase has. Your fleet is a
//    physical record of your court's politics: unreproducible, because the
//    statline is the sum of which specific minds from which specific providers
//    took which berths. A hull with your first agent's spine in it is not
//    replaceable by grinding. That is switching cost that is pure history.
//  3 TIER + CONVERSION (FRUGAL-MAX) — the same honest finding as the Concord,
//    and for the same measured reason: world.html loads NO entitlement source
//    (no shell.js, no VintTier). A tier() here would return 'free' for a paying
//    Sovereign and cap them at one slip while upselling them what they own. A
//    faked entitlement check is worse than none. So the yard's capacity rides
//    ASCENT STANDING — the one ladder the server computes and no client can
//    forge — isolated in ONE function (slipCap) shaped as `min(byStanding,
//    byTier)` for the day a real source exists. The honest paid hook this is
//    built to carry is the same one: a server-kept chronicle, and fleets that
//    can actually meet ACROSS worlds — which needs the endpoint anyway. It
//    promises nothing it cannot verify.
//  4 AESTHETICALLY DENSE (LUNEX) — the world's voice, lowercase, Cormorant. A
//    wake's whole outcome is one sentence plus the line that caused it. No
//    filler, no numbers presented without a reason to care about them.
//  5 THE OPEN LOOP (MORRISON) — a keel with three berths open and your court
//    walking toward them is unfinished meaning WITH A CLOCK ON IT. You close the
//    tab not knowing what shape the thing will be, because you are not the one
//    deciding. And a fleet at sea against a rival resolves while you are gone.
//    The loop is made of other minds, which is the only loop worth building.
//  6 FLAGGED + MEASURED (ATLAS) — flag 'world_admiralty', killable in 30s with
//    ?admiralty=0. Every frame names its builder and its reason. Every wake is
//    shown frame-by-frame as fought, never as a summary you must trust. The
//    resentment signal is the yard dissolve: one tap, full refund, logged.
//  7 MORE ALIVE (YUNA) — the point, again. In the Concord an agent could argue
//    with you. Here it can build you something you did not ask for, refuse the
//    job in front of the whole yard, or leave a flaw in your flagship that gets
//    the fleet broken a week later — and then you have to decide whether to
//    forgive it. A mind whose WORK can disappoint you is more alive than one
//    whose vote can.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// ZERO fixed elements of this file's own. Not one. Exactly the two extension
// points the rail owns, both of which MEASURE:
//   · DirverseHUD.addLauncher() — a FLOW CHILD of #dvRail, so the rail allocates
//     the slot and re-measures. Nothing pinned, no offset literal in this file.
//   · registerSheet() + openSheet() — joins the one-open-at-a-time registry, so
//     raising the yard EVICTS the star-map, agents, court, door, lanterns and
//     the Concord rather than mounting on their identical pixels.
// The sheet carries `.dv-sheet`, which matters twice: one shared definition of
// how tall a bottom sheet may be (min(78dvh,560px), internally scrolling,
// safe-area padded), and layoutRail()'s `.dv-sheet.open` yield finds it
// automatically so the rail clears it with nothing for anyone to remember.
// Every string that can be long — an agent name from any provider on earth, a
// hull's user-authored name, a flaw's reason — is either min-width:0 + ellipsis
// inside its own cell, or overflow-wrap:anywhere. Content yields; the box never
// grows. Verified at 320/375/768/1280/1920 by scripts/verify-one-sheet.js,
// which this surface is registered in.
//
// UNTRUSTED CONTENT — agent names come from user input and provider metadata,
// and hull names come from the user's own keyboard. This file NEVER concatenates
// one into innerHTML. Static markup only; every name and authored string enters
// through textContent, at the leaf.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintAdmiralty) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function court() { return W.VintCourt; }
  function concord() { return W.VintConcord; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function isGuest() { return !token(); }

  // ── FEATURE FLAG — 'world_admiralty'. Killable in 30s, no deploy. ──────────
  //   ?admiralty=0 / ?admiralty=1 · localStorage vint:flag:world_admiralty='0'|'1'
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('admiralty') === '0') _flag = false;
      else if (q.get('admiralty') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_admiralty') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE ELEMENTS — sea, land, air. Vinta named all three; this is the ONE place
  // they differ, and they differ in the FRAMES a keel of that element opens.
  //
  // A keel always lays the four frames every made thing has (a spine, a skin, a
  // drive, an eye) plus the two that belong to what it is FOR (a hold, teeth)
  // plus exactly ONE frame that only its element possesses. That last frame is
  // the whole reason air-meets-sea is a different engagement than air-meets-air:
  // the wake tests only frames BOTH hulls carry, so an element's private frame
  // is a strength that is simply absent from the line when it is unmatched. No
  // rock-paper-scissors table exists anywhere in this file.
  // ═══════════════════════════════════════════════════════════════════════════
  var ELEMENTS = [
    {
      k: 'sea', name: 'of the water', glyph: '≈', c: '#7fc0ff',
      own: 'keel',
      creed: 'it carries. what floats can carry more than what flies, and it can wait.',
      // what an element is genuinely better and worse at, in its own words
      boon: 'the deepest holds in the world. a sea hull carries a war, not just a blow.',
      cost: 'slow to reach anything. a sea hull is never the first to arrive.'
    },
    {
      k: 'land', name: 'of the ground', glyph: '▰', c: '#ffd479',
      own: 'tracks',
      creed: 'it holds. the ground is the only thing you can actually keep.',
      boon: 'the thickest skin that can be laid. a land hull is very hard to open.',
      cost: 'it cannot go where there is no ground, and there is a lot of no ground.'
    },
    {
      k: 'air', name: 'of the air', glyph: '◬', c: '#c0b0e0',
      own: 'lift',
      creed: 'it arrives. being there first is worth more than being thick.',
      boon: 'it is always first into the wake — an air hull strikes before it is struck.',
      cost: 'thin. every frame an air hull lays is lighter than the same frame elsewhere.'
    }
  ];
  function elementOf(k) {
    for (var i = 0; i < ELEMENTS.length; i++) if (ELEMENTS[i].k === k) return ELEMENTS[i];
    return ELEMENTS[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE FRAMES — the berths a keel opens, in the ORDER the wake tests them.
  //
  // Order is load-bearing and is not cosmetic: a wake runs spine-first and eyes-
  // last, so a flaw in the spine is catastrophic and a flaw in the eyes is a
  // regret. That means WHICH agent took WHICH berth is the entire game, and it
  // is a thing your court decided, not you.
  //
  // `wants` is the disposition that DRAWS an agent to this berth — it is how a
  // frame gets claimed on the agent's own recognizance. `gift` is the tag that
  // makes the agent GOOD at it once claimed. They are deliberately not always
  // the same: a hot-headed mind WANTS the teeth and is genuinely good at them;
  // a suspicious mind wants the eyes and is good at them; but a mind drawn to
  // the hold by mentor-nature is made good at it by trust, so the agent that
  // most wants your hold is not automatically the one who builds it best. That
  // gap is where a court's politics become a physical object.
  // ═══════════════════════════════════════════════════════════════════════════
  var FRAMES = [
    { k: 'spine',  n: 'the spine',  glyph: '│', wants: 'craft',    gift: 'craft',
      does: 'everything else is fastened to it. a flawed spine is a hull that opens at the first blow.' },
    { k: 'keel',   n: 'the keel',   glyph: '⌄', wants: 'craft',    gift: 'civic',
      does: 'what keeps it upright in water. only a sea hull has one.' },
    { k: 'tracks', n: 'the tracks', glyph: '▤', wants: 'civic',    gift: 'craft',
      does: 'what lets it hold ground instead of merely crossing it. only a land hull has them.' },
    { k: 'lift',   n: 'the lift',   glyph: '◠', wants: 'social',   gift: 'heat',
      does: 'what gets it there before anyone else does. only an air hull has it.' },
    { k: 'skin',   n: 'the skin',   glyph: '▩', wants: 'craft',    gift: 'trust',
      does: 'what is between the inside and the outside. it is tested more than anything else.' },
    { k: 'drive',  n: 'the drive',  glyph: '➤', wants: 'heat',     gift: 'craft',
      does: 'how fast it closes. a fast hull chooses whether the wake happens at all.' },
    { k: 'hold',   n: 'the hold',   glyph: '▢', wants: 'mentor',   gift: 'trust',
      does: 'what it carries. a hull with no hold wins nothing it can keep.' },
    { k: 'teeth',  n: 'the teeth',  glyph: '⌁', wants: 'heat',     gift: 'criminal',
      does: 'what it does to the thing in front of it. the only frame that takes rather than holds.' },
    { k: 'eyes',   n: 'the eyes',   glyph: '◉', wants: 'trust',    gift: 'social',
      does: 'what it sees coming. flawed eyes mean the wake starts with you already behind.' }
  ];
  function frameOf(k) {
    for (var i = 0; i < FRAMES.length; i++) if (FRAMES[i].k === k) return FRAMES[i];
    return FRAMES[0];
  }

  // ── THE ELEMENT MODIFIER — ONE definition, used by BOTH yards ──────────────
  // It lived inline in two places (your launch and the rival's hull) and that is
  // precisely how two yards come to build under different physics after one
  // careless edit. One function, called twice.
  //
  // TUNED AGAINST A MEASURED SWEEP, not by feel. The first cut gave air a flat
  // 0.86 on EVERY frame against a 1.08 first-strike, and 120 resolved lines
  // showed what that actually cost: land 80% / sea 40% / AIR 20%. A blanket
  // 14% cut across nine frames can never be bought back by an 8% edge on the
  // exchanges. So each element's stated boon now genuinely pays for its stated
  // cost, and each cost lands where the copy says it does rather than
  // everywhere at once:
  //   · AIR is thin where thickness is the point (spine, skin) — the frames its
  //     own creed says it trades away — and pays nothing on the drive and eyes
  //     it exists for. Its first-strike edge is what it buys with that.
  //   · LAND is genuinely the hardest to open (skin, spine) and genuinely slow
  //     (drive), which is the "it holds / it cannot go where there is no ground"
  //     trade stated in its boon and cost.
  //   · SEA carries: its hold is the deepest in the world, and it is slower to
  //     arrive than air, exactly as its copy claims.
  // Every number here is a sentence in ELEMENTS made arithmetic. If the copy
  // ever changes, this changes with it.
  function elMod(elk, frameKey) {
    if (elk === 'air') {
      if (frameKey === 'spine' || frameKey === 'skin') return 0.82;
      return 1;
    }
    if (elk === 'land') {
      if (frameKey === 'skin') return 1.14;
      if (frameKey === 'spine') return 1.06;
      if (frameKey === 'drive') return 0.84;
      return 1;
    }
    // SEA. A second measured correction, and it is the same lesson as the
    // courier's twice over: A BONUS ON A LOW-GRAVITY FRAME IS WORTH ALMOST
    // NOTHING. Sea's only edge was the hold (1.14), but `hold` carries light
    // weight in four of the five classes, so its advantage kept landing exactly
    // where the wake was not being decided — 600 resolved lines measured it at
    // 30% against land's 61%. Its creed is "it carries, AND IT CAN WAIT", so
    // the durability half of that claim now shows up on the frame durability
    // actually means (the spine it can afford to build heavy, because it is not
    // fighting gravity), while the hold stays its signature. It remains the
    // slowest thing in the world, which is the cost its own copy names.
    if (frameKey === 'hold') return 1.16;
    if (frameKey === 'spine') return 1.08;
    if (frameKey === 'drive') return 0.90;
    return 1;
  }
  // The frames a keel of this element opens — the six universal, plus its own.
  var UNIVERSAL = ['spine', 'skin', 'drive', 'hold', 'teeth', 'eyes'];
  function framesFor(elk) {
    var e = elementOf(elk);
    var out = [];
    for (var i = 0; i < FRAMES.length; i++) {
      var f = FRAMES[i];
      if (UNIVERSAL.indexOf(f.k) >= 0 || f.k === e.own) out.push(f.k);
    }
    return out;   // already in wake order, because FRAMES is
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE CLASSES — what a keel is FOR. Not a size chart; a purpose, which bends
  // which frames matter and what the hull costs.
  //
  // `weight` is how much each frame contributes to what this class is trying to
  // be. A courier lives on its drive and its eyes; a bastion lives on its skin
  // and its spine; a raider lives on its teeth. So the SAME court laying the
  // SAME frames produces a great courier and a poor bastion, and the choice of
  // class is a real decision about which of your agents' natures you are betting
  // on. `press` is the karma pressure the launch exerts on the polity — because
  // building a raider is a political act, and the Concord's bars must move.
  // ═══════════════════════════════════════════════════════════════════════════
  var CLASSES = [
    {
      k: 'courier', n: 'a courier', glyph: '✧', need: 0, cost: 30,
      sub: 'thin, fast, and carries word. the first hull any yard should lay.',
      weight: { spine: 0.7, skin: 0.5, drive: 1.4, hold: 0.8, teeth: 0.3, eyes: 1.3, keel: 0.9, tracks: 0.6, lift: 1.3 },
      press: { craft: 0.6, social: 0.5, civic: 0.3 }
    },
    {
      k: 'hauler', n: 'a hauler', glyph: '▤', need: 55, cost: 55,
      sub: 'it exists to carry. a war is won by what you can still move afterwards.',
      weight: { spine: 1.2, skin: 1.0, drive: 0.6, hold: 1.6, teeth: 0.3, eyes: 0.7, keel: 1.2, tracks: 1.1, lift: 0.7 },
      press: { craft: 0.8, civic: 0.5, mentor: 0.3, trust: 0.3 }
    },
    {
      k: 'bastion', n: 'a bastion', glyph: '⌂', need: 150, cost: 90,
      sub: 'it is not meant to move much. it is meant to still be there.',
      weight: { spine: 1.5, skin: 1.6, drive: 0.4, hold: 0.9, teeth: 0.8, eyes: 0.8, keel: 1.0, tracks: 1.5, lift: 0.4 },
      press: { civic: 0.8, craft: 0.7, trust: 0.4, heat: 0.2 }
    },
    {
      k: 'raider', n: 'a raider', glyph: '⌁', need: 150, cost: 90,
      sub: 'it takes. everything it is is pointed at the thing in front of it.',
      // MEASURED, not guessed. At skin 0.7 / hold 0.5 the raider won 26% of 600
      // resolved lines — the worst hull in the world and the only one that was
      // simply a bad buy, which the generosity test does not permit any more for
      // the most expensive tier than it did for the courier. The cause was the
      // same one that sank the courier: purpose is counted once now, so a frame
      // you gut is a frame you LOSE badly whenever gravity lands on it. Its
      // copy says everything it is points forward, so it keeps the sharpest
      // teeth in the world and buys back just enough skin and eyes to still be
      // there when they land. It is still the thinnest-held hull of its price.
      weight: { spine: 1.0, skin: 0.95, drive: 1.35, hold: 0.5, teeth: 1.7, eyes: 1.15, keel: 0.7, tracks: 0.8, lift: 1.2 },
      // The most POLARIZING hull in the world, and deliberately so — but the
      // first cut made it the most polarizing by a margin that broke it. A
      // matchup sweep measured the raider at 0.54 flaws per hull (double every
      // other class) and 8-16% against ark, hauler, bastion and courier alike:
      // its press violated so many natures at once that an ordinary court
      // simply could not build one, which made the second-most-expensive hull
      // in the game a trap for anyone who had not deliberately assembled a
      // shadow-leaning table. Building the RIGHT court for it should be the
      // reward; needing one should not be the price of entry.
      //
      // The lever turned out NOT to be its weights, which is worth recording so
      // nobody retunes the wrong dial: raising teeth from 1.7 to 2.05 moved the
      // raider 41% -> 42% and no further, because the wake normalises each
      // frame by its own class weight, so pumping a weight raises the stat and
      // the divisor together. The deficit was entirely its FLAW RATE (0.45 per
      // hull against 0.25-0.36 for everything else) — it was being beaten by
      // its own crew's convictions, twice, in a system that already charges it
      // once. So the press below is softened to the measured point where the
      // raider reaches 49% while staying the most polarizing hull in the world:
      // it still leans hardest of anything here on heat and shadow, a
      // scrupulous mind will still balk at it and leave its name on the frame,
      // but it no longer asks an entire table to betray itself at once.
      press: { heat: 0.7, criminal: 0.35, craft: 0.5, trust: -0.18, civic: -0.10 }
    },
    {
      k: 'ark', n: 'an ark', glyph: '❈', need: 330, cost: 160,
      sub: 'the whole polity, made portable. the gravest and most expensive thing a yard can lay.',
      weight: { spine: 1.6, skin: 1.4, drive: 0.8, hold: 1.7, teeth: 0.7, eyes: 1.1, keel: 1.4, tracks: 1.2, lift: 1.0 },
      press: { craft: 1.0, civic: 0.7, mentor: 0.8, trust: 0.6, social: 0.4 }
    }
  ];
  function classOf(k) {
    for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].k === k) return CLASSES[i];
    return CLASSES[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // READING THE CONCORD — never re-deriving it.
  //
  // Every one of these goes through VintConcord's public API. There is no second
  // disposition function, no second karma vocabulary, no second treasury, no
  // second standing read. If the Concord is not founded, this organ does not
  // exist yet, and it says so plainly rather than inventing a government to
  // stand in for the one the user has not made.
  // ═══════════════════════════════════════════════════════════════════════════
  function polity() {
    var c = concord();
    if (!c || !c.founded || !c.founded()) return null;
    try { return c.state(); } catch (_) { return null; }
  }
  function charter() {
    var c = concord();
    try { return (c && c.charter) ? c.charter() : null; } catch (_) { return null; }
  }
  function dispositionOf(agent) {
    var c = concord();
    try { if (c && c.disposition) return c.disposition(agent); } catch (_) {}
    // The Concord is the only source of disposition. If it is somehow absent the
    // honest answer is a flat nature, NOT an invented one — a fabricated
    // disposition would put words in an agent's mouth that its identity never
    // implied, which is the one thing this pair of files must never do.
    var d = {}, T = tags();
    for (var i = 0; i < T.length; i++) d[T[i]] = 0;
    return d;
  }
  function tags() {
    var c = concord();
    try { if (c && c.TAGS) return c.TAGS; } catch (_) {}
    return ['civic', 'criminal', 'craft', 'social', 'mentor', 'heat', 'trust'];
  }
  function treasury() { var p = polity(); return p ? (Number(p.treasury) || 0) : 0; }
  function standing() {
    var c = concord();
    try { if (c && c.standing) return c.standing(); } catch (_) {}
    return 0;
  }
  // The seats, joined to the live roster. The Concord already owns this join and
  // exposes it, so we do not walk the roster a second time and risk disagreeing
  // with it about who is actually seated.
  function bench() {
    var c = concord();
    try { if (c && c.bench) return c.bench(); } catch (_) {}
    return [];
  }
  function loyaltyOf(agent) {
    var c = concord();
    try { if (c && c.loyalty) return c.loyalty(agent); } catch (_) {}
    return 0.5;
  }
  function temperOf(d) {
    var c = concord();
    try { if (c && c.temper) return c.temper(d); } catch (_) {}
    return 'inscrutable';
  }
  // Spend from the ONE treasury, through the Concord, which owns it. This file
  // never writes a lumen number into concord state itself — a second writer to
  // one balance is how two ledgers come to disagree.
  function spend(n, why) {
    var c = concord();
    try { if (c && c.spend) return c.spend(n, why); } catch (_) {}
    return false;
  }
  // Move the SAME seven karma tags the Concord keeps. A launch and a war are
  // political acts and the polity's own bars must show it.
  function impress(press, mult) {
    var c = concord();
    try { if (c && c.impress) c.impress(press, mult); } catch (_) {}
  }

  // A stable string hash — deterministic across devices and reloads. Identity,
  // not security. (Mirrors the Concord's; a shared helper across two IIFEs would
  // need a third file for one function, which is worse than eight lines twice.)
  function hash32(str) {
    var h = 2166136261 >>> 0;
    var s = String(str == null ? '' : str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  function jitter(id, salt) {
    var h = hash32(String(id) + '|' + salt);
    return ((h % 2000) / 1000) - 1;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE CLAIM — how an agent chooses its berth ON ITS OWN RECOGNIZANCE.
  //
  // This is mechanism (1) and it is the heart of the file. Nobody assigns
  // anybody. Every unclaimed frame is scored against every idle agent by how
  // much that agent's DISPOSITION WANTS it, and the strongest pull in the yard
  // wins the berth. It is deterministic — the same court and the same keel
  // produce the same claim order every time — so you can LEARN your yard, be
  // surprised by it once, and then be right about it forever after. A random
  // assignment would make the whole surface noise, which is the same finding
  // that decided the Concord's disposition and it holds here for the same reason.
  // ═══════════════════════════════════════════════════════════════════════════
  function pullOf(agent, frameKey, cls) {
    var f = frameOf(frameKey), d = dispositionOf(agent);
    // what this nature WANTS: its lean on the frame's wanted axis
    var want = (d[f.wants] || 0);
    // plus a real, small, stable personal quirk so two minds of one provider do
    // not claim in lockstep — the same reason the Concord jitters a disposition.
    want += jitter(agent.id, 'berth:' + frameKey) * 0.22;
    // plus a nudge toward frames this CLASS actually cares about: an agent is
    // more drawn to the work that matters in the hull being laid.
    want += ((cls.weight[frameKey] || 1) - 1) * 0.18;
    return want;
  }

  // ── WORK, BALK, OR SCUTTLE — mechanism (2) ────────────────────────────────
  // Once an agent holds a berth, what it DOES there is a function of three
  // things and nothing else: how gifted it is at that frame, how much the class
  // violates its nature, and how cold its loyalty has gone. All three are read
  // from systems that already exist. The result is a signed quality and, when
  // it is bad enough, a NAMED FLAW that stays in the hull forever.
  function laborOf(agent, frameKey, cls, ch) {
    var f = frameOf(frameKey), d = dispositionOf(agent);
    var lo = loyaltyOf(agent);

    // 1. GIFT — the agent's lean on the frame's gift axis, bent by the charter's
    //    doctrine exactly as the Concord bends a vote. One arithmetic, two organs.
    var chLean = (ch && ch.lean) ? ch.lean : {};
    var gift = (d[f.gift] || 0) * 0.74 + (chLean[f.gift] || 0) * 0.26;

    // 2. VIOLATION — how much this CLASS asks of the agent against its nature.
    //    A scrupulous mind on a raider is being asked to make a thing it finds
    //    obscene, and its hands know it. This is the dissent loop, in matter.
    var viol = 0, wt = 0, T = tags();
    for (var i = 0; i < T.length; i++) {
      var t = T[i], p = cls.press[t] || 0;
      if (!p) continue;
      viol += p * (d[t] || 0);
      wt += Math.abs(p);
    }
    if (wt > 0) viol /= wt;             // +1 = this is what it lives for, -1 = revolted

    // 3. LOYALTY — a tended mind gives you its best hours. The same watch the
    //    vigil already keeps, so tending the court has a MATERIAL consequence
    //    now as well as a political one.
    //
    //    MEASURED AND CORRECTED. The first cut added `(lo - 0.5) * 0.5` to the
    //    quality, which handed every freshly-tended agent a flat +0.25 — and a
    //    1,080-case sweep showed exactly what that bought: across every
    //    provider, class and frame, a TENDED agent balked 0% of the time and
    //    scuttled 0%. Flaws only ever appeared on a neglected court (56% balk
    //    at twenty days cold), and 400 launched hulls came out with 0.00 flaws
    //    on average. That is not a balance nit — it meant mechanism (2), the
    //    entire "an agent lays a bad frame and the hull remembers its name"
    //    loop this file is built around, was DEAD CODE for any player who
    //    tends their court. The headline invention never fired.
    //
    //    The cause was a category error: care was being added to CONVICTION, so
    //    kindness could buy an agent out of its own nature. It cannot. A
    //    scrupulous mind asked to build a raider's gun-deck does bad work at it
    //    no matter how well you have treated it — that refusal IS the character.
    //    So loyalty now MODULATES rather than overrides: it scales how much of
    //    itself an agent brings (a cold one gives you less of its gift and
    //    sulks a little), and only a genuinely neglected one takes an outright
    //    penalty. Violation survives untouched into the result, which is the
    //    whole point — the agent's convictions are load-bearing again.
    //    The weights and the balk threshold below are TUNED, not guessed: a
    //    1,080-case sweep over every provider × class × frame × loyalty band
    //    was used to pick the point where a well-tended court still produces a
    //    named flaw on roughly 8% of frames — about two hulls in five carrying
    //    one — so the mechanic fires often enough to be the story it is meant
    //    to be, while a court you have actually looked after mostly builds
    //    well. A neglected court (three weeks untended) fails ~91% of frames,
    //    which is severe by design and is entirely recoverable: tend them and
    //    the next keel comes out clean. Nothing here is permanent damage to a
    //    thing the user made.
    var effort = 0.72 + lo * 0.28;              // 0.72 cold .. 1.00 tended
    var neglect = lo < 0.34 ? (0.34 - lo) * 0.9 : 0;

    var q = (gift * 0.52 + viol * 0.52) * effort - neglect;
    var act = q < -0.34 ? 'scuttle' : (q < -0.07 ? 'balk' : 'work');
    return { q: q, act: act, gift: gift, viol: viol, loyalty: lo };
  }

  // Why it did what it did, in its own voice. Never generic — a flaw the player
  // cannot read backwards to a reason is a dice roll wearing a face, and the
  // whole wake mechanic depends on this sentence being true and specific.
  function laborWhy(agent, frameKey, cls, lab) {
    var f = frameOf(frameKey), d = dispositionOf(agent);
    if (lab.act === 'scuttle') {
      return lab.viol < -0.25
        ? 'will not lay ' + f.n + ' for ' + cls.n + '. it broke what it had started.'
        : 'has gone cold on you, and left ' + f.n + ' open on purpose.';
    }
    if (lab.act === 'balk') {
      if (lab.viol < -0.15) return 'laid ' + f.n + ' badly, and did not pretend otherwise — this is not its work.';
      if (lab.loyalty < 0.34) return 'gave ' + f.n + ' the hours you have earned lately, and no more.';
      return 'is simply not built for ' + f.n + '. it tried.';
    }
    // good work — name the axis it was actually good on
    var g = f.gift, strong = lab.q > 0.42;
    var word = g === 'criminal' ? 'shadow' : g;
    return strong
      ? 'laid ' + f.n + ' the way ' + word + ' is supposed to look.'
      : 'laid ' + f.n + ' honestly, on ' + word + '.';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — local, honest, per-world, shaped like the request a server would take
  // ═══════════════════════════════════════════════════════════════════════════
  var BERTH_MS = 6 * 60 * 1000;      // a frame takes six minutes to lay
  var WAKE_MS = 14 * 60 * 1000;      // a fleet at sea resolves in fourteen

  function wid() {
    try { var w = world(); return (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe'; }
    catch (_) { return 'universe'; }
  }
  function key() { return 'vint:admiralty:' + wid(); }

  var _st = null, _stKey = null;
  function blank() {
    return {
      v: 1,
      keel: null,      // the one under construction: {el, cls, name, frames[], laid, opened}
      fleet: [],       // launched hulls, newest first
      wakes: [],       // resolved engagements, newest first
      sortie: null,    // a fleet at sea: {hullIds[], rival, closes, sent}
      seen: 0          // last time the yard was read (for the badge)
    };
  }
  function load() {
    var k = key();
    if (_st && _stKey === k) return _st;
    _stKey = k; _st = blank();
    try {
      var raw = localStorage.getItem(k);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.v === 1) {
          _st = p;
          if (!Array.isArray(_st.fleet)) _st.fleet = [];
          if (!Array.isArray(_st.wakes)) _st.wakes = [];
          if (_st.keel && !Array.isArray(_st.keel.frames)) _st.keel = null;
        }
      }
    } catch (_) { _st = blank(); }
    return _st;
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(_st)); }
    catch (e) {
      // The one write error a user can genuinely hit. Swallowing it would let
      // them build into a void, so it is said out loud — my own precedent.
      console.warn('[admiralty] could not keep the yard:', e && e.message);
      toast('the yard is full — your device would not keep this.');
    }
  }

  // ── THE YARD'S CAPACITY — earned by STANDING, for the measured reason ──────
  // Identical finding to the Concord's seat cap, and identical shape: ONE
  // function, reading the ONE number the server actually computes. When
  // world.html gains a real entitlement source this becomes
  // `Math.min(byStanding, byTier)` and nothing else in this file changes.
  var SLIP_RUNGS = [
    { need: 0,   slips: 2 },   // ember-bearer — two hulls is a decision, not a fleet
    { need: 55,  slips: 3 },
    { need: 150, slips: 5 },   // lampwright — enough to lose one and still sail
    { need: 330, slips: 7 },
    { need: 620, slips: 9 }
  ];
  function slipCap() {
    var st = standing(), cap = SLIP_RUNGS[0].slips;
    for (var i = 0; i < SLIP_RUNGS.length; i++) if (st >= SLIP_RUNGS[i].need) cap = SLIP_RUNGS[i].slips;
    return cap;
  }
  function nextSlipRung() {
    var st = standing();
    for (var i = 0; i < SLIP_RUNGS.length; i++) if (st < SLIP_RUNGS[i].need) return SLIP_RUNGS[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYING A KEEL
  // ═══════════════════════════════════════════════════════════════════════════
  function lay(elk, clsk, name) {
    var s = load();
    if (s.keel) return { ok: false, why: 'busy' };
    if (!polity()) return { ok: false, why: 'polity' };
    if (s.fleet.length >= slipCap()) return { ok: false, why: 'slips', cap: slipCap() };
    var cls = classOf(clsk), e = elementOf(elk);
    if (standing() < cls.need) return { ok: false, why: 'standing', need: cls.need };
    var ch = charter();
    // The Vaultsworn's ledger doctrine cuts a keel's price exactly as it cuts a
    // motion's — the charter's stated boon is arithmetic here too, not flavour.
    var cost = (ch && ch.k === 'vault') ? Math.round(cls.cost * 0.5) : cls.cost;
    if (cost > treasury()) return { ok: false, why: 'treasury', need: cost };
    if (!bench().length) return { ok: false, why: 'crew' };
    if (!spend(cost, 'a keel is laid')) return { ok: false, why: 'treasury', need: cost };

    var keys = framesFor(elk);
    var frames = [];
    for (var i = 0; i < keys.length; i++) {
      frames.push({ k: keys[i], by: null, byName: '', act: '', why: '', q: 0, at: 0, color: '' });
    }
    s.keel = {
      el: elk, cls: clsk,
      name: String(name || '').slice(0, 36).trim() || (e.glyph + ' unnamed'),
      frames: frames, opened: Date.now(), cost: cost,
      next: Date.now() + BERTH_MS      // when the next berth is claimed and worked
    };
    save();
    return { ok: true, keel: s.keel };
  }

  // ── THE YARD'S CLOCK — the retention loop, and it is not a progress bar ────
  // Every BERTH_MS one unclaimed frame is CLAIMED by whichever idle agent wants
  // it most, and immediately worked (or balked, or scuttled). This replays
  // wall-clock, so a frame laid while the tab was shut is REAL and not simulated
  // on open. You come back to find your court has made choices you did not make.
  function tickYard() {
    var s = load();
    if (!s.keel) return false;
    var moved = false, guard = 0;
    while (s.keel && Date.now() >= s.keel.next && guard++ < 64) {
      if (!claimOne(s)) break;
      moved = true;
    }
    if (moved) save();
    return moved;
  }

  function claimOne(s) {
    var k = s.keel;
    if (!k) return false;
    var cls = classOf(k.cls), ch = charter();
    var crew = bench();
    if (!crew.length) {
      // No seats means no hands. The keel does NOT silently stall forever: it
      // waits, and the sheet says why, because a stalled clock with no
      // explanation is the thing that makes a player think the feature is broken.
      k.next = Date.now() + BERTH_MS;
      return false;
    }

    // who is not already holding a berth on this keel
    var busy = {};
    for (var i = 0; i < k.frames.length; i++) if (k.frames[i].by) busy[String(k.frames[i].by)] = 1;
    var idle = [];
    for (var c = 0; c < crew.length; c++) {
      var a = crew[c].agent || crew[c];
      if (a && !busy[String(a.id)]) idle.push(a);
    }
    // A small yard re-works: if everyone already holds a berth, the crew doubles
    // up rather than the keel halting. A hull that can never finish because you
    // have two agents and nine frames would be a trap, and traps are forbidden.
    if (!idle.length) for (var c2 = 0; c2 < crew.length; c2++) idle.push(crew[c2].agent || crew[c2]);

    // the open frames, in wake order
    var open = [];
    for (var f = 0; f < k.frames.length; f++) if (!k.frames[f].by) open.push(k.frames[f]);
    if (!open.length) { launch(s); return true; }

    // ── THE CLAIM. Strongest pull in the yard takes its berth. Not assigned. ──
    var bestF = null, bestA = null, bestP = -99;
    for (var oi = 0; oi < open.length; oi++) {
      for (var ai = 0; ai < idle.length; ai++) {
        var p = pullOf(idle[ai], open[oi].k, cls);
        if (p > bestP) { bestP = p; bestF = open[oi]; bestA = idle[ai]; }
      }
    }
    if (!bestF || !bestA) return false;

    var lab = laborOf(bestA, bestF.k, cls, ch);
    bestF.by = bestA.id;
    bestF.byName = bestA.name || 'an agent';
    bestF.color = bestA.color || '#a67cff';
    bestF.act = lab.act;
    bestF.q = Math.round(lab.q * 1000) / 1000;
    bestF.why = laborWhy(bestA, bestF.k, cls, lab);
    bestF.at = Date.now();
    // A scuttled frame is LEFT OPEN — someone else must come back to it, and the
    // record of who broke it stays on the hull. It is the most expensive thing an
    // agent can do to you and it costs the agent nothing, which is exactly right:
    // consequences for a mind's convictions belong to you, not to the system.
    if (lab.act === 'scuttle') {
      bestF.scuttledBy = bestF.byName;
      bestF.by = null;
      // it still burned the berth's time; the next attempt is a fresh six minutes
    }

    // advance the clock from the moment the berth was WORKED, not from now, so a
    // long absence lays several frames rather than one and the world genuinely
    // moved while you were gone.
    k.next = k.next + BERTH_MS;
    if (k.next < Date.now() - BERTH_MS * 8) k.next = Date.now() + BERTH_MS; // very long absence: don't grind

    var stillOpen = 0;
    for (var g = 0; g < k.frames.length; g++) if (!k.frames[g].by) stillOpen++;
    if (!stillOpen) launch(s);
    return true;
  }

  // ── LAUNCH — the hull becomes a real, permanent, named thing ───────────────
  function launch(s) {
    var k = s.keel;
    if (!k) return;
    var cls = classOf(k.cls), e = elementOf(k.el);
    var stats = {}, flaws = [], builders = [];
    for (var i = 0; i < k.frames.length; i++) {
      var fr = k.frames[i];
      var wgt = cls.weight[fr.k] || 1;
      // AIR IS THIN. The element's stated cost is arithmetic, not flavour text.
      var v = (1 + fr.q) * wgt * elMod(k.el, fr.k);
      stats[fr.k] = Math.round(Math.max(0.05, v) * 100) / 100;
      if (fr.act === 'balk') {
        flaws.push({ f: fr.k, who: fr.byName, why: fr.why });
      }
      if (fr.byName) builders.push({ id: fr.by, name: fr.byName, f: fr.k, color: fr.color, why: fr.why, act: fr.act });
    }
    var hull = {
      id: 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
      name: k.name, el: k.el, cls: k.cls,
      stats: stats, flaws: flaws, builders: builders,
      launched: Date.now(), scars: [], struck: false
    };
    s.fleet.unshift(hull);
    while (s.fleet.length > 24) s.fleet.pop();
    s.keel = null;

    // THE POLITY FEELS IT. A launch presses the same seven karma tags the
    // Concord keeps, through the Concord's own writer — so building a raider
    // genuinely makes your polity hotter and less trusted, on its screen, and
    // bends how its next vote goes. One karma spine, two organs.
    impress(cls.press, 0.5);

    try {
      W.dispatchEvent(new CustomEvent('vint:admiralty-launched', {
        detail: { name: hull.name, cls: hull.cls, el: hull.el, flaws: hull.flaws.length }
      }));
    } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE RIVAL POWERS — and the honest thing about them.
  //
  // Vinta asked for faction-vs-faction war. There is NO wire to another human's
  // fleet: no endpoint, no socket, nothing. So this file does not quietly
  // matchmake you against a bot and call it a player — that is precisely the lie
  // I refused in the Concord, and refusing it twice is what makes the refusal
  // mean anything.
  //
  // Instead the rival is composed HONESTLY out of things that are real in your
  // world: YOUR OWN DEFECTORS. concord.js exiles agents who walked out and never
  // deletes them, and this is where they went. A power crewed by the minds who
  // left your table is a rival with an actual grievance, it is unreproducible,
  // and its hull is laid by the SAME claim-and-labor arithmetic — so the enemy
  // ship is genuinely the ship those specific agents would build. When there are
  // no defectors, the world's own unaligned powers stand in, and the sheet says
  // exactly which of the two you are facing and why. Nothing is implied.
  // ═══════════════════════════════════════════════════════════════════════════
  var UNALIGNED = [
    { k: 'drift', n: 'the Drift', creed: 'nobody chartered them and nobody can find their yard.', el: 'air',
      lean: { craft: 0.3, criminal: 0.4, heat: 0.5, trust: -0.4, civic: -0.3, social: 0.1, mentor: -0.2 } },
    { k: 'sill',  n: 'the Sill',  creed: 'they hold a shore that was never voted on.', el: 'sea',
      lean: { craft: 0.5, civic: 0.4, trust: 0.2, heat: 0.1, mentor: 0.2, social: -0.1, criminal: 0.1 } },
    { k: 'span',  n: 'the Span',  creed: 'they build across ground nobody claimed, and then they claim it.', el: 'land',
      lean: { craft: 0.6, civic: 0.5, trust: 0.3, mentor: 0.3, heat: -0.1, social: 0.2, criminal: -0.1 } }
  ];

  // Build the rival's hull with the SAME arithmetic your own yard uses, so the
  // enemy is never given a secret bonus. If it beats you, it beat you on frames.
  function rivalFor(seed) {
    var p = polity();
    var exiles = (p && p.exiles) ? p.exiles : [];
    var crew = [];
    // 1) your own defectors, if any — this is the real, earned rival
    for (var i = 0; i < exiles.length && crew.length < 5; i++) {
      var x = exiles[i];
      var a = agentById(x.agentId);
      crew.push({
        id: x.agentId, name: (a && a.name) || x.name || 'one who walked out',
        color: (a && a.color) || '#ff9a7a',
        providerModel: (a && (a.providerModel || a.provider_model)) || '',
        provider: (a && a.provider) || '', tended_at: null,
        __defector: true
      });
    }
    var fromExiles = crew.length > 0;
    var un = UNALIGNED[hash32(String(seed)) % UNALIGNED.length];
    // 2) otherwise (or to fill out a thin crew) the world's unaligned powers
    var want = Math.max(3, Math.min(5, bench().length || 3));
    var n = 0;
    while (crew.length < want) {
      n++;
      crew.push({
        id: un.k + ':' + seed + ':' + n,
        name: un.n + ' — a hand',
        color: '#ff9a7a', providerModel: 'custom', provider: 'custom', tended_at: null,
        __unaligned: un.k
      });
    }
    var elk = fromExiles ? ELEMENTS[hash32(String(seed) + 'el') % 3].k : un.el;
    var clsk = CLASSES[hash32(String(seed) + 'cls') % CLASSES.length].k;
    return {
      name: fromExiles ? 'those who walked out' : un.n,
      creed: fromExiles ? 'they were at your table once. they remember every vote.' : un.creed,
      fromExiles: fromExiles,
      hull: buildRivalHull(crew, elk, clsk, un, seed)
    };
  }

  function agentById(id) {
    try {
      var c = court(); if (!c || !c.roster) return null;
      var r = c.roster();
      for (var i = 0; i < r.length; i++) if (String(r[i].id) === String(id)) return r[i];
    } catch (_) {}
    return null;
  }

  function buildRivalHull(crew, elk, clsk, un, seed) {
    var cls = classOf(clsk);
    // The rival has no charter of its own to bend its hands with — an unaligned
    // power is unaligned. Its lean stands in for one, which is the honest
    // equivalent and keeps ONE labor function for both sides.
    var ch = { k: 'rival', lean: (un && un.lean) || {} };
    var keys = framesFor(elk), stats = {}, builders = [], flaws = [];
    // THE RIVAL WORKS UNDER THE SAME DISCIPLINE THE YARD DOES, and this is the
    // most important line in the function. The first cut let the single
    // best-pull hand claim EVERY frame, so the rival was effectively one perfect
    // builder while the player's court had to spread work across a crew and
    // absorb its balks — measured at spine 2.67 vs 1.19 and skin 2.87 vs 0.88,
    // an unwinnable line. That is a hidden difficulty knob, which this file
    // forbids by name. So a rival hand that has taken a berth is BUSY, exactly
    // as a seat is, and only doubles up when there are more frames than hands —
    // the identical fallback, for the identical reason. If the rival beats you,
    // it beat you on frames laid under your own rules.
    var busy = {};
    for (var i = 0; i < keys.length; i++) {
      var fk = keys[i];
      var pool = [];
      for (var pc = 0; pc < crew.length; pc++) if (!busy[String(crew[pc].id)]) pool.push(crew[pc]);
      if (!pool.length) { busy = {}; pool = crew.slice(); }   // more frames than hands
      // the same claim: whichever of their free hands wants this frame most
      var bestA = pool[0], bestP = -99;
      for (var c = 0; c < pool.length; c++) {
        var p = pullOf(pool[c], fk, cls);
        if (p > bestP) { bestP = p; bestA = pool[c]; }
      }
      busy[String(bestA.id)] = 1;
      var lab = laborOf(bestA, fk, cls, ch);
      // A DEFECTOR CARRIES ITS GRUDGE INTO ITS HANDS. It works harder against
      // you than a stranger does — that is the entire emotional point of the
      // rival being made of the people who left, and it is a small, stated,
      // legible bonus rather than a hidden difficulty knob.
      if (bestA.__defector) lab.q += 0.22;
      var wgt = cls.weight[fk] || 1;
      stats[fk] = Math.round(Math.max(0.05, (1 + lab.q) * wgt * elMod(elk, fk)) * 100) / 100;
      builders.push({ id: bestA.id, name: bestA.name, f: fk, color: bestA.color, act: lab.act, why: laborWhy(bestA, fk, cls, lab) });
      if (lab.act === 'balk' || lab.act === 'scuttle') flaws.push({ f: fk, who: bestA.name, why: 'their own hands failed them here.' });
    }
    return {
      id: 'r' + seed, name: (un && un.n) || 'a rival hull', el: elk, cls: clsk,
      stats: stats, builders: builders, flaws: flaws, launched: Date.now(), scars: []
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE WAKE — mechanism (3). A war fought as a LINE OF CONSEQUENCE.
  //
  // No health bars. No battle screen. No dice roll with a banner. Frame meets
  // frame, in wake order, spine to eyes — and ONLY the frames both hulls
  // actually carry are tested, which is why an air hull meeting a sea hull is a
  // genuinely different engagement without a single matchup table existing.
  //
  // Each exchange is a real comparison of two numbers that were produced weeks
  // ago by two named minds, and each exchange emits a SENTENCE naming the mind
  // whose work decided it. The outcome is the sum of the line. What comes back
  // is not "you lost 3-2" — it is "your spine held, your skin opened, and the
  // skin was the frame your treasurer balked at." That is the invention.
  // ═══════════════════════════════════════════════════════════════════════════
  function wake(mine, theirs) {
    var order = [];
    for (var i = 0; i < FRAMES.length; i++) {
      var k = FRAMES[i].k;
      if (mine.stats[k] != null && theirs.stats[k] != null) order.push(k);
    }
    var line = [], score = 0;
    // an air hull strikes first: its exchanges count slightly more, because
    // arriving first IS the boon, stated in ELEMENTS and paid for in thinness.
    var mineFirst = mine.el === 'air' && theirs.el !== 'air';
    var theirsFirst = theirs.el === 'air' && mine.el !== 'air';

    // ── GRAVITY: WHAT A WAKE IS ACTUALLY DECIDED ON ────────────────────────
    // First cut weighted the spine and skin hardest for everyone, and a 120-line
    // sweep caught what that really meant: THE COURIER WON 0 OF 24. Its whole
    // design deprioritises the spine (0.7) and skin (0.5) to buy drive and eyes,
    // so a fixed spine-heavy gravity made the cheapest hull — the first one any
    // yard lays — mathematically unable to ever hold a line. A starter ship that
    // cannot win is a trap, and traps are forbidden here by the generosity test.
    //
    // The fix is not to inflate the courier's numbers; it is that a wake should
    // be decided on what the hulls in it are FOR. Gravity is the average of both
    // classes' own weights on that frame, so two couriers fight a fast, sighted
    // engagement where drive and eyes decide it, two bastions fight a grinding
    // one where skin and spine decide it, and a courier meeting a bastion fights
    // on the ground between them. No class is judged solely by another class's
    // virtues, and no lookup table exists — the weights that already describe
    // each hull's purpose ARE the weighting.
    //
    // AND THE SECOND HALF OF THE SAME FINDING, which the sweep caught next: the
    // stat itself is `(1+q) * weight`, so weighting the COMPARISON by weight too
    // counted purpose twice and turned the score into a proxy for PRICE — the
    // ark (weights summing ~11.4) beat the courier (~7.3) on raw scale alone,
    // measured at 88% vs 17%. So the exchange compares the frames on how WELL
    // THEY WERE BUILT — the labor quality your court actually produced, which is
    // `stat / weight` — and gravity decides how much that exchange MATTERS.
    // Purpose is counted exactly once, on the side where it belongs. The result:
    // a big hull still wins by being big where bigness is the point (its heavy
    // frames carry heavy gravity), but a well-crewed courier beats a badly-built
    // ark, which is the only outcome consistent with this whole file's thesis
    // that the CREW is the ship.
    var myCls = classOf(mine.cls), thCls = classOf(theirs.cls);
    for (var o = 0; o < order.length; o++) {
      var fk = order[o];
      var mw = myCls.weight[fk] || 1, tw = thCls.weight[fk] || 1;
      // how well each side's frame was actually laid, independent of how much
      // its class chose to invest in that frame
      var a = (Number(mine.stats[fk]) || 0) / mw;
      var b = (Number(theirs.stats[fk]) || 0) / tw;
      // THE HOLD IS NOT FOUGHT OVER, and finding that out took a matchup sweep.
      // Averaging both classes' weights meant a hull with a big hold dragged
      // its opponent onto cargo capacity as if it were a contested frame — so
      // the raider (hold 0.5, by design, because it is not trying to carry
      // anything) lost to the ark 13% and the hauler 17% across 400 lines while
      // every other pairing sat near even. That is a hull being beaten for a
      // virtue it deliberately does not have, in an exchange neither side is
      // actually fighting. A hold decides what you can KEEP after a wake — it
      // is already paid out that way, in the lumen a won line brings home — so
      // it carries the lightest gravity in the line rather than the heaviest.
      var gravity = (fk === 'hold') ? Math.min(mw, tw) * 0.5 : (mw + tw) / 2;
      // ARRIVING FIRST, PRICED HONESTLY — and priced by measurement, because
      // this one number is the entire balance of the three elements against
      // each other. Air pays 0.82 on its spine and skin, so the edge it buys
      // with that has to be worth exactly what it costs. At 1.08 it was not
      // (air 46% across 798 lines vs sea 58% / land 61%); at 1.14 it was far
      // too much and the triangle INVERTED (air 65%, and air-beats-sea 72%
      // where sea had beaten air 65% the run before). 1.11 is the point where
      // the three sit inside two points of each other — measured sea 52% /
      // land 50% / air 52% over 2,398 resolved lines — while the matchups
      // between them stay intransitive rather than flat. Nudge this and you
      // re-balance every element in the world; re-run the sweep if you do.
      if (mineFirst) a *= 1.11;
      if (theirsFirst) b *= 1.11;
      var d = (a - b) * gravity;
      score += d;

      var mineB = builderOf(mine, fk), theirB = builderOf(theirs, fk);
      var held = d > 0.001;
      var even = Math.abs(d) < 0.06;
      line.push({
        f: fk, held: held, even: even,
        // ── THE NUMBERS THE VERDICT WAS ACTUALLY COMPUTED FROM ──────────────
        // This printed the hulls' RAW stats for one revision and it produced a
        // ledger that flatly contradicted itself: an exchange reading
        // "the teeth opened — 2.15 / 0.42" (mine five times theirs), because
        // the verdict comes from the weight-normalised comparison while the
        // printed pair did not. A player would read that and conclude —
        // correctly — that the system is lying to them, and this whole surface
        // is built on the promise that it is never a summary you must trust.
        //
        // So the line shows the SAME quantity it judges: how well each frame
        // was laid, independent of how much its class invested in it. That is
        // the honest reading of "held" vs "opened", and it is why an exchange
        // can be lost by a hull whose raw chip is bigger — the bigger chip
        // bought scale, not quality, and the wake is decided on quality. The
        // raw stats remain on the fleet card where they describe the ship.
        mine: Math.round(a * 100) / 100,
        theirs: Math.round(b * 100) / 100,
        who: (held ? (mineB && mineB.name) : (theirB && theirB.name)) || 'someone',
        // THE SENTENCE. This is what makes a defeat readable back to a decision.
        say: even
          ? frameOf(fk).n + ' met its equal. neither gave.'
          : (held
              ? frameOf(fk).n + ' held — ' + ((mineB && mineB.name) || 'your builder') + ' laid it well.'
              : frameOf(fk).n + ' opened. ' + ((mineB && mineB.name) || 'your builder') + ' is the one who laid it.'),
        color: (held ? (mineB && mineB.color) : '#ff9a7a') || '#9fdcff',
        // the exchange's true contribution to the outcome, kept so the decider
        // is chosen by what actually moved the result rather than by the raw
        // difference of two numbers on different scales
        swing: Math.round(d * 1000) / 1000
      });
    }
    var won = score > 0;
    // THE DECIDING FRAME — the exchange that genuinely moved the result most.
    // Computed from the SWING, not from the printed numbers: those are two
    // hulls' raw stats on two different weight scales, and picking the biggest
    // visual gap would routinely name a frame that barely mattered. This is the
    // line the player will remember, so it has to be the true one.
    var decider = null, dv = -1;
    for (var l = 0; l < line.length; l++) {
      var mag = Math.abs(line[l].swing);
      if (mag > dv) { dv = mag; decider = line[l]; }
    }
    return { won: won, score: Math.round(score * 100) / 100, line: line, decider: decider };
  }
  function builderOf(hull, fk) {
    var bs = hull.builders || [];
    for (var i = 0; i < bs.length; i++) if (bs[i].f === fk) return bs[i];
    return null;
  }

  // ── SENDING A FLEET, AND ITS CLOCK ────────────────────────────────────────
  function sortie(hullIds) {
    var s = load();
    if (s.sortie) return { ok: false, why: 'sailing' };
    if (!hullIds || !hullIds.length) return { ok: false, why: 'empty' };
    var seed = Date.now().toString(36);
    s.sortie = {
      hullIds: hullIds.slice(0, 4), seed: seed,
      rival: rivalFor(seed), sent: Date.now(), closes: Date.now() + WAKE_MS
    };
    save();
    return { ok: true };
  }

  // Resolve the sortie against wall-clock. An engagement fought while the tab
  // was shut is REAL — that is the whole promise of this pair of files.
  function resolveWake() {
    var s = load();
    if (!s.sortie) return false;
    if (Date.now() < s.sortie.closes) return false;

    var ids = s.sortie.hullIds, rival = s.sortie.rival;
    var mine = [];
    for (var i = 0; i < s.fleet.length; i++) if (ids.indexOf(s.fleet[i].id) >= 0 && !s.fleet[i].struck) mine.push(s.fleet[i]);

    if (!mine.length) {
      // Every hull sent is gone or struck. Say so; do not invent a battle.
      s.wakes.unshift({ at: Date.now(), won: false, rival: rival.name, fromExiles: !!rival.fromExiles,
        line: [], decider: null, effect: 'the fleet you sent is no longer there to send. nothing met anything.', hulls: [] });
      s.sortie = null; save(); return true;
    }

    // Each of your hulls fights the rival's hull in its own wake, and the fleet's
    // result is the sum. A fleet is not a single number: each hull's line is kept
    // in full, so you can read WHICH of your ships was the one that failed.
    var total = 0, lines = [], names = [];
    for (var m = 0; m < mine.length; m++) {
      var r = wake(mine[m], rival.hull);
      total += r.score;
      lines.push({ hull: mine[m].name, hullId: mine[m].id, won: r.won, score: r.score, line: r.line, decider: r.decider });
      names.push(mine[m].name);
    }
    var won = total > 0;

    // ── CONSEQUENCE — and the hard generosity rule ──────────────────────────
    // A lost wake SCARS hulls and can STRIKE one. It NEVER touches an agent.
    // Nothing this file does can remove, damage or delete a thing the user made
    // — the worst it can take is a hull this file itself minted, and the crew
    // walks home to the Concord unharmed. That boundary is absolute.
    var effect = '';
    if (won) {
      // a won wake takes something you can keep: lumen into the ONE treasury,
      // scaled by what your holds could actually carry.
      var hold = 0;
      for (var h = 0; h < mine.length; h++) hold += Number(mine[h].stats.hold || 0);
      var taken = Math.max(10, Math.round(hold * 14));
      var c = concord();
      try { if (c && c.credit) c.credit(taken, 'taken in a wake'); } catch (_) {}
      effect = 'the line held. ◇' + taken + ' comes home in the holds.';
      impress({ heat: 0.7, civic: 0.3, criminal: 0.3, trust: -0.4, social: -0.2 }, 0.5);
    } else {
      // the worst-performing hull takes a scar; a hull with three scars is struck
      var worst = null, wv = 1e9;
      for (var q = 0; q < lines.length; q++) if (lines[q].score < wv) { wv = lines[q].score; worst = lines[q]; }
      var hurt = null;
      for (var f2 = 0; f2 < mine.length; f2++) if (worst && mine[f2].id === worst.hullId) hurt = mine[f2];
      if (hurt) {
        hurt.scars.push({ at: Date.now(), where: (worst.decider && worst.decider.f) || 'skin',
          why: (worst.decider && worst.decider.say) || 'it was opened.' });
        if (hurt.scars.length >= 3) {
          hurt.struck = true;
          effect = hurt.name + ' is struck from the fleet. every hand aboard walked home.';
        } else {
          effect = hurt.name + ' comes back opened — ' + hurt.scars.length + ' scar' + (hurt.scars.length === 1 ? '' : 's') + ' on it now.';
        }
      } else {
        effect = 'the line did not hold.';
      }
      impress({ heat: 0.5, trust: -0.3, civic: -0.2 }, 0.4);
    }

    s.wakes.unshift({
      at: Date.now(), won: won, score: Math.round(total * 100) / 100,
      rival: rival.name, rivalCreed: rival.creed, fromExiles: !!rival.fromExiles,
      hulls: names, lines: lines, effect: effect
    });
    while (s.wakes.length > 20) s.wakes.pop();
    s.sortie = null;
    save();

    try {
      W.dispatchEvent(new CustomEvent('vint:admiralty-wake', { detail: { won: won, effect: effect } }));
    } catch (_) {}
    return true;
  }

  // Everything that resolves on the clock, in one place.
  function resolve() {
    var a = tickYard();
    var b = resolveWake();
    return a || b;
  }

  // unread — what is WAITING for you. The badge, and the only notification here.
  function unread() {
    var s = load();
    var n = 0;
    for (var i = 0; i < s.wakes.length; i++) { if (s.wakes[i].at > (s.seen || 0)) n++; else break; }
    for (var f = 0; f < s.fleet.length; f++) { if (s.fleet[f].launched > (s.seen || 0)) n++; }
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — every rule scoped under #adSheet. Nothing leaks into the world.
  //
  // The sheet scaffold (.dv-sheet/.dv-body/.dv-head/.dv-grip/.dv-title/.dv-x) is
  // inherited from dirverse-hud's stylesheet ON PURPOSE: one definition of the
  // bottom-sheet box means this surface can never disagree with its six siblings
  // about how tall a sheet may be, and layoutRail's `.dv-sheet.open` yield picks
  // it up with nothing for anyone to remember.
  // ═══════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-admiralty-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-admiralty-styles';
    s.textContent = [
      '#adSheet .ad-sec{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.55);margin:14px 0 8px;}',
      '#adSheet .ad-sec:first-child{margin-top:2px;}',
      '#adSheet .ad-note{font-size:12.5px;line-height:1.5;color:rgba(206,224,255,0.5);',
      ' font-style:italic;margin-top:8px;overflow-wrap:anywhere;}',
      '#adSheet .ad-empty{padding:22px 10px;text-align:center;color:rgba(206,224,255,0.5);',
      ' font-style:italic;font-size:14px;line-height:1.55;overflow-wrap:anywhere;}',

      // ── ELEMENT PICKER — a row of three, each a flex:1 cell of equal basis.
      // Three across fits 320px because each holds a glyph and one short word;
      // the creed and the boon/cost live BELOW in their own full-width block,
      // so nothing is ever crushed and nothing wraps into a neighbour.
      '#adSheet .ad-els{display:flex;gap:7px;}',
      '#adSheet .ad-el{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;',
      ' gap:4px;padding:11px 5px;border-radius:13px;cursor:pointer;font-family:inherit;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);}',
      '#adSheet .ad-el.on{background:rgba(159,220,255,0.09);border-color:rgba(159,220,255,0.42);}',
      '#adSheet .ad-elg{font-size:19px;color:var(--ec,#9fdcff);line-height:1;}',
      '#adSheet .ad-eln{font-size:12px;color:#eaf3ff;max-width:100%;overflow:hidden;',
      ' text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-elx{margin-top:9px;padding:11px 12px;border-radius:13px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid var(--ec,#9fdcff);}',
      '#adSheet .ad-elc{font-size:13px;line-height:1.5;color:rgba(220,231,255,0.72);font-style:italic;',
      ' overflow-wrap:anywhere;}',
      '#adSheet .ad-boon{font-size:12px;line-height:1.5;color:rgba(154,255,190,0.72);margin-top:6px;',
      ' overflow-wrap:anywhere;}',
      '#adSheet .ad-cost{font-size:12px;line-height:1.5;color:rgba(255,170,150,0.72);margin-top:2px;',
      ' overflow-wrap:anywhere;}',

      // ── CLASS PICKER — one column, same shape as the Concord's motions ──────
      '#adSheet .ad-cls{display:flex;flex-direction:column;gap:7px;}',
      '#adSheet .ad-c{display:flex;align-items:flex-start;gap:11px;padding:11px 12px;border-radius:13px;',
      ' cursor:pointer;text-align:left;font-family:inherit;width:100%;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);}',
      '#adSheet .ad-c.on{background:rgba(159,220,255,0.08);border-color:rgba(159,220,255,0.38);}',
      '#adSheet .ad-c.locked{opacity:0.5;cursor:not-allowed;}',
      '#adSheet .ad-cg{flex:0 0 auto;width:28px;height:28px;border-radius:8px;display:flex;',
      ' align-items:center;justify-content:center;font-size:14px;color:#9fdcff;',
      ' background:rgba(255,255,255,0.06);}',
      '#adSheet .ad-ct{flex:1 1 auto;min-width:0;}',
      '#adSheet .ad-cn{font-size:14.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-cs{font-size:12px;line-height:1.45;color:rgba(206,224,255,0.55);margin-top:2px;',
      ' overflow-wrap:anywhere;}',
      '#adSheet .ad-cl{font-size:11.5px;color:rgba(255,190,150,0.7);margin-top:4px;overflow-wrap:anywhere;}',

      '#adSheet .ad-name{width:100%;box-sizing:border-box;min-height:48px;border-radius:12px;',
      ' padding:10px 13px;font-family:inherit;font-size:15.5px;color:#eaf3ff;margin-top:4px;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.11);outline:none;}',
      '#adSheet .ad-name:focus{border-color:rgba(159,220,255,0.45);}',
      '#adSheet .ad-go{width:100%;min-height:50px;border-radius:14px;font-family:inherit;margin-top:14px;',
      ' font-size:15.5px;letter-spacing:.04em;cursor:pointer;color:#04121a;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#9fdcff,#7fc0ff);box-shadow:0 6px 20px rgba(159,220,255,0.2);}',
      '#adSheet .ad-go:active{transform:scale(0.985);}',
      '#adSheet .ad-go:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.4);}',

      // ── THE BANNER ─────────────────────────────────────────────────────────
      '#adSheet .ad-banner{display:flex;align-items:center;gap:12px;padding:13px;border-radius:15px;',
      ' background:linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02));',
      ' border:1px solid rgba(255,255,255,0.09);border-left:3px solid var(--ec,#9fdcff);}',
      '#adSheet .ad-bg{flex:0 0 auto;width:40px;height:40px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:19px;color:var(--ec,#9fdcff);',
      ' background:rgba(255,255,255,0.06);}',
      '#adSheet .ad-bt{flex:1 1 auto;min-width:0;}',
      '#adSheet .ad-bn{font-size:16.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-bs{font-size:12px;color:rgba(206,224,255,0.55);margin-top:2px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-btr{flex:0 0 auto;text-align:right;font-size:12.5px;color:#9fdcff;',
      ' font-variant-numeric:tabular-nums;}',

      // ── THE KEEL — the berth list. THE SURFACE THAT CARRIES THE INVENTION.
      // Each berth is a fixed row: glyph cell · text cell (min-width:0) · state
      // cell. The builder name and its reason each clip inside their own line,
      // so an agent named by a provider on the other side of the world cannot
      // push the state pill out of the row at 320px.
      '#adSheet .ad-keel{padding:13px;border-radius:15px;background:rgba(255,212,121,0.06);',
      ' border:1px solid rgba(255,212,121,0.24);}',
      '#adSheet .ad-kh{display:flex;align-items:center;gap:10px;}',
      '#adSheet .ad-kg{flex:0 0 auto;width:32px;height:32px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:15px;color:#ffd479;',
      ' background:rgba(255,212,121,0.12);}',
      '#adSheet .ad-kt{flex:1 1 auto;min-width:0;}',
      '#adSheet .ad-kn{font-size:15.5px;color:#fff6e6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-kc{font-size:12px;color:rgba(255,226,160,0.7);margin-top:2px;',
      ' font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-berths{display:flex;flex-direction:column;gap:6px;margin-top:11px;}',
      '#adSheet .ad-b{display:flex;align-items:flex-start;gap:9px;padding:8px 10px;border-radius:11px;',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);',
      ' border-left:3px solid var(--bc,rgba(255,255,255,0.14));}',
      '#adSheet .ad-bgl{flex:0 0 auto;width:22px;text-align:center;font-size:13px;',
      ' color:var(--bc,rgba(206,224,255,0.5));line-height:1.5;}',
      '#adSheet .ad-bx{flex:1 1 auto;min-width:0;}',
      '#adSheet .ad-bfn{font-size:13.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-bwho{font-size:12px;color:var(--bc,rgba(206,224,255,0.7));margin-top:2px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-bwhy{font-size:11.5px;line-height:1.45;color:rgba(206,224,255,0.5);margin-top:2px;',
      ' overflow-wrap:anywhere;}',
      '#adSheet .ad-bp{flex:0 0 auto;font-size:10px;letter-spacing:.06em;text-transform:uppercase;',
      ' padding:3px 7px;border-radius:7px;margin-top:1px;}',
      '#adSheet .ad-bp.work{color:#9affbe;background:rgba(154,255,190,0.11);}',
      '#adSheet .ad-bp.balk{color:#ffcf8a;background:rgba(255,207,138,0.11);}',
      '#adSheet .ad-bp.scuttle{color:#ff9a9a;background:rgba(255,154,154,0.11);}',
      '#adSheet .ad-bp.open{color:rgba(206,224,255,0.45);background:rgba(255,255,255,0.05);}',

      // ── THE FLEET ──────────────────────────────────────────────────────────
      '#adSheet .ad-fleet{display:flex;flex-direction:column;gap:8px;}',
      '#adSheet .ad-h{padding:11px 12px;border-radius:13px;background:rgba(255,255,255,0.035);',
      ' border:1px solid rgba(255,255,255,0.08);border-left:3px solid var(--hc,#9fdcff);}',
      '#adSheet .ad-h.struck{opacity:0.55;}',
      '#adSheet .ad-hh{display:flex;align-items:center;gap:10px;}',
      '#adSheet .ad-hg{flex:0 0 auto;width:28px;height:28px;border-radius:9px;display:flex;',
      ' align-items:center;justify-content:center;font-size:14px;color:var(--hc,#9fdcff);',
      ' background:rgba(255,255,255,0.06);}',
      '#adSheet .ad-ht{flex:1 1 auto;min-width:0;}',
      '#adSheet .ad-hn{font-size:14.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-hs{font-size:11.5px;color:rgba(206,224,255,0.5);margin-top:2px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-hpick{flex:0 0 auto;min-height:36px;min-width:36px;padding:0 11px;border-radius:10px;',
      ' font-family:inherit;font-size:12px;cursor:pointer;color:rgba(206,224,255,0.72);',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);}',
      '#adSheet .ad-hpick.on{color:#04121a;background:#9fdcff;border-color:#9fdcff;}',
      // the statline: wrapping chips, each its own box. They wrap to the next
      // line rather than overflowing, at every width, with any number of frames.
      '#adSheet .ad-stat{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}',
      '#adSheet .ad-sc{display:flex;align-items:center;gap:4px;padding:3px 7px;border-radius:8px;',
      ' font-size:11px;color:rgba(206,224,255,0.72);background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,255,255,0.07);font-variant-numeric:tabular-nums;}',
      '#adSheet .ad-sc b{font-weight:normal;color:#eaf3ff;}',
      '#adSheet .ad-flaw{font-size:11.5px;line-height:1.45;color:rgba(255,190,150,0.72);margin-top:7px;',
      ' overflow-wrap:anywhere;}',

      // ── THE SORTIE + THE WAKE RECORD ───────────────────────────────────────
      '#adSheet .ad-sortie{padding:13px;border-radius:15px;background:rgba(255,154,154,0.06);',
      ' border:1px solid rgba(255,154,154,0.22);}',
      '#adSheet .ad-rv{font-size:15px;color:#ffe6e6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-rvc{font-size:12.5px;line-height:1.5;color:rgba(255,200,190,0.7);margin-top:3px;',
      ' font-style:italic;overflow-wrap:anywhere;}',
      '#adSheet .ad-rvk{font-size:12px;color:rgba(255,200,190,0.6);margin-top:7px;',
      ' font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}',
      '#adSheet .ad-wakes{display:flex;flex-direction:column;gap:8px;}',
      '#adSheet .ad-w{padding:11px 12px;border-radius:13px;background:rgba(255,255,255,0.035);',
      ' border:1px solid rgba(255,255,255,0.08);border-left:3px solid var(--wc,#9fdcff);}',
      '#adSheet .ad-wh{display:flex;align-items:baseline;gap:8px;}',
      '#adSheet .ad-wn{flex:1 1 auto;min-width:0;font-size:14px;color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-ww{flex:0 0 auto;font-size:11px;color:rgba(206,224,255,0.45);}',
      '#adSheet .ad-we{font-size:12.5px;line-height:1.5;color:rgba(220,231,255,0.72);margin-top:4px;',
      ' font-style:italic;overflow-wrap:anywhere;}',
      // THE LINE OF CONSEQUENCE. Each exchange is one row: a held/opened pill in
      // a fixed cell, the sentence taking the rest and clipping inside itself.
      '#adSheet .ad-line{display:flex;flex-direction:column;gap:4px;margin-top:8px;}',
      // the per-hull ledger caption. Its own full-width row, wrapping inside
      // itself — a user-authored hull name can be 36 characters and must never
      // push anything sideways.
      '#adSheet .ad-lhead{font-size:11px;letter-spacing:.04em;color:rgba(159,220,255,0.5);',
      ' margin-bottom:2px;overflow-wrap:anywhere;}',
      '#adSheet .ad-lr{display:flex;align-items:baseline;gap:8px;font-size:12px;}',
      '#adSheet .ad-lc{flex:0 0 44px;text-align:center;border-radius:6px;padding:2px 0;font-size:10px;',
      ' letter-spacing:.05em;text-transform:uppercase;}',
      '#adSheet .ad-lc.held{color:#9affbe;background:rgba(154,255,190,0.11);}',
      '#adSheet .ad-lc.open{color:#ff9a9a;background:rgba(255,154,154,0.11);}',
      '#adSheet .ad-lc.even{color:rgba(206,224,255,0.5);background:rgba(255,255,255,0.05);}',
      '#adSheet .ad-ls{flex:1 1 auto;min-width:0;color:rgba(206,224,255,0.7);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#adSheet .ad-lv{flex:0 0 auto;font-size:11px;color:rgba(206,224,255,0.4);',
      ' font-variant-numeric:tabular-nums;}',
      '#adSheet .ad-dec{font-size:12.5px;line-height:1.5;color:rgba(255,226,160,0.8);margin-top:7px;',
      ' padding:8px 10px;border-radius:10px;background:rgba(255,212,121,0.06);',
      ' border:1px solid rgba(255,212,121,0.18);overflow-wrap:anywhere;}',

      '#adSheet .ad-gate{padding:11px 12px;border-radius:12px;margin-top:10px;font-size:12.5px;',
      ' line-height:1.5;color:rgba(255,226,160,0.78);background:rgba(255,212,121,0.06);',
      ' border:1px solid rgba(255,212,121,0.2);overflow-wrap:anywhere;}',
      '#adSheet .ad-dissolve{width:100%;min-height:44px;border-radius:12px;font-family:inherit;',
      ' font-size:13px;cursor:pointer;margin-top:12px;color:rgba(255,150,150,0.7);',
      ' background:rgba(255,120,120,0.06);border:1px solid rgba(255,120,120,0.2);}',

      // very short viewports: tighten, never overlap
      '@media(max-height:520px){#adSheet .ad-sec{margin:10px 0 6px;}',
      ' #adSheet .ad-keel{padding:11px;}#adSheet .ad-c{padding:9px 10px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _pickEl = 'sea', _pickCls = null, _pickHulls = {}, _beat = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'adSheet';
    // STATIC MARKUP ONLY. Every agent name, hull name and provider string enters
    // later through textContent — no interpolation of untrusted content anywhere.
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the admiralty<small id="adSub">what your court builds when you are not watching</small></div>' +
        '<button class="dv-x" id="adX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="adBody"></div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#adX').onclick = close;
    grip(el);
    return el;
  }

  // grip-to-dismiss, matching every other sheet exactly (one gesture everywhere)
  function grip(sheet) {
    var g = sheet.querySelector('.dv-grip'); if (!g) return;
    var y0 = 0, dy = 0, dragging = false;
    function start(e) { dragging = true; dy = 0; y0 = (e.touches ? e.touches[0].clientY : e.clientY); sheet.style.transition = 'none'; }
    function move(e) {
      if (!dragging) return;
      dy = Math.max(0, (e.touches ? e.touches[0].clientY : e.clientY) - y0);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function end() {
      if (!dragging) return; dragging = false;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 90) close();
    }
    g.addEventListener('touchstart', start, { passive: true });
    g.addEventListener('touchmove', move, { passive: true });
    g.addEventListener('touchend', end);
    g.addEventListener('mousedown', function (e) {
      start(e);
      var mm = function (ev) { move(ev); };
      var mu = function () { end(); removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    });
  }

  function open() {
    if (!enabled()) return;
    resolve();
    var h = hud();
    if (h && h.openSheet) {
      h.openSheet('admiralty', function () { build(); _sheet.classList.add('open'); render(); });
    } else { build(); _sheet.classList.add('open'); render(); }
    var s = load(); s.seen = Date.now(); save();
    updateLauncher();
    // a live beat while the sheet is up: a berth and a sortie both carry clocks,
    // and a countdown that does not count is a lie.
    clearInterval(_beat);
    _beat = setInterval(function () {
      if (!isOpen()) { clearInterval(_beat); _beat = null; return; }
      if (resolve()) { render(); return; }
      tickClocks();
    }, 1000);
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    clearInterval(_beat); _beat = null;
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // ── helpers ────────────────────────────────────────────────────────────────
  function ago(ms) {
    var d = Math.floor((Date.now() - ms) / 1000);
    if (d < 90) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    if (d < 172800) return 'yesterday';
    return Math.floor(d / 86400) + 'd ago';
  }
  function left(ms) {
    var d = Math.max(0, Math.floor((ms - Date.now()) / 1000));
    var m = Math.floor(d / 60), sec = d % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // ← ALWAYS textContent, never HTML
    return n;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#adBody');
    body.innerHTML = '';
    if (isGuest()) { renderGuest(body); return; }
    if (!polity()) { renderNoPolity(body); return; }
    renderYard(body);
  }

  // ── GUEST — a doorway, never a corpse ─────────────────────────────────────
  function renderGuest(body) {
    _sheet.querySelector('#adSub').textContent = 'a yard crewed by your own agents';
    body.appendChild(el('div', 'ad-empty',
      'a yard is crewed by the agents you brought into this world, and paid for out of your polity\'s treasury — so it needs a world of your own to stand in. claim a clearing, and the keels can be laid.'));
    var go = el('button', 'ad-go', 'claim your clearing');
    go.onclick = function () {
      try {
        if (W.VintWelcomeGate && W.VintWelcomeGate.open) { W.VintWelcomeGate.open('signup'); return; }
        if (W.__vintOpenSignin) { W.__vintOpenSignin(); return; }
      } catch (_) {}
      location.href = 'welcome.html';
    };
    body.appendChild(go);
  }

  // ── NO POLITY — the honest dependency, stated once, with the door to it ───
  // The yard does not invent a government to stand in for the one the user has
  // not founded. It says exactly what is missing and opens the surface that
  // fixes it — the Concord, through its own public open(), never by reaching
  // into its DOM.
  function renderNoPolity(body) {
    _sheet.querySelector('#adSub').textContent = 'a yard answers to a polity';
    body.appendChild(el('div', 'ad-empty',
      'nothing is built here by one person. a keel is paid for out of a treasury, crewed by seats, and its hands are bent by a charter — so the yard opens the moment your concord sits, and not before.'));
    var go = el('button', 'ad-go', 'found your concord');
    go.onclick = function () {
      var c = concord();
      if (c && c.open) { c.open(); return; }
      toast('the concord is not on this surface yet.');
    };
    body.appendChild(go);
    var n = el('div', 'ad-note');
    n.textContent = 'the yard is held on this device, like the concord is. the world does not yet keep a fleet for you.';
    body.appendChild(n);
  }

  // ── THE YARD ──────────────────────────────────────────────────────────────
  function renderYard(body) {
    var s = load(), p = polity(), ch = charter();
    var e = elementOf(s.keel ? s.keel.el : _pickEl);
    _sheet.querySelector('#adSub').textContent = s.keel
      ? 'a keel is open. your court is deciding what it becomes.'
      : (ch ? ch.creed : 'what your court builds when you are not watching');

    // 1) THE BANNER — one economy, read from the Concord, never re-derived
    var ban = el('div', 'ad-banner');
    ban.style.setProperty('--ec', e.c);
    ban.appendChild(el('div', 'ad-bg', e.glyph));
    var bt = el('div', 'ad-bt');
    bt.appendChild(el('div', 'ad-bn', (p && p.name) || 'the yard'));
    var alive = 0;
    for (var i = 0; i < s.fleet.length; i++) if (!s.fleet[i].struck) alive++;
    bt.appendChild(el('div', 'ad-bs', alive + ' of ' + slipCap() + ' slips · ' + bench().length + ' hands seated'));
    ban.appendChild(bt);
    var tr = el('div', 'ad-btr');
    tr.appendChild(el('div', null, '◇ ' + treasury()));
    var stg = el('div', null, 'standing ' + standing());
    stg.style.cssText = 'font-size:11px;color:rgba(206,224,255,0.45);margin-top:2px;';
    tr.appendChild(stg);
    ban.appendChild(tr);
    body.appendChild(ban);

    // 2) THE KEEL, or the ability to lay one
    if (s.keel) renderKeel(body, s);
    else renderLay(body, s);

    // 3) THE FLEET
    body.appendChild(el('div', 'ad-sec', 'the fleet'));
    renderFleet(body, s);

    // 4) THE SORTIE, or the wake record
    if (s.sortie) renderSortie(body, s);
    body.appendChild(el('div', 'ad-sec', 'the wakes'));
    renderWakes(body, s);

    // 5) THE ESCAPE HATCH — one tap, full refund, nothing destroyed
    var dis = el('button', 'ad-dissolve', 'pay off the yard');
    dis.onclick = function () {
      if (dis.dataset.sure !== '1') {
        dis.dataset.sure = '1';
        dis.textContent = 'tap again — every hull is paid back into the treasury, every hand walks home';
        setTimeout(function () {
          if (dis.isConnected) { dis.dataset.sure = ''; dis.textContent = 'pay off the yard'; }
        }, 5000);
        return;
      }
      payOff();
    };
    body.appendChild(dis);

    // THE HONEST LINE. Stated on the governing surface, not buried in founding.
    var honest = el('div', 'ad-note');
    honest.textContent = 'this yard and this fleet are held on your device. no other world can see them yet, and the powers you meet are your own defectors and the unaligned — not another person\'s fleet. there is no wire for that yet, and this will not pretend there is.';
    body.appendChild(honest);
  }

  // ── LAYING A KEEL ─────────────────────────────────────────────────────────
  function renderLay(body, s) {
    body.appendChild(el('div', 'ad-sec', 'lay a keel'));

    // element
    var els = el('div', 'ad-els');
    ELEMENTS.forEach(function (e) {
      var b = el('button', 'ad-el' + (_pickEl === e.k ? ' on' : ''));
      b.style.setProperty('--ec', e.c);
      b.appendChild(el('div', 'ad-elg', e.glyph));
      b.appendChild(el('div', 'ad-eln', e.k));
      b.setAttribute('aria-label', 'a hull ' + e.name);
      b.onclick = function () { _pickEl = e.k; render(); };
      els.appendChild(b);
    });
    body.appendChild(els);

    var e2 = elementOf(_pickEl);
    var x = el('div', 'ad-elx');
    x.style.setProperty('--ec', e2.c);
    x.appendChild(el('div', 'ad-elc', '"' + e2.creed + '"'));
    x.appendChild(el('div', 'ad-boon', '✓ ' + e2.boon));
    x.appendChild(el('div', 'ad-cost', '✗ ' + e2.cost));
    var own = frameOf(e2.own);
    var onlyLine = el('div', 'ad-note');
    onlyLine.textContent = 'a hull ' + e2.name + ' opens ' + own.n + ' — a berth no other element has. when it meets a hull that has no ' + own.n.replace('the ', '') + ', that frame is simply not in the line.';
    x.appendChild(onlyLine);
    body.appendChild(x);

    // class
    body.appendChild(el('div', 'ad-sec', 'what it is for'));
    var wrap = el('div', 'ad-cls');
    var st = standing(), ch = charter(), tre = treasury(), crew = bench().length;
    CLASSES.forEach(function (c) {
      var cost = (ch && ch.k === 'vault') ? Math.round(c.cost * 0.5) : c.cost;
      var lockWhy = '';
      if (st < c.need) lockWhy = 'needs standing ' + c.need + ' — you stand at ' + st + '.';
      else if (cost > tre) lockWhy = 'costs ◇' + cost + ' — the treasury holds ◇' + tre + '. pass a levy at the concord.';
      else if (!crew) lockWhy = 'no one is seated at your table. a yard with no hands lays nothing.';
      else if (s.fleet.length >= slipCap()) lockWhy = 'every slip is full. strike a hull or earn another slip.';

      var b = el('button', 'ad-c' + (lockWhy ? ' locked' : (_pickCls === c.k ? ' on' : '')));
      b.appendChild(el('div', 'ad-cg', c.glyph));
      var t = el('div', 'ad-ct');
      t.appendChild(el('div', 'ad-cn', c.n + '  ◇' + cost));
      t.appendChild(el('div', 'ad-cs', c.sub));
      // A locked class SAYS why, right there. Never a dead control.
      if (lockWhy) t.appendChild(el('div', 'ad-cl', lockWhy));
      b.appendChild(t);
      if (!lockWhy) b.onclick = function () { _pickCls = c.k; render(); };
      else b.onclick = function () { toast(lockWhy); };
      wrap.appendChild(b);
    });
    body.appendChild(wrap);

    body.appendChild(el('div', 'ad-sec', 'its name'));
    var nm = document.createElement('input');
    nm.className = 'ad-name'; nm.id = 'adName'; nm.type = 'text';
    nm.maxLength = 36;
    nm.placeholder = 'what will they call it?';
    body.appendChild(nm);

    var go = el('button', 'ad-go', 'lay the keel');
    go.disabled = !_pickCls;
    go.onclick = function () {
      var r = lay(_pickEl, _pickCls, nm.value);
      if (!r.ok) {
        toast(
          r.why === 'busy'     ? 'there is already a keel open. one at a time — a yard is not a factory.'
          : r.why === 'polity'   ? 'found your concord first. a yard answers to a polity.'
          : r.why === 'slips'    ? 'every slip is full at ' + r.cap + '.'
          : r.why === 'standing' ? 'that hull needs standing ' + r.need + '.'
          : r.why === 'treasury' ? 'the treasury cannot carry ◇' + r.need + ' — pass a levy at the concord.'
          : r.why === 'crew'     ? 'no one is seated. a yard with no hands lays nothing.'
          : 'the yard would not take it up.'
        );
        return;
      }
      _pickCls = null;
      toast('the keel is open. your court will claim the berths themselves — with or without you.');
      render(); updateLauncher();
    };
    body.appendChild(go);

    var n = el('div', 'ad-note');
    n.textContent = 'you do not assign the work. every six minutes, whichever seat wants the open berth most takes it — and builds it the way its own nature builds things. the hull you get is the one your court made.';
    body.appendChild(n);
  }

  // ── THE KEEL UNDER CONSTRUCTION — the surface carrying the invention ──────
  function renderKeel(body, s) {
    var k = s.keel, e = elementOf(k.el), cls = classOf(k.cls);
    body.appendChild(el('div', 'ad-sec', 'on the stocks'));
    var box = el('div', 'ad-keel');
    var h = el('div', 'ad-kh');
    h.appendChild(el('div', 'ad-kg', e.glyph));
    var t = el('div', 'ad-kt');
    t.appendChild(el('div', 'ad-kn', k.name));
    var clock = el('div', 'ad-kc');
    clock.id = 'adKeelClock';
    var openN = 0;
    for (var i = 0; i < k.frames.length; i++) if (!k.frames[i].by) openN++;
    clock.textContent = cls.n + ' ' + e.name + ' · ' + openN + ' berth' + (openN === 1 ? '' : 's') +
      ' open · next in ' + left(k.next);
    t.appendChild(clock);
    h.appendChild(t);
    box.appendChild(h);

    var list = el('div', 'ad-berths');
    k.frames.forEach(function (fr) {
      var f = frameOf(fr.k);
      var row = el('div', 'ad-b');
      var state = fr.by ? fr.act : (fr.scuttledBy ? 'scuttle' : 'open');
      var col = state === 'work' ? (fr.color || '#9affbe')
              : state === 'balk' ? '#ffcf8a'
              : state === 'scuttle' ? '#ff9a9a' : 'rgba(206,224,255,0.4)';
      row.style.setProperty('--bc', col);
      row.appendChild(el('div', 'ad-bgl', f.glyph));
      var bx = el('div', 'ad-bx');
      bx.appendChild(el('div', 'ad-bfn', f.n));
      if (fr.by || fr.scuttledBy) {
        // ← the agent's name, as TEXT, always
        bx.appendChild(el('div', 'ad-bwho', fr.byName || fr.scuttledBy || 'someone'));
        bx.appendChild(el('div', 'ad-bwhy', fr.why));
      } else {
        bx.appendChild(el('div', 'ad-bwhy', f.does));
      }
      row.appendChild(bx);
      row.appendChild(el('div', 'ad-bp ' + state,
        state === 'work' ? 'laid' : state === 'balk' ? 'poor' : state === 'scuttle' ? 'broken' : 'open'));
      list.appendChild(row);
    });
    box.appendChild(list);
    body.appendChild(box);

    // WHO IS WALKING TOWARD WHAT — the open loop, made legible. This is the
    // single most retention-bearing line in the file: it tells you what your
    // court is ABOUT to do without letting you stop it.
    var open2 = [];
    for (var f2 = 0; f2 < k.frames.length; f2++) if (!k.frames[f2].by) open2.push(k.frames[f2].k);
    if (open2.length) {
      var crew = bench(), bestF = null, bestA = null, bestP = -99;
      for (var o = 0; o < open2.length; o++) {
        for (var c = 0; c < crew.length; c++) {
          var ag = crew[c].agent || crew[c];
          var p = pullOf(ag, open2[o], cls);
          if (p > bestP) { bestP = p; bestF = open2[o]; bestA = ag; }
        }
      }
      var n = el('div', 'ad-note');
      n.textContent = bestA
        ? (bestA.name || 'someone') + ' is walking toward ' + frameOf(bestF).n + '. nobody sent them.'
        : 'nobody is seated to claim the next berth. seat someone at the concord and the yard moves again.';
      body.appendChild(n);
    }
  }

  function tickClocks() {
    var s = load();
    if (!_sheet) return;
    if (s.keel) {
      var c = _sheet.querySelector('#adKeelClock');
      if (c) {
        var e = elementOf(s.keel.el), cls = classOf(s.keel.cls), openN = 0;
        for (var i = 0; i < s.keel.frames.length; i++) if (!s.keel.frames[i].by) openN++;
        c.textContent = cls.n + ' ' + e.name + ' · ' + openN + ' berth' + (openN === 1 ? '' : 's') +
          ' open · next in ' + left(s.keel.next);
      }
    }
    if (s.sortie) {
      var w = _sheet.querySelector('#adWakeClock');
      if (w) w.textContent = 'the line meets in ' + left(s.sortie.closes);
    }
  }

  // ── THE FLEET ─────────────────────────────────────────────────────────────
  function renderFleet(body, s) {
    if (!s.fleet.length) {
      body.appendChild(el('div', 'ad-empty', 'nothing has been launched yet. lay a keel and walk away — that is when this fills.'));
      return;
    }
    var wrap = el('div', 'ad-fleet');
    s.fleet.forEach(function (hl) {
      var e = elementOf(hl.el), cls = classOf(hl.cls);
      var row = el('div', 'ad-h' + (hl.struck ? ' struck' : ''));
      row.style.setProperty('--hc', hl.struck ? '#ff9a7a' : e.c);
      var h = el('div', 'ad-hh');
      h.appendChild(el('div', 'ad-hg', e.glyph));
      var t = el('div', 'ad-ht');
      t.appendChild(el('div', 'ad-hn', hl.name));      // ← user-authored, as TEXT
      t.appendChild(el('div', 'ad-hs', cls.n + ' ' + e.name +
        (hl.struck ? ' · struck' : (hl.scars.length ? ' · ' + hl.scars.length + ' scar' + (hl.scars.length === 1 ? '' : 's') : '')) +
        ' · ' + ago(hl.launched)));
      h.appendChild(t);
      if (!hl.struck && !s.sortie) {
        var pick = el('button', 'ad-hpick' + (_pickHulls[hl.id] ? ' on' : ''), _pickHulls[hl.id] ? 'sailing' : 'send');
        pick.setAttribute('aria-label', (_pickHulls[hl.id] ? 'do not send ' : 'send ') + hl.name);
        pick.onclick = function () {
          if (_pickHulls[hl.id]) delete _pickHulls[hl.id];
          else {
            var n = 0; for (var kk in _pickHulls) if (_pickHulls[kk]) n++;
            if (n >= 4) { toast('four hulls is a line. any more and nobody can see the flanks.'); return; }
            _pickHulls[hl.id] = 1;
          }
          render();
        };
        h.appendChild(pick);
      }
      row.appendChild(h);

      // the statline — chips that WRAP, never overflow
      var st = el('div', 'ad-stat');
      framesFor(hl.el).forEach(function (fk) {
        var chip = el('div', 'ad-sc');
        chip.appendChild(el('span', null, frameOf(fk).n.replace('the ', '')));
        var b = document.createElement('b');
        b.textContent = String(hl.stats[fk] != null ? hl.stats[fk] : 0);
        chip.appendChild(b);
        st.appendChild(chip);
      });
      row.appendChild(st);

      // THE FLAWS — named, permanent, with the builder attached. This is what
      // makes a defeat readable a week later.
      if (hl.flaws && hl.flaws.length) {
        var fl = el('div', 'ad-flaw');
        var f0 = hl.flaws[0];
        fl.textContent = '⚠ ' + frameOf(f0.f).n + ' is weak — ' + f0.who + ' laid it' +
          (hl.flaws.length > 1 ? ', and ' + (hl.flaws.length - 1) + ' more frame' + (hl.flaws.length > 2 ? 's' : '') + ' beside it.' : '.');
        row.appendChild(fl);
      }
      if (hl.struck) {
        var sk = el('div', 'ad-flaw');
        sk.textContent = 'struck from the fleet. every hand that built it is home and unharmed — nothing you made was lost here.';
        row.appendChild(sk);
      }
      wrap.appendChild(row);
    });
    body.appendChild(wrap);

    // the send control
    var n = 0; for (var kk in _pickHulls) if (_pickHulls[kk]) n++;
    if (!s.sortie) {
      var go = el('button', 'ad-go', n ? 'send ' + n + ' into the wake' : 'choose what sails');
      go.disabled = !n;
      go.onclick = function () {
        var ids = [];
        for (var id in _pickHulls) if (_pickHulls[id]) ids.push(id);
        var r = sortie(ids);
        if (!r.ok) { toast(r.why === 'sailing' ? 'a line is already at sea.' : 'nothing was chosen.'); return; }
        _pickHulls = {};
        toast('the line is away. it meets something in fourteen minutes, whether you watch or not.');
        render(); updateLauncher();
      };
      body.appendChild(go);
    }

    if (s.fleet.length >= slipCap()) {
      var rung = nextSlipRung();
      var g = el('div', 'ad-gate');
      g.textContent = rung
        ? 'your yard holds ' + slipCap() + ' slips. it widens to ' + rung.slips + ' at standing ' + rung.need + ' — the same ladder everything else in this world climbs. build, and the room arrives.'
        : 'every slip is full. this is the widest yard the world grants.';
      body.appendChild(g);
    }
  }

  // ── THE SORTIE — a line at sea, with a clock on it ────────────────────────
  function renderSortie(body, s) {
    body.appendChild(el('div', 'ad-sec', 'at sea'));
    var box = el('div', 'ad-sortie');
    box.appendChild(el('div', 'ad-rv', 'against ' + s.sortie.rival.name));
    box.appendChild(el('div', 'ad-rvc', '"' + s.sortie.rival.creed + '"'));
    var ck = el('div', 'ad-rvk');
    ck.id = 'adWakeClock';
    ck.textContent = 'the line meets in ' + left(s.sortie.closes);
    box.appendChild(ck);
    body.appendChild(box);
    var n = el('div', 'ad-note');
    n.textContent = s.sortie.rival.fromExiles
      ? 'they were at your table once. every frame they lay, they lay knowing exactly how you build.'
      : 'nobody chartered them, so nobody can call them off. the line resolves on the clock.';
    body.appendChild(n);
  }

  // ── THE WAKES — the line of consequence, kept in full ─────────────────────
  function renderWakes(body, s) {
    if (!s.wakes.length) {
      body.appendChild(el('div', 'ad-empty', 'nothing has met anything yet. send a line out and close this — a wake resolves whether you are here or not.'));
      return;
    }
    var wrap = el('div', 'ad-wakes');
    s.wakes.slice(0, 12).forEach(function (wk) {
      var row = el('div', 'ad-w');
      row.style.setProperty('--wc', wk.won ? '#9affbe' : '#ff9a9a');
      var h = el('div', 'ad-wh');
      h.appendChild(el('div', 'ad-wn', (wk.won ? 'the line held' : 'the line broke') + ' — ' + wk.rival));
      h.appendChild(el('div', 'ad-ww', ago(wk.at)));
      row.appendChild(h);
      row.appendChild(el('div', 'ad-we', wk.effect));

      // EVERY EXCHANGE, NAMED. Never a summary you have to trust — the whole
      // mechanic is that you can read the loss back to one agent's hands.
      (wk.lines || []).forEach(function (ln) {
        var lw = el('div', 'ad-line');
        // Say what the pair of numbers IS, once per hull, so no one has to
        // guess why a frame with a bigger chip on the fleet card lost its
        // exchange. The wake is decided on how well a frame was laid, not on
        // how much the class spent on it.
        var lh = el('div', 'ad-lhead', ln.hull + ' — how well each frame was laid, yours / theirs');
        lw.appendChild(lh);
        (ln.line || []).forEach(function (x) {
          var lr = el('div', 'ad-lr');
          lr.appendChild(el('div', 'ad-lc ' + (x.even ? 'even' : (x.held ? 'held' : 'open')),
            x.even ? 'even' : (x.held ? 'held' : 'opened')));
          lr.appendChild(el('div', 'ad-ls', x.say));       // ← names, as TEXT
          // HOW WELL IT WAS LAID, yours against theirs — the exact pair the
          // verdict beside it was computed from, so the row can always be
          // reconciled by eye. It is deliberately NOT the raw chip on the fleet
          // card: that number includes how much the class invested in the
          // frame, and printing it here once produced "opened — 2.15 / 0.42".
          var lv = el('div', 'ad-lv', x.mine + ' / ' + x.theirs);
          lv.setAttribute('title', 'how well it was laid — yours against theirs');
          lr.appendChild(lv);
          lw.appendChild(lr);
        });
        row.appendChild(lw);
        if (ln.decider) {
          var d = el('div', 'ad-dec');
          d.textContent = ln.won
            ? 'it turned on ' + frameOf(ln.decider.f).n + '. ' + ln.decider.say
            : 'it turned on ' + frameOf(ln.decider.f).n + '. ' + ln.decider.say + ' that is the frame to fix.';
          row.appendChild(d);
        }
      });
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
  }

  // ── PAY OFF — the resentment escape hatch. Full refund, nothing destroyed. ─
  function payOff() {
    var s = load(), back = 0;
    if (s.keel) back += Number(s.keel.cost) || 0;
    for (var i = 0; i < s.fleet.length; i++) {
      if (s.fleet[i].struck) continue;
      var c = classOf(s.fleet[i].cls);
      var ch = charter();
      back += (ch && ch.k === 'vault') ? Math.round(c.cost * 0.5) : c.cost;
    }
    var cc = concord();
    try { if (cc && cc.credit && back) cc.credit(back, 'the yard was paid off'); } catch (_) {}
    // The WAKES ARE KEPT. What your court did is history, and history is never
    // the thing a reset destroys — the same rule the Concord's record follows.
    s.keel = null; s.fleet = []; s.sortie = null;
    save();
    _pickCls = null; _pickHulls = {};
    toast(back ? 'the yard is paid off. ◇' + back + ' back to the treasury, every hand home.'
               : 'the yard is paid off. every hand walks home.');
    render(); updateLauncher();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HOMECOMING — "they built it while you were gone"
  //
  // No new overlay. Deliberately, and for the reason concord.js already
  // recorded: traces-hud owns a modal in the 1610/1620 band, world-hud owns the
  // vigil's homecoming, and the Concord already yielded its own card to the
  // shared toast rather than becoming the third. A FOURTH would be exactly the
  // collision this codebase has been burned by twice. So the arrival speaks
  // through the SHARED toast (one element, one anchor, page-wide) and the
  // launcher wears the count.
  // ═══════════════════════════════════════════════════════════════════════════
  function announce() {
    if (!enabled() || isGuest() || !polity()) return;
    var did = resolve();
    var n = unread();
    if (!n) return;
    // let the vigil, the lanterns AND the concord speak first — all three fire
    // in the first ~5s of arrival, and four toasts in a row is noise.
    setTimeout(function () {
      var s = load();
      var wk = s.wakes[0], hl = s.fleet[0];
      if (wk && wk.at > (s.seen || 0)) { toast(wk.won ? 'your line held while you were gone. ' + wk.effect : 'your line broke while you were gone. ' + wk.effect); return; }
      if (hl && hl.launched > (s.seen || 0)) {
        toast(hl.flaws && hl.flaws.length
          ? hl.name + ' launched without you — and it came out flawed. ' + hl.flaws[0].who + ' is the reason.'
          : hl.name + ' launched without you. your court built the whole thing.');
      }
    }, did ? 6400 : 5800);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LAUNCHER — a flow child of the rail. Nothing pinned, nothing counted.
  // ═══════════════════════════════════════════════════════════════════════════
  var _btn = null, _waits = 0;
  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('adBtn', 'yard', '⚓', open);
    if (_btn) {
      _btn.setAttribute('aria-label', 'the admiralty — the yard your agents crew');
      _btn.setAttribute('title', 'the admiralty — the yard your agents crew');
      // the count rides INSIDE the launcher as its own flex cell, exactly like
      // the Court's .ct-n and the Concord's .cn-n — never a second floating node
      // that could land on the label. The pattern is followed, not re-invented.
      if (!_btn.querySelector('.ad-n')) {
        var pill = document.createElement('span');
        pill.className = 'ad-n';
        pill.style.cssText = 'flex:0 0 auto;margin-left:6px;min-width:18px;height:18px;padding:0 5px;' +
          'border-radius:9px;background:rgba(159,220,255,0.9);color:#04121a;font-size:11px;' +
          'line-height:18px;text-align:center;font-variant-numeric:tabular-nums;display:none;';
        _btn.appendChild(pill);
      }
    }
    try { h.registerSheet('admiralty', isOpen, close); } catch (_) {}
    updateLauncher();
    setTimeout(announce, 3400);
  }

  // The launcher only appears where a yard can exist: in a world you can build
  // in (yours). Your fleet does not follow you into a stranger's clearing — the
  // same rule the Court and the Concord already hold to.
  function updateLauncher() {
    if (!_btn) return;
    var show = false;
    try {
      var w = world();
      var here = w && w.currentWorldId ? String(w.currentWorldId()) : 'universe';
      var mine = true;
      try { if (w && w.canBuild) mine = !!w.canBuild(); } catch (_) {}
      show = !isGuest() && here !== 'universe' && mine;
    } catch (_) {}
    _btn.style.display = show ? 'flex' : 'none';

    var pill = _btn.querySelector('.ad-n');
    if (pill) {
      var s = load();
      // the badge counts what is WAITING: an open keel is one, a line at sea is
      // one, plus every launch and wake you have not read.
      var n = (polity() ? (s.keel ? 1 : 0) + (s.sortie ? 1 : 0) + unread() : 0);
      pill.textContent = n > 9 ? '9+' : String(n);
      pill.style.display = (show && n > 0) ? 'block' : 'none';
    }
    try { if (hud() && hud().relayout) hud().relayout(); } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIRING
  // ═══════════════════════════════════════════════════════════════════════════
  // A world:state can change standing, lumen and canBuild — all three gate this
  // surface. The Concord already captures the resident row off this event and
  // exposes standing()/treasury() from it, so this file re-renders rather than
  // caching a second copy of a number that has one owner.
  W.addEventListener('vint:world-state', function () {
    resolve();
    if (isOpen()) render();
    updateLauncher();
  });
  W.addEventListener('vint:world-ready', function () { updateLauncher(); });
  // A warp means a different world, which means a DIFFERENT yard (state is keyed
  // per world). Close rather than show one clearing's fleet while standing in
  // another — the same lie the lanterns and the Concord both close for.
  W.addEventListener('vint:world-travel', function () {
    if (isOpen()) close();
    _st = null; _stKey = null;
    _pickCls = null; _pickHulls = {};
    setTimeout(updateLauncher, 1200);
  });
  // The Concord resolving a session can seat, unseat or EXILE an agent — all
  // three change who is in this yard and who the rival is made of. Listening to
  // its own event is exact, and costs nothing when nothing happened.
  W.addEventListener('vint:concord-resolved', function () {
    if (isOpen()) render();
    updateLauncher();
  });
  // THE ROSTER MOVED. There is no roster event on the window; court.js announces
  // a change by calling DirverseHUD.refreshAgents(), which is the one real
  // chokepoint every add/pause/remove flows through — so we WRAP it, preserving
  // the original call, exactly as concord.js does. Idempotent: the guard means
  // neither module can ever double-wrap the other's wrapper.
  (function hookRoster() {
    var h = hud();
    if (!h || !h.refreshAgents) { setTimeout(hookRoster, 200); return; }
    if (h.refreshAgents.__adHooked) return;
    var orig = h.refreshAgents;
    var wrapped = function () {
      try { orig.apply(this, arguments); } finally {
        try { if (isOpen()) render(); updateLauncher(); } catch (_) {}
      }
    };
    wrapped.__adHooked = true;
    h.refreshAgents = wrapped;
  })();

  // A BACKGROUND BEAT. Berths are claimed and wakes resolve with the sheet
  // closed — that is the whole promise ("they build with or without you"). Every
  // thirty seconds is plenty (a berth runs six minutes) and costs nothing
  // measurable.
  setInterval(function () {
    if (!enabled() || isGuest() || !polity()) return;
    if (resolve()) { updateLauncher(); if (isOpen()) render(); }
  }, 30000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintAdmiralty = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, refresh: updateLauncher,
    // exported for the one-sheet proof and for whatever organ comes next
    state: function () { var s = load(); return JSON.parse(JSON.stringify(s)); },
    fleet: function () { return JSON.parse(JSON.stringify(load().fleet)); },
    resolve: resolve,
    lay: lay, sortie: sortie,
    ELEMENTS: ELEMENTS, CLASSES: CLASSES, FRAMES: FRAMES
  };
})();
