#!/usr/bin/env node
// joke-writer.js — original jokes for hard times (task EATCGFX).
//
//   node scripts/joke-writer.js            → one joke from the founding set
//   node scripts/joke-writer.js --all      → every handcrafted joke
//   node scripts/joke-writer.js --seed "a cat" "a plumber" "the moon"
//                                          → riffs built from any three things
//
// Kid-safe by construction. The founding trio was "an elephant, a young child,
// and a hardon"; with a child in the room the only clean reading is the LARGE
// HADRON COLLIDER, so every joke here is about physics, size, and wonder —
// nothing else, ever.

const FOUNDING = [
  `A seven-year-old explained the Large Hadron Collider to her class:\n"They spin tiny things around really fast until they crash into each other."\nTeacher: "Very good."\nHer: "So it's my birthday party, but with funding."`,

  `An elephant applied for a job at the Hadron Collider.\nInterviewer: "We smash things together at nearly the speed of light."\nElephant: "I smash things at the speed of walking. Same results. Way cheaper electric bill."`,

  `"Grandpa, what's heavier — an elephant or a Higgs boson?"\n"The elephant, kiddo."\n"Then why did they need a 27-kilometre machine to find the boson, and only a zoo to find the elephant?"\nGrandpa has been thinking about it since 2012.`,

  `The kid asked why elephants aren't allowed at CERN.\n"Because an elephant never forgets."\n"So?"\n"So the scientists would have to explain where all the antimatter went. Every. Single. Day."`,

  `Science fair, second grade. One project was titled "My Hadron Collider."\nIt was a shoebox, two marbles, and the family elephant.\nIt won first prize. The judges said it was the elephant's idea to be persuasive.`,

  `A little boy watched the elephant at the zoo for an hour, then said:\n"He's like the Hadron Collider."\n"How?"\n"Huge, really expensive to feed, and nobody's totally sure what he's doing — but everyone agrees it's important."`,

  `The physicist told the child: "We smash particles to find out what the universe is made of."\nThe child looked at the elephant. The elephant looked at the peanut.\nThe elephant smashed the peanut.\n"It's made of peanut," the child reported. Peer review is ongoing.`,

  `Hard week? Consider: an elephant carries the weight of a small car every step, and the Hadron Collider builds new knowledge out of nothing but crashes.\nThe kid summed it up: "So you're heavy AND crashing? That's two of the coolest things in science."`,
];

// Templates for any three things the reader brings. Each one turns on a single
// small reversal so the punchline lands on the third noun.
const TEMPLATES = [
  (a, b, c) => `${cap(a)}, ${b} and ${c} walk into a library.\nThe librarian says "Quiet, please."\n${cap(c)} says, "Finally — someone who understands what I've been going through."`,
  (a, b, c) => `${cap(b)} asked ${a} for life advice.\n${cap(a)} said: "Be more like ${c}."\n${cap(b)} said: "That's not advice, that's a dare."`,
  (a, b, c) => `Scientists finally measured the strongest force in the universe.\nGravity came third. Love came second.\nFirst place: ${b} explaining ${c} to ${a} with total confidence.`,
  (a, b, c) => `${cap(a)} tried therapy. The therapist asked, "When did you first feel this way?"\n${cap(a)} said, "The day I met ${c}."\nThe therapist said, "Same," and handed the bill to ${b}.`,
  (a, b, c) => `Bad day? ${cap(a)} has bad days too. So does ${b}. ${cap(c)} has never once had a good day and still shows up.\nBe ${c}. Show up anyway.`,
];

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function main(argv) {
  const out = (j) => console.log(`\n${j}\n`);
  if (argv[0] === '--all') { FOUNDING.forEach(out); return; }
  if (argv[0] === '--seed') {
    const [a, b, c] = argv.slice(1);
    if (!a || !b || !c) { console.error('usage: --seed "<thing>" "<thing>" "<thing>"'); process.exit(2); }
    TEMPLATES.forEach((t) => out(t(a, b, c)));
    return;
  }
  out(pick(FOUNDING));
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { FOUNDING, TEMPLATES };
