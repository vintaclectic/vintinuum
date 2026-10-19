#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// VERIFY WORLD STYLES — test WorldStyles.normalize validation
// ═══════════════════════════════════════════════════════════════════════════

const WorldStyles = require('../body/world/world-styles.js');

let pass = 0;
let fail = 0;

function test(desc, fn) {
  try {
    fn();
    console.log(`✓ ${desc}`);
    pass++;
  } catch (e) {
    console.error(`✗ ${desc}`);
    console.error(`  ${e.message}`);
    fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// Test normalize function
test('normalize returns null for invalid input', () => {
  assert(WorldStyles.normalize(null) === null, 'null input');
  assert(WorldStyles.normalize(undefined) === null, 'undefined input');
  assert(WorldStyles.normalize('string') === null, 'string input');
  assert(WorldStyles.normalize(123) === null, 'number input');
  assert(WorldStyles.normalize({}) === null, 'empty object');
});

test('normalize clamps morph dimensions to [0.5, 1.8]', () => {
  const pack = { morph: { headWide: 0.3, headLong: 2.5, headRound: 1.2 } };
  const normalized = WorldStyles.normalize(pack);
  assert(normalized.morph.headWide === 0.5, 'headWide clamped to min');
  assert(normalized.morph.headLong === 1.8, 'headLong clamped to max');
  assert(normalized.morph.headRound === 1.2, 'headRound in range');
});

test('normalize defaults invalid morph values to 1.0', () => {
  const pack = { morph: { headWide: 'invalid', headLong: NaN, headRound: null } };
  const normalized = WorldStyles.normalize(pack);
  assert(normalized.morph.headWide === 1.0, 'invalid string → 1.0');
  assert(normalized.morph.headLong === 1.0, 'NaN → 1.0');
  assert(normalized.morph.headRound === 1.0, 'null → 1.0');
});

test('normalize accepts valid tint colors', () => {
  const hex = WorldStyles.normalize({ tint: '#ff0000' });
  assert(hex.tint === '#ff0000', 'hex color');

  const name = WorldStyles.normalize({ tint: 'red' });
  assert(name.tint === 'red', 'CSS color name');

  const rgb = WorldStyles.normalize({ tint: 'rgb(255,0,0)' });
  assert(rgb.tint === 'rgb(255,0,0)', 'rgb color');
});

test('normalize rejects invalid tint values', () => {
  const empty = WorldStyles.normalize({ tint: '' });
  assert(!empty || !empty.tint, 'empty string rejected');

  const invalid = WorldStyles.normalize({ tint: 'not-a-color123' });
  assert(!invalid || !invalid.tint, 'invalid string rejected');
});

test('normalize accepts valid form types', () => {
  const forms = [
    'presence-sovereign',
    'presence-warm',
    'presence-structural',
    'presence-child-refractive',
    'presence-child-electric'
  ];

  forms.forEach(form => {
    const normalized = WorldStyles.normalize({ form });
    assert(normalized.form === form, `${form} accepted`);
  });
});

test('normalize rejects invalid form types', () => {
  const invalid = WorldStyles.normalize({ form: 'invalid-form' });
  assert(!invalid || !invalid.form, 'invalid form rejected');
});

test('normalize handles combined packs', () => {
  const pack = {
    morph: { headWide: 1.2, headLong: 0.8, headRound: 1.5 },
    tint: '#b794f4',
    form: 'presence-sovereign'
  };
  const normalized = WorldStyles.normalize(pack);

  assert(normalized.morph.headWide === 1.2, 'morph preserved');
  assert(normalized.tint === '#b794f4', 'tint preserved');
  assert(normalized.form === 'presence-sovereign', 'form preserved');
});

// Test merge function
test('merge combines two packs correctly', () => {
  const base = { morph: { headWide: 1.0, headLong: 1.0, headRound: 1.0 }, tint: '#000000' };
  const override = { morph: { headWide: 1.5 }, tint: '#ffffff' };

  const merged = WorldStyles.merge(base, override);
  assert(merged.morph.headWide === 1.5, 'override headWide');
  assert(merged.morph.headLong === 1.0, 'preserve headLong');
  assert(merged.tint === '#ffffff', 'override tint');
});

test('merge handles null inputs', () => {
  const pack = { tint: '#ff0000' };

  const fromNull = WorldStyles.merge(null, pack);
  assert(fromNull.tint === '#ff0000', 'merge from null');

  const toNull = WorldStyles.merge(pack, null);
  assert(toNull.tint === '#ff0000', 'merge to null');
});

// Test equals function
test('equals correctly compares packs', () => {
  const pack1 = { morph: { headWide: 1.2, headLong: 0.8, headRound: 1.5 }, tint: '#ff0000' };
  const pack2 = { morph: { headWide: 1.2, headLong: 0.8, headRound: 1.5 }, tint: '#ff0000' };
  const pack3 = { morph: { headWide: 1.2, headLong: 0.8, headRound: 1.5 }, tint: '#00ff00' };

  assert(WorldStyles.equals(pack1, pack2) === true, 'identical packs');
  assert(WorldStyles.equals(pack1, pack3) === false, 'different tints');
  assert(WorldStyles.equals(null, null) === true, 'both null');
  assert(WorldStyles.equals(pack1, null) === false, 'one null');
});

// Summary
console.log(`\n${pass}/${pass + fail} tests passed`);
process.exit(fail > 0 ? 1 : 0);
