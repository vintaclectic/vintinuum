# CTB notifications: one structured card, two native surfaces

Task `6UZDEU9` — implementation handoff for the live Council Task Board runtime.

## North star

Optimize **time-to-correct-action**: from a notification glance to the right card action in under 10 seconds, without opening a generic feed. Target: 90% of notification taps land on the intended card/action in a 7-day owner review.

## The experience

Every lifecycle event is a card-shaped payload, not prose assembled independently by each channel:

```text
◆ Waiting on you · 6UZDEU9
Can we upgrade CTB notifications…
— the actual question / block reason
Council Task Board · seat-1 · P1 · 42%
[Answer] [Open]
```

The body is ordered for truncation safety: verb + card id, card title, reason, then context chips. Android and Windows receive the same semantic card but platform-specific line and title budgets.

## Surface behavior

- **Android:** compact lock-screen/head-up card; priority events are sticky, audible, and vibrate; routine events are silent and collapse to one digest. Two action buttons max: the two most likely actions for that event.
- **Windows:** quiet native toast with a wider title/body budget; no vibration; priority items remain actionable and deep-link to the task drawer. The same action allowlist prevents platform-specific behavior drift.
- **Board drawer:** the notification body opens the exact card. The drawer shows the full card snapshot, project/agent/status/progress chips, acceptance/proof, and every safe action. It is the source of truth after a push preview.

## Action grammar

| Event | Primary | Secondary | Safety rule |
|---|---|---|---|
| needs-human | Answer | Open | Never offer done/cancel on a sealed question |
| blocked | Return to queue | Mark done (finished-block only) | Cancel stays behind the drawer |
| capped | Return to queue | Open | Explain the attempt cap |
| done | Reopen | Open | No destructive action in the toast |
| new | Open | Cancel | Cancel remains an explicit owner action |

Archive/dismiss is always available as a local notification action. It removes the OS card, never mutates the board. A task is only archived/cancelled from the drawer or an authenticated allowlisted action.

## Platform budgets

The adapter writes to budgets rather than assuming a physical device measurement: Android title 48 chars / 3 lines; Windows title 64 chars / 3 lines; max two OS actions. Text clips at word boundaries, never mid-word when avoidable. A missing platform registration safely falls back to the desktop budget.

## Wiring decision

The runtime already has `notify-builder.js`, `notify-adapter.js`, and `bin/assets/sw.js`, but `push.js` still sends the generic `shape()` body to every subscription and `/api/push/subscribe` does not record platform. The companion patch wires the adapter into the per-subscription send path and records `android` / `windows` at subscription time. This is reversible by reverting the patch commit.

## Verification

After applying the patch in `/home/vinta/.claude/council-loop`, run the adapter render smoke check described in the companion patch workflow. Android and Windows must produce bounded structured payloads with the same `taskId`; Windows must report `platform: 'windows'`.
