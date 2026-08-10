'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   RUNWAY — the universal execution engine.
   ───────────────────────────────────────────────────────────────────────────
   THE PROBLEM IT SOLVES

   The council produces documents that are correct and unshippable. A 370-line
   markdown file with five paste-ready Reddit posts, timing rules, warnings and
   context is a *perfect* artifact and an *impossible* task: you cannot execute
   it on a phone, because executing it means holding ten things in your head
   while scrolling past nine of them to find the tenth.

   RUNWAY inverts that. A document is compiled once into a workflow (.wf.json)
   and then rendered as ONE CARD AT A TIME. You never see step 4 while doing
   step 1. Every paste-ready string is a button, not a selection gesture. The
   timing rules are a live countdown instead of a sentence you have to remember.
   Context is folded away until you ask for it.

   ───────────────────────────────────────────────────────────────────────────
   THE ONE-CARD LAW (and why it's also the collision fix)

   Exactly one step card is in the DOM at a time. This is a UX decision first —
   focus is the entire product — but it is also the reason this surface cannot
   violate the NO-COLLISION LAW: there is only ever one card, in normal document
   flow, inside a single column, with nothing fixed except the topbar and the
   rail. Nothing can overlap because there is nothing to overlap with.

   ───────────────────────────────────────────────────────────────────────────
   STATE

   Progress is localStorage, keyed per workflow id, and is deliberately NOT on
   the server: a half-finished Reddit launch is not data worth syncing, and a
   surface that needs auth to show you your own checklist is a surface you
   won't open on a phone at 3am. Zero-auth by design.

     vint:runway:<workflowId>  →  { done: {stepId: ts}, at: stepIndex, started }

   ───────────────────────────────────────────────────────────────────────────
   PUBLIC API

     Runway.mount(el, workflow)   → renders and takes over the element
     Runway.load(url)             → fetch + parse a .wf.json
     Runway.progress(workflowId)  → { done, total, pct } without mounting

   Vinta directive 2026-08-10. Council: Helios-10 (one-card focus, copy-as-the-
   primary-verb), Aria (the tone of the completion states — earned, not
   confetti), Atlas (the cooldown clock as a real gate, not a suggestion).
   ═══════════════════════════════════════════════════════════════════════════ */

(function (root) {
  if (!root || !root.document) return;

  const D = root.document;
  const LSKEY = (id) => `vint:runway:${id}`;

  // ── state ────────────────────────────────────────────────────────────────

  function readState(id) {
    try {
      const raw = localStorage.getItem(LSKEY(id));
      if (!raw) return { done: {}, at: 0, started: 0 };
      const s = JSON.parse(raw);
      return {
        done: (s && typeof s.done === 'object' && s.done) || {},
        at: Number(s && s.at) || 0,
        started: Number(s && s.started) || 0,
      };
    } catch (_) {
      return { done: {}, at: 0, started: 0 };
    }
  }

  function writeState(id, s) {
    try { localStorage.setItem(LSKEY(id), JSON.stringify(s)); } catch (_) {}
  }

  function progress(id, total) {
    const s = readState(id);
    const done = Object.keys(s.done).length;
    return { done, total: total || 0, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  // ── time ─────────────────────────────────────────────────────────────────

  // "3h 42m" / "4m 10s" / "now". Deliberately never shows seconds above an
  // hour — a countdown that ticks every second at the hour scale reads as
  // anxiety, and the whole point of the cooldown is that you go do something
  // else.
  function humanGap(ms) {
    if (ms <= 0) return 'now';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  }

  // ── dom helpers ──────────────────────────────────────────────────────────

  function el(tag, cls, text) {
    const n = D.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Clipboard with a real fallback. execCommand is deprecated but it is the
  // only thing that works in a non-secure context, and this surface is opened
  // from file:// during authoring often enough that losing copy there would
  // defeat the entire premise.
  async function copy(text) {
    try {
      if (navigator.clipboard && root.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const ta = D.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      D.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = D.execCommand('copy');
      D.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  // ── the engine ───────────────────────────────────────────────────────────

  function mount(host, wf) {
    if (!host || !wf || !Array.isArray(wf.steps) || !wf.steps.length) return null;

    const steps = wf.steps;
    const total = steps.length;
    let state = readState(wf.id);
    if (!state.started) { state.started = Date.now(); writeState(wf.id, state); }

    // Clamp a persisted index that no longer exists (workflow was edited).
    if (state.at >= total) state.at = total;

    let tickTimer = null;

    if (wf.accent) host.style.setProperty('--rw-accent', wf.accent);

    // ── static scaffold ────────────────────────────────────────────────────
    host.innerHTML = '';
    host.classList.add('rw-root');

    const rail = el('div', 'rw-rail');
    const railFill = el('div', 'rw-rail-fill');
    const railMeta = el('div', 'rw-rail-meta');
    const railCount = el('span', 'rw-rail-count');
    const railPct = el('span', 'rw-rail-pct');
    railMeta.appendChild(railCount);
    railMeta.appendChild(railPct);
    rail.appendChild(railFill);

    const dots = el('div', 'rw-dots');

    const stage = el('div', 'rw-stage');

    host.appendChild(rail);
    host.appendChild(railMeta);
    host.appendChild(dots);
    host.appendChild(stage);

    // ── dots ───────────────────────────────────────────────────────────────

    function renderDots() {
      dots.innerHTML = '';
      steps.forEach((st, i) => {
        const d = el('button', 'rw-dot');
        d.type = 'button';
        d.setAttribute('aria-label', `Step ${i + 1}: ${st.title}`);
        if (state.done[st.id]) d.classList.add('is-done');
        if (i === state.at) d.classList.add('is-here');
        if (st.optional) d.classList.add('is-optional');
        d.appendChild(el('span', 'rw-dot-mark', state.done[st.id] ? '✓' : String(i + 1)));
        d.addEventListener('click', () => { state.at = i; save(); render(); });
        dots.appendChild(d);
      });
    }

    function renderRail() {
      const p = progress(wf.id, total);
      railFill.style.width = p.pct + '%';
      railCount.textContent = `${p.done} of ${total} done`;
      railPct.textContent = p.pct + '%';
    }

    function save() { writeState(wf.id, state); }

    // ── cooldown ───────────────────────────────────────────────────────────

    // A step is gated when the PREVIOUS step declared a cooldown and was
    // completed less than that long ago. This models the real rule from the
    // source doc ("space them ~4+ hours apart") as a thing the interface
    // knows, rather than a thing you have to remember.
    function gateOf(i) {
      if (i <= 0) return null;
      const prev = steps[i - 1];
      const hrs = Number(prev.cooldownHours) || 0;
      if (!hrs) return null;
      const at = state.done[prev.id];
      if (!at) return null;
      const readyAt = at + hrs * 3600 * 1000;
      const left = readyAt - Date.now();
      return left > 0 ? { left, readyAt, from: prev } : null;
    }

    // ── the card ───────────────────────────────────────────────────────────

    function stepCard(i) {
      const st = steps[i];
      const card = el('article', 'rw-card');
      const done = !!state.done[st.id];
      if (done) card.classList.add('is-done');

      // header
      const head = el('header', 'rw-card-head');
      const kicker = el('div', 'rw-kicker');
      kicker.appendChild(el('span', 'rw-kicker-idx', `Step ${i + 1} / ${total}`));
      if (st.risk && st.risk !== 'none') {
        kicker.appendChild(el('span', `rw-risk rw-risk-${st.risk}`, `${st.risk} risk`));
      }
      if (st.optional) kicker.appendChild(el('span', 'rw-risk rw-risk-opt', 'optional'));
      head.appendChild(kicker);
      head.appendChild(el('h2', 'rw-card-title', st.title));
      if (st.tagline) head.appendChild(el('p', 'rw-card-tagline', st.tagline));
      card.appendChild(head);

      // warn — the sharp thing, never folded away
      if (st.warn) {
        const w = el('div', 'rw-warn');
        w.appendChild(el('span', 'rw-warn-mark', '!'));
        w.appendChild(el('p', 'rw-warn-text', st.warn));
        card.appendChild(w);
      }

      // fields — every paste-ready string is a button
      (st.fields || []).forEach((f, fi) => {
        const box = el('div', 'rw-field');
        const fh = el('div', 'rw-field-head');
        fh.appendChild(el('span', 'rw-field-label', f.label || `Field ${fi + 1}`));

        const btn = el('button', 'rw-copy');
        btn.type = 'button';
        btn.appendChild(el('span', 'rw-copy-label', 'Copy'));
        btn.addEventListener('click', async () => {
          const ok = await copy(f.value);
          btn.classList.add(ok ? 'is-ok' : 'is-fail');
          btn.querySelector('.rw-copy-label').textContent = ok ? 'Copied' : 'Select it';
          if (!ok) { pre.setAttribute('tabindex', '0'); pre.focus(); }
          setTimeout(() => {
            btn.classList.remove('is-ok', 'is-fail');
            btn.querySelector('.rw-copy-label').textContent = 'Copy';
          }, 1600);
        });
        fh.appendChild(btn);
        box.appendChild(fh);

        const pre = el('pre', 'rw-field-body' + (f.mono ? ' is-mono' : ''));
        pre.textContent = f.value;
        box.appendChild(pre);
        card.appendChild(box);
      });

      // why — folded by default. Context on demand, never in your face.
      if (st.why) {
        const det = el('details', 'rw-why');
        const sum = el('summary', 'rw-why-sum', 'Why this one, and why now');
        det.appendChild(sum);
        det.appendChild(el('p', 'rw-why-body', st.why));
        card.appendChild(det);
      }

      // actions
      const acts = el('div', 'rw-acts');

      if (st.target) {
        const go = el('a', 'rw-go');
        go.href = st.target;
        go.target = '_blank';
        go.rel = 'noopener noreferrer';
        go.textContent = st.targetLabel || 'Open';
        acts.appendChild(go);
      }

      const mark = el('button', 'rw-mark');
      mark.type = 'button';
      mark.textContent = done ? 'Undo this step' : 'Mark done';
      if (done) mark.classList.add('is-undo');
      mark.addEventListener('click', () => {
        if (state.done[st.id]) {
          delete state.done[st.id];
        } else {
          state.done[st.id] = Date.now();
          if (state.at === i && i < total) state.at = i + 1;
        }
        save();
        render();
      });
      acts.appendChild(mark);

      card.appendChild(acts);

      if (st.afterNote && done) {
        card.appendChild(el('p', 'rw-after', st.afterNote));
      }

      return card;
    }

    // ── gate card (cooldown) ───────────────────────────────────────────────

    function gateCard(i, gate) {
      const st = steps[i];
      const card = el('article', 'rw-card rw-card-gate');
      const kicker = el('div', 'rw-kicker');
      kicker.appendChild(el('span', 'rw-kicker-idx', `Step ${i + 1} / ${total}`));
      card.appendChild(kicker);
      card.appendChild(el('h2', 'rw-card-title', st.title));

      const clock = el('div', 'rw-clock');
      const num = el('div', 'rw-clock-num', humanGap(gate.left));
      clock.appendChild(el('div', 'rw-clock-label', 'Available in'));
      clock.appendChild(num);
      card.appendChild(clock);

      card.appendChild(el('p', 'rw-gate-note',
        `Spacing is the rule that keeps the account alive. Five posts inside an hour from one account is the most reliable way to get spam-filtered. This unlocks itself — close the tab.`));

      const acts = el('div', 'rw-acts');
      const anyway = el('button', 'rw-mark rw-mark-ghost');
      anyway.type = 'button';
      anyway.textContent = 'Do it anyway';
      anyway.addEventListener('click', () => {
        card.dataset.override = '1';
        render(true);
      });
      acts.appendChild(anyway);
      card.appendChild(acts);

      // live tick — 1s under a minute, 20s otherwise. Cheap, and stops when
      // the card is replaced.
      clearInterval(tickTimer);
      tickTimer = setInterval(() => {
        const g = gateOf(i);
        if (!g) { clearInterval(tickTimer); render(); return; }
        num.textContent = humanGap(g.left);
      }, gate.left < 60000 ? 1000 : 20000);

      return card;
    }

    // ── done card ──────────────────────────────────────────────────────────

    function doneCard() {
      const card = el('article', 'rw-card rw-card-done');
      card.appendChild(el('div', 'rw-done-mark', '✓'));
      card.appendChild(el('h2', 'rw-card-title', 'Every step is behind you.'));

      const p = progress(wf.id, total);
      card.appendChild(el('p', 'rw-card-tagline',
        `${p.done} of ${total} complete. The part that mattered is done — what happens next is other people's move, not yours.`));

      if (wf.outro) {
        const det = el('details', 'rw-why');
        det.appendChild(el('summary', 'rw-why-sum', wf.outro.title || 'What happens now'));
        det.appendChild(el('p', 'rw-why-body', wf.outro.body || ''));
        card.appendChild(det);
      }

      const acts = el('div', 'rw-acts');
      const again = el('button', 'rw-mark rw-mark-ghost');
      again.type = 'button';
      again.textContent = 'Start over';
      again.addEventListener('click', () => {
        state = { done: {}, at: 0, started: Date.now() };
        save();
        render();
      });
      acts.appendChild(again);
      card.appendChild(acts);
      return card;
    }

    // ── nav ────────────────────────────────────────────────────────────────

    function navRow() {
      const nav = el('nav', 'rw-nav');

      const prev = el('button', 'rw-nav-btn');
      prev.type = 'button';
      prev.textContent = 'Back';
      prev.disabled = state.at <= 0;
      prev.addEventListener('click', () => { state.at = Math.max(0, state.at - 1); save(); render(); });

      const next = el('button', 'rw-nav-btn');
      next.type = 'button';
      next.textContent = 'Skip ahead';
      next.disabled = state.at >= total;
      next.addEventListener('click', () => { state.at = Math.min(total, state.at + 1); save(); render(); });

      nav.appendChild(prev);
      nav.appendChild(next);
      return nav;
    }

    // ── render ─────────────────────────────────────────────────────────────

    function render(overrideGate) {
      clearInterval(tickTimer);
      stage.innerHTML = '';
      renderRail();
      renderDots();

      const i = state.at;

      if (i >= total) {
        stage.appendChild(doneCard());
        stage.appendChild(navRow());
        return;
      }

      const gate = overrideGate ? null : gateOf(i);
      stage.appendChild(gate ? gateCard(i, gate) : stepCard(i));
      stage.appendChild(navRow());
    }

    render();

    return {
      render,
      destroy() { clearInterval(tickTimer); host.innerHTML = ''; },
      state: () => readState(wf.id),
    };
  }

  // ── loader ───────────────────────────────────────────────────────────────

  async function load(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`workflow ${res.status}`);
    const wf = await res.json();
    if (!wf.id) throw new Error('workflow has no id');
    if (!Array.isArray(wf.steps)) throw new Error('workflow has no steps');
    return wf;
  }

  root.Runway = { mount, load, progress, copy, humanGap };
})(typeof window !== 'undefined' ? window : null);
