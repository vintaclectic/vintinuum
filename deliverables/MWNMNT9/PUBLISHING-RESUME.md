# MWNMNT9 — authorized publication resume

Vinta's September 17 instruction authorizes social posting. No further human
approval is required for the requested video campaign. Publication remains
unverified: the current session's single bounded request to localhost:8000
returned curl exit 7, HTTP 000. This observation does not distinguish an
unavailable listener from a session network restriction.

The existing media package is intact: 18/18 SHA-256 checks pass, all 19 ZIP
entries pass CRC and match their disk counterparts. See `package-recheck.json`.
The full media package remains in local council state storage; production
scripts and original handoff are preserved in commit `6c3c96a`.

## Authorized X request

`x-broadcast-authorized.json` changes the original draft to `mode: auto`, as
supported by `backend/app/api/v1/broadcast.py`. It retains the exact original
idempotency key and targets X only, with the square video attachment. This is
an unsent request, not a publication receipt. The checksummed delivery ZIP
still contains the original historical draft.

When DirCoMedia is reachable:

1. Use the established owner authentication and inspect existing broadcasts
   for idempotency key `MWNMNT9-council-explainer-x-v1`.
2. If absent, submit the authorized JSON to `POST /api/v1/broadcast/` after
   checking account readiness and backend access to the local media file.
3. If already pending approval, use
   `POST /api/v1/broadcast/{broadcast_id}/approve`. Replaying the same
   idempotency key with `mode: auto` returns the existing row unchanged.
4. If already dispatched, inspect its existing result before retrying.
   Record the successful platform result and verify the public video URL.

## Remaining platform limitations

Static inspection found that the Reddit broadcast worker skips publishing if
`REDDIT_AUTO_SUBREDDITS` is empty, including owner-approved broadcasts.
Furthermore, an allowlist entry is not forwarded as the destination to the
scheduler. Merely populating that setting does not bind a safe destination;
the worker and scheduler must agree on an explicit owned destination before
submission. No Reddit configuration was changed and no Reddit post was sent.

Other connected accounts must be checked live before publishing. The existing
SHARING.md in the media package contains upload instructions for Instagram,
TikTok, YouTube and other destinations. No successful social publication is
claimed for this run.

DECISION: prepare an auto-mode request for the explicitly authorized X post,
keeping the existing idempotency key to prevent duplicate submissions.
ALT: leave the request awaiting redundant human approval.
UNDO: revert this commit or restore `mode: approve-first` before submission.
