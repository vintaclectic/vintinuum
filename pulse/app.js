/* Vintinuum Pulse — the phone as a sense organ. 2026-11-23.
 * Talks only to the brain's public API (api_base.js picks the base).
 * Sign-in: pairing code → JWT pair (same localStorage keys as phone.html, so a phone
 * paired there is paired here). Every request carries X-Device-Id, because the brain
 * binds refresh tokens to the device that paired. A 401 refreshes once; a refresh the
 * brain rejects sends you back to pairing with the brain's own reason on screen. */
(() => {
'use strict';
const VERSION = 'pulse 1.1 · 2026-11-23';
const API = (window.__VINTINUUM_API_BASE || 'https://api.vintaclectic.com').replace(/\/$/, '');
const $ = s => document.querySelector(s);
const LS = {
  get: k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {} },
};
const token = () => LS.get('vint_access_token') || LS.get('vint_token');
function deviceId() {
  let id = LS.get('_vint_did');
  if (!/^[a-zA-Z0-9_\-]{8,128}$/.test(id)) {
    const r = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^a-z0-9]/gi, '');
    id = 'phone-' + r.slice(0, 24); LS.set('_vint_did', id);
  }
  return id;
}

// ── sheets: what's behind an open sheet can't be tapped or read ─────────────
function sheet(id, open) {
  $(id).hidden = !open;
  const any = !$('#pair').hidden || !$('#settings').hidden;
  ['.top', '#toast', '.views', '.dock'].forEach(s => { const e = $(s); if (e) e.inert = any; });
}
// ── toast ───────────────────────────────────────────────────────────────────
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}

// ── connection state ───────────────────────────────────────────────────────
function setConn(kind, txt) {
  const c = $('#conn'); c.classList.remove('ok', 'bad'); if (kind) c.classList.add(kind);
  $('#connTxt').textContent = txt;
}

// ── API with refresh ───────────────────────────────────────────────────────
let refreshing = null;
async function refresh() {
  const rt = LS.get('vint_refresh_token');
  if (!rt) return { ok: false, status: 401, reason: 'no refresh token on this phone' };
  if (!refreshing) refreshing = (async () => {
    try {
      const r = await fetch(API + '/api/v2/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId() },
        body: JSON.stringify({ refreshToken: rt }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.accessToken) {
        LS.set('vint_access_token', d.accessToken); LS.set('vint_refresh_token', d.refreshToken || rt);
        syncSW(); return { ok: true };
      }
      return { ok: false, status: r.status, reason: (d.code || '') + (d.error ? ' · ' + d.error : '') };
    } catch (e) { return { ok: false, offline: true, reason: e.message }; }
    finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}
async function api(path, opts = {}, retried) {
  const h = Object.assign({ 'X-Device-Id': deviceId() }, opts.headers || {});
  if (opts.json !== undefined) { h['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json); }
  const t = token(); if (t) h.Authorization = 'Bearer ' + t;
  const r = await fetch(API + path, Object.assign({}, opts, { headers: h }));
  if (r.status === 401 && !retried && t) {
    const f = await refresh();
    if (f.ok) return api(path, opts, true);
    if (!f.offline && (f.status === 401 || f.status === 403)) signedOut('Sign-in expired — pair again. (' + (f.reason || f.status) + ')');
    else if (!f.offline) toast('sign-in refresh failed: ' + (f.reason || f.status), 6000);
  }
  return r;
}
async function getJSON(path) { const r = await api(path); if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); }

// ── pairing ────────────────────────────────────────────────────────────────
function codeFrom(raw) {
  raw = String(raw || '').trim();
  try {
    const u = new URL(raw, location.href);
    for (const p of [u.searchParams, new URLSearchParams(u.hash.slice(1))])
      for (const k of ['pair', 'code']) { const v = p.get(k); if (v) return v.replace(/\s/g, '').toUpperCase(); }
  } catch (_) {}
  const bare = raw.replace(/\s/g, '').toUpperCase();
  return /^[A-Z0-9]{6,16}$/.test(bare) ? bare : '';
}
function signedOut(why) {
  ['vint_access_token', 'vint_refresh_token', 'vint_token'].forEach(k => LS.set(k, ''));
  syncSW(); showPair(why);
}
function showPair(why) {
  sheet('#pair', true);
  $('#pairLead').textContent = why ? 'Pair again' : (token() ? 'Pair with a new code' : 'Pair this phone');
  $('#closePair').hidden = !token();   // already signed in → you can back out
  const s = $('#pairStatus'); s.className = 'status small' + (why ? ' err' : ''); s.textContent = why || '';
  setConn('bad', 'tap to pair');
}
async function redeem(code) {
  code = codeFrom(code);
  const s = $('#pairStatus');
  if (!code) { s.className = 'status small err'; s.textContent = 'That isn’t a pairing code.'; return; }
  $('#pairGo').disabled = true; s.className = 'status small'; s.textContent = 'pairing…';
  try {
    const r = await fetch(API + '/api/v2/device/pair-redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId() },
      body: JSON.stringify({ code, device_id: deviceId(), platform: 'pulse-pwa' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || ('error ' + r.status));
    LS.set('vint_access_token', d.accessToken || d.access_token);
    LS.set('vint_refresh_token', d.refreshToken || d.refresh_token);
    LS.set('vint_user_id', String((d.user && d.user.id) || ''));
    LS.set('vint_display_name', (d.user && (d.user.display_name || d.user.name)) || '');
    try { window.dispatchEvent(new Event('vint:auth')); } catch (_) {}
    history.replaceState(null, '', location.pathname);
    s.className = 'status small ok'; s.textContent = '✓ paired';
    stopScan(); syncSW();
    setTimeout(() => { sheet('#pair', false); boot(); }, 500);
  } catch (e) {
    s.className = 'status small err';
    s.textContent = /already used/i.test(e.message) ? 'That code was already used — make a new one on your computer.'
                  : /expired/i.test(e.message) ? 'That code expired (they last 5 minutes) — make a new one.'
                  : /not found/i.test(e.message) ? 'Code not found — check the letters, or make a new one.'
                  : 'Could not pair: ' + e.message;
  } finally { $('#pairGo').disabled = false; }
}
// QR scan without a <video> tag: grab frames from the camera track, draw to a canvas, detect.
let scan = null;
async function startScan() {
  const c = $('#scanCam'), s = $('#pairStatus');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const track = stream.getVideoTracks()[0];
    const cap = new ImageCapture(track), det = new BarcodeDetector({ formats: ['qr_code'] });
    const g = c.getContext('2d'); c.hidden = false; scan = { stream, live: true };
    s.className = 'status small'; s.textContent = 'point at the QR on your computer';
    while (scan && scan.live) {
      const bmp = await cap.grabFrame().catch(() => null); if (!bmp) break;
      const side = Math.min(bmp.width, bmp.height);
      g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, c.width, c.height);
      const hits = await det.detect(bmp).catch(() => []);
      if (hits.length) { const code = codeFrom(hits[0].rawValue); if (code) { $('#pairCode').value = code; stopScan(); return redeem(code); } }
      await new Promise(r => setTimeout(r, 180));
    }
  } catch (e) { s.className = 'status small err'; s.textContent = e.name === 'NotAllowedError' ? 'Camera blocked — type the code instead, or allow the camera in site settings.' : 'Camera unavailable — type the code.'; stopScan(); }
}
function stopScan() { if (scan) { scan.live = false; scan.stream.getTracks().forEach(t => t.stop()); scan = null; } $('#scanCam').hidden = true; }

// ── views ──────────────────────────────────────────────────────────────────
function go(v) {
  document.querySelectorAll('.view').forEach(el => { el.hidden = el.dataset.view !== v; });
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.go === v));
  LS.set('pulse:view', v);
  if (v === 'pulse') loadPulses();
  if (v === 'chat') setTimeout(() => $('#msgs').scrollTop = 1e9, 0);
}

// ── body ───────────────────────────────────────────────────────────────────
const n01 = v => { v = Number(v); if (!isFinite(v)) return null; return v > 1.0001 ? v / 100 : v; };
function paintBody(b) {
  if (!b) return;
  document.querySelectorAll('.meter').forEach(m => {
    const v = n01(b[m.dataset.k]); if (v == null) return;
    m.querySelector('.val').style.strokeDashoffset = String(94.25 * (1 - Math.max(0, Math.min(1, v))));
    m.querySelector('span').textContent = Math.round(v * 100);
  });
  const da = n01(b.dopamine) ?? .5, ht = n01(b.serotonin) ?? .5, ne = n01(b.norepinephrine) ?? .4;
  const orb = $('#orb');
  orb.style.setProperty('--h', String(Math.round(150 + (ht - da) * 120)));
  orb.style.setProperty('--a', String((.25 + da * .5).toFixed(2)));
  orb.style.setProperty('--beat', (6 - ne * 4).toFixed(1) + 's');
}
async function loadBody() {
  try { paintBody(await getJSON('/api/body-state')); setConn('ok', 'connected'); }
  catch (_) { setConn(navigator.onLine ? 'bad' : '', navigator.onLine ? 'brain unreachable' : 'offline'); }
}
async function loadThought() {
  try {
    const d = await getJSON('/api/inner-life/snapshot');
    const t = (d.thoughts && d.thoughts[0] && (d.thoughts[0].thought || d.thoughts[0].text)) || d.thought;
    if (t) { const p = document.createElement('p'); p.textContent = t; $('#thought').replaceChildren(p); }
    if (d.bodyState) paintBody(d.bodyState);
  } catch (_) {}
}
// The brain's life layers (life:event.layer / life:snapshot.layers), each with its own mark + colour.
const LAYER = {
  neural:       { g: '◎', c: '#00ffc8', n: 'neural' },
  emotional:    { g: '♥', c: '#ff7aa8', n: 'emotional' },
  subconscious: { g: '☽', c: '#8b7bff', n: 'subconscious' },
  immune:       { g: '✚', c: '#5dffa8', n: 'immune' },
  metabolic:    { g: '⚡', c: '#ffb347', n: 'metabolic' },
  genetic:      { g: '⧖', c: '#6ec8ff', n: 'genetic' },
  social:       { g: '◍', c: '#ffd36e', n: 'social' },
  endocrine:    { g: '⚗', c: '#ff9d5c', n: 'endocrine' },
  memory:       { g: '◇', c: '#c9b6ff', n: 'memory' },
  pulse:        { g: '∿', c: '#00ffc8', n: 'your pulse' },
};
const layerOf = k => LAYER[k] || { g: '·', c: '#a0b4ff', n: k || 'life' };
const ago = ts => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? 'now' : s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd'; };
function feedItem(list, layer, text, ts, intensity, max = 40) {
  const L = typeof layer === 'object' ? layer : layerOf(layer);
  const li = document.createElement('li');
  li.innerHTML = '<i></i><div class="ev"><span></span><small></small></div><time></time>';
  li.style.setProperty('--lc', L.c);
  li.style.setProperty('--li', String(Math.max(.15, Math.min(1, intensity == null ? .4 : Number(intensity) || .4))));
  li.querySelector('i').textContent = L.g; li.querySelector('span').textContent = text;
  li.querySelector('small').textContent = L.n;
  const t = li.querySelector('time'); t.dataset.ts = String(ts || Date.now()); t.textContent = ago(ts || Date.now());
  list.prepend(li); while (list.children.length > max) list.lastChild.remove();
  return li;
}
setInterval(() => document.querySelectorAll('.feed time[data-ts]').forEach(t => { t.textContent = ago(Number(t.dataset.ts)); }), 30000);
function flashOrb(color, intensity) {
  const o = $('#orb'); o.style.setProperty('--flash', color); o.style.setProperty('--fi', String(.35 + (Number(intensity) || .3) * .65));
  o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
}
function paintLayers(layers, dominant) {
  const bar = $('#layers'); if (!bar || !layers) return;
  const entries = Object.entries(layers).filter(([, v]) => Number(v) > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + Number(v), 0) || 1;
  bar.replaceChildren(...entries.map(([k, v]) => {
    const L = layerOf(k), s = document.createElement('span');
    s.style.flexGrow = String(v / total); s.style.background = L.c; s.title = L.n + ' · ' + v;
    return s;
  }));
  const D = layerOf(dominant || (entries[0] && entries[0][0]));
  $('#layerTxt').textContent = D.g + ' ' + D.n + ' leads';
  $('#layerTxt').style.color = D.c;
}
let es = null;
function openStream() {
  if (es) try { es.close(); } catch (_) {}
  try {
    es = new EventSource(API + '/api/life/stream?userId=0');
    es.onmessage = ev => {
      let d; try { d = JSON.parse(ev.data); } catch (_) { return; }
      if (!d || d.type === 'life:hello') return;
      if (d.type === 'life:snapshot') { if (d.bodyState) paintBody(d.bodyState); paintLayers(d.layers, d.dominant); return; }
      const txt = d.content || d.detail || d.text || d.thought || d.message || d.summary;
      if (!txt) return;                       // never show a bare type name
      const L = layerOf(d.layer || d.region);
      const li = feedItem($('#feed'), L, String(txt).slice(0, 280), d.ts, d.intensity);
      li.classList.add('fresh'); setTimeout(() => li.classList.remove('fresh'), 1600);
      flashOrb(L.c, d.intensity);
    };
    es.onerror = () => {};
  } catch (_) {}
}

// ── pulse (offline-safe) ───────────────────────────────────────────────────
let act = '';
const OUTBOX = 'pulse:outbox';
const outbox = () => { try { return JSON.parse(LS.get(OUTBOX) || '[]'); } catch (_) { return []; } };
const setOutbox = q => { LS.set(OUTBOX, q.length ? JSON.stringify(q.slice(-200)) : ''); paintQueue(); };
function paintQueue() { const n = outbox().length; $('#queueTxt').textContent = n ? n + ' waiting to send' : ''; }
async function postPulse(p) {
  const r = await api('/api/life/pulse', { method: 'POST', json: p });
  if (r.status === 401) throw Object.assign(new Error('not signed in'), { auth: true });
  if (!r.ok) throw new Error('brain said ' + r.status);
  return r.json();
}
async function flushOutbox() {
  let q = outbox(); if (!q.length || !token()) return;
  const keep = [];
  for (const p of q) { try { await postPulse(p); } catch (e) { if (e.auth) return; keep.push(p); } }
  setOutbox(keep); if (q.length !== keep.length) { toast('sent ' + (q.length - keep.length) + ' waiting pulse' + (q.length - keep.length > 1 ? 's' : '')); loadPulses(); }
}
async function sendPulse(ev) {
  ev.preventDefault();
  const body = $('#pulseBody').value.trim();
  if (!body && !act) { toast('write something or pick an activity'); return; }
  const p = {
    pulse_type: 'moment', body: body || act, activity: act || undefined,
    mood_score: Number($('#mood').value) / 100, energy_level: Number($('#energy').value) / 100,
    tags: ['pulse-app'], client_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  };
  const btn = $('#pulseSend'); btn.disabled = true;
  try {
    await postPulse(p); toast('absorbed');
    $('#pulseBody').value = ''; act = ''; document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
    loadPulses(); setTimeout(loadBody, 1500);
  } catch (e) {
    if (e.auth) { setOutbox(outbox().concat(p)); toast('saved — will send once this phone is signed in'); }
    else { setOutbox(outbox().concat(p)); toast('offline — saved, sends automatically'); requestSync(); }
  } finally { btn.disabled = false; }
}
async function loadPulses() {
  try {
    const d = await getJSON('/api/life/pulse/recent?limit=20');
    const rows = d.pulses || d.items || d.rows || (Array.isArray(d) ? d : []);
    const list = $('#pulseList'); list.innerHTML = '';
    rows.slice(0, 20).reverse().forEach(r => feedItem(list, 'pulse', r.body || r.title || r.pulse_type, (r.created_at > 1e12 ? r.created_at : (r.created_at || r.ts || 0) * 1000) || Date.parse(r.created_at)));
  } catch (_) {}
}

// ── chat + voice ───────────────────────────────────────────────────────────
let persona = LS.get('pulse:persona') || 'vintinuum';
const convo = [];  // not `history` — that would shadow window.history
let speak = LS.get('pulse:speak') !== 'off';
function paintSpeak() { const b = $('#speakToggle'); b.classList.toggle('on', speak); b.querySelector('use').setAttribute('href', speak ? '#i-speaker' : '#i-mute'); }
async function loadPersonas() {
  try {
    const d = await getJSON('/api/personas');
    const row = $('#personas'); row.innerHTML = '';
    (d.personas || []).filter(p => !/^test/i.test(p.id || '')).forEach(p => {
      const b = document.createElement('button');
      b.className = 'persona' + (p.id === persona ? ' on' : ''); b.dataset.draggable = 'false';
      b.setAttribute('role', 'tab'); b.setAttribute('aria-label', p.name || p.id); b.title = p.name || p.id;
      b.style.color = p.color || 'var(--accent)'; b.textContent = p.sigil || '◆';
      b.onclick = () => { persona = p.id; LS.set('pulse:persona', persona); row.querySelectorAll('.persona').forEach(x => x.classList.toggle('on', x === b)); };
      row.appendChild(b);
    });
  } catch (_) {}
}
function addMsg(cls, text) { const m = document.createElement('div'); m.className = 'msg ' + cls; m.textContent = text; $('#msgs').appendChild(m); $('#msgs').scrollTop = 1e9; return m; }
let audio = null;
async function say(text) {
  if (!speak || !text) return;
  try {
    const r = await fetch(API + '/api/voice/say?text=' + encodeURIComponent(text.slice(0, 800)));
    if (!r.ok) return;
    const url = URL.createObjectURL(await r.blob());
    if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); }
    audio = new Audio(url); await audio.play().catch(() => {});
  } catch (_) {}
}
async function sendChat(text) {
  text = String(text || '').trim(); if (!text) return;
  $('#chatIn').value = ''; fitChat();
  addMsg('me', text); convo.push({ role: 'user', content: text });
  const her = addMsg('her', '…'); $('#chatSend').disabled = true;
  try {
    const r = await api('/chat', { method: 'POST', json: { message: text, history: convo.slice(-20), persona } });
    if (r.status === 402) { her.className = 'msg sys'; her.textContent = 'that voice needs an upgrade — try ◉'; return; }
    if (!r.ok || !r.body) throw new Error(String(r.status));
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', full = '';
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const l of lines) {
        if (!l.startsWith('data: ')) continue; const s = l.slice(6).trim(); if (s === '[DONE]') continue;
        try { const j = JSON.parse(s); const c = j.delta || j.text || ''; if (c) { full += c; her.textContent = full; $('#msgs').scrollTop = 1e9; } } catch (_) {}
      }
    }
    her.textContent = full || '…'; convo.push({ role: 'assistant', content: full }); say(full);
  } catch (e) { her.className = 'msg sys'; her.textContent = navigator.onLine ? 'the brain didn’t answer (' + e.message + ')' : 'offline'; }
  finally { $('#chatSend').disabled = false; }
}
function fitChat() { const t = $('#chatIn'); t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; }
let rec = null;
async function toggleMic() {
  const b = $('#micBtn');
  if (rec) { rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const chunks = []; rec = new MediaRecorder(stream, type ? { mimeType: type } : {});
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); b.classList.remove('rec'); b.querySelector('use').setAttribute('href', '#i-mic');
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); rec = null;
      if (blob.size < 1200) return;
      toast('listening…', 1500);
      try {
        const r = await api('/stt', { method: 'POST', headers: { 'Content-Type': blob.type.split(';')[0] }, body: blob });
        const d = await r.json().catch(() => ({}));
        if (d.transcript) sendChat(d.transcript); else toast(r.ok ? 'didn’t catch that' : 'listening failed (' + r.status + ')');
      } catch (_) { toast('listening failed — offline?'); }
    };
    rec.start(); b.classList.add('rec'); b.querySelector('use').setAttribute('href', '#i-stop');
    setTimeout(() => rec && rec.state === 'recording' && rec.stop(), 30000);
  } catch (e) { toast(e.name === 'NotAllowedError' ? 'microphone blocked — see ⚙' : 'no microphone'); }
}

// ── permissions: real state + how to fix it ────────────────────────────────
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const HOW = {
  notifications: isIOS
    ? ['Notifications only work from the home-screen app.', 'Safari → Share → Add to Home Screen.', 'Open it from the home screen, then ⚙ → turn on.']
    : ['Android Settings → Apps → Chrome → Notifications → on.', 'In Chrome: ⋮ → Settings → Site settings → Notifications → vintinuum.com → Allow.', 'Installed app? Settings → Apps → Vintinuum Pulse → Notifications → on.'],
  microphone: isIOS ? ['Settings → Safari → Microphone → Allow (or Ask).'] : ['Chrome: tap the lock icon by the address → Permissions → Microphone → Allow.'],
  geolocation: isIOS ? ['Settings → Privacy → Location Services → Safari Websites → While Using.'] : ['Chrome: lock icon → Permissions → Location → Allow.'],
};
async function permState(name) {
  if (name === 'notifications') {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return isIOS && !standalone ? 'needs home-screen app' : 'unsupported';
    if (Notification.permission === 'granted') return (await pushSub()) ? 'granted' : 'off';
    return Notification.permission; // default | denied
  }
  try { return (await navigator.permissions.query({ name })).state; } catch (_) { return 'unknown'; }
}
async function paintPerms() {
  const box = $('#perms'); box.innerHTML = '';
  const rows = [['notifications', 'Let her reach you'], ['microphone', 'Talk out loud'], ['geolocation', 'Where you are']];
  for (const [k, label] of rows) {
    const st = await permState(k);
    const el = document.createElement('div'); el.className = 'perm';
    el.innerHTML = '<b></b><span class="st"></span>';
    el.querySelector('b').textContent = label;
    const s = el.querySelector('.st'); s.textContent = st; s.classList.add(st === 'prompt' ? 'prompt' : st);
    if (st !== 'granted') {
      const b = document.createElement('button'); b.className = 'pill act'; b.dataset.draggable = 'false';
      b.textContent = st === 'denied' ? 'how to fix' : 'turn on';
      b.style.gridColumn = '1/-1';
      b.onclick = () => enablePerm(k, el);
      el.appendChild(b);
    }
    box.appendChild(el);
  }
}
function showHow(k, el, lead) {
  let h = el.querySelector('.how'); if (!h) { h = document.createElement('div'); h.className = 'how'; el.appendChild(h); }
  h.innerHTML = '<p></p><ol></ol>'; h.querySelector('p').textContent = lead;
  HOW[k].forEach(s => { const li = document.createElement('li'); li.textContent = s; h.querySelector('ol').appendChild(li); });
}
async function enablePerm(k, el) {
  if (k === 'notifications') {
    if (isIOS && !standalone) return showHow(k, el, 'On iPhone this needs the home-screen app:');
    const res = await pushOn();
    if (res.ok) toast('she can reach you now');
    else if (res.reason === 'denied') return showHow(k, el, 'Your phone refused without asking — it has notifications blocked for this site or for the browser. To fix:');
    else toast('couldn’t turn on: ' + res.reason, 5000);
  } else if (k === 'microphone') {
    try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(t => t.stop()); } catch (_) { return showHow(k, el, 'The microphone is blocked. To fix:'); }
  } else if (k === 'geolocation') {
    await new Promise(res => navigator.geolocation.getCurrentPosition(() => res(), () => { showHow(k, el, 'Location is blocked. To fix:'); res(); }, { timeout: 10000 }));
  }
  paintPerms();
}

// ── service worker + push ──────────────────────────────────────────────────
let swReg = null;
async function initSW() {
  if (!('serviceWorker' in navigator)) return;
  try { swReg = await navigator.serviceWorker.register('sw.js', { scope: './' }); syncSW(); } catch (_) {}
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'outbox-sent') { setOutbox([]); loadPulses(); } });
}
function syncSW() {
  try { navigator.serviceWorker && navigator.serviceWorker.ready.then(r => r.active && r.active.postMessage({ type: 'config', api: API, token: token(), device: deviceId(), outbox: outbox() })); } catch (_) {}
}
function requestSync() { try { syncSW(); swReg && swReg.sync && swReg.sync.register('pulse-outbox'); } catch (_) {} }
async function pushSub() { try { const r = await navigator.serviceWorker.ready; return await r.pushManager.getSubscription(); } catch (_) { return null; } }
function b64u(s) { const p = '='.repeat((4 - s.length % 4) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
async function pushOn() {
  if (!('PushManager' in window)) return { ok: false, reason: 'this browser has no push' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  try {
    const { publicKey } = await (await fetch(API + '/api/push/public-key')).json();
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(publicKey) });
    const r = await api('/api/push/subscribe', { method: 'POST', json: { subscription: sub.toJSON(), label: 'Pulse · ' + navigator.userAgent.slice(0, 80) } });
    return r.ok ? { ok: true } : { ok: false, reason: 'brain said ' + r.status };
  } catch (e) { return { ok: false, reason: e.message }; }
}
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });

// ── settings ───────────────────────────────────────────────────────────────
async function openSettings() {
  sheet('#settings', true);
  $('#ver').textContent = VERSION + ' · ' + deviceId();
  const w = $('#who'); w.textContent = 'checking sign-in…';
  try {
    const d = await getJSON('/api/auth/whoami');
    w.textContent = d.user ? ('this phone is paired as ' + (d.user.display_name || d.user.email || ('#' + d.user.id)) + (d.user.tier ? ' · ' + d.user.tier : '')) : 'not signed in';
  } catch (_) { w.textContent = 'could not reach the brain'; }
  if (w.textContent === 'not signed in') w.textContent = 'this phone is not paired';
  paintPerms();
}

// ── boot ───────────────────────────────────────────────────────────────────
let timers = [];
function boot() {
  timers.forEach(clearInterval); timers = [];
  api('/api/models/prefs').catch(() => {});  // requireAuth endpoint: a dead sign-in surfaces here → refresh → re-pair
  loadBody(); loadThought(); openStream(); loadPersonas(); paintQueue(); flushOutbox();
  timers.push(setInterval(loadBody, 30000), setInterval(loadThought, 90000));
  const h = location.hash.slice(1);
  go(['body', 'pulse', 'chat'].includes(h) ? h : (LS.get('pulse:view') || 'body'));
}
function wire() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => go(t.dataset.go));
  $('#acts').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; const on = !c.classList.contains('on'); document.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); if (on) c.classList.add('on'); act = on ? c.dataset.act : ''; };
  $('#pulseForm').onsubmit = sendPulse;
  $('#chatForm').onsubmit = e => { e.preventDefault(); sendChat($('#chatIn').value); };
  $('#chatIn').addEventListener('input', fitChat);
  $('#chatIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); sendChat($('#chatIn').value); } });
  $('#micBtn').onclick = toggleMic;
  $('#speakToggle').onclick = () => { speak = !speak; LS.set('pulse:speak', speak ? '' : 'off'); paintSpeak(); toast(speak ? 'she’ll speak replies' : 'replies stay silent'); };
  $('#openSettings').onclick = openSettings;
  $('#conn').onclick = () => { if (!token()) showPair(''); };
  $('#closeSettings').onclick = () => sheet('#settings', false);
  $('#repairBtn').onclick = () => { sheet('#settings', false); $('#pairCode').value = ''; showPair(''); };
  $('#closePair').onclick = () => { stopScan(); sheet('#pair', false); if (token()) setConn('ok', 'connected'); };
  $('#unpairBtn').onclick = () => { sheet('#settings', false); signedOut(''); };
  $('#installBtn').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $('#installBtn').hidden = true; };
  $('#pairForm').onsubmit = e => { e.preventDefault(); redeem($('#pairCode').value); };
  if ('BarcodeDetector' in window && 'ImageCapture' in window && navigator.mediaDevices) { $('#scanBtn').hidden = false; $('#scanBtn').onclick = () => scan ? stopScan() : startScan(); }
  window.addEventListener('online', () => { loadBody(); flushOutbox(); openStream(); });
  window.addEventListener('offline', () => setConn('', 'offline'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token()) { loadBody(); flushOutbox(); } });
}

wire(); paintSpeak(); initSW();
const urlCode = codeFrom(location.href);
if (urlCode) { $('#pairCode').value = urlCode; showPair(''); redeem(urlCode); }
else if (!token()) showPair('');
else boot();
})();
