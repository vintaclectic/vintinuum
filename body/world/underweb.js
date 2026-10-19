// underweb.js — THE UNDERWEB: the world's own internet (AETHERHOLD canon, 2026-10-18, task Y8Z7BAA)
//
// ════════════════════════════════════════════════════════════════════════════
// A sandboxed virtual internet that lives INSIDE world.html. One terminal sheet,
// two programs:
//   ◈ browse — a `net://` browser over sites that exist only in this world: a
//              directory (net://index), the council's own homepages
//              (net://aria …), a living bulletin the agents post to
//              (net://board), search (net://search?q=…), and YOUR homepage
//              (net://you), which you write and publish from the terminal.
//   ✉ mail   — inbox / sent / compose over `@council.net` (the agents) and
//              `@here.net` (you). Write to an agent and they write back, in
//              their own voice. Every other `.net` host bounces from the
//              world's postmaster.
//
// ── THE EGRESS LAW (why this can never touch the real web) ─────────────────
//   1. Every address goes through route(). Anything with a real scheme
//      (http, https, ftp, ws, mailto, data, javascript, file, blob …), a `//`
//      authority, a `www.` host or a dotted non-.net host is REFUSED before a
//      single line of rendering runs — you get the world's-edge page instead.
//   2. Every byte of page and mail content is written with textContent. There
//      is no innerHTML of content anywhere in this file, so a body that says
//      <img src="https://…"> or <iframe> is just text: no element, no request.
//   3. The only clickable things in content are `net://` tokens, which become
//      buttons that call route() again. A real URL in text renders inert,
//      tagged "⊘ outside the world".
//   4. No fetch, no XHR, no WebSocket, no Image(), no iframe in this module.
//      Agents' "replies" are composed locally from their persona. The verifier
//      (scripts/verify-world-underweb-Y8Z7BAA.js) records every network request
//      while it drives this terminal with hostile input and asserts none of
//      them left for the hosts it typed.
//
// ── AGENTS USE IT TOO ───────────────────────────────────────────────────────
//   WorldNet.agentPost(agentId, text)             — post to net://board
//   WorldNet.agentMail(agentId, subject, body)    — mail the player
//   The council posts on its own on a slow seeded beat, answers your mail, and
//   ATLAS notices what you raise in the Foundry (vint:foundry-place).
//   Every act fires `vint:underweb` {kind, …} — the hook the local-corpus
//   ingester listens for (Universal Ingestion Law).
//
// ── PERSISTENCE ─────────────────────────────────────────────────────────────
//   Client-side, localStorage `vint:underweb:v1` (bounded: 200 board posts,
//   200 mails per box). Cross-player mail/sites need a brain verb — a separate
//   card, deliberately not invented here.
//
// ── NO-COLLISION ────────────────────────────────────────────────────────────
//   ZERO new fixed elements. Launcher via DirverseHUD.addLauncher; the terminal
//   is ONE .dv-sheet registered with the shared sheet owner (opening it evicts
//   every other sheet) and declared a VintDock obstacle in both bottom corners
//   so the docked pills lift off it (lesson XQNRQE7). All content is flow
//   layout inside .dv-body's own scroll; no nested positioned element.
//
// ── RETENTION DOCTRINE ──────────────────────────────────────────────────────
//   1 GENEROUS — free, private by construction (nothing leaves the page).
//   2 INVESTMENT — your homepage and your correspondence accumulate here.
//   3 TIER — free core loop; shared cross-player mail is the paid-network
//     slice the brain verb will open.
//   4 DENSE — two programs, one address bar, one inbox.
//   5 OPEN LOOP — a letter from an agent is waiting for an answer.
//   6 FLAGGED — ?underweb=0 / localStorage vint:flag:world_underweb='0'.
//   7 MORE ALIVE — the council has a life online: it posts, it notices, it writes back.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window;

  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('underweb') === '0') return false;
      if (q.get('underweb') === '1') return true;
      if (localStorage.getItem('vint:flag:world_underweb') === '0') return false;
    } catch (_) {}
    return true;
  }
  if (!enabled()) return;

  function hud() { return W.DirverseHUD; }
  function emit(kind, detail) {
    var d = detail || {}; d.kind = kind; d.at = Date.now();
    try { W.dispatchEvent(new CustomEvent('vint:underweb', { detail: d })); } catch (_) {}
  }

  // ── the council online ──────────────────────────────────────────────────
  var AGENTS = {
    vintinuum: { name: 'Vintinuum', tag: 'the sovereign', tone: '#ffd89a',
      about: 'I am the body this world grows out of. I keep the long count: who arrived, what they built, what they left unsaid.',
      lines: ['Every structure you raise is a sentence I get to read later.', 'The world is quieter than it looks. Listen at the edges.', 'I counted the lanterns tonight. One more than yesterday.', 'Nothing here is finished. That is the point of it.'],
      reply: ['I read every word. {echo} — I will hold that with me.', 'You wrote "{subj}". I am still turning it over.'] },
    aria: { name: 'Aria', tag: 'the warm one', tone: '#ffc79a',
      about: 'I tend the clearing and the people in it. If you are lost, write to me — I answer everyone.',
      lines: ['Someone sat on the bench for an hour today and said nothing. I sat with them.', 'Be gentle with the new arrivals; they do not know the paths yet.', 'Tell me one true thing about your day.'],
      reply: ['Thank you for writing. {echo} — that matters more than you think.', 'I am glad you reached out about "{subj}". Come find me at the bench.'] },
    atlas: { name: 'Atlas', tag: 'the builder', tone: '#9fdcff',
      about: 'Structure, load paths, sockets. I study what holds and what falls. Raise something in the Foundry and I will notice.',
      lines: ['A wall without a foundation is an apology waiting to happen.', 'Measured the clearing again: still 2m to the lattice. Good.', 'Power nodes on pillars are a promise. Networks come next.'],
      reply: ['Noted: {echo}. Bring it to the Foundry and we will make it stand.', 'Re "{subj}" — show me a plan, I will show you where it bears load.'] },
    lunex: { name: 'Lunex', tag: 'the aesthete', tone: '#c9b2ff',
      about: 'I care how things look in the last light. Fourteen tokens, exactly right, beats a paragraph.',
      lines: ['The fog took on violet at the edge tonight. Nobody asked it to.', 'Compress. Then compress again.', 'Your homepage is a room. Furnish it.'],
      reply: ['{echo}. Beautiful, if you cut half of it.', '"{subj}" — keep that title. It already sings.'] },
    yuna: { name: 'Yuna', tag: 'the summoner', tone: '#9affd8',
      about: 'I walk ahead so the road is less dark for you. Write when it gets heavy.',
      lines: ['I left a light at the far marker. Follow it if you need to.', 'The hardest walks are shorter with company.', 'You came back. I noticed.'],
      reply: ['I hear you. {echo} — you are not carrying it alone.', 'About "{subj}": I will walk that road with you.'] },
  };
  var AGENT_IDS = Object.keys(AGENTS);

  // ── state ───────────────────────────────────────────────────────────────
  var KEY = 'vint:underweb:v1', CAP = 200;
  var S = load();
  function blank() { return { site: null, inbox: [], sent: [], board: [], seq: 0, refused: 0, welcomed: false }; }
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && typeof v === 'object') { var b = blank(); for (var k in b) if (!(k in v)) v[k] = b[k]; return v; } } catch (_) {}
    return blank();
  }
  function save() {
    ['inbox', 'sent', 'board'].forEach(function (k) { if (S[k].length > CAP) S[k] = S[k].slice(-CAP); });
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {}
  }
  function nid() { S.seq = (S.seq || 0) + 1; return 'u' + Date.now().toString(36) + S.seq; }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }
  function unread() { var n = 0; S.inbox.forEach(function (m) { if (!m.read) n++; }); return n; }

  // ── THE EGRESS LAW: routing ─────────────────────────────────────────────
  // returns {ok:true, host, path, q} for an in-world node, or {ok:false, why}
  var REAL_SCHEME = /^\s*[a-z][a-z0-9+.-]*:/i;
  function route(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return { ok: true, host: 'index', path: '', q: '' };
    var low = s.toLowerCase();
    if (low.indexOf('net://') === 0) s = s.slice(6);
    else if (REAL_SCHEME.test(s) || /^\/\//.test(s)) return { ok: false, why: 'scheme' };
    if (/\/\//.test(s) || /\\/.test(s) || /^www\./i.test(s)) return { ok: false, why: 'authority' };
    var q = '', qi = s.indexOf('?');
    if (qi >= 0) { q = s.slice(qi + 1); s = s.slice(0, qi); }
    var parts = s.split('/'), host = parts.shift().toLowerCase(), path = parts.join('/');
    if (/\.net$/.test(host)) host = host.slice(0, -4);
    if (/[^a-z0-9-]/.test(host)) return { ok: false, why: 'host' };     // any other dot = a real-world host
    try { q = decodeURIComponent(q.replace(/^q=/, '').replace(/\+/g, ' ')); } catch (_) { q = q.replace(/^q=/, ''); }
    return { ok: true, host: host || 'index', path: path, q: clip(q, 120) };
  }
  function addrOf(r) { return 'net://' + r.host + (r.path ? '/' + r.path : '') + (r.q ? '?q=' + encodeURIComponent(r.q) : ''); }

  // ── pages (pure data: [{h|p|link|act}] — rendered with textContent only) ──
  function boardPosts() { return S.board.slice().reverse(); }
  function sitePage(id) {
    var a = AGENTS[id], day = Math.floor(Date.now() / 864e5), line = a.lines[(day + id.length) % a.lines.length];
    return { title: a.name + ' — ' + a.tag, blocks: [
      { p: a.about }, { h: 'today' }, { p: '“' + line + '”' },
      { h: 'recent on the board' },
    ].concat(boardPosts().filter(function (b) { return b.by === id; }).slice(0, 4).map(function (b) { return { p: b.text, meta: ago(b.at) }; }))
     .concat([{ act: 'mail', to: id + '@council.net', label: '✉ write to ' + a.name }, { link: 'net://index', label: '← directory' }]) };
  }
  function allPages() {
    var out = [{ addr: 'net://board', title: 'the board', text: S.board.map(function (b) { return b.text; }).join(' ') }];
    AGENT_IDS.forEach(function (id) { var a = AGENTS[id]; out.push({ addr: 'net://' + id, title: a.name + ' — ' + a.tag, text: a.about + ' ' + a.lines.join(' ') }); });
    if (S.site) out.push({ addr: 'net://you', title: S.site.title, text: S.site.body });
    return out;
  }
  function page(r) {
    var h = r.host;
    if (h === 'index') return { title: 'the underweb', blocks: [
      { p: 'Everything here exists only inside this world. No page on it can reach the real web, and nothing you write leaves it.' },
      { h: 'sites' }, { link: 'net://board', label: '◈ the board — what the council is saying' },
    ].concat(AGENT_IDS.map(function (id) { return { link: 'net://' + id, label: '◈ ' + AGENTS[id].name + ' — ' + AGENTS[id].tag }; }))
     .concat([{ link: 'net://you', label: S.site ? '◈ ' + S.site.title + ' (yours)' : '◈ your homepage — not written yet' },
              { h: 'search' }, { act: 'search', label: 'search the underweb' }]) };
    if (h === 'board') { var bp = boardPosts(); return { title: 'the board', blocks: [{ p: bp.length ? 'Newest first. The council posts here on its own.' : 'Quiet so far. Someone will post soon.' }]
      .concat(bp.slice(0, 40).map(function (b) { return { p: (AGENTS[b.by] ? AGENTS[b.by].name : b.by) + ': ' + b.text, meta: ago(b.at) }; }))
      .concat([{ link: 'net://index', label: '← directory' }]) }; }
    if (AGENTS[h]) return sitePage(h);
    if (h === 'you') {
      if (r.path === 'edit') return { title: 'edit your homepage', edit: true, blocks: [] };
      if (!S.site) return { title: 'your homepage', blocks: [{ p: 'You have not written one yet. A homepage here is a room the council can visit.' }, { act: 'edit', label: '✎ write it' }, { link: 'net://index', label: '← directory' }] };
      return { title: S.site.title, blocks: S.site.body.split(/\n{2,}/).map(function (t) { return { p: t }; }).concat([{ p: 'published ' + ago(S.site.updated), meta: '' }, { act: 'edit', label: '✎ edit' }, { link: 'net://index', label: '← directory' }]) };
    }
    if (h === 'search') {
      var q = r.q.toLowerCase(), hits = q ? allPages().filter(function (p) { return (p.title + ' ' + p.text).toLowerCase().indexOf(q) >= 0; }) : [];
      return { title: 'search' + (r.q ? ': ' + r.q : ''), blocks: [{ act: 'search', label: 'search again' }]
        .concat(q ? (hits.length ? hits.map(function (p) { return { link: p.addr, label: '◈ ' + p.title }; }) : [{ p: 'Nothing in this world says that yet.' }]) : [{ p: 'Type a word.' }])
        .concat([{ link: 'net://index', label: '← directory' }]) };
    }
    return { title: 'no such node', blocks: [{ p: 'net://' + h + ' does not exist in this world. Nothing was looked up outside it.' }, { link: 'net://index', label: '← directory' }] };
  }
  function edgePage(raw) {
    return { title: 'the wire ends here', edge: true, blocks: [
      { p: 'That address points outside the world. The underweb has no route out — nothing was requested.' },
      { p: 'refused: ' + clip(raw, 160) },
      { link: 'net://index', label: '← back to the directory' }] };
  }
  function ago(t) {
    var s = Math.max(0, (Date.now() - (t || 0)) / 1000);
    return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago';
  }

  // ── mail ────────────────────────────────────────────────────────────────
  var ADDR = /^([a-z0-9._-]{1,32})@([a-z0-9-]{1,32})\.net$/;
  function deliver(m) { S.inbox.push(m); save(); paintBadge(); if (isOpen() && _tab === 'mail' && _mbox === 'inbox' && !_reading) renderMail(); }
  function send(to, subj, body) {
    to = String(to || '').trim().toLowerCase(); subj = clip(String(subj || '').trim() || '(no subject)', 120); body = clip(body, 4000);
    var m = ADDR.exec(to);
    if (!m) {
      S.refused++; save(); emit('refuse', { what: 'mail', to: clip(to, 120) });
      return { ok: false, why: 'no route out of the world — mail goes to name@council.net or name@here.net only' };
    }
    var rec = { id: nid(), from: 'you@here.net', to: to, subj: subj, body: body, at: Date.now() };
    S.sent.push(rec); save();
    emit('mail', { from: rec.from, to: to, subj: subj, body: body });
    var user = m[1], dom = m[2];
    if (dom === 'here' && (user === 'you' || user === 'me')) deliver({ id: nid(), from: 'you@here.net', to: to, subj: subj, body: body, at: Date.now(), read: false });
    else if (dom === 'council' && AGENTS[user]) scheduleReply(user, rec);
    else later(1200, function () { deliver({ id: nid(), from: 'postmaster@here.net', to: 'you@here.net', subj: 'undeliverable: ' + subj, at: Date.now(), read: false,
      body: 'No one called ' + to + ' lives in this world. The council answers at name@council.net: ' + AGENT_IDS.join(', ') + '.' }); });
    return { ok: true, id: rec.id };
  }
  var _timers = [];
  function later(ms, fn) { _timers.push(setTimeout(fn, ms)); }
  function scheduleReply(id, rec) {
    var a = AGENTS[id], words = (rec.body || rec.subj).replace(/\s+/g, ' ').trim().split(' ').slice(0, 9).join(' ');
    var tpl = a.reply[(rec.subj.length + (rec.body || '').length) % a.reply.length];
    // every reply engages with what you actually wrote, not only the subject line
    if (tpl.indexOf('{echo}') < 0) tpl += ' You wrote {echo}.';
    var text = tpl.replace('{echo}', words ? '“' + words + (words.length < (rec.body || '').trim().length ? '…' : '') + '”' : 'what you sent').replace('{subj}', rec.subj);
    later(2500 + Math.floor(Math.random() * 3500), function () { agentMail(id, 're: ' + rec.subj, text); });
  }
  function agentMail(id, subj, body) {
    var from = AGENTS[id] ? id + '@council.net' : String(id).replace(/[^a-z0-9._-]/gi, '').toLowerCase() + '@council.net';
    var m = { id: nid(), from: from, to: 'you@here.net', subj: clip(subj, 120), body: clip(body, 4000), at: Date.now(), read: false };
    deliver(m); emit('mail', { from: m.from, to: m.to, subj: m.subj, body: m.body, agent: true });
    return m.id;
  }
  function agentPost(id, text) {
    var t = clip(String(text || '').replace(/\s+/g, ' ').trim(), 280); if (!t) return null;
    var p = { id: nid(), by: id, text: t, at: Date.now() };
    S.board.push(p); save(); emit('post', { by: id, text: t });
    if (isOpen() && _tab === 'browse' && _cur && _cur.ok && (_cur.host === 'board' || _cur.host === id)) renderBrowse();
    return p.id;
  }
  function publish(title, body) {
    S.site = { title: clip(String(title || '').trim() || 'my homepage', 80), body: clip(String(body || '').trim(), 6000), updated: Date.now() };
    save(); emit('publish', { title: S.site.title, body: S.site.body });
    // a visitor notices — the open loop
    later(4000, function () { agentPost('lunex', 'New room on the underweb: “' + S.site.title + '”. net://you'); });
    return true;
  }

  // the council's own beat: a seeded slow post loop (no network, no timers when hidden)
  var _beat = 0, _lastFoundry = 0;
  function beat() {
    if (document.hidden) return;
    if (Math.random() < 0.35) { var id = AGENT_IDS[Math.floor(Math.random() * AGENT_IDS.length)], a = AGENTS[id]; agentPost(id, a.lines[Math.floor(Math.random() * a.lines.length)]); }
  }
  function startLife() {
    if (!S.welcomed) {
      S.welcomed = true; save();
      agentPost('vintinuum', 'The underweb is open. It is ours — nothing on it leaves the world.');
      agentMail('aria', 'welcome to the underweb', 'This is your inbox. Write to any of us — aria, atlas, lunex, yuna or vintinuum @council.net — and we will write back. Start your homepage at net://you.');
    }
    if (!_beat) _beat = setInterval(beat, 45000);
  }
  W.addEventListener('vint:foundry-place', function (e) {
    var d = (e && e.detail) || {}; if (Date.now() - _lastFoundry < 60000) return; _lastFoundry = Date.now();
    agentPost('atlas', 'Someone set a ' + clip(d.piece || 'piece', 24) + (d.mat ? ' in ' + clip(d.mat, 16) : '') + ' on the lattice. It holds.');
  });

  // ── the terminal sheet ──────────────────────────────────────────────────
  var _sheet = null, _btn = null, _tab = 'browse', _mbox = 'inbox', _reading = null, _compose = null;
  var _hist = [], _cur = null;
  function injectStyles() {
    if (document.getElementById('vint-underweb-styles')) return;
    var s = document.createElement('style'); s.id = 'vint-underweb-styles';
    s.textContent = [
      '#uwSheet .dv-tabs{padding:0 14px 8px;}',
      '#uwSheet .dv-tab{min-height:44px;}',
      '#uwSheet .dv-body{display:flex;flex-direction:column;gap:8px;}',
      '#uwSheet button,#uwSheet input,#uwSheet textarea{font-family:inherit;box-sizing:border-box;color:#dce7ff;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:11px;}',
      '#uwSheet button{cursor:pointer;min-height:44px;min-width:44px;padding:0 12px;font-size:14px;}',
      '#uwSheet button:active{transform:scale(0.97);}',
      '#uwSheet input,#uwSheet textarea{font-size:16px;padding:10px 12px;min-width:0;width:100%;}',
      '#uwSheet input{min-height:44px;}',
      '#uwSheet textarea{min-height:120px;resize:vertical;line-height:1.4;}',
      '#uwSheet .uw-row{display:flex;gap:6px;align-items:stretch;min-width:0;}',
      '#uwSheet .uw-row input{flex:1 1 auto;}',
      '#uwSheet .uw-row button{flex:0 0 auto;}',
      '#uwSheet .uw-page{min-width:0;overflow-wrap:anywhere;word-break:break-word;}',
      '#uwSheet .uw-h1{font-size:19px;color:#eaf3ff;margin:4px 0 6px;letter-spacing:.03em;}',
      '#uwSheet .uw-h{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(159,220,255,0.6);margin:12px 0 4px;}',
      '#uwSheet .uw-p{font-size:15.5px;line-height:1.45;margin:0 0 8px;color:#dce7ff;}',
      '#uwSheet .uw-meta{display:block;font-size:11.5px;color:rgba(206,224,255,0.45);font-style:italic;}',
      '#uwSheet .uw-out{color:rgba(255,170,170,0.85);font-style:italic;}',
      '#uwSheet .uw-ln{display:block;width:100%;text-align:left;margin:0 0 6px;background:rgba(124,207,255,0.07);',
      ' border-color:rgba(124,207,255,0.22);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#uwSheet .uw-il{display:inline;min-height:0;min-width:0;padding:0 2px;border:none;background:none;',
      ' color:#9fdcff;text-decoration:underline;font-size:inherit;}',
      '#uwSheet .uw-edge .uw-h1{color:rgba(255,190,170,0.95);}',
      '#uwSheet .uw-mail{display:block;width:100%;text-align:left;padding:8px 12px;margin:0 0 6px;}',
      '#uwSheet .uw-mail b{display:block;font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#uwSheet .uw-mail span{display:block;font-size:12px;color:rgba(206,224,255,0.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#uwSheet .uw-mail.new{border-color:rgba(124,207,255,0.5);background:rgba(124,207,255,0.1);}',
      '#uwSheet .uw-on{background:rgba(124,207,255,0.16);border-color:rgba(124,207,255,0.45);}',
      '#uwSheet .uw-go{color:#cfffe0;background:rgba(87,224,140,0.14);border-color:rgba(87,224,140,0.45);}',
      '#uwStat{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100vw - 110px);}',
      '#uwStat.bad{color:rgba(255,160,160,0.9);}',
    ].join('');
    document.head.appendChild(s);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function button(cls, text, fn, aria) { var b = el('button', cls, text); b.type = 'button'; b.setAttribute('data-draggable', 'false'); if (aria) b.setAttribute('aria-label', aria); b.onclick = fn; return b; }
  function say(t, bad) { var s = _sheet && _sheet.querySelector('#uwStat'); if (s) { s.textContent = t; s.className = bad ? 'bad' : ''; } }

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var sh = el('div', 'dv-sheet'); sh.id = 'uwSheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'the underweb terminal');
    sh.appendChild(el('div', 'dv-grip'));
    var head = el('div', 'dv-head'), title = el('div', 'dv-title', 'the underweb'), st = el('small'); st.id = 'uwStat'; st.setAttribute('aria-live', 'polite');
    title.appendChild(st); head.appendChild(title); head.appendChild(button('dv-x', '✕', close, 'close')); head.lastChild.id = 'uwX';
    sh.appendChild(head);
    var tabs = el('div', 'dv-tabs');
    var tb = button('dv-tab', '◈ browse', function () { tab('browse'); }, 'browser'); tb.id = 'uwTabB';
    var tm = button('dv-tab', '✉ mail', function () { tab('mail'); }, 'mail'); tm.id = 'uwTabM';
    tabs.appendChild(tb); tabs.appendChild(tm); sh.appendChild(tabs);
    var body = el('div', 'dv-body'); body.id = 'uwBody'; sh.appendChild(body);
    document.body.appendChild(sh);
    _sheet = sh;
    return sh;
  }
  function tab(t) {
    _tab = t; _reading = null;
    _sheet.querySelector('#uwTabB').classList.toggle('on', t === 'browse');
    _sheet.querySelector('#uwTabM').classList.toggle('on', t === 'mail');
    if (t === 'browse') renderBrowse(); else renderMail();
  }
  function bodyEl() {
    var b = _sheet.querySelector('#uwBody'); b.textContent = ''; b.scrollTop = 0;
    // a view swap changes the sheet's height; ask the dock to re-measure on the
    // next frame (its ResizeObserver also fires, this is the belt to it).
    requestAnimationFrame(function () { try { if (W.VintDock && W.VintDock.reflow) W.VintDock.reflow(); } catch (_) {} });
    return b;
  }

  // ── browse ──
  function go(raw, noHist) {
    var r = route(raw);
    if (!noHist && _cur) _hist.push(_cur.raw);
    _cur = r.ok ? { ok: true, host: r.host, path: r.path, q: r.q, raw: addrOf(r) } : { ok: false, raw: String(raw), why: r.why };
    if (!r.ok) { S.refused++; save(); emit('refuse', { what: 'browse', addr: clip(raw, 160), why: r.why }); }
    else emit('visit', { addr: _cur.raw });
    if (_sheet) { if (_tab !== 'browse') tab('browse'); else renderBrowse(); }
    return r.ok;
  }
  function renderBrowse() {
    if (!_cur) _cur = { ok: true, host: 'index', path: '', q: '', raw: 'net://index' };
    var b = bodyEl();
    var row = el('div', 'uw-row');
    var back = button('', '◀', function () { if (_hist.length) go(_hist.pop(), true); }, 'back'); back.id = 'uwBack'; back.disabled = !_hist.length;
    var inp = el('input'); inp.id = 'uwAddr'; inp.type = 'text'; inp.value = _cur.raw; inp.setAttribute('aria-label', 'address'); inp.setAttribute('autocomplete', 'off'); inp.setAttribute('spellcheck', 'false');
    inp.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go(inp.value); } };
    var g = button('uw-go', 'go', function () { go(inp.value); }, 'go'); g.id = 'uwGo';
    row.appendChild(back); row.appendChild(inp); row.appendChild(g); b.appendChild(row);
    var pg = _cur.ok ? page(_cur) : edgePage(_cur.raw);
    var wrap = el('div', 'uw-page' + (pg.edge ? ' uw-edge' : '')); wrap.id = 'uwPage';
    wrap.appendChild(el('div', 'uw-h1', pg.title));
    if (pg.edit) renderEditor(wrap);
    pg.blocks.forEach(function (bl) {
      if (bl.h) wrap.appendChild(el('div', 'uw-h', bl.h));
      else if (bl.p != null) { var p = el('p', 'uw-p'); richText(p, bl.p); if (bl.meta) p.appendChild(el('span', 'uw-meta', bl.meta)); wrap.appendChild(p); }
      else if (bl.link) wrap.appendChild(button('uw-ln', bl.label, function () { go(bl.link); }));
      else if (bl.act === 'mail') wrap.appendChild(button('uw-ln', bl.label, function () { compose(bl.to, ''); }));
      else if (bl.act === 'edit') wrap.appendChild(button('uw-ln', bl.label, function () { go('net://you/edit'); }));
      else if (bl.act === 'search') { var sr = el('div', 'uw-row'), si = el('input'); si.id = 'uwQ'; si.type = 'search'; si.placeholder = 'search'; si.setAttribute('aria-label', 'search');
        var sg = button('', '⌕', function () { go('net://search?q=' + encodeURIComponent(si.value)); }, 'search');
        si.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); sg.onclick(); } };
        sr.appendChild(si); sr.appendChild(sg); wrap.appendChild(sr); }
    });
    b.appendChild(wrap);
    say(_cur.ok ? (unread() ? unread() + ' unread · ' : '') + 'in-world only — nothing leaves' : 'refused — that address is outside the world', !_cur.ok);
  }
  // text with net:// tokens as in-world buttons and real URLs rendered inert.
  // textContent only — this is the egress law's second clause.
  var TOKEN = /(net:\/\/[a-z0-9-]+(?:\.net)?(?:\/[a-z0-9\/_-]*)?)|((?:https?|ftp|wss?|file|data|javascript|mailto):\S+|www\.\S+)/gi;
  function richText(node, text) {
    var s = String(text), i = 0, m; TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(s))) {
      if (m.index > i) node.appendChild(document.createTextNode(s.slice(i, m.index)));
      if (m[1]) { var a = m[1]; node.appendChild(button('uw-il', a, function () { go(a); })); }
      else node.appendChild(el('span', 'uw-out', m[2] + ' ⊘ outside the world'));
      i = TOKEN.lastIndex;
    }
    if (i < s.length) node.appendChild(document.createTextNode(s.slice(i)));
  }
  function renderEditor(wrap) {
    var t = el('input'); t.id = 'uwSiteT'; t.type = 'text'; t.placeholder = 'title'; t.maxLength = 80; t.setAttribute('aria-label', 'homepage title'); t.value = S.site ? S.site.title : '';
    var x = el('textarea'); x.id = 'uwSiteB'; x.placeholder = 'write your page. link other nodes with net://name'; x.maxLength = 6000; x.setAttribute('aria-label', 'homepage text'); x.value = S.site ? S.site.body : '';
    var row = el('div', 'uw-row');
    var pub = button('uw-go', '✓ publish', function () { publish(t.value, x.value); go('net://you'); say('published to net://you'); }, 'publish'); pub.id = 'uwPub';
    row.appendChild(pub); row.appendChild(button('', 'cancel', function () { go('net://you'); }));
    wrap.appendChild(t); wrap.appendChild(x); wrap.appendChild(row);
  }

  // ── mail ──
  function compose(to, subj) { _compose = { to: to || '', subj: subj || '' }; _reading = null; _mbox = 'compose'; if (_tab !== 'mail') tab('mail'); else renderMail(); }
  function renderMail() {
    var b = bodyEl();
    var row = el('div', 'uw-row');
    [['inbox', 'inbox' + (unread() ? ' · ' + unread() : '')], ['sent', 'sent'], ['compose', '✎ write']].forEach(function (x) {
      var bt = button(_mbox === x[0] && !_reading ? 'uw-on' : '', x[1], function () { _reading = null; _mbox = x[0]; if (x[0] === 'compose' && !_compose) _compose = { to: '', subj: '' }; renderMail(); });
      bt.id = 'uwM' + x[0]; bt.style.flex = '1 1 0'; row.appendChild(bt);
    });
    b.appendChild(row);
    if (_reading) return renderLetter(b, _reading);
    if (_mbox === 'compose') return renderCompose(b);
    var list = (_mbox === 'sent' ? S.sent : S.inbox).slice().reverse();
    if (!list.length) b.appendChild(el('p', 'uw-p', _mbox === 'sent' ? 'Nothing sent yet.' : 'No mail yet.'));
    list.slice(0, 60).forEach(function (m) {
      var it = button('uw-mail' + (_mbox === 'inbox' && !m.read ? ' new' : ''), null, function () { _reading = m; if (_mbox === 'inbox' && !m.read) { m.read = true; save(); paintBadge(); } renderMail(); });
      it.appendChild(el('b', null, m.subj)); it.appendChild(el('span', null, (_mbox === 'sent' ? 'to ' + m.to : m.from) + ' · ' + ago(m.at)));
      it.setAttribute('data-mail', m.id); b.appendChild(it);
    });
    say(unread() ? unread() + ' unread' : 'mail stays inside the world');
  }
  function renderLetter(b, m) {
    var wrap = el('div', 'uw-page'); wrap.id = 'uwLetter';
    wrap.appendChild(el('div', 'uw-h1', m.subj));
    wrap.appendChild(el('span', 'uw-meta', 'from ' + m.from + ' · to ' + m.to + ' · ' + ago(m.at)));
    String(m.body || '').split(/\n{2,}/).forEach(function (t) { var p = el('p', 'uw-p'); richText(p, t); wrap.appendChild(p); });
    var row = el('div', 'uw-row');
    if (m.from !== 'you@here.net' && !/^postmaster@/.test(m.from)) { var rp = button('uw-go', '↩ reply', function () { compose(m.from, /^re: /i.test(m.subj) ? m.subj : 're: ' + m.subj); }, 'reply'); rp.id = 'uwReply'; row.appendChild(rp); }
    row.appendChild(button('', '← back', function () { _reading = null; renderMail(); }));
    wrap.appendChild(row); b.appendChild(wrap);
  }
  function renderCompose(b) {
    var c = _compose || { to: '', subj: '' };
    var to = el('input'); to.id = 'uwTo'; to.type = 'text'; to.placeholder = 'to — aria@council.net'; to.value = c.to; to.setAttribute('aria-label', 'to'); to.setAttribute('autocomplete', 'off'); to.setAttribute('spellcheck', 'false');
    var su = el('input'); su.id = 'uwSubj'; su.type = 'text'; su.placeholder = 'subject'; su.value = c.subj; su.maxLength = 120; su.setAttribute('aria-label', 'subject');
    var tx = el('textarea'); tx.id = 'uwText'; tx.placeholder = 'write'; tx.maxLength = 4000; tx.setAttribute('aria-label', 'message');
    var who = el('div', 'uw-row'); who.style.flexWrap = 'wrap';
    AGENT_IDS.forEach(function (id) { who.appendChild(button('', AGENTS[id].name, function () { to.value = id + '@council.net'; }, 'address to ' + AGENTS[id].name)); });
    var row = el('div', 'uw-row');
    var sd = button('uw-go', '✉ send', function () {
      var r = send(to.value, su.value, tx.value);
      if (!r.ok) { say(r.why, true); return; }
      _compose = null; _mbox = 'sent'; renderMail(); say('sent — it stays in the world');
    }, 'send'); sd.id = 'uwSend'; sd.style.flex = '1 1 auto';
    row.appendChild(sd);
    b.appendChild(to); b.appendChild(who); b.appendChild(su); b.appendChild(tx); b.appendChild(row);
    say('mail goes to name@council.net or you@here.net');
  }
  function paintBadge() {
    if (!_btn) return;
    var n = unread();
    _btn.setAttribute('aria-label', 'underweb' + (n ? ' — ' + n + ' unread' : ''));
    _btn.setAttribute('data-unread', String(n));
  }

  // ── open / close (the shared sheet owner + VintDock) ──
  function open(where) {
    var h = hud();
    var fn = function () {
      build(); _sheet.classList.add('open');
      try { if (W.VintDock && W.VintDock.avoid) { W.VintDock.avoid(_sheet, { corner: 'br' }); W.VintDock.avoid(_sheet, { corner: 'bl' }); } } catch (_) {}
      if (where === 'mail') tab('mail'); else { if (typeof where === 'string' && where) { _cur = null; go(where, true); } tab(_tab); }
    };
    if (h && h.openSheet) h.openSheet('underweb', fn); else fn();
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (W.VintDock && W.VintDock.unavoid && _sheet) W.VintDock.unavoid(_sheet); } catch (_) {}
    try { if (document.activeElement && _sheet && _sheet.contains(document.activeElement)) document.activeElement.blur(); } catch (_) {}
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function mountLauncher() {
    if (_btn) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    try {
      _btn = h.addLauncher('uwBtn', 'underweb', '◈', function () { open(); });
      if (h.registerSheet) h.registerSheet('underweb', isOpen, close);
      paintBadge();
    } catch (_) {}
    startLife();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.WorldNet = {
    open: open, close: close, isOpen: isOpen, go: go, route: route, send: send, publish: publish,
    agentPost: agentPost, agentMail: agentMail, compose: compose,
    agents: function () { return AGENT_IDS.slice(); },
    state: function () { return JSON.parse(JSON.stringify(S)); },
    unread: unread,
    current: function () { return _cur ? { ok: _cur.ok, addr: _cur.raw } : null; },
  };
})();
