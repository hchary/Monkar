# Defining a new component's contract

"Component" here means a named attribute (or small group of attributes) attached to a
`characters/{id}` document — `talents`, `blessings`, `woundsLight`, a future `statusList`. It has
nothing to do with a React component; that's [03-displaying-in-the-frontend.md](03-displaying-in-the-frontend.md).

Firestore has no enforced schema, so nothing stops two parts of the codebase from silently
disagreeing about a field's shape. [functions/src/schema/character.js](../../functions/src/schema/character.js)
exists to prevent that: it is the single source of truth for what a character document may hold.
Every other document (this one included) describes *conventions*; this file is the one place that
actually has to be right.

## Where to add it

Open `functions/src/schema/character.js`. It exports two objects:

- **`FIELDS`** — one entry per top-level field, `{ type, description, optional?, nullable? }`.
- **`DEFAULTS`** — the static value every *new* character starts with, for fields whose initial
  value never depends on the region/origin roll (age, gold, empty arrays, wound counters, etc.).
  Fields that are computed per-character at creation (`name`, `region`, `origin`, `talents`,
  `reputation`...) are *not* in `DEFAULTS` — they're set explicitly in `createCharacter`.

Add your field to `FIELDS` always. Add it to `DEFAULTS` only if every new character should start
with the exact same value.

## What to record for each field

- **`type`**: one of `"string"`, `"number"`, `"boolean"`, `"array"`, `"map"`, `"timestamp"`.
- **`description`**: for a scalar, one line is enough. For `"array"` or `"map"`, this is the only
  place the shape of what's inside is documented — spell it out, e.g.
  `"[{ id, name, quality, trainable, rarity, effect, tagIds, lastChangeDate, lastChangeCircumstance }]"`
  for `talents`. If entries reference a `worldData` catalog by id (the way `talents[].id` points at
  `worldData/talents/items`), say so explicitly.
- **`optional: true`** if the field may be entirely absent from a document (e.g. `professionId` —
  absent until the player's first profession switch), as opposed to always present with a default.
- **`nullable: true`** if the field is always present but its value can legitimately be `null`
  (e.g. `legendLevel` before the first legendary roll).

## Worked example: adding `statusList`

A `statusList` component — an array of named statuses (`"Blessé"`, `"Malade"`...) a character can
carry — with nothing but a name, gets one `FIELDS` entry:

```js
statusList: {
  type: "array",
  description: "[{ name }] active statuses affecting the character.",
},
```

And one `DEFAULTS` entry, since every new character starts with none:

```js
statusList: [],
```

## Checklist

- [ ] Field added to `FIELDS` in `functions/src/schema/character.js`, with a `description` that
      fully specifies the shape of array/map entries.
- [ ] `optional`/`nullable` set correctly if the field isn't always a present, non-null value.
- [ ] Added to `DEFAULTS` **only if** it's a static creation-time value; otherwise left out and
      handled per [02-persisting-to-firestore.md](02-persisting-to-firestore.md).
- [ ] Field name matches exactly what will be written to Firestore (camelCase, no typos — this
      file is read by humans, not validated automatically, so a mismatch here is silent).

This step never touches Firestore itself — it's documentation with teeth only insofar as the next
three docs assume it's been kept accurate. Continue to
[02-persisting-to-firestore.md](02-persisting-to-firestore.md) to actually make the field exist on
real documents.
