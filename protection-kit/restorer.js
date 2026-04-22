#!/usr/bin/env node
// Circle Protection Kit — Restorer
// Post-copy translator. Reads mapping.json, takes text from stdin or file,
// replaces generic stand-ins with real terms, outputs to stdout or file.
//
// Usage:
//   pbpaste | node restorer.js > patched.js        (macOS)
//   xclip -o -selection clipboard | node restorer.js > patched.js   (Linux)
//   node restorer.js --from gpt-response.js --to patched.js
//
// Zero dependencies. Pure Node.js.

'use strict';

const fs = require('fs');
const path = require('path');

function loadMappings() {
  const mapPath = path.join(__dirname, 'mapping.json');
  const raw = fs.readFileSync(mapPath, 'utf8');
  const data = JSON.parse(raw);
  // Sort by longest generic term first, so longer phrases replace before their substrings
  return data.mappings.slice().sort((a, b) => b.generic.length - a.generic.length);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function restore(text, mappings) {
  let out = text;
  for (const entry of mappings) {
    const escaped = escapeRegex(entry.generic);
    out = out.replace(new RegExp(escaped, 'g'), entry.real);
  }
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
    process.stderr.write('restorer: no input. Pipe text via stdin or use --from <file>.\n');
    process.exit(1);
  } else {
    input = await readStdin();
  }

  const output = restore(input, mappings);

  const toIdx = args.indexOf('--to');
  if (toIdx !== -1 && args[toIdx + 1]) {
    fs.writeFileSync(args[toIdx + 1], output);
    process.stderr.write(`restorer: wrote ${output.length} chars to ${args[toIdx + 1]}\n`);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write('restorer error: ' + err.message + '\n');
    process.exit(1);
  });
}

module.exports = { restore, loadMappings };
