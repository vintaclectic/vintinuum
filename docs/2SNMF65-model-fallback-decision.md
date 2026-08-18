# 2SNMF65 Model Fallback Decision

## Decision

Council work should not stop just because Anthropic is unavailable. The fallback
order is:

1. Use the best worthy provider for the task.
2. For code/implementation work, Codex/OpenAI is a funded fallback and should run.
3. Grok/xAI should be re-enabled now that Vinta says credits were updated.
4. Local models remain the final floor only where quality allows.
5. High-stakes work may refuse/block only after every available worthy frontier
   model is exhausted.

## Live Finding

`/home/vinta/.claude/council-loop/lib/llm-router.js` already supports
multi-provider failover and `openai` is available through Codex OAuth. The live
plan for a code fallback task includes OpenAI, but skips xAI because
`/home/vinta/.claude/council-loop/config/providers.json` still has:

```json
"xai": {
  "enabled": false
}
```

The router reports:

```text
xai: available=false, reason="disabled in config"
openai: available=true, via="oauth/cli"
```

## System Patch Needed

Apply this in `/home/vinta/.claude/council-loop/config/providers.json`:

```diff
     "xai": {
       "label": "Grok (xAI)",
-      "enabled": false,
+      "enabled": true,
```

Replace the stale disabled note with:

```text
RE-ENABLED 2026-08-14 for task 2SNMF65 after Vinta said Grok credits were
updated. If a live run later returns credit/monthly-limit errors, the router's
outage classifier opens the breaker and fails over automatically instead of
parking the task.
```

## Reversibility

Undo by setting `xai.enabled` back to `false` or reverting the config commit.
No credentials are changed and no live external action is performed by this doc.
