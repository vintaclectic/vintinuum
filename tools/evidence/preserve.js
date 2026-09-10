#!/usr/bin/env node
/**
 * Evidence Preservation Harness
 * ------------------------------------------------------------------
 * Builds a tamper-evident, chain-of-custody evidence package suitable
 * for a platform Trust & Safety report, a police report, and counsel.
 *
 * SCOPE — read this before using it:
 *   This tool ONLY preserves material the operator already lawfully
 *   possesses or can lawfully observe (their own screenshots, their own
 *   screen recordings, their own phone/call records, public page
 *   captures). It performs NO investigation of any person, resolves no
 *   identity, and collects no personal data about anyone. It is a
 *   custodian, not an investigator. Attribution of a real-world identity
 *   to an online account is a job for law enforcement subpoena power,
 *   not for a private party — doing it privately taints the case and
 *   exposes the operator to liability.
 *
 * WHAT IT PRODUCES
 *   package/
 *     manifest.json          machine-readable index + hashes
 *     MANIFEST.txt           human/printable index
 *     CHAIN_OF_CUSTODY.md    custody log, signed by each handoff
 *     AFFIDAVIT.md           declarant statement scaffold (attorney-review)
 *     items/<id>/            the preserved artifact + its sidecar metadata
 *     SHA256SUMS             flat digest list for quick verification
 *     package.sha256         digest of the manifest itself (the seal)
 *
 * USAGE
 *   node preserve.js init   --case <slug> [--out <dir>]
 *   node preserve.js add    --case <slug> --file <path> [options]
 *   node preserve.js note   --case <slug> --file <path> [options]   (alias of add)
 *   node preserve.js url    --case <slug> --url <url> --file <capture> [options]
 *   node preserve.js custody --case <slug> --action <what> --who <name> [--org <org>]
 *   node preserve.js seal   --case <slug>
 *   node preserve.js verify --case <slug>
 *   node preserve.js report --case <slug> --kind <platform|police|counsel>
 *
 * Common options for add/url:
 *   --label "<short description>"      what the item shows
 *   --observed "<ISO or free text>"    when the OPERATOR observed it
 *   --occurred "<ISO or free text>"    when the underlying EVENT happened
 *   --source "<where it came from>"    e.g. "screenshot of kick.com/<channel> chat"
 *   --witness "<name>"                 anyone else who saw it
 *   --notes "<free text>"              anything else
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ------------------------------------------------------------------ utils

const DEFAULT_ROOT = path.join(os.homedir(), 'evidence-packages');

function nowIso() {
  return new Date().toISOString();
}

function die(msg, code = 1) {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function sha256File(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

function sha256String(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function caseDir(args) {
  if (!args.case) die('--case <slug> is required');
  const root = args.out ? path.resolve(args.out) : DEFAULT_ROOT;
  return path.join(root, slugify(args.case));
}

function loadManifest(dir) {
  const f = path.join(dir, 'manifest.json');
  if (!fs.existsSync(f)) {
    die(`no case at ${dir} — run: preserve.js init --case <slug>`);
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function saveManifest(dir, m) {
  m.updated = nowIso();
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify(m, null, 2) + '\n'
  );
}

function operator() {
  return process.env.EVIDENCE_OPERATOR || os.userInfo().username;
}

function machineFingerprint() {
  return `${os.hostname()} / ${os.type()} ${os.release()} / node ${process.version}`;
}

// ------------------------------------------------------------------ init

function cmdInit(args) {
  const dir = caseDir(args);
  if (fs.existsSync(path.join(dir, 'manifest.json'))) {
    die(`case already exists at ${dir}`);
  }
  fs.mkdirSync(path.join(dir, 'items'), { recursive: true });

  const manifest = {
    schema: 'evidence-package/1',
    case: slugify(args.case),
    title: args.title || args.case,
    created: nowIso(),
    updated: nowIso(),
    operator: operator(),
    machine: machineFingerprint(),
    jurisdiction: args.jurisdiction || 'Ohio, USA',
    sealed: false,
    items: [],
    custody: [
      {
        at: nowIso(),
        action: 'package created',
        who: operator(),
        org: 'self (declarant)',
        machine: machineFingerprint(),
      },
    ],
  };

  saveManifest(dir, manifest);
  writeDerived(dir, manifest);

  console.log(`✓ case initialized: ${dir}`);
  console.log(`  operator: ${manifest.operator}`);
  console.log(`\nNext: add each artifact you already have —`);
  console.log(
    `  node preserve.js add --case ${manifest.case} --file ./shot.png --label "..." --occurred "..."`
  );
}

// ------------------------------------------------------------------ add

function cmdAdd(args) {
  const dir = caseDir(args);
  const m = loadManifest(dir);
  if (m.sealed) die('package is SEALED — adding would break the seal. Use a new case or unseal deliberately.');

  if (!args.file) die('--file <path> is required');
  const src = path.resolve(args.file);
  if (!fs.existsSync(src)) die(`file not found: ${src}`);
  const stat = fs.statSync(src);
  if (!stat.isFile()) die(`not a regular file: ${src}`);

  const digest = sha256File(src);

  const dup = m.items.find((it) => it.sha256 === digest);
  if (dup) {
    console.log(`! identical content already preserved as ${dup.id} (${dup.label})`);
    console.log(`  skipping duplicate. Nothing changed.`);
    return;
  }

  const seq = String(m.items.length + 1).padStart(3, '0');
  const id = `E${seq}`;
  const itemDir = path.join(dir, 'items', id);
  fs.mkdirSync(itemDir, { recursive: true });

  const destName = `${id}${path.extname(src) || ''}`;
  const dest = path.join(itemDir, destName);
  fs.copyFileSync(src, dest);

  // verify the copy landed byte-identical
  const copyDigest = sha256File(dest);
  if (copyDigest !== digest) {
    die(`copy verification FAILED for ${src} — source ${digest} vs copy ${copyDigest}`);
  }

  const item = {
    id,
    label: args.label || path.basename(src),
    filename: destName,
    relpath: path.join('items', id, destName),
    bytes: stat.size,
    sha256: digest,
    mtime_source: stat.mtime.toISOString(),
    preserved_at: nowIso(),
    kind: args.url ? 'web-capture' : 'file',
    url: args.url || null,
    source: args.source || null,
    observed: args.observed || null,
    occurred: args.occurred || null,
    witness: args.witness || null,
    notes: args.notes || null,
    preserved_by: operator(),
    machine: machineFingerprint(),
    original_path: src,
  };

  m.items.push(item);
  m.custody.push({
    at: item.preserved_at,
    action: `preserved item ${id} (${item.label})`,
    who: operator(),
    org: 'self (declarant)',
    machine: machineFingerprint(),
    sha256: digest,
  });

  // sidecar next to the artifact
  fs.writeFileSync(
    path.join(itemDir, `${id}.meta.json`),
    JSON.stringify(item, null, 2) + '\n'
  );

  saveManifest(dir, m);
  writeDerived(dir, m);

  console.log(`✓ ${id} preserved  sha256=${digest}`);
  console.log(`  ${item.label}`);
  if (!item.occurred) {
    console.log(
      `  ! no --occurred date given. Timelines are the backbone of a report; add it now while you remember.`
    );
  }
}

// ------------------------------------------------------------------ url

function cmdUrl(args) {
  if (!args.url) die('--url <url> is required');
  if (!args.file) {
    die(
      'url preservation requires the capture you already made:\n' +
        '  --file <screenshot-or-recording>\n' +
        'This tool records what YOU observed. It does not fetch pages on your behalf.'
    );
  }
  if (!args.source) args.source = `capture of ${args.url}`;
  cmdAdd(args);
}

// ------------------------------------------------------------------ custody

function cmdCustody(args) {
  const dir = caseDir(args);
  const m = loadManifest(dir);
  if (!args.action) die('--action "<what happened>" is required');
  if (!args.who) die('--who "<name>" is required');

  const entry = {
    at: nowIso(),
    action: args.action,
    who: args.who,
    org: args.org || null,
    machine: machineFingerprint(),
    notes: args.notes || null,
  };
  m.custody.push(entry);
  saveManifest(dir, m);
  writeDerived(dir, m);
  console.log(`✓ custody entry recorded: ${entry.action} — ${entry.who}`);
}

// ------------------------------------------------------------------ seal

function cmdSeal(args) {
  const dir = caseDir(args);
  const m = loadManifest(dir);

  const problems = verifyItems(dir, m);
  if (problems.length) {
    problems.forEach((p) => console.error(`  ✗ ${p}`));
    die('cannot seal: integrity problems above');
  }

  m.sealed = true;
  m.sealed_at = nowIso();
  m.sealed_by = operator();
  m.custody.push({
    at: m.sealed_at,
    action: `package SEALED (${m.items.length} items)`,
    who: operator(),
    org: 'self (declarant)',
    machine: machineFingerprint(),
  });

  saveManifest(dir, m);
  writeDerived(dir, m);

  // the seal: digest of the manifest as written
  const manifestDigest = sha256File(path.join(dir, 'manifest.json'));
  fs.writeFileSync(
    path.join(dir, 'package.sha256'),
    `${manifestDigest}  manifest.json\nsealed_at ${m.sealed_at}\nsealed_by ${m.sealed_by}\n`
  );

  console.log(`✓ SEALED — ${m.items.length} items`);
  console.log(`  package digest: ${manifestDigest}`);
  console.log(`\n  Write that digest down somewhere outside this machine.`);
  console.log(`  It is what proves the package has not changed since ${m.sealed_at}.`);
}

// ------------------------------------------------------------------ verify

function verifyItems(dir, m) {
  const problems = [];
  for (const it of m.items) {
    const f = path.join(dir, it.relpath);
    if (!fs.existsSync(f)) {
      problems.push(`${it.id}: MISSING file ${it.relpath}`);
      continue;
    }
    const d = sha256File(f);
    if (d !== it.sha256) {
      problems.push(`${it.id}: HASH MISMATCH — manifest ${it.sha256}, on disk ${d}`);
    }
  }
  return problems;
}

function cmdVerify(args) {
  const dir = caseDir(args);
  const m = loadManifest(dir);
  const problems = verifyItems(dir, m);

  console.log(`case:   ${m.case}`);
  console.log(`items:  ${m.items.length}`);
  console.log(`sealed: ${m.sealed ? m.sealed_at : 'no'}`);

  if (m.sealed) {
    const sealFile = path.join(dir, 'package.sha256');
    if (fs.existsSync(sealFile)) {
      const recorded = fs.readFileSync(sealFile, 'utf8').split(/\s+/)[0];
      const actual = sha256File(path.join(dir, 'manifest.json'));
      if (recorded !== actual) {
        problems.push(
          `SEAL BROKEN — manifest.json changed after sealing (recorded ${recorded}, actual ${actual})`
        );
      } else {
        console.log(`seal:   INTACT (${actual})`);
      }
    }
  }

  if (problems.length) {
    console.log(`\n✗ ${problems.length} PROBLEM(S):`);
    problems.forEach((p) => console.log(`  ✗ ${p}`));
    process.exit(2);
  }
  console.log(`\n✓ all ${m.items.length} items verified — hashes match, nothing altered.`);
}

// ------------------------------------------------------------------ derived docs

function writeDerived(dir, m) {
  writeManifestTxt(dir, m);
  writeChainOfCustody(dir, m);
  writeSums(dir, m);
  writeAffidavit(dir, m);
}

function timeline(m) {
  return m.items
    .slice()
    .sort((a, b) => String(a.occurred || a.preserved_at).localeCompare(String(b.occurred || b.preserved_at)));
}

function writeManifestTxt(dir, m) {
  const L = [];
  L.push(`EVIDENCE PACKAGE MANIFEST`);
  L.push(`=`.repeat(60));
  L.push(`Case:         ${m.title}`);
  L.push(`Case ID:      ${m.case}`);
  L.push(`Jurisdiction: ${m.jurisdiction}`);
  L.push(`Declarant:    ${m.operator}`);
  L.push(`Created:      ${m.created}`);
  L.push(`Last updated: ${m.updated}`);
  L.push(`Status:       ${m.sealed ? `SEALED ${m.sealed_at}` : 'OPEN (not yet sealed)'}`);
  L.push(`Item count:   ${m.items.length}`);
  L.push('');
  L.push(`ITEMS (chronological by date of underlying event)`);
  L.push(`-`.repeat(60));
  for (const it of timeline(m)) {
    L.push(`[${it.id}] ${it.label}`);
    L.push(`      occurred:  ${it.occurred || '(not recorded)'}`);
    L.push(`      observed:  ${it.observed || '(not recorded)'}`);
    L.push(`      preserved: ${it.preserved_at}`);
    if (it.url) L.push(`      url:       ${it.url}`);
    if (it.source) L.push(`      source:    ${it.source}`);
    if (it.witness) L.push(`      witness:   ${it.witness}`);
    L.push(`      file:      ${it.relpath} (${it.bytes} bytes)`);
    L.push(`      sha256:    ${it.sha256}`);
    if (it.notes) L.push(`      notes:     ${it.notes}`);
    L.push('');
  }
  fs.writeFileSync(path.join(dir, 'MANIFEST.txt'), L.join('\n'));
}

function writeChainOfCustody(dir, m) {
  const L = [];
  L.push(`# Chain of Custody — ${m.title}`);
  L.push('');
  L.push(`Case ID: \`${m.case}\`  •  Declarant: ${m.operator}`);
  L.push('');
  L.push(
    `Every handling of this package is logged below in append-only order. ` +
      `Each entry records who touched it, when, and on what machine.`
  );
  L.push('');
  L.push(`| # | Timestamp (UTC) | Action | Who | Org | Machine |`);
  L.push(`|---|---|---|---|---|---|`);
  m.custody.forEach((c, i) => {
    L.push(
      `| ${i + 1} | ${c.at} | ${c.action} | ${c.who} | ${c.org || '—'} | ${c.machine || '—'} |`
    );
  });
  L.push('');
  L.push(`## Recording a handoff`);
  L.push('');
  L.push('When you give this package to anyone — an officer, an attorney, a platform —');
  L.push('log it before you hand it over:');
  L.push('');
  L.push('```');
  L.push(
    `node preserve.js custody --case ${m.case} \\`
  );
  L.push(`  --action "copy provided to investigating officer" \\`);
  L.push(`  --who "Det. <name>, badge <#>" --org "<agency>"`);
  L.push('```');
  fs.writeFileSync(path.join(dir, 'CHAIN_OF_CUSTODY.md'), L.join('\n') + '\n');
}

function writeSums(dir, m) {
  const lines = m.items.map((it) => `${it.sha256}  ${it.relpath}`);
  fs.writeFileSync(path.join(dir, 'SHA256SUMS'), lines.join('\n') + (lines.length ? '\n' : ''));
}

function writeAffidavit(dir, m) {
  const L = [];
  L.push(`# Declaration of ${m.operator} — DRAFT FOR ATTORNEY REVIEW`);
  L.push('');
  L.push(
    `> **This is a scaffold, not a legal document.** It is written to be handed to a ` +
      `licensed attorney in ${m.jurisdiction} who will decide its form, its contents, and ` +
      `whether it is filed at all. Do not sign or submit it as-is. Do not add anything ` +
      `to it you did not personally observe.`
  );
  L.push('');
  L.push(`## 1. Declarant`);
  L.push('');
  L.push(`I, **${m.operator}**, declare the following of my own personal knowledge.`);
  L.push('');
  L.push(`## 2. Preservation method`);
  L.push('');
  L.push(
    `Beginning ${m.created}, I preserved ${m.items.length} digital artifact(s) that I ` +
      `personally captured or personally observed. Each artifact was copied without ` +
      `modification and a SHA-256 cryptographic digest was computed at the time of ` +
      `preservation. Those digests are recorded in the attached MANIFEST.txt and SHA256SUMS. ` +
      `Any alteration to any artifact after preservation would change its digest and be detectable.`
  );
  L.push('');
  if (m.sealed) {
    L.push(
      `The package was sealed on ${m.sealed_at}. The digest of the sealed manifest is ` +
        `recorded in \`package.sha256\`.`
    );
    L.push('');
  }
  L.push(`## 3. Statement of facts`);
  L.push('');
  L.push(`<!-- Fill in below. Rules that keep this credible:`);
  L.push(`     - First person, past tense, only what YOU saw or heard.`);
  L.push(`     - Dates and times, as precise as you honestly can be.`);
  L.push(`     - "I do not recall" is a complete and acceptable answer. Use it.`);
  L.push(`     - Never state as fact who was behind an account. You do not know that.`);
  L.push(`       Write "an account using the display name X" — let the subpoena do the rest.`);
  L.push(`     - No characterizations, no adjectives about anyone's character. Facts only.`);
  L.push(`       The facts are worse for them than your adjectives are. -->`);
  L.push('');
  for (const it of timeline(m)) {
    L.push(`### ${it.id} — ${it.label}`);
    L.push('');
    L.push(`- **Date of event:** ${it.occurred || '_____________'}`);
    L.push(`- **How I observed it:** ${it.source || '_____________'}`);
    L.push(`- **What it shows:** _____________`);
    L.push(`- **Digest:** \`${it.sha256}\``);
    L.push('');
  }
  L.push(`## 4. Attestation`);
  L.push('');
  L.push(
    `I declare under penalty of perjury under the laws of the State of Ohio that the ` +
      `foregoing is true and correct to the best of my knowledge.`
  );
  L.push('');
  L.push(`_______________________________     Date: ______________`);
  L.push(`${m.operator}`);
  fs.writeFileSync(path.join(dir, 'AFFIDAVIT.md'), L.join('\n') + '\n');
}

module.exports = {
  sha256File,
  sha256String,
  slugify,
  verifyItems,
  writeDerived,
  timeline,
  parseArgs,
};

// ------------------------------------------------------------------ report

function cmdReport(args) {
  const dir = caseDir(args);
  const m = loadManifest(dir);
  const kind = (args.kind || 'platform').toLowerCase();
  const gen = { platform: reportPlatform, police: reportPolice, counsel: reportCounsel }[kind];
  if (!gen) die(`--kind must be one of: platform, police, counsel`);

  const body = gen(m);
  const out = path.join(dir, `REPORT_${kind.toUpperCase()}.md`);
  fs.writeFileSync(out, body);
  console.log(`✓ wrote ${out}`);
  console.log(`\n  Read it before you send it. Edit anything that isn't exactly true.`);
}

function itemTable(m) {
  const L = [`| ID | Date of event | What it shows | SHA-256 |`, `|---|---|---|---|`];
  for (const it of timeline(m)) {
    L.push(
      `| ${it.id} | ${it.occurred || '—'} | ${it.label} | \`${it.sha256.slice(0, 16)}…\` |`
    );
  }
  return L.join('\n');
}

function reportPlatform(m) {
  return `# Trust & Safety Report — ${m.title}

**Reporter:** ${m.operator}
**Date:** ${nowIso().slice(0, 10)}
**Evidence items attached:** ${m.items.length}

## What I am reporting

<!-- One paragraph. What happened, when it started, and what it is.
     Name the policy categories the platform itself uses — most platforms
     have explicit rules against each of these:
       - sharing private personal information (doxxing) of a third party
       - targeting a minor
       - coordinated/brigaded harassment directed off-platform
       - hateful conduct / slurs
     Cite the account by its channel URL, not by any real name. -->

## Why this is urgent

A minor's personal information was published. Live and recently-broadcast
content expires on this platform. **I am requesting that you preserve all
relevant broadcast recordings, clips, chat logs, and account records now**,
independent of whatever enforcement decision you reach. A law-enforcement
report has been filed in ${m.jurisdiction} and preservation may be required
for that proceeding.

## Evidence index

Each item below is attached and hash-verified. Digests are listed so you can
confirm nothing was altered between capture and delivery.

${itemTable(m)}

Full manifest with complete digests: \`MANIFEST.txt\`
Integrity list: \`SHA256SUMS\`

## What I am asking for

1. **Preserve** all account content, chat logs, and records associated with the
   reported channel pending law-enforcement process.
2. **Remove** the content that published a minor's private information.
3. **Enforce** your policies on the reporting account as you see fit.
4. **Provide me a case/reference number** for this report so it can be cited in
   the law-enforcement filing.

## Contact

<!-- Your contact info here. Use an email you monitor. -->

---
*Nothing in this report asks the platform to disclose any user's identity to me.
Identity attribution is a matter for law enforcement process.*
`;
}

function reportPolice(m) {
  return `# Law Enforcement Report Packet — ${m.title}

**Complainant:** ${m.operator}
**Jurisdiction:** ${m.jurisdiction}
**Date prepared:** ${nowIso().slice(0, 10)}
**Evidence items:** ${m.items.length}${m.sealed ? ` (package sealed ${m.sealed_at})` : ''}

> **Bring this printed, with the files on a USB drive or a link.** Ask for a
> report number before you leave. Write the officer's name and badge number in
> the chain-of-custody log the same day.

## 1. Summary of complaint

<!-- Three to five sentences, plain and unemotional.
     Who was harmed (your daughter — a minor), what was published about her,
     when, on what platform, and what followed (the calls to your mother,
     the calls to you). State facts. Let the facts carry it. -->

## 2. Potentially applicable Ohio statutes

These are provided for the officer's convenience. **The determination of what,
if anything, was violated belongs to law enforcement and the prosecutor — not
to the complainant.**

- **ORC 2917.21 — Telecommunications harassment.** Covers making or causing
  telecommunications to be made to another with purpose to abuse, threaten, or
  harass, including causing others to do so. Relevant to the calls placed to
  the complainant and to the complainant's mother.
- **ORC 2903.211 — Menacing by stalking.** Covers a pattern of conduct that
  knowingly causes another to believe the offender will cause physical harm or
  mental distress. Explicitly reaches conduct via electronic method, and
  includes causing others to engage in the pattern of conduct.
- **Additional considerations for the officer:** the publication of identifying
  information about a **minor**, and whether the conduct was coordinated across
  multiple participants, may bear on charging and on enhancement.

## 3. Preservation status

All evidence was preserved with SHA-256 digests computed at time of capture.
Digests are listed in \`SHA256SUMS\` and \`MANIFEST.txt\`. Chain of custody from
capture forward is logged in \`CHAIN_OF_CUSTODY.md\`.

**Platform preservation:** a preservation request has been submitted to the
platform's Trust & Safety team (see \`REPORT_PLATFORM.md\`). Platform-side
broadcast recordings and chat logs are subject to expiry and I am asking that
process be initiated promptly.

## 4. Evidence index

${itemTable(m)}

## 5. What I am NOT providing

I have made **no attempt to identify the real-world individual** behind the
reported account, and this packet contains no such claim. Attribution of an
online account to a person requires platform and ISP records obtainable through
legal process. I am asking law enforcement to make that determination through
proper channels.

## 6. Requested action

1. Take the report and issue a report number.
2. Initiate a preservation letter / legal process to the platform before
   broadcast content expires.
3. Advise whether a protection order is available on these facts.

## 7. Declarant

See \`AFFIDAVIT.md\` — draft, pending attorney review.
`;
}

function reportCounsel(m) {
  return `# Counsel Briefing Packet — ${m.title}

**Client:** ${m.operator}
**Jurisdiction:** ${m.jurisdiction}
**Prepared:** ${nowIso().slice(0, 10)}
**Evidence items:** ${m.items.length}${m.sealed ? ` (sealed ${m.sealed_at})` : ' (NOT YET SEALED)'}

## Posture

Client's minor daughter had identifying information published by an account on
a livestreaming platform. Publication was followed by telephone contact directed
at client and at client's mother, including racial slurs and abusive
characterizations of client.

Client has:
- preserved all artifacts with cryptographic digests and a chain-of-custody log;
- filed / is filing a platform Trust & Safety report requesting preservation;
- filed / is filing a police report in ${m.jurisdiction};
- **made no attempt to identify or contact the account holder**, and has taken no
  retaliatory action of any kind.

That last point is deliberate and should be preserved. Client has clean hands.

## Questions for counsel

1. **Civil exposure of the account holder.** Ohio recognizes public disclosure of
   private facts and intentional infliction of emotional distress. Is there a
   viable civil claim, and does the involvement of a minor plaintiff change the
   posture or the damages picture?
2. **Identifying the defendant.** Is a John Doe action with expedited third-party
   discovery to the platform (and downstream ISP) the right vehicle here? What is
   the realistic timeline and cost?
3. **Preservation.** Should a litigation hold / preservation letter go to the
   platform from counsel now, independent of the criminal referral? Platform
   retention windows for live broadcast content are short.
4. **Protection order.** Do these facts support a civil stalking protection order
   under ORC 2903.214, and is that faster relief than a damages action?
5. **Criminal track.** Should client push for prosecutorial referral under
   ORC 2917.21 / 2903.211, and does a parallel criminal matter help or complicate
   a civil claim?
6. **Minor's privacy in filing.** How do we plead without republishing the very
   information at issue — pseudonym, seal, redaction?
7. **What client must NOT do.** Please advise explicitly on conduct boundaries so
   client does not create counter-exposure.

## Evidence index

${itemTable(m)}

Integrity: every item carries a SHA-256 digest computed at preservation time.
Full digests in \`MANIFEST.txt\`; verify any time with \`preserve.js verify\`.
Chain of custody: \`CHAIN_OF_CUSTODY.md\`.
Draft declarant statement (unsigned, for your revision): \`AFFIDAVIT.md\`.

## Note on scope

This packet was assembled by the client using an automated preservation tool.
It contains no investigative work product, no identity attribution, and no legal
conclusions. It is raw preserved evidence plus an index.
`;
}

// ------------------------------------------------------------------ main

function usage() {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').replace(/^ \* ?/gm, ''));
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (cmd) {
    case 'init': return cmdInit(args);
    case 'add':
    case 'note': return cmdAdd(args);
    case 'url': return cmdUrl(args);
    case 'custody': return cmdCustody(args);
    case 'seal': return cmdSeal(args);
    case 'verify': return cmdVerify(args);
    case 'report': return cmdReport(args);
    case 'help':
    case '--help':
    case '-h':
    case undefined: return usage();
    default:
      die(`unknown command: ${cmd}\nRun: preserve.js help`);
  }
}

if (require.main === module) main();
