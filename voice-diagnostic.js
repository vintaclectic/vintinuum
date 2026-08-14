#!/usr/bin/env node
'use strict';

// ════════════════════════════════════════════════════════════════════════════
// VOICE DIAGNOSTIC — comprehensive vinta-voice system checker
// ════════════════════════════════════════════════════════════════════════════
// Checks:
//   1. All voice files exist (voice_core, voice_in, voice_out, voice_say, etc.)
//   2. All HTML surfaces load voice_core correctly
//   3. Backend /api/voice/* endpoints are accessible
//   4. WebSocket /api/voice/convo is accessible
//   5. Extension voice integration exists
//
// Run: node voice-diagnostic.js
// ════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const http = require('http');

const REQUIRED_FILES = [
  'body/voice_core.js',
  'body/convo_state.js',
  'body/voice_in.js',
  'body/voice_out.js',
  'body/voice_say.js',
  'body/voice_button.js',
  'body/voice_picker.js'
];

const HTML_SURFACES = [
  'brain.html',
  'chat.html',
  'mind.html',
  'stats.html',
  'you.html',
  'learning.html',
  'jarvis.html',
  'phone.html'
];

const API_ENDPOINTS = [
  '/api/voice/status',
  '/api/voice/say?text=test',
  '/api/voice/voices',
  '/api/voice/convo/status'
];

const EXTENSION_FILES = [
  '../vintinuum-extension/voice_core.js',
  '../vintinuum-extension/voice-ext.js'
];

const results = {
  files: [],
  surfaces: [],
  api: [],
  extension: [],
  errors: []
};

// ── File checks ──────────────────────────────────────────────────────────────
console.log('🔍 Checking voice files...');
for (const file of REQUIRED_FILES) {
  const exists = fs.existsSync(file);
  results.files.push({ file, exists, status: exists ? 'PASS' : 'FAIL' });
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
}

// ── HTML surface checks ──────────────────────────────────────────────────────
console.log('\n🔍 Checking HTML surfaces for voice_core integration...');
for (const surface of HTML_SURFACES) {
  if (!fs.existsSync(surface)) {
    results.surfaces.push({ surface, loaded: false, status: 'MISSING' });
    console.log(`  ✗ ${surface} (file not found)`);
    continue;
  }
  const content = fs.readFileSync(surface, 'utf8');
  const hasVoiceCore = content.includes('voice_core.js');
  const hasVoiceButton = content.includes('voice_button.js');
  results.surfaces.push({
    surface,
    hasVoiceCore,
    hasVoiceButton,
    status: (hasVoiceCore && hasVoiceButton) ? 'PASS' : 'PARTIAL'
  });
  console.log(`  ${hasVoiceCore && hasVoiceButton ? '✓' : '⚠'} ${surface} (core:${hasVoiceCore} btn:${hasVoiceButton})`);
}

// ── API endpoint checks ──────────────────────────────────────────────────────
console.log('\n🔍 Checking backend API endpoints...');
function checkEndpoint(path) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: 'localhost',
      port: 8767,
      path: path,
      timeout: 3000
    }, (res) => {
      const success = res.statusCode === 200;
      results.api.push({ path, status: success ? 'PASS' : 'FAIL', code: res.statusCode });
      console.log(`  ${success ? '✓' : '✗'} ${path} (HTTP ${res.statusCode})`);
      resolve(success);
    });
    req.on('error', (err) => {
      results.api.push({ path, status: 'FAIL', error: err.message });
      console.log(`  ✗ ${path} (${err.message})`);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      results.api.push({ path, status: 'TIMEOUT' });
      console.log(`  ✗ ${path} (timeout)`);
      resolve(false);
    });
  });
}

async function checkAllEndpoints() {
  for (const endpoint of API_ENDPOINTS) {
    await checkEndpoint(endpoint);
  }
}

// ── Extension checks ─────────────────────────────────────────────────────────
console.log('\n🔍 Checking extension voice files...');
for (const file of EXTENSION_FILES) {
  const exists = fs.existsSync(file);
  results.extension.push({ file, exists, status: exists ? 'PASS' : 'FAIL' });
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
}

// ── Run async checks ─────────────────────────────────────────────────────────
checkAllEndpoints().then(() => {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('═'.repeat(80));

  const filesPassed = results.files.filter(r => r.status === 'PASS').length;
  const surfacesPassed = results.surfaces.filter(r => r.status === 'PASS').length;
  const apiPassed = results.api.filter(r => r.status === 'PASS').length;
  const extensionPassed = results.extension.filter(r => r.status === 'PASS').length;

  console.log(`Files:      ${filesPassed}/${results.files.length} passed`);
  console.log(`Surfaces:   ${surfacesPassed}/${results.surfaces.length} passed`);
  console.log(`API:        ${apiPassed}/${results.api.length} passed`);
  console.log(`Extension:  ${extensionPassed}/${results.extension.length} passed`);

  const allPassed = (
    filesPassed === results.files.length &&
    surfacesPassed === results.surfaces.length &&
    apiPassed === results.api.length &&
    extensionPassed === results.extension.length
  );

  console.log('\n' + (allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'));

  if (!allPassed) {
    console.log('\n🔧 RECOMMENDED FIXES:');

    const missingFiles = results.files.filter(r => !r.exists);
    if (missingFiles.length > 0) {
      console.log('\n  Missing files:');
      missingFiles.forEach(r => console.log(`    - ${r.file}`));
    }

    const partialSurfaces = results.surfaces.filter(r => r.status !== 'PASS');
    if (partialSurfaces.length > 0) {
      console.log('\n  Surfaces needing voice_core integration:');
      partialSurfaces.forEach(r => {
        if (!r.hasVoiceCore) console.log(`    - ${r.surface}: add <script src="body/voice_core.js?v=v20260814-universal" defer></script>`);
        if (!r.hasVoiceButton) console.log(`    - ${r.surface}: add <script src="body/voice_button.js?v=v20260814-universal" defer></script>`);
      });
    }

    const failedEndpoints = results.api.filter(r => r.status !== 'PASS');
    if (failedEndpoints.length > 0) {
      console.log('\n  Backend issues:');
      failedEndpoints.forEach(r => console.log(`    - ${r.path}: ${r.error || r.status}`));
      console.log('    → Ensure vintinuum-api server is running on port 8767');
    }
  }

  process.exit(allPassed ? 0 : 1);
});
