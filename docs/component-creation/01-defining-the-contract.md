# Defining a new component's contract

"Component" here means a named attribute (or small group of attributes) attached to a
`characters/{id}` document — `talents`, `blessings`, `woundsLight`, a future `statusList`. It has
nothing to do with a React component; that's [03-displaying-in-the-frontend.md](03-displaying-in-the-frontend.md).

Firestore has no enforced schema, so nothing stops two parts of the codebase from silently
disagreeing about a field's shape. `character`'s contract is defined once, in
[shared/schema/character.ts](../../shared/schema/character.ts) — a Zod schema, re-exported (and
extended with two server-only fields) by
[functions/src/schema/character.ts](../../functions/src/schema/character.ts) — and it is both the
single source of truth *and* something the code actually validates against at the write boundary
(see doc 02), not just a comment.

Not every component has been converted to this style yet: any `functions/src/schema/*.js` file
still exports a plain `FIELDS`/`DEFAULTS` object pair, which is documentation only — nothing reads
it. If the component you're extending hasn't been migrated, follow the "Legacy FIELDS/DEFAULTS
format" section below, and consider migrating it first — see
[05-migrating-a-schema-to-zod-and-typescript.md](05-migrating-a-schema-to-zod-and-typescript.md).

## Adding a field to an already-migrated component (Zod)

Open `shared/schema/character.ts` and add a key to `CharacterDocumentSchema`'s `z.object({...})`:

- Pick the right Zod type (`z.string()`, `z.number()`, `z.boolean()`, `z.array(...)`,
  `z.object({...})` for a nested shape). For an array or object field, spell the inner shape out in
  Zod itself — that *is* the documentation, there's no separate prose field to keep in sync.
- Call `.describe("...")` with a one-line explanation of what the value means and which code reads
  it. This is the Zod-native replacement for the old `FIELDS` map's `description` string — it's
  queryable at runtime (`schema.shape.foo.description`), not just a comment.
- Call `.optional()` if the field may be entirely absent from a document (e.g. `professionId` —
  absent until the player's first profession switch), `.nullable()` if it's always present but can
  legitimately be `null` (e.g. `legendLevel` before the first legendary roll), and `.default(value)`
  if every *new* character should start with the same static value.
- If you added a `.default(...)`, also add the key to the `DEFAULTED_KEYS` tuple near the bottom of
  the file, so it's picked up by the derived `DEFAULTS` export. Fields computed per-character at
  creation (`name`, `region`, `origin`, `talents`, `reputation`...) don't get a `.default()` and
  aren't in `DEFAULTED_KEYS` — they're set explicitly in `createCharacter`.

## Worked example: adding `statusList`

A `statusList` component — an array of named statuses (`"Blessé"`, `"Malade"`...) a character can
carry, starting empty for every new character:

```ts
statusList: z
  .array(z.object({ name: z.string() }))
  .default([])
  .describe("Active statuses affecting the character."),
```

And add `"statusList"` to `DEFAULTED_KEYS`.

## Checklist

- [ ] Field added to `CharacterDocumentSchema` in `shared/schema/character.ts`, with a `.describe()`
      that fully specifies the shape of array/object entries.
- [ ] `.optional()`/`.nullable()` set correctly if the field isn't always a present, non-null value.
- [ ] `.default(...)` added, and the key added to `DEFAULTED_KEYS`, **only if** it's a static
      creation-time value; otherwise left out and handled per
      [02-persisting-to-firestore.md](02-persisting-to-firestore.md).
- [ ] Field name matches exactly what will be written to Firestore (camelCase, no typos) — for a
      Zod-backed component this is enforced by `.parse()`/`.safeParse()` at the write boundary, not
      just convention.

This step never touches Firestore itself. Continue to
[02-persisting-to-firestore.md](02-persisting-to-firestore.md) to actually make the field exist on
real documents.

## Legacy `FIELDS`/`DEFAULTS` format

Components not yet migrated (everything under `functions/src/schema/` except `character.ts` and
`profession.ts`) still use the older, unvalidated format:

- **`FIELDS`** — one entry per top-level field, `{ type, description, optional?, nullable? }`.
- **`DEFAULTS`** — the static value every new instance starts with.

The field is added the same way conceptually (type, description, optional/nullable, default), just
as a hand-written object instead of a Zod schema — see any unconverted file (e.g.
`functions/src/schema/origin.js`) for the exact shape. **Nothing validates this at runtime**: a
typo'd field name or wrong type reaches Firestore silently. This is why new components — and
existing ones under active development — should be migrated to Zod rather than extended in the
legacy format; see doc 05.
