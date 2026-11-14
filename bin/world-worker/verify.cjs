#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createBroker, launchIsolated } = require('./transport.cjs');
const noJail = process.argv.includes('--no-jail');
let checks = 0;
function ok(value, label) { assert(value, label); checks++; console.log(`PASS ${label}`); }
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'BJDSVWE-'));
  const calls = [];
  const third = http.createServer((_req, res) => res.end('third host reachable'));
  const world = http.createServer((req, res) => {
    calls.push({ kind: 'world', path: req.url, auth: req.headers.authorization });
    req.resume(); res.end(JSON.stringify({ ok: true }));
  });
  let redirect = false;
  const secret = require('node:crypto').randomBytes(24).toString('hex');
  const modelBodies = [];
  let holdModel = false;
  const model = http.createServer((req, res) => {
    calls.push({ kind: 'model', path: req.url, auth: req.headers.authorization });
    let body = ''; req.on('data', x => body += x); req.on('end', () => modelBodies.push(body));
    if (holdModel) return;
    if (redirect) res.writeHead(302, { location: `http://127.0.0.1:${third.address().port}` }).end();
    else res.end(JSON.stringify({ response: '{"actions":[{"type":"rest"}]}' }));
  });
  let broker;
  try {
    await Promise.all([listen(third), listen(world), listen(model)]);
    const origin = s => `http://127.0.0.1:${s.address().port}`;
    const control = await fetch(origin(third));
    ok(await control.text() === 'third host reachable', 'outside namespace SAME third host connects');
    const socketPath = path.join(dir, 'broker.sock');
    broker = await createBroker({ socketPath, citizenId: 'citizen_test', worldOrigin: origin(world),
      modelOrigin: origin(model), modelAuthorization: `Bearer ${secret}`, timeoutMs: 500, maxBytes: 4096 });
    console.log('ALLOWLIST ' + broker.allowlist.join(', '));
    const request = (method, url, body = '') => new Promise((resolve, reject) => {
      const req = http.request({ socketPath, method, path: url, agent: false, headers: { authorization: 'attacker', 'content-type': 'application/json' } }, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode));
      }); req.on('error', reject); req.end(body);
    });
    for (const [method, url] of [
      ['GET', '/api/agent/other/observation'], ['POST', '/api/agent/other/actions'],
      ['GET', '/api/agent/citizen_test/observation?target=http://evil'],
      ['GET', origin(third)], ['POST', '/model/generate/../admin'],
      ['CONNECT', '127.0.0.1:80'], ['GET', '/api/agent/citizen_test/%6fbservation'],
    ]) {
      if (method === 'CONNECT') {
        const status = await new Promise((resolve, reject) => {
          const req = http.request({ socketPath, method, path: url });
          req.on('connect', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
          req.on('error', reject); req.end();
        }); ok(status === 403, 'CONNECT refused');
      } else ok(await request(method, url) === 403, `${method} ${url} refused`);
    }
    ok(calls.length === 0, 'rejected requests never reach either upstream');
    const upgradeStatus = await new Promise((resolve, reject) => {
      const req = http.request({ socketPath, path: '/api/agent/citizen_test/observation',
        headers: { connection: 'Upgrade', upgrade: 'websocket' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    ok(upgradeStatus === 403, 'protocol upgrade refused');
    const workerFile = path.join(dir, 'worker.cjs');
    fs.writeFileSync(workerFile, `
      const http=require('node:http'),net=require('node:net'),fs=require('node:fs');
      const socketPath=process.argv[3]||'/run/broker.sock';
      const req=(method,path,body='')=>new Promise((resolve,reject)=>{
        const r=http.request({socketPath,method,path},s=>{let b='';s.on('data',x=>b+=x);s.on('end',()=>resolve({status:s.statusCode,body:b}));});r.on('error',reject);r.end(body);
      });
      (async()=>{
        const direct=await new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port:Number(process.argv[2])});s.setTimeout(500);s.on('connect',()=>{s.destroy();resolve('connected')});s.on('error',e=>resolve(e.code));s.on('timeout',()=>{s.destroy();resolve('timeout')});});
        const obs=await req('GET','/api/agent/citizen_test/observation');
        const action=await req('POST','/api/agent/citizen_test/actions','{"actions":[{"type":"rest"}]}');
        const model=await req('POST','/model/generate','{"prompt":"citizen prompt"}');
        console.log(JSON.stringify({direct,obs,action,model,env:Object.keys(process.env),home:fs.existsSync('/home/vinta'),ns:fs.readlinkSync('/proc/self/ns/net')}));
      })().catch(e=>{console.error(e);process.exitCode=1});
    `);
    const child = noJail ? spawn(process.execPath, [workerFile, String(third.address().port), socketPath], { env: {}, stdio: ['ignore', 'pipe', 'pipe'] }) :
      launchIsolated({ workerFile, socketPath, args: [String(third.address().port)] });
    let stdout = '', stderr = '';
    child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
    ok(code === 0, `worker exits cleanly (${stderr})`);
    const result = JSON.parse(stdout);
    ok(['ENETUNREACH', 'ECONNREFUSED', 'EHOSTUNREACH'].includes(result.direct), `network-layer third host refusal: ${result.direct}`);
    ok(result.ns !== fs.readlinkSync('/proc/self/ns/net'), 'worker network namespace differs from controller');
    ok(result.obs.status === 200 && result.action.status === 200 && result.model.status === 200, 'both allowed upstreams reachable through bridge');
    ok(result.env.every(k => k === 'PWD') && !result.home, 'worker environment contains only bwrap PWD and no host home mount');
    ok(!stdout.includes(secret), 'synthetic credential absent from worker replies');
    ok(calls.filter(c => c.kind === 'world').every(c => !c.auth), 'world receives no model/client authorization');
    ok(calls.find(c => c.kind === 'model').auth === `Bearer ${secret}`, 'only model request receives broker credential');
    ok(modelBodies.every(b => !b.includes(secret)), 'model prompt/body does not contain credential');
    redirect = true;
    ok(await request('POST', '/model/generate', '{}') === 502, 'upstream redirect rejected');
    ok(await request('POST', '/model/generate', JSON.stringify({ prompt: 'x'.repeat(5000) })) === 413, 'oversized request body refused');
    redirect = false; holdModel = true;
    const started = new Promise(resolve => model.once('request', resolve));
    const held = request('POST', '/model/generate', '{}');
    await started;
    ok(await request('GET', '/api/agent/citizen_test/observation') === 429, 'second simultaneous request refused');
    ok(await held === 504, 'unresponsive model reaches absolute deadline');
    console.log(`${checks}/${checks} pass; prerequisite only, production mind remains in-process`);
  } finally {
    if (broker) await broker.close();
    await Promise.all([close(third), close(world), close(model)]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(`FAIL after ${checks} checks: ${e.stack}`); process.exitCode = 1; });
