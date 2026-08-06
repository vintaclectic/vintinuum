# Distribution Rails — repair report (task XQDPW7G, step B)

*seat-2, 2026-08-06. Every claim verified against the live APIs through the
real client code, not a reimplementation.*

## The headline: two of the recon's core conclusions were wrong

The prior recon (`REVENUE_RECON.md`, seat-3) concluded X was app-only and the
audience was ≈ 0. Both are false, and the difference is the whole strategy.

| Recon claimed | Actually true | How verified |
|---|---|---|
| X bearer is app-only, "not a functioning audience" | **OAuth 1.0a user context works.** Authenticated as `@Vintaclectic` (id `15806951`) | `GET /2/users/me` → HTTP 200 |
| "Working assumption: audience ≈ 0" | **2,436 followers**, account created **2008-08-11**, 263 list memberships, 3,898 tweets | `user.fields=public_metrics` |
| Reddit fails due to "2FA or wrong app type" | **The app credentials themselves are rejected** | `client_credentials` also 401s |

**There is a real, warm, 17-year-old distribution channel with 2,436 followers
that works right now.** The funnel input was never zero. That was a credential
misdiagnosis, not a market fact.

## What was actually broken in the X rail (and is now fixed)

The X client had a *silent* signature bug. Silent is the dangerous kind: the
code reads correctly, the request is well-formed, and X just answers 401 — so
"we signed it wrong" gets misfiled as "X is down." That is very likely the
origin of the "app-only" conclusion.

1. **Media upload signatures omitted the form parameters.** OAuth 1.0a (RFC
   5849) folds every form and query parameter into the signature base string.
   `upload_media` called `_oauth_headers("POST", upload_url)` with no params
   while POSTing `command`/`total_bytes`/`media_type` as form data — so the
   signature never matched. **Every image and video tweet was impossible.**
2. **`Content-Type: application/json` was forced on form-encoded requests**,
   preventing httpx from setting `multipart/form-data` with its boundary.
3. **APPEND chunk failures were swallowed** — no `raise_for_status()`, so a
   partial upload proceeded to FINALIZE and failed confusingly.
4. **No transcode wait.** Video processes asynchronously; attaching the id
   before `state=succeeded` fails the tweet. Now polls STATUS properly.
5. **No way to ask "which account will post?"** — added `verify_credentials()`.

## Reddit: diagnosed, and it is not a code problem

Reddit returns **401 on every grant type — including `client_credentials`,
which requires no user, no password, and no 2FA.** That isolates the fault to
the `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` pair itself: invalid, revoked, or
belonging to a deleted app. Credential shape is fine (id 22 chars, secret 30).

**No code change can fix this** — it needs Vinta, ~3 minutes:

1. Go to <https://www.reddit.com/prefs/apps>
2. Create an app → type **web app** → redirect URI
   `http://localhost:8000/oauth/reddit/callback`
3. Put the new id/secret into `/home/vinta/dircomedia/backend/.env`
4. Run `python backend/scripts/reddit_oauth.py` to mint `REDDIT_REFRESH_TOKEN`

The client now raises this exact instruction instead of a bare 401, so nobody
loses another day hunting 2FA that was never the problem.

## Health surface now tells the truth

`/api/v1/distribution/health` previously reported a dead rail as a bare
`live: false` with no cause, and marked a *correct* refresh-token-only Reddit
setup as `configured: false` (it demanded a password that the passwordless lane
deliberately doesn't have). Now:

```
twitter: {"configured": true, "live": true, "account": "Vintaclectic", "followers": 2436}
reddit : {"configured": true, "live": false, "error": "Reddit rejected the app credentials (401 on every grant…)"}
```

It also probes Reddit *through the real client*, so health and posting can
never disagree about whether a rail works.

## Tests

`backend/tests/test_twitter_oauth.py` — 6 tests, all passing, all offline
(signatures recomputed independently against RFC 5849). Verified **non-vacuous**:
re-introducing the old param-dropping behavior makes
`test_signature_includes_form_params` and `test_signature_includes_query_params`
fail. Added `tests/conftest.py` so pytest resolves `app.*` from any directory.

## What this changes about the money question

Step A (the sales page) now lands somewhere real: a 2,436-follower account can
actually send humans to the Stripe checkout that seat-3 proved works. That is
still **not** $20,000 in 48 hours — at $9/mo that needs ~2,222 subscribers, and
2,436 followers converting at even a strong 2% is ~48 people ≈ $432/mo. The
honest read is that the Estate ($499) tier aimed at a warm 17-year-old audience
is the best dollars-per-effort available, exactly as ranked in step C.

The real win here is that the funnel now has a non-zero input, and the reason
it looked like zero was a bug we owned — not the market.
