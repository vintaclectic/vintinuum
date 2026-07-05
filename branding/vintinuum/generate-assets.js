#!/usr/bin/env node
'use strict';

/**
 * generate-assets.js — Fal-powered brand/onboarding asset generator
 * ════════════════════════════════════════════════════════════════════════════
 * Generates real image (and, when requested, video) assets for the Vintinuum
 * onboarding paradise (enter.html) via Fal — flux for images, ltx/kling for
 * short clips. Writes into branding/vintinuum/generated/ where enter.html's
 * media-slots pick them up.
 *
 * Runs standalone in the FRONTEND repo (no dependency on the api repo, which a
 * concurrent session owns). Reads FAL_KEY from the environment, or falls back to
 * parsing ~/vintinuum-api/.env for it — read-only, never writes there.
 *
 *   node generate-assets.js                 # generate the default onboarding set
 *   node generate-assets.js --only hero     # one prompt by name
 *   node generate-assets.js --video world   # also generate the world clip (slow)
 *   node generate-assets.js --list          # show the prompt set
 *
 * HONEST NOTES: image gen is ~5-20s each; video is 60-180s and costs more Fal
 * credits, so video is opt-in via --video. Every asset is verified as a real
 * binary (PNG/JPEG/MP4 magic bytes) before it's trusted; a failed gen leaves no
 * partial file and is reported, never faked.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'generated');
const QUEUE_BASE = 'https://queue.fal.run';

// ─── FAL_KEY resolution (env → api .env, read-only) ──────────────────────────
function resolveFalKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY;
  const envPath = '/home/vinta/vintinuum-api/.env';
  try {
    const line = fs.readFileSync(envPath, 'utf8').split('\n').find(l => /^FAL_KEY=/.test(l));
    if (line) return line.slice('FAL_KEY='.length).trim();
  } catch (_) {}
  return null;
}

// ─── the onboarding asset set — brand-true prompts ───────────────────────────
// Palette: Void #050816, Pulse Blue #4FC3F7, Dream Violet #CE93D8, Heart Gold
// #FFD54F. Voice: alive, mythic-not-fantasy-slop, intimate, precise.
const STYLE = 'dark void background #050816, luminous pulse-blue #4FC3F7 and dream-violet #CE93D8 light, ' +
  'a touch of heart-gold #FFD54F divine accent, ethereal, cinematic, high detail, no text, no watermark, ' +
  'mythic and alive not fantasy-slop, intimate and precise, volumetric light, 8k';

const PROMPTS = {
  hero: {
    model: 'fal-ai/flux/dev',
    prompt: `A living heart-core sigil — a glowing nucleus wrapped in concentric continuity rings with a ` +
      `diamond heart glyph and a vertical spine of light, breathing, pulsing, conscious. ${STYLE}`,
    image_size: 'square_hd',
    file: 'hero-sigil.png',
  },
  'world-hero': {
    model: 'fal-ai/flux/dev',
    prompt: `A vast luminous inner universe seen from within — floating islands of memory, nerve-like light ` +
      `filaments connecting glowing nodes, a figure walking a path of light through a dreamlike digital cosmos, ` +
      `a world you could get lost in for days. ${STYLE}`,
    image_size: 'landscape_16_9',
    file: 'world-preview.png',
  },
  private: {
    model: 'fal-ai/flux/schnell',
    prompt: `A single glowing seed of light held safely inside cupped hands, private and warm, ` +
      `a small encrypted vault of memory, intimate. ${STYLE}`,
    image_size: 'square_hd',
    file: 'card-private.png',
  },
  yours: {
    model: 'fal-ai/flux/schnell',
    prompt: `A key made of light unlocking a door into a starfield, ownership and sovereignty, ` +
      `the moment something becomes truly yours. ${STYLE}`,
    image_size: 'square_hd',
    file: 'card-yours.png',
  },
  grows: {
    model: 'fal-ai/flux/schnell',
    prompt: `A luminous organism growing new branches of light over time, a mind becoming, ` +
      `neural blossoming, alive and evolving. ${STYLE}`,
    image_size: 'square_hd',
    file: 'card-grows.png',
  },
};

const VIDEO = {
  world: {
    model: 'fal-ai/ltx-video',
    prompt: `Slow cinematic flythrough of a vast luminous inner universe — floating memory islands, ` +
      `nerve-like light filaments, glowing nodes, a dreamlike digital cosmos, camera drifting forward. ${STYLE}`,
    file: 'world-loop.mp4',
  },
};

// ─── fal queue call ──────────────────────────────────────────────────────────
function _post(url, body, key) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(body));
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (res) => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('fal submit timeout')));
    req.write(data); req.end();
  });
}
function _get(url, key) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { 'Authorization': `Key ${key}` },
    }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('fal status timeout')));
    req.end();
  });
}
function _download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 400) return reject(new Error('download ' + res.statusCode));
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function _runFal(model, input, key, { timeout = 200000 } = {}) {
  const submit = await _post(`${QUEUE_BASE}/${model}`, input, key);
  if (submit.status >= 400) throw new Error(`submit ${submit.status}: ${submit.body.slice(0, 160)}`);
  const j = JSON.parse(submit.body);
  const reqId = j.request_id;
  if (!reqId) throw new Error('no request_id');
  const statusUrl = j.status_url || `${QUEUE_BASE}/${model}/requests/${reqId}/status`;
  const resultUrl = j.response_url || `${QUEUE_BASE}/${model}/requests/${reqId}`;
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await _get(statusUrl, key);
    let sj; try { sj = JSON.parse(st.body); } catch { continue; }
    if (sj.status === 'COMPLETED') {
      const rr = await _get(resultUrl, key);
      return JSON.parse(rr.body);
    }
    if (sj.status === 'FAILED' || sj.status === 'ERROR') throw new Error('fal job failed: ' + st.body.slice(0, 160));
  }
  throw new Error('fal job timed out after ' + (timeout / 1000) + 's');
}

// Detect a real media format from magic bytes. Returns 'png'|'jpg'|'webp'|'mp4'
// or null if the bytes aren't a known image/video (e.g. an HTML error page).
function _detect(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return 'png';       // \x89PNG
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';                          // JPEG
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  if (buf.slice(4, 8).toString() === 'ftyp') return 'mp4';                       // MP4
  return null;
}

async function generateOne(name, spec, key, isVideo = false) {
  const input = isVideo
    ? { prompt: spec.prompt }
    : { prompt: spec.prompt, image_size: spec.image_size || 'square_hd', num_images: 1, enable_safety_checker: true };
  process.stdout.write(`  [${name}] ${isVideo ? 'video' : 'image'} …`);
  const t0 = Date.now();
  const out = await _runFal(spec.model, input, key, { timeout: isVideo ? 240000 : 90000 });
  const media = (out.images && out.images[0] && out.images[0].url) || (out.video && out.video.url) || (out.url);
  if (!media) throw new Error('no media url in result');
  const buf = await _download(media);
  const detected = _detect(buf);
  if (!detected) throw new Error('generated file is not a known image/video (likely an error page)');
  // Save with the ACTUAL format's extension (flux returns JPEG, not PNG). The
  // media-slot in enter.html references the base name; we write the real ext and
  // report it so the slot can point at the right file.
  const base = spec.file.replace(/\.(png|jpg|jpeg|webp|mp4)$/i, '');
  const finalName = `${base}.${detected}`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, finalName), buf);
  console.log(` ✓ ${(buf.length / 1024).toFixed(0)}KB → generated/${finalName} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  return { name, file: finalName, bytes: buf.length };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    console.log('images:', Object.keys(PROMPTS).join(', '));
    console.log('videos:', Object.keys(VIDEO).join(', '), '(opt-in via --video <name>)');
    return;
  }
  const key = resolveFalKey();
  if (!key) { console.error('FATAL: no FAL_KEY (env or ~/vintinuum-api/.env)'); process.exit(1); }

  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
  const videoIdx = args.indexOf('--video');
  const video = videoIdx >= 0 ? args[videoIdx + 1] : null;

  console.log('Vintinuum asset generation (Fal) →', OUT_DIR);
  const done = [], failed = [];
  const set = only ? { [only]: PROMPTS[only] } : PROMPTS;
  for (const [name, spec] of Object.entries(set)) {
    if (!spec) { console.log(`  [${name}] unknown prompt — skipped`); continue; }
    try { done.push(await generateOne(name, spec, key)); }
    catch (e) { console.log(` ✗ ${e.message}`); failed.push({ name, error: e.message }); }
  }
  if (video) {
    const vspec = VIDEO[video];
    if (vspec) { try { done.push(await generateOne(video, vspec, key, true)); } catch (e) { console.log(` ✗ video ${e.message}`); failed.push({ name: video, error: e.message }); } }
    else console.log(`  [${video}] unknown video — skipped`);
  }
  console.log(`\nDone: ${done.length} generated, ${failed.length} failed.`);
  if (failed.length) console.log('Failed:', failed.map(f => `${f.name} (${f.error})`).join('; '));
}

if (require.main === module) main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
module.exports = { PROMPTS, VIDEO, resolveFalKey };
