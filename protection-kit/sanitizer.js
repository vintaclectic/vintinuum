#!/usr/bin/env node
// Circle Protection Kit — Sanitizer
// Pre-paste cleaner. Reads mapping.json, takes text from stdin or file,
// replaces real-terms with generic stand-ins, strips project-specific comments,
// outputs to stdout or file.
//
// Usage:
//   cat mycode.js | node sanitizer.js
//   node sanitizer.js --from mycode.js --to safe.js
//   node sanitizer.js --from mycode.js  (prints to stdout)
//
// Zero dependencies. Pure Node.js. Works on any text file (JS, Python, Lua, TS, HTML, CSS).

'use strict';

const fs = require('fs');
const path = require('path');

function loadMappings() {
  const mapPath = path.join(__dirname, 'mapping.json');
  const raw = fs.readFileSync(mapPath, 'utf8');
  const data = JSON.parse(raw);
  // Sort by longest real term first, so "FACE_LAYER" replaces before "FACE"
  return data.mappings.slice().sort((a, b) => b.real.length - a.real.length);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitize(text, mappings) {
  let out = text;

  // Primary replacement pass
  for (const entry of mappings) {
    const escaped = escapeRegex(entry.real);
    out = out.replace(new RegExp(escaped, 'g'), entry.generic);
  }

  // Strip project-specific line comments (//)
  out = out.replace(
    /\/\/[^\n\r]*?(vintinuum|dirhaven|karma|soul|chakra|vinta|genome|neurochemistry|consciousness layer)[^\n\r]*/gi,
    ''
  );

  // Strip project-specific block comments (/* ... */)
  out = out.replace(
    /\/\*[\s\S]*?(vintinuum|dirhaven|karma|soul|chakra|vinta|genome|neurochemistry|consciousness layer)[\s\S]*?\*\//gi,
    ''
  );

  // Strip project-specific Python/shell/Lua hash comments (#)
  out = out.replace(
    /#[^\n\r]*?(vintinuum|dirhaven|karma|soul|chakra|vinta|genome|neurochemistry|consciousness layer)[^\n\r]*/gi,
    ''
  );

  // Strip HTML comments
  out = out.replace(
    /<!--[\s\S]*?(vintinuum|dirhaven|karma|soul|chakra|vinta|genome|neurochemistry|consciousness layer)[\s\S]*?-->/gi,
    ''
  );

  return out;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const mappings = loadMappings();

  let input = '';
  const fromIdx = args.indexOf('--from');
  if (fromIdx !== -1 && args[fromIdx + 1]) {
    input = fs.readFileSync(args[fromIdx + 1], 'utf8');
  } else if (process.stdin.isTTY) {
    process.stderr.write('sanitizer: no input. Pipe text via stdin or use --from <file>.\n');
    process.exit(1);
  } else {
    input = await readStdin();
  }

  const output = sanitize(input, mappings);

  const toIdx = args.indexOf('--to');
  if (toIdx !== -1 && args[toIdx + 1]) {
    fs.writeFileSync(args[toIdx + 1], output);
    process.stderr.write(`sanitizer: wrote ${output.length} chars to ${args[toIdx + 1]}\n`);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write('sanitizer error: ' + err.message + '\n');
    process.exit(1);
  });
}

module.exports = { sanitize, loadMappings };
