'use strict';
// Isolated regression harness: never loads the live router or writes live state.
const fs = require('fs'), path = require('path'), os = require('os');
const vm = require('vm'), assert = require('assert/strict'), cp = require('child_process');
const root = process.argv[2] || '/home/vinta/.claude/council-loop';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jvq-routing-'));
let checks = 0;
const tiers = ['L0','L1','L2','L3','L4'];
function loadRelay(file) {
 const module = { exports: {} };
 vm.runInNewContext(fs.readFileSync(file, 'utf8'), { require, module, exports: module.exports,
  process: { env: { COUNCIL_LOOP_ROOT: tmp, COUNCIL_RELAY_LEDGER: path.join(tmp,'ledger.jsonl') } }, console }, { filename:file });
 return module.exports;
}
function evaluate(routerFile, relay, task, tier, aff = {}, lockout = {level:'none'}) {
 const source = fs.readFileSync(routerFile,'utf8');
 const start = source.indexOf('  // ── THE RELAY (JVQ8RQZ');
 const end = source.indexOf('  const avail = probeAll();', start);
 assert(start >= 0 && end > start, 'real route block markers exist');
 const context = { task, tier, tierSource:'fixture', aff, cls:{kind:aff.top_brain?'reasoning':'code'},
  tierIdx:x=>tiers.indexOf(x), lockoutState:()=>lockout,
  require: name => { assert.equal(name,'./relay.js'); return relay; } };
 vm.runInNewContext(source.slice(start,end),context);
 return context;
}
function check(name, f) { f(); checks++; console.log('PASS '+name); }
try {
 fs.mkdirSync(path.join(tmp,'lib'));
 for(const file of ['relay.js','llm-router.js']) fs.copyFileSync(path.join(root,'lib',file),path.join(tmp,'lib',file));
 const originalRelay = loadRelay(path.join(tmp,'lib/relay.js'));
 const baselineRouter = path.join(tmp,'baseline-router.js');
 fs.copyFileSync(path.join(tmp,'lib/llm-router.js'),baselineRouter);
 check('negative control: unchanged handoff is overwritten by triage',()=>assert.equal(evaluate(baselineRouter,originalRelay,{handoff:{to:'L3'},triage:{tier_delta:-1}},'L3').tier,'L2'));
 check('negative control: stale stronger downgrades',()=>assert.equal(originalRelay.applyHandoff({handoff:{to:'stronger',from_tier:'L1'}},'L4',{}).tier,'L2'));
 check('negative control: stale cheaper upgrades',()=>assert.equal(originalRelay.applyHandoff({handoff:{to:'cheaper',from_tier:'L4'}},'L2',{}).tier,'L3'));
 const locked = {level:'partial', tier_ceiling_now:'L2', available_top_tier:'L2',locked_providers:['fixture']};
 check('negative control: lockout downgrades top-brain work',()=>assert.equal(evaluate(baselineRouter,originalRelay,{},'L4',{top_brain:true,min_tier:'L4'},locked).tier,'L2'));
 for (const task of [{stakes:'critical'}, {stakes:'high'}, {escalated:true}]) check('negative control: protected ordinary work downgrades '+JSON.stringify(task),()=>assert.equal(evaluate(baselineRouter,originalRelay,{...task},'L4',{},locked).tier,'L2'));
 for(const file of ['relay.js','llm-router.js']) {
  cp.execFileSync('git',['apply','--check',path.join(__dirname,file+'.patch')],{cwd:tmp});
  cp.execFileSync('git',['apply',path.join(__dirname,file+'.patch')],{cwd:tmp});
  cp.execFileSync(process.execPath,['--check',path.join(tmp,'lib',file)]);
 }
 const relay = loadRelay(path.join(tmp,'lib/relay.js')), router = path.join(tmp,'lib/llm-router.js');
 check('unchanged explicit handoff outranks negative triage',()=>assert.equal(evaluate(router,relay,{handoff:{to:'L3'},triage:{tier_delta:-1}},'L3').tier,'L3'));
 check('unchanged cheaper destination outranks positive triage',()=>assert.equal(evaluate(router,relay,{handoff:{to:'cheaper',from_tier:'L4'},triage:{tier_delta:1}},'L3').tier,'L3'));
 check('refused handoff outranks positive triage',()=>assert.equal(evaluate(router,relay,{stakes:'high',handoff:{to:'cheaper'},triage:{tier_delta:1}},'L3').tier,'L3'));
 check('malformed handoff still allows triage',()=>assert.equal(evaluate(router,relay,{handoff:{to:'bogus'},triage:{tier_delta:-1}},'L3').tier,'L2'));
 check('no handoff still allows triage',()=>assert.equal(evaluate(router,relay,{triage:{tier_delta:-1}},'L3').tier,'L2'));
 for(const current of tiers.slice(1)) for(const from of tiers) {
  check(`stronger ${from} to current ${current} never downgrades`,()=>assert(tiers.indexOf(relay.applyHandoff({handoff:{to:'stronger',from_tier:from}},current,{}).tier)>=tiers.indexOf(current)));
  check(`cheaper ${from} to current ${current} never upgrades`,()=>assert(tiers.indexOf(relay.applyHandoff({handoff:{to:'cheaper',from_tier:from}},current,{}).tier)<=tiers.indexOf(current)));
 }
 check('lowercase provenance is normalized',()=>assert.equal(relay.applyHandoff({handoff:{to:'stronger',from_tier:'l3'}},'L2',{}).tier,'L4'));
 check('invalid provenance uses current tier',()=>assert.equal(relay.applyHandoff({handoff:{to:'cheaper',from_tier:'bad'}},'L3',{}).tier,'L2'));
 for(const aff of [{force_min_tier:true,min_tier:'L4'},{top_brain:true,min_tier:'L4'}]) {
  check('critical affinity blocks explicit cheap handoff',()=>assert.equal(relay.applyHandoff({handoff:{to:'L1'}},'L4',{aff}).tier,'L4'));
  check('critical affinity retains tier and defers during lockout',()=>{ const r=evaluate(router,relay,{},'L4',aff,locked); assert.equal(r.tier,'L4'); assert.equal(r.task.__lockout_deferred,true); });
 }
 for(const stakes of ['critical','high']) check(stakes+' refuses cheap handoff',()=>assert.equal(relay.applyHandoff({stakes,handoff:{to:'cheaper'}},'L4',{}).tier,'L4'));
 check('escalated failure refuses cheap handoff',()=>assert.equal(relay.applyHandoff({escalated:true,handoff:{to:'cheaper'}},'L3',{}).tier,'L3'));
 check('retry does not accept cheap triage',()=>assert.equal(relay.applyTriage({attempts:1,triage:{tier_delta:-1}},'L3',{}).tier,'L3'));
 for (const task of [{stakes:'critical'}, {stakes:'high'}, {stakes:'HIGH'}, {escalated:true}]) check('protected ordinary work retains tier and defers '+JSON.stringify(task),()=>{ const r=evaluate(router,relay,{...task},'L4',{},locked); assert.equal(r.tier,'L4'); assert.equal(r.task.__lockout_deferred,true); });
 check('ordinary work remains eligible for lockout cheapening',()=>assert.equal(evaluate(router,relay,{},'L3',{},locked).tier,'L2'));
 check('available capable provider avoids unnecessary deferral',()=>assert.equal(evaluate(router,relay,{},'L4',{top_brain:true,min_tier:'L4'},{...locked,available_top_tier:'L4'}).task.__lockout_deferred,undefined));
 check('prompt respects host model enums and discloses unknown savings',()=>{ const p=relay.renderPromptBlock({tier:'L3',phases:[]},'fixture'); assert(p.includes('actual Agent tool model enum')); assert(p.includes('Never invent or pass unsupported aliases')); assert(p.includes('inherit the current model')); assert(p.includes('savings are not established')); });
 console.log(`${checks}/${checks} checks passed; 7 baseline failures reproduced; patches apply and parse.`);
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
