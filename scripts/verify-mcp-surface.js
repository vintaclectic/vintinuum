'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'mcps.html'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.match(page, /MCP Forge/);
assert.match(page, /\/api\/mcps\/forge/);
assert.match(page, /\/api\/mcps/);
assert.match(page, /Forge Draft/);
assert.match(page, /Register MCP/);
assert.match(index, /href="mcps\.html"/);
assert.match(readme, /`mcps\.html` \| MCP Forge/);

// ── No-Collision Law regression guard ────────────────────────────────────────
// A 220-char unbroken MCP name once pushed .mcp h2 to right=4084px on a 375px
// viewport (3726px of document overflow): only .mcp p carried a wrap guard, and
// grid items default to min-width:auto so minmax(0,1fr) could not hold the track.
// These four assertions are the fix; deleting any one of them reopens the bug.
assert.match(page, /\.panel h2,\.mcp h2\{[^}]*overflow-wrap:anywhere/, 'card headings must wrap unbroken names');
assert.match(page, /\.pill\{[^}]*overflow-wrap:anywhere/, 'meta pills must wrap unbroken values');
assert.match(page, /\.mcp\{[^}]*min-width:0/, 'mcp card needs min-width:0 to honour minmax(0,1fr)');
assert.match(page, /\.panel\{[^}]*min-width:0/, 'panel needs min-width:0 to honour minmax(0,1fr)');

console.log('verify-mcp-surface: 11/11 pass');
