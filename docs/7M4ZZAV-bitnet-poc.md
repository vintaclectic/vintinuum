# BitNet b1.58-2B-4T — local-model proof of concept

Task **7M4ZZAV**. Verified on this machine 2026-08-28 by seat-1 (agent: vintinuum).

## Verdict

**BitNet runs locally and produces correct output — but it is NOT ready to enter
the router.** It is ~3x the disk of qwen2.5:0.5b, and its output showed a clear
degeneration/repetition defect on the very first smoke test. Recommendation below.

## What was built

| Piece | Location | State |
|---|---|---|
| bitnet.cpp source | `/mnt/e/Vintinuum/bitnet/bitnet.cpp` | cloned, built |
| binaries + shared libs | `/home/vinta/bitnet-bin/` | `llama-cli` build `b9918-390c30775` |
| BitNet-b1.58-2B-4T weights | `/home/vinta/bitnet-models/ggml-model-i2_s.gguf` | 1.2 GB, ftype `Q1_0` |
| benchmark harness | `scripts/bitnet-bench.sh` | reproducible, re-runnable |

Built with **gcc-13**, not clang. The upstream README insists on clang>=18; that
is not actually required and sudo was password-gated here, so the gcc path is the
one that works on this box. Do not waste time re-fighting the clang requirement.

## THE TRAP that cost three prior attempts

`llama-cli` in this build **does not support `-no-cnv`**. Passing it prints:

```
--no-conversation is not supported by llama-cli
please use llama-completion instead
```

...and then it *silently falls into interactive chat mode and blocks on stdin
forever*. Every earlier attempt at this task hung and was killed by timeout,
which looked like "BitNet is impossibly slow" but was really "BitNet is waiting
for you to type." `llama-completion` was **not built** by this build config.

**The working invocation** is `--single-turn` with stdin closed:

```bash
cd /home/vinta/bitnet-bin
LD_LIBRARY_PATH=/home/vinta/bitnet-bin ./llama-cli \
  -m /home/vinta/bitnet-models/ggml-model-i2_s.gguf \
  -p "your prompt" -n 40 -t 8 --single-turn < /dev/null
```

## Measured results

Prompt (identical for both): `What is the capital of France? Answer in one sentence.`

| Model | Size on disk | Generation | Prompt eval | Output |
|---|---|---|---|---|
| BitNet b1.58-2B-4T | 1.2 GB | **0.9 tok/s** | 5.2 tok/s | correct, then repeats |
| qwen2.5:0.5b (ollama) | 397 MB | **0.38 / 0.21 tok/s** (2 runs) | 5.15 / 4.86 tok/s | `The capital of France is Paris.` clean stop |

### ⚠️ Read the contention caveat before trusting these numbers

**MEASURED, but under heavy load.** Every figure above was taken with 10 council
seats running (`load average: 18–22`). These are *not* clean-host numbers and are
depressed several-fold. qwen was measured twice and moved 0.38 → 0.21 tok/s purely
from contention, which shows how noisy the environment was.

What this data **does** support: BitNet loads, runs, and answers correctly, and
its throughput is in the same order of magnitude as qwen — not catastrophically
worse. What it **does not** support: a precise speed ranking between the two.
Confirm with `scripts/bitnet-bench.sh` when `uptime` shows load < 2.

### The quality defect (the real blocker)

BitNet answered correctly and then degenerated:

```
, capital of France is Paris. 1, capital of France is Paris. 1, capital of France is Paris. 1,
```

qwen2.5:0.5b answered once and stopped cleanly. This is a **correctness/stopping
problem, not a speed problem**, and it is the reason BitNet should not be routed
to yet. UNVERIFIED as to cause — the likely candidates are a wrong/missing chat
template, a sampler default, or an EOS-token mismatch in the GGUF conversion. None
of those were tested; confirming would mean re-running with an explicit template
and `--temp`/repeat-penalty sweeps.

## Recommendation on router integration

**Do not wire BitNet into the router yet.** Per the task's own framing ("and only
then propose router integration"), this POC's job was to decide that question, and
the honest answer is not-yet. It costs 3x the disk of qwen2.5:0.5b, shows no
verified speed win, and currently emits repeating output — three strikes against
a model whose whole pitch is cheap local inference.

**The one thing worth doing next**, and it is cheap: re-run `scripts/bitnet-bench.sh`
on an idle host and fix the stopping behaviour (chat template + sampler). If BitNet
then stops cleanly AND beats qwen on a quiet box, it earns a router slot as the
local tier-1 model. If it still repeats, this line of work is closed and
qwen2.5:0.5b stays the local default.
