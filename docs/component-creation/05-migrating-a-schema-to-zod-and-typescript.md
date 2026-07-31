# Migrating a component's schema to Zod + TypeScript

This is a design/implementation guide for converting one more `functions/src/schema/*.js` file
(and, optionally, its write path) to the Zod + TypeScript pattern piloted on `character` and
`profession`. It assumes you've read [01-defining-the-contract.md](01-defining-the-contract.md)
and [02-persisting-to-firestore.md](02-persisting-to-firestore.md).

## Why this exists

`functions/src/schema/*.js` was pure documentation: a hand-written `FIELDS`/`DEFAULTS` object pair
that nothing in the codebase ever read. A client creator (`src/components/creator/*Manager.jsx`)
and/or a Cloud Function handler independently re-derived the same field list as a raw object
literal, kept in sync with the schema file by developer discipline alone — a typo or wrong type
reached Firestore undetected. Zod turns the schema file into the actual runtime validator (and,
via TypeScript, the static type too), so there is exactly one definition per component instead of
two or three hand-synced copies.

`character` and `profession` are already converted — treat them as the reference implementation,
not this doc's prose, whenever the two disagree:

- `shared/schema/character.ts`, `shared/schema/profession.ts` — the Zod schemas themselves.
- `functions/src/schema/character.ts`, `functions/src/schema/profession.ts` — the
  collection-documentation wrapper this project's schema convention requires (see `CLAUDE.md`).
- `functions/src/lib/callableHandler.ts` — the `withAuthAndSchema` helper.
- `functions/src/index.ts`'s `createCharacter` / `switchKnownProfession` — a Cloud Function
  validating both its input and the document it writes.
- `src/components/creator/ProfessionsManager.tsx` — a client creator validating before `batch.set`.

**Scope discipline**: migrate one component (and, if relevant, the one handler/creator that writes
it) per change. Converting all 19 remaining `functions/src/schema/*.js` files in one pass was
deliberately ruled out for the pilot and the same reasoning still applies — it produces a large,
hard-to-review diff for a mechanical change that's just as safe to do incrementally.

## Step 1 — decide where the schema lives: `shared/` or `functions/`-only

Default to `shared/schema/<name>.ts`, even if nothing on the client writes or reads this component
yet. That was the call made for `character` itself: nothing in `src/` constructs a character
document today, but character is the component new features constantly attach to, so it follows
the shared-first pattern from the start rather than needing a migration later the moment a client
feature needs it. Apply the same default here unless you have a concrete, current reason not to.

The one real reason to keep a schema **functions-only** (`functions/src/schema/<name>.ts` with no
`shared/` counterpart) is a field whose type is only constructible with a server-only import — the
same reason `character`'s `createdAt`/`lastActionAt` aren't fully isomorphic. Firestore
`Timestamp`/`FieldValue` from `firebase-admin/firestore` is the recurring case (check the legacy
`FIELDS` entries for `type: "timestamp"`); if a component has one of those, split it the way
`character.ts` does:

```ts
// shared/schema/<name>.ts — declare the timestamp field as z.unknown()
someTimestampField: z.unknown().describe("Firestore Timestamp or serverTimestamp() sentinel; refined server-side."),

// functions/src/schema/<name>.ts — extend with the real, validated type
export const SomeDocumentSchema = SharedSomeDocumentSchema.extend({
  someTimestampField: FirestoreTimestampOrSentinel, // see character.ts for this helper
});
```

Consider factoring `FirestoreTimestampOrSentinel` out of `functions/src/schema/character.ts` into a
shared functions-only helper (e.g. `functions/src/schema/_firestoreTypes.ts`) once a second schema
needs it, rather than copy-pasting the `z.custom<...>` guard a third time.

## Step 2 — port `FIELDS`/`DEFAULTS` to a Zod schema

For each `FIELDS` entry, translate mechanically:

| Legacy `FIELDS` entry | Zod equivalent |
| --- | --- |
| `{ type: "string", description: "..." }` | `z.string().describe("...")` |
| `{ type: "number", ... }` | `z.number().describe("...")` |
| `{ type: "boolean", ... }` | `z.boolean().describe("...")` |
| `{ type: "array", description: "[{ id, name }] ..." }` | `z.array(z.object({ id: z.string(), name: z.string() })).describe("...")` — spell out the inner shape in Zod, don't leave it as prose |
| `{ type: "map", description: "{ id, name } ..." }` | `z.object({ id: z.string(), name: z.string() }).describe("...")` |
| `{ type: "timestamp", ... }` | See step 1 — `z.unknown()` in `shared/`, refined in `functions/` |
| `optional: true` | `.optional()` |
| `nullable: true` | `.nullable()` |

Port every field 1:1 — don't drop or silently rename anything. If a field's real-world shape is
looser than the old one-line `description` implied (e.g. `talents[]` entries actually have 8 named
properties, not just "an object"), that's a strict improvement worth making explicit in the Zod
shape — this already happened for `character.talents`/`origin`/`region`/`knownProfessions` during
the pilot.

For `DEFAULTS`, don't hand-write a second object. Add `.default(value)` to each defaulted field
inside the schema, then derive `DEFAULTS` the same way `profession.ts`/`character.ts` do:

```ts
const DEFAULTED_KEYS = ["description", "someArrayField" /* ... */] as const;

export const DEFAULTS = SomeDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
```

This makes it structurally impossible for `DEFAULTS` to drift from the schema's own `.default()`
values — the old hand-written `DEFAULTS` object had no such guarantee.

## Step 3 — write the `functions/src/schema/<name>.ts` wrapper

Keep the collection-level header comment from the `.js` file verbatim (collection path, who
writes it, what the document id means — this project's schema convention requires it, see
`CLAUDE.md`). If the schema is fully isomorphic (no server-only fields), the wrapper is a pure
re-export, exactly like `functions/src/schema/profession.ts`:

```ts
export { SomeDocumentSchema, DEFAULTS } from "../../../shared/schema/<name>";
export type { SomeDocument } from "../../../shared/schema/<name>";
```

Delete the old `.js` file in the same change — don't leave both around.

## Step 4 — before converting, check who else `require()`s this schema file

`node --test` runs `functions/src/**/*.test.js` directly against the source files, **not** through
the esbuild bundle — plain Node can't parse TypeScript syntax. `character.ts`/`profession.ts` were
safe to convert because nothing else in the repo `require()`s a schema file except `index.ts`
(already converted). Before converting another one, grep for it:

```bash
grep -rn "require(.*/schema/<name>" functions/src
```

If a still-plain-`.js` file requires the schema you're about to convert (and that `.js` file has
tests exercised by bare `node --test`), you have two choices: convert that consumer to `.ts` too in
the same change (adjusting its tests if needed), or defer this schema's migration until its
consumers are converted. Don't leave a `.js` file with a broken `require()` of a `.ts` file that
only resolves inside the bundled deploy artifact.

## Step 5 — wire it into the write path (optional, do only if you're touching that code anyway)

Converting the schema file alone (steps 1–4) already gets you the CLAUDE.md documentation
contract and a Zod schema ready to import. Actually validating against it at the write boundary is
a separate, optional step — do it when you're already touching that creator/handler, the same way
the pilot only rewired `createCharacter`/`switchKnownProfession`, not all six callables.

**Client creator writing this collection directly** (a `worldData/**` collection like `talent`,
`origin`, `trainerType`, etc. — see doc 02's Case D): follow
`src/components/creator/ProfessionsManager.tsx`. Rename the file `.jsx` → `.tsx`, import the shared
schema, `safeParse` the candidate object before `batch.set`/`setDoc`, and render `parsed.error` via
a local `formError` state on failure instead of writing. Check
`grep -rn "from [\"'].*<OldName>Manager[\"']" src` first (like `ProfessionsManager` is imported by
`ActionsManager.jsx`, `CharactersOverview.jsx`, `OriginsManager.jsx` for `matchesProfession`) —
those imports are extension-less and Vite resolves `.tsx` the same as `.jsx`, so they don't need
changes, but confirm there's no re-export of something the rename would break.

**Cloud Function handler writing this collection** (an `onCall` in `functions/src/index.ts`,
following doc 02's Case B): wrap it with `withAuthAndSchema` from
`functions/src/lib/callableHandler.ts` instead of hand-rolling the auth/field-presence checks —
see `switchKnownProfession` for the template. Declare the callable's *input* shape inline, next to
the handler (it's a request contract, not a persisted-document schema, so it doesn't belong in
`functions/src/schema/`):

```ts
const SomeCallableInput = z.object({ someId: z.string().min(1, "someId is required.") });

exports.someCallable = onCall(
  withAuthAndSchema(SomeCallableInput, async ({ uid, data }) => {
    // data is already validated & typed via z.infer
  })
);
```

The four callables not touched by the pilot (`performAction`, `acknowledgeAction`,
`acknowledgeOriginIntro`, `debugAdvanceTime`) and the three action handler files
(`functions/src/actions/recolte.js`, `artisanat.js`, `partirEnQuete.js`) are exactly this kind of
follow-up. The three action files don't go through `onCall`/`withAuthAndSchema` directly — their
`prepare({ db, character, actionType, payload })` reads `payload` by hand
(`const recetteId = payload?.recetteId; if (!recetteId) throw new HttpsError(...)`). If you convert
one, replace that block with a small inline Zod schema and a `safeParse`/`parse` call rather than
trying to force the `onCall`-shaped `withAuthAndSchema` wrapper onto a `prepare()` function — the
validation *concept* (declare the shape once, reject loudly on mismatch) transfers, the wrapper
does not.

**Document written server-side, assembled inline** (like `characters`, per doc 02's Case A/C): add
a `SomeDocumentSchema.parse(...)` call right before the write, as a safety net against a typo'd
field in the handler itself — see `createCharacter`'s `characterRef.set(CharacterDocumentSchema.parse(characterDoc))`.

## Step 6 — verify

1. `cd functions && npm run typecheck` (`tsc --noEmit`) and, if you touched client code, `npm run
   typecheck` at the repo root — both zero errors.
2. `cd functions && npm test` (`node --test`) — must still pass. If you converted a file with its
   own `*.test.js`, confirm those tests still import correctly (see step 4).
3. `cd functions && npm run build` — confirm `functions/lib/index.js` still builds as one file with
   no unresolved relative `require`/`import` of anything under `shared/`.
4. If you wired validation into a live write path (step 5), exercise it once against the emulator
   or a manual client flow: a valid submission still succeeds, and a deliberately invalid one (a
   blank required field, a wrong type) is rejected with a clear error instead of reaching
   Firestore.

## What NOT to do

- Don't convert all remaining schema files in one change — one component (plus, optionally, its one
  write path) at a time.
- Don't invent a new "isomorphic vs. server-only" split per component from scratch — reuse the
  `z.unknown()` + functions-side `.extend()` pattern from `character.ts` whenever a Firestore
  sentinel type is involved.
- Don't leave a hand-written `DEFAULTS` object next to a Zod schema — derive it via `.pick()` (step
  2), so it can't drift.
- Don't wrap `prepare()`/`resolve()`/`commit()` action-handler functions in `withAuthAndSchema` —
  that helper is `onCall`-request-shaped; validate their `payload` with a plain Zod schema instead
  (step 5).
