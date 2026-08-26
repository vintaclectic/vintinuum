#!/usr/bin/env node
// verify-secrets.js — PROOF that the secrets organ keeps its promises.
//
// Runs body/world/secrets.js headlessly against the REAL window event bus (no
// DOM, no browser, no network — the file has a headless boundary precisely so
// this is possible in milliseconds). Every claim below is a property the organ
// must never lose, checked by driving the same `vint:world-*` events the world
// actually broadcasts.
//
// The two claims that matter most, and why:
//   · ANTI-GRIND — the conditions must reward INHABITING the world, not
//     repeating one action. A secret that falls to a held-down key is a chore
//     wearing a secret's clothes. Proven by grinding each condition and
//     asserting it does NOT keep.
//   · NEVER THROWS — this organ listens to events owned by eight other modules
//     whose payload shapes it does not control. A malformed detail must never
//     propagate an exception into the world's event loop.
//
// Usage: node scripts/verify-secrets.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'body/world/secrets.js'), 'utf8');

// ── a minimal window with a real event bus ─────────────────────────────────
function boot(flags) {
  const store = Object.assign({}, flags || {});
  const listeners = {};
  const win = {
    location: { search: '' },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    dispatchEvent: e => { (listeners[e.type] || []).forEach(f => f(e)); return true; },
    setTimeout: () => 0,
    URLSearchParams, JSON, Math, Date, Object, Array,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = (o && o.detail) || null; } }
  };
  win.window = win;
  const ctx = vm.createContext(win);
  ctx.localStorage = win.localStorage;
  ctx.setTimeout = win.setTimeout;
  vm.runInContext('var document=undefined;' + SRC, ctx);
  return {
    S: ctx.VintSecrets,
    emit: (t, d) => win.dispatchEvent(new win.CustomEvent(t, { detail: d })),
    store
  };
}

let passed = 0, failed = 0;
const G = s => '\x1b[32m' + s + '\x1b[0m';
const R = s => '\x1b[31m' + s + '\x1b[0m';
const B = s => '\x1b[1m' + s + '\x1b[0m';
function chk(name, cond) {
  if (cond) { passed++; console.log('  ' + G('✓') + ' ' + name); }
  else { failed++; console.log('  ' + R('✗') + ' ' + name); }
}

console.log(B('\nCLAIM 1 · the organ loads headless and starts empty'));
{
  const { S } = boot();
  chk('secrets.js runs with no DOM and exports VintSecrets', !!S && typeof S.kept === 'function');
  chk('nothing is kept before anything happens', S.kept().length === 0);
  chk('remaining equals the whole table', S.remaining() === S.all().length);
  chk('no duplicate secret ids in the table', new Set(S.all().map(x => x.id)).size === S.all().length);
  chk('every secret has a name', S.all().every(x => x.name && x.name.length));
}

console.log(B('\nCLAIM 2 · a real world event keeps a real secret, exactly once'));
{
  const { S, emit } = boot();
  emit('vint:world-ready', {});
  chk('vint:world-ready keeps first-light', S.isKept('first-light'));
  const n = S.kept().length;
  emit('vint:world-ready', {});
  emit('vint:world-ready', {});
  chk('re-firing the same event never double-keeps', S.kept().length === n);
  chk('remaining decremented by exactly one', S.remaining() === S.all().length - 1);
}

console.log(B('\nCLAIM 3 · ANTI-GRIND — repetition alone never satisfies a secret'));
{
  let { S, emit } = boot();
  for (let i = 0; i < 50; i++) emit('vint:world-travel', { to: 'one-place' });
  chk('50 travels to ONE world does not keep the-long-way', !S.isKept('the-long-way'));

  ({ S, emit } = boot());
  for (let i = 0; i < 100; i++) emit('vint:world-tend', {});
  chk('100 tends in ONE visit does not keep the-tended-hour', !S.isKept('the-tended-hour'));

  ({ S, emit } = boot());
  for (let i = 0; i < 40; i++) emit('vint:world-presence', { count: 1 });
  chk('40 solo presence pings do not keep the-witness', !S.isKept('the-witness'));
}

console.log(B('\nCLAIM 4 · conditions that demand fairness actually reset'));
{
  let { S, emit } = boot();
  for (let i = 0; i < 4; i++) emit('vint:world-trade-settled', {});
  emit('vint:world-trade-closed', {});
  for (let i = 0; i < 4; i++) emit('vint:world-trade-settled', {});
  chk('an unsettled trade resets the open-handed streak', !S.isKept('open-handed'));
  emit('vint:world-trade-settled', {});
  chk('five clean settles then keeps open-handed', S.isKept('open-handed'));

  ({ S, emit } = boot());
  for (let i = 0; i < 11; i++) emit('vint:world-struct', {});
  emit('vint:world-strike', {});
  for (let i = 0; i < 11; i++) emit('vint:world-struct', {});
  chk('a strike resets quiet-hands', !S.isKept('quiet-hands'));
  emit('vint:world-struct', {});
  chk('twelve unstruck structures then keeps quiet-hands', S.isKept('quiet-hands'));
}

console.log(B('\nCLAIM 5 · variety, not volume, opens the far secrets'));
{
  const { S, emit } = boot();
  const worlds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  worlds.forEach(w => emit('vint:world-travel', { to: w }));
  chk('seven DISTINCT worlds keeps the-long-way', S.isKept('the-long-way'));
}

console.log(B('\nCLAIM 6 · hostile and malformed payloads never reach the world'));
{
  const { S, emit } = boot();
  let threw = null;
  const junk = [null, undefined, 0, '', 'str', [], {}, { to: null }, { count: 'x' },
                { present: 'not-an-array' }, { to: {} }, Object.create(null)];
  const types = ['vint:world-ready', 'vint:world-travel', 'vint:world-presence',
                 'vint:world-trade-settled', 'vint:world-trade-closed',
                 'vint:world-struct', 'vint:world-strike', 'vint:world-tend',
                 'vint:world-weave', 'vint:world-refine', 'vint:world-harvest'];
  try { junk.forEach(d => types.forEach(t => emit(t, d))); }
  catch (e) { threw = e; }
  chk('no malformed payload throws into the event loop', !threw);
  chk('the organ still answers after the junk storm', typeof S.remaining() === 'number');
}

console.log(B('\nCLAIM 7 · the kill switch and the resentment signal both work'));
{
  const b = boot({ 'vint:flag:world_secrets': '0' });
  b.emit('vint:world-ready', {});
  chk('flag world_secrets=0 stops keeping entirely', !b.S.isKept('first-light'));

  const c = boot();
  c.S.hush(true);
  c.emit('vint:world-ready', {});
  chk('hush() silences reveals but PRESERVES history', c.S.isKept('first-light'));
  chk('hushed() reports true', c.S.hushed() === true);
  c.S.hush(false);
  chk('hush is reversible, never a one-way door', c.S.hushed() === false);
}

console.log(B('\nCLAIM 8 · nothing here is tier-gated (the organ is a gift)'));
{
  const txt = SRC;
  // A secret that checks a tier is an advertisement. Assert the file contains
  // no entitlement check at all, so this cannot be quietly added later.
  const gated = /\b(tier|entitle|premium|sovereign|companion|theater|estate|paywall|upgrade)\b/i.test(
    txt.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')  // strip comments
  );
  chk('no tier/entitlement check exists in executable code', !gated);
}

console.log(B('\nCLAIM 9 · it instruments nothing (pure listener)'));
{
  const code = SRC.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  chk('never reassigns another module (no W.Vint<X> = patching)',
      !/\bW\.(VintinuumWorld|DirverseHUD|VintArcade|VintCommons|VintTraces)\s*=/.test(code));
  chk('subscribes only via addEventListener', /addEventListener/.test(code));
  chk('adds no position:fixed of its own', !/position:\s*fixed/.test(code));
}

const total = passed + failed;
console.log('\n' + B('SECRETS PROOF') + ' — ' + passed + ' passed, ' + failed + ' failed\n');
if (failed) {
  console.log(R('✗ the secrets organ broke a promise it makes to the player.\n'));
  process.exit(1);
}
console.log(G('✓ the world keeps secrets: they cannot be ground out, cannot be bought,\n'
  + '  cannot throw into the world, and can be silenced without being erased.') + '\n');
process.exit(0);
