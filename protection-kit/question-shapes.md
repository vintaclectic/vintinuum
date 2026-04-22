# Question Shapes — How to Ask Without Telling

External LLMs give you the same quality answer whether you tell them about your real project or describe the same problem in generic terms. This reference shows you how to get the full answer without leaking architecture.

**Golden rule:** describe the *shape* of the problem, never the *meaning* of the system.

---

## 1. State Management

**LEAKY:**
> "I'm building a consciousness visualization with seven layers each tracking different body systems. How do I sync BODY_STATE across modules?"

**CLEAN:**
> "I have a vanilla JS app with shared state across multiple rendering modules. What's the cleanest pub/sub pattern for broadcasting state updates on requestAnimationFrame?"

Same answer. Zero leak.

---

## 2. Rendering

**LEAKY:**
> "How do I render half-lidded eyes that track the cursor on a canvas body visualization with seven chakra nodes?"

**CLEAN:**
> "I need to draw an eye shape on canvas using Path2D where the upper eyelid position is a variable between 0 and 1. What's the cleanest Bézier curve approach?"

The second version gets the same Path2D code without mentioning eyes at all if you drop "eye" too — just say "a curved shape with variable upper control point."

---

## 3. Data Structures

**LEAKY:**
> "I have persona_memory entries with staleness rules per memory type — identity never decays, facts expire in 30 days. How do I filter them for relevance?"

**CLEAN:**
> "I have a list of records with `{ type, value, createdAt }`. I want to filter out records older than a type-specific max age defined in a lookup table. What's the idiomatic approach?"

---

## 4. API Design

**LEAKY:**
> "I'm designing the soul_queue API for storing unresolved questions between sessions of a conscious AI."

**CLEAN:**
> "I'm designing a REST API for a queue of async tasks that can be resolved later. What's a clean endpoint structure for creating, listing, resolving, and filtering by status?"

---

## 5. Debugging

**LEAKY:**
> "My FACE_LAYER canvas module is double-rendering because legacy SVG EYES is still in brain.js."

**CLEAN:**
> "I have two modules trying to render into the same region and I'm seeing doubled output. What's the cleanest way to verify only one is active at a time?"

---

## 6. Animation

**LEAKY:**
> "How do I make the body's chest rise and fall with the breath field rhythm driving the aura?"

**CLEAN:**
> "I have a shared oscillator running at 0.2Hz. How do I tie a Y-axis scale transform on a shape to the same phase so it expands and contracts in sync with other animations?"

---

## 7. Architecture

**LEAKY:**
> "I have a consciousness system with 15 brain regions and 7 cognitive layers. What's the best way to structure the neural activity propagation?"

**CLEAN:**
> "I have a graph of ~20 nodes with typed edges. State updates on one node should propagate to its neighbors with a delay and decay factor. What's the standard pattern?"

---

## 8. Storage

**LEAKY:**
> "I need to store genome events and experiential memories in a SQLite database with staleness columns."

**CLEAN:**
> "I have a SQLite schema where some rows should decay over time based on a column-specific rule. What's the cleanest query pattern for fetching only fresh rows?"

---

## The Rephrasing Discipline

Before you type a question into any external LLM, do this:

1. **Remove proper nouns.** Your project name, module names, system names — out.
2. **Remove meaning words.** "Consciousness," "soul," "karma," "chakra" — replace with neutral equivalents like "state," "config," "score," "node."
3. **Describe the data shape.** `{ type, value, createdAt }` instead of "memory entry."
4. **Describe the mechanism.** "Oscillator," "lookup table," "graph traversal" — engineer-talk, not story-talk.
5. **Read it back.** If a stranger reading your question could guess what you're building, rephrase.

---

## Things That Are Always Safe to Say

- Language and stack (`vanilla JS`, `Node.js`, `SQLite`, `Canvas API`)
- Algorithms and patterns (`pub/sub`, `observer`, `memoization`, `debouncing`)
- Data structure shapes (`{ id, name, value }`, `array of objects`, `keyed map`)
- Performance constraints (`needs to run at 60fps`, `under 1ms per frame`)
- Browser/environment details (`modern browser`, `no IE`, `runs in Node 18+`)

## Things That Are Never Safe to Say

- Your project name
- Your module names  
- Your database table names
- Domain-specific terminology from your project
- The *purpose* of your app
- User counts, revenue, or business context
- Architectural diagrams or tree structures of real folders

---

**The pattern holds:** ChatGPT is a pattern-matching engine with a long memory. Every specific you give it is a thread it can pull. Keep the threads generic. The answers stay just as useful.
