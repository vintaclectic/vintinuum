#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'resources', 'rp_business_deliveries');
const required = [
  'fxmanifest.lua',
  'config.lua',
  'shared/businesses.lua',
  'server/main.lua',
  'client/main.lua',
  'data/businesses.json',
  'README.md',
];

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
}

for (const file of required) {
  check(`required file ${file}`, fs.existsSync(path.join(root, file)), file);
}

const server = fs.readFileSync(path.join(root, 'server/main.lua'), 'utf8');
const client = fs.readFileSync(path.join(root, 'client/main.lua'), 'utf8');
const config = fs.readFileSync(path.join(root, 'config.lua'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

check('admin can add buildings as businesses', /RegisterCommand\('bizadd'/.test(server), '/bizadd');
check('admin can set bank dropoffs', /RegisterCommand\('bizbank'/.test(server), '/bizbank');
check('admin can toggle businesses', /RegisterCommand\('biztoggle'/.test(server), '/biztoggle');
check('businesses persist to json', /SaveResourceFile/.test(server) && /LoadResourceFile/.test(server), 'LoadResourceFile/SaveResourceFile');
check('delivery start is server validated', /GetEntityCoords\(ped\).*business\.coords/s.test(server), 'distance to business');
check('delivery finish is server validated', /GetEntityCoords\(ped\).*business\.bank/s.test(server), 'distance to bank');
check('reputation increases on delivery', /reputationPerDelivery/.test(server), 'reputationPerDelivery');
check('loyalty increases on delivery', /loyaltyPerDelivery/.test(server), 'loyaltyPerDelivery');
check('protection unlock exists', /protectBusiness/.test(server) && /protectionUnlockReputation/.test(server), 'protection');
check('payout adapter exists', /BusinessDeliveriesConfig\.AddMoney/.test(config), 'AddMoney');
check('standalone/qbcore/esx adapter options exist', /standalone/.test(config) && /qbcore/.test(config) && /esx/.test(config), 'framework modes');
check('client has business and bank markers', /DrawMarker\(2/.test(client) && /DrawMarker\(1/.test(client), 'markers');
check('readme documents install and commands', /ensure rp_business_deliveries/.test(readme) && /\/bizadd/.test(readme), 'README');

const failed = checks.filter((item) => !item.pass);
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name} (${item.detail})`);
}

if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} checks passed.`);
