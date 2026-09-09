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

console.log('verify-mcp-surface: 7/7 pass');
