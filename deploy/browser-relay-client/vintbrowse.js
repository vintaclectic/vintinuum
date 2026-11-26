#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   vintbrowse — DRIVE VINTA'S REAL LOGGED-IN BROWSER, AUDITED
   helios-sec10, 2026-09-16, task R72N2DV.

   WHY THIS SHAPE. There is already a good browser stack: a Playwright relay on
   the Windows host, a hardened WSL client (browser-relay.js), a payload
   validator and rate limiter (browser-relay-security.js), and an audit table.
   Building a second browser path would double the attack surface and halve the
   scrutiny. So this tool writes NO automation of its own — it is a thin,
   authenticated, audited CLI in front of the endpoints that already exist.

   THE ACCESS CHAIN, end to end:
     vintbrowse → POST /api/council/auth (loopback + COUNCIL_AGENT_TOKEN)
                → 15-minute owner JWT
                → POST /api/browser/relay/command (requireAuth + rate limit
                  + payload validation)
                → WebSocket to the Windows Playwright relay
                → Vinta's real Chromium, with his real cookies and sessions.

   THAT LAST LINK IS THE WHOLE POINT AND THE WHOLE RISK. The browser is logged
   into Vinta's accounts. An agent driving it inherits those sessions — which is
   exactly what makes "go register for a dev account and grab the API key"
   possible, and exactly why every command lands in browser_relay_audit.

   --login IS THE IMPORTANT SUBCOMMAND. It pulls a site credential pair from the
   vault through the SAME policy check vintkey enforces, and sends it straight
   into FILL_FORM. The password travels vault → relay → page. The agent's own
   context never contains it, so it cannot be echoed into a transcript, a log, or
   the training corpus.

   THREAT MODEL, HONESTLY. PROTECTS: unaudited browser use, agents holding site
   passwords in their context, remote use of the council token. DOES NOT PROTECT:
   an agent that is already behaving badly from doing something harmful in a
   logged-in session — the relay's action allowlist and the audit trail bound and
   record that, they do not prevent it. `exec` (EXECUTE_SCRIPT) is the sharpest
   edge here and is gated behind an explicit --i-know flag for that reason.
   ════════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const API_DIR = '/home/vinta/vintinuum-api';
const COUNCIL_ROOT = path.join(require('os').homedir(), '.claude', 'council-loop');

// Load the council token from whichever .env carries it.
//
// Deliberately hand-rolled rather than `require('dotenv')`: council-loop has no
// node_modules, and an agent may invoke this tool from ANY cwd, so a dependency
// here would resolve or fail depending on where the caller happened to stand.
// A credential tool must not be that fragile. Real env always wins over a file.
function loadEnvFile(p) {
  let txt;
  try { txt = fs.readFileSync(p, 'utf8'); } catch (_) { return; }
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;                      // comments and blanks
    if (process.env[m[1]] !== undefined) continue;  // exported env wins
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}
loadEnvFile(path.join(COUNCIL_ROOT, '.env'));
loadEnvFile(path.join(API_DIR, '.env'));

// Remote brain auth remains loopback-only through the SSH local forward.
const BRAIN = process.env.BRAIN_URL || (fs.existsSync(path.join(require('os').homedir(), '.vintinuum', 'brain-remote'))
  ? 'http://127.0.0.1:18767' : 'http://127.0.0.1:8767');
const brainUrl = new URL(BRAIN);
if (brainUrl.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(brainUrl.hostname)) {
  throw new Error('BRAIN_URL must be a loopback HTTP endpoint; use the SSH brain forward');
}

const AGENT_ID = process.env.AGENT_ID || 'unknown';
const TASK_ID = process.env.VINTASK_ID || null;

const say = (...a) => process.stderr.write(a.join(' ') + '\n');
const die = (m, c = 1) => { say('vintbrowse: ' + m); process.exit(c); };

// Audit records are written by the authenticated brain BEFORE relay dispatch.
// Never write the obsolete PC database or log raw form payloads here.
// ── HTTP ─────────────────────────────────────────────────────────────────────
function request(method, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BRAIN);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
      }, headers || {}),
      timeout: 130000,
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(out); } catch (_) { parsed = { raw: out.slice(0, 400) }; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('request timed out')); });
    if (data) req.write(data);
    req.end();
  });
}

let _token = null;
async function auth() {
  if (_token) return _token;
  const tok = process.env.COUNCIL_AGENT_TOKEN;
  if (!tok) die('COUNCIL_AGENT_TOKEN is not set in ~/.claude/council-loop/.env or ' + API_DIR + '/.env', 2);
  const r = await request('POST', '/api/council/auth', { agent_id: AGENT_ID },
    { 'X-Council-Token': tok, 'X-Agent-Id': AGENT_ID });
  if (r.status !== 200 || !r.body || !r.body.accessToken) {
    die('council auth failed (HTTP ' + r.status + '): ' + JSON.stringify(r.body).slice(0, 300) +
        '\n  If this says the lane is missing, the brain needs a restart to load council-auth.js.', 2);
  }
  _token = r.body.accessToken;
  return _token;
}

async function relay(action, payload, timeout) {
  const t = await auth();
  const r = await request('POST', '/api/browser/relay/command',
    { action, payload: payload || {}, timeout: timeout || 30000 },
    { Authorization: 'Bearer ' + t, 'X-Agent-Id': AGENT_ID, 'X-Task-Id': TASK_ID || '' });
  const ok = r.status === 200 && r.body && r.body.ok && r.body.auditLogged === true;
  if (!ok) {
    die('relay ' + action + ' failed (HTTP ' + r.status + '): ' +
        ((r.body && (r.body.error || JSON.stringify(r.body))) || 'unknown').toString().slice(0, 400), 5);
  }
  return r.body.result;
}

function out(v) {
  process.stdout.write((typeof v === 'string' ? v : JSON.stringify(v, null, 2)) + '\n');
}

// ── Commands ─────────────────────────────────────────────────────────────────
const CMDS = {};

CMDS.status = async function () {
  const t = await auth();
  const r = await request('GET', '/api/browser/relay/status', null, { Authorization: 'Bearer ' + t, 'X-Agent-Id': AGENT_ID, 'X-Task-Id': TASK_ID || '' });
  if (r.status !== 200) die('status failed (HTTP ' + r.status + '): ' + JSON.stringify(r.body).slice(0, 300), 5);
  out(r.body);
  if (!r.body.connected) {
    say('');
    say('  RELAY NOT CONNECTED. The Windows relay may be down, or the brain may have');
    say('  lost the PC-to-brain SSH tunnel. Check browser-relay-tunnel.service.');
    say('  Fix:  bash ~/.claude/council-loop/bin/relay-watchdog.sh');
  }
};

CMDS.goto = async function (args) {
  const url = args[0];
  if (!url) die('usage: vintbrowse goto <url>');
  if (!/^https?:\/\//i.test(url)) die('url must start with http:// or https:// (the relay validator enforces this too)');
  out(await relay('OPEN_URL', { url }, 60000));
};

CMDS.click = async function (args) {
  const sel = args[0];
  if (!sel) die('usage: vintbrowse click <selector>');
  out(await relay('CLICK', { selector: sel }));
};

CMDS.fill = async function (args) {
  const sel = args[0];
  if (!sel) die('usage: echo -n "value" | vintbrowse fill <selector>');
  if (process.stdin.isTTY) die('the value must arrive on stdin, never argv:  echo -n "v" | vintbrowse fill ' + sel);
  const value = fs.readFileSync(0, 'utf8').replace(/\n$/, '');
  if (!value) die('empty value on stdin');
  // FILL_FORM is the relay's verified handler name (FILL_LOGIN does not exist).
  out(await relay('FILL_FORM', { fields: { [sel]: value } }));
};

CMDS.text = async function (args) {
  const sel = args[0];
  if (!sel) die('usage: vintbrowse text <selector>');
  out(await relay('EXTRACT_DATA', { selector: sel }));
};

CMDS.read = async function () {
  out(await relay('READ_PAGE', {}, 45000));
};

CMDS.tabs = async function () { out(await relay('LIST_TABS', {})); };

CMDS.screenshot = async function (args) {
  const dest = args.find(a => !a.startsWith('--'));
  const t = await auth();
  const r = await request('POST', '/api/browser/relay/screenshot',
    { fullPage: args.includes('--full') }, { Authorization: 'Bearer ' + t, 'X-Agent-Id': AGENT_ID, 'X-Task-Id': TASK_ID || '' });
  const ok = r.status === 200 && r.body && r.body.ok && r.body.auditLogged === true;
  if (!ok) die('screenshot failed (HTTP ' + r.status + '): ' + JSON.stringify(r.body).slice(0, 300), 5);
  const file = dest || path.join('/tmp', 'vintbrowse-' + Date.now() + '.png');
  fs.writeFileSync(file, Buffer.from(r.body.base64, 'base64'));
  out(file);
};

CMDS.exec = async function (args) {
  // EXECUTE_SCRIPT is in the relay's SENSITIVE_ACTIONS set. Arbitrary JS in a
  // logged-in browser can read any page the session can reach, so it does not
  // run by accident — the agent must say it means it.
  if (!args.includes('--i-know')) {
    die('EXECUTE_SCRIPT runs arbitrary JS inside a browser logged into Vinta\'s accounts.\n' +
        '  Prefer `text`, `read`, `click` or `fill`. If you genuinely need it, re-run with --i-know.\n' +
        '  Either way the call is recorded in browser_relay_audit.', 6);
  }
  const script = args.filter(a => a !== '--i-know').join(' ');
  if (!script) die('usage: vintbrowse exec --i-know "<js>"');
  out(await relay('EXECUTE_SCRIPT', { script }, 45000));
};

CMDS.login = async function (args) {
  // vintbrowse login <site> [--user-sel S] [--pass-sel S] [--submit-sel S]
  const site = args.find(a => !a.startsWith('--'));
  if (!site) die('usage: vintbrowse login <site>\n' +
    '  Expects vault entries "site:<site>:user" and "site:<site>:pass".\n' +
    '  Store them with:  echo -n "VALUE" | vintkey set site:<site>:pass');

  const argOf = (flag, dflt) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
  };
  const userSel = argOf('--user-sel', 'input[type="email"], input[name="username"], input[name="email"]');
  const passSel = argOf('--pass-sel', 'input[type="password"]');
  const submitSel = argOf('--submit-sel', null);

  // Go through vintkey so ONE policy engine and ONE credential ledger govern
  // every credential read in the system. Duplicating the policy check here is
  // how the two copies eventually disagree and a deny silently becomes an allow.
  const vintkey = path.join(COUNCIL_ROOT, 'bin', 'vintkey.js');
  let user, pass;
  try {
    user = execFileSync('node', [vintkey, 'get', `site:${site}:user`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
    pass = execFileSync('node', [vintkey, 'get', `site:${site}:pass`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  } catch (e) {
    die('could not read site credentials for "' + site + '" (see the denial above).', 3);
  }
  if (!user || !pass) die('vault has no usable credentials for site:' + site, 5);

  const fields = { [userSel]: user, [passSel]: pass };
  // The brain records safe metadata only, never form values.
  const t = await auth();
  const r = await request('POST', '/api/browser/relay/command',
    { action: 'FILL_FORM', payload: { fields }, timeout: 45000 },
    { Authorization: 'Bearer ' + t, 'X-Agent-Id': AGENT_ID, 'X-Task-Id': TASK_ID || '' });
  const ok = r.status === 200 && r.body && r.body.ok && r.body.auditLogged === true;
  if (!ok) die('login fill failed (HTTP ' + r.status + '): ' + JSON.stringify(r.body).slice(0, 300), 5);
  say('vintbrowse: filled credentials for "' + site + '" (values never entered this process\'s output)');

  if (submitSel) out(await relay('CLICK', { selector: submitSel }));
  else say('vintbrowse: no --submit-sel given; click the submit control yourself when ready.');
};

// Force the brain to retry the relay now instead of waiting out its backoff.
// Owner JWT only — an agent never handles VINTA_MASTER_KEY (2MH3CNU).
CMDS.resume = async function () {
  const t = await auth();
  const r = await request('POST', '/api/browser/relay/resume', {},
    { Authorization: 'Bearer ' + t, 'X-Agent-Id': AGENT_ID, 'X-Task-Id': TASK_ID || '' });
  if (r.status !== 200 || !r.body || r.body.ok !== true) {
    die('resume failed (HTTP ' + r.status + '): ' + JSON.stringify(r.body).slice(0, 300), 5);
  }
  out(r.body);
};

CMDS.audit = async function (args) {
  const n = parseInt(args[0] || '20', 10);
  const t = await auth();
  const limit = Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : 20;
  const r = await request('GET', '/api/browser/relay/audit?limit=' + limit, null,
    { Authorization: 'Bearer ' + t });
  if (r.status !== 200) die('could not read brain audit ledger (HTTP ' + r.status + ')', 5);
  out(r.body.rows);
};

CMDS.help = function () {
  say(`vintbrowse — drive Vinta's real logged-in browser, audited (agent: ${AGENT_ID})

  vintbrowse status                    relay connection state
  vintbrowse goto <url>                navigate
  vintbrowse read                      full page text/state
  vintbrowse text <selector>           extract matching content
  vintbrowse click <selector>          click
  echo -n "v" | vintbrowse fill <sel>  type a value (stdin, never argv)
  vintbrowse screenshot [file] [--full]
  vintbrowse tabs                      list open tabs
  vintbrowse login <site> [--user-sel S] [--pass-sel S] [--submit-sel S]
                                       vault → page. The password never enters
                                       this process's output or your context.
  vintbrowse exec --i-know "<js>"      arbitrary JS (SENSITIVE — logged)
  vintbrowse audit [n]                 recent browser audit rows
  vintbrowse resume                    force the brain to reconnect the relay now

  Auth: loopback-only COUNCIL_AGENT_TOKEN → 15-minute owner JWT.
  Every command writes a row to browser_relay_audit.`);
};

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === '-h' || cmd === '--help') { CMDS.help(); process.exit(cmd ? 0 : 1); }
  if (!CMDS[cmd]) { say('vintbrowse: unknown command "' + cmd + '"'); CMDS.help(); process.exit(1); }
  // CAPABILITY GATE (task 826C38V): every browser action asks the one engine
  // whether THIS agent may use the browser (and reach the network) before a
  // single byte goes to the relay. Denials exit 3 with the rule that fired and
  // are recorded in agent_cred_audit. `help`/`audit` are read-only; audit requires an owner JWT.
  if (cmd !== 'audit' && cmd !== 'help') {
    require(path.join(COUNCIL_ROOT, 'lib', 'capabilities.js'))
      .enforce(['status', 'resume'].includes(cmd) ? ['browser'] : ['browser', 'network'], { action: cmd }, 'vintbrowse');
  }
  try {
    await CMDS[cmd](rest);
  } catch (e) {
    die((e && e.message) || String(e), 1);
  }
})();
