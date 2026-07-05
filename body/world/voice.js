'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   PROXIMITY VOICE — CoD / GTA-RP style spatial voice chat for the clearing.

   - Push-to-talk (or toggle) captures your mic.
   - WebRTC peer audio to everyone in the room (mesh).
   - VOLUME is set by DISTANCE every frame: you hear nearby people loud, distant
     people faint, beyond your range tier — silent.
   - ADJUSTABLE RANGE (your transmit reach), GTA-RP style:
       whisper : heard only very close   (~2m full, fades to 0 by ~4m)
       normal  : default                 (~3m full, fades to 0 by ~8m)
       shout   : carries far             (~4m full, fades to 0 by ~14m)
   - Each remote peer's gain = falloff(distance, THEIR transmit range).

   Signaling rides the existing /ws/world socket via voice-offer/answer/ice.
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const Voice = {};
  const peers = new Map();        // peerId → { pc, gain, panner, audioEl, range }
  let localStream = null;
  let micOn = false;
  let myRange = 'normal';
  let sendSignal = null;          // (msg) => ws.send
  let getMyPos = null;            // () => {x,z}
  let getPeerPos = null;          // (id) => {x,z} | null
  let audioCtx = null;

  // range tiers → { full: full-volume radius, zero: silence radius } in world units
  const RANGE = {
    whisper: { full: 2.0, zero: 4.0 },
    normal:  { full: 3.0, zero: 8.0 },
    shout:   { full: 4.0, zero: 14.0 },
  };

  const RTC_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

  Voice.init = function (opts) {
    sendSignal = opts.sendSignal;
    getMyPos = opts.getMyPos;
    getPeerPos = opts.getPeerPos;
  };

  // start/stop transmitting (push-to-talk down/up, or toggle)
  Voice.setMic = async function (on) {
    if (on === micOn) return micOn;
    if (on) {
      try {
        if (!localStream) {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        }
        micOn = true;
        // add our track to every existing peer
        for (const [id, p] of peers) _addLocalTrack(p);
        _announce();
      } catch (e) { console.warn('[voice] mic denied:', e && e.message); micOn = false; }
    } else {
      micOn = false;
      // mute outgoing (keep the stream warm so re-keying is instant)
      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
      _announce();
    }
    if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = micOn);
    return micOn;
  };
  Voice.isOn = () => micOn;

  Voice.setRange = function (r) { if (RANGE[r]) { myRange = r; _announce(); } return myRange; };
  Voice.getRange = () => myRange;
  Voice.cycleRange = function () { const order = ['whisper', 'normal', 'shout']; myRange = order[(order.indexOf(myRange) + 1) % 3]; _announce(); return myRange; };

  function _announce() { if (sendSignal) sendSignal({ t: 'voice-state', on: micOn, range: myRange }); }

  // a peer appeared / updated voice state. We initiate to peers with a lower id
  // (deterministic offerer) to avoid double-offer glare.
  Voice.onPeerState = function (peerId, state, myId) {
    if (!peerId || peerId === myId) return;
    let p = peers.get(peerId);
    if (state && state.range) { if (p) p.range = state.range; }
    if (!p && (micOn || state.on)) {
      // create a connection; the side with the smaller id makes the offer
      p = _ensurePeer(peerId, myId < peerId);
      if (p) p.range = state.range || 'normal';
    }
  };

  Voice.onSignal = async function (msg, myId) {
    const from = msg.from;
    let p = peers.get(from);
    try {
      if (msg.t === 'voice-offer') {
        p = p || _ensurePeer(from, false);
        await p.pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        if (micOn) _addLocalTrack(p);
        const answer = await p.pc.createAnswer();
        await p.pc.setLocalDescription(answer);
        sendSignal({ t: 'voice-answer', to: from, payload: answer });
      } else if (msg.t === 'voice-answer') {
        if (p) await p.pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
      } else if (msg.t === 'voice-ice') {
        if (p && msg.payload) await p.pc.addIceCandidate(new RTCIceCandidate(msg.payload)).catch(() => {});
      }
    } catch (e) { console.warn('[voice] signal err', e && e.message); }
  };

  Voice.removePeer = function (peerId) {
    const p = peers.get(peerId);
    if (!p) return;
    try { p.pc.close(); } catch (_) {}
    if (p.audioEl) { try { p.audioEl.remove(); } catch (_) {} }
    peers.delete(peerId);
  };

  // DIRVERSE warp: close EVERY peer connection at once (we've left the room; the
  // old world's voices must not bleed into the new one). Mic stays as it was.
  Voice.clearPeers = function () {
    for (const id of Array.from(peers.keys())) Voice.removePeer(id);
  };

  function _ensurePeer(peerId, isOfferer) {
    if (peers.get(peerId)) return peers.get(peerId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const p = { pc, gain: null, audioEl: null, range: 'normal' };
    peers.set(peerId, p);

    pc.onicecandidate = (e) => { if (e.candidate) sendSignal({ t: 'voice-ice', to: peerId, payload: e.candidate }); };
    pc.ontrack = (e) => {
      // play the remote audio through a gain we control by distance
      const stream = e.streams[0];
      const el = document.createElement('audio'); el.autoplay = true; el.srcObject = stream; el.volume = 0; el.muted = false;
      el.setAttribute('playsinline', ''); document.body.appendChild(el);
      p.audioEl = el;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(stream);
        const gain = audioCtx.createGain(); gain.gain.value = 0;
        src.connect(gain); gain.connect(audioCtx.destination);
        p.gain = gain; el.muted = true; // route through WebAudio gain instead of element volume
      } catch (_) { /* fall back to element.volume */ p.useEl = true; }
    };
    if (micOn) _addLocalTrack(p);
    if (isOfferer) {
      pc.createOffer().then(o => pc.setLocalDescription(o).then(() => sendSignal({ t: 'voice-offer', to: peerId, payload: o }))).catch(() => {});
    }
    return p;
  }

  function _addLocalTrack(p) {
    if (!localStream) return;
    const senders = p.pc.getSenders();
    localStream.getAudioTracks().forEach(track => {
      if (!senders.find(s => s.track === track)) { try { p.pc.addTrack(track, localStream); } catch (_) {} }
    });
  }

  // called every frame: set each peer's volume from distance + THEIR range tier
  Voice.updateSpatial = function () {
    if (!getMyPos || !getPeerPos) return;
    const me = getMyPos(); if (!me) return;
    for (const [id, p] of peers) {
      const pos = getPeerPos(id);
      let vol = 0;
      if (pos) {
        const d = Math.hypot(pos.x - me.x, pos.z - me.z);
        const r = RANGE[p.range] || RANGE.normal;
        if (d <= r.full) vol = 1;
        else if (d >= r.zero) vol = 0;
        else vol = 1 - (d - r.full) / (r.zero - r.full);
        vol = Math.pow(vol, 1.6); // natural falloff curve
      }
      if (p.gain) { try { p.gain.gain.value = vol; } catch (_) {} }
      else if (p.audioEl) p.audioEl.volume = vol;
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  };

  global.VintinuumVoice = Voice;
})(window);
