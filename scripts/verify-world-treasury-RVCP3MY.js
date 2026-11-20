#!/usr/bin/env node
'use strict';
/* ───────────────────────────────────────────────────────────────────────────
   verify-world-treasury-RVCP3MY.js

   Proves the REAL daily ledger that replaced body/world/agent-ledger.js's mock:

     · the card's own premise, RE-MEASURED (two of its claims were wrong)
     · the mock is QUARANTINED — it answers null, never a plausible number
     · world/world-treasury.js computes balances and per-in-world-day deltas
       from the real `ledger` journal, exactly, against a throwaway DB
     · the treasury band is wired into #worldMapPanel under the panel's own
       collision contract (flow only, grows inward, polls only while open)
     · the band tells the truth about the unit and about real money

   HERMETIC by default: an in-memory SQLite fixture (BF8J4ZA — a throwaway DB
   whose durability nothing depends on is `:memory:`), no network, no live DB,
   no live service. `--live` adds read-only probes of the public brain.

   THE BRAIN IS A SIBLING REPO (see CLAUDE.md "Two-repo coordination"): the
   server half of this feature lives in ~/vintinuum-api and the client half in
   ~/vintinuum. BRAIN_DIR points at the former and is overridable so this runs
   from a worktree.

   NEGATIVE CONTROLS — each reverts ONE thing, each must go RED, and each must
   fail on a DIFFERENT set of checks (JX6M6BP: two controls with identical
   FAILURES are one control):
     --control-armed    arm the mock by default  → a fabricated 1000 reaches a caller
     --control-noday    hardcode ticks_per_day=1 → the daily buckets are wrong
     --control-mint     fold @mint into citizens → the mint renders as a person
     --control-nodrift  drop the drift field     → a money bug goes invisible
   ─────────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ARGV = process.argv.slice(2);
const CTL = {
  armed:   ARGV.includes('--control-armed'),
  noday:   ARGV.includes('--control-noday'),
  mint:    ARGV.includes('--control-mint'),
  nodrift: ARGV.includes('--control-nodrift'),
};
const LIVE = ARGV.includes('--live');

const CLIENT_DIR = path.resolve(__dirname, '..');
const BRAIN_DIR = process.env.RVCP3MY_BRAIN_DIR || path.join(os.homedir(), 'vintinuum-api');

// The real snapshot spawn must never fire from a test process.
process.env.WORLD_ECONOMY_TEST = '1';

let pass = 0; const fails = [];
function is(label, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + label); }
  else { fails.push(label + (detail ? ' — ' + String(detail).slice(0, 300) : '')); console.log('  FAIL  ' + label + (detail ? ' — ' + String(detail).slice(0, 300) : '')); }
}
function eq(label, got, want) { is(label, got === want, 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
function group(n) { console.log('\n' + n); }
function die(msg) { console.error('\nABORT: ' + msg); process.exit(2); }

/* ── the source under test, read as TEXT for the static groups ──────────── */
function readClient(rel) {
  const p = path.join(CLIENT_DIR, rel);
  if (!fs.existsSync(p)) die('missing client file ' + p);
  return fs.readFileSync(p, 'utf8');
}
function readBrain(rel) {
  const p = path.join(BRAIN_DIR, rel);
  if (!fs.existsSync(p)) die('missing brain file ' + p + ' (set RVCP3MY_BRAIN_DIR)');
  return fs.readFileSync(p, 'utf8');
}

// Own-line comments ONLY (U3VFRJR/E4CS77Y: a naive /\*[\s\S]*?\*\// sweep eats
// whole functions, because a literal like 'Accept: */*' opens a fake comment).
function stripComments(t) {
  return t.replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
          .replace(/^([ \t]*)\/\/[^\n]*$/gm, '$1');
}

const ledgerSrc   = readClient('body/world/agent-ledger.js');
const mapSrc      = readClient('body/world/economy-map.js');
const worldHtml   = readClient('world.html');
const treasurySrc = readBrain('world/world-treasury.js');
const serverSrc   = readBrain('server.js');
const tickSrc     = readBrain('world/world-economy-tick.js');

/* ═══ GROUP A — THE CARD'S PREMISE, RE-MEASURED ══════════════════════════ */
group('A. the premise (the card made two claims about the world; both checked)');

// A1. "localStorage mock". It never was one.
// The count must be taken on a COMMENT-FREE copy. The quarantined module's own
// header NAMES localStorage three times to record this measured correction, so
// a raw grep matches the prose explaining the ban rather than any code
// (S7VCB6C, from inside the file under test). A1b PAYS for the strip: the prose
// really does name the token, so the strip is provably load-bearing and this
// check cannot pass vacuously on a file that simply never mentions it.
eq('A1 agent-ledger.js contains ZERO localStorage IN CODE (it was an IN-MEMORY mock, not a localStorage one)',
   (stripComments(ledgerSrc).match(/localStorage/g) || []).length, 0);
is('A1b the raw file DOES name it (3x, in the header) — so the comment strip above is non-vacuous',
   (ledgerSrc.match(/localStorage/g) || []).length >= 3,
   (ledgerSrc.match(/localStorage/g) || []).length + ' raw mention(s)');
is('A1c and the header records the measurement, so the next reader does not inherit the wrong premise',
   /MEASURED[\s\S]{0,80}localStorage[\s\S]{0,60}was 0/.test(ledgerSrc),
   'no measured correction in the header');

// A2. snapshot_every_ticks / snapshot_keep are DB FILE BACKUPS, not a series.
const snapFn = (() => {
  const i = tickSrc.indexOf('function _triggerDailySnapshot');
  return i < 0 ? '' : tickSrc.slice(i, i + 1400);
})();
is('A2 _triggerDailySnapshot spawns scripts/backup-db.sh — the daily snapshots are DB FILE backups',
   /backup-db\.sh/.test(snapFn) && /spawn\(/.test(snapFn), snapFn ? 'no backup-db.sh spawn' : 'function not found');
is('A2b it has NO per-citizen balance table write (so no balance series can be read back from it)',
   !/INSERT\s+INTO/i.test(snapFn) && !/CREATE\s+TABLE/i.test(snapFn));
is('A2c world-treasury.js records that measurement rather than silently not using the snapshots',
   /backup-db\.sh/.test(treasurySrc) && /not read here|file backups/.test(treasurySrc));

// A3. The real journal the deltas DO come from.
const schemaSrc = readBrain('world/world-council-schema.js');
const ledgerDdl = (() => {
  const i = schemaSrc.indexOf('CREATE TABLE IF NOT EXISTS ledger');
  return i < 0 ? '' : schemaSrc.slice(i, i + 500);
})();
is('A3 the `ledger` table really carries (tick, agent_id, delta) — the three columns a daily delta needs',
   /\btick\b[\s\S]*INTEGER/.test(ledgerDdl) && /\bagent_id\b[\s\S]*TEXT/.test(ledgerDdl) && /\bdelta\b[\s\S]*INTEGER/.test(ledgerDdl),
   ledgerDdl ? 'columns not as expected' : 'ledger DDL not found');

/* ═══ GROUP B — THE MOCK IS QUARANTINED ═════════════════════════════════ */
group('B. the quarantine (nobody can read a fabricated balance)');

function loadMock(opts) {
  // A fresh module every time: the gate is decided ONCE at load, which is the
  // point, so the fixture must re-evaluate the file rather than reuse a cache.
  const o = opts || {};
  const win = { location: { search: o.search || '' } };
  if (o.vintFlag !== undefined) win.VINT_AGENT_MOCK = o.vintFlag;
  let src = ledgerSrc;
  if (CTL.armed) {
    // THE CONTROL: arm by default. One expression.
    const before = src;
    src = src.replace('const ARMED = _armed();', 'const ARMED = true;');
    if (src === before) die('--control-armed could not apply (anchor drifted); this run is NOT evidence');
  }
  const localWrites = [];
  const sandboxWindow = Object.assign(win, {
    localStorage: { setItem: (k, v) => localWrites.push([k, v]), getItem: () => null, removeItem: () => {} },
  });
  const mod = { exports: {} };
  const fn = new Function('module', 'window', 'localStorage', 'console',
    src + '\n;return AgentLedger;');
  const api = fn(mod, sandboxWindow, sandboxWindow.localStorage,
    { info: () => {}, error: () => {}, warn: () => {}, log: () => {} });
  return { api, win: sandboxWindow, localWrites };
}

const cold = loadMock({});
eq('B1 isMock() is true — the module names itself a mock',           cold.api.isMock(), true);
eq('B2 isArmed() is FALSE by default (opt-in, never the default)',   cold.api.isArmed(), false);
eq('B3 balance() returns null — NOT 0 and NOT a seeded number',      cold.api.balance('citizen_ember'), null);
eq('B4 init() refuses and seeds nothing',                            cold.api.init([{ id: 'a' }, { id: 'b' }], 1000).ok, false);
eq('B4b after a refused init, balance is STILL null (no seed leaked through)', cold.api.balance('a'), null);
eq('B5 transfer() refuses',                                          cold.api.transfer('a', 'b', 10).ok, false);
eq('B6 seedVirtual() refuses',                                       cold.api.seedVirtual('a', 10).ok, false);
eq('B7 snapshot() is empty',                                         JSON.stringify(cold.api.snapshot()), '{}');
eq('B8 the module writes ZERO localStorage keys',                    cold.localWrites.length, 0);
eq('B9 it points at the real source',                                cold.api.realSource(), '/api/world/treasury');
eq('B9b and stamps the page so any surface can ask',                 cold.win.__AGENT_LEDGER_IS_MOCK, true);

// Real money is OFF, and it is off in BOTH states — the one rule that must not
// depend on the gate (a flag an attacker or a stray query string can flip must
// never be what stands between a client module and real custody).
const hot = loadMock({ search: '?agentmock=1' });
eq('B10 ARMED by ?agentmock=1 (the Z3BMNEU experiment survives, deliberately)', hot.api.isArmed(), true);
eq('B10b armed, init works again so the simulation keeps its shape',  hot.api.init([{ id: 'a' }, { id: 'b' }], 1000).ok, true);
eq('B10c armed, a balance is a number again',                        typeof hot.api.balance('a'), 'number');
eq('B11 seedReal() refuses even when ARMED',                         hot.api.seedReal('a', 5).ok, false);
eq('B12 enableRealMoney() refuses even when ARMED',                  hot.api.enableRealMoney({ w: 1 }).ok, false);
eq('B13 isRealMoneyEnabled() is false after an enable attempt',      hot.api.isRealMoneyEnabled(), false);
eq('B14 window.VINT_AGENT_MOCK=true also arms it (no query string needed)',
   loadMock({ vintFlag: true }).api.isArmed(), true);

// The callers must fail CLOSED on a null balance, not throw and not pass.
is('B15 agent-exchange.js treats a falsy/null balance as insufficient funds (fail-closed)',
   /balance\s*<\s*cost|balance\s*<\s*amount|fromBalance\s*<\s*amount/.test(stripComments(readClient('body/world/agent-exchange.js'))),
   'no comparison guard found');

/* ═══ GROUP C — THE SERVER, AGAINST A REAL THROWAWAY DB ═════════════════ */
group('C. the endpoint (arithmetic proven against a seeded in-memory journal)');

const sqlite3 = require(path.join(BRAIN_DIR, 'node_modules', 'sqlite3'));

function mkDb() {
  const db = new sqlite3.Database(':memory:');
  const run = (sql, p) => new Promise((res, rej) => db.run(sql, p || [], (e) => (e ? rej(e) : res())));
  const all = (sql, p) => new Promise((res, rej) => db.all(sql, p || [], (e, r) => (e ? rej(e) : res(r))));
  const get = (sql, p) => new Promise((res, rej) => db.get(sql, p || [], (e, r) => (e ? rej(e) : res(r))));
  return { db, dbRun: run, dbAll: all, dbGet: get };
}

const TPD = 24;              // what world-economy-tick declares; asserted in C0
const DAY = 100;             // the fixture's "today"
const NOW = DAY * TPD + 7;   // 7 ticks into day 100 — a PARTIAL day, on purpose

async function seed(h) {
  await h.dbRun(`CREATE TABLE agents (id TEXT PRIMARY KEY, display_name TEXT, active INTEGER,
    incapacitated INTEGER DEFAULT 0, wallet_balance INTEGER NOT NULL DEFAULT 0)`);
  await h.dbRun(`CREATE TABLE ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, transfer_id TEXT NOT NULL,
    tick INTEGER NOT NULL, agent_id TEXT NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, memo TEXT)`);
  await h.dbRun(`CREATE TABLE world_clock (id INTEGER PRIMARY KEY, tick INTEGER NOT NULL)`);
  await h.dbRun('INSERT INTO world_clock (id, tick) VALUES (1, ?)', [NOW]);

  // ash: +100 on day 98, -30 on day 99, +5 today  → balance 75
  // bry: +40 on day 99 only                       → balance 40
  // cal: NO ledger rows at all                    → balance 0, must still be listed
  // dus: wallet_balance deliberately WRONG (70 vs journal 50) → drift 20
  const rows = [
    ['t1', 98 * TPD + 3,  'ash',     100, 'mint'],
    ['t1', 98 * TPD + 3,  '@mint',  -100, 'mint'],
    ['t2', 99 * TPD + 1,  'ash',     -30, 'buy'],
    ['t2', 99 * TPD + 1,  'bry',      40, 'sell'],
    ['t2', 99 * TPD + 1,  '@escrow', -10, 'fee'],
    ['t3', NOW,           'ash',       5, 'stipend'],
    ['t3', NOW,           '@mint',    -5, 'stipend'],
    ['t4', 99 * TPD + 9,  'dus',      50, 'mint'],
    ['t4', 99 * TPD + 9,  '@mint',   -50, 'mint'],
    // An account with journal rows and NO agents row and NOT a system account.
    ['t5', 99 * TPD + 9,  'ghost',    11, 'odd'],
    ['t5', 99 * TPD + 9,  '@fees',   -11, 'odd'],
  ];
  for (const [tid, tick, agent, delta, reason] of rows) {
    await h.dbRun('INSERT INTO ledger (transfer_id, tick, agent_id, delta, reason) VALUES (?,?,?,?,?)',
      [tid, tick, agent, delta, reason]);
  }
  for (const [id, name, active, cached] of [
    ['ash', 'Ash', 1, 75], ['bry', 'Bry', 1, 40], ['cal', 'Cal', 1, 0], ['dus', 'Dus', 0, 70],
  ]) await h.dbRun('INSERT INTO agents (id, display_name, active, wallet_balance) VALUES (?,?,?,?)',
      [id, name, active, cached]);
}

function loadTreasury() {
  let src = treasurySrc;
  if (CTL.noday) {
    const b = src;
    src = src.replace('return Number.isInteger(t) && t > 0 ? t : 24;', 'return 1;');
    if (src === b) die('--control-noday could not apply (anchor drifted); this run is NOT evidence');
  }
  if (CTL.mint) {
    const b = src;
    src = src.replace('const system = sysNames.map((id) => pack(id, { kind: \'system\' }));',
      'const system = sysNames.map((id) => pack(id, { kind: \'system\' }));\n  for (const sid of sysNames) citizens.push(pack(sid, { display_name: sid, active: 1, cached_balance: null }));');
    if (src === b) die('--control-mint could not apply (anchor drifted); this run is NOT evidence');
  }
  if (CTL.nodrift) {
    const b = src;
    src = src.replace('p.drift = cached == null ? null : p.balance - cached;', 'p.drift = null;');
    if (src === b) die('--control-nodrift could not apply (anchor drifted); this run is NOT evidence');
  }
  // Module-path require so '../db' and './world-ledger' resolve from the brain
  // (E4CS77Y: bare/relative specifiers resolve from the SCRIPT's directory).
  const Module = require('module');
  const m = new Module(path.join(BRAIN_DIR, 'world', '__treasury_under_test.js'), null);
  m.filename = path.join(BRAIN_DIR, 'world', '__treasury_under_test.js');
  m.paths = Module._nodeModulePaths(path.join(BRAIN_DIR, 'world'));
  m._compile(src, m.filename);
  return m.exports;
}

(async function main() {
  const h = mkDb();
  await seed(h);
  const T = loadTreasury();
  T._setDbForTests(h);

  group('C0. the day length is READ from the world, never re-declared');
  eq('C0 world-economy-tick.SNAPSHOT_EVERY_TICKS is the 24-tick in-world day',
     require(path.join(BRAIN_DIR, 'world', 'world-economy-tick')).SNAPSHOT_EVERY_TICKS, TPD);
  is('C0b world-treasury reads it from that module rather than hardcoding a literal day length',
     /SNAPSHOT_EVERY_TICKS/.test(treasurySrc) && /require\(['"]\.\/world-economy-tick['"]\)/.test(treasurySrc));
  is('C0c and reads the 14-day horizon from SNAPSHOT_KEEP for the same reason',
     /SNAPSHOT_KEEP/.test(treasurySrc));

  const t = await T.treasury({});

  group('C1. per-citizen balance EQUALS SUM(ledger.delta)');
  const byId = new Map(t.citizens.map((c) => [c.id, c]));
  for (const [id, want] of [['ash', 75], ['bry', 40], ['cal', 0], ['dus', 50]]) {
    const row = await h.dbGet('SELECT COALESCE(SUM(delta),0) AS s FROM ledger WHERE agent_id = ?', [id]);
    eq('C1 ' + id + ": payload balance == the journal's own SUM(delta)",
       byId.get(id) ? byId.get(id).balance : null, row.s);
    eq('C1b ' + id + ': and that is the fixture value the journal was seeded to produce',
       row.s, want);
  }
  eq('C1c a citizen with NO journal rows is listed with 0, never dropped',
     byId.get('cal') ? byId.get('cal').balance : 'MISSING', 0);

  group('C2. the cached wallet column, and the DRIFT between them (shown, never hidden)');
  eq('C2 ash: cached_balance mirrors agents.wallet_balance', byId.get('ash').cached_balance, 75);
  eq('C2b ash: drift is 0 when the journal and the cache agree', byId.get('ash').drift, 0);
  eq('C2c dus: the SEEDED disagreement (journal 50, cache 70) surfaces as drift -20',
     byId.get('dus').drift, -20);

  group('C3. day-over-day deltas, bucketed by the in-world day');
  eq('C3 world_day is floor(tick / ticks_per_day)', t.world_day, DAY);
  eq('C3b ticks_per_day on the payload', t.ticks_per_day, TPD);
  eq('C3c today is declared PARTIAL (it is 7 ticks into a 24-tick day)', t.today_partial, true);
  eq('C3d ash today_delta = +5 (the one entry inside the current day)', byId.get('ash').today_delta, 5);
  eq('C3e ash yesterday_delta = -30 (day 99, the last COMPLETE day)', byId.get('ash').yesterday_delta, -30);
  eq('C3f bry yesterday_delta = +40', byId.get('bry').yesterday_delta, 40);
  eq('C3g bry today_delta = 0 — a quiet day is 0, not null and not yesterday', byId.get('bry').today_delta, 0);
  eq('C3h cal, who never transacted, is 0 on both', byId.get('cal').today_delta + '/' + byId.get('cal').yesterday_delta, '0/0');

  group('C4. the series walks back EXACTLY from the balance now');
  const ash = byId.get('ash');
  const last = ash.days[ash.days.length - 1];
  eq('C4 balance_at_end of the newest (partial) day IS the balance now', last.balance_at_end, ash.balance);
  const d99 = ash.days.find((d) => d.day === 99);
  const d98 = ash.days.find((d) => d.day === 98);
  const d97 = ash.days.find((d) => d.day === 97);
  eq('C4b end of day 99 = 70 (100 minted on d98, 30 spent on d99)', d99 ? d99.balance_at_end : null, 70);
  eq('C4c end of day 98 = 100', d98 ? d98.balance_at_end : null, 100);
  eq('C4d end of day 97 = 0 — before the mint, ash held nothing', d97 ? d97.balance_at_end : null, 0);
  is('C4e every day: balance_at_end == previous end + that day delta',
     ash.days.every((d, i) => i === 0 || d.balance_at_end === ash.days[i - 1].balance_at_end + d.delta));
  eq('C4f the window is SNAPSHOT_KEEP days long by default', t.days_window, 14);
  eq('C4g and ends on today', t.days[t.days.length - 1], DAY);

  group('C5. system accounts are NOT people');
  eq('C5 @mint does not appear in citizens[] (its balance is negative by construction)',
     t.citizens.some((c) => c.id === '@mint'), false);
  eq('C5b @escrow does not appear in citizens[]', t.citizens.some((c) => c.id === '@escrow'), false);
  is('C5c they appear in system[] instead', t.system.some((s) => s.id === '@mint') && t.system.some((s) => s.id === '@escrow'),
     JSON.stringify(t.system.map((s) => s.id)));
  eq('C5d money_supply = -(@mint balance) = 155', t.money_supply, 155);
  eq('C5e held_by_citizens is the sum of the PEOPLE only = 165', t.held_by_citizens, 75 + 40 + 0 + 50);

  group('C6. an unattributed account is surfaced, never silently dropped');
  eq('C6 "ghost" has journal rows, no agents row, is no system account — and is reported',
     t.unattributed.some((u) => u.id === 'ghost'), true);
  eq('C6b with its real balance', (t.unattributed.find((u) => u.id === 'ghost') || {}).balance, 11);

  group('C7. the label: world money, and real money is OFF');
  eq('C7 real_money is false', t.unit.real_money, false);
  eq('C7b no currency name is invented (WORLD_SPEC §4 gives it none)', t.unit.name, null);
  is('C7c the mock units are named as rejected, so "LUM" can never read as real',
     Array.isArray(t.unit.mock_units_rejected) && t.unit.mock_units_rejected.includes('LUM') && t.unit.mock_units_rejected.includes('XMR'));
  is('C7d the payload says a "day" is an IN-WORLD day, not a calendar day', /IN-WORLD day/.test(String(t.day_is)));
  eq('C7e source names the journal', t.source, 'ledger');
  is('C7f and no real-money switch exists anywhere in the module',
     !/enableRealMoney|realMoneyEnabled|XMR\s*[:=]/.test(stripComments(treasurySrc)));

  group('C8. it WRITES NOTHING');
  const before = await h.dbAll('SELECT id, transfer_id, tick, agent_id, delta FROM ledger ORDER BY id');
  const beforeAgents = await h.dbAll('SELECT id, wallet_balance FROM agents ORDER BY id');
  await T.treasury({});
  await T.treasury({ days: 3 });
  const after = await h.dbAll('SELECT id, transfer_id, tick, agent_id, delta FROM ledger ORDER BY id');
  const afterAgents = await h.dbAll('SELECT id, wallet_balance FROM agents ORDER BY id');
  eq('C8 the ledger is byte-identical after three reads', JSON.stringify(after), JSON.stringify(before));
  eq('C8b so is agents', JSON.stringify(afterAgents), JSON.stringify(beforeAgents));
  is('C8c the module source contains no INSERT/UPDATE/DELETE/CREATE at all',
     !/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(stripComments(treasurySrc).replace(/'[^']*'/g, "''")),
     'a write verb survives in the code');

  group('C9. ?days= is bounded');
  eq('C9 days=3 narrows the window', (await T.treasury({ days: 3 })).days_window, 3);
  eq('C9b days=0 falls back rather than returning an empty series', (await T.treasury({ days: 0 })).days_window, 14);
  eq('C9c days=9999 is clamped', (await T.treasury({ days: 9999 })).days_window, 60);
  eq('C9d a garbage days= falls back', (await T.treasury({ days: 'abc' })).days_window, 14);

  /* ═══ GROUP D — THE ROUTE + THE CLIENT BAND ════════════════════════════ */
  group('D. the wiring (route mounted, band inside the panel, collision contract held)');

  const serverNoComment = stripComments(serverSrc);
  is('D1 GET /api/world/treasury is mounted', /app\.get\('\/api\/world\/treasury'/.test(serverNoComment));
  is('D1b it delegates to world/world-treasury', /require\('\.\/world\/world-treasury'\)/.test(serverNoComment));
  is('D1c it is a GET only — no POST/PUT/DELETE on that path',
     !/app\.(post|put|delete|patch)\('\/api\/world\/treasury'/.test(serverNoComment));

  const mapNoComment = stripComments(mapSrc);
  is('D2 the band is a <details class="world-disc"> inside #worldMapPanel, like its three siblings',
     /<details class="world-disc" id="worldTreasury">/.test(mapSrc));
  is('D2b with a .wd-body scroller', /class="wd-body" id="worldTreasBody"/.test(mapSrc));
  is('D3 it reads the real endpoint', /get\('\/api\/world\/treasury'\)/.test(mapNoComment));
  is('D3b and nothing in economy-map.js reads AgentLedger',
     !/AgentLedger/.test(mapNoComment));
  is('D4 it polls only while OPEN (discPolling on its own toggle)',
     /treas\.addEventListener\('toggle'[\s\S]{0,200}discPolling\(treas/.test(mapNoComment));
  is('D4b closing the whole panel stops its poll too',
     /discPolling\(treas,\s*!!\(on && treas && treas\.open\)/.test(mapNoComment));
  // Both render paths must re-measure the floor — a stale floor is a measurement
  // taken for a taller box (QWYN8PW/NFQ2EU6).
  const renderFn = (() => {
    const i = mapSrc.indexOf('function renderTreasury(');
    const j = mapSrc.indexOf('\n  function ', i + 10);
    return i < 0 ? '' : mapSrc.slice(i, j < 0 ? i + 6000 : j);
  })();
  is('D5 renderTreasury refits on the EMPTY/unreachable early return as well as the full render',
     (renderFn.match(/__vwCostFit/g) || []).length >= 2, (renderFn.match(/__vwCostFit/g) || []).length + ' call(s)');
  is('D5b and it is non-vacuous — the function was actually sliced', renderFn.length > 800, renderFn.length + ' chars');
  is('D6 it escapes every interpolated name (no raw display_name into innerHTML)',
     /esc\(c\.display_name/.test(renderFn));
  is('D7 @mint can never be rendered as a citizen row — the band maps citizens[] only',
     /t\.citizens\.filter/.test(renderFn) && !/t\.system\.map|concat\(t\.system/.test(renderFn));
  is('D8 the band prints the real-money state from the PAYLOAD, it does not assert it',
     /t\.unit && t\.unit\.real_money/.test(renderFn));
  is('D8b and prints the unit note from the payload', /t\.unit\.note/.test(renderFn));
  is('D9 drift is shown when present', /wd-drift/.test(renderFn));

  group('D10. the No-Collision contract on the new CSS');
  // Anchor the slice on the comment's OPENING `/*`, not on the marker text
  // inside it: starting 3 chars late leaves an UNTERMINATED comment, which no
  // stripper can match, and the prose then survives into the code checks below
  // (the D11 false red that found this).
  const css = (() => {
    const m = worldHtml.indexOf('RVCP3MY — THE TREASURY BAND');
    if (m < 0) return '';
    const i = worldHtml.lastIndexOf('/*', m);
    const j = worldHtml.indexOf('</style>', m);
    const k = worldHtml.indexOf('\n  .wd-prof', m);
    return worldHtml.slice(i < 0 ? m : i, Math.min(...[j, k].filter((x) => x > 0)));
  })();
  is('D10 the new CSS block was found (non-vacuous)', css.length > 400, css.length + ' chars');
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Guard-self-exclusion is unnecessary here because the slice is CSS, but the
  // comment inside it NAMES the forbidden tokens, so strip own-line comments
  // first or the prose explaining the ban matches it (S7VCB6C).
  is('D10b and the comment really does name them, so the strip is provably load-bearing',
     /position:absolute\/fixed/.test(css) && !/position:absolute\/fixed/.test(cssCode),
     'the forbidden token is not present-in-prose-and-absent-from-code');
  is('D11 nothing in it is position:absolute or position:fixed', !/position:\s*(absolute|fixed)/.test(cssCode), cssCode.match(/position:[^;]*/g));
  is('D11b no negative margin', !/margin[^:]*:\s*-/.test(cssCode));
  is('D11c no transform', !/transform\s*:/.test(cssCode));
  is('D12 the row grid gives every text cell min-width:0 + overflow-wrap so a long name wraps in its own column',
     /minmax\(0,1fr\)/.test(cssCode) && /overflow-wrap:\s*anywhere/.test(cssCode));
  is('D13 the sparkline is a BOUNDED box (fixed-width glyphs, flex:0 0 auto) so it cannot grow with the data',
     /\.wd-spark\s*\{[^}]*flex:\s*0 0 auto/.test(cssCode) && /\.wd-spark i\s*\{[^}]*width:\s*3px/.test(cssCode));
  is('D14 the band lives in the panel body that already has max-height + overflow-y (grows INWARD)',
     /\.world-disc \.wd-body \{[^}]*overflow-y:\s*auto/.test(worldHtml));
  is('D15 the new class names are not captured by any [class*=] rule in world.html',
     (worldHtml.match(/\[class\*=/g) || []).length === 0);

  /* ═══ GROUP E — LIVE (opt-in) ══════════════════════════════════════════ */
  if (LIVE) {
    group('E. live (read-only probes of the public brain)');
    const base = process.env.RVCP3MY_API || 'https://api.vintaclectic.com';
    const fetchJson = async (p) => {
      const r = await fetch(base + p, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(p + ' -> HTTP ' + r.status);
      return r.json();
    };
    try {
      const live = await fetchJson('/api/world/treasury');
      is('E1 live /api/world/treasury answers with citizens', Array.isArray(live.citizens) && live.citizens.length > 0,
         'citizens=' + (live.citizens || []).length);
      eq('E1b live real_money is false', live.unit.real_money, false);
      eq('E1c live source is the journal', live.source, 'ledger');
      eq('E1d live ticks_per_day', live.ticks_per_day, TPD);
      is('E1e live world_day == floor(tick/ticks_per_day)', live.world_day === Math.floor(live.tick / live.ticks_per_day),
         live.world_day + ' vs ' + Math.floor(live.tick / live.ticks_per_day));
      eq('E1f @mint is not a live citizen', live.citizens.some((c) => c.id === '@mint'), false);
      is('E1g the live series ends on today', live.days[live.days.length - 1] === live.world_day);
      is('E1h every live citizen row carries a day series of the window length',
         live.citizens.every((c) => Array.isArray(c.days) && c.days.length === live.days_window));
      is('E1i the live walk-back holds on every citizen (balance_at_end chains by delta)',
         live.citizens.every((c) => c.days.every((d, i) => i === 0 || d.balance_at_end === c.days[i - 1].balance_at_end + d.delta)));

      // Cross-check against the OTHER live endpoint that reports the same
      // number by a different path — two independent sources agreeing is the bar.
      const cz = await fetchJson('/api/world/citizens');
      const czMap = new Map((cz.citizens || []).map((c) => [c.id, c.wallet_balance]));
      const sample = live.citizens.filter((c) => czMap.has(c.id)).slice(0, 5);
      is('E2 the sample is non-vacuous', sample.length >= 2, sample.length + ' matched');
      for (const c of sample) {
        eq('E2 live ' + c.id + ': treasury balance == /api/world/citizens wallet_balance',
           c.balance, czMap.get(c.id));
      }
      const drifted = live.citizens.filter((c) => Number(c.drift));
      is('E3 live drift is reported (0 is the healthy answer; any value is SHOWN not hidden)',
         live.citizens.every((c) => c.drift !== undefined),
         drifted.length + ' citizen(s) drifting');

      const econ = await fetchJson('/api/world/economy');
      eq('E4 the live day length matches /api/world/economy snapshot_every_ticks',
         live.ticks_per_day, econ.snapshot_every_ticks);
      eq('E4b and the window matches snapshot_keep', live.days_window, econ.snapshot_keep);

      const pub = await fetch('https://vintinuum.com/body/world/agent-ledger.js', { signal: AbortSignal.timeout(15000) });
      const pubSrc = await pub.text();
      is('E5 the mock served live is the QUARANTINED one', /QUARANTINED MOCK \(RVCP3MY\)/.test(pubSrc));
      is('E5b and the live mock answers null, not a seeded number', /if \(!ARMED\) return null;/.test(pubSrc));
      const pubMap = await (await fetch('https://vintinuum.com/body/world/economy-map.js', { signal: AbortSignal.timeout(15000) })).text();
      is('E6 the live economy-map.js carries the treasury band', /id="worldTreasury"/.test(pubMap));
    } catch (e) {
      is('E live probes completed', false, e.message);
    }
  } else {
    console.log('\nE. live probes SKIPPED (pass --live). The hermetic groups above touch no network and no live DB.');
  }

  /* ── tally ───────────────────────────────────────────────────────────── */
  const ctl = Object.keys(CTL).filter((k) => CTL[k]);
  console.log('\n' + '─'.repeat(72));
  if (ctl.length) console.log('NEGATIVE CONTROL ACTIVE: ' + ctl.join(', ') + ' — this run is EXPECTED to be red.');
  console.log(pass + '/' + (pass + fails.length) + ' pass');
  if (fails.length) { console.log('\nFAILURES:'); fails.forEach((f) => console.log('  - ' + f)); }
  h.db.close();
  process.exit(fails.length === 0 ? 0 : 1);
})().catch((e) => { console.error('\nHARNESS ERROR: ' + (e && e.stack || e)); process.exit(2); });
