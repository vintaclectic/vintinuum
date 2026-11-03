'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jvq-router-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const provider = (rank, models) => ({rank, models, enabled:true, executes_tools:true, credential:{type:'none'}});
const cfg = {
 providers: {
  expensive:provider(1,{premium:{tier:'L4',in:10,out:20},mechanical:{tier:'L1',in:2,out:4}}),
  efficient:provider(2,{frontier:{tier:'L4',in:1,out:2},small:{tier:'L1',in:0.1,out:0.2}}),
  weak:provider(3,{middle:{tier:'L2',in:0.5,out:1}}),
 },
 task_affinity:{ general:{min_tier:'L2',prefer:['expensive','efficient','weak'],signals:[]},
 bulk:{min_tier:'L1',prefer:['expensive','efficient'],signals:['format']},
 reasoning:{min_tier:'L4',top_brain:true,prefer:['expensive','efficient'],signals:['architecture']},
 security:{min_tier:'L4',force_min_tier:true,top_brain:true,prefer:['expensive','efficient'],signals:['authentication']} },
 policy:{max_failover_hops:20,circuit_breaker:{consecutive_failures_to_open:3,cooldown_secs:60,half_open_probe:true},retry:{transient_max_retries:1}},
 tier_budgets:{L1:1000,L2:2000,L4:5000}
};
fs.writeFileSync(path.join(tmp,'config.json'),JSON.stringify(cfg));
const env={PATH:'/usr/bin',COUNCIL_PROVIDERS_CONFIG:path.join(tmp,'config.json'),COUNCIL_HEALTH_PATH:path.join(tmp,'health.json'),COUNCIL_HISTORY_PATH:path.join(tmp,'history.json'),COUNCIL_EXEC_EVIDENCE_PATH:path.join(tmp,'execution.json')};
const mod={exports:{}};
const sandbox = {module:mod,exports:mod.exports,console,Buffer,setTimeout,clearTimeout,URL,
 process:{env,argv:[],execPath:process.execPath,cwd:()=>tmp},
 require(id){
  if(id==='os') return {...os,homedir:()=>tmp};
  if(id==='child_process') return {spawnSync:()=>({status:0,stdout:'/fake/bin',stderr:''}),spawn(){throw Error('no paid execution in tests');}};
  if(id==='./orchestrator.js') return {assess(task){return {tier:task.assessedTier||'L1',learner_version:1};}};
  if(id.startsWith('./')) throw Error('optional module not loaded in hermetic test');
  return require(id);
 }};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../runtime/lib/llm-router.js'),'utf8'),sandbox,{filename:'llm-router.js'});
const R=mod.exports;
const clearHealth=()=>fs.writeFileSync(env.COUNCIL_HEALTH_PATH,JSON.stringify({providers:{}}));
clearHealth();
test('explicit high stakes survives orchestrator source and rejects every weaker rung',()=>{
 const p=R.route({title:'edit implementation',stakes:'high'});
 assert.equal(p.quality_floor,'L4'); assert.ok(p.ladder.length>0);
 assert.ok(p.ladder.every(r=>r.tier==='L4'));
 assert.equal(R.wantsTopBrain('L3',{},'orchestrator:v1+stakes:high',{stakes:'high'}),true);
});
test('priority-one work receives frontier while a bounded ordinary step stays frugal',()=>{
 assert.equal(R.route({title:'work',priority:1}).quality_floor,'L4');
 const p=R.route({title:'format',kind:'bulk',priority:3});
 assert.equal(p.ladder[0].model,'small'); assert.equal(p.ladder[0].provider,'efficient');
});
test('higher price is never used as capability proof',()=>{
 const c=R.config(); c.providers.expensive.models.equivalent={tier:'L4',in:1,out:1};
 assert.equal(R.pickModel('expensive','L4',true,'general').model,'equivalent');
 delete c.providers.expensive.models.equivalent;
});
test('critical pins and disabled pins cannot bypass quality filters',()=>{
 const p=R.route({priority:1,model:'small',provider:'efficient'});
 assert.ok(p.ladder.every(r=>r.tier==='L4'));
 assert.ok(p.capability_skipped.some(r=>r.model==='small'));
 R.config().providers.efficient.models.small.enabled=false;
 assert.ok(!R.route({kind:'bulk',provider:'efficient',model:'small'}).ladder.some(r=>r.model==='small'));
 delete R.config().providers.efficient.models.small.enabled;
});
test('orchestrator L4, security, reasoning keep frontier throughout failover',()=>{
 for(const task of [{assessedTier:'L4'},{title:'authentication'},{title:'architecture'}]) {
  const p=R.route(task); assert.equal(p.quality_floor,'L4'); assert.ok(p.ladder.every(r=>r.tier==='L4'));
 }
});
test('provider lockout defers critical work instead of sending it to weak models',()=>{
 const providers={};
 for(const name of ['expensive','efficient'])providers[name]={consecutive_failures:4,walled_until:Date.now()+600000,last_error:'rate limit'};
 fs.writeFileSync(env.COUNCIL_HEALTH_PATH,JSON.stringify({providers}));
 try{const p=R.route({title:'architecture'});assert.equal(p.tier,'L4');assert.equal(p.empty,true);assert.equal(p.lockout_deferred,true);}finally{clearHealth();}
});
test('route does not mutate a task with stale lockout bookkeeping',()=>{
 const t={priority:1,__lockout_deferred:true}; const p=R.route(t);
 assert.equal(p.lockout_deferred,false); assert.equal(t.__lockout_deferred,true);
});
test('explicit work-unit kind and scoped text override parent routing pin',()=>{
 const t={title:'architecture',priority:1,stakes:'high',model:'premium',provider:'expensive',steps:[
 {name:'decision',kind:'reasoning'},
 {name:'format manifest',kind:'bulk',tier:'L1',independent:true,reviewed:true}
 ]};
 const p=R.routeSteps(t);
 assert.equal(p.steps[0].plan.quality_floor,'L4');
 assert.equal(p.steps[1].plan.ladder[0].model,'small');
 assert.equal(p.steps[1].kind,'bulk');
 assert.ok(p.steps[1].cost_estimate<0.001);
});
test('unreviewed independent child cannot drop parent risk floor',()=>{
 const t={title:'architecture',priority:1};
 const p=R.route(R.taskForStep(t,{name:'format',kind:'bulk',tier:'L1',independent:true},0));
 assert.equal(p.quality_floor,'L4');
});
test('estimated unit cost uses per-million rates correctly',()=>{
 assert.equal(R.calculateLadderCost([{provider:'efficient',model:'small'}]),0.0003);
});
test('single-rung driver pin cannot bypass critical quality floor',async()=>{
 const r=await R.execute({priority:1},'',{single:true,pinProvider:'efficient',pinModel:'small'});
 assert.equal(r.ok,false);assert.match(r.reason,/quality floor/);
});
const work={id:'test',title:'architecture',priority:1,steps:[{name:'design',kind:'reasoning'}, {name:'format',kind:'bulk',independent:true,reviewed:true}]};
function runner(calls){return async(task,prompt)=>{const r=R.route(task).ladder[0];calls.push({model:r.model,prompt});return {ok:true,provider:r.provider,model:r.model,text:'artifact-'+calls.length,tokens:50,cost:0.01};};}
const verifyStep=async()=>({ok:true,evidence:'fixture artifact validator passed'});
test('checkpoint handoff executes two distinct models and preserves verified artifacts',async()=>{
 const calls=[],saved=[];
 const r=await R.executeSteps(work,{runStep:runner(calls),verifyStep,saveCheckpoint:async cp=>saved.push(cp)});
 assert.equal(r.ok,true);assert.equal(calls.length,2);assert.notEqual(calls[0].model,calls[1].model);
 assert.match(calls[1].prompt,/artifact-1/);assert.equal(saved.length,2);assert.equal(r.tokens,100);assert.equal(r.cost,0.02);
});
test('budget checkpoint resumes exactly the remaining work unit',async()=>{
 const calls=[];let cp;
 const a=await R.executeSteps(work,{maxTokens:50,runStep:runner(calls),verifyStep,saveCheckpoint:async x=>{cp=x;}});
 assert.equal(a.checkpointed,true);assert.equal(a.next,1);
 const b=await R.executeSteps(work,{checkpoint:cp,maxTokens:150,runStep:runner(calls),verifyStep,saveCheckpoint:async x=>{cp=x;}});
 assert.equal(b.ok,true);assert.equal(calls.length,2);assert.equal(cp.completed.length,2);
});
test('failed verification stops handoff and persists spend without advancing',async()=>{
 const calls=[];let cp;
 const r=await R.executeSteps(work,{runStep:runner(calls),verifyStep:async()=>({ok:false}),saveCheckpoint:async x=>{cp=x;}});
 assert.equal(r.ok,false);assert.equal(calls.length,1);assert.equal(cp.completed.length,0);assert.equal(cp.tokens,50);
});
test('checkpoint mismatch and persistence failure stop execution',async()=>{
 const calls=[];
 await assert.rejects(R.executeSteps(work,{checkpoint:{version:1,digest:'wrong',completed:[],tokens:0,cost:0},runStep:runner(calls),verifyStep,saveCheckpoint:async()=>{}}),/checkpoint/);
 assert.equal(calls.length,0);
 await assert.rejects(R.executeSteps(work,{runStep:runner(calls),verifyStep,saveCheckpoint:async()=>{throw Error('disk full');}}),/disk full/);
 assert.equal(calls.length,1);
});
test('all failed and successful attempt costs survive checkpoint budget enforcement',async()=>{
 let cp;let calls=0;
 const r=await R.executeSteps(work,{maxTokens:80,verifyStep,saveCheckpoint:async x=>{cp=x;},
 runStep:async()=>{calls++;return {ok:true,text:'result',tokens:30,cost:0.01,attempts:[{tokens:60,cost:0.02},{tokens:30,cost:0.01}]};}});
 assert.equal(r.checkpointed,true);assert.equal(calls,1);assert.equal(cp.tokens,90);assert.equal(cp.cost,0.03);
});
test('resumed completed work requires nonempty verification evidence',async()=>{
 let cp;
 await R.executeSteps(work,{maxTokens:50,runStep:runner([]),verifyStep,saveCheckpoint:async x=>{cp=x;}});
 cp.completed[0].evidence='';
 await assert.rejects(R.executeSteps(work,{checkpoint:cp,runStep:runner([]),verifyStep,saveCheckpoint:async()=>{}}),/checkpoint/);
});
test('work units clear stale driver pin and single-rung execution context',async()=>{
 await R.executeSteps(work,{single:true,pinProvider:'expensive',pinModel:'premium',verifyStep,saveCheckpoint:async()=>{},
 runStep:async(task,prompt,ctx)=>{assert.equal(ctx.single,false);assert.equal(ctx.pinProvider,undefined);assert.equal(ctx.pinModel,undefined);return {ok:true,text:'ok',tokens:0,cost:0};}});
});
test('candidate model outcomes outrank unrelated provider model outcomes',()=>{
 fs.writeFileSync(env.COUNCIL_HISTORY_PATH,JSON.stringify({kinds:{general:{
 'expensive/premium':{ok:9,fail:1},'expensive/mechanical':{ok:0,fail:1000},
 'efficient/frontier':{ok:1,fail:1},'efficient/small':{ok:1000,fail:0}
 }}}));
 try {assert.equal(R.route({priority:1}).ladder[0].model,'premium');}
 finally {fs.rmSync(env.COUNCIL_HISTORY_PATH,{force:true});}
});
