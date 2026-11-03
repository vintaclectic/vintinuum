#!/usr/bin/env node
'use strict';

/*
 * CTB SKILL EVOLUTION
 * Learns recurring capability gaps from durable task outcomes, creates validated
 * SKILL.md artifacts, registers them with CTB, and attaches them to future todo
 * cards. The loop is deterministic and offline: every decision cites task ids.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HOME = process.env.HOME || '';
const ROOT = process.env.CTB_ROOT || path.join(HOME, '.claude', 'council-loop');
const STATE = process.env.CTB_EVOLUTION_STATE || path.join(ROOT, 'state', 'skill-evolution');
const TASKS = process.env.CTB_TASKS_FILE || path.join(ROOT, 'state', 'tasks.jsonl');
const SKILLS_FILE = process.env.VINTASK_SKILLS_FILE || path.join(ROOT, 'state', 'skills.json');
const SKILLS_LIB = process.env.CTB_SKILLS_LIB || path.join(ROOT, 'lib', 'skills.js');
const AGENTS = process.env.CTB_AGENTS_DIR || path.join(HOME, '.claude', 'agents');
const VINTASK = process.env.CTB_VINTASK || path.join(ROOT, 'bin', 'vintask.js');
const GENERATED = path.join(STATE, 'generated-skills');
const MODEL = path.join(STATE, 'model.json');
const AUDIT = path.join(STATE, 'audit.jsonl');
const LOCK = path.join(STATE, '.lock');

const CONFIG = Object.freeze({
  version: 1,
  minClusterTasks: 3,
  minGapEvents: 2,
  clusterSimilarity: 0.20,
  existingSkillFloor: 0.34,
  existingAgentFloor: 0.42,
  routeFloor: 0.28,
  cooldownMs: 14 * 24 * 60 * 60 * 1000,
  quarantineAfter: 5,
  quarantineSuccessFloor: 0.40,
  maxCreatesPerSweep: 2,
  maxCreatesPerWeek: 4,
  createCooldownMs: 6 * 60 * 60 * 1000,
  staleLockMs: 30 * 60 * 1000,
  maxTaskAgeMs: 365 * 24 * 60 * 60 * 1000,
});

const STOP = new Set((`the a an and or for from into with without this that these those
  i we you want need needs make made build create add fix system feature task work new
  all any our your their its via such when where what which how why then than still
  current currently more most very just should would could must can will done doing
  project acceptance detail council ctb card user users app page thing things`).split(/\s+/));

function now() { return Date.now(); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function writeAtomic(p, value) {
  ensureDir(path.dirname(p));
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  fs.renameSync(tmp, p);
}
function audit(type, data) {
  ensureDir(STATE);
  fs.appendFileSync(AUDIT, JSON.stringify({ at: now(), type, ...data }) + '\n');
}
function defaultModel() {
  return { version: CONFIG.version, last_sweep_at: 0, candidates: {}, generated: {}, outcomes: {}, routes: {}, creation_history: [] };
}
function loadModel() {
  const m = readJson(MODEL, defaultModel());
  return { ...defaultModel(), ...m, candidates: m.candidates || {}, generated: m.generated || {}, outcomes: m.outcomes || {}, routes: m.routes || {}, creation_history: m.creation_history || [] };
}
function saveModel(m) { m.version = CONFIG.version; writeAtomic(MODEL, m); }

function loadTasks(file = TASKS) {
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

function words(value) {
  const out = new Set();
  for (let w of String(value || '').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []) {
    w = w.replace(/(ing|edly|edly|ed|es|s)$/, '');
    if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) out.add(w);
  }
  return out;
}
function taskText(t) { return [t.title, t.detail, t.acceptance, t.blocked_reason, t.proof].filter(Boolean).join(' '); }
function taskTerms(t) { return words([t.title, t.detail, t.acceptance].filter(Boolean).join(' ')); }
function intersection(a, b) { let n = 0; for (const x of a) if (b.has(x)) n++; return n; }
function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  const hit = intersection(a, b);
  return hit / (a.size + b.size - hit);
}
function coverage(query, target) {
  if (!query.size || !target.size) return 0;
  return intersection(query, target) / Math.min(8, query.size);
}
function gapWeight(t) {
  let n = 0;
  if (t.status === 'blocked') n += 1;
  if ((t.attempts || 0) >= 2 || (t.crash_attempts || 0) >= 2 || (t.stall_attempts || 0) >= 2) n += 1;
  if (/capability exhausted|no (agent|skill)|gap|missing (tool|capability)|could not|unable to/i.test(String(t.blocked_reason || ''))) n += 1;
  return Math.min(2, n);
}
function settled(t) { return t.status === 'done' || t.status === 'blocked' || t.status === 'cancelled'; }

function loadSkills() {
  try {
    delete require.cache[require.resolve(SKILLS_LIB)];
    const lib = require(SKILLS_LIB);
    return { lib, skills: lib.readSkills(SKILLS_FILE) };
  } catch { return { lib: null, skills: [] }; }
}
function loadAgents() {
  let names = [];
  try { names = fs.readdirSync(AGENTS).filter(x => x.endsWith('.md')); } catch { return []; }
  return names.map(file => {
    const p = path.join(AGENTS, file);
    let text = '';
    try { text = fs.readFileSync(p, 'utf8').slice(0, 6000); } catch { /* ignore one unreadable agent */ }
    const name = file.replace(/\.md$/, '');
    const desc = (/^description:\s*(.+)$/m.exec(text) || [])[1] || '';
    return { name, terms: words(`${name} ${desc}`) };
  });
}

function eligibleTasks(tasks) {
  const cutoff = now() - CONFIG.maxTaskAgeMs;
  return tasks.filter(t => settled(t) && t.status !== 'cancelled' && (t.updated_at || t.created_at || now()) >= cutoff && taskTerms(t).size >= 2);
}

function clusterTasks(tasks) {
  const clusters = [];
  const ordered = [...tasks].sort((a, b) => (a.created_at || 0) - (b.created_at || 0) || String(a.id).localeCompare(String(b.id)));
  for (const task of ordered) {
    const terms = taskTerms(task);
    let best = null, bestScore = 0;
    for (const c of clusters) {
      if (String(c.project).toLowerCase() !== String(task.project || '').toLowerCase()) continue;
      const score = similarity(terms, c.terms);
      if (score > bestScore) { best = c; bestScore = score; }
    }
    if (!best || bestScore < CONFIG.clusterSimilarity) {
      clusters.push({ project: task.project || 'general', tasks: [task], terms: new Set(terms) });
    } else {
      best.tasks.push(task);
      for (const w of terms) best.terms.add(w);
    }
  }
  return clusters;
}

function rankedTerms(cluster) {
  const freq = new Map();
  for (const t of cluster.tasks) for (const w of taskTerms(t)) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0])).map(([w]) => w);
}
function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48); }
function candidateId(cluster, terms) { return slugify(`${cluster.project}-${terms.slice(0, 3).join('-')}`); }
function titleCase(s) { return s.replace(/(^|-)([a-z])/g, (_, p, c) => (p ? ' ' : '') + c.toUpperCase()); }

function matchExisting(cluster, skills, agents) {
  const q = cluster.terms;
  let skill = null;
  for (const s of skills) {
    const score = coverage(q, words([s.name, s.summary, ...(s.cues || [])].join(' ')));
    if (!skill || score > skill.score || (score === skill.score && s.slug < skill.slug)) skill = { slug: s.slug, name: s.name, score };
  }
  let agent = null;
  for (const a of agents) {
    const score = coverage(q, a.terms);
    if (!agent || score > agent.score || (score === agent.score && a.name < agent.name)) agent = { name: a.name, score };
  }
  return { skill, agent };
}

function assess(tasks, opts = {}) {
  const { skills } = opts.skills ? { skills: opts.skills } : loadSkills();
  const agents = opts.agents || loadAgents();
  return clusterTasks(eligibleTasks(tasks)).map(cluster => {
    const terms = rankedTerms(cluster);
    const gapEvents = cluster.tasks.reduce((n, t) => n + (gapWeight(t) > 0 ? 1 : 0), 0);
    const successfulProcedures = cluster.tasks.filter(t => t.status === 'done' && (String(t.proof || '').trim() || String(t.acceptance || '').trim())).length;
    const match = matchExisting(cluster, skills, agents);
    let decision = 'observe', reason = `needs ${CONFIG.minClusterTasks} related settled tasks and ${CONFIG.minGapEvents} gap outcomes`;
    if (cluster.tasks.length >= CONFIG.minClusterTasks && gapEvents >= CONFIG.minGapEvents) {
      if (match.skill && match.skill.score >= CONFIG.existingSkillFloor) {
        decision = 'route-existing-skill'; reason = `${match.skill.slug} covers ${(match.skill.score * 100).toFixed(0)}% of the cluster vocabulary`;
      } else if (match.agent && match.agent.score >= CONFIG.existingAgentFloor && gapEvents < cluster.tasks.length) {
        decision = 'route-existing-agent'; reason = `${match.agent.name} covers ${(match.agent.score * 100).toFixed(0)}% and the cluster has successful outcomes`;
      } else {
        decision = 'create-skill'; reason = `${gapEvents}/${cluster.tasks.length} related outcomes expose a repeated gap with no adequate existing skill`;
      }
    } else if (cluster.tasks.length >= 5 && successfulProcedures >= 4) {
      if (match.skill && match.skill.score >= CONFIG.existingSkillFloor) {
        decision = 'route-existing-skill'; reason = `${match.skill.slug} already captures the repeated successful procedure`;
      } else if (match.agent && match.agent.score >= CONFIG.existingAgentFloor) {
        decision = 'route-existing-agent'; reason = `${match.agent.name} already owns the repeated successful procedure`;
      } else {
        decision = 'create-skill'; reason = `${successfulProcedures}/${cluster.tasks.length} related tasks proved a repeatable procedure worth crystallizing`;
      }
    }
    return {
      id: candidateId(cluster, terms), project: cluster.project, terms: terms.slice(0, 12),
      task_ids: cluster.tasks.map(t => t.id), task_count: cluster.tasks.length, gap_events: gapEvents, successful_procedures: successfulProcedures,
      decision, reason, existing_skill: match.skill, existing_agent: match.agent,
      acceptance_samples: cluster.tasks.map(t => String(t.acceptance || '').trim()).filter(Boolean).slice(0, 3),
      failure_samples: cluster.tasks.map(t => String(t.blocked_reason || '').trim()).filter(Boolean).slice(0, 3),
    };
  }).sort((a, b) => b.gap_events - a.gap_events || b.task_count - a.task_count || a.id.localeCompare(b.id));
}

function skillSpec(candidate) {
  const core = candidate.terms.slice(0, 3);
  const slug = slugify(`evolved-${core.join('-')}`);
  const name = `${core.map(titleCase).join(' ')} Practice`;
  const ids = candidate.task_ids.join(', ');
  const acceptance = candidate.acceptance_samples[0] ? candidate.acceptance_samples[0].replace(/\s+/g, ' ').slice(0, 240) : '';
  const directives = [
    `Begin by inspecting the concrete ${candidate.project} implementation and the prior task evidence (${ids}); do not infer the current state from the card title alone.`,
    `Treat these recurring capability cues as the lane boundary: ${candidate.terms.slice(0, 8).join(', ')}. If the request falls outside them, do not broaden this skill.`,
    acceptance ? `Preserve the observed definition of done: ${acceptance}` : `Turn the card's acceptance into observable checks before editing, then name each check and its result.`,
    `When a run blocks, record the exact dependency or failed check on the task; this skill's routing fitness is recalculated from terminal outcomes.`,
  ];
  return {
    slug, name, icon: '🧬',
    summary: `Evolved from ${candidate.task_count} ${candidate.project} outcomes: ${core.join(', ')}.`.slice(0, 160),
    description: `Handle recurring ${candidate.project} work involving ${core.join(', ')}. Use when a task matches this observed lane; do not use for unrelated ${candidate.project} work.`,
    cues: candidate.terms.slice(0, 12), directives, agents: candidate.existing_agent && candidate.existing_agent.score > 0 ? [candidate.existing_agent.name] : [],
    origin: 'evolved', born_from: candidate.task_ids[0], candidate_id: candidate.id, task_ids: candidate.task_ids,
  };
}

function renderSkill(spec) {
  const list = xs => xs.map(x => `- ${x}`).join('\n');
  return `---\nname: ${spec.slug}\ndescription: ${spec.description}\n---\n\n# ${spec.name}\n\nThis skill was derived from observed Council Task Board outcomes, not invented from a single prompt.\n\n## Provenance\n\n- Candidate: \`${spec.candidate_id}\`\n- Source tasks: ${spec.task_ids.map(x => `\`${x}\``).join(', ')}\n- Created by: CTB skill-evolution v${CONFIG.version}\n\n## Workflow\n\n${list(spec.directives)}\n\n## Feedback\n\nThe evolution engine tracks routed task outcomes. After ${CONFIG.quarantineAfter} observed uses, success below ${Math.round(CONFIG.quarantineSuccessFloor * 100)}% quarantines automatic routing while preserving this file and its audit trail.\n`;
}

function validateSkill(spec, text) {
  const errors = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.slug) || spec.slug.length > 63) errors.push('invalid slug');
  if (!text.startsWith('---\nname: ') || !/\ndescription: .+\n---\n/.test(text)) errors.push('invalid frontmatter');
  if ((spec.directives || []).length < 3) errors.push('too few directives');
  if (/\b(TODO|TBD|placeholder)\b/i.test(text)) errors.push('unfinished placeholder');
  if (!spec.task_ids || spec.task_ids.length < CONFIG.minClusterTasks) errors.push('insufficient provenance');
  return { ok: errors.length === 0, errors };
}

function quickValidate(dir) {
  const validator = process.env.CTB_QUICK_VALIDATE || path.join(HOME, '.codex', 'skills', '.system', 'skill-creator', 'scripts', 'quick_validate.py');
  if (!fs.existsSync(validator)) return { ok: true, skipped: true, reason: 'bundled validator unavailable' };
  const py = process.env.PYTHON || 'python3';
  const r = spawnSync(py, [validator, dir], { encoding: 'utf8', timeout: 30000 });
  return { ok: r.status === 0, status: r.status, output: String(r.stdout || r.stderr || '').trim() };
}

function createSkill(candidate, model, opts = {}) {
  const prior = model.candidates[candidate.id];
  if (prior && prior.created_skill) return { ok: true, slug: prior.created_skill, existed: true };
  if (prior && prior.last_rejected_at && now() - prior.last_rejected_at < CONFIG.cooldownMs) return { ok: false, reason: 'candidate cooldown active' };
  const spec = skillSpec(candidate);
  const text = renderSkill(spec);
  const valid = validateSkill(spec, text);
  if (!valid.ok) return { ok: false, reason: valid.errors.join(', ') };
  const dir = path.join(GENERATED, spec.slug);
  const file = path.join(dir, 'SKILL.md');
  if (!opts.dryRun) {
    ensureDir(dir);
    writeAtomic(file, text);
    const qv = quickValidate(dir);
    if (!qv.ok) {
      try { fs.unlinkSync(file); fs.rmdirSync(dir); } catch { /* leave no registered invalid skill */ }
      return { ok: false, reason: `quick_validate failed: ${qv.output}` };
    }
    const { lib } = loadSkills();
    if (!lib) return { ok: false, reason: 'CTB skill registry unavailable' };
    const registered = lib.addSkill({ ...spec, origin: 'forged' }, SKILLS_FILE);
    if (!registered.ok) return { ok: false, reason: registered.error };
    model.generated[spec.slug] = {
      slug: spec.slug, candidate_id: candidate.id, file, task_ids: candidate.task_ids,
      cues: spec.cues, created_at: now(), routes: 0, successes: 0, failures: 0,
      quarantined: false, superseded_by: null,
    };
    model.candidates[candidate.id] = { ...candidate, created_skill: spec.slug, created_at: now() };
    model.creation_history.push({ at: now(), slug: spec.slug, candidate_id: candidate.id });
    audit('skill-created', { slug: spec.slug, candidate: candidate.id, task_ids: candidate.task_ids, file });
  }
  return { ok: true, slug: spec.slug, file, spec, dry_run: !!opts.dryRun };
}

function routeMatches(task, model) {
  const q = taskTerms(task);
  return Object.values(model.generated).filter(s => !s.quarantined && !s.superseded_by).map(s => ({
    slug: s.slug, score: coverage(q, new Set(s.cues || [])), candidate_id: s.candidate_id,
  })).filter(x => x.score >= CONFIG.routeFloor).sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug)).slice(0, 2);
}

function attach(task, hits, model, opts = {}) {
  if (!hits.length) return { attached: [] };
  const have = new Set(Array.isArray(task.skills) ? task.skills : []);
  const add = hits.map(x => x.slug).filter(x => !have.has(x));
  if (!add.length) return { attached: [] };
  if (!opts.dryRun) {
    const r = spawnSync(process.execPath, [VINTASK, 'update', task.id, '--skill-add', add.join(',')], { encoding: 'utf8', timeout: 30000 });
    if (r.status !== 0) return { attached: [], error: String(r.stderr || r.stdout || 'vintask update failed').trim() };
    model.routes[task.id] = { at: now(), skills: add, evidence: hits.filter(x => add.includes(x.slug)) };
    for (const slug of add) if (model.generated[slug]) model.generated[slug].routes++;
    audit('task-routed', { task_id: task.id, skills: add, evidence: hits });
  }
  return { attached: add, dry_run: !!opts.dryRun };
}

function observe(tasks, model) {
  let changed = 0;
  for (const t of tasks) {
    if (!settled(t) || model.outcomes[t.id]) continue;
    const routed = model.routes[t.id];
    if (!routed) continue;
    const success = t.status === 'done';
    model.outcomes[t.id] = { at: now(), status: t.status, success, skills: routed.skills };
    for (const slug of routed.skills) {
      const s = model.generated[slug];
      if (!s) continue;
      if (success) s.successes++; else s.failures++;
      const n = s.successes + s.failures;
      if (n >= CONFIG.quarantineAfter && s.successes / n < CONFIG.quarantineSuccessFloor) {
        s.quarantined = true; s.quarantined_at = now(); s.quarantine_reason = `${s.successes}/${n} routed tasks succeeded`;
        audit('skill-quarantined', { slug, reason: s.quarantine_reason });
      }
    }
    changed++;
  }
  return changed;
}

function withLock(fn) {
  ensureDir(STATE);
  let fd;
  try { fd = fs.openSync(LOCK, 'wx'); fs.writeFileSync(fd, String(process.pid)); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    let stale = false, owner = 0;
    try {
      owner = Number(fs.readFileSync(LOCK, 'utf8').trim()) || 0;
      const age = now() - fs.statSync(LOCK).mtimeMs;
      let alive = false;
      if (owner > 1) { try { process.kill(owner, 0); alive = true; } catch { /* dead owner */ } }
      stale = age > CONFIG.staleLockMs || !alive;
    } catch { stale = true; }
    if (!stale) return { ok: false, reason: `another evolution sweep is active (pid ${owner})` };
    try { fs.unlinkSync(LOCK); } catch { return { ok: false, reason: 'stale evolution lock could not be recovered' }; }
    audit('stale-lock-recovered', { owner });
    fd = fs.openSync(LOCK, 'wx'); fs.writeFileSync(fd, String(process.pid));
  }
  try { return fn(); } finally { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(LOCK); } catch {} }
}

function sweep(opts = {}) {
  return withLock(() => {
    const tasks = loadTasks(opts.tasksFile || TASKS);
    const model = loadModel();
    const observed = observe(tasks, model);
    const candidates = assess(tasks, opts);
    const created = [];
    const weekAgo = now() - 7 * 24 * 60 * 60 * 1000;
    model.creation_history = model.creation_history.filter(x => x && x.at >= weekAgo);
    let budget = Math.min(CONFIG.maxCreatesPerSweep, Math.max(0, CONFIG.maxCreatesPerWeek - model.creation_history.length));
    const newestCreation = model.creation_history.reduce((n, x) => Math.max(n, x.at || 0), 0);
    if (!opts.dryRun && newestCreation && now() - newestCreation < CONFIG.createCooldownMs) budget = 0;
    for (const c of candidates) {
      model.candidates[c.id] = { ...(model.candidates[c.id] || {}), ...c, assessed_at: now() };
      if (c.decision === 'create-skill' && opts.create !== false && budget > 0) {
        const r = createSkill(c, model, opts);
        if (r.ok && !r.existed) { created.push(r); budget--; }
      }
    }
    const routed = [];
    if (opts.route !== false) {
      for (const t of tasks.filter(x => x.status === 'todo' && !x.needs && !x.blocked_reason)) {
        const hits = routeMatches(t, model);
        const r = attach(t, hits, model, opts);
        if (r.attached.length) routed.push({ task_id: t.id, ...r });
      }
    }
    model.last_sweep_at = now();
    if (!opts.dryRun) saveModel(model);
    return { ok: true, observed, candidates, created, routed, generated: Object.values(model.generated) };
  });
}

function status() {
  const model = loadModel();
  return { ok: true, config: CONFIG, last_sweep_at: model.last_sweep_at, candidates: Object.values(model.candidates), generated: Object.values(model.generated) };
}

module.exports = { CONFIG, words, taskTerms, similarity, coverage, gapWeight, clusterTasks, assess, skillSpec, renderSkill, validateSkill, quickValidate, routeMatches, observe, sweep, status, loadTasks };

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'sweep';
  const dryRun = args.includes('--dry-run');
  let result;
  if (cmd === 'sweep') result = sweep({ dryRun, create: !args.includes('--no-create'), route: !args.includes('--no-route') });
  else if (cmd === 'status') result = status();
  else if (cmd === 'analyze') result = { ok: true, candidates: assess(loadTasks()) };
  else { console.error('usage: engine.js sweep [--dry-run|--no-create|--no-route] | status | analyze'); process.exit(2); }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.ok) process.exitCode = 1;
}
