# Circle Translator — Mapping Reference

This file lists every real project-specific term and its generic stand-in. Keep this file **local only**. Never paste its contents into any external LLM. Consult it before every session. Add new mappings when you notice a real term you want protected.

## How to Use

- Before pasting code: every term on the left must be replaced with its right-hand equivalent
- After the LLM answers: every right-hand term in its response must be replaced back with the left-hand version to apply to your real codebase
- The included `sanitizer.js` and `restorer.js` automate this using `mapping.json` — this markdown file is the human-readable companion

## Discipline

- Always update `mapping.json` when you add a new term here
- Pre-load your mental map before composing a question — sanitizer covers code, but YOU have to sanitize freeform English
- If you catch yourself typing a real name into a chat window, stop, close the window, open a new session, rephrase

## Pre-Filled Example Mappings

These are the common Vintinuum-project terms. Add more as needed.

| Real term | Generic stand-in |
|---|---|
| Vintinuum | my app |
| DirHaven | game project |
| consciousness layers | state buckets |
| seven layers | seven categories |
| BODY_STATE | userState |
| BODY_FRAME | TickEvent |
| body/face.js | components/display.js |
| body/skin.js | components/outerLayer.js |
| body/geometry.js | components/layoutConfig.js |
| body/coherence.js | components/stateManager.js |
| body/loop.js | components/scheduler.js |
| body/peel.js | components/sidebar.js |
| body/chakras.js | components/nodes.js |
| body/radar.js | components/chart.js |
| brain.js | main.js |
| brain.html | index.html |
| soul.json | config.json |
| soul-queue | task queue |
| genome | user data |
| genome events | user events |
| gene expression | data update |
| karma | score |
| karmex | extended score |
| KarmaEngine | ScoreEngine |
| thirdeye | interaction system |
| persona_memory | userMemory |
| experiential_memories | eventLog |
| subconscious_thoughts | backgroundProcess |
| FACE_LAYER | DisplayModule |
| SKIN_LAYER | OuterModule |
| RENDER_HUB | FrameScheduler |
| neural | category_a |
| emotional | category_b |
| subconscious | category_c |
| somatic | category_d |
| immune | category_e |
| metabolic | category_f |
| genetic | category_g |
| dopamine | metric_1 |
| serotonin | metric_2 |
| GABA | metric_3 |
| norepinephrine | metric_4 |
| arousal | metric_5 |
| valence | metric_6 |
| awakeness | metric_7 |
| chakra | node |
| chakra nodes | display nodes |
| half-lidded | variable position |
| aura | field |
| breath field | background field |
| vintinuum-api | backend API |
| daily-evolution | nightly job |
| crystallization | summary document |

## Your Custom Mappings

Add your own below. Keep the format consistent — `real_term | generic_stand_in` — so tools can parse it if needed.

| Real term | Generic stand-in |
|---|---|
| | |
| | |
| | |

## Notes

- Mappings are case-sensitive where code identifiers are concerned (`BODY_STATE` replaces only `BODY_STATE`, not `body_state`)
- File-path mappings should cover both forward and backward slashes if you work across OSes
- If a term is a substring of another term, list the longer one first in `mapping.json` so it replaces before the shorter one
