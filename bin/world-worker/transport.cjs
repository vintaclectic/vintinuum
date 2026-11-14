'use strict';

// BJDSVWE prerequisite only: production citizen policy has NOT moved here.
// A worker gets two purpose-specific HTTP capabilities over one Unix socket.
// No general HTTP proxy, CONNECT tunnel, redirects, or upstream auth passthrough.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

async function createBroker({ socketPath, citizenId, worldOrigin, modelOrigin,
  modelAuthorization, timeoutMs = 3000, maxBytes = 1024 * 1024 }) {
  if (!/^[a-zA-Z0-9_-]+$/.test(citizenId)) throw new Error('invalid citizen id');
  const origins = [worldOrigin, modelOrigin].map(value => {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password ||
      u.pathname !== '/' || u.search || u.hash) throw new Error('origin required');
    return u;
  });
  const prefix = `/api/agent/${citizenId}`;
  const routes = new Map([
    [`GET ${prefix}/observation`, { origin: origins[0], path: `${prefix}/observation` }],
    [`POST ${prefix}/actions`, { origin: origins[0], path: `${prefix}/actions` }],
    ['POST /model/generate', { origin: origins[1], path: '/api/generate', model: true }],
  ]);
  let inFlight = 0;
  const server = http.createServer((req, res) => {
    const route = routes.get(`${req.method} ${req.url}`);
    if (!route) { res.writeHead(403).end(); req.resume(); return; }
    if (inFlight) { res.writeHead(429).end(); req.resume(); return; }
    inFlight++;
    res.once('close', () => { inFlight--; });
    let requestBytes = 0;
    const chunks = [];
    let upstream;
    const fail = status => { if (!res.writableEnded) res.writeHead(status).end(); upstream?.destroy(); };
    // Absolute deadline includes slow request bodies and upstream response time.
    const timer = setTimeout(() => { fail(504); req.destroy(); }, timeoutMs);
    res.on('close', () => { clearTimeout(timer); upstream?.destroy(); });
    req.on('error', () => fail(400));
    req.on('data', chunk => {
      requestBytes += chunk.length;
      if (requestBytes > maxBytes) { fail(413); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      if (req.method === 'GET' && requestBytes) { fail(400); return; }
      const body = Buffer.concat(chunks);
      if (req.method === 'POST') {
        try { JSON.parse(body.toString()); } catch (_) { fail(400); return; }
      }
      const headers = { 'content-type': 'application/json', 'content-length': body.length };
      if (route.model && modelAuthorization) headers.authorization = modelAuthorization;
      upstream = (route.origin.protocol === 'https:' ? https : http).request({
        protocol: route.origin.protocol, hostname: route.origin.hostname,
        port: route.origin.port, path: route.path, method: req.method, headers,
        agent: false,
      }, reply => {
        if (reply.statusCode >= 300 && reply.statusCode < 400) { reply.resume(); fail(502); return; }
        const response = []; let bytes = 0;
        reply.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > maxBytes) { fail(502); return; }
          response.push(chunk);
        });
        reply.on('error', () => fail(502));
        reply.on('end', () => {
          if (!res.writableEnded) res.writeHead(reply.statusCode, {
            'content-type': 'application/json', 'cache-control': 'no-store',
          }).end(Buffer.concat(response));
        });
      });
      upstream.on('error', () => fail(502));
      upstream.end(body);
    });
  });
  server.maxConnections = 4;
  server.on('connect', (_req, socket) => socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'));
  server.on('upgrade', (_req, socket) => socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
  fs.chmodSync(socketPath, 0o600);
  return {
    allowlist: [origins[0].origin, origins[1].origin],
    close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }),
  };
}

function launchIsolated({ workerFile, socketPath, args = [], timeoutMs = 5000 }) {
  // Mount only the worker file, not its source tree, database, home or secrets.
  const argv = ['--die-with-parent', '--new-session', '--unshare-all', '--clearenv',
    '--ro-bind', '/usr', '/usr', '--ro-bind', '/lib', '/lib',
    '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--chdir', '/',
    '--dir', '/run', '--dir', '/worker'];
  if (fs.existsSync('/lib64')) argv.push('--ro-bind', '/lib64', '/lib64');
  argv.push('--ro-bind', path.resolve(workerFile), '/worker/main.cjs',
    '--ro-bind', path.resolve(socketPath), '/run/broker.sock',
    '--', '/usr/bin/node', '/worker/main.cjs', ...args);
  const child = spawn('/usr/bin/bwrap', argv, { env: {}, stdio: ['ignore', 'pipe', 'pipe'] });
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  child.once('exit', () => clearTimeout(timer));
  child.once('error', () => clearTimeout(timer));
  return child;
}

module.exports = { createBroker, launchIsolated };
