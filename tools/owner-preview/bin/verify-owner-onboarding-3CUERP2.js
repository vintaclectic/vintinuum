#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { createFixture, COOKIE } = require('../lib/owner-onboarding');
const { crc32 } = require('/home/vinta/.claude/council-loop/lib/council-pack-zip');
function pack({ name = 'research-council', content = 'Research carefully.', capabilities = ['workspace.read'] } = {}) {
  const files = { 'agents/researcher.md': content, 'skills/notes/SKILL.md': '# Notes\nKeep accurate notes.' };
  const manifest = { schemaVersion: 1, package: { name, version: '1.0.0' }, agents: [{ id: 'researcher', entry: 'agents/researcher.md', skills: ['notes'], requestedCapabilities: capabilities }], skills: [{ id: 'notes', entry: 'skills/notes/SKILL.md' }], files: Object.entries(files).map(([path, data]) => ({ path, sha256: crypto.createHash('sha256').update(data).digest('hex') })), origin: { kind: 'user', license: 'LicenseRef-Private' } };
  files['manifest.json'] = JSON.stringify(manifest);
  const locals = []; const central = []; let offset = 0;
  for (const [file, data] of Object.entries(files)) {
    const name = Buffer.from(file); const raw = Buffer.from(data); const crc = crc32(raw);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50); l.writeUInt16LE(20, 4); l.writeUInt32LE(crc, 14); l.writeUInt32LE(raw.length, 18); l.writeUInt32LE(raw.length, 22); l.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(0x314, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(raw.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE((0o100644 << 16) >>> 0, 38); c.writeUInt32LE(offset, 42);
    locals.push(l, name, raw); central.push(c, name); offset += l.length + name.length + raw.length;
  }
  const cb = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(3, 8); end.writeUInt16LE(3, 10); end.writeUInt32LE(cb.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cb, end]);
}
async function verify() {
  let passed = 0;
  const secretA = crypto.randomBytes(24).toString('hex');
  const secretB = crypto.randomBytes(24).toString('hex');
  function check(name, fn) { fn(); passed++; process.stdout.write(`PASS ${name}\n`); }
  check('hosted fixture construction refused', () => assert.throws(() => createFixture({ hosted: true }), /admission/));
  const fixture = createFixture(); const base = await fixture.listen();
  const a = fixture.createSession('alice'), b = fixture.createSession('bob');
  async function req(account, route, body, extra = {}) {
    const headers = { ...(account ? { Cookie: `${COOKIE}=${account.sessionId}` } : {}), ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': account?.csrf || '' } : {}), ...extra };
    const response = await fetch(base + '/api/owner/' + route, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json() };
  }
  try {
    check('listener bound only to loopback', () => assert.equal(fixture.server.address().address, '127.0.0.1'));
    let x = await req(null, 'session'); check('unauthenticated request denied', () => assert.equal(x.status, 401));
    x = await req(a, 'session'); check('owner session, csrf and admission state', () => { assert.equal(x.status, 200); assert.equal(x.data.csrfToken, a.csrf); assert.equal(x.data.hostedAdmissionEnabled, false); assert.equal(x.data.providerConnected, false); });
    x = await req(a, 'session', null, { 'X-Tenant-Id': b.tenantId }); check('forged tenant selector denied', () => assert.equal(x.status, 403));
    x = await req(a, 'session', null, { Origin: 'https://evil.example' }); check('cross-origin read denied', () => assert.equal(x.status, 403));
    const hostStatus = await new Promise(resolve => { require('node:http').get(base + '/api/owner/session', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); }); check('DNS rebinding Host denied', () => assert.equal(hostStatus, 403));
    for (const route of ['tasks', 'packages', 'costs']) { x = await req(a, route); check(`empty ${route} works`, () => { assert.equal(x.status, 200); if (route === 'costs') assert.equal(x.data.knownMicros, 0); else assert.equal(x.data[route].length, 0); }); }
    x = await req(a, 'provider', { provider: 'openai', secret: secretA }, { 'X-CSRF-Token': '' }); check('missing csrf denies mutation', () => assert.equal(x.status, 403));
    x = await req(a, 'provider', { provider: 'openai', secret: secretA }, { 'X-CSRF-Token': b.csrf }); check('other session csrf denies mutation', () => assert.equal(x.status, 403));
    x = await req(a, 'provider', { provider: 'openai', secret: secretA, roles: ['owner'] }); check('body authority injection rejected', () => assert.equal(x.status, 400));
    x = await req(a, 'tasks', { title: 'No provider', detail: 'Must refuse' }); check('task without provider refused', () => assert.equal(x.data.error.code, 'PROVIDER_REQUIRED'));
    x = await req(a, 'provider', { provider: 'openai', secret: secretA }); check('own credential saved without reflection', () => { assert.equal(x.status, 200); assert(!JSON.stringify(x).includes(secretA)); });
    x = await req(b, 'session'); check('A credential does not connect B', () => assert.equal(x.data.providerConnected, false));
    x = await req(a, 'tasks', { title: 'No active package', detail: 'Must refuse' }); check('task without active package refused', () => assert.equal(x.data.error.code, 'AGENT_REQUIRED'));
    x = await req(a, 'packages', { archiveBase64: Buffer.from('not a zip').toString('base64') }); check('invalid archive rejected', () => assert.equal(x.status, 400));
    x = await req(a, 'packages', { archiveBase64: pack().toString('base64') }); const digestA = x.data.digest;
    check('own agent and skill package imports pending', () => { assert.equal(x.status, 200, JSON.stringify(x)); assert.equal(x.data.package.active, false); assert.deepEqual(x.data.package.approvedCapabilities, []); assert.equal(x.data.package.files.length, 3); });
    x = await req(a, 'packages/activate', { digest: digestA }); check('unapproved activation denied', () => assert.equal(x.status, 400));
    x = await req(b, 'packages/approve', { digest: digestA, capabilities: ['workspace.read'] }); check('B cannot approve A package', () => assert.equal(x.status, 404));
    x = await req(a, 'packages/approve', { digest: digestA, capabilities: ['shell.exec'] }); check('overprivilege approval refused', () => assert.equal(x.status, 400));
    x = await req(a, 'packages/approve', { digest: digestA, capabilities: [] }); check('least privilege zero-grant approval accepted', () => { assert.equal(x.status, 200); assert.deepEqual(x.data.packages[0].approvedCapabilities, []); });
    x = await req(a, 'packages/activate', { digest: digestA }); check('explicit approved activation succeeds', () => { assert.equal(x.status, 200); assert.equal(x.data.packages[0].active, true); });
    x = await req(a, 'tasks', { title: 'A private task', detail: 'Only Alice should see this.' }); const taskA = x.data.task?.id;
    check('task uses activated immutable digest', () => { assert.equal(x.status, 200, JSON.stringify(x)); assert.equal(x.data.assignedAgent.digest, digestA); });
    x = await req(b, 'tasks'); check('B cannot list A tasks', () => assert.deepEqual(x.data.tasks, []));
    x = await req(b, 'packages'); check('B cannot list A packages', () => assert.deepEqual(x.data.packages, []));
    await req(b, 'provider', { provider: 'openai', secret: secretB });
    x = await req(b, 'packages', { archiveBase64: pack({ content: 'B private agent text.' }).toString('base64') }); const digestB = x.data.digest;
    check('same package and agent names are tenant-local', () => { assert.equal(x.status, 200); assert.notEqual(digestA, digestB); });
    await req(b, 'packages/approve', { digest: digestB, capabilities: ['workspace.read'] });
    await req(b, 'packages/activate', { digest: digestB });
    x = await req(b, 'tasks', { title: 'B private task', detail: 'Only Bob should see this.' }); const taskB = x.data.task?.id;
    check('B creates own task', () => assert.equal(x.status, 200, JSON.stringify(x)));
    await fixture.mockAttempt(a.sessionId, taskA, { costMicros: 17 });
    await fixture.mockAttempt(b.sessionId, taskB, { costKnown: false });
    x = await req(a, 'costs'); check('A sees only A known cost', () => { assert.equal(x.data.knownMicros, 17); assert.equal(x.data.unknownCount, 0); });
    x = await req(b, 'costs'); check('B unknown usage remains unknown, excludes A spend', () => { assert.equal(x.data.knownMicros, 0); assert.equal(x.data.unknownCount, 1); });
    await assert.rejects(fixture.mockAttempt(b.sessionId, taskA), e => e.status === 404); check('B cannot dispatch A pinned task', () => {});
    x = await req(a, 'tasks'); check('A sees no B task text', () => { assert.equal(x.data.tasks.length, 1); assert.equal(x.data.tasks[0].title, 'A private task'); });
    x = await req(a, 'logout', {}); check('logout succeeds', () => assert.equal(x.status, 200));
    x = await req(a, 'session'); check('revoked session cannot read', () => assert.equal(x.status, 401));
    fixture.revoke('bob'); x = await req(b, 'tasks'); check('revoked membership cannot read', () => assert.equal(x.status, 403));
  } finally { const scratch = fixture.scratch; await fixture.close(); check('fixture storage removed', () => assert.equal(fs.existsSync(scratch), false)); }
  console.log(`owner onboarding: ${passed}/${passed} pass`);
}
if (require.main === module) verify().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { pack, verify };
