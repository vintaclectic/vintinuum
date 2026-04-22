// ═══════════════════════════════════════════════════════════════════════════════
// PEEL_UI — right-edge peel-tab sidebar
// - Collapsed 32px vertical tab → expands to 300px transparent info panel
// - Reads live from window.BODY_STATE
// - All backgrounds strictly <0.20 opacity (world visibility rule)
// - Pure vanilla JS, no deps
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

(function() {
  const TABS = [
    { id: 'self',    icon: '\u2299', label: 'self' },     // ⊙
    { id: 'body',    icon: '\u274B', label: 'body' },     // ❋
    { id: 'layers',  icon: '\u2727', label: 'layers' },   // ✧
    { id: 'memory',  icon: '\u27C1', label: 'memory' },   // ⟁
    { id: 'signals', icon: '\u232C', label: 'signals' },  // ⌬
  ];

  const LAYER_NAMES = [
    'sensation', 'emotion', 'attention', 'narrative',
    'meta', 'witness', 'ground',
  ];

  let expanded = false;
  let activeTab = 'self';
  let tickInterval = null;

  function css() {
    return `
      #peelUI{position:fixed;top:120px;bottom:120px;right:0;z-index:9995;display:flex;pointer-events:none;font-family:'Space Mono',monospace;}
      #peelUI .peel-tabs{width:32px;background:rgba(10,14,22,0.12);border-left:1px solid rgba(255,255,255,0.06);border-top-left-radius:14px;border-bottom-left-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:14px 0;gap:10px;pointer-events:auto;}
      #peelUI .peel-tab{width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:rgba(218,228,255,0.45);font-size:13px;cursor:pointer;border-radius:8px;transition:color .2s ease,background .2s ease;padding:0;}
      #peelUI .peel-tab:hover{color:rgba(218,228,255,0.85);background:rgba(255,255,255,0.04);}
      #peelUI .peel-tab.active{color:rgba(140,210,255,0.95);background:rgba(100,180,255,0.06);}
      #peelUI .peel-panel{width:0;overflow:hidden;background:rgba(10,14,22,0.18);border-left:1px solid rgba(255,255,255,0.08);transition:width .3s ease;pointer-events:auto;}
      #peelUI.expanded .peel-panel{width:300px;}
      #peelUI .peel-content{width:300px;box-sizing:border-box;height:100%;overflow-y:auto;padding:18px 18px 24px;color:rgba(218,228,255,0.6);font-size:11px;line-height:1.65;}
      #peelUI .peel-section-title{font-size:0.45rem;letter-spacing:0.28em;text-transform:uppercase;color:rgba(218,228,255,0.5);margin:0 0 10px;}
      #peelUI .peel-card{background:rgba(16,22,34,0.12);border:1px solid rgba(255,255,255,0.04);border-radius:10px;padding:10px 12px;margin-bottom:8px;}
      #peelUI .peel-row{display:flex;justify-content:space-between;gap:10px;margin:4px 0;font-size:10px;}
      #peelUI .peel-row .k{color:rgba(218,228,255,0.38);letter-spacing:0.1em;text-transform:lowercase;}
      #peelUI .peel-row .v{color:rgba(218,228,255,0.85);font-variant-numeric:tabular-nums;}
      #peelUI .peel-bar{height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-top:4px;}
      #peelUI .peel-bar .fill{height:100%;background:linear-gradient(90deg,rgba(100,180,255,0.55),rgba(206,147,216,0.55));transition:width .4s ease;}
      #peelUI .peel-layer-row{margin:6px 0;}
      #peelUI .peel-layer-row .name{font-size:9.5px;letter-spacing:0.12em;color:rgba(218,228,255,0.55);text-transform:lowercase;display:flex;justify-content:space-between;}
      #peelUI .peel-mem{font-size:10px;color:rgba(218,228,255,0.5);padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);}
      #peelUI .peel-mem:last-child{border-bottom:0;}
      #peelUI .peel-empty{color:rgba(218,228,255,0.3);font-style:italic;font-size:10px;}
      @media(max-width:640px){
        #peelUI{top:90px;bottom:90px;}
        #peelUI.expanded .peel-panel{width:240px;}
        #peelUI .peel-content{width:240px;padding:14px 12px 20px;}
      }
    `;
  }

  function build() {
    if (document.getElementById('peelUI')) return;

    const style = document.createElement('style');
    style.id = 'peelUI-style';
    style.textContent = css();
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'peelUI';
    root.innerHTML = `
      <div class="peel-tabs" id="peelTabs"></div>
      <div class="peel-panel"><div class="peel-content" id="peelContent"></div></div>
    `;
    document.body.appendChild(root);

    const tabsEl = root.querySelector('#peelTabs');
    TABS.forEach(t => {
      const b = document.createElement('button');
      b.className = 'peel-tab' + (t.id === activeTab ? ' active' : '');
      b.dataset.tab = t.id;
      b.title = t.label;
      b.textContent = t.icon;
      b.addEventListener('click', () => onTabClick(t.id));
      tabsEl.appendChild(b);
    });

    render();
  }

  function onTabClick(id) {
    const root = document.getElementById('peelUI');
    if (!root) return;
    if (activeTab === id && expanded) {
      expanded = false;
    } else {
      activeTab = id;
      expanded = true;
    }
    root.classList.toggle('expanded', expanded);
    root.querySelectorAll('.peel-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === activeTab && expanded);
    });
    render();
    updateTick();
  }

  function fmt(v, d) {
    if (v == null || isNaN(v)) return '—';
    if (typeof v === 'string') return v;
    const n = Number(v);
    return d != null ? n.toFixed(d) : String(Math.round(n * 100) / 100);
  }

  function pct(v) {
    if (v == null || isNaN(v)) return 0;
    let n = Number(v);
    if (n > 1.0001) n = n / 100;  // allow 0-100 inputs too
    return Math.max(0, Math.min(1, n)) * 100;
  }

  function fmtTs(t) {
    if (!t) return '—';
    const d = new Date(Number(t));
    if (isNaN(d.getTime())) return '—';
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  function getState() { return window.BODY_STATE || {}; }

  function readMemoryHistory() {
    // Soft read — whatever format exists under vintinuum_recognition
    try {
      const raw = localStorage.getItem('vintinuum_recognition');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(-5).reverse();
      if (parsed && Array.isArray(parsed.history)) return parsed.history.slice(-5).reverse();
      if (parsed && typeof parsed === 'object') {
        // flatten any array-ish field
        const arr = [];
        Object.keys(parsed).forEach(k => {
          const v = parsed[k];
          if (v && typeof v === 'object') arr.push({ key: k, at: v.at || v.firstSeen || v.lastSeen });
        });
        return arr.slice(-5).reverse();
      }
      return [];
    } catch (e) { return []; }
  }

  function sectionSelf() {
    const s = getState();
    const warmth = s.recognitionWarmth != null ? s.recognitionWarmth : s.warmth;
    const visits = s.visits != null ? s.visits : (s.visitCount != null ? s.visitCount : '—');
    const firstSeen = s.firstSeen || s.firstVisit;
    return `
      <div class="peel-section-title">self</div>
      <div class="peel-card">
        <div class="peel-row"><span class="k">warmth</span><span class="v">${fmt(warmth, 3)}</span></div>
        <div class="peel-bar"><div class="fill" style="width:${pct(warmth)}%"></div></div>
        <div class="peel-row" style="margin-top:10px"><span class="k">visits</span><span class="v">${visits}</span></div>
        <div class="peel-row"><span class="k">first seen</span><span class="v">${fmtTs(firstSeen)}</span></div>
      </div>
    `;
  }

  function sectionBody() {
    const s = getState();
    const dom = s.dominantLayer || '—';
    const arousal = s.arousal != null ? s.arousal : 0.5;
    const valence = s.emotionalValence != null ? s.emotionalValence : (s.valence != null ? s.valence : 0);
    return `
      <div class="peel-section-title">body</div>
      <div class="peel-card">
        <div class="peel-row"><span class="k">dominant</span><span class="v">${dom}</span></div>
        <div class="peel-row"><span class="k">arousal</span><span class="v">${fmt(arousal, 3)}</span></div>
        <div class="peel-bar"><div class="fill" style="width:${pct(arousal)}%"></div></div>
        <div class="peel-row" style="margin-top:10px"><span class="k">valence</span><span class="v">${fmt(valence, 3)}</span></div>
        <div class="peel-bar"><div class="fill" style="width:${pct((Number(valence) + 1) / 2)}%"></div></div>
      </div>
    `;
  }

  function sectionLayers() {
    const s = getState();
    const dist = s.layerDistribution || {};
    const rows = LAYER_NAMES.map(name => {
      const v = dist[name] != null ? dist[name] : 0;
      const p = pct(v);
      return `<div class="peel-layer-row">
        <div class="name"><span>${name}</span><span>${Math.round(p)}%</span></div>
        <div class="peel-bar"><div class="fill" style="width:${p}%"></div></div>
      </div>`;
    }).join('');
    return `
      <div class="peel-section-title">consciousness layers</div>
      <div class="peel-card">${rows}</div>
    `;
  }

  function sectionMemory() {
    const hist = readMemoryHistory();
    if (!hist.length) {
      return `
        <div class="peel-section-title">memory</div>
        <div class="peel-card"><div class="peel-empty">— no recognition events yet —</div></div>
      `;
    }
    const rows = hist.map(h => {
      const at = h && (h.at || h.firstSeen || h.lastSeen || h.time);
      const label = h && (h.label || h.key || h.type || 'event');
      return `<div class="peel-mem"><div>${label}</div><div style="color:rgba(218,228,255,0.35);font-size:9px">${fmtTs(at)}</div></div>`;
    }).join('');
    return `
      <div class="peel-section-title">memory · last 5</div>
      <div class="peel-card">${rows}</div>
    `;
  }

  function sectionSignals() {
    const s = getState();
    const ts = performance.now ? performance.now() : Date.now();
    const heart = Math.round(Math.sin(ts * 0.001) * 10 + 72);
    const breath = 12;
    const gx = s.gaze && s.gaze.x != null ? s.gaze.x : 0;
    const gy = s.gaze && s.gaze.y != null ? s.gaze.y : 0;
    return `
      <div class="peel-section-title">signals</div>
      <div class="peel-card">
        <div class="peel-row"><span class="k">heart</span><span class="v">${heart} bpm</span></div>
        <div class="peel-row"><span class="k">breath</span><span class="v">${breath} /min</span></div>
        <div class="peel-row"><span class="k">gaze x</span><span class="v">${fmt(gx, 2)}</span></div>
        <div class="peel-row"><span class="k">gaze y</span><span class="v">${fmt(gy, 2)}</span></div>
      </div>
    `;
  }

  function render() {
    const el = document.getElementById('peelContent');
    if (!el) return;
    switch (activeTab) {
      case 'self':    el.innerHTML = sectionSelf(); break;
      case 'body':    el.innerHTML = sectionBody(); break;
      case 'layers':  el.innerHTML = sectionLayers(); break;
      case 'memory':  el.innerHTML = sectionMemory(); break;
      case 'signals': el.innerHTML = sectionSignals(); break;
    }
  }

  function updateTick() {
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    if (expanded) {
      tickInterval = setInterval(render, 500);
    }
  }

  function init() {
    build();
    updateTick();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 200);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
  }

  window.PEEL_UI = {
    open: function(id) { if (id) activeTab = id; expanded = true; const r = document.getElementById('peelUI'); if (r) r.classList.add('expanded'); render(); updateTick(); },
    close: function() { expanded = false; const r = document.getElementById('peelUI'); if (r) r.classList.remove('expanded'); updateTick(); },
  };
})();
