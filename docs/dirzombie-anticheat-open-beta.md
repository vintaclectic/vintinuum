# DirZombie Anticheat Open-Beta Packet

Status: ready for staging execution
Owner: helios-sec10
Decision date: 2026-08-28

## Decision

Use SecureServe as DirZombie's open-beta anticheat default.

Why this is the beta default:

- No new spend is required before beta; SecureServe is published as a free/open-source FiveM anticheat.
- It has a simple FiveM resource install path and public docs for setup.
- It exposes a server-side ban hook, so DirZombie scripts can call anticheat enforcement from zombie-mode abuse checks.
- It keeps the first beta reversible: if staging shows noisy detections or gaps, replace it with FiveGuard before launch.

Rejected beta defaults:

- FiniAC Plus: strongest paid upgrade candidate for open beta if budget is approved. Its current public material advertises live monitoring, Apollo player review, Discord webhooks, screenshots, Event Protection, TrustScore, and a development server IP on Plus. Do not buy or install it silently; use it only after Vinta approves a subscription.
- FiveGuard: stronger paid/vendorized option with documented ban, unban, permissions, safe-event, and admin-panel workflows, but adopting it now would require a purchase/license decision. Keep it as the lifetime-license fallback if SecureServe staging fails and FiniAC subscription is rejected.
- WaveShield: documented install is simple, but the public install docs require the resource name to stay `WaveShield` and provide less open operational detail than SecureServe/FiveGuard for this packet.

FiveM platform constraint: anticheat resources are allowed, but avoid prohibited resource behavior, protection-racket vendors, and unverifiable global ban lists.

## Source Notes

Checked on 2026-08-28:

- SecureServe GitHub: `https://github.com/peleg-development/SecureServe-AC`
- SecureServe docs: `https://peleg.gitbook.io/secureserve`
- FiveGuard FAQ: `https://docs.fiveguard.net/faq`
- FiveGuard commands: `https://docs.fiveguard.net/fiveguard-commands/server-commands`
- FiveGuard server exports: `https://docs.fiveguard.net/exports/server-side-exports`
- WaveShield install docs: `https://ayznnn.gitbook.io/waveshield-v4/getting-started/install`
- FiniAC pricing/features: `https://fini.ac/pricing`
- FiniAC install docs: `https://docs.fini.ac/installation`
- FiniAC Apollo docs: `https://docs.fini.ac/panel/apollo`
- Cfx.re resource FAQ: `https://docs.fivem.net/docs/support/resource-faq/`

## Install Steps

Target staging layout:

```text
resources/
  [AC]/
    SecureServe/
    keep-alive/
```

Staging install:

1. Download the current SecureServe release from the project repository.
2. Copy `SecureServe/` and `keep-alive/` into `resources/[AC]/`.
3. In txAdmin console, run `refresh`.
4. Add SecureServe as the first anticheat/server-protection resource in `server.cfg`.
5. Configure Discord/webhook logging before allowing testers in.
6. Start staging and confirm the resource enters a healthy state before other gameplay resources depend on it.

Recommended `server.cfg` block:

```cfg
## DirZombie anticheat - open beta default
ensure SecureServe
ensure keep-alive

## Staff permission principals are examples. Replace identifiers on staging.
add_principal identifier.fivem:REPLACE_WITH_OWNER_FIVEM_ID group.superadmin
add_principal identifier.fivem:REPLACE_WITH_ADMIN_FIVEM_ID group.admin
```

Config pass before tester access:

1. Set webhook URLs for detections, bans, staff actions, resource alerts, and false-positive review.
2. Disable automatic permanent bans for noisy categories until staging baselines them.
3. Enable logging for unauthorized entities, explosions, trigger events, weapon anomalies, resource stop attempts, noclip/freecam, godmode, and suspicious client resources.
4. Whitelist known DirZombie zombie-mode events only after reviewing each event's server-side authorization.
5. Keep zombie NPC/entity thresholds stricter in public lobbies than staff-only testing buckets.

## DirZombie Integration Contract

Server-side DirZombie resources must treat the anticheat as an enforcement sink, not the only security boundary.

Required server rules:

- Validate every economy, inventory, weapon, revive, extraction, safe-zone, and zombie-reward event server-side.
- Rate-limit high-value zombie-mode events by player, license, Discord identifier, IP bucket, and server tick window.
- Log enforcement context before calling the anticheat ban hook.
- Prefer kick/temp-ban/manual-review for first sightings of noisy movement/entity detections during staging.
- Permanent ban only when evidence includes repeated detection, impossible server-side state, exploit-triggered server event, or staff-confirmed malicious behavior.

Example enforcement adapter:

```lua
local function dzBanPlayer(source, reason, context)
    local payload = json.encode({
        reason = reason,
        context = context or {},
        resource = GetCurrentResourceName(),
        at = os.date("!%Y-%m-%dT%H:%M:%SZ")
    })

    print(("[DirZombie AC] banning source=%s payload=%s"):format(source, payload))
    exports["SecureServe"]:banPlayer(source, reason)
end

RegisterNetEvent("dirzombie:ac:testBan", function()
    local source = source
    if not IsPlayerAceAllowed(source, "dirzombie.ac.test") then
        return
    end

    dzBanPlayer(source, "DirZombie staging anticheat test ban", {
        test = true,
        command = "dirzombie:ac:testBan"
    })
end)
```

Add this ACE only in staging:

```cfg
add_ace group.superadmin dirzombie.ac.test allow
```

## Staff Workflow

Roles:

- Owner: can change anticheat config, approve production ban-policy changes, and restore from false positives.
- Lead admin: can review logs, unban, temp-ban, kick, and create false-positive records.
- Moderator: can review detections, spectate, kick, and request ban escalation.
- Tester: can trigger staged checks only when explicitly granted staging ACE permissions.

Daily beta workflow:

1. Before opening the server, lead admin checks overnight detections, resource health, and Discord/webhook delivery.
2. During playtests, moderators tag each detection as confirmed cheat, likely cheat, unknown, or likely false positive.
3. Any detection involving zombie hordes, spawned infected, safe-zone transitions, vehicle hordes, scripted explosions, or extraction rewards goes to false-positive review before a permanent ban.
4. Owner or lead admin performs ban appeals/unbans from the ban store/admin tooling and records outcome in the staff log.
5. After any config change, rerun the staging checklist below.

Evidence standard:

- Minimum for permanent ban: player identifiers, detection name, timestamp, server build, resource version, relevant logs, and either repeat evidence or staff confirmation.
- Minimum for unban: ban ID/identifier, reason, reviewer, rollback action, and config/resource change if the ban was a false positive.

## False-Positive Policy

Open beta starts in evidence-first mode:

- First noisy movement/entity/server-event categories should log or temp-ban before permanent-ban unless the exploit is severe.
- Zombie-mode scripted entities are presumed suspicious only after the DirZombie resource confirms they were not server-authorized.
- A single admin can unban staging testers; production unbans require lead admin or owner review.
- Any confirmed false positive creates a config patch and a replay test case before public beta continues.
- Do not use unverifiable global ban lists for DirZombie open beta.

False-positive record template:

```text
Ban ID:
Player identifiers:
Detection:
Server build:
DirZombie resource/version:
What player was doing:
Why it was false-positive / unknown:
Config or code changed:
Retest result:
Reviewer:
```

## Staging Verification Checklist

This must pass before open beta.

Environment:

- Staging FXServer reachable.
- txAdmin access available.
- SecureServe installed under `resources/[AC]/`.
- Discord/webhook logging configured.
- At least two test accounts available: one staff tester, one normal tester.

Checks:

1. Start staging from cold boot.
   Expected: `SecureServe` starts without dependency errors and logs to the configured channel.
2. Join with normal tester.
   Expected: no ban/kick on normal spawn, inventory load, safe-zone entry, zombie spawn, mission start, mission completion, extraction, death, revive, and reconnect.
3. Trigger staged server ban from staff tester using `dirzombie:ac:testBan`.
   Expected: staff tester is banned or removed; ban appears in anticheat ban store/logs with the test reason.
4. Attempt the same event from normal tester.
   Expected: no anticheat ban is created by the test command; unauthorized test event is ignored and logged by DirZombie.
5. Unban staff tester from the configured ban workflow.
   Expected: tester can reconnect after unban; unban action appears in staff/admin logs.
6. Trigger known noisy zombie scenarios.
   Expected: scripted hordes, infected peds, safe-zone blockers, vehicle interactions, and extraction rewards do not create permanent bans.
7. Trigger one impossible server-side event in staging.
   Expected: DirZombie rejects it server-side, records evidence, and calls anticheat enforcement only when policy says it should.
8. Restart staging.
   Expected: ban store persists, unbanned tester remains unbanned, resource order is stable.

Pass/fail signoff:

```text
Date:
Server artifact/build:
SecureServe release/hash:
DirZombie resource hash:
Tester accounts:
Checks passed:
Checks failed:
False positives found:
Config changes made:
Approved for open beta by:
```

## Rollback

If SecureServe breaks staging or produces unresolved false positives:

1. Set server to staff-only.
2. Remove or comment `ensure SecureServe` and `ensure keep-alive` from `server.cfg`.
3. Restart staging.
4. Confirm normal tester can join and play the zombie loop.
5. Preserve SecureServe logs and ban files for review.
6. Switch the vendor decision to FiniAC Plus or FiveGuard only after Vinta approves the paid license/subscription purchase.

## Open-Beta Gate

DirZombie is not anticheat-ready for public open beta until the staging verification checklist has real pass/fail results from a running staging FXServer.
