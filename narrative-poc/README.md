# narrative-poc

Started as the proof-of-concept answering the feasibility question in `docs/TODO.md`'s "Procedural
narrative generation" entry: can the game generate coherent narration (quest result text,
talent-progress flourishes, ...) from tags, names and descriptions already attached to quests,
objectives, talents, items — and does that require an LLM?

The answer is in [`report.md`](report.md) (yes; no LLM needed for the default path), and the feature
has since **shipped** — see [`docs/NARRATIVE-GENERATION.md`](../docs/NARRATIVE-GENERATION.md) for how
it works and how to author content for it.

What remains here is therefore no longer a prototype of the engine, but a **demo harness over the
real one**, kept because the report cites its output and because it is the only way to see a page of
generated text without a Firestore catalog and a 24-hour wait.

## What's here

- `demo.js` — runs seven scenarios end to end and prints the distinct paragraphs each can produce.
  It imports the **production** generator (`functions/src/textGeneration.js`, plus
  `partirEnQuete.js`'s `buildNarrativeContext` / `narrateQuestSuccess`) and supplies sample content in
  place of Firestore. Nothing about the generation logic is reimplemented, so its output is the game's
  output for that catalog.
- `src/data/catalog.js` — the sample content: 6 narrative subjects and 21 verb phrases, in the exact
  Firestore shapes (`worldData/tags`, `narrativeSubjects`, `verbPhrases`, `quests`, `talents`).
- `DEMO.md` — the generated demonstration, written from `node demo.js --markdown`.
- `src/markovDemo.js` — a tiny order-2 word Markov chain trained on a handful of the game's own
  sentences. Kept as the recorded contrast: the *other* non-LLM avenue, and why it doesn't fit (see
  `report.md` § 2.2).
- `report.md` — the full analysis, plus § 4, the quality review of the solution and the record of
  what had to change between plan and implementation.

`src/grammarEngine.js` and `src/data/fragments.js` are gone: they were the POC's own engine and
fragment pool, superseded by the shipped code. A second implementation would only drift.

## Running it

```
cd narrative-poc
node demo.js
```

Regenerating the demonstration document after changing the catalog or the engine:

```
node demo.js --markdown
```

(then paste under `DEMO.md`'s hand-written preamble, or re-run the command that built it — the file
says so at the top.)

No dependencies beyond Node.js itself (tested on Node 22). `package.json` sets `"type": "commonjs"`
because the repo root's `package.json` sets `"type": "module"`. The random draw is seeded, so runs are
reproducible; the live game draws unseeded.
