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
  const resume=fixture({env:{AGENT_ID:'helios-sec10',VINTASK_ID:'2MH3CNU'},response:{ok:true,connected:true}});
  await resume.CMDS.resume();
  check('resume posts to the owner-gated resume route',()=>{assert.equal(resume.requests[1].path,'/api/browser/relay/resume');assert.equal(resume.requests[1].method,'POST');});
  check('resume uses the owner JWT, never a master key',()=>{assert.equal(resume.requests[1].headers.Authorization,'Bearer fixture-jwt');assert.ok(!/X-Master-Key/i.test(JSON.stringify(resume.requests)));});
  await assert.rejects(fixture({response:{ok:false,error:'nope'}}).CMDS.resume(),/EXIT 5/);passes++;console.log('PASS resume failure fails closed');
  check('client never reads the relay or master secret',()=>assert.ok(!/env\.(VINTA_MASTER_KEY|RELAY_AUTH_TOKEN)|['"]X-Master-Key/i.test(src)));

  const watchdog=fs.readFileSync(path.join(__dirname,'relay-watchdog.sh'),'utf8');
  check('watchdog cannot restart obsolete local brain',()=>assert.ok(!/pm2 restart|VINTA_MASTER_KEY|RELAY_AUTH_TOKEN/.test(watchdog)));
  check('watchdog repairs the windows relay itself',()=>assert.ok(/start\.bat/.test(watchdog)&&/relay_healthy/.test(watchdog)));
  check('watchdog rate-limits relay launches',()=>assert.ok(/RELAY_LAUNCH_COOLDOWN_S=\d+/.test(watchdog)&&/inside launch cooldown/.test(watchdog)));
  check('watchdog ensures the ssh channel every run',()=>assert.ok(/browser-relay-tunnel\.sh" ensure/.test(watchdog)));
  check('watchdog forces a resume when the brain cannot see the relay',()=>assert.ok(/vb resume/.test(watchdog)));
  check('watchdog writes a heartbeat so cron coverage is observable',()=>assert.ok(/relay-watchdog\.heartbeat/.test(watchdog)));

  const tunnel=fs.readFileSync(path.join(__dirname,'browser-relay-tunnel.sh'),'utf8');
  check('tunnel forwards both directions on loopback only',()=>{
    assert.ok(/FORWARD_L="127\.0\.0\.1:\$\{LOCAL_BRAIN_PORT\}:127\.0\.0\.1:\$\{BRAIN_PORT\}"/.test(tunnel));
    assert.ok(/FORWARD_R="127\.0\.0\.1:\$\{RELAY_PORT\}:127\.0\.0\.1:\$\{RELAY_PORT\}"/.test(tunnel));
    assert.ok(!/0\.0\.0\.0/.test(tunnel) && !/GatewayPorts yes/.test(tunnel));
  });
  check('tunnel refuses to accept an unknown host key',()=>assert.ok(/StrictHostKeyChecking=yes/.test(tunnel)&&!/StrictHostKeyChecking=no/.test(tunnel)));
  check('tunnel dies rather than start without its forwards',()=>assert.ok(/ExitOnForwardFailure=yes/.test(tunnel)));
  check('tunnel detects a half-dead link',()=>assert.ok(/ServerAliveInterval=15/.test(tunnel)&&/ServerAliveCountMax=3/.test(tunnel)));
  check('tunnel needs no sudo and no systemd unit',()=>assert.ok(!/^\s*(sudo|systemctl)\b/m.test(tunnel)));
  check('tunnel ensure is idempotent on a healthy link',()=>assert.ok(/if healthy; then return 0; fi/.test(tunnel)));
  check('tunnel health is judged by function, not process visibility',()=>assert.ok(/healthy\(\) \{ port_listening && brain_answers; \}/.test(tunnel)));
  check('watchdog rebuilds a half-dead channel when resume does not take',()=>assert.ok(/browser-relay-tunnel\.sh" start/.test(watchdog)));
  check('tunnel retries once past a stale remote forward',()=>assert.ok(/retrying once/.test(tunnel)));
  check('tunnel takes the brain host from the migration marker',()=>assert.ok(/brain-remote/.test(tunnel)));

  const installer=fs.readFileSync(path.join(__dirname,'install.sh'),'utf8');
  check('installer ships the tunnel supervisor with the client',()=>assert.ok(/browser-relay-tunnel\.sh/.test(installer)));
  check('installer backs up what it replaces',()=>assert.ok(/before-2MH3CNU/.test(installer)));
  console.log(`${passes}/${passes} pass`);
})().catch(e=>{console.error(e);process.exitCode=1;});
