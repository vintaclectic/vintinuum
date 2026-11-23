'use strict';
// P8 composition of the P2–P6 contracts. This module deliberately exports ONLY
// an isolated local fixture server; it cannot mount a hosted onboarding route.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const COUNCIL = '/home/vinta/.claude/council-loop/lib';
const A = require(`${COUNCIL}/tenant-auth`);
const { TenantBoard, TenantBoardRoot, TenantJournal } = require(`${COUNCIL}/tenant-board`);
const { TenantCredentialBroker } = require(`${COUNCIL}/tenant-cred-broker`);
const { TenantRouter } = require(`${COUNCIL}/tenant-router`);
const { TenantPackRegistry } = require(`${COUNCIL}/council-pack`);
const COOKIE = 'owner_fixture_session';
const PROVIDERS = ['openai', 'anthropic'];
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
function fields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) throw fail(400, 'BAD_INPUT', 'Unsupported request fields.');
}
function text(value, max) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw fail(400, 'BAD_INPUT', 'Missing or oversized text.'); return value.trim(); }
function removeScratch(root) {
  // Imported version directories are deliberately read-only. Only our newly
  // created fixture root is made writable for teardown; never follow links.
  function writable(dir) { fs.chmodSync(dir, 0o700); for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) writable(path.join(dir, e.name)); }
  writable(root); fs.rmSync(root, { recursive: true, force: true });
}
async function readBody(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'JSON_REQUIRED', 'Send JSON.');
  let size = 0; const chunks = [];
  for await (const b of req) { size += b.length; if (size > 2900000) throw fail(413, 'UPLOAD_LIMIT', 'Package exceeds the 2 MiB archive limit.'); chunks.push(b); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'BAD_JSON', 'Invalid JSON.'); }
}
function createFixture({ hosted = false, frontendRoot = null, labels = {} } = {}) {
  if (hosted !== false || A.HOSTED_ADMISSION_ENABLED) throw new A.AdmissionDisabledError();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-p8-'));
  const stateRoot = path.join(scratch, 'state');
  fs.mkdirSync(stateRoot, { mode: 0o700 });
  const memberships = new A.MembershipStore(); const sessions = new A.SessionStore();
  const resolver = new A.ContextResolver({ sessions, memberships });
  const identity = new A.TestIdentityAdapter({ hosted: false, sessions });
  const broker = new TenantCredentialBroker({ stateRoot, secretStore: path.join(scratch, 'keys'), memberships });
  const router = new TenantRouter({ broker, memberships, defaults: { ceilingMicros: 1000000, allowedProviders: PROVIDERS } });
  const boardRoot = new TenantBoardRoot({ rootDir: stateRoot });
  const accounts = new Map();
  for (const account of ['alice', 'bob']) {
    const tenantId = memberships.createTenant({ kind: 'fixture' }); const actorId = `usr_${account}`;
    memberships.addMember(tenantId, actorId, ['owner']);
    accounts.set(account, { tenantId, actorId, label: labels[account] || `${account === 'alice' ? 'Alice' : 'Bob'}'s workspace` });
  }
  function createSession(account) {
    const owner = accounts.get(account); if (!owner) throw new Error('Unknown fixture account');
    const s = identity.login(owner.actorId);
    return { ...s, ...owner, cookieName: COOKIE, cookie: `${COOKIE}=${s.sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=900` };
  }
  function context(sessionId, method = 'GET', csrfToken, selector) {
    const session = sessions.get(sessionId); if (!session) throw fail(401, 'SESSION_REQUIRED', 'Sign in to your workspace.');
    const account = [...accounts.values()].find(a => a.actorId === session.userId);
    if (!account) throw fail(401, 'SESSION_REQUIRED', 'Sign in to your workspace.');
    // A client selector never grants authority. Ordinary UI does not send one.
    const ctx = resolver.resolve({ sessionId, tenantId: selector || account.tenantId, method, csrfToken });
    if (!ctx.hasRole('owner')) throw fail(403, 'OWNER_REQUIRED', 'Owner access required.');
    return ctx;
  }
  const registry = ctx => new TenantPackRegistry(ctx, { stateRoot });
  function packages(ctx) {
    const r = registry(ctx);
    return r.listVersions().map(v => {
      const rec = r.resolvePinned({ tenantId: ctx.tenantId, digest: v.digest });
      let active = false; try { active = r.pinForRun({ packageName: rec.package.name }).digest === rec.digest; } catch (e) { if (e.code !== 'E_PACK_NOT_ACTIVE') throw e; }
      return { digest: rec.digest, name: rec.package.name, version: rec.package.version, requestedCapabilities: rec.requestedCapabilities,
        approvedCapabilities: v.grantedCapabilities || [], approvalState: v.approvalState, active, files: rec.fileList, warnings: rec.warnings, agents: rec.agents.map(a => ({ id: a.id })) };
    });
  }
  function connected(ctx) { return PROVIDERS.filter(p => broker.has(ctx, `provider:${p}`, { agentDigest: 'owner_inventory' })); }
  function refreshPolicy(ctx, providers) {
    const digests = packages(ctx).filter(p => p.active).map(p => p.digest);
    broker.policyFor(ctx).write({ default: 'deny', rules: providers.map(p => ({ match: `provider:${p}`, effect: 'allow', purposes: ['inventory', `route:${p}`], agentDigests: ['owner_inventory', ...digests] })) });
    // owner_inventory cannot be used in a grant: broker grants require a
    // SHA-256 digest. Only active package digests are executable.
  }
  function taskViews(ctx) {
    const b = new TenantBoard(ctx, boardRoot);
    return b.list().map(t => ({ id: t.id, title: t.title, detail: t.detail, status: t.status }));
  }
  const pins = new Map();
  async function dispatch(req, url) {
    const sid = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const ctx = context(sid, req.method, req.headers['x-csrf-token'], req.headers['x-tenant-id']);
    const r = registry(ctx); const route = url.pathname; const method = req.method;
    if (method === 'GET' && route === '/api/owner/session') return { tenantLabel: [...accounts.values()].find(x => x.tenantId === ctx.tenantId).label, tenantId: ctx.tenantId, csrfToken: sessions.csrfFor(sid), providerConnected: connected(ctx).length > 0, providers: connected(ctx), hostedAdmissionEnabled: false, fixture: true };
    if (method === 'GET' && route === '/api/owner/packages') return { packages: packages(ctx) };
    if (method === 'GET' && route === '/api/owner/tasks') return { tasks: taskViews(ctx) };
    if (method === 'GET' && route === '/api/owner/costs') {
      const report = router.ledger(ctx).report();
      return { knownMicros: report.reduce((s, x) => s + Number(x.known_micros), 0), unknownCount: report.reduce((s, x) => s + Number(x.unknown_events), 0), currency: 'USD', fixture: true };
    }
    if (method !== 'POST') throw fail(404, 'NOT_FOUND', 'Not found.');
    const body = await readBody(req);
    if (route === '/api/owner/provider') {
      fields(body, ['provider', 'secret']); if (!PROVIDERS.includes(body.provider)) throw fail(400, 'PROVIDER_UNSUPPORTED', 'Choose a supported provider.');
      const secret = text(body.secret, 4096); const providers = connected(ctx);
      broker.set(ctx, `provider:${body.provider}`, secret);
      refreshPolicy(ctx, [...new Set([...providers, body.provider])]);
      return { connected: true, provider: body.provider, verifiedWithProvider: false, fixture: true };
    }
    if (route === '/api/owner/packages') {
      fields(body, ['archiveBase64']);
      if (typeof body.archiveBase64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.archiveBase64)) throw fail(400, 'BAD_ARCHIVE', 'Invalid archive encoding.');
      const archive = Buffer.from(body.archiveBase64, 'base64'); if (!archive.length || archive.length > 2097152) throw fail(413, 'UPLOAD_LIMIT', 'Archive must be between 1 byte and 2 MiB.');
      const record = r.importArchive(archive);
      return { package: packages(ctx).find(p => p.digest === record.digest), digest: record.digest };
    }
    if (route === '/api/owner/packages/approve') {
      fields(body, ['digest', 'capabilities']);
      if (!Array.isArray(body.capabilities) || body.capabilities.some(x => typeof x !== 'string')) throw fail(400, 'BAD_INPUT', 'Select a list of permissions.');
      r.approve(text(body.digest, 64), body.capabilities); return { packages: packages(ctx) };
    }
    if (route === '/api/owner/packages/activate') {
      fields(body, ['digest']); r.activate(text(body.digest, 64)); refreshPolicy(ctx, connected(ctx)); return { packages: packages(ctx) };
    }
    if (route === '/api/owner/tasks') {
      fields(body, ['title', 'detail', 'agentId']); const title = text(body.title, 500); const detail = text(body.detail, 20000);
      if (!connected(ctx).length) throw fail(409, 'PROVIDER_REQUIRED', 'Connect your provider first.');
      const agents = packages(ctx).filter(p => p.active).flatMap(p => p.agents.map(a => ({ ...a, packageName: p.name })));
      const chosen = body.agentId ? agents.find(a => a.id === body.agentId) : agents.length === 1 ? agents[0] : null;
      if (!chosen) throw fail(409, 'AGENT_REQUIRED', 'Activate a package with one agent, or choose an agent.');
      const runId = 'run_' + crypto.randomBytes(12).toString('hex'); const pin = r.pinForRun({ packageName: chosen.packageName, runId });
      const b = new TenantBoard(ctx, boardRoot); const id = b.create({ title, detail });
      pins.set(`${ctx.tenantId}:${id}`, { ...pin, agentId: chosen.id });
      new TenantJournal(ctx, boardRoot).logWork({ task_id: id, phase: 'created', agent_ref: { packageName: pin.package, digest: pin.digest, agentId: chosen.id }, run_id: runId });
      return { task: taskViews(ctx).find(t => t.id === id), assignedAgent: { digest: pin.digest, agentId: chosen.id } };
    }
    if (route === '/api/owner/logout') { fields(body, []); sessions.revoke(sid); return { loggedOut: true }; }
    throw fail(404, 'NOT_FOUND', 'Not found.');
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      if (req.socket.remoteAddress !== '127.0.0.1') throw fail(403, 'LOCAL_ONLY', 'Only local fixture requests are allowed.');
      const address = server.address(); const expectedHost = `127.0.0.1:${address.port}`;
      if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== `http://${expectedHost}`)) throw fail(403, 'ORIGIN_DENIED', 'Only this local fixture origin is allowed.');
      const url = new URL(req.url, `http://${expectedHost}`);
      if (url.pathname.startsWith('/api/owner/')) {
        const result = await dispatch(req, url); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result)); return;
      }
      const assets = { '/': 'tenant-onboarding.html', '/tenant-onboarding.html': 'tenant-onboarding.html', '/body/tenant-onboarding/owner.js': 'body/tenant-onboarding/owner.js', '/body/tenant-onboarding/owner.css': 'body/tenant-onboarding/owner.css' };
      if (req.method === 'GET' && frontendRoot && assets[url.pathname]) {
        const filename = assets[url.pathname]; res.setHeader('Content-Type', filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html');
        res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
        res.end(fs.readFileSync(path.join(frontendRoot, filename))); return;
      }
      throw fail(404, 'NOT_FOUND', 'Not found.');
    } catch (e) {
      // Never expose broker errors, raw filesystem paths, SQL or uploaded text.
      const code = e.code || 'INTERNAL_ERROR';
      const status = e.status || (/AUTH|GRANT|OWNER/.test(code) ? 403 : /NOT_FOUND|MISSING_VERSION|CROSS_TENANT/.test(code) ? 404 : /^E_PACK|^E_ZIP/.test(code) ? 400 : 500);
      res.statusCode = status; res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: status === 500 ? 'INTERNAL_ERROR' : code, message: status === 500 ? 'The request could not be completed. Retry or reconnect your session.' : e.status ? e.message : 'The requested action was refused. Check your package, permissions or session.' } }));
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  return {
    server, scratch, createSession,
    async listen() { await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${server.address().port}`; },
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); removeScratch(scratch); },
    // Trusted in-process test controls, deliberately absent from HTTP routes.
    revoke(account) { const a = accounts.get(account); memberships.revokeMember(a.tenantId, a.actorId); },
    async mockAttempt(sessionId, taskId, { costMicros = 17, costKnown = true } = {}) {
      const ctx = context(sessionId); const pin = pins.get(`${ctx.tenantId}:${taskId}`);
      if (!pin) throw fail(404, 'NOT_FOUND', 'Not found.');
      registry(ctx).resolvePinned(pin); const provider = connected(ctx)[0];
      return router.attempt(ctx, [{ provider, model: 'fixture-model' }], { runId: pin.runId, taskId, agentDigest: pin.digest, estimateMicros: 100, execute: async ({ grant, router: rt }) => rt.routeHTTP(ctx, grant, async secret => {
        if (typeof secret !== 'string' || !secret) throw new Error('Fixture credential missing');
        return { usage: { costKnown, costMicros, taskId }, fixture: true };
      }) });
    },
  };
}
module.exports = { createFixture, COOKIE };
