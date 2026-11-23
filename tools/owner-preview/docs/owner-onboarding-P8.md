# Owner onboarding P8 control plane

This runnable tool lives in the frontend repository at `tools/owner-preview/`.
It imports the already-installed council libraries read-only. It does not need
an API repository change or a production server restart.

`lib/owner-onboarding.js` composes the existing P2–P6 council contracts into a same-origin HTTP interface. `createFixture()` creates two isolated synthetic owner accounts, fresh temporary state, a broker-only key directory, per-tenant boards/journals, package registries and transactional ledgers. Its listener binds `127.0.0.1` on an ephemeral port. It rejects other remote addresses, Host headers and Origins. Hosted creation is refused, and no route is mounted into `server.js`.

The explicit fixture boundary is intentional: P9 admission, legacy migration and production identity integration have not passed. This module does not create real users, contact providers, spend money or reuse host credentials. Provider connection stores a key through the actual encrypted broker; the response explicitly says it has not verified that key with a provider. Fixture task dispatch is available only to trusted test code through `mockAttempt`, never through HTTP. All fixtures are discarded on `close()`; sessions and task pins are ephemeral, so this is not a persistent production service.

## Local use

```js
const { createFixture } = require('../lib/owner-onboarding');
const fixture = createFixture({ frontendRoot: '/absolute/path/to/frontend/worktree' });
const base = await fixture.listen();
const session = fixture.createSession('alice'); // or 'bob'; in-process test control
// Add session.cookieName=session.sessionId to the browser cookie jar at base.
// Use HttpOnly, SameSite=Strict. This local HTTP fixture deliberately uses a
// distinct cookie name from the secure production __Host-vcsess contract.
// The browser can now open base + '/tenant-onboarding.html'.
await fixture.close();
```

`createSession` is never an HTTP endpoint. No public login or provider adapter is supplied. Production integration must use the authenticated identity adapter, persistent membership/session storage, secure cookies and the P9 launch gate, not expose the fixture factory.

## API

All routes begin `/api/owner/`. Session authority comes exclusively from the cookie and server-side membership. Mutations require the session-bound `X-CSRF-Token`; caller-supplied authority and unexpected body fields are rejected. No CORS policy is enabled.

- `GET session`: tenant label, tenant ID, CSRF token, connected providers, `fixture: true`, `hostedAdmissionEnabled: false`.
- `POST provider`: `{provider,secret}`; supports `openai` and `anthropic`. The secret is never returned.
- `GET packages`, `POST packages`: list versions or import `{archiveBase64}` using the actual bounded ZIP/text validator. File lists, warnings and requested permissions are returned for review.
- `POST packages/approve`: `{digest,capabilities}`. Empty permission approval is valid. Forbidden or unrequested grants are refused.
- `POST packages/activate`: `{digest}`. Only an explicitly approved tenant-owned version activates.
- `GET tasks`, `POST tasks`: list or create `{title,detail,agentId?}`. Requires a provider plus an activated package. A single active agent is selected automatically; ambiguous selection is refused. The immutable package pin is captured and recorded in the isolated tenant journal.
- `GET costs`: `{knownMicros,unknownCount,currency,fixture}` from that tenant's real ledger. Unknown usage is never reported as known zero.
- `POST logout`: `{}` revokes the session.

Task creation does not execute an agent. `fixture.mockAttempt(sessionId,taskId,{costMicros,costKnown})` exercises actual broker issuance and router reservation/reconciliation using a no-network mock requester. The broker's routing policy accepts only active package digests; the non-digest inventory marker cannot mint an execution grant. The fixed provider list exposes no user-selected URL or network destination.

## Verification

From the frontend repository run:

```sh
timeout 90 node tools/owner-preview/bin/verify-owner-onboarding-3CUERP2.js
timeout 90 node scripts/qa/verify-owner-journey.cjs
timeout 90 node scripts/qa/verify-owner-layout.cjs
```

The first drives the real HTTP server with two accounts, exercises the full import/approval/activation/task workflow, runs mocked provider attempts through the real router, and measures cross-tenant isolation, absent/foreign CSRF denial, origin/Host denial, revoked sessions/memberships, least privilege, unknown costs and cleanup. The fixture ZIP helper is exported as `pack()` for browser acceptance tests. The browser journey uses the real adapter and libraries; the layout suite substitutes HTTP responses to cover long labels and loading/error/empty/session-expiry states at 320/375/768/1280/1920 pixels. Browser scripts use the existing Puppeteer installation in the API repository; `VINTINUUM_API_ROOT` (journey) or `PUPPETEER_MODULE` (layout) can select another installation.

## Product boundaries

This preview offers owner-controlled credentials and explicit permission approval,
saved assignments and clear cost attribution. Its numbered setup makes the next
action visible without engagement prompts, streaks or artificial urgency. It is a
private validation tool with no commercial tier, price, billing or conversion
offer; those strategic decisions are not inferred by this packet. No retention
telemetry or private tenant work is sent to shared analytics. Stopping the local
process removes access immediately. Production admission, persistence, identity
integration and any commercial release remain subject to P9 and product direction.

DECISION: P3 gate follows completed successor T6FPVRT, matching the queue's actual
dependency list; RH826AE remains the deliberately paused parent epic. The adapter
is kept beside its frontend as a standalone local tool because API Git metadata
is read-only in this session and no production API mount is needed for P8's
mock-provider checks. Revert the P8 commits to undo this placement.

No application database DDL, `directory_files` search, playlist, account deletion or public signup endpoint changes are involved. Public QA signup would contradict this packet's disabled-admission boundary; those automatically attached skill checks are inapplicable here.
