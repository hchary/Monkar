# narrative-poc

Proof-of-concept written to answer the feasibility question in `docs/TODO.md`'s
"Procedural narrative generation" entry: can the game generate
coherent narration (quest success/failure text, talent-gain flourishes, etc.) from tags,
names and descriptions already attached to quests, objectives, talents, items, etc. — and if
so, does that require an LLM?

This is throwaway analysis code, not intended to be merged into `functions/` or `src/` as-is.
See `report.md` for the full writeup; this README only covers what's runnable here.

## What's here

- `src/grammarEngine.js` — a tag-scored, multi-slot template grammar. It **reuses**
  `functions/src/textGeneration.js` (the French subject-agreement helper already shipped in
  production) rather than reimplementing it, to keep the POC an honest extension of the
  existing system instead of a from-scratch rewrite.
- `src/data/fragments.js`, `src/data/subjects.js` — sample tagged content, in the same shape
  as `worldData/verbPhrases` / `worldData/narrativeSubjects`, extended with a `tags`-per-slot
  structure (opening / climax / talent-growth) instead of one flat sentence pool.
- `src/markovDemo.js` — a tiny order-2 word Markov chain trained on a handful of the game's
  own sentences, included as a contrast: the other "non-LLM" avenue, and why it doesn't fit
  this use case.
- `demo.js` — runs a few scenarios end to end, including one approximating the
  fireball-vs-undead-army example from the task description.

## Running it

```
cd narrative-poc
node demo.js
```

No dependencies beyond Node.js itself (tested on Node 22). `package.json` sets
`"type": "commonjs"` because the repo root's `package.json` sets `"type": "module"`.
