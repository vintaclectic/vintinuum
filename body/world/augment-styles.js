'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   AUGMENT STYLES: flesh merged with machine, for every body in the world.
   AETHERHOLD, 2026-10-18, task AZ6XYM5.

   Vinta's brief: "more skin and flesh merged with machine and electronics" (the
   attached portrait is warm skin, gunmetal implants, cobalt light in the seams),
   "make females similar aesthetic but with their own unique vibe", and "styles
   able to be added, designed and imported by anyone including agents".

   A STYLE PACK is plain JSON, never code, so anyone (a user, an agent, a share
   link) can hand one over safely. Every field is validated and clamped before it
   touches a shader:

     { id, name, author, body: 'masc'|'femme'|'any',
       skin:  '#rrggbb',   flesh tone
       plate: '#rrggbb',   machine plating
       seam:  '#rrggbb',   light that bleeds through the seams
       coverage: 0..1,     how much of the body is machine
       pattern: 'circuit'|'filigree'|'scales'|'ribs',
       glow: 0..2,         seam brightness
       asym: 0..1,         machine creeps up one side (the portrait's left side)
       build: { height: .9..1.1, shoulders: 0..1, hips: 0..1, waist: 0..1, bust: 0..1 } }

   The material is a MeshStandardMaterial (so three.js GPU-skins it for free) with
   a procedural flesh/machine field injected in onBeforeCompile. It adds no
   textures, no downloads and no per-frame CPU work beyond one time uniform.

   API (window.WorldStyles):
     list() → packs          get(id)          register(json) → pack (throws on bad input)
     importText(text) → [packs]               exportText(id) → JSON string
     shareUrl(id) → url with #style=…         remove(id) (user packs only)
     selfId() / setSelf(id)  agentId(aid) / setAgent(aid, id|null)
     makeMaterials(THREE, pack, geo) → { surface, joints }   (used by rigged-presence)
   Events: window 'vint:styles-changed' { detail: { who, id } }
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  if (global.WorldStyles) return;

  var LS_PACKS = 'vint:styles:packs';
  var LS_SELF = 'vint:styles:self';
  var LS_AGENTS = 'vint:styles:agents';
  var MAX_USER_PACKS = 64;
  var PATTERNS = ['circuit', 'filigree', 'scales', 'ribs'];
  var BODIES = ['masc', 'femme', 'any'];
  var HOUSE = 'sovereign-circuit';
  var CLASSIC = 'classic';   // the untouched robot body

  // ── the built-in wardrobe. One masculine house look drawn from the portrait,
  //    four feminine looks with their own vibe, one androgynous wildcard.
  var BUILTIN = [
    { id: 'sovereign-circuit', name: 'Sovereign Circuit', author: 'council', body: 'masc',
      skin: '#c8957a', plate: '#3a3f47', seam: '#2f7bff', coverage: 0.42, pattern: 'circuit', glow: 1.25, asym: 0.75,
      build: { height: 1.0, shoulders: 0, hips: 0, waist: 0, bust: 0 } },
    { id: 'nocturne-chrome', name: 'Nocturne Chrome', author: 'council', body: 'femme',
      skin: '#efd2c4', plate: '#16151b', seam: '#a46bff', coverage: 0.38, pattern: 'filigree', glow: 1.15, asym: 0.55,
      build: { height: 0.96, shoulders: 0.55, hips: 0.6, waist: 0.55, bust: 0.55 } },
    { id: 'ember-filigree', name: 'Ember Filigree', author: 'council', body: 'femme',
      skin: '#7a4a33', plate: '#b9825f', seam: '#ff6a2a', coverage: 0.34, pattern: 'filigree', glow: 1.35, asym: 0.25,
      build: { height: 0.97, shoulders: 0.45, hips: 0.7, waist: 0.6, bust: 0.6 } },
    { id: 'tidal-ceramic', name: 'Tidal Ceramic', author: 'council', body: 'femme',
      skin: '#c99b74', plate: '#e9ecef', seam: '#19e0d0', coverage: 0.46, pattern: 'scales', glow: 1.05, asym: 0.4,
      build: { height: 0.95, shoulders: 0.5, hips: 0.55, waist: 0.5, bust: 0.45 } },
    { id: 'neon-saint', name: 'Neon Saint', author: 'council', body: 'femme',
      skin: '#f2c6a8', plate: '#2b2236', seam: '#ff3fa8', coverage: 0.3, pattern: 'circuit', glow: 1.5, asym: 0.85,
      build: { height: 0.97, shoulders: 0.6, hips: 0.5, waist: 0.6, bust: 0.5 } },
    { id: 'rust-prophet', name: 'Rust Prophet', author: 'council', body: 'any',
      skin: '#d9a98a', plate: '#7a4326', seam: '#ffb020', coverage: 0.55, pattern: 'ribs', glow: 1.1, asym: 0.5,
      build: { height: 1.02, shoulders: 0.15, hips: 0.15, waist: 0.1, bust: 0 } },
  ];

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  function clamp(v, lo, hi, d) { v = Number(v); if (!isFinite(v)) v = d; return Math.max(lo, Math.min(hi, v)); }
  function hex(v, d) { return (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v.toLowerCase() : d; }
  function text(v, max, d) {
    if (typeof v !== 'string') return d;
    // printable text only: control chars and angle brackets never reach the DOM
    var s = v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
    return s || d;
  }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48); }

  // Validate + clamp anything handed to us. Throws on input that cannot be a pack.
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('a style pack must be a JSON object');
    var name = text(raw.name, 40, '');
    if (!name) throw new Error('a style pack needs a name');
    var id = slug(raw.id) || slug(name);
    if (!id) throw new Error('could not derive an id from the name');
    if (id === CLASSIC) throw new Error('"classic" is reserved');
    var b = (raw.build && typeof raw.build === 'object') ? raw.build : {};
    return {
      id: id,
      name: name,
      author: text(raw.author, 40, 'anonymous'),
      body: BODIES.indexOf(raw.body) >= 0 ? raw.body : 'any',
      skin: hex(raw.skin, '#c8957a'),
      plate: hex(raw.plate, '#3a3f47'),
      seam: hex(raw.seam, '#2f7bff'),
      coverage: clamp(raw.coverage, 0, 1, 0.4),
      pattern: PATTERNS.indexOf(raw.pattern) >= 0 ? raw.pattern : 'circuit',
      glow: clamp(raw.glow, 0, 2, 1),
      asym: clamp(raw.asym, 0, 1, 0.5),
      build: {
        height: clamp(b.height, 0.9, 1.1, 1),
        shoulders: clamp(b.shoulders, 0, 1, 0),
        hips: clamp(b.hips, 0, 1, 0),
        waist: clamp(b.waist, 0, 1, 0),
        bust: clamp(b.bust, 0, 1, 0),
      },
    };
  }

  var builtinById = {};
  BUILTIN.forEach(function (p) { var n = normalize(p); n.builtin = true; builtinById[n.id] = n; });

  function userPacks() {
    var arr = lsGet(LS_PACKS, []);
    if (!Array.isArray(arr)) return [];
    var out = [];
    arr.forEach(function (p) { try { var n = normalize(p); if (!builtinById[n.id]) out.push(n); } catch (_) {} });
    return out;
  }

  function emit(who, id) {
    try { global.dispatchEvent(new CustomEvent('vint:styles-changed', { detail: { who: who, id: id } })); } catch (_) {}
  }

  var WS = {};
  WS.HOUSE = HOUSE;
  WS.CLASSIC = CLASSIC;
  WS.PATTERNS = PATTERNS.slice();
  WS.BODIES = BODIES.slice();
  WS.normalize = normalize;

  WS.list = function () { return BUILTIN.map(function (p) { return builtinById[p.id]; }).concat(userPacks()); };
  WS.get = function (id) {
    if (!id || id === CLASSIC) return null;
    if (builtinById[id]) return builtinById[id];
    var u = userPacks();
    for (var i = 0; i < u.length; i++) if (u[i].id === id) return u[i];
    return null;
  };

  // Register (or overwrite) a user pack. A pack cannot overwrite a built-in; a
  // colliding id gets a numeric suffix so nobody's import clobbers the house.
  WS.register = function (raw) {
    var p = normalize(raw);
    var list = userPacks();
    if (builtinById[p.id]) {
      var base = p.id, k = 2;
      while (builtinById[p.id] || list.some(function (q) { return q.id === p.id; })) p.id = (base + '-' + (k++)).slice(0, 48);
    }
    list = list.filter(function (q) { return q.id !== p.id; });
    list.push(p);
    if (list.length > MAX_USER_PACKS) list = list.slice(list.length - MAX_USER_PACKS);
    lsSet(LS_PACKS, list);
    emit('library', p.id);
    return p;
  };

  WS.remove = function (id) {
    if (builtinById[id]) return false;
    var list = userPacks(), n = list.length;
    list = list.filter(function (q) { return q.id !== id; });
    lsSet(LS_PACKS, list);
    if (WS.selfId() === id) WS.setSelf(HOUSE);
    var a = lsGet(LS_AGENTS, {}) || {};
    Object.keys(a).forEach(function (k) { if (a[k] === id) delete a[k]; });
    lsSet(LS_AGENTS, a);
    emit('library', id);
    return list.length !== n;
  };

  // Accepts one pack, an array of packs, or { packs: [...] }. Returns the packs
  // registered; throws only when NOTHING in the text was a usable pack.
  WS.importText = function (txt) {
    var data;
    try { data = JSON.parse(String(txt || '')); } catch (_) { throw new Error('that is not valid JSON'); }
    var arr = Array.isArray(data) ? data : (data && Array.isArray(data.packs) ? data.packs : [data]);
    var out = [], firstErr = null;
    arr.slice(0, MAX_USER_PACKS).forEach(function (raw) {
      try { out.push(WS.register(raw)); } catch (e) { firstErr = firstErr || e; }
    });
    if (!out.length) throw firstErr || new Error('no style packs found');
    return out;
  };

  WS.exportText = function (id) {
    var p = WS.get(id);
    if (!p) return '';
    var o = JSON.parse(JSON.stringify(p)); delete o.builtin;
    return JSON.stringify(o, null, 2);
  };

  function b64urlEncode(s) {
    var bin = unescape(encodeURIComponent(s));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }
  WS.shareUrl = function (id) {
    var t = WS.exportText(id);
    if (!t) return '';
    var loc = global.location || { origin: '', pathname: '/world.html' };
    return (loc.origin || '') + (loc.pathname || '/world.html') + '#style=' + b64urlEncode(JSON.stringify(JSON.parse(t)));
  };
  WS._decodeShare = b64urlDecode;

  WS.selfId = function () {
    var v = lsGet(LS_SELF, null);
    if (v === CLASSIC) return CLASSIC;
    return (v && WS.get(v)) ? v : HOUSE;
  };
  WS.setSelf = function (id) {
    var v = (id === CLASSIC || WS.get(id)) ? id : HOUSE;
    lsSet(LS_SELF, v); emit('self', v); return v;
  };
  // Agents keep their light-figure bodies until someone dresses them.
  WS.agentId = function (aid) {
    var a = lsGet(LS_AGENTS, {}) || {};
    var v = a[aid];
    return (v && WS.get(v)) ? v : null;
  };
  WS.setAgent = function (aid, id) {
    if (!aid) return null;
    var a = lsGet(LS_AGENTS, {}) || {};
    if (id && WS.get(id)) a[aid] = id; else delete a[aid];
    lsSet(LS_AGENTS, a); emit(aid, a[aid] || null); return a[aid] || null;
  };

  // ── THE FLESH/MACHINE MATERIAL ─────────────────────────────────────────────
  // geo: the skinned geometry (used to normalise the pattern to body height).
  // Returns { surface, joints }: joints are always machine (mask forced to 1),
  // the surface blends flesh into plating by the pack's coverage + pattern.
  WS.makeMaterials = function (THREE, pack, geo) {
    var p = normalize(pack);
    var min = new THREE.Vector3(-0.9, 0, -0.15), invH = 1 / 1.6;
    try {
      if (geo) {
        if (!geo.boundingBox) geo.computeBoundingBox();
        var bb = geo.boundingBox, h = bb.max.y - bb.min.y;
        if (h > 0.01 && isFinite(h)) { min.copy(bb.min); invH = 1 / h; }
      }
    } catch (_) {}
    var shared = {
      uTime: { value: 0 },
      uSkin: { value: new THREE.Color(p.skin) },
      uPlate: { value: new THREE.Color(p.plate) },
      uSeam: { value: new THREE.Color(p.seam) },
      uCoverage: { value: p.coverage },
      uGlow: { value: p.glow },
      uAsym: { value: p.asym },
      uPattern: { value: PATTERNS.indexOf(p.pattern) },
      uMin: { value: min },
      uInvH: { value: invH },
      uShape: { value: new THREE.Vector4(p.build.shoulders, p.build.hips, p.build.waist, p.build.bust) },
    };
    function mk(force) {
      var m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.0 });
      m.userData.uniforms = shared;
      m.userData.augment = p.id;
      m.customProgramCacheKey = function () { return 'augment-v1-' + (force ? 'j' : 's'); };
      m.onBeforeCompile = function (shader) {
        for (var k in shared) shader.uniforms[k] = shared[k];
        shader.uniforms.uForce = { value: force ? 1 : 0 };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nuniform vec4 uShape;\nuniform vec3 uMin;\nuniform float uInvH;')
          .replace('#include <begin_vertex>', [
            '#include <begin_vertex>',
            'vObjPos = transformed;',
            // body-shaping field in bind pose (T-pose): torso only, smooth falloff,
            // so the skin stretches instead of tearing. y is normalised to height.
            '{',
            '  float yy = (transformed.y - uMin.y) * uInvH;',
            '  float ax = abs(transformed.x) * uInvH;',
            '  float torso = 1.0 - smoothstep(0.10, 0.19, ax);',
            '  float hip = exp(-pow((yy - 0.56) / 0.06, 2.0));',
            '  float waist = exp(-pow((yy - 0.645) / 0.04, 2.0));',
            '  float chest = exp(-pow((yy - 0.80) / 0.05, 2.0));',
            '  float sx = 1.0 + torso * (0.16 * uShape.y * hip - 0.14 * uShape.z * waist - 0.10 * uShape.x * chest);',
            '  transformed.x *= sx;',
            '  float bust = exp(-pow((yy - 0.755) / 0.035, 2.0)) * exp(-pow((ax - 0.05) / 0.035, 2.0));',
            '  transformed.z += uShape.w * 0.035 / uInvH * bust * smoothstep(-0.01, 0.05, transformed.z * uInvH);',
            '}',
          ].join('\n'));
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', [
            '#include <common>',
            'varying vec3 vObjPos;',
            'uniform float uTime, uCoverage, uGlow, uAsym, uInvH, uForce;',
            'uniform int uPattern;',
            'uniform vec3 uSkin, uPlate, uSeam, uMin;',
            'float aHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
            'float aNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);',
            '  return mix(mix(mix(aHash(i), aHash(i + vec3(1,0,0)), f.x), mix(aHash(i + vec3(0,1,0)), aHash(i + vec3(1,1,0)), f.x), f.y),',
            '             mix(mix(aHash(i + vec3(0,0,1)), aHash(i + vec3(1,0,1)), f.x), mix(aHash(i + vec3(0,1,1)), aHash(i + vec3(1,1,1)), f.x), f.y), f.z); }',
            'float aFbm(vec3 p){ return 0.55 * aNoise(p) + 0.3 * aNoise(p * 2.03) + 0.15 * aNoise(p * 4.1); }',
            // seam lines inside the plating, one per pattern
            'float aLines(vec3 q){',
            '  if (uPattern == 0) {',  // circuit: broken orthogonal traces
            '    vec3 g = q * 26.0; vec3 c = floor(g); vec3 f = fract(g);',
            '    float on = step(0.45, aHash(c));',
            '    float lx = 1.0 - smoothstep(0.0, 0.07, abs(f.x - 0.5));',
            '    float ly = 1.0 - smoothstep(0.0, 0.07, abs(f.y - 0.5));',
            '    return max(lx * on, ly * (1.0 - on)) * step(0.3, aHash(c + 7.0));',
            '  } else if (uPattern == 1) {',  // filigree: interlaced swirls
            '    float a = sin(q.y * 70.0 + sin(q.x * 40.0) * 2.4) * sin(q.x * 55.0 + q.z * 40.0 + sin(q.y * 30.0) * 2.0);',
            '    return 1.0 - smoothstep(0.0, 0.16, abs(a));',
            '  } else if (uPattern == 2) {',  // scales: offset rows of rounded plates
            '    vec2 g = vec2(q.x * 30.0 + q.z * 30.0, q.y * 40.0); g.x += 0.5 * mod(floor(g.y), 2.0);',
            '    vec2 f = fract(g) - 0.5; float d = length(f * vec2(1.0, 1.3));',
            '    return smoothstep(0.38, 0.47, d);',
            '  }',
            '  float r = fract(q.y * 34.0);',  // ribs: horizontal bands
            '  return 1.0 - smoothstep(0.0, 0.09, abs(r - 0.5) - 0.38);',
            '}',
          ].join('\n'))
          .replace('#include <emissivemap_fragment>', [
            '#include <emissivemap_fragment>',
            '{',
            '  vec3 q = (vObjPos - uMin) * uInvH;',
            // the machine field: noise + one side creeping up (the portrait) + more
            // machine at the joints of the frame (spine, collar)
            '  float side = smoothstep(-0.02, 0.25, -(vObjPos.x * uInvH)) * uAsym;',
            '  float spine = (1.0 - smoothstep(0.0, 0.05, abs(vObjPos.x * uInvH))) * 0.18;',
            '  float collar = exp(-pow((q.y - 0.86) / 0.04, 2.0)) * 0.22;',
            '  float field = aFbm(q * 7.0) + 0.42 * side + spine + collar;',
            '  float thr = 1.32 - uCoverage * 1.1;',
            '  float mask = max(smoothstep(thr - 0.015, thr + 0.015, field), uForce);',
            '  float edge = (1.0 - smoothstep(0.0, 0.035, abs(field - thr))) * (1.0 - uForce);',
            '  float pores = 0.93 + 0.1 * aNoise(q * 180.0);',
            '  float panel = 0.85 + 0.25 * aNoise(floor(q * 18.0));',
            '  vec3 skinC = uSkin * pores;',
            '  vec3 plateC = uPlate * panel;',
            '  diffuseColor.rgb = mix(skinC, plateC, mask);',
            '  roughnessFactor = mix(0.58, 0.26, mask);',
            '  metalnessFactor = mix(0.0, 0.88, mask);',
            '  float lines = aLines(q) * mask * (1.0 - uForce * 0.6);',
            '  float pulse = 0.78 + 0.22 * sin(uTime * 2.2 + q.y * 12.0);',
            '  float seam = clamp(edge * 1.4 + lines * 0.75, 0.0, 1.5);',
            '  totalEmissiveRadiance += uSeam * seam * uGlow * pulse;',
            // a warm rim on flesh reads as blood under skin (cheap subsurface hint)
            '  float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);',
            '  totalEmissiveRadiance += uSkin * vec3(1.0, 0.55, 0.45) * rim * 0.22 * (1.0 - mask);',
            '}',
          ].join('\n'));
      };
      return m;
    }
    return { surface: mk(false), joints: mk(true), uniforms: shared, pack: p };
  };

  // ── #style=… share links: open a link, the look lands in your wardrobe ──────
  function consumeShareHash() {
    try {
      var h = String(global.location && global.location.hash || '');
      var m = h.match(/[#&]style=([A-Za-z0-9_-]{8,6000})/);
      if (!m) return;
      var p = WS.register(JSON.parse(b64urlDecode(m[1])));
      WS.setSelf(p.id);
      try { history.replaceState(null, '', global.location.pathname + global.location.search); } catch (_) {}
      WS.lastShared = p;
    } catch (e) { console.warn('[augment] share link ignored:', e && e.message); }
  }
  consumeShareHash();

  global.WorldStyles = WS;
})(typeof window !== 'undefined' ? window : globalThis);
