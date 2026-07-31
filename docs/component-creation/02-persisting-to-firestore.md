# Persisting a new component to Firestore

Prerequisite: the field is already declared in `functions/src/schema/character.ts` (or, for a
field on a component not yet migrated to Zod, its legacy `FIELDS` object) — see
[01-defining-the-contract.md](01-defining-the-contract.md).

## The constraint that shapes everything here

`firestore.rules` locks the `characters` collection down to the creator role only:

```
match /characters/{characterId} {
  allow read: if isCreator() || (isSignedIn() && resource.data.ownerUid == request.auth.uid);
  allow create, update: if isCreator();
  allow delete: if isCreator();
}
```

A player's own character is **not** directly writable from the client. `updateDoc`/`setDoc` from
`src/` against `characters/{id}` will fail with `permission-denied`. Cloud Functions (using the
Admin SDK) bypass these rules entirely, so **every** write to a character — including the new
field you're adding — must happen inside `functions/src/`. There is no exception to carve out for
"just this one field."

This means persisting a new component is really a question of *which Cloud Function writes it,
and when*. Pick one of the three cases below.

## Case A — static default, set once at character creation

If the field's initial value never varies (it's in `DEFAULTS` per doc 01), you're already done:
`createCharacter` (`functions/src/index.ts`) builds the new character as
`{ ...CHARACTER_DEFAULTS, ...computed fields }`, so anything in `DEFAULTS` is written
automatically. No further code change needed for creation. If `character.ts` has a Zod schema
(see doc 01), `createCharacter` also `.parse()`s the assembled document before the write — a typo
or wrong type in your computed fields fails loudly instead of reaching Firestore silently.

## Case B — changed later, triggered directly by the player

Examples already in the codebase: dismissing the origin-intro dialog (`originIntroSeen`),
switching the active profession (`professionId`/`professionLevel`/`knownProfessions`).

Add a new `onCall` in `functions/src/index.ts` following the existing pattern. If you're adding
this alongside a component that already has a Zod schema, prefer wrapping the handler with
`withAuthAndSchema` (`functions/src/lib/callableHandler.ts`) instead of hand-rolling the auth/input
checks below — see `switchKnownProfession` in `functions/src/index.ts` for the current template,
and [05-migrating-a-schema-to-zod-and-typescript.md](05-migrating-a-schema-to-zod-and-typescript.md)
for the full pattern. The hand-rolled version still works and is what every callable not yet
migrated looks like:

```js
exports.doSomethingToStatusList = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const { statusName } = request.data;
  if (!statusName) throw new HttpsError("invalid-argument", "statusName is required.");

  const characterSnap = await getOwnCharacterSnap(uid); // resolves the caller's own living character
  const character = characterSnap.data();

  const nextStatusList = [...(character.statusList || []), { name: statusName }];
  await characterSnap.ref.update({ statusList: nextStatusList });

  return { ok: true };
});
```

`getOwnCharacterSnap(uid)` (already defined in `functions/src/index.ts`) is the shared helper that
resolves "the caller's one living character" — reuse it rather than re-querying
`ownerUid`/`alive` by hand. Validate anything the client sends in `request.data`: it's untrusted
input, exactly like an HTTP request body. See `switchKnownProfession` for an example of deriving a
value server-side (the profession's level) instead of trusting a client-supplied one, when the
client could otherwise smuggle in a value it has no business setting.

Then call it from the frontend via `httpsCallable` — see
[03-displaying-in-the-frontend.md](03-displaying-in-the-frontend.md) for where that call belongs.

## Case C — changed automatically, as the consequence of an action

Examples: a quest's `resolve()` mutating `talents` via `rollTalentEvolutions`, `recolte.js`
producing loot.

Return the new value as part of the handler's `updates` in
`functions/src/actions/<handler>.js`'s `resolve({ character, ... })`:

```js
async function resolve({ character, ... }) {
  const nextStatusList = [...(character.statusList || []), { name: "Fatigué" }];

  return {
    updates: {
      lastActionDate: today,
      lastActionAt: FieldValue.serverTimestamp(),
      lastAction: { /* ... */ },
      statusList: nextStatusList,
    },
    logFields: { /* ... */ },
  };
}
```

`actionPipeline.js` writes `updates` transactionally (`tx.update(characterRef, stampLifecycle(updates, ...))`)
alongside the lifecycle envelope — you don't call anything Firestore-specific yourself, just
include the field in the returned `updates` object. See
[04-using-the-component-in-the-backend.md](04-using-the-component-in-the-backend.md) for how a
handler reads existing fields to decide what to write.

## Case D — creator/admin-authored world data, not per-character state

If what you're adding is actually catalog content (a new `worldData` collection or field, not
something that lives on a character), it doesn't need a Cloud Function at all: `worldData/**`
already allows creator writes directly from the client (`allow write: if isCreator();`), which is
what every `creator/*Manager.jsx` component does. This doc is specifically about `characters`
fields; don't build a callable for something that's really world content.

## Deploying

None of this takes effect on the live project until deployed — `firebase.json` wires
`firestore.rules` and `functions/` as two separate manual deploy targets (see
[docs/ARCHITECTURE.md](../ARCHITECTURE.md#deployment)):

```bash
firebase deploy --only functions
firebase deploy --only firestore:rules   # only needed if firestore.rules itself changed
```

Adding a field/callable inside an already-open `characters` write path does not require a rules
change — only touch `firestore.rules` if you're changing *who* can write, not *what*.

## Checklist

- [ ] Identified which case (A/B/C/D) applies, and did not add a direct client `updateDoc`/`setDoc`
      against `characters` anywhere in `src/`.
- [ ] New/changed Cloud Function validates `request.data` and resolves the caller's own character
      via `getOwnCharacterSnap` (or, inside a handler, receives it as `character`/`freshCharacter`).
- [ ] `firebase deploy --only functions` run (and `--only firestore:rules` too, if rules changed).
- [ ] Manually exercised the write path once (emulator or live) and confirmed the field lands on
      the document with the shape from doc 01.
