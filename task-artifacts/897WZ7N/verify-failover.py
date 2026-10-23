#!/usr/bin/env python3
"""Execute real driver routing/failover sections with isolated fake provider results.
Default applies the adjacent patch in a temporary directory; --baseline tests live source.
No model calls, queue writes, health writes, credentials, or live runtime edits.
"""
import argparse
import json
from pathlib import Path
import shlex
import subprocess
import tempfile

ROOT = Path('/home/vinta/.claude/council-loop')
parser = argparse.ArgumentParser()
parser.add_argument('--baseline', action='store_true')
parser.add_argument('--driver', type=Path)
args = parser.parse_args()
checks = []

def check(name, ok, evidence=''):
    checks.append(ok)
    print(('PASS ' if ok else 'FAIL ') + name + (': ' + evidence if evidence else ''))

def between(text, start, end):
    return text[text.index(start):text.index(end, text.index(start))]

def run(script, directory):
    return subprocess.run(['bash', '-u', '-c', script], cwd=directory, text=True, capture_output=True, timeout=20)

with tempfile.TemporaryDirectory(prefix='897WZ7N-') as tmp:
    directory = Path(tmp)
    driver = directory / 'bin/council-driver.sh'
    driver.parent.mkdir()
    driver.write_text((args.driver or ROOT / 'bin/council-driver.sh').read_text())
    if not args.baseline and not args.driver:
        subprocess.run(['patch', '--batch', '-p1', '-i', str(Path(__file__).with_name('council-driver.patch').resolve())], cwd=directory, capture_output=True, check=True)
    source = driver.read_text()
    syntax = subprocess.run(['bash', '-n', str(driver)], capture_output=True)
    check('driver shell syntax', syntax.returncode == 0)
    integration = between(source, '  # ── INTELLIGENT ROUTING VIA LLM-ROUTER (T3RRBGX', '  # Set Anthropic fallback models')
    plan = json.dumps({'ladder': [{'provider':'anthropic','model':'claude-opus-5','tier':'L4'}, {'provider':'openai','model':'gpt-6-astra','tier':'L4'}]})
    result = run('ROUTE=claude-opus-5\nPLAN_JSON=' + shlex.quote(plan) + '\n' + integration + '\nprintf "%s" "$PLAN_JSON"', directory)
    check('successful primary plan survives integration', result.returncode == 0 and result.stdout == plan, f'rc={result.returncode}, retained_bytes={len(result.stdout)}')

    classify = between(source, '  classify_provider_failure() {', '  record_provider_outcome() {')
    helpers = between(source, '  attempt_offset() {', '  launch_rung() {') if '  attempt_offset() {' in source else ''
    launch_prefix = between(source, '    _lp="$1"; _lm="$2"', '    if [ "$_lp" = "anthropic" ]; then')
    loop = between(source, '  if [ -n "$PLAN_JSON" ] && [ -z "$KILLED" ]; then', '    if [ -n "$FAILED_OVER" ] && [ "$RC" -eq 0 ]; then') + '\nfi\n'
    outage_line = next(line for line in source.splitlines() if line.startswith('  OUTAGE_TEXT='))
    fixtures = [
        ('Claude lockout reaches OpenAI and clears prior outage', ['anthropic','openai'], ['credit','ok'], ['anthropic','openai'], False),
        ('same-vendor rung skipped before OpenAI', ['anthropic','anthropic','openai'], ['credit','ok'], ['anthropic','openai'], False),
        ('expired Claude login skips same account', ['anthropic','anthropic','openai'], ['auth','ok'], ['anthropic','openai'], False),
        ('unavailable provider remains skipped later in ladder', ['anthropic','openai','anthropic','google'], ['credit','capability','ok'], ['anthropic','openai','google'], False),
        ('skipped account rungs do not consume attempt cap', ['anthropic']*5+['openai','google'], ['credit','capability','ok'], ['anthropic','openai','google'], False),
        ('model capability failure retains same-provider fallback', ['anthropic','anthropic','openai'], ['capability','ok'], ['anthropic','anthropic'], False),
        ('all providers locked out preserves outage', ['anthropic','openai','anthropic'], ['credit','credit'], ['anthropic','openai'], True),
    ]
    for index, (name, providers, outcomes, expected, outage_expected) in enumerate(fixtures):
        case_dir = directory / str(index)
        case_dir.mkdir()
        ladder = {'ladder':[{'provider':p,'model':'fixture-'+str(i),'tier':'L4'} for i,p in enumerate(providers)]}
        base = '''
ROOT=ROOT_VALUE
BIN=BIN_VALUE
NODE_BIN="$(command -v node)"
ROUTER_JS="$ROOT/lib/llm-router.js"
TASK_LOG="$PWD/task.log"
RAW_LOG="$PWD/raw.jsonl"
: > "$TASK_LOG"
: > "$RAW_LOG"
: > "$TASK_LOG.routerout"
PLAN_JSON=PLAN_VALUE
OUT=""; RC=1; KILLED=""; PROVIDER=anthropic; ROUTE=fixture-0; TIER=L4
FLOOR_TIER=L4; FLOOR_KIND=general; MAX_HOPS=6; i=1; TID=fixture; AGENT_ID=test
VINTASK=true; WORKTREE="$PWD"; BUDGET=100000; launch_count=0; NEXT_RC=1
COUNCIL_VERIFY_DIFF=0
log() { :; }
record_provider_outcome() { :; }
below_floor() { return 1; }
verify_attempt() { :; }
kill() { return 1; }
wait() { return "$NEXT_RC"; }
outcomes=(OUTCOMES_VALUE)
'''.replace('ROOT_VALUE', shlex.quote(str(ROOT))).replace('BIN_VALUE', shlex.quote(str(directory/'fake-bin'))).replace('PLAN_VALUE', shlex.quote(json.dumps(ladder))).replace('OUTCOMES_VALUE', ' '.join(outcomes))
        launch = '''
launch_rung() {
LAUNCH_PREFIX
  printf '%s\n' "$_lp" >> "$PWD/launches"
  outcome="${outcomes[$launch_count]:-ok}"
  launch_count=$((launch_count+1))
  case "$outcome" in
    credit) printf '%s\n' '{"type":"error","message":"You have reached your usage limit"}' >> "$RAW_LOG"; NEXT_RC=1 ;;
    auth) printf '%s\n' '{"type":"error","message":"OAuth session expired"}' >> "$RAW_LOG"; NEXT_RC=1 ;;
    capability) printf '%s\n' '{"type":"error","message":"Compilation failed"}' >> "$RAW_LOG"; NEXT_RC=1 ;;
    ok) printf '%s\n' '{"type":"tool_use","name":"exec_command"}' '{"type":"result","result":"DONE fixture"}' >> "$RAW_LOG"; NEXT_RC=0 ;;
  esac
  AGENT_PID=""
}
launch_rung anthropic fixture-0
RC="$NEXT_RC"
'''.replace('LAUNCH_PREFIX', launch_prefix)
        script = base + helpers + classify + launch + loop + outage_line + '\nprintf "%s" "$OUTAGE_TEXT" | "$NODE_BIN" "$ROOT/lib/outage-signal.js"\n'
        result = run(script, case_dir)
        actual = (case_dir / 'launches').read_text().splitlines()
        outage = result.stdout.startswith('OUTAGE:')
        expected_rc = 3 if outage_expected else 0
        check(name, actual == expected and outage == outage_expected and result.returncode == expected_rc,
              f'launches={actual}, verdict={result.stdout.strip()}, rc={result.returncode}' + (f', stderr={result.stderr[-150:]}' if result.returncode not in (0,3) else ''))
print(f'{sum(checks)}/{len(checks)} checks passed')
raise SystemExit(0 if all(checks) else 1)
