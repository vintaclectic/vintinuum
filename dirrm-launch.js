/* ════════════════════════════════════════════════════════════════════════════
   DIRRM-LAUNCH — Universal DirRM Player invocation library

   Lord Vinta directive (2026-06-05): "i want the exact version and visualizers
   used in all three sizes of dirrm player used throughout entire brain and
   extension everywhere in mobile app pulse etc anything that can or will or
   does play media goes through dirrm i want it to become the go to most
   optimized successfull profitabl addicting eye catchy media player of all
   time and it will as it stands currently in dirhaven app so i want it
   exactly asw it currently is most updated in dirhaven app all across and
   everywhere media is played in vintinuum across all its mediums extensions
   and all"

   Canonical player:
       /home/vinta/vintinuum/dirrm-player.html        (source of truth)
       https://vintaclectic.github.io/vintinuum/dirrm-player.html  (live)

   This library is the SINGLE FUNCTION every surface in Vintinuum should
   call to play any media. It abstracts:
     • popup window (extension contexts where we can't iframe)
     • in-page iframe + postMessage (brain.html, jarvis.html, mobile, etc.)
     • new browser tab (full-tab playback)
     • mode selection (main / mini / pip / theater)
     • autoplay flag
     • event listening (modeChanged, playerClosed, mediaEnded)

   Supported media types (auto-detected by the canonical player):
     • video    — mp4, webm, mkv, mov, avi, m4v, mpg, mpeg, ts, vob, 3gp, flv, wmv
     • audio    — mp3, wav, flac, m4a, ogg, opus, aac, aiff, wma, alac
     • image    — jpg, jpeg, png, gif, webp, bmp, tiff, svg, heic
     • pdf      — pdf
     • ebook    — epub, mobi, azw, azw3, djvu
     • stream   — m3u8 (HLS), mpd (DASH), .ism
     • 3d-model — glb, gltf, fbx, obj, stl
     • document — doc, docx, xls, xlsx, ppt, pptx, txt, md, rtf
     • iframe   — youtube, vimeo, soundcloud, spotify, twitch, anything with an embed URL
     • text     — plain text rendering with monospace + syntax detection
   Any URL DirHaven's open-directory crawler can encounter, the player plays.

   Usage:

     // 1) Simplest: pop the player in a new window (extension popup, link click)
     await dirrmLaunch.open({ url: 'http://example.com/file.mp4' });

     // 2) Embed inside the current page (brain, jarvis, future surfaces)
     const handle = await dirrmLaunch.open({
       url: 'http://example.com/file.mp3',
       title: 'My Track',
       embedIn: document.getElementById('player-slot'),
       mode: 'mini',
     });
     // ...later:
     handle.setMode('theater');
     handle.load({ url: nextUrl, title: nextTitle });
     handle.close();
     handle.on('modeChanged', m => console.log('mode is now', m));
     handle.on('playerClosed', () => console.log('user closed it'));

     // 3) Force a new tab
     await dirrmLaunch.open({ url, embedIn: 'newtab' });

   The library auto-detects its runtime:
     • Browser page with DOM → can iframe or window.open
     • Extension service worker → must use chrome.windows.create (no DOM)
     • Extension content script → can iframe into page
     • Mobile webview → iframe overlay
   ════════════════════════════════════════════════════════════════════════════ */

(function (root, factory) {
  // UMD: works as <script>, CommonJS, ES module, and Chrome extension contexts
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.dirrmLaunch = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────────────────
  const CANONICAL_URL = 'https://vintaclectic.github.io/vintinuum/dirrm-player.html';
  const RELATIVE_URL  = 'dirrm-player.html';   // when invoked from a vintinuum page
  const VALID_MODES   = ['main', 'mini', 'pip', 'theater'];

  // ── DETECT RUNTIME ────────────────────────────────────────────────────────
  function isExtensionContext() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }
  function isServiceWorker() {
    return typeof self !== 'undefined' && typeof importScripts === 'function'
        && typeof window === 'undefined';
  }
  function hasDOM() {
    return typeof document !== 'undefined' && document.body !== undefined;
  }
  function isSameOriginVintinuum() {
    if (!hasDOM()) return false;
    try {
      return location.host.includes('vintaclectic') || location.host.includes('localhost');
    } catch { return false; }
  }

  // ── URL BUILDER ───────────────────────────────────────────────────────────
  function buildPlayerUrl({ url, title, type, mode, autoplay } = {}) {
    // Prefer same-origin (relative) when we're already on a vintinuum page,
    // otherwise use the canonical GitHub Pages URL.
    const base = isSameOriginVintinuum() ? RELATIVE_URL : CANONICAL_URL;
    const qs = new URLSearchParams();
    if (url) qs.set('url', url);
    if (title) qs.set('title', title);
    if (type) qs.set('type', type);
    if (mode && VALID_MODES.includes(mode)) qs.set('mode', mode);
    if (autoplay) qs.set('autoplay', '1');
    return base + (qs.toString() ? '?' + qs.toString() : '');
  }

  // ── DETECT MEDIA TYPE FROM URL (mirrors player's own detection) ──────────
  // Used by callers that want to log the type, or pass it explicitly. The
  // player auto-detects too — this is just a hint.
  const EXT_TO_TYPE = {
    mp4:'video', webm:'video', mkv:'video', mov:'video', avi:'video',
    m4v:'video', mpg:'video', mpeg:'video', ts:'video', vob:'video',
    '3gp':'video', flv:'video', wmv:'video', ogv:'video',
    mp3:'audio', wav:'audio', flac:'audio', m4a:'audio', ogg:'audio',
    opus:'audio', aac:'audio', aiff:'audio', wma:'audio', alac:'audio', mid:'audio', midi:'audio',
    jpg:'image', jpeg:'image', png:'image', gif:'image', webp:'image',
    bmp:'image', tiff:'image', tif:'image', svg:'image', heic:'image',
    pdf:'pdf',
    epub:'ebook', mobi:'ebook', azw:'ebook', azw3:'ebook', djvu:'ebook',
    m3u8:'stream', mpd:'stream', ism:'stream',
    glb:'model', gltf:'model', fbx:'model', obj:'model', stl:'model',
    doc:'docs', docx:'docs', xls:'docs', xlsx:'docs', ppt:'docs', pptx:'docs',
    txt:'docs', md:'docs', rtf:'docs', csv:'docs',
    zip:'archive', rar:'archive', '7z':'archive', tar:'archive', gz:'archive', iso:'archive',
  };
  function detectType(url) {
    if (!url) return 'video';
    if (url.startsWith('data:')) {
      const m = url.match(/^data:([a-z]+)\//i);
      if (m) {
        const t = m[1].toLowerCase();
        if (t === 'image') return 'image';
        if (t === 'audio') return 'audio';
        if (t === 'video') return 'video';
      }
      return 'video';
    }
    if (url.startsWith('blob:')) return 'video';
    if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|soundcloud\.com|spotify\.com|bandcamp\.com|tiktok\.com|rumble\.com|kick\.com|twitch\.tv/i.test(url)) {
      return /soundcloud|spotify|bandcamp/i.test(url) ? 'audio' : /kick|twitch/i.test(url) ? 'stream' : 'video';
    }
    try {
      const path = new URL(url).pathname;
      const ext = (path.split('.').pop() || '').toLowerCase().split('?')[0].split('#')[0];
      if (EXT_TO_TYPE[ext]) return EXT_TO_TYPE[ext];
    } catch {}
    return 'video';
  }

  // ── HANDLE — what the caller gets back ────────────────────────────────────
  // Wraps either an iframe or a popup window with a uniform API.
  function createHandle({ surface, iframe, popupWin, popupId, target }) {
    const listeners = new Map(); // event → [callback]
    let closed = false;

    function emit(event, payload) {
      const list = listeners.get(event) || [];
      for (const cb of list) {
        try { cb(payload); } catch (e) { console.warn('[dirrm-launch] listener error:', e); }
      }
    }

    function postToPlayer(msg) {
      if (closed) return false;
      if (surface === 'iframe' && iframe && iframe.contentWindow) {
        try { iframe.contentWindow.postMessage(msg, '*'); return true; }
        catch (e) { console.warn('[dirrm-launch] iframe postMessage failed:', e); return false; }
      }
      if (surface === 'popup' && popupWin && !popupWin.closed) {
        try { popupWin.postMessage(msg, '*'); return true; }
        catch (e) { console.warn('[dirrm-launch] popup postMessage failed:', e); return false; }
      }
      return false;
    }

    function setupMessageBridge() {
      if (!hasDOM() || closed) return;
      const onMsg = (event) => {
        // Filter: only accept messages that look like they came from a dirrm player.
        const data = event.data || {};
        if (!data || typeof data !== 'object' || !data.action) return;
        // Inbound events from player: modeChanged, playerClosed, mediaEnded, ready
        if (data.action === 'modeChanged') emit('modeChanged', data.mode);
        else if (data.action === 'playerClosed') { emit('playerClosed'); closed = true; }
        else if (data.action === 'mediaEnded') emit('mediaEnded', data);
        else if (data.action === 'ready') emit('ready', data);
        else if (data.action === 'playStarted') emit('playStarted', data);
        else if (data.action === 'progress') emit('progress', data);
      };
      window.addEventListener('message', onMsg);
      listeners.set('__cleanup', [() => window.removeEventListener('message', onMsg)]);
    }
    setupMessageBridge();

    return {
      surface, iframe, popupWin, target,
      load(opts) { return postToPlayer({ action: 'load', ...opts }); },
      setMode(mode) {
        if (!VALID_MODES.includes(mode)) {
          console.warn('[dirrm-launch] invalid mode:', mode);
          return false;
        }
        return postToPlayer({ action: 'setMode', mode });
      },
      play()  { return postToPlayer({ action: 'play' }); },
      pause() { return postToPlayer({ action: 'pause' }); },
      stop()  { return postToPlayer({ action: 'stop' }); },
      /**
       * Attach or replace the local self-view PIP in a live session.
       * For non-live sessions this is a no-op — the handle signature is uniform.
       * Uses the same registry+postMessage path as the initial stream handoff.
       */
      setLocalStream(ls) {
        if (!ls || typeof window === 'undefined') return;
        if (!window.__DIRRM_LIVE_STREAMS) window.__DIRRM_LIVE_STREAMS = {};
        const lk = 'ls_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        window.__DIRRM_LIVE_STREAMS[lk] = ls;
        return postToPlayer({ action: 'setLocalStream', localStreamKey: lk });
      },
      close() {
        closed = true;
        if (surface === 'iframe' && iframe && iframe.parentNode) {
          try { iframe.parentNode.removeChild(iframe); } catch {}
        }
        if (surface === 'popup' && popupWin && !popupWin.closed) {
          try { popupWin.close(); } catch {}
        }
        (listeners.get('__cleanup') || []).forEach(fn => fn());
        emit('playerClosed');
      },
      on(event, callback) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(callback);
        return () => {
          const arr = listeners.get(event) || [];
          const idx = arr.indexOf(callback);
          if (idx >= 0) arr.splice(idx, 1);
        };
      },
      isClosed: () => closed,
    };
  }

  // ── LIVE STREAM REGISTRY (same-page MediaStream handoff) ─────────────────
  // MediaStream objects cannot be serialised through JSON (postMessage), so we
  // keep a window-scoped registry keyed by a random ID. dirrm-launch writes the
  // stream here, sends the key over postMessage, and the embedded player iframe
  // reads it synchronously — both windows are the SAME document origin, so the
  // shared window object is accessible without any cross-origin restriction.
  //
  // Entries are deleted by the player immediately after consumption so the ref
  // doesn't leak (the underlying MediaStream is still referenced by the player's
  // video.srcObject). The registry is initialised lazily here.
  function _liveStreamKey(stream) {
    if (!hasDOM()) return null;
    if (!window.__DIRRM_LIVE_STREAMS) window.__DIRRM_LIVE_STREAMS = {};
    const key = 'ls_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    window.__DIRRM_LIVE_STREAMS[key] = stream;
    return key;
  }

  // ── OPEN — the one function callers use ───────────────────────────────────
  async function open(opts = {}) {
    const {
      url,
      title = '',
      type = null,           // auto-detect if null
      mode = 'main',
      autoplay = true,
      embedIn = null,        // DOM element | 'newtab' | 'popup' | null (default: popup if no DOM, iframe in body if DOM)
      popupWidth = 900,
      popupHeight = 560,
      // Live WebRTC options — only used when type:'live'
      stream = null,         // RTCPeerConnection remote MediaStream
      localStream = null,    // local getUserMedia stream for self-view PIP (optional)
    } = opts;

    const finalType = type || detectType(url);
    const playerUrl = buildPlayerUrl({ url, title, type: finalType, mode, autoplay });

    // ── Decision tree for HOW to surface the player ────────────────────────
    // LIVE streams with a MediaStream object MUST use a same-page embed — postMessage
    // cannot transfer a MediaStream across a cross-origin (or even same-origin) iframe
    // boundary. The stream is passed via the window.__DIRRM_LIVE_STREAMS registry in
    // the same document so the player iframe can read it as a live JS object reference.
    const isLiveStream = finalType === 'live' && stream instanceof (
      (typeof MediaStream !== 'undefined') ? MediaStream : Object
    );

    let surface;
    if (isLiveStream && hasDOM()) {
      // Force same-page iframe — this is the only path that can hand over a MediaStream.
      surface = 'iframe-live';
    } else if (embedIn === 'newtab') {
      surface = 'newtab';
    } else if (embedIn === 'popup') {
      surface = 'popup';
    } else if (embedIn && typeof embedIn === 'object' && embedIn.appendChild) {
      surface = 'iframe';
    } else if (isExtensionContext() && (isServiceWorker() || !hasDOM())) {
      // Extension service worker / background — only popup is possible
      surface = 'popup';
    } else if (hasDOM()) {
      // Default in-page: floating iframe at standard position
      surface = 'iframe';
    } else {
      surface = 'popup';
    }

    // ── Execute the surface choice ─────────────────────────────────────────
    if (surface === 'iframe-live') {
      // Same-page live embed.
      // 1. Embed the player as an iframe (same origin as the caller — GitHub Pages or localhost).
      // 2. Register the MediaStream in window.__DIRRM_LIVE_STREAMS so the iframe can
      //    pick it up via the shared window object.
      // 3. Send a 'loadLive' postMessage with the registry key — not the stream itself.
      // 4. The player reads the stream by key and deletes the registry entry immediately.
      const streamKey    = _liveStreamKey(stream);
      const localKey     = localStream ? _liveStreamKey(localStream) : null;

      const parent = (embedIn && typeof embedIn === 'object' && embedIn.appendChild)
        ? embedIn
        : document.body;

      // Use theater mode for live video by default, or the caller's specified mode
      const liveMode = VALID_MODES.includes(mode) ? mode : 'theater';
      const livePlayerUrl = buildPlayerUrl({ url: '', title, type: 'live', mode: liveMode, autoplay: true });

      const iframe = document.createElement('iframe');
      iframe.id = 'dirrm-launch-live-' + Math.random().toString(36).slice(2, 8);
      iframe.src = livePlayerUrl;
      iframe.allow = 'autoplay; fullscreen; camera; microphone; picture-in-picture';
      iframe.style.cssText = (embedIn && typeof embedIn === 'object' && embedIn.appendChild)
        ? 'width:100%;height:100%;border:none;background:#000;'
        : 'position:fixed;inset:0;width:100vw;height:100svh;border:none;z-index:9999;background:#000;';
      parent.appendChild(iframe);

      const handle = createHandle({ surface: 'iframe', iframe, popupWin: null, target: iframe });

      // Wait for the player to signal it's ready, then send the live stream keys.
      // We do NOT wait indefinitely — 10s timeout, then fire anyway.
      let sent = false;
      const sendLoadLive = () => {
        if (sent) return;
        sent = true;
        try {
          iframe.contentWindow.postMessage({
            action: 'loadLive',
            streamKey,
            localStreamKey: localKey || undefined,
            url: '',
            title: title || 'Live',
          }, '*');
        } catch (e) {
          console.warn('[dirrm-launch] loadLive postMessage failed', e);
        }
      };

      // Listen for 'ready' from the iframe, send immediately on receipt.
      const readyListener = (ev) => {
        if (ev.source !== iframe.contentWindow) return;
        const data = ev.data || {};
        if (data.action === 'ready') {
          window.removeEventListener('message', readyListener);
          sendLoadLive();
        }
      };
      window.addEventListener('message', readyListener);
      // Fallback: if 'ready' doesn't arrive in 2s, send anyway (page might be cached)
      setTimeout(() => {
        window.removeEventListener('message', readyListener);
        sendLoadLive();
      }, 2000);

      // Augment handle with setLocalStream for live sessions
      handle.setLocalStream = (ls) => {
        const lk = _liveStreamKey(ls);
        try {
          iframe.contentWindow.postMessage({ action: 'setLocalStream', localStreamKey: lk }, '*');
        } catch (e) { console.warn('[dirrm-launch] setLocalStream postMessage failed', e); }
      };

      return handle;
    }

    if (surface === 'newtab') {
      if (isExtensionContext() && chrome.tabs && chrome.tabs.create) {
        const tab = await chrome.tabs.create({ url: playerUrl, active: true });
        return createHandle({ surface, target: tab, popupWin: null, iframe: null });
      }
      const w = window.open(playerUrl, '_blank');
      return createHandle({ surface, target: w, popupWin: w, iframe: null });
    }

    if (surface === 'popup') {
      if (isExtensionContext() && chrome.windows && chrome.windows.create) {
        const win = await chrome.windows.create({
          url: playerUrl,
          type: 'popup',
          width: popupWidth,
          height: popupHeight,
          focused: true,
        });
        return createHandle({ surface, target: win, popupWin: null, iframe: null });
      }
      const w = window.open(
        playerUrl, 'dirrm-player',
        `width=${popupWidth},height=${popupHeight},menubar=no,toolbar=no,location=no,status=no`
      );
      return createHandle({ surface, target: w, popupWin: w, iframe: null });
    }

    // surface === 'iframe'
    const iframe = document.createElement('iframe');
    iframe.id = 'dirrm-launch-frame-' + Math.random().toString(36).slice(2, 8);
    iframe.src = playerUrl;
    iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    iframe.style.cssText = embedIn && embedIn.appendChild
      ? 'width:100%;height:100%;border:none;border-radius:14px;background:transparent;'
      : 'position:fixed;bottom:20px;right:20px;width:520px;height:340px;border:none;z-index:9998;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 1px rgba(245,166,35,0.3);pointer-events:auto;background:transparent;';
    const parent = (embedIn && embedIn.appendChild) ? embedIn : document.body;
    parent.appendChild(iframe);

    return createHandle({ surface, iframe, popupWin: null, target: iframe });
  }

  // ── CONVENIENCE: play a single URL with default settings ──────────────────
  function play(url, title) {
    return open({ url, title });
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────
  return {
    open,
    play,
    detectType,
    buildPlayerUrl,
    isExtensionContext,
    hasDOM,
    CANONICAL_URL,
    VALID_MODES,
  };
}));
