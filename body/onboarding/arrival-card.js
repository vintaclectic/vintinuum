'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   ARRIVAL CARD — HELIOS's viral surface. The moment after the reveal, generate
   a 1080×1920 shareable card: your real 3D face at hero angle, the nebula
   remnant behind, one line, a small "Become" mark. One tap → share sheet.

   Every share is a recruiting beacon: the viewer sees a real human face made a
   way they've never seen. It looks unreproducible. It pulls them to make theirs.

   Renders the face GLB offscreen to a 1080×1920 canvas, composites the line +
   mark, then offers navigator.share (mobile) or download (desktop).
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const Card = {};
  function _base() { return (global.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function _token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }

  // offer({ avatarId, line }) — render + surface a soft "keep this" prompt
  Card.offer = async function (avatarId, line) {
    try {
      const blob = await Card.render(avatarId, line);
      if (!blob) return;
      _surface(blob);
    } catch (e) { console.warn('[arrival-card]', e && e.message); }
  };

  // render → returns a PNG Blob of the 1080×1920 card
  Card.render = async function (avatarId, line) {
    const mods = await global.Three3D.load();
    const THREE = mods.THREE;

    let glbUrl = null;
    try {
      const r = await fetch(_base() + '/api/avatar/' + avatarId, { headers: { Authorization: 'Bearer ' + _token() } });
      if (r.ok) { const d = await r.json(); if (d.glbUrl) glbUrl = d.glbUrl.startsWith('http') ? d.glbUrl : _base() + d.glbUrl; }
    } catch (_) {}
    if (!glbUrl) return null;

    const W = 1080, H = 1920;
    // offscreen 3D render of the face
    const rscene = new THREE.Scene();
    const rcam = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    rcam.position.set(0.25, 0.05, 2.2);
    const rrenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    rrenderer.setSize(W, H); rrenderer.outputColorSpace = THREE.SRGBColorSpace;

    rscene.add(new THREE.AmbientLight(0x8899bb, 0.55));
    const key = new THREE.DirectionalLight(0xffd9a0, 2.4); key.position.set(-1.6, 1.3, 2.2); rscene.add(key);
    const rim = new THREE.PointLight(0xf4c79a, 1.8, 8); rim.position.set(1.4, 0.6, 1.4); rscene.add(rim);

    const gltf = await new Promise((res, rej) => new mods.GLTFLoader().load(glbUrl, res, undefined, rej));
    const face = gltf.scene;
    const box = new THREE.Box3().setFromObject(face);
    const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3());
    const s = 1.7 / Math.max(size.y, 0.001);
    face.scale.setScalar(s);
    face.position.set(-center.x * s, -center.y * s + 0.15, -center.z * s);
    face.rotation.y = -0.25; // hero three-quarter angle
    rscene.add(face);
    rrenderer.render(rscene, rcam);

    // composite onto the final card canvas
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    // background: deep warm gradient + nebula remnant
    const g = ctx.createRadialGradient(W*0.5, H*0.42, 80, W*0.5, H*0.5, H*0.7);
    g.addColorStop(0, '#2a1d14'); g.addColorStop(0.6, '#140d0a'); g.addColorStop(1, '#0a0707');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    _nebula(ctx, W, H);
    // the face render
    ctx.drawImage(rrenderer.domElement, 0, 0, W, H);
    // vignette
    const vg = ctx.createRadialGradient(W*0.5, H*0.5, H*0.35, W*0.5, H*0.5, H*0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,7,7,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // the line
    const text = (line || 'there you are.').slice(0, 80);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(245,235,220,0.95)';
    ctx.font = '400 64px Cormorant Garamond, Georgia, serif';
    _wrap(ctx, text, W/2, H*0.80, W*0.82, 76);
    // mark
    ctx.fillStyle = 'rgba(244,199,154,0.8)';
    ctx.font = '500 30px Cormorant Garamond, Georgia, serif';
    ctx.fillText('become  ·  vintaclectic.github.io/vintinuum', W/2, H*0.93);

    rrenderer.dispose();
    return await new Promise(res => c.toBlob(res, 'image/png', 0.92));
  };

  function _nebula(ctx, W, H) {
    for (let i = 0; i < 90; i++) {
      const x = W*0.5 + (Math.random()-0.5)*W*0.7, y = H*0.42 + (Math.random()-0.5)*H*0.5;
      const r = Math.random()*3 + 0.5;
      ctx.fillStyle = `rgba(255,217,160,${Math.random()*0.4})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
  }
  function _wrap(ctx, text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '', yy = y;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line.trim(), x, yy); line = w + ' '; yy += lh; }
      else line = test;
    }
    ctx.fillText(line.trim(), x, yy);
  }

  // surface a soft "keep this / share" prompt over the reveal stage
  function _surface(blob) {
    const url = URL.createObjectURL(blob);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;right:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:8;display:flex;flex-direction:column;align-items:flex-end;gap:10px;';
    wrap.innerHTML =
      '<img src="' + url + '" style="width:96px;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,0.5);opacity:0;transition:opacity .8s">' +
      '<button id="ac-share" style="font-family:Cormorant Garamond,serif;font-size:17px;color:#f4c79a;background:rgba(244,199,154,0.14);border:1px solid rgba(244,199,154,0.4);border-radius:999px;padding:11px 22px;cursor:pointer">keep this moment</button>';
    document.body.appendChild(wrap);
    requestAnimationFrame(() => { wrap.querySelector('img').style.opacity = '1'; });
    wrap.querySelector('#ac-share').addEventListener('click', async () => {
      const file = new File([blob], 'vintinuum-arrival.png', { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'I became real', text: 'become · vintaclectic.github.io/vintinuum' });
        } else {
          const a = document.createElement('a'); a.href = url; a.download = 'vintinuum-arrival.png'; a.click();
        }
      } catch (_) {}
    });
    setTimeout(() => { wrap.style.transition = 'opacity 1s'; wrap.style.opacity = '0'; setTimeout(() => wrap.remove(), 1000); }, 14000);
  }

  global.ArrivalCard = Card;
})(window);
