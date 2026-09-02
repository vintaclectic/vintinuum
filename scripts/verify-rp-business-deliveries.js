#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'resources', 'rp_business_deliveries');
const required = ['fxmanifest.lua', 'config.lua', 'client.lua', 'server.lua', 'schema.sql', 'README.md'];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length) {
  console.error(`missing files: ${missing.join(', ')}`);
  process.exit(1);
}

const config = fs.readFileSync(path.join(root, 'config.lua'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.lua'), 'utf8');
const client = fs.readFileSync(path.join(root, 'client.lua'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');

const checks = [
  ['config exposes businesses', /Businesses\s*=\s*\{[\s\S]*id\s*=\s*'vespucci_liquor'/.test(config)],
  ['config exposes banks', /Banks\s*=\s*\{[\s\S]*legion_bank/.test(config)],
  ['money adapter exists', /Money\s*=\s*\{[\s\S]*addClean[\s\S]*addDirty/.test(config)],
  ['server validates start distance', /distanceBetween\(source, business\.coords\)\s*>\s*Config\.deliveryStartDistance/.test(server)],
  ['server validates bank drop distance', /distanceBetween\(source, bank\.coords\)\s*>\s*Config\.bankDropDistance/.test(server)],
  ['server mutates reputation and loyalty', /mutateStats\(contract\.identifier, contract\.businessId, contract\.reputation, contract\.loyalty, 1, 0\)/.test(server)],
  ['server supports protection contracts', /startProtection/.test(server) && /bizcompleteprotect/.test(server)],
  ['client has player commands', /RegisterCommand\('bizrun'/.test(client) && /RegisterCommand\('bizdeliver'/.test(client) && /RegisterCommand\('bizprotect'/.test(client)],
  ['schema persists reputation', /CREATE TABLE IF NOT EXISTS rp_business_reputation/.test(schema)],
  ['schema persists run history', /CREATE TABLE IF NOT EXISTS rp_business_runs/.test(schema)]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`failed checks: ${failed.join(', ')}`);
  process.exit(1);
}

console.log(`${checks.length}/${checks.length} rp_business_deliveries checks passed`);
