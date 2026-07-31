# Using a new component in the backend

Prerequisite: the field exists on real character documents — see
[02-persisting-to-firestore.md](02-persisting-to-firestore.md).

"Backend" means `functions/src/` — the only place a character document is ever written (see doc
02), and the authoritative place any game-logic decision based on it must be made. The frontend is
allowed to read a field for display or to *mirror* a decision for UX, but it is never the source of
truth for whether something is allowed or what a field becomes.

## Reading a field

Wherever a Cloud Function or handler has a `character` object in scope (`request` data doesn't
carry it — it's always fetched from Firestore, e.g. via `getOwnCharacterSnap(uid)` in
`functions/src/index.ts`, or received as the `character`/`freshCharacter` parameter inside a
handler's `resolve()`), read it the same defensive way as the frontend:

```js
const statusList = character.statusList || [];
```

Never assume presence — the same "no migration on schema change" caveat from doc 03 applies here.

## Gating whether an action is available: action conditions

If the new field should determine whether a player *can* perform some action (e.g. "cannot act
while afflicted by the `'Malade'` status"), add a predicate to
`functions/src/lib/actionConditions.js`'s `PREDICATES` registry:

```js
hasStatus: {
  reason: "Ce statut vous en empêche.",
  test(condition, ctx) {
    const statusName = requiredString(condition.statusName);
    return statusName != null && !(ctx.character?.statusList || []).some((s) => s.name === statusName);
  },
},
```

Register it in `CONDITION_TYPES` too if a creator should be able to pick it from the action-editing
form (`{ value: "hasStatus", label: "N'a pas le statut" }`) — see `functions/src/lib/actionCatalog.js`
for how `evaluateAvailability` runs the whole condition list.

**This file is deliberately duplicated**, byte-for-byte identical bodies, in
`src/lib/actionConditions.js`: the frontend copy decides what to *show* (UX), this backend copy
decides what to *allow* (authority) inside `actionPipeline.js`. `functions/` is CommonJS with no
build step shared with the Vite app, so there's no way to import one from the other — when you add
a predicate here, add the identical one there, or the two will silently disagree the next time a
condition is authored against it. This is the same duplicated-pure-module convention as
`actionLifecycle.js`/`professions.js` (see [ARCHITECTURE.md](../ARCHITECTURE.md)).

## Mutating a field as a consequence of an action

Inside a handler's `resolve({ character, ... })` (`functions/src/actions/<handler>.js`), read
whatever existing fields you need to decide the outcome, then include the new value in the
returned `updates` — see doc 02's Case C for the exact shape. `recolte.js`'s `masteryLevelSum` is a
good template for "read several character fields to compute something before deciding the
outcome":

```js
function masteryLevelSum(character, professionIds) {
  const levelByProfessionId = new Map(
    (character.knownProfessions || []).map((known) => [known.professionId, known.level])
  );
  if (character.professionId) levelByProfessionId.set(character.professionId, character.professionLevel);
  return (professionIds || []).reduce((sum, id) => sum + (levelByProfessionId.get(id) || 0), 0);
}
```

A handler never writes to Firestore directly — it returns `{ updates, logFields }` and
`functions/src/lib/actionPipeline.js` applies `updates` transactionally, stamped with the shared
lifecycle envelope (`stampLifecycle`, `functions/src/lib/actionEffects.js`). Don't call
`characterRef.update(...)` from inside a handler.

## Mutating a field outside the action-resolution flow

If the change isn't a consequence of "performing an action" (a standalone callable like
`switchKnownProfession` or `acknowledgeOriginIntro`), that's doc 02's Case B — write it there, not
here; this doc is about reading/deciding with a field once it exists, not about the write
mechanics.

## Testing

`functions/` uses Node's built-in test runner (`npm test`, `node --test`). Pure logic — a
predicate's `test()`, a handler's helper function like `masteryLevelSum` — should get its own
`*.test.js` file next to the module it tests, following `wounds.test.js` and
`actionConditions.test.js`: construct a minimal `character` object with just the fields the
function reads, and assert on the return value. You don't need Firestore or the emulator to test
this logic; only the Cloud Function's own request/transaction plumbing needs that.

## Checklist

- [ ] Field read defensively (`|| []` / `?.`) everywhere it's consulted.
- [ ] If it gates action availability: predicate added to **both**
      `functions/src/lib/actionConditions.js` and `src/lib/actionConditions.js`, bodies identical.
- [ ] If it changes as a result of an action: handled inside a handler's `resolve()`, returned via
      `updates`, never written with a direct `characterRef.update(...)` call from within the
      handler.
- [ ] New pure logic has a `*.test.js` file; `npm test` (inside `functions/`) passes.
- [ ] Cross-checked against [01-defining-the-contract.md](01-defining-the-contract.md): the shape
      actually read/written here matches what's documented in `functions/src/schema/character.ts`.
