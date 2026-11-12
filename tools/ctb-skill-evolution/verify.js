#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, 'engine.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctb-skill-evolution-'));
const root = path.join(tmp, 'council-loop');
const state = path.join(root, 'state');
const agents = path.join(tmp, 'agents');
const tasksFile = path.join(state, 'tasks.jsonl');
const skillsFile = path.join(state, 'skills.json');
const skillsLib = path.join(root, 'lib', 'skills.js');
const vintask = path.join(root, 'bin', 'vintask.js');
fs.mkdirSync(path.dirname(skillsLib), { recursive: true });
fs.mkdirSync(path.dirname(vintask), { recursive: true });
fs.mkdirSync(agents, { recursive: true });

let pass = 0;
function ok(value, message) {
  if (!value) throw new Error(message);
  pass++;
}
function writeJson(p, value) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(value, null, 2)); }
function writeTasks(tasks) { fs.writeFileSync(tasksFile, tasks.map(x => JSON.stringify(x)).join('\n') + '\n'); }
function readTasks() { return fs.readFileSync(tasksFile, 'utf8').trim().split('\n').map(JSON.parse); }

fs.writeFileSync(skillsLib, `
const fs=require('fs');
const file=process.env.VINTASK_SKILLS_FILE;
function readSkills(){try{return JSON.parse(fs.readFileSync(file,'utf8')).skills||[]}catch{return []}}
function addSkill(s){const skills=readSkills();const hit=skills.find(x=>x.slug===s.slug);if(hit)return {ok:true,skill:hit,merged:true};skills.push({...s,origin:'forged',uses:0});fs.writeFileSync(file,JSON.stringify({skills},null,2));return {ok:true,skill:s,merged:false}}
module.exports={readSkills,addSkill};
`);
fs.writeFileSync(vintask, `#!/usr/bin/env node
const fs=require('fs');const f=process.env.CTB_TASKS_FILE;const a=process.argv.slice(2);if(a[0]!=='update')process.exit(2);const rows=fs.readFileSync(f,'utf8').trim().split('\\n').map(JSON.parse);const t=rows.find(x=>x.id===a[1]);const i=a.indexOf('--skill-add');if(!t||i<0)process.exit(3);t.skills=[...new Set([...(t.skills||[]),...a[i+1].split(',')])];fs.writeFileSync(f,rows.map(JSON.stringify).join('\\n')+'\\n');console.log('updated');
`);
fs.chmodSync(vintask, 0o755);
fs.writeFileSync(path.join(agents, 'existing-security.md'), '---\nname: existing-security\ndescription: Own authentication authorization tokens webhook security and credential hardening.\n---\n');
writeJson(skillsFile, { skills: [{ slug: 'security-hardening', name: 'Security Hardening', summary: 'Auth webhook and credential safety', cues: ['auth', 'webhook', 'token', 'credential'], directives: ['verify auth'], agents: ['existing-security'] }] });

let seq = 0;
function task(fields) {
  seq++;
  return { id: `T${seq}`, project: fields.project || 'MediaLab', title: fields.title, detail: fields.detail || '', acceptance: fields.acceptance || '', status: fields.status || 'blocked', blocked_reason: fields.blocked_reason || '', attempts: fields.attempts == null ? 2 : fields.attempts, created_at: Date.now() - (100000 - seq), updated_at: Date.now() - (100000 - seq), skills: [], ...fields };
}

const base = [
  task({ title: 'Repair subtitle drift in ffmpeg transcodes', acceptance: 'subtitle cue timing stays within 50ms after transcode', blocked_reason: 'unable to preserve subtitle cue timing' }),
  task({ title: 'Fix ffmpeg subtitle cue timing on long videos', acceptance: 'subtitle cue timing measured within 50ms', blocked_reason: 'capability gap in subtitle timestamp normalization' }),
  task({ title: 'Normalize subtitle drift after ffmpeg remux', acceptance: 'subtitle timestamps remain synchronized', blocked_reason: 'could not normalize subtitle timestamps' }),
  task({ project: 'Payments', title: 'Secure auth webhook token validation', acceptance: 'invalid webhook token rejected', blocked_reason: 'webhook auth token invalid' }),
  task({ project: 'Payments', title: 'Harden webhook auth credential verification', acceptance: 'forged webhook rejected', blocked_reason: 'credential validation missing' }),
  task({ project: 'Payments', title: 'Verify auth token on payment webhook', acceptance: 'token checked before mutation', status: 'done', blocked_reason: '', attempts: 1 }),
  task({ id: 'NEW1', title: 'Prevent subtitle timestamp drift in ffmpeg export', status: 'todo', blocked_reason: '', attempts: 0, acceptance: 'subtitle timing measured', created_at: Date.now(), updated_at: Date.now() }),
];
writeTasks(base);

const env = { ...process.env, CTB_ROOT: root, CTB_EVOLUTION_STATE: path.join(state, 'skill-evolution'), CTB_TASKS_FILE: tasksFile, VINTASK_SKILLS_FILE: skillsFile, CTB_SKILLS_LIB: skillsLib, CTB_AGENTS_DIR: agents, CTB_VINTASK: vintask };
function run(...args) {
  const r = spawnSync(process.execPath, [ENGINE, ...args], { env, encoding: 'utf8', timeout: 15000 });
  if (r.status !== 0) throw new Error(`engine ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  return JSON.parse(r.stdout);
}

const dry = run('sweep', '--dry-run');
ok(dry.created.length === 1, 'dry run should propose exactly one evolved skill');
ok(!fs.existsSync(path.join(state, 'skill-evolution', 'model.json')), 'dry run must not mutate evolution state');

const first = run('sweep');
ok(first.created.length === 1, 'first sweep should create one skill');
const slug = first.created[0].slug;
ok(/^evolved-/.test(slug), 'generated skill needs evolved namespace');
ok(first.candidates.some(x => x.project === 'Payments' && x.decision === 'route-existing-skill'), 'existing security skill must win instead of duplicate creation');
ok(first.routed.some(x => x.task_id === 'NEW1' && x.attached.includes(slug)), 'matching todo task must be routed automatically');
const skillPath = path.join(state, 'skill-evolution', 'generated-skills', slug, 'SKILL.md');
const skillText = fs.readFileSync(skillPath, 'utf8');
ok(skillText.includes('Source tasks:'), 'SKILL.md must record task provenance');
ok(!/TODO|TBD|placeholder/i.test(skillText), 'SKILL.md must contain no unfinished scaffold text');
const quickValidator = path.join(process.env.HOME || '', '.codex', 'skills', '.system', 'skill-creator', 'scripts', 'quick_validate.py');
ok(fs.existsSync(quickValidator), 'bundled skill-creator quick_validate.py must be available');
const qv = spawnSync('python3', [quickValidator, path.dirname(skillPath)], { encoding: 'utf8', timeout: 30000 });
ok(qv.status === 0, `bundled quick_validate must accept generated skill: ${qv.stdout || qv.stderr}`);
ok(readTasks().find(x => x.id === 'NEW1').skills.includes(slug), 'routing must persist through vintask --skill-add');

const second = run('sweep');
ok(second.created.length === 0, 'repeat sweep must be idempotent');
ok(second.routed.length === 0, 'repeat sweep must not duplicate attachments');

// A stable procedure can crystallize without failure: repeated proven successes
// are learning signal too, unless an installed skill/agent already covers them.
const proc = [];
for (let i = 0; i < 5; i++) proc.push(task({ project: 'ArchiveLab', title: `Reconcile parquet shard manifest batch ${i}`, status: 'done', attempts: 1, blocked_reason: '', acceptance: 'manifest row counts and shard hashes match', proof: 'node verify-manifest.js -> all shard hashes matched' }));
writeTasks(readTasks().concat(proc));
const procedureSweep = run('sweep');
ok(procedureSweep.created.some(x => /manifest|parquet|shard/.test(x.slug)), 'five proven successes should crystallize a reusable procedure');
ok(procedureSweep.created.length <= 2, 'one sweep must never create more than two skills');

// Feed five failed routed outcomes back through the loop. Each new matching todo
// routes first, then becomes blocked; the fifth observation must quarantine.
for (let i = 0; i < 5; i++) {
  const rows = readTasks();
  const id = i === 0 ? 'NEW1' : `NEW${i + 1}`;
  if (i > 0) rows.push(task({ id, title: `Subtitle ffmpeg timestamp drift case ${i}`, status: 'todo', attempts: 0, blocked_reason: '', acceptance: 'subtitle timing measured' }));
  writeTasks(rows);
  run('sweep');
  const afterRoute = readTasks();
  const routed = afterRoute.find(x => x.id === id);
  ok(routed.skills.includes(slug), `feedback task ${id} should route before outcome`);
  routed.status = 'blocked'; routed.attempts = 2; routed.blocked_reason = 'could not preserve subtitle timestamps'; routed.updated_at = Date.now();
  writeTasks(afterRoute);
  run('sweep');
}
const stat = run('status');
const evolved = stat.generated.find(x => x.slug === slug);
ok(evolved.quarantined === true, 'five failed routed outcomes must quarantine automatic routing');
ok(evolved.failures === 5 && evolved.successes === 0, 'feedback metrics must reflect terminal outcomes exactly once');
const audit = fs.readFileSync(path.join(state, 'skill-evolution', 'audit.jsonl'), 'utf8');
ok(audit.includes('skill-created') && audit.includes('task-routed') && audit.includes('skill-quarantined'), 'audit must cover creation, routing, and rollback');

console.log(`CTB skill evolution verifier: ${pass}/${pass} checks passed`);
