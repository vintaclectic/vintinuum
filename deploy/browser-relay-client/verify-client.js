'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const src = fs.readFileSync(path.join(__dirname, 'vintbrowse.js'), 'utf8').split('// ── main ')[0];
let passes = 0;
function check(name, fn) { fn(); passes++; console.log('PASS ' + name); }
function fixture({ remote = true, env = {}, response = { ok:true, auditLogged:true, result:'page' } } = {}) {
  const requests = [], output = [];
  const sandbox = {
    URL, Buffer, console,
    process: { env:{ COUNCIL_AGENT_TOKEN:'fixture-only', ...env }, stderr:{ write:s=>output.push(s) }, stdout:{write:s=>output.push(s)}, exit:n=>{throw Error('EXIT '+n);} },
    require: name => {
      if(name === 'fs') return {readFileSync:()=>{throw Error('no env');}, existsSync:()=>remote};
      if(name === 'os') return {homedir:()=>'/fixture'};
      if(name === 'http') return { request:(options, callback)=> {
        requests.push(options);
        const req = new EventEmitter(); req.write = () => {}; req.destroy = () => {};
        req.end = () => {const res=new EventEmitter();res.statusCode=200;callback(res);const body=options.path.includes('/council/auth')?{accessToken:'fixture-jwt'}:response;res.emit('data',JSON.stringify(body));res.emit('end');};
        return req;
      }};
      if(name === 'child_process') return {execFileSync:()=>{throw Error('local process unexpectedly called');}};
      return require(name);
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(src+'\nglobalThis.api = { BRAIN, relay, CMDS };', sandbox);
  return { ...sandbox.api, requests, output };
}
(async()=>{
  check('remote marker chooses SSH local forward',()=>assert.equal(fixture().BRAIN,'http://127.0.0.1:18767'));
  check('local brain retains 8767',()=>assert.equal(fixture({remote:false}).BRAIN,'http://127.0.0.1:8767'));
  check('explicit loopback override wins',()=>assert.equal(fixture({env:{BRAIN_URL:'http://127.0.0.1:12345'}}).BRAIN,'http://127.0.0.1:12345'));
  for(const url of ['http://2.29.194.240:8767','https://example.com','file:///tmp/brain']) check('reject credential transport '+url,()=>assert.throws(()=>fixture({env:{BRAIN_URL:url}}),/loopback/));
  const good=fixture({env:{AGENT_ID:'helios-sec10',VINTASK_ID:'2MH3CNU'}});
  assert.equal(await good.relay('READ_PAGE',{}),'page'); passes++; console.log('PASS audited command result');
  check('council token only goes to auth',()=>{assert.equal(good.requests[0].headers['X-Council-Token'],'fixture-only');assert.equal(good.requests[1].headers['X-Council-Token'],undefined);});
  check('command carries JWT and task attribution',()=>{assert.equal(good.requests[1].headers.Authorization,'Bearer fixture-jwt');assert.equal(good.requests[1].headers['X-Task-Id'],'2MH3CNU');});
  await assert.rejects(fixture({response:{ok:true,result:'unaudited'}}).relay('READ_PAGE',{}),/EXIT 5/);passes++;console.log('PASS missing audit confirmation fails closed');
  const audit=fixture({response:{rows:[]}});await audit.CMDS.audit(['999']);
  check('audit reads bounded remote ledger',()=>assert.equal(audit.requests[1].path,'/api/browser/relay/audit?limit=100'));
  check('no local SQL writes or reads',()=>assert.ok(!/sqlite3|INSERT INTO|DB_FILE/.test(src)));
  const watchdog=fs.readFileSync(path.join(__dirname,'relay-watchdog.sh'),'utf8');
  check('watchdog cannot restart obsolete local brain',()=>assert.ok(!/pm2 restart|VINTA_MASTER_KEY|RELAY_AUTH_TOKEN/.test(watchdog)));
  console.log(`${passes}/${passes} pass`);
})().catch(e=>{console.error(e);process.exitCode=1;});
