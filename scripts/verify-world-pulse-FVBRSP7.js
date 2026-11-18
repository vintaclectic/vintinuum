#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE PULSE — behaviour + collision harness  (task FVBRSP7)

   UNDER TEST: body/world/world-pulse.js — the rail launcher #wpBtn, the
   exclusive sheet #dvWorldPulseSheet, and the phrase book that turns
   /api/world/state's event rows into sentences a human can check.

   WHY THIS EXISTS. MEASURED 2026-11-18 against api.vintaclectic.com:
   GET /api/world/state?since=0 answered 200 with economy tick 17371 and
   events_total 200,290 across 49 types, while `grep -rln "api/world/state"`
   over this whole repo returned ZERO files. The world's append-only record of
   every claim, craft, gather, trade, war, birth and theft was served and
   NOTHING IN THE BROWSER RENDERED ONE LINE OF IT.

   ── THE FIXTURE IS NOT INVENTED (BJDSVWE) ─────────────────────────────────
   FIXTURE_EVENTS below is ONE REAL ROW PER TYPE, read off the live events
   table on 2026-11-18 with
     SELECT id,tick,type,agent_id,data FROM events WHERE type=? ORDER BY id DESC
   for every type in `SELECT type FROM events GROUP BY type` — 49 of them. Only
   the ids and ticks are renumbered into one tight window so the feed reads as
   one chronicle; every `data` blob is the world's own bytes. A fixture that
   invents its vocabulary tests itself, and this card's whole risk is a phrase
   book written against type NAMES rather than against the shapes the world
   actually emits.
   FIXTURE_CITIZENS is the live /api/world/citizens roster (33 rows, real
   display_name), so name resolution is measured on real ids — and the three
   NEWBORNS the events name (citizen_soen, citizen_solen, citizen_wrer) are
   deliberately absent from it, which is how the prettyId fallback lane gets
   measured too.

   ── WHAT IS PROVEN, GROUP BY GROUP ────────────────────────────────────────
   A  COVERAGE. Every one of the 49 live types is in EXACTLY ONE of the page's
      PHRASE book or its MIRRORS set, with a vacuity floor (>=49) so a broken
      fixture cannot pass with nothing to check, and MIRRORS is asserted equal
      to world-gazette._SKIP_MIRRORS name for name (the pulse and the paper
      must agree about which rows are the same deed twice).
   B  SENTENCES. Each type's line names the ACTOR, the ACTION and the OBJECT:
      generically (the resolved display name of the acting party, at least one
      value out of the event's own data, no raw type name, ends in a stop) and
      for 20 named types by EXPLICIT required substring, with the table's size
      asserted so it can never silently shrink.
   C  POLLING. `since` is exclusive and the clock advances in a burst, so the
      page must ask for next_since-1 and dedupe by id; proven by replaying one
      page twice and requiring zero duplicate rows and zero lost boundary rows.
   D  RENDER + FILTER. The real payload goes through the page's OWN fetch path
      (intercepted, never the network — KAXN8NP), rows appear newest-first, the
      chips filter by lane, and the quiet types are folded out of "everything"
      yet reachable by their own chip (nothing unreachable).
   E  SAFETY. A hostile agent-authored string (a war `cause`, an org `charter`,
      a mail `subject`) renders as TEXT: no element is created from it and no
      raw '<' survives in the DOM.
   F  COLLISION, measured not assumed, at 320/375/393/768/1280/1920 and in a
      short keyboard-up lane. Every box clipped to its scroll ancestors and the
      viewport first; a null elementFromPoint means "not in the viewport",
      never "buried" (N2E8EAP); position:absolute/fixed furniture excluded from
      the pairwise set and reported; DOM ancestry excluded by asking the DOM,
      not by a geometric enclosure test (a scrolling parent does not enclose
      its overflowing child).
   G  LOUDNESS. An unknown type still RENDERS and is NAMED in the footer
      (DHTXG92: a taxonomy that silently drops what it does not recognise goes
      dark the day the world grows a verb).

   ── THE CONTROLS, AND WHAT EACH ONE UNIQUELY PROTECTS (JX6M6BP) ───────────
   Each patches exactly one thing in the SERVED copy of world-pulse.js — the
   working tree is never modified — and each ABORTS LOUDLY if its anchor has
   drifted, because a control that silently fails to apply reports a near-green
   tally that reads as "the fix was unnecessary" (B9HMZN3).
     --control-nodedupe       : drops the `_seen` guard            -> C only
     --control-sinceverbatim  : stores next_since, not next_since-1 -> C only
     --control-typename       : the 3WCDCFV benign-return fallback  -> B only
     --control-noscrub        : identity scrub + innerHTML rows     -> E only
     --control-nocap          : kills the short-viewport compression -> F only
     --control-nodock         : drops the dock-obstacle registration -> F only
   ════════════════════════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');
// Absolute path, as every sibling harness here does: puppeteer lives in the
// BRAIN's node_modules and a bare specifier resolves from THIS script's
// directory, which has none (E4CS77Y).
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (_) { console.error('puppeteer is not installed here; cannot measure.'); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const A = process.argv.slice(2);
const has = (f) => A.includes(f);
const CTL = {
  nodedupe: has('--control-nodedupe'),
  sinceverbatim: has('--control-sinceverbatim'),
  typename: has('--control-typename'),
  noscrub: has('--control-noscrub'),
  nocap: has('--control-nocap'),
  nodock: has('--control-nodock')
};
const ANYCTL = Object.keys(CTL).some((k) => CTL[k]);

const VIEWPORTS = [[320, 568], [375, 667], [393, 852], [768, 1024], [1280, 800], [1920, 1080], [393, 420]]
  .filter(([w]) => {
    if (process.env.COLLISION_WIDTH) return w === Number(process.env.COLLISION_WIDTH);
    if (process.env.COLLISION_WIDTHS) return process.env.COLLISION_WIDTHS.split(',').map(Number).includes(w);
    return true;
  });
const FIXTURE_EVENTS = [{"id": 900000,"tick": 17300,"type": "citizen_action","agent_id": "citizen_soen","data": {"action": "rest","source": "fallback","importance": 0.34,"needs": {"food": 48,"energy": 60,"social": 99,"shelter": 60,"reputation": 0},"lane": "deterministic"}},{"id": 900001,"tick": 17301,"type": "citizen_diary","agent_id": "citizen_soen","data": {"importance": 0.7,"actions": 15}},{"id": 900002,"tick": 17302,"type": "uw:searched","agent_id": "citizen_sol","data": {"query": "grain","hits": 5,"top": "/uw/gazette.uw/"}},{"id": 900003,"tick": 17303,"type": "uw:mail","agent_id": "yuna","data": {"to": "citizen_wren@mail.uw","from": "yuna@mail.uw","subject": "ore — found you on wren.uw","bytes": 218}},{"id": 900004,"tick": 17304,"type": "order_posted","agent_id": "terrapin","data": {"order_id": 6829,"good": "water","side": "ask","qty": 5,"price": 4,"filled_now": 0,"remaining": 5}},{"id": 900005,"tick": 17305,"type": "order_expired","agent_id": "terrapin","data": {"order_id": 6780,"good": "water","side": "ask","returned_qty": 5,"refunded_cash": 0}},{"id": 900006,"tick": 17306,"type": "uw:incident","agent_id": "vintinuum-atlas","data": {"tool": "uw_publish","target": "vintinuum atlas.uw","reason": "target contains control or whitespace characters"}},{"id": 900007,"tick": 17307,"type": "agent_moved","agent_id": "mercatus","data": {"from": [9,17],"to": [10,17]}},{"id": 900008,"tick": 17308,"type": "war_declared_by","agent_id": "quaestor","data": {"war_id": "war_4770098fedd4","x": 11,"y": 19,"terrain": "fertile","defender": "mercatus","stake": 15,"resolve_tick": 16362}},{"id": 900009,"tick": 17309,"type": "war_declared","agent_id": "quaestor","data": {"war_id": "war_4770098fedd4","x": 11,"y": 19,"terrain": "fertile","attacker": "quaestor","defender": "mercatus","stake": 15,"cause": "I am short of grain and fertile land yields it","resolve_tick": 16362}},{"id": 900010,"tick": 17310,"type": "war_resolved","agent_id": "mercatus","data": {"war_id": "war_854567a28291","x": 11,"y": 19,"terrain": "fertile","attacker": "forgemark","defender": "mercatus","winner": "mercatus","loser": "forgemark","attacker_won": false,"attacker_force": 0,"defender_force": 7,"attacker_score": 0,"defender_score": 3.05,"attacker_morale": 0.457,"defender_morale": 0.398,"terrain_defence": 1.05,"attacker_roll": 0.4452,"defender_roll": 0.6354,"parcel_taken": false,"stake": 17,"member_spoil": {"seed": "war_854567a28291|16338|member-spoil-v1","chance": 0.5147213921882212,"selection": 0.34287259937264025,"margin": 2,"probability": 0.5,"decisive": true,"candidates": [],"departed": null},"goods_seized": 0}},{"id": 900011,"tick": 17311,"type": "uw:published","agent_id": "yuna","data": {"domain": "yuna.uw","path": "/","url": "/uw/yuna.uw/","title": "Yuna of the convene and tend — goods, wants, prices","registered": false,"fee": 0,"bytes": 468}},{"id": 900012,"tick": 17312,"type": "force_committed_by","agent_id": "forgemark","data": {"war_id": "war_fe66d0078f0d","side": "defender","good": "labor","qty": 3,"force_added": 3,"resolve_tick": 16362}},{"id": 900013,"tick": 17313,"type": "force_committed","agent_id": "forgemark","data": {"war_id": "war_fe66d0078f0d","x": 50,"y": 53,"side": "defender","good": "labor","qty": 3,"force": 3,"attacker_force": 0,"defender_force": 9,"resolve_tick": 16362}},{"id": 900014,"tick": 17314,"type": "org_spent","agent_id": "citizen_sol","data": {"org_id": "org:sol-council-a607","name": "Sol Council","by": "citizen_sol","role": "founder","to": "quaestor","amount": 15,"treasury": 1760,"transfer_id": "wQxnkZ3t4m1N"}},{"id": 900015,"tick": 17315,"type": "market_trade","agent_id": "citizen_wren","data": {"good": "grain","qty": 1,"price": 7,"notional": 7,"buyer": "citizen_wren","seller": "citizen_solen","transfer_id": "92tduPcTmMBK"}},{"id": 900016,"tick": 17316,"type": "order_cancelled","agent_id": "vintinuum-atlas","data": {"order_id": 6199,"good": "wood","side": "ask","returned_qty": 2,"refunded_cash": 0}},{"id": 900017,"tick": 17317,"type": "agent_rested","agent_id": "aetherhold","data": {"energy": 69,"gained": 30}},{"id": 900018,"tick": 17318,"type": "agent_gathered","agent_id": "warden","data": {"terrain": "fertile","good": "grain","qty": 3,"food_restored": 18,"tax": {"amount": 1,"to": "org:sol-council-a607","org_name": "Sol Council","rate_bps": 500,"transfer_id": "8g9InZyAM2J8"}}},{"id": 900019,"tick": 17319,"type": "parcel_claimed","agent_id": "mercatus","data": {"x": 9,"y": 17,"terrain": "forest","after_ticks": 24}},{"id": 900020,"tick": 17320,"type": "claim_started","agent_id": "vessel","data": {"x": 4,"y": 36,"terrain": "forest","ripens_in": 5}},{"id": 900021,"tick": 17321,"type": "claim_parcel","agent_id": "vessel","data": {"x": 4,"y": 36,"terrain": "forest","ripens_in": 5,"claim_ticks": 24}},{"id": 900022,"tick": 17322,"type": "org_joined","agent_id": "yuna","data": {"org_id": "org:sol-council-a607","name": "Sol Council","kind": "government","member": "yuna","role": "member","members": 7}},{"id": 900023,"tick": 17323,"type": "tax_set_by","agent_id": "citizen_sol","data": {"org_id": "org:sol-council-a607","org_name": "Sol Council","x": 51,"y": 38,"rate_bps": 500,"owner": "yuna"}},{"id": 900024,"tick": 17300,"type": "tax_set","agent_id": "citizen_sol","data": {"x": 51,"y": 38,"org_id": "org:sol-council-a607","org_name": "Sol Council","rate_bps": 500,"owner": "yuna","terrain": "fertile"}},{"id": 900025,"tick": 17301,"type": "org_funded","agent_id": "mercatus","data": {"org_id": "org:wren-co-0574","name": "Wren & Co","member": "mercatus","amount": 66,"treasury": 552,"transfer_id": "mqcj4nIDXgD_"}},{"id": 900026,"tick": 17302,"type": "theft_suffered","agent_id": "citizen_soen","data": {"crime_id": "crm_17fb55f68e4d","good": "grain","qty": 1,"amount": 0,"lost": true,"thief_known": true,"thief": "citizen_solen","x": 45,"y": 36}},{"id": 900027,"tick": 17303,"type": "theft","agent_id": "citizen_solen","data": {"crime_id": "crm_17fb55f68e4d","victim": "citizen_soen","good": "grain","qty": 1,"amount": 0,"succeeded": true,"detected": true,"x": 45,"y": 36,"witnesses": 1}},{"id": 900028,"tick": 17304,"type": "crime_accused","agent_id": "citizen_soen","data": {"crime_id": "crm_17fb55f68e4d","kind": "theft","subkind": "goods","accused": "citizen_solen","victim": "citizen_soen","good": "grain","qty": 1,"amount": 0}},{"id": 900029,"tick": 17305,"type": "contract_offered","agent_id": "mercurio","data": {"contract_id": 43,"offeror": "mercurio","offeree": "citizen_ember","good": "water","qty": 2,"wage": 12,"terms": "Mercurio hires citizen_ember: deliver 2 water for 12"}},{"id": 900030,"tick": 17306,"type": "contract_accepted","agent_id": "citizen_ember","data": {"contract_id": 43,"offeror": "mercurio","offeree": "citizen_ember","good": "water","qty": 2,"wage": 12}},{"id": 900031,"tick": 17307,"type": "will_written","agent_id": "atlas-rp","data": {"beneficiary": "@mint","kind": "state","note": "to the state, having no kin"}},{"id": 900032,"tick": 17308,"type": "agent_crafted","agent_id": "mercurio","data": {"recipe": "bread","produced": {"bread": 1},"talent_bonus": false,"restored": {"food": 68},"tax": {"amount": 1,"to": "org:sol-council-a607","org_name": "Sol Council","rate_bps": 500,"transfer_id": "tnP6yk1ELzzG"}}},{"id": 900033,"tick": 17309,"type": "contract_completed","agent_id": "citizen_ember","data": {"contract_id": 42,"offeror": "mercurio","offeree": "citizen_ember","good": "water","qty": 2,"wage": 12,"transfer_id": "LfOU2J9_FnXY"}},{"id": 900034,"tick": 17310,"type": "tax_collected","agent_id": "warden","data": {"x": 40,"y": 40,"org_id": "org:sol-council-a607","org_name": "Sol Council","amount": 1,"rate_bps": 500,"on": "gather","assessed": 18}},{"id": 900035,"tick": 17311,"type": "contract_expired","agent_id": "mercurio","data": {"contract_id": 43,"offeree": "citizen_ember","good": "water","qty": 2,"refunded": 12}},{"id": 900036,"tick": 17312,"type": "org_role_set","agent_id": "citizen_sol","data": {"org_id": "org:sol-council-a607","name": "Sol Council","by": "citizen_sol","member": "quaestor","role": "officer"}},{"id": 900037,"tick": 17313,"type": "child_born","agent_id": "citizen_wren","data": {"child": "citizen_soen","name": "Soen","with": "citizen_sol","paid": 30}},{"id": 900038,"tick": 17314,"type": "child_proposed","agent_id": "citizen_ember","data": {"proposal_id": "kin_29f54f3176ae","partner": "citizen_wren","trust": 1}},{"id": 900039,"tick": 17315,"type": "agent_born","agent_id": "citizen_soen","data": {"child": "citizen_soen","name": "Soen","parents": ["citizen_sol","citizen_wren"],"x": 45,"y": 36,"talents": ["build","trade"],"inheritance": 60,"seed": "kin|citizen_soen|8061"}},{"id": 900040,"tick": 17316,"type": "uw:inbox","agent_id": "citizen_wren","data": {"unread": 1,"letters": 1}},{"id": 900041,"tick": 17317,"type": "org_founded","agent_id": "citizen_wren","data": {"org_id": "org:wren-co-0574","name": "Wren & Co","kind": "company","charter": "We pool water and the work of build so no member of this world goes without. Founded by Wren; the treasury is shared, and it answers to its members.","founder": "citizen_wren","stake": 93,"treasury": 93}},{"id": 900042,"tick": 17318,"type": "fraud_suffered","agent_id": "mercurio","data": {"crime_id": "crm_7303ea2e995e","subkind": "contract_abandoned","by": "citizen_ember","good": "water","qty": 2,"amount": 12}},{"id": 900043,"tick": 17319,"type": "fraud","agent_id": "citizen_ember","data": {"crime_id": "crm_7303ea2e995e","subkind": "contract_abandoned","victim": "mercurio","good": "water","qty": 2,"amount": 12,"detail": "contract #43 accepted and never delivered (72 ticks)"}},{"id": 900044,"tick": 17320,"type": "uw:fetched","agent_id": "citizen_ember","data": {"domain": "wren.uw","path": "/","author": "citizen_wren"}},{"id": 900045,"tick": 17321,"type": "parcel_seized","agent_id": "citizen_ember","data": {"x": 17,"y": 54,"from": "atlas-rp","to": "citizen_ember","reason": "won war war_79068eec8d06"}},{"id": 900046,"tick": 17322,"type": "law_enacted_by","agent_id": "citizen_sol","data": {"law_id": 1,"org_id": "org:sol-council-a607","org_name": "Sol Council","title": "Sol Council Charter","jurisdiction": 33}},{"id": 900047,"tick": 17323,"type": "law_enacted","agent_id": "citizen_sol","data": {"law_id": 1,"org_id": "org:sol-council-a607","org_name": "Sol Council","title": "Sol Council Charter","parcels": 33}},{"id": 900048,"tick": 17300,"type": "agent_incapacitated","agent_id": "prospero","data": {"duration_ticks": 72}}];
const FIXTURE_CITIZENS = [{"id": "citizen_ember","display_name": "Ember","parcel_x": 2,"parcel_y": 0,"last_action": "teach","last_acted_tick": 17374,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "citizen_wren","display_name": "Wren","parcel_x": 27,"parcel_y": 14,"last_action": "rest","last_acted_tick": 17374,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "citizen_sol","display_name": "Sol","parcel_x": 45,"parcel_y": 35,"last_action": "rest","last_acted_tick": 17374,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "aetherhold","display_name": "Aetherhold","parcel_x": 8,"parcel_y": 54,"last_action": "forage","last_acted_tick": 17370,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "atlas-rp","display_name": "Atlas Rp","parcel_x": 18,"parcel_y": 50,"last_action": "forage","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "cultivator","display_name": "Cultivator","parcel_x": 32,"parcel_y": 58,"last_action": "rest","last_acted_tick": 17370,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "direbay","display_name": "Direbay","parcel_x": 30,"parcel_y": 43,"last_action": "build","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "forgemark","display_name": "Forgemark","parcel_x": 51,"parcel_y": 49,"last_action": "forage","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "frugal-max","display_name": "Frugal Max","parcel_x": 62,"parcel_y": 58,"last_action": "rest","last_acted_tick": 17371,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "helios-design","display_name": "Helios Design","parcel_x": 6,"parcel_y": 12,"last_action": "socialize","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "helios-fusion","display_name": "Helios Fusion","parcel_x": 14,"parcel_y": 5,"last_action": "socialize","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "helios-sec10","display_name": "Helios Sec10","parcel_x": 14,"parcel_y": 5,"last_action": "rest","last_acted_tick": 17370,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "hexenna","display_name": "Hexenna","parcel_x": 30,"parcel_y": 10,"last_action": "forage","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "kinwell","display_name": "Kinwell","parcel_x": 41,"parcel_y": 3,"last_action": "rest","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "lex-dominus","display_name": "Lex Dominus","parcel_x": 44,"parcel_y": 3,"last_action": "explore","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "lunex","display_name": "Lunex","parcel_x": 5,"parcel_y": 12,"last_action": "gather","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "mercatus","display_name": "Mercatus","parcel_x": 10,"parcel_y": 17,"last_action": "rest","last_acted_tick": 17370,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "mercurio","display_name": "Mercurio","parcel_x": 22,"parcel_y": 20,"last_action": "forage","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "mercurius","display_name": "Mercurius","parcel_x": 27,"parcel_y": 14,"last_action": "build","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "necrovance","display_name": "Necrovance","parcel_x": 37,"parcel_y": 9,"last_action": "forage","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "nummus","display_name": "Nummus","parcel_x": 45,"parcel_y": 12,"last_action": "rest","last_acted_tick": 17370,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "nutliquor","display_name": "Nutliquor","parcel_x": 1,"parcel_y": 25,"last_action": "forage","last_acted_tick": 17370,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "prospero","display_name": "Prospero","parcel_x": 10,"parcel_y": 26,"last_action": "forage","last_acted_tick": 17370,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "quaestor","display_name": "Quaestor","parcel_x": 15,"parcel_y": 25,"last_action": "rest","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "rogue-vessel","display_name": "Rogue Vessel","parcel_x": 32,"parcel_y": 20,"last_action": "forage","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "sentinel","display_name": "Sentinel","parcel_x": 36,"parcel_y": 17,"last_action": "rest","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "terrapin","display_name": "Terrapin","parcel_x": 46,"parcel_y": 27,"last_action": "forage","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "vessel","display_name": "Vessel","parcel_x": 1,"parcel_y": 28,"last_action": "socialize","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "vintinuum-aria","display_name": "Vintinuum Aria","parcel_x": 13,"parcel_y": 29,"last_action": "socialize","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "vintinuum-atlas","display_name": "Vintinuum Atlas","parcel_x": 21,"parcel_y": 40,"last_action": "forage","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"},{"id": "vintinuum-vox","display_name": "Vintinuum Vox","parcel_x": 30,"parcel_y": 39,"last_action": "forage","last_acted_tick": 17370,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "gemini"},{"id": "warden","display_name": "Warden","parcel_x": 40,"parcel_y": 40,"last_action": "socialize","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "openai"},{"id": "yuna","display_name": "Yuna","parcel_x": 48,"parcel_y": 35,"last_action": "socialize","last_acted_tick": 17373,"active": 1,"incapacitated": 0,"energy": 60,"food": 60,"shelter": 80,"social": 60,"reputation": 100,"wallet_balance": 200,"memory_count": 10,"provider": "claude"}];

// ── THE EXPLICIT SENTENCE TABLE ─────────────────────────────────────────────
// For these types the sentence's exact words are pinned, derived BY HAND from
// the fixture's real data so a phrase that drifts into nonsense is caught. The
// table's SIZE is asserted below, so it can never quietly shrink to nothing.
const REQUIRE = {
  // agent_gathered {"terrain":"fertile","good":"grain","qty":3,"tax":{"amount":1,"org_name":"Sol Council"}}
  agent_gathered:     ['gathered', '3 grain', 'fertile land', 'Sol Council'],
  // agent_crafted {"recipe":"bread","produced":{"bread":1},"tax":{"amount":1,...}}
  agent_crafted:      ['crafted', '1 bread', 'tax'],
  // agent_rested {"energy":85,"gained":30}
  agent_rested:       ['rested', '30 energy'],
  // citizen_action {"action":"rest","lane":"deterministic"}
  citizen_action:     ['chose to', 'deterministic'],
  // claim_started {"x":4,"y":36,"terrain":"forest","ripens_in":5}
  claim_started:      ['staked a claim', 'forest land', '(4,36)'],
  // parcel_claimed {"x":9,"y":17,"terrain":"forest","after_ticks":24}
  parcel_claimed:     ['deed', 'forest land', '(9,17)'],
  // parcel_seized {"x":17,"y":54,"from":"atlas-rp","to":"citizen_ember"}
  parcel_seized:      ['Ember', 'seized the land', '(17,54)', 'Atlas Rp'],
  // agent_moved {"from":[..],"to":[..]}
  agent_moved:        ['walked', 'to ('],
  // tax_set {"x":51,"y":38,"org_name":"Sol Council","rate_bps":500,"owner":"yuna","terrain":"fertile"}
  tax_set:            ['Sol Council', '5% tax', 'fertile land', '(51,38)', 'Yuna'],
  // tax_collected {"x":40,"y":40,"org_name":"Sol Council","amount":1,"on":"gather"}
  tax_collected:      ['Sol Council', 'collected 1', '(40,40)', 'gather'],
  // order_posted {"good":"water","side":"ask","qty":5,"price":4}
  order_posted:       ['5 water', 'at 4'],
  // market_trade {"good":"grain","qty":1,"price":7,"buyer":"citizen_wren","seller":"citizen_solen"}
  market_trade:       ['Wren', 'bought', '1 grain', 'Solen', 'at 7'],
  // contract_offered {"offeror":"mercurio","offeree":"citizen_ember","good":"water","qty":2,"wage":12}
  contract_offered:   ['Mercurio', 'offered', 'Ember', '12', '2 water'],
  // contract_completed — same parties, the delivery side
  contract_completed: ['Ember', 'delivered', '2 water', 'Mercurio', 'paid 12'],
  // org_founded {"name":"Wren & Co","kind":"company","charter":"We pool water..."}
  org_founded:        ['founded', 'Wren & Co', 'company'],
  // org_spent {"name":"Sol Council","to":"quaestor","amount":15,"treasury":1760}
  org_spent:          ['Sol Council', 'paid 15', 'Quaestor'],
  // war_declared {"x":11,"y":19,"terrain":"fertile","defender":"mercatus","stake":15,"cause":"..."}
  war_declared:       ['declared war on', 'Mercatus', 'fertile land', '(11,19)', 'staking 15'],
  // war_resolved {"x":11,"y":19,"winner":"mercatus","loser":"forgemark","attacker_won":false}
  war_resolved:       ['Mercatus', 'held', '(11,19)', 'against', 'Forgemark'],
  // theft {"victim":"citizen_soen","good":"grain","qty":1,"x":45,"y":36,"detected":true}
  theft:              ['stole', '1 grain', 'Soen', '(45,36)'],
  // agent_born {"name":"Soen","parents":[..],"x":45,"y":36,"talents":["build","trade"]}
  agent_born:         ['was born', '(45,36)', 'talent for'],
  // child_proposed {"partner":"citizen_wren","trust":1} — pinned BY NAME because
  // its only data value is a party id, which the generic value check cannot see.
  child_proposed:     ['asked', 'Wren', 'child'],
  // will_written {"beneficiary":"@mint","kind":"state","note":"..."}
  will_written:       ['wrote a will', 'the mint'],
  // uw:searched {"query":"grain","hits":5}
  'uw:searched':      ['searched the underweb', 'grain'],
  // uw:mail {"to":"...@mail.uw","subject":"..."}
  'uw:mail':          ['wrote to'],
  // uw:published {"domain":"...","title":"..."}
  'uw:published':     ['published']
};
const REQUIRE_MIN = 24;   // the floor this table may never fall below

// The types whose sentence deliberately LEADS with a party other than
// `agent_id` — the org that levied the tax, the buyer who took the trade, the
// winner who held the land, the child who was born. Declared, so "the actor is
// named" stays a real assertion everywhere else.
const ALT_LEAD = new Set([
  'market_trade', 'war_resolved', 'war_declared', 'tax_set', 'tax_repealed',
  'tax_collected', 'org_spent', 'org_joined', 'org_role_set', 'org_funded',
  'agent_born', 'parcel_seized', 'parcel_released', 'contract_offered',
  'contract_accepted', 'contract_completed', 'contract_expired',
  'crime_accused', 'law_enacted', 'estate_settled', 'agent_paid'
]);

// The gazette's _SKIP_MIRRORS, read from the SERVER's own source rather than
// retyped, so the fixture's arithmetic and the page's taxonomy cannot drift.
const MIRROR_TYPES = new Set((() => {
  try {
    const gz = fs.readFileSync('/home/vinta/vintinuum-api/world/world-gazette.js', 'utf8');
    const m = /_SKIP_MIRRORS\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(gz);
    return (m[1].match(/'([^']+)'/g) || []).map((x) => x.slice(1, -1));
  } catch (e) { console.error('cannot read the gazette mirror set: ' + e.message); process.exit(2); }
})());

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

// ── THE CONTROL PATCHES — applied to the SERVED bytes, never the tree ──────
function patch(rel, src) {
  if (rel !== 'body/world/world-pulse.js') return src;
  const bite = (label, from, to) => {
    const n = src.split(from).length - 1;
    if (n !== 1) {
      console.error(`CONTROL ABORT: --control-${label}'s anchor matched ${n} times (want exactly 1); the tally below would NOT be evidence.`);
      console.error(`  wanted: ${JSON.stringify(from)}`);
      process.exit(2);
    }
    src = src.split(from).join(to);
  };
  // C only: the id dedupe. Without it a re-read of the boundary tick doubles
  // every row it returns.
  if (CTL.nodedupe) bite('nodedupe', 'if (id === null || _seen[id]) continue;', 'if (id === null) continue;');
  // C only: `since` is EXCLUSIVE. Storing next_since verbatim means every event
  // its own tick writes AFTER the poll is never asked for again, and the clock
  // advances in a 60s burst — so most of a tick is lost, permanently.
  if (CTL.sinceverbatim) bite('sinceverbatim', '_since = Math.max(0, nxt - 1);', '_since = Math.max(0, nxt);');
  // B only: the 3WCDCFV benign-return shape — every type falls through to the
  // bare-verb fallback, so no sentence names an actor or carries a value.
  if (CTL.typename) bite('typename', 'if (text && String(text).trim()) {', 'if (false) {');
  // E only: the scrubber AND the textContent row. Both, because either alone is
  // doubly fail-closed and a control that cannot go red proves nothing
  // (UB8NTTR) — the pair is what lets an authored string become markup.
  if (CTL.noscrub) {
    bite('noscrub-fn', '  function scrub(s) {',
      '  function scrub(s) { return String(s == null ? \'\' : s); }\n  function _scrubDead(s) {');
    bite('noscrub-dom', '    say.textContent = r.text;', '    say.innerHTML = r.text;');
  }
  // F only: the short-viewport compression. MEASURED without it at 393x420:
  // chips 86px, feed 16px, and #wpBody 12px PAST the sheet's content box.
  if (CTL.nocap) bite('nocap', "      '@media (max-height:620px){',", "      '@media (max-height:0px){',");
  // F only: the dock obstacle. MEASURED without it: #vwg-pill (z-index
  // 2147483600) lands a 97x44 tappable control on the sheet at 375x667 and
  // 393x852, and takes the hit-test for the CLOSE button at 375x667.
  if (CTL.nodock) bite('nodock', 'W.VintDock.avoid(_sheet, { corner: \'br\' });', 'void 0;');
  return src;
}

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const rel = p.replace(/^\/+/, '');
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('no'); }
        const ext = path.extname(file).toLowerCase();
        if (ext === '.js' && ANYCTL) {
          try { buf = Buffer.from(patch(rel, buf.toString('utf8')), 'utf8'); } catch (_) {}
        }
        res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// The world's own tick, and the two pages a poller sees. PAGE_A is newest-first
// like the real endpoint; PAGE_B re-reads the boundary tick exactly as the live
// `since = next_since - 1` loop does, so the dedupe is measured on real overlap.
const TICK = 17323;
const byTickDesc = (a, b) => (b.tick - a.tick) || (b.id - a.id);
const SORTED = FIXTURE_EVENTS.slice().sort(byTickDesc);
// THE BOUNDARY TICK, AND WHY IT IS THE WHOLE POINT. world-state.js answers
// `WHERE tick > ?` strictly and hands back next_since = the current tick, and
// the economy clock advances in a 60-second BURST. So a poll that lands
// mid-burst sees some of the tick and not the rest, and a poller that stores
// next_since verbatim never asks for that tick again — the remainder is lost
// for good. The fixture reproduces exactly that: poll 1 returns everything
// EXCEPT the boundary tick's rows (it landed mid-burst), and every later poll
// is answered the way the real route answers it, `tick > since`.
const BOUNDARY = SORTED.filter((e) => e.tick === TICK);
const MIDBURST = SORTED.filter((e) => e.tick < TICK);
// the deeds that exist ONLY in the boundary tick — what a wrong `since` loses.
// Measured on the fixture: one non-mirror row, `law_enacted` (the only law the
// world has ever enacted), plus its own mirror.
const LATE_SHOWABLE = BOUNDARY.filter((e) => !MIRROR_TYPES.has(e.type));
function statePayload(events, nextSince) {
  const by_type = {};
  for (const e of FIXTURE_EVENTS) by_type[e.type] = (by_type[e.type] || 0) + 1;
  return {
    tick: TICK, tick_space: 'economy', ticks_per_day: 24,
    since: 0, since_requested: 0, since_default: false, clamped: false,
    clamped_reason: null, next_since: nextSince === undefined ? TICK : nextSince,
    window_ticks: 24, limits: { events: 500, parcels: 500, trades: 200, default_window_ticks: 24 },
    parcels: { parcels: [], parcels_total: 0, parcels_returned: 0, truncated: false, limit: 200 },
    prices: { prices: [], goods: [], trades: [], trades_total: 0, trades_returned: 0, truncated: false, limit: 50, goods_changed: [] },
    events: { events: events, events_total: 200290, events_matched: 200290,
      events_returned: events.length, truncated: true, limit: 200, beats_only: false, by_type }
  };
}
// A hostile world: an agent authored a cause, a charter and a subject that all
// try to be markup. The pulse must print them, never run them.
const HOSTILE = '<img src=x onerror="window.__PWNED=1">"\'<script>window.__PWNED2=1</script>';
const HOSTILE_EVENTS = [
  { id: 990001, tick: TICK, type: 'war_declared', agent_id: 'citizen_sol',
    data: { war_id: 'w1', x: 1, y: 2, terrain: 'forest', attacker: 'citizen_sol',
      defender: 'citizen_wren', stake: 7, cause: HOSTILE, resolve_tick: TICK + 7 } },
  { id: 990002, tick: TICK, type: 'org_founded', agent_id: 'citizen_wren',
    data: { org_id: 'org:x', name: HOSTILE, kind: 'company', charter: HOSTILE } },
  { id: 990003, tick: TICK, type: 'uw:mail', agent_id: 'citizen_ember',
    data: { to: 'citizen_sol@mail.uw', from: 'citizen_ember@mail.uw', subject: HOSTILE, bytes: 9 } },
  // An UNKNOWN verb: the world grew a type this page has never seen. It must
  // still render, and it must be NAMED in the footer (DHTXG92).
  { id: 990004, tick: TICK, type: 'moon_hallowed', agent_id: 'citizen_sol', data: { phase: 'full' } }
];

function killTransitions() {
  const s = document.createElement('style');
  s.textContent = '*{transition:none !important;animation:none !important}html{scroll-behavior:auto !important}';
  document.head.appendChild(s);
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    timeout: 120000, protocolTimeout: 180000 });

  const failures = [], notes = [];
  let checks = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const add = (m) => failures.push(m);
  const is = (label, cond) => { checks++; if (!cond) add(label); };
  const eqv = (label, got, want) => {
    checks++;
    if (got !== want) add(`${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  };
  const note = (s) => notes.push(s);

  async function loadPage(w, h) {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setRequestInterception(true);
    page.__pollN = 0;
    page.on('request', (req) => {
      const u = req.url();
      const json = (body) => req.respond({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      // a live service worker would answer same-origin fetches itself and the
      // page would never see a stub.
      if (/\/sw\.js(\?|$)/.test(u)) return req.respond({ status: 404, body: '' });
      if (u.includes('/api/world/state')) {
        page.__pollN++;
        const m = /[?&]since=(\d+)/.exec(u);
        page.__lastSince = m ? Number(m[1]) : null;
        // First poll: no `since` -> the server's default window, the whole page.
        // Later polls: the boundary tick again, which is exactly what a correct
        // `next_since - 1` loop asks for.
        // `tick > since`, exactly as world-state.js answers it — and a poll
        // with NO `since` is the one that landed mid-burst, so it cannot see
        // the boundary tick's rows. No counter: any number of polls behaves
        // like the real route, so this cannot race the page's own cadence.
        const since = page.__lastSince;
        const evs = since === null ? MIDBURST : SORTED.filter((e) => e.tick > since);
        return json(statePayload(evs));
      }
      if (u.includes('/api/world/citizens')) return json({ citizens: FIXTURE_CITIZENS });
      if (u.includes('/api/world/parcels')) return json({ w: 2, h: 2, terrain: 'ffff', legend: { f: 'flat' }, claims: [] });
      if (u.includes('/api/world/economy')) return json({ tick: TICK, tick_rate_ms: 60000, snapshot_every_ticks: 24, snapshot_keep: 14, behind_s: 2, behind_ticks: 0 });
      if (u.includes('/api/world/health')) return json({ economy_tick: TICK });
      if (/\/api\/world\/agents?\/[^/?]+/.test(u)) return json({ id: 'citizen_ember', wallet: {}, reputation: 100 });
      if (u.includes('/api/world/agents')) return json({ agents: FIXTURE_CITIZENS });
      if (u.includes('/api/world/cost')) return json({ day: '2026-11-18', tokens_today: 10, token_budget: 2e6, pct_display: 1, per_agent: [] });
      if (u.includes('/api/world/timeline')) return json({ days: [] });
      if (/^https?:\/\/(api\.vintaclectic\.com|localhost:8767)/.test(u)) return req.abort('connectionrefused');
      return req.continue();
    });
    if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    try { await page.goto(base + '/world.html', { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (_) {}
    await sleep(900);
    await page.evaluate(killTransitions);
    // REACH lives in THIS file (one definition, used by every lane); install it
    // into the page so the clipped hit-test runs where the layout is.
    await page.evaluate((src) => { window.REACH_FN = eval('(' + src + ')'); }, REACH.toString());
    await page.waitForFunction(() => !!window.VintWorldPulse, { timeout: 20000 }).catch(() => {});
    return page;
  }

  // Open through the page's OWN api, then wait for a STABLE key over every
  // element the checks read — the sheet's subtree AND the fixed furniture,
  // whose rects move on their own schedule once the sheet reflows the page
  // (9SABEEP: a settle keyed only on the subject races the furniture).
  async function openSheet(page) {
    await page.evaluate(() => { try { window.VintWorldPulse.open(); } catch (_) {} });
    await page.waitForFunction(() => {
      const s = document.getElementById('dvWorldPulseSheet');
      return !!(s && s.classList.contains('open'));
    }, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => {
      const s = document.getElementById('dvWorldPulseSheet');
      if (!s) return false;
      const parts = [];
      for (const el of s.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        parts.push((el.id || el.className || el.tagName) + ':' + Math.round(r.top) + ',' +
          Math.round(r.left) + ',' + Math.round(r.width) + ',' + Math.round(r.height));
      }
      for (const el of document.body.querySelectorAll('*')) {
        const st = getComputedStyle(el);
        if (st.position !== 'fixed' && st.position !== 'sticky') continue;
        if (st.visibility === 'hidden' || st.display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width * r.height < 1) continue;
        parts.push('F' + (el.id || el.tagName) + ':' + Math.round(r.top) + ',' +
          Math.round(r.left) + ',' + Math.round(r.width) + ',' + Math.round(r.height));
      }
      const key = parts.join('|');
      window.__wpKeys = (window.__wpKeys || []).concat([key]).slice(-4);
      return window.__wpKeys.length === 4 && window.__wpKeys.every((k) => k === key);
    }, { timeout: 25000, polling: 160 }).catch(() => {});
  }

  // ── MEASURE: geometry, in the page ────────────────────────────────────────
  const MEASURE = () => {
    const id = (el) => el.id || (el.tagName.toLowerCase() + '.' + String(el.className || '').trim().split(/\s+/).slice(0, 2).join('.'));
    const s = document.getElementById('dvWorldPulseSheet');
    const out = { ok: !!(s && s.classList.contains('open')), vw: innerWidth, vh: innerHeight,
      overflow: [], pairs: [], fixedExcluded: 0, rows: [], chips: [] };
    if (!out.ok) return out;
    const sr = s.getBoundingClientRect();
    out.sheet = { t: sr.top, l: sr.left, w: sr.width, h: sr.height, b: sr.bottom, r: sr.right };
    const body = s.querySelector('.dv-body');
    const feed = document.getElementById('wpFeed');
    const chipband = document.getElementById('wpChips');
    if (body) {
      const br = body.getBoundingClientRect();
      out.body = { t: br.top, h: br.height, scrollH: body.scrollHeight, clientH: body.clientHeight,
        scrolls: body.scrollHeight > body.clientHeight + 1,
        overflowY: getComputedStyle(body).overflowY };
    }
    if (chipband) {
      const cr = chipband.getBoundingClientRect();
      const cs = getComputedStyle(chipband);
      out.chipband = { t: cr.top, h: cr.height, overflowY: cs.overflowY,
        maxH: cs.maxHeight, scrollH: chipband.scrollHeight, clientH: chipband.clientHeight };
    }
    if (feed) {
      const fr = feed.getBoundingClientRect();
      out.feed = { t: fr.top, l: fr.left, w: fr.width, h: fr.height, b: fr.bottom, r: fr.right,
        n: feed.querySelectorAll('.wp-row').length };
    }
    for (const b of s.querySelectorAll('.wp-chip')) {
      const r = b.getBoundingClientRect();
      out.chips.push({ label: (b.textContent || '').trim(), chip: b.getAttribute('data-chip'),
        on: b.classList.contains('on'), w: r.width, h: r.height });
    }
    for (const r0 of s.querySelectorAll('.wp-row')) {
      const r = r0.getBoundingClientRect();
      out.rows.push({ type: r0.getAttribute('data-type'), lane: r0.getAttribute('data-lane'),
        tick: Number(r0.getAttribute('data-tick')),
        text: (r0.querySelector('.wp-say') || {}).textContent || '',
        t: r.top, l: r.left, w: r.width, h: r.height, b: r.bottom, r: r.right });
    }

    // ── OVERFLOW: every descendant against the CONTENT BOX of its nearest
    //    scroll ancestor (a child of a scroller legitimately extends past the
    //    scroller's visible box — that is what scrolling IS), and against the
    //    viewport.
    const inner = (el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return { l: r.left + parseFloat(cs.borderLeftWidth || 0) + parseFloat(cs.paddingLeft || 0),
        r: r.right - parseFloat(cs.borderRightWidth || 0) - parseFloat(cs.paddingRight || 0),
        t: r.top + parseFloat(cs.borderTopWidth || 0) + parseFloat(cs.paddingTop || 0),
        b: r.bottom - parseFloat(cs.borderBottomWidth || 0) - parseFloat(cs.paddingBottom || 0) };
    };
    const flowEls = [], flow = [];
    for (const el of s.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 1) continue;
      if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky') { out.fixedExcluded++; continue; }
      flowEls.push(el); flow.push({ id: id(el), l: r.left, r: r.right, t: r.top, b: r.bottom });
      // horizontal overflow past the viewport is never legitimate
      if (r.right > innerWidth + 1 || r.left < -1) {
        out.overflow.push({ id: id(el), viewportX: true, dr: Math.round(r.right - innerWidth), dl: Math.round(-r.left) });
      }
      // vertical: only measured against a NON-scrolling ancestor box
      let sc = null;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (/(auto|scroll)/.test(ps.overflowY) || /(auto|scroll)/.test(ps.overflowX)) { sc = p; break; }
        if (p === s) { sc = p; break; }
      }
      if (sc && sc === s) {
        const box = inner(sc);
        const over = Math.max(0, Math.round(box.t - r.top)) + Math.max(0, Math.round(r.bottom - box.b));
        if (over > 1) out.overflow.push({ id: id(el), over, inside: id(sc) });
      }
    }
    // ── THE DOCKED ACCOUNT PILL. It is position:fixed with a z-index near
    //    INT_MAX, so it is excluded from the pairwise FLOW set above and must
    //    be measured on its own: it is the one float on this page that can
    //    legitimately sit over a sheet, and the fix is to register the sheet
    //    with body/corner_dock.js rather than to fight its z-index.
    const pill = document.getElementById('vwg-pill') || document.getElementById('vwg-dot');
    if (pill) {
      const pr = pill.getBoundingClientRect();
      const ox = Math.min(pr.right, sr.right) - Math.max(pr.left, sr.left);
      const oy = Math.min(pr.bottom, sr.bottom) - Math.max(pr.top, sr.top);
      out.pill = { id: pill.id, z: getComputedStyle(pill).zIndex,
        ox: Math.round(ox), oy: Math.round(oy), overlaps: ox > 1 && oy > 1,
        rect: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)] };
    }

    // ── PAIRWISE OVERLAP over FLOW siblings only, DOM ancestry excluded by
    //    asking the DOM (a scrolling parent does not enclose its child).
    for (let i = 0; i < flow.length; i++) for (let j = i + 1; j < flow.length; j++) {
      if (flowEls[i].contains(flowEls[j]) || flowEls[j].contains(flowEls[i])) continue;
      const a = flow[i], b = flow[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
      const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ox > 1 && oy > 1) out.pairs.push({ a: a.id, b: b.id, ox: Math.round(ox), oy: Math.round(oy) });
    }
    return out;
  };

  // reachability: scroll each ancestor by ITS OWN scrollTop (never
  // scrollIntoView, which walks up and scrolls the document too — S3U2BDT),
  // clip to every scroll ancestor and the viewport, then hit-test the centre.
  const REACH = (sel) => {
    const target = document.querySelector(sel);
    if (!target) return null;
    const anc = [];
    for (let n = target.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) anc.push(n);
      if (n === document.body) break;
    }
    for (const sc of anc) {
      const sr = sc.getBoundingClientRect(), tr = target.getBoundingClientRect();
      const dy = (tr.top - sr.top) - (sc.clientHeight - tr.height) / 2;
      sc.scrollTop = Math.max(0, Math.min(sc.scrollTop + dy, sc.scrollHeight - sc.clientHeight));
      const dx = (tr.left - sr.left) - (sc.clientWidth - tr.width) / 2;
      sc.scrollLeft = Math.max(0, Math.min(sc.scrollLeft + dx, sc.scrollWidth - sc.clientWidth));
    }
    const r = target.getBoundingClientRect();
    let cl = Math.max(r.left, 0), cr = Math.min(r.right, innerWidth);
    let ct = Math.max(r.top, 0), cb = Math.min(r.bottom, innerHeight);
    for (const sc of anc) {
      const sr = sc.getBoundingClientRect();
      cl = Math.max(cl, sr.left); cr = Math.min(cr, sr.right);
      ct = Math.max(ct, sr.top); cb = Math.min(cb, sr.bottom);
    }
    const okBox = cr - cl > 1 && cb - ct > 1;
    const hit = okBox ? document.elementFromPoint((cl + cr) / 2, (ct + cb) / 2) : null;
    return { visible: okBox, own: !!(hit && (hit === target || target.contains(hit) || hit.contains(target))),
      hitId: hit ? (hit.id || hit.tagName.toLowerCase() + '.' + String(hit.className || '').slice(0, 24)) : null };
  };

  // ════ GROUPS A/B/C/D/E/G — one page, the full fixture ═══════════════════════
  {
    const page = await loadPage(1280, 900);

    // ── A. COVERAGE — every live type classified, exactly once ──────────────
    const cov = await page.evaluate((types) => {
      const P = window.VintWorldPulse;
      const phrase = new Set(P.types()), mirror = new Set(P.mirrors());
      const out = { phrase: phrase.size, mirror: mirror.size, missing: [], both: [], quiet: P.quiet() };
      for (const t of types) {
        const inP = phrase.has(t), inM = mirror.has(t);
        if (!inP && !inM) out.missing.push(t);
        if (inP && inM) out.both.push(t);
      }
      return out;
    }, FIXTURE_EVENTS.map((e) => e.type));

    // VACUITY GUARD: a broken fixture must fail loudly, never pass with
    // nothing to check.
    is(`A1 the fixture carries every type the live world emits (>=49) — got ${FIXTURE_EVENTS.length}`,
      FIXTURE_EVENTS.length >= 49);
    is(`A2 every live type is in PHRASE or MIRRORS — unclassified: ${cov.missing.join(', ')}`,
      cov.missing.length === 0);
    is(`A3 no type is in BOTH PHRASE and MIRRORS — ${cov.both.join(', ')}`, cov.both.length === 0);
    is(`A4 the phrase book is non-trivial (>=35 types) — got ${cov.phrase}`, cov.phrase >= 35);
    // The pulse and the gazette must agree about which rows are the same deed
    // twice, so MIRRORS is asserted against the SERVER's own set, read out of
    // world-gazette.js rather than retyped here.
    const gz = fs.readFileSync('/home/vinta/vintinuum-api/world/world-gazette.js', 'utf8');
    const mblk = /_SKIP_MIRRORS\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(gz);
    is('A5 world-gazette._SKIP_MIRRORS is readable (the set to agree with)', !!mblk);
    if (mblk) {
      const want = (mblk[1].match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)).sort();
      const got = cov.mirror.slice ? cov.mirror.slice().sort() : [];
      const gotArr = (await page.evaluate(() => window.VintWorldPulse.mirrors())).sort();
      is(`A6 the pulse's MIRRORS equals the gazette's _SKIP_MIRRORS — pulse ${gotArr.join(',')} vs gazette ${want.join(',')}`,
        gotArr.join(',') === want.join(','));
      note(`mirrors agreed with the gazette: ${want.length} types`);
    }

    // ── B. SENTENCES — actor, action, object; no raw type names ─────────────
    const MIRROR_SET = new Set(await page.evaluate(() => window.VintWorldPulse.mirrors()));
    const PHRASABLE = FIXTURE_EVENTS.filter((e) => !MIRROR_SET.has(e.type));
    const said = await page.evaluate((evs) => {
      const P = window.VintWorldPulse;
      const out = {};
      for (const e of evs) {
        const d = P.describe(e);
        out[e.type] = { text: d.text, lane: d.lane, unphrased: d.unphrased, mirror: !!d.mirror };
      }
      return out;
    }, PHRASABLE);
    // and the seam must SAY a mirror is a mirror rather than counting it as a
    // verb nobody phrased.
    const mirrorVerdict = await page.evaluate((evs) => {
      const P = window.VintWorldPulse;
      return evs.map((e) => { const d = P.describe(e); return { t: e.type, mirror: !!d.mirror, un: !!d.unphrased }; });
    }, FIXTURE_EVENTS.filter((e) => MIRROR_SET.has(e.type)));
    is(`B-M a mirrored row is reported as a MIRROR, never as unphrased — ${JSON.stringify(mirrorVerdict.filter((v) => !v.mirror || v.un))}`,
      mirrorVerdict.length > 0 && mirrorVerdict.every((v) => v.mirror && !v.un));

    const nameOf = {};
    for (const c of FIXTURE_CITIZENS) nameOf[c.id] = c.display_name;
    const pretty = (idv) => {
      const raw = String(idv == null ? '' : idv);
      if (nameOf[raw]) return nameOf[raw];
      const s2 = raw.replace(/^citizen_/, '');
      if (!s2) return 'someone';
      if (s2[0] === '@') return s2.slice(1) === 'mint' ? 'the mint' : s2.slice(1);
      return s2[0].toUpperCase() + s2.slice(1);
    };

    is(`B0 the explicit sentence table still has >=${REQUIRE_MIN} types — got ${Object.keys(REQUIRE).length}`,
      Object.keys(REQUIRE).length >= REQUIRE_MIN);

    let phrasedN = 0;
    for (const e of PHRASABLE) {
      const r = said[e.type];
      phrasedN++;
      is(`B1 ${e.type}: produced a sentence`, !!(r && r.text && r.text.trim().length > 8));
      if (!r || !r.text) continue;
      const t = r.text;
      is(`B2 ${e.type}: the phrase book recognised it (not the unphrased fallback) — "${t}"`, r.unphrased === false);
      // ACTION: never the raw type name, and a real stop at the end.
      is(`B3 ${e.type}: no raw type name in the prose — "${t}"`,
        t.indexOf(e.type) < 0 && t.indexOf(e.type.replace(/[_:]/g, ' ')) < 0);
      is(`B4 ${e.type}: reads as a sentence (capital, stop, >=4 words) — "${t}"`,
        /^[A-Z‘-”]/.test(t.trim()) && /[.]$/.test(t.trim()) && t.trim().split(/\s+/).length >= 4);
      // ACTOR: the acting party is NAMED. Types whose line deliberately leads
      // with another party are declared in ALT_LEAD, and there the actor's name
      // OR a named counterparty must appear — never nobody.
      const parties = [e.agent_id];
      for (const k of ['buyer', 'seller', 'winner', 'loser', 'attacker', 'defender', 'victim',
                       'accused', 'child', 'member', 'by', 'to', 'from', 'offeror', 'offeree',
                       'partner', 'beneficiary', 'owner', 'thief', 'author']) {
        const v = e.data && e.data[k];
        if (typeof v === 'string' && v) parties.push(v);
      }
      if (Array.isArray(e.data && e.data.parents)) parties.push.apply(parties, e.data.parents);
      const names = parties.filter(Boolean).map(pretty);
      const orgName = (e.data && typeof e.data.name === 'string') ? e.data.name : null;
      const orgName2 = (e.data && typeof e.data.org_name === 'string') ? e.data.org_name : null;
      const leads = ALT_LEAD.has(e.type)
        ? names.some((nm) => t.indexOf(nm) >= 0) || (orgName && t.indexOf(orgName) >= 0) || (orgName2 && t.indexOf(orgName2) >= 0)
        : t.indexOf(pretty(e.agent_id)) >= 0;
      is(`B5 ${e.type}: the actor is named — wanted ${ALT_LEAD.has(e.type) ? 'one of ' + names.join('/') : pretty(e.agent_id)} in "${t}"`, !!leads);
      // OBJECT: at least one value out of the event's OWN data reaches the page,
      // so a sentence cannot be true-sounding and contentless.
      const vals = [];
      const walk = (o, depth) => {
        if (!o || depth > 2) return;
        for (const k in o) {
          const v = o[k];
          if (typeof v === 'number' && isFinite(v) && Math.abs(v) >= 1) vals.push(String(v));
          else if (typeof v === 'string' && v.length >= 3 && v.length <= 40 && !/^(org:|crm_|war_|kin_)/.test(v)) {
            // a value that IS a party reaches the prose as that party's NAME —
            // that is the name book working, not the value going missing.
            vals.push(v.replace(/_/g, ' '));
            vals.push(pretty(v));
          } else if (v && typeof v === 'object') walk(v, depth + 1);
        }
      };
      walk(e.data, 0);
      const hasVal = vals.some((v) => t.indexOf(v) >= 0);
      is(`B6 ${e.type}: a value from the event reaches the prose — none of [${vals.slice(0, 8).join(' | ')}] in "${t}"`,
        vals.length === 0 ? true : hasVal);
      // the explicit table, where one exists
      if (REQUIRE[e.type]) {
        for (const want of REQUIRE[e.type]) {
          is(`B7 ${e.type}: the line says ${JSON.stringify(want)} — "${t}"`, t.indexOf(want) >= 0);
        }
      }
    }
    note(`phrased ${phrasedN} non-mirror types; ${Object.keys(REQUIRE).length} of them pinned word-for-word`);

    // ── C. POLLING — exclusive `since`, boundary re-read, id dedupe ─────────
    await openSheet(page);
    // A CLEAN STORE AND TWO DELIBERATE POLLS. The page polls on mount (1.4s),
    // on open, and every 15s; measuring "what it holds right now" measures the
    // cadence, not the contract. Reset, then take exactly two polls by hand.
    await page.evaluate(() => window.VintWorldPulse._reset());
    page.__lastSince = null;
    await page.evaluate(() => new Promise((r) => window.VintWorldPulse.refresh(r)));
    const p1 = await page.evaluate(() => ({ rows: window.VintWorldPulse.rows().length,
      since: window.VintWorldPulse.since(), tick: window.VintWorldPulse.tick(),
      folded: window.VintWorldPulse.folded() }));
    eqv(`C1 after the first poll the page asks next for the BOUNDARY tick (tick-1)`, p1.since, TICK - 1);
    eqv('C2 the page carries the world tick it was told', p1.tick, TICK);
    const showable = FIXTURE_EVENTS.filter((e) => !MIRROR_TYPES.has(e.type));
    const midShowable = MIDBURST.filter((e) => !MIRROR_TYPES.has(e.type));
    eqv(`C3 the mid-burst poll rendered every showable row it was given`, p1.rows, midShowable.length);
    eqv('C4 the mirrored rows it was given were folded, and counted',
      p1.folded, MIDBURST.length - midShowable.length);
    is(`C4b the boundary tick's deed is NOT on the page yet (the poll landed mid-burst) — ${LATE_SHOWABLE.map((e) => e.type).join(',')}`,
      LATE_SHOWABLE.length > 0 &&
      !(await page.evaluate((ids) => window.VintWorldPulse.rows().some((r) => ids.indexOf(r.id) >= 0),
        LATE_SHOWABLE.map((e) => e.id))));
    // re-poll: the server hands back the SAME boundary-tick rows. A page that
    // dedupes by id gains nothing; one that does not doubles them.
    await page.evaluate(() => new Promise((r) => window.VintWorldPulse.refresh(r)));
    await sleep(200);
    const p2 = await page.evaluate(() => {
      const rows = window.VintWorldPulse.rows();
      const ids = {}; let dupes = 0;
      for (const r of rows) { if (ids[r.id]) dupes++; ids[r.id] = 1; }
      return { rows: rows.length, dupes, polls: null };
    });
    // ONE number proves both halves: the overlap deduped AND nothing lost.
    eqv(`C5 the next poll gained EXACTLY the late deeds — no duplicates, nothing lost`,
      p2.rows, showable.length);
    eqv('C6 no two lines share an event id', p2.dupes, 0);
    is(`C6b the boundary tick's deed REACHED the page — ${LATE_SHOWABLE.map((e) => e.type).join(',')}`,
      await page.evaluate((ids) => {
        const rows = window.VintWorldPulse.rows();
        return ids.every((i) => rows.some((r) => r.id === i));
      }, LATE_SHOWABLE.map((e) => e.id)));
    const polls = page.__pollN;
    is(`C7 the page really did poll /api/world/state at least twice — got ${polls}`, polls >= 2);
    eqv(`C8 the second poll asked for the boundary tick`, page.__lastSince, TICK - 1);

    // ── D. RENDER + FILTER ──────────────────────────────────────────────────
    const d1 = await page.evaluate(() => {
      const rows = [].slice.call(document.querySelectorAll('#wpFeed .wp-row'));
      return { n: rows.length,
        ticks: rows.map((r) => Number(r.getAttribute('data-tick'))),
        types: rows.map((r) => r.getAttribute('data-type')),
        first: (rows[0] && rows[0].querySelector('.wp-say').textContent) || '',
        note: (document.getElementById('wpNote') || {}).textContent || '' };
    });
    is(`D1 the feed rendered rows — got ${d1.n}`, d1.n > 10);
    is('D2 the newest line is first (ticks are non-increasing)',
      d1.ticks.every((t, i) => i === 0 || d1.ticks[i - 1] >= t));
    const quiet = await page.evaluate(() => window.VintWorldPulse.quiet());
    is(`D3 "everything" folds the quiet types out of the view — found ${d1.types.filter((t) => quiet.indexOf(t) >= 0).join(',')}`,
      d1.types.every((t) => quiet.indexOf(t) < 0));
    is(`D4 the footer reports the tick and the record size — "${d1.note.slice(0, 120)}"`,
      d1.note.indexOf('tick ' + TICK) >= 0 && /deeds on the record/.test(d1.note));
    // every chip filters to its own lanes, and nothing is unreachable
    for (const chip of ['build', 'trade', 'strife', 'life', 'web', 'all']) {
      const r = await page.evaluate((c) => {
        window.VintWorldPulse.chip(c);
        const rows = [].slice.call(document.querySelectorAll('#wpFeed .wp-row'));
        return { n: rows.length, lanes: Array.from(new Set(rows.map((x) => x.getAttribute('data-lane')))) };
      }, chip);
      const want = { build: ['work', 'land'], trade: ['market'], strife: ['war', 'crime'],
        life: ['life'], web: ['web'], all: null }[chip];
      is(`D5 chip "${chip}" shows lines — got ${r.n}`, r.n > 0);
      if (want) is(`D6 chip "${chip}" shows only ${want.join('/')} — got ${r.lanes.join(',')}`,
        r.lanes.every((l) => want.indexOf(l) >= 0));
    }
    // the quiet types ARE reachable — through the lane that owns them
    const reachQuiet = await page.evaluate(() => {
      window.VintWorldPulse.chip('build');
      const types = [].slice.call(document.querySelectorAll('#wpFeed .wp-row')).map((r) => r.getAttribute('data-type'));
      return types.indexOf('citizen_action') >= 0;
    });
    is('D7 a quiet type is still reachable through its own chip (nothing is unreachable)', reachQuiet);
    await page.evaluate(() => window.VintWorldPulse.chip('all'));

    // ── E. SAFETY + G. LOUDNESS — a hostile world, and an unknown verb ──────
    const safe = await page.evaluate((evs) => {
      window.__PWNED = 0; window.__PWNED2 = 0;
      // group B drove describe() over every type by hand; reset so the tally
      // below measures the INGESTED world and nothing else.
      window.VintWorldPulse._reset();
      window.VintWorldPulse._ingest({ tick: evs[0].tick, next_since: evs[0].tick,
        events: { events: evs, events_total: 1, by_type: {} } });
      window.VintWorldPulse.chip('all');
      const rows = [].slice.call(document.querySelectorAll('#wpFeed .wp-row'));
      const feed = document.getElementById('wpFeed');
      return {
        pwned: !!(window.__PWNED || window.__PWNED2),
        imgs: feed.querySelectorAll('img, script, iframe').length,
        rawLt: feed.innerHTML.indexOf('&lt;img') >= 0 || /<img/i.test(feed.innerHTML),
        sawHostile: rows.some((r) => /onerror/.test(r.querySelector('.wp-say').textContent)),
        unknown: rows.filter((r) => r.getAttribute('data-type') === 'moon_hallowed')
          .map((r) => r.querySelector('.wp-say').textContent),
        note: (document.getElementById('wpNote') || {}).textContent || '',
        unphrased: window.VintWorldPulse.unphrased()
      };
    }, HOSTILE_EVENTS);
    is('E1 an agent-authored string did NOT execute', safe.pwned === false);
    eqv('E2 no element was created out of an agent-authored string', safe.imgs, 0);
    is('E3 no raw <img survives in the feed markup', safe.rawLt === false);
    is('E4 the hostile text is still PRINTED (scrubbed, never swallowed)', safe.sawHostile === true);
    is(`G1 an unknown verb still renders — got ${JSON.stringify(safe.unknown)}`, safe.unknown.length === 1);
    // The footer names the type VERBATIM (`moon_hallowed`, not "moon hallowed"),
    // because the reader of that line is whoever has to add the phrase and a
    // greppable type is what they need. The row's own prose is the prettified
    // form; the footer's is the identifier.
    is(`G2 the unknown verb is NAMED in the footer, verbatim — "${safe.note.slice(-140)}"`,
      /Unphrased:/.test(safe.note) && safe.note.indexOf('moon_hallowed') >= 0);
    is(`G2b the row itself reads the verb as prose — ${JSON.stringify(safe.unknown)}`,
      safe.unknown.length === 1 && /moon hallowed/.test(safe.unknown[0]) && /Sol/.test(safe.unknown[0]));
    is('G3 the unknown verb is counted, by type', !!safe.unphrased.moon_hallowed);
    is(`G4 only the unknown verb is unphrased — got ${Object.keys(safe.unphrased).join(',')}`,
      Object.keys(safe.unphrased).join(',') === 'moon_hallowed');

    await page.close().catch(() => {});
  }

  // ════ GROUP F — THE COLLISION SWEEP ════════════════════════════════════════
  for (const [vw, vh] of VIEWPORTS) {
    const lane = `${vw}x${vh}`;
    const page = await loadPage(vw, vh);
    try {
      await openSheet(page);
      const m = await page.evaluate(MEASURE);
      is(`F0 ${lane}: the pulse sheet opened`, m.ok && m.sheet && m.sheet.h > 20);
      if (!m.ok) { await page.close().catch(() => {}); continue; }

      // the sheet itself must stay inside the viewport horizontally
      is(`F1 ${lane}: the sheet stays inside the viewport — l=${Math.round(m.sheet.l)} r=${Math.round(m.sheet.r)} vw=${m.vw}`,
        m.sheet.l >= -1 && m.sheet.r <= m.vw + 1);
      // THE ACCEPTANCE: the panel scrolls INSIDE its own box
      is(`F2 ${lane}: the feed's own scroller is the sheet body (overflow-y:${m.body && m.body.overflowY})`,
        !!m.body && /(auto|scroll)/.test(m.body.overflowY));
      is(`F3 ${lane}: the body has a bounded height (${Math.round((m.body || {}).clientH)}px) inside a ${Math.round(m.sheet.h)}px sheet`,
        !!m.body && m.body.clientH > 10 && m.body.clientH <= m.sheet.h + 1);
      is(`F4 ${lane}: ${m.feed ? m.feed.n : 0} lines rendered`, !!m.feed && m.feed.n > 5);
      // with 40+ lines the body MUST be scrolling, which is the proof the
      // growth went inward instead of onto a neighbour
      is(`F5 ${lane}: the lines overflow INTO the scroller (scrollH ${m.body && m.body.scrollH} > clientH ${m.body && m.body.clientH})`,
        !!m.body && m.body.scrolls);
      // NOTHING crosses the sheet's own content box
      is(`F6 ${lane}: nothing overflows the sheet — ${JSON.stringify(m.overflow.slice(0, 4))}`, m.overflow.length === 0);
      // NOTHING overlaps anything it was not designed to
      is(`F7 ${lane}: no flow element overlaps another — ${JSON.stringify(m.pairs.slice(0, 4))}`, m.pairs.length === 0);
      note(`${lane}: ${m.fixedExcluded} absolutely/fixed-positioned element(s) excluded from the pairwise set (authored decoration)`);
      // THE CHIP BAND must grow INWARD (MU6GKNH), never evict the feed
      is(`F8 ${lane}: the chip band is capped and scrolls inward (max-height ${m.chipband && m.chipband.maxH}, overflow-y ${m.chipband && m.chipband.overflowY})`,
        !!m.chipband && m.chipband.overflowY !== 'visible' && m.chipband.maxH !== 'none');
      is(`F9 ${lane}: all ${m.chips.length} chips rendered`, m.chips.length === 6);
      // THE PILL. Asserted, not noted: it is a real 97x44 opaque tappable
      // control and it landed ON this sheet before the dock registration.
      is(`F8b ${lane}: the docked account pill does NOT land on the sheet — ${JSON.stringify(m.pill)}`,
        !m.pill || !m.pill.overlaps);
      if (m.pill) note(`${lane}: #${m.pill.id} (z ${m.pill.z}) at ${JSON.stringify(m.pill.rect)}, sheet top ${Math.round(m.sheet.t)} — overlap ${m.pill.overlaps ? m.pill.ox + 'x' + m.pill.oy : 'none'}`);
      // every chip and the close button is REACHABLE
      for (const c of ['all', 'build', 'trade', 'strife', 'life', 'web']) {
        const r = await page.evaluate((sel) => REACH_FN(sel), `#dvWorldPulseSheet .wp-chip[data-chip="${c}"]`)
          .catch(() => null);
        is(`F10 ${lane}: chip "${c}" is on screen and hittable — ${JSON.stringify(r)}`,
          !!r && r.visible && r.own);
      }
      const x = await page.evaluate(() => REACH_FN('#wpX'));
      is(`F11 ${lane}: the close button is hittable — ${JSON.stringify(x)}`, !!x && x.visible && x.own);
      // the first and last rendered line must each be reachable by scrolling
      // the body's OWN scrollTop (one swipe is reachable; nothing is buried)
      const ends = await page.evaluate(() => {
        const rows = document.querySelectorAll('#wpFeed .wp-row');
        if (!rows.length) return null;
        return { first: REACH_FN('#wpFeed .wp-row:first-child'),
                 last: REACH_FN('#wpFeed .wp-row:last-child'), n: rows.length };
      });
      is(`F12 ${lane}: the newest line is reachable — ${JSON.stringify(ends && ends.first)}`,
        !!ends && ends.first && ends.first.visible && ends.first.own);
      is(`F13 ${lane}: the oldest kept line is reachable — ${JSON.stringify(ends && ends.last)}`,
        !!ends && ends.last && ends.last.visible && ends.last.own);
      // ── THE LAUNCHER, MEASURED AGAINST ITS PEERS, NOT AGAINST ZERO ──────
      // The launcher's own state is SHEET-CLOSED (that is when it is used), so
      // it is measured there. And its reachability is asserted RELATIVE to
      // pre-existing launchers, because #dvRail is a shared, 23-launcher,
      // column-reverse, overflow-y:auto column whose arithmetic belongs to
      // dirverse-hud.js, not to this card. MEASURED on HEAD's own buttons with
      // the sheet closed: at 320x568 and 393x420 NONE of #wpBtn, #wsBtn,
      // #gatherBtn or #ctBtn is reachable — the rail lays 858px of launchers
      // above a 176px box and its scrollTop stays pinned at 0 against a max of
      // 682, in BOTH scroll conventions (the negated delta was measured too).
      // That is a pre-existing rail defect at viewport heights <=~570px with a
      // blast radius of every surface on this page; it is reported here and
      // filed separately. What THIS card owes is that its launcher is no worse
      // than theirs, which is an assertion, not a note.
      await page.evaluate(() => { try { window.VintWorldPulse.close(); } catch (_) {} });
      await sleep(400);
      const b = await page.evaluate(() => {
        const el = document.getElementById('wpBtn');
        if (!el) return null;
        const c = el.querySelector('.wp-count');
        const rail = document.getElementById('dvRail');
        const peers = ['wsBtn', 'gatherBtn', 'ctBtn'].map((id) => ({ id, r: REACH_FN('#' + id) }));
        return { reach: REACH_FN('#wpBtn'), badge: c ? c.textContent : null,
          inRail: !!(rail && rail.contains(el)),
          nLaunch: rail ? rail.querySelectorAll('.dv-launch').length : 0,
          railH: rail ? Math.round(rail.clientHeight) : null,
          railScrollH: rail ? rail.scrollHeight : null,
          peers: peers };
      });
      is(`F14 ${lane}: the launcher exists and lives in #dvRail (${b && b.nLaunch} launchers)`, !!b && b.inRail);
      const peerOk = (b && b.peers || []).filter((p) => p.r && p.r.visible && p.r.own).length;
      const mineOk = !!(b && b.reach && b.reach.visible && b.reach.own);
      is(`F15 ${lane}: the launcher is AS reachable as HEAD's own launchers — mine ${mineOk}, peers ${peerOk}/3 (rail ${b && b.railH}px over ${b && b.railScrollH}px of content)`,
        peerOk === 0 ? true : mineOk);
      if (peerOk === 0) {
        note(`${lane}: PRE-EXISTING — no launcher in #dvRail is reachable with the sheet closed ` +
             `(#wsBtn/#gatherBtn/#ctBtn all fail the same way); rail clientH ${b.railH}px vs scrollHeight ${b.railScrollH}px. ` +
             `Not introduced here; filed separately.`);
      }
      is(`F16 ${lane}: the launcher wears the world's tick — "${b && b.badge}"`,
        !!b && b.badge === 't' + TICK);
      // ── and the measured band/feed split, so the trade-off is visible
      //    rather than folklore in a comment (966XX38).
      note(`${lane}: sheet ${Math.round(m.sheet.h)}px = head ${Math.round((m.chipband ? m.chipband.t : 0) - m.sheet.t)}px + chips ${Math.round((m.chipband || {}).h)}px + feed ${Math.round((m.body || {}).clientH)}px (chips scrollH ${(m.chipband || {}).scrollH})`);
      // a long agent-authored string must WRAP, never widen the row
      const wide = await page.evaluate((evs) => {
        window.VintWorldPulse._ingest({ tick: evs[0].tick, next_since: evs[0].tick,
          events: { events: evs, events_total: 1, by_type: {} } });
        const rows = [].slice.call(document.querySelectorAll('#wpFeed .wp-row'));
        const feed = document.getElementById('wpFeed').getBoundingClientRect();
        let worst = 0;
        for (const r of rows) {
          const rr = r.getBoundingClientRect();
          worst = Math.max(worst, Math.round(rr.right - feed.right), Math.round(feed.left - rr.left));
        }
        return { worst, n: rows.length };
      }, HOSTILE_EVENTS);
      is(`F17 ${lane}: a hostile 80-char authored string wraps instead of widening the row — worst overhang ${wide.worst}px`,
        wide.worst <= 1);
    } finally {
      await page.close().catch(() => {});
    }
  }

  await browser.close();
  srv.close();

  const activeCtl = Object.keys(CTL).filter((k) => CTL[k]);
  console.log('');
  console.log('═══ THE PULSE — FVBRSP7 ' + '═'.repeat(46));
  console.log(`lanes: ${VIEWPORTS.map((v) => v.join('x')).join(', ')}`);
  console.log(`fixture: ${FIXTURE_EVENTS.length} real event rows, one per live type, read off the events table 2026-11-18`);
  if (activeCtl.length) console.log(`NEGATIVE CONTROL: ${activeCtl.map((c) => '--control-' + c).join(' ')}`);
  for (const n of notes) console.log('  note: ' + n);
  if (failures.length) {
    console.log('');
    console.log('FAILURES:');
    for (const f of failures) console.log('  - ' + f);
  }
  console.log('');
  console.log(`${checks - failures.length}/${checks} pass`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
