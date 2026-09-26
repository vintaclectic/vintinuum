# DirZombie Anticheat Gate

Status: FiveGuard selected for the open-beta anticheat gate. txAdmin stays enabled as the built-in FXServer admin fallback, but it is not the anticheat vendor.

Sources checked on 2026-08-28:
- FiveGuard server exports document `fg_BanPlayer`, `UnbanId`, and `GetBanInfoId`.
- FiveGuard server commands document `fg ban`, `fg unban`, `fg check`, `fg offlineban`, and permission commands.
- Cfx.re txAdmin docs confirm txAdmin is bundled with FXServer and provides admin/player ban tooling.
- Cfx.re resource FAQ warns against global ban lists and protection-racket style anticheat resources; DirZombie staff must keep bans local, reviewable, and appealable.

## Install Gate

Open beta is blocked until every item below is true on staging:

1. FiveGuard is licensed and installed as a server resource.
2. `server.cfg` starts FiveGuard before `dirzombie_anticheat_bridge`.
3. Ban, unban, check, and false-positive review are tested by staff on staging.
4. Staff have this runbook and know where ban IDs, evidence logs, and appeals live.

## Resource Layout

This seat could not write `/home/vinta/dirzombie` directly. Copy `resources/dirzombie_anticheat_bridge` into the DirZombie repo:

```text
/home/vinta/dirzombie/resources/[dirzombie-admin]/dirzombie_anticheat_bridge
```

Then add the `server.cfg` lines from `server.cfg.snippet` to:

```text
/home/vinta/dirzombie/server/cfg/server.cfg.example
```

On the real server, put the licensed FiveGuard resource and secret license/config only in the ignored runtime `server.cfg`, never in git.

## Required Convars

```cfg
setr dirzombie_anticheat_vendor "fiveguard"
setr dirzombie_anticheat_resource "fiveguard"
setr dirzombie_anticheat_staff_ace "dirzombie.anticheat.staff"
setr dirzombie_anticheat_staging_mode "false"
```

Only set `dirzombie_anticheat_staging_mode` to `true` on staging. It enables `dzac_testban`, which intentionally bans a connected test subject through the same bridge used by production enforcement.

## Staff Commands

These commands are server-console first. Give Discord/runbook examples to staff only after staging passes.

```text
dzac_ban <playerId> <reason>
dzac_unban <banId> <reason>
dzac_check <banId>
dzac_fp <banId> <uphold|lift|watch> <notes>
```

Staging only:

```text
dzac_testban <playerId>
```

## Ban Test

1. Start staging with FiveGuard and `dirzombie_anticheat_bridge`.
2. Have a staff test account join staging.
3. Run `dzac_testban <playerId>` from server console.
4. Confirm the player is removed/banned and a FiveGuard ban ID appears in FiveGuard logs, `bans.json`, or the web panel.
5. Run `dzac_check <banId>` and confirm it returns ban information.
6. Record player identifiers, ban ID, command output, and timestamp in the staging checklist.

## Unban Test

1. Run `dzac_unban <banId> staging unban test`.
2. Confirm FiveGuard returns a successful unban result.
3. Run `dzac_check <banId>` and confirm the ban no longer blocks the account, or confirm FiveGuard reports the ban as missing/lifted.
4. Have the same test account reconnect successfully.

## False-Positive Workflow

Every appeal gets one of three outcomes:

```text
uphold - evidence confirms cheating or ban evasion.
lift   - evidence is missing, weak, or likely false-positive.
watch  - unban now, flag account for staff review on future detections.
```

Workflow:

1. Pull the ban ID with `dzac_check <banId>` or FiveGuard web panel.
2. Review detection reason, identifiers, screenshot/log evidence, recent staff notes, and any conflicting Cfx.re/FiveM global-ban message.
3. If evidence is not strong enough for a beta community ban, run `dzac_fp <banId> lift <notes>` and then `dzac_unban <banId> <appeal reason>`.
4. If evidence is suspicious but not definitive, run `dzac_fp <banId> watch <notes>` and then `dzac_unban <banId> watched false-positive appeal`.
5. If evidence is strong, run `dzac_fp <banId> uphold <notes>`.

Do not use global/community ban-list evidence as the sole reason for a DirZombie ban. Keep DirZombie bans local, evidence-based, and reversible.

## Acceptance Checklist

Open beta can launch only after staging records:

```text
[ ] FiveGuard starts before dirzombie_anticheat_bridge.
[ ] dzac_ban bans a connected staging test player.
[ ] dzac_testban is disabled when staging_mode=false.
[ ] dzac_check returns evidence for the staging ban ID.
[ ] dzac_unban lifts the staging ban and the player reconnects.
[ ] dzac_fp records uphold/lift/watch outcomes without blocking unban.
[ ] Staff can find ban IDs in FiveGuard logs, bans.json, or panel.
[ ] Staff can execute the appeal workflow without owner intervention.
```
