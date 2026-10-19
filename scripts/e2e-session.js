#!/usr/bin/env node
/*
 * e2e-session.js — the agents' signed-in lane for Vintinuum E2E audits (task ADQTUU9).
 *
 * Mints a REAL session for the dedicated NON-OWNER test account
 * (e2e-agent@vintinuum.test, users.id 85, tier=free) so a puppeteer harness can
 * load any card signed-in, instead of stubbing auth in a route harness.
 *
 * Credentials come only through vintkey (audited, policy rule "test:vintinuum-e2e:*"):
 *   test:vintinuum-e2e:email / :password   — the login pair (never printed)
 *   test:vintinuum-e2e:refresh / :access   — the last minted session, written back here
 *
 * /api/auth/refresh ROTATES (the old refresh row is deleted on use), so the newest
 * refresh token is always written back to vintkey. Refresh is tried first; the
 * password login (rate-limited 25/15min + lockout) is the fallback.
 *
 * Module:  const { getSession, seedPage } = require('./scripts/e2e-session.js');
 *          const s = await getSession();            // { accessToken, refreshToken, user }
 *          await seedPage(page, s);                 // before page.goto(): sets every token key
 * CLI:     node scripts/e2e-session.js [--api http://localhost:8767]   → prints user/tier/exp only
 */
'use strict';
const { execFileSync } = require('child_process');
const VINTKEY = '/home/vinta/.claude/council-loop/bin/vintkey';
const NS = 'test:vintinuum-e2e:';

function kget(name) {
  try { return execFileSync(VINTKEY, ['get', NS + name], { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); }
  catch { return ''; }
}
function kset(name, value) {
  execFileSync(VINTKEY, ['set', NS + name], { input: value, stdio: ['pipe', 'ignore', 'ignore'] });
}

async function post(api, path, body) {
  const r = await fetch(api + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

async function getSession(opts = {}) {
  const api = (opts.api || process.env.VINT_API || 'http://localhost:8767').replace(/\/$/, '');
  let s = null;
  const rt = kget('refresh');
  if (rt) {
    const r = await post(api, '/api/auth/refresh', { refreshToken: rt });
    if (r.status === 200 && r.body.accessToken) s = r.body;
  }
  if (!s) {
    const email = kget('email'), password = kget('password');
    if (!email || !password) throw new Error('vintkey has no test:vintinuum-e2e:email/password (policy or vault problem)');
    const r = await post(api, '/api/auth/login', { email, password });
    if (r.status !== 200 || !r.body.accessToken) throw new Error(`login failed: HTTP ${r.status} ${r.body.error || ''}`);
    s = r.body;
  }
  kset('access', s.accessToken);
  kset('refresh', s.refreshToken);
  const claims = JSON.parse(Buffer.from(s.accessToken.split('.')[1], 'base64url').toString());
  if (claims.tier === 'owner' || claims.sub === 1) throw new Error('refusing: minted session is the OWNER, not the test account');
  return { accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user || { id: claims.sub, email: claims.email, tier: claims.tier }, exp: claims.exp };
}

// Every token key the frontend reads (vint_token, vint_access_token, soul_auth_token).
async function seedPage(page, s) {
  await page.evaluateOnNewDocument((a, r) => {
    for (const k of ['vint_token', 'vint_access_token', 'soul_auth_token']) localStorage.setItem(k, a);
    for (const k of ['vint_refresh_token', 'vint_refresh', 'soul_auth_refresh']) localStorage.setItem(k, r);
  }, s.accessToken, s.refreshToken);
}

module.exports = { getSession, seedPage };

if (require.main === module) {
  const i = process.argv.indexOf('--api');
  getSession({ api: i > 0 ? process.argv[i + 1] : undefined }).then(s => {
    console.log(`ok user=${s.user.id} email=${s.user.email} tier=${s.user.tier} access_exp=${new Date(s.exp * 1000).toISOString()}`);
  }).catch(e => { console.error('e2e-session:', e.message); process.exit(1); });
}
