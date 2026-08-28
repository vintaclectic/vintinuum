#!/usr/bin/env bash
# BitNet b1.58-2B-4T vs qwen2.5:0.5b — reproducible local benchmark.
# Task 7M4ZZAV. Both models answer the same prompt; we report tok/s.
#
# IMPORTANT: results are only comparable on an IDLE host. Check `uptime` first —
# the original run happened at load ~20 (10 council seats active) and both
# numbers were depressed several-fold. Re-run when load < 2 for real figures.
set -uo pipefail

BIN=/home/vinta/bitnet-bin
MODEL=/home/vinta/bitnet-models/ggml-model-i2_s.gguf
PROMPT="What is the capital of France? Answer in one sentence."
NPRED=40
THREADS="${THREADS:-8}"

echo "=== host load at start ==="
uptime

echo
echo "=== BitNet b1.58-2B-4T (bitnet.cpp / llama-cli) ==="
# NOTE: -no-cnv is NOT supported by this build (b9918-390c30775). It prints
# "--no-conversation is not supported by llama-cli", silently drops into
# interactive chat mode, and hangs on stdin until killed. That is what made
# every earlier attempt at this task time out. Use --single-turn AND </dev/null.
( cd "$BIN" && LD_LIBRARY_PATH="$BIN" timeout 300 ./llama-cli \
    -m "$MODEL" -p "$PROMPT" -n "$NPRED" -t "$THREADS" --single-turn </dev/null 2>/dev/null ) \
  | tr -d '\r' | grep -E "Prompt:|Generation:|capital" | tail -5

echo
echo "=== qwen2.5:0.5b (ollama) ==="
timeout 300 curl -s http://localhost:11434/api/generate \
  -d "{\"model\":\"qwen2.5:0.5b\",\"prompt\":\"$PROMPT\",\"stream\":false,\"options\":{\"num_predict\":$NPRED}}" \
  | python3 -c '
import sys,json
d=json.load(sys.stdin)
ec,ed=d["eval_count"],d["eval_duration"]/1e9
pc,pd=d["prompt_eval_count"],d["prompt_eval_duration"]/1e9
print("response:",d["response"].strip())
print(f"generation: {ec} tok / {ed:.2f}s = {ec/ed:.2f} tok/s")
print(f"prompt:     {pc} tok / {pd:.2f}s = {pc/pd:.2f} tok/s")
'

echo
echo "=== host load at end ==="
uptime
