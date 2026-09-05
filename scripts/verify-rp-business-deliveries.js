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
  'data/control.json',
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
const manifest = fs.readFileSync(path.join(root, 'fxmanifest.lua'), 'utf8');

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


// ---------------------------------------------------------------------------
// TAKEOVER LAYER (task M4KJKGY) - one block per acceptance criterion.
// ---------------------------------------------------------------------------

const controlRaw = fs.readFileSync(path.join(root, 'data/control.json'), 'utf8');

// Criterion 1: a player can build claim on a business via tagging/repping.
check('takeover config block exists', /BusinessDeliveriesConfig\.Takeover\s*=\s*\{/.test(config), 'Config.Takeover');
check('c1 tag event exists', /RegisterNetEvent\('rp_business_deliveries:server:tagBusiness'/.test(server), 'server:tagBusiness');
check('c1 tag is server distance validated', /tagBusiness[\s\S]{0,900}?GetEntityCoords\(ped\)[\s\S]{0,80}?business\.coords/.test(server), 'tag distance check');
check('c1 tag is cooldown gated', /tagCooldowns/.test(server) && /tagCooldownSeconds/.test(config), 'tag cooldown');
check('c1 tagging is a timed client action', /runTag/.test(client) && /tagDurationMs/.test(config), 'timed tag action');
check('c1 repping accrues claim from deliveries', /claimPerDelivery/.test(server) && /claimPerDelivery/.test(config), 'claimPerDelivery');
check('c1 repping accrues claim from protection', /claimPerProtection/.test(server) && /claimPerProtection/.test(config), 'claimPerProtection');
check('c1 claim accrual is server side', /local function addClaim/.test(server), 'addClaim');

// Criterion 2: a rival player or crew can contest/take that claim.
check('c2 contest resolution exists', /local function resolveContest/.test(server), 'resolveContest');
check('c2 contest uses hold threshold and margin', /claimToHold/.test(server) && /contestMargin/.test(server), 'claimToHold + contestMargin');
check('c2 crews pool claims', /RegisterCommand\('bizcrew'/.test(server) && /crewIdFor/.test(server), '/bizcrew + crewIdFor');
check('c2 solo players are a crew of one', /'solo:'/.test(server), 'solo crew fallback');
check('c2 claim decays so holders can lose grip', /decayPerInterval/.test(server) && /holderDecayPerInterval/.test(server), 'claim decay');
check('c2 control flips are broadcast', /client:controlFlip/.test(server) && /client:controlFlip/.test(client), 'controlFlip');

// Criterion 3: robbery works as a takeover vector.
check('c3 rob event exists', /RegisterNetEvent\('rp_business_deliveries:server:robBusiness'/.test(server), 'server:robBusiness');
check('c3 rob is server distance validated', /robBusiness[\s\S]{0,900}?GetEntityCoords\(ped\)[\s\S]{0,80}?business\.coords/.test(server), 'rob distance check');
check('c3 rob is cooldown gated', /robCooldowns/.test(server) && /robCooldownSeconds/.test(config), 'rob cooldown');
check('c3 rob can fail', /robFailClaimLoss/.test(server) && /robBaseSuccess/.test(server), 'rob failure path');
check('c3 rob grants claim not just cash', /robClaimGain/.test(server) && /robHolderClaimLoss/.test(server), 'rob claim transfer');
check('c3 rob odds degrade with heat', /robSuccessPerHeatPoint/.test(server) && /robSuccessFloor/.test(server), 'heat scaled odds');

// Criterion 4: ownership/control persists across restart alongside businesses.json.
check('c4 control file is configured', /ControlFile\s*=\s*'data\/control\.json'/.test(config), 'Config.ControlFile');
check('c4 control saves via SaveResourceFile', /local function saveControl[\s\S]{0,300}?SaveResourceFile/.test(server), 'saveControl');
check('c4 control loads via LoadResourceFile', /local function loadControl[\s\S]{0,300}?LoadResourceFile/.test(server), 'loadControl');
check('c4 control loads on resource start', /loadBusinesses\(\)[\s\S]{0,200}?loadControl\(\)/.test(server), 'boot loads control');
check('c4 control saves on resource stop', /onResourceStop[\s\S]{0,200}?saveControl\(\)/.test(server), 'onResourceStop save');
check('c4 control autosaves periodically', /autosaveIntervalSeconds/.test(server) && /autosaveIntervalSeconds/.test(config), 'autosave');
check('c4 control.json is valid json', (() => { try { JSON.parse(controlRaw); return true; } catch (e) { return false; } })(), 'data/control.json parses');
check('c4 data files registered in manifest', /files\s*\{[\s\S]*?data\/control\.json/.test(manifest), 'fxmanifest files block');

// Criterion 5: payout and protection respect who currently controls the business.
check('c5 delivery payout applies control cut', /applyControlCut/.test(server), 'applyControlCut');
check('c5 controlling crew takes a cut', /controlCutPercent/.test(server) && /controlCutPercent/.test(config), 'controlCutPercent');
check('c5 holder earns a delivery bonus', /holderPayoutBonusPercent/.test(server) && /holderPayoutBonusPercent/.test(config), 'holderPayoutBonusPercent');
check('c5 protection respects control', /holderProtectionBonusPercent/.test(server) && /outsiderProtectionPenaltyPercent/.test(server), 'protection control split');
check('c5 skimmed cash banks to a vault', /state\.vault/.test(server) && /RegisterCommand\('bizvault'/.test(server), 'vault + /bizvault');
check('c5 uncontrolled businesses are unchanged', /if not state or not state\.holder then\s*\n\s*return amount, 0, false/.test(server), 'no holder means no cut');

// Anti-cheat + framework discipline.
check('takeover net events are rate limited', /local function rateLimited/.test(server) && /rateLimited\(source, 'rob'/.test(server) && /rateLimited\(source, 'tag'/.test(server), 'rateLimited');
check('qbox framework is supported', /qbox/.test(config) && /qbx_core/.test(config), 'qbox adapter');
check('standalone mode still supported', /standalone/.test(config) && /client:standalonePayout/.test(config), 'standalone intact');

// No-collision: exactly one help prompt is composed and drawn.
check('client draws a single composed help prompt', (client.match(/drawHelp\(/g) || []).length === 3, 'one drawHelp per branch, none stacked');
check('control legibility is rendered', /drawControlLabel/.test(client) && /controlLinesFor/.test(client), 'control label');

// Docs.
check('readme documents takeover', /## Takeover/.test(readme) && /\/bizcrew/.test(readme) && /\/bizvault/.test(readme), 'README takeover section');

const failed = checks.filter((item) => !item.pass);
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name} (${item.detail})`);
}

if (failed.length) {
  console.error(`\n${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`\n${checks.length}/${checks.length} checks passed.`);
