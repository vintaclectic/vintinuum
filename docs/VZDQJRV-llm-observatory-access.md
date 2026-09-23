# LLM Observatory Access

The LLM Observatory is a local-only dashboard for reviewing whether the
Vintinuum local brain is being used, learning, and improving.

## Location

- Repo: `/home/vinta/llm-observatory`
- Server entrypoint: `/home/vinta/llm-observatory/server/server.js`
- Dashboard UI: `/home/vinta/llm-observatory/public/index.html`
- Local data: `/home/vinta/llm-observatory/data/observatory.db`
- Canonical Vintinuum map: `DOMAINS.md`, under `LLM OBSERVATORY`

## Access

The dashboard is local-only:

```bash
http://localhost:3002
```

There is no public domain for it yet.

## Start It

```bash
cd /home/vinta/llm-observatory/server
npm install
npm start
```

The repo also includes a liveness check:

```bash
cd /home/vinta/llm-observatory/server
npm run check
```

Expected healthy result:

```text
{"ok":true,"service":"llm-observatory",...} observatory up
```

## Useful Review URLs

- Dashboard: `http://localhost:3002`
- Health: `http://localhost:3002/api/health`
- Main learning summary: `http://localhost:3002/api/learning/summary?days=30`
- Vitals: `http://localhost:3002/api/learning/vitals`
- Routing truth: `http://localhost:3002/api/learning/routing?days=30`
- Corpus growth: `http://localhost:3002/api/learning/corpus`
- Human corrections: `http://localhost:3002/api/learning/lessons?limit=40`
- Fine-tune runs: `http://localhost:3002/api/learning/training?limit=12`

## What It Reads

The observatory is read-only against the organism it watches:

- `/home/vinta/vintinuum-api/vintinuum.db`
- `/mnt/d/vintinuum/learning/v2/`
- `/mnt/d/vintinuum/learning/logs/`
- Ollama on `http://localhost:11434`

## Verification From This Seat

From this Codex sandbox, `curl http://localhost:3002/api/health` did not return a
response because the service was not already running. Starting the server with
`npm start` reached the app code, but local port binding failed with `EPERM`:

```text
Proxy could not bind 11435 (EPERM) - continuing without it.
Could not bind API port 3002: EPERM
```

That is a sandbox networking limitation, not a missing repo or broken access
path. On the host, run the start command above and open `http://localhost:3002`.
