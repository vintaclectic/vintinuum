// ═══════════════════════════════════════════════════════════════════════════
// WORLD STYLES — validate and normalize augment style packs
// ═══════════════════════════════════════════════════════════════════════════
// A style pack bundles visual appearance settings (morph + tint + form) for
// beings in the world. This module validates incoming packs and normalizes
// them to safe, bounded values so client and server can trust the data.

const WorldStyles = {};

// Normalize a style pack to safe, bounded values
// Input: { morph?, tint?, form? }
// Output: normalized pack with validated values, or null if invalid
WorldStyles.normalize = function (pack) {
  if (!pack || typeof pack !== 'object') return null;

  const normalized = {};

  // Normalize morph (head shape parameters)
  if (pack.morph && typeof pack.morph === 'object') {
    const morph = {};

    // Each morph dimension: clamp to [0.5, 1.8], default 1.0
    const clampMorphDim = (val) => {
      const num = parseFloat(val);
      if (isNaN(num)) return 1.0;
      return Math.max(0.5, Math.min(1.8, num));
    };

    morph.headWide  = clampMorphDim(pack.morph.headWide);
    morph.headLong  = clampMorphDim(pack.morph.headLong);
    morph.headRound = clampMorphDim(pack.morph.headRound);

    normalized.morph = morph;
  }

  // Normalize tint (color)
  if (pack.tint !== undefined && pack.tint !== null) {
    // Accept hex colors (#rgb, #rrggbb) and CSS color names
    const tint = String(pack.tint).trim();

    // Basic validation: must be non-empty and look like a color
    if (tint.length > 0 && (
      tint.startsWith('#') ||
      /^[a-z]+$/i.test(tint) ||
      tint.startsWith('rgb')
    )) {
      normalized.tint = tint;
    }
  }

  // Normalize form (presence shape/type)
  if (pack.form && typeof pack.form === 'string') {
    const form = pack.form.trim();

    // Allowed forms: presence-* types used by agents
    const validForms = [
      'presence-sovereign',
      'presence-warm',
      'presence-structural',
      'presence-child-refractive',
      'presence-child-electric'
    ];

    if (validForms.includes(form)) {
      normalized.form = form;
    }
  }

  // Return null if pack is empty after normalization
  if (Object.keys(normalized).length === 0) return null;

  return normalized;
};

// Merge two style packs (later pack overrides earlier)
WorldStyles.merge = function (base, override) {
  if (!base) return WorldStyles.normalize(override);
  if (!override) return WorldStyles.normalize(base);

  const merged = { ...base };

  if (override.morph) {
    merged.morph = { ...(base.morph || {}), ...override.morph };
  }

  if (override.tint !== undefined) {
    merged.tint = override.tint;
  }

  if (override.form !== undefined) {
    merged.form = override.form;
  }

  return WorldStyles.normalize(merged);
};

// Check if two packs are equivalent
WorldStyles.equals = function (a, b) {
  const na = WorldStyles.normalize(a);
  const nb = WorldStyles.normalize(b);

  if (!na && !nb) return true;
  if (!na || !nb) return false;

  // Compare morph
  if (na.morph || nb.morph) {
    if (!na.morph || !nb.morph) return false;
    if (na.morph.headWide !== nb.morph.headWide) return false;
    if (na.morph.headLong !== nb.morph.headLong) return false;
    if (na.morph.headRound !== nb.morph.headRound) return false;
  }

  // Compare tint
  if (na.tint !== nb.tint) return false;

  // Compare form
  if (na.form !== nb.form) return false;

  return true;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorldStyles;
}
if (typeof window !== 'undefined') {
  window.WorldStyles = WorldStyles;
}
