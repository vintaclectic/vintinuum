# Evidence Preservation Harness

Turns what you already have — screenshots, recordings, call logs — into a
tamper-evident package that a platform, a police department, and a lawyer will
each take seriously.

## Why this and not the other thing

The impulse is to find the person and burn them down. Here is the cold
arithmetic on why that loses:

- **It destroys the criminal case.** The moment you retaliate, you stop being a
  victim with a clean record and become a mutual-combat story. Prosecutors drop
  those. Your daughter's case becomes an internet slapfight.
- **It hands them a protection order against you.** Ohio's stalking statute cuts
  both directions. Doxxing them is the same offense you're reporting.
- **Private attribution is unreliable and inadmissible.** Amateur identification
  is wrong often enough that courts don't credit it — and if you're wrong, you've
  attacked an uninvolved person and the liability is entirely yours.
- **A subpoena gets the real name anyway.** Platform records plus ISP records,
  obtained through a John Doe action or law-enforcement process, produce an
  identification that actually holds up. That is a door you can walk through
  legally. Don't kick a hole in the wall next to it.

What actually generates consequences: a preserved, hash-verified, chronologically
indexed evidence package in front of three parties who each have real power —
the platform (can ban and preserve), the police (can subpoena and charge), and
counsel (can sue and compel discovery).

**Speed matters more than anything else here.** Live broadcast content and chat
logs on streaming platforms expire on short windows. Preserve first, feel later.

## Do this first, tonight, in this order

### 1. Capture everything you can still see

Before you touch this tool. Screen-record rather than screenshot where possible —
video captures the URL bar, the timestamp, the surrounding context, and is far
harder to challenge. Get:

- the content that published your daughter's information
- the stream segments with the slurs
- chat logs
- your phone's call log showing the incoming calls (export it if you can)
- your mother's call log
- anything anyone else witnessed — get their name

Do not edit, crop, annotate, or "clean up" a single file. Originals only. Your
edited version is worth less than the messy original.

### 2. Preserve it

```bash
export EVIDENCE_OPERATOR="Your Full Legal Name"

node preserve.js init --case si666r --title "Doxxing of minor + telecom harassment"

node preserve.js add --case si666r \
  --file ~/captures/chat-doxx.png \
  --label "chat message publishing minor's home address" \
  --occurred "2026-09-08T19:42:00Z" \
  --observed "2026-09-08T19:45:00Z" \
  --source "screenshot of live chat, kick.com/<channel>" \
  --witness "name of anyone else who saw it"
```

Repeat for every artifact. `--occurred` is the date the *event* happened;
`--observed` is when *you* saw it. Both matter — a timeline is the backbone of
every report you're about to file.

Duplicates are detected by content hash and skipped automatically, so you can be
sloppy about adding the same file twice.

### 3. Generate the three reports

```bash
node preserve.js report --case si666r --kind platform   # Trust & Safety
node preserve.js report --case si666r --kind police     # walk-in packet
node preserve.js report --case si666r --kind counsel    # attorney briefing
```

Each has `<!-- fill this in -->` sections. **Fill them yourself, in your own
words, with only what you personally saw.** Then read every line and delete
anything that isn't exactly true. An overstatement anywhere is a crack the other
side pries at everywhere.

### 4. Seal it

```bash
node preserve.js seal --case si666r
```

Prints a package digest. **Write it down somewhere off this machine** — text it
to yourself, email it, put it on paper. That digest is what lets you prove months
from now that nothing changed since the night you sealed it.

After sealing, the package refuses new items. New evidence goes in a new case.

### 5. File — same night if you can

**Platform first**, because their retention clock is the one running out. Send
`REPORT_PLATFORM.md`. The key ask is buried in it and you should say it out loud
in whatever form they give you: **preserve the records now, regardless of what
you decide about enforcement.** Get a case number.

**Police second.** Print `REPORT_POLICE.md`, bring the files on a USB drive. Ask
for a report number before you leave. Get the officer's name and badge number and
log it the same day:

```bash
node preserve.js custody --case si666r \
  --action "copy provided to investigating officer" \
  --who "Det. <name>, badge <#>" --org "<agency>"
```

If the desk officer brushes you off — it happens with online offenses — ask
specifically for a report to be taken for **ORC 2917.21 telecommunications
harassment** and note that a **minor** was targeted. Naming the statute changes
the conversation. If they still refuse, you can contact the prosecutor's office
directly.

**Counsel third.** `REPORT_COUNSEL.md` is a briefing with seven specific
questions, including whether a John Doe action with expedited discovery is the
right vehicle for identifying the account holder. Many domestic-relations and
civil-litigation attorneys do free consults.

### 6. Verify before every handoff

```bash
node preserve.js verify --case si666r
```

Exit 0 means every hash matches and the seal is intact. Run it right before you
hand a copy to anyone, so you can say under oath that you checked.

## What this tool will not do

It does not investigate anyone, resolve any identity, scrape any profile, or
collect data about any person. It is a **custodian**, not an investigator. That
boundary is what keeps your hands clean, and clean hands are a real asset in
every one of the three proceedings above.

Identity attribution belongs to subpoena power. Let it work.

## Command reference

| Command | What it does |
|---|---|
| `init --case <slug> [--title] [--jurisdiction] [--out]` | Start a package |
| `add --case <slug> --file <path> [--label --occurred --observed --source --witness --notes]` | Preserve + hash an artifact |
| `url --case <slug> --url <url> --file <capture> [...]` | Same, tagged with the URL it came from |
| `custody --case <slug> --action <what> --who <name> [--org] [--notes]` | Log a handoff |
| `seal --case <slug>` | Freeze the package, emit the seal digest |
| `verify --case <slug>` | Re-hash everything; exit 2 on any problem |
| `report --case <slug> --kind platform\|police\|counsel` | Generate a filing packet |

Packages live in `~/evidence-packages/<case>/` unless you pass `--out`.
Set `EVIDENCE_OPERATOR` to your full legal name — it lands in the affidavit.

## Integrity guarantees, tested

Verified against three tamper vectors, each caught with exit code 2:

- an artifact's bytes altered after preservation → `HASH MISMATCH`
- an artifact deleted from the package → `MISSING file`
- `manifest.json` edited after sealing → `SEAL BROKEN`

Plus: identical content is de-duplicated by hash, every copy is re-hashed at
write time to catch a bad copy, and a sealed package refuses new items.

---

*Not legal advice. The statute references are pointers for the officer and the
attorney, not conclusions. Get a lawyer — the packet is built to make that
conversation short and cheap.*
