# Planned features / backlog

Design notes for features that aren't implemented yet. Not a task tracker for in-progress work — see the session's task list for that. Add new entries here when a feature is decided but not yet built.

## Expanded talent system

Status: **implemented** (data model, catalog, grant flow, and UI). Quality-up progression is **not** implemented yet — see "Still open" below and [Trainers](#trainers).

`character.talents` moved from a flat array of strings to an array of richer objects, granted via `tier.talentGain` in `performAction`. Talents support:

- **Quality**: a value from 1 to 5 (e.g. "Résistance au feu 3").
- **Trainable flag**: a talent can be marked trainable (shown with an asterisk in the name, e.g. "Résistance au feu*"). Only trainable talents will (eventually) improve through training; others would only improve via a lucky roll on a quest that specifically showcases that talent. Neither progression path is implemented yet (see "Still open").
- **Rarity**: each talent has a rarity tier, shown as a colored border around a rectangle (background stays the same color as the rest of the UI — only the border changes):
  - Commun → white
  - Peu commun → green
  - Rare → blue
  - Très rare → purple
  - Légendaire → orange
  - Mythique → red
  - Divin → black
  - Unique → multicolor (gradient border)
- **Hover interaction**: highlight the talent rectangle on hover, with a tooltip made of three bracketed segments — name+quality, effect, then the date and circumstance of the *most recent* change (initial grant, or last quality-up — the circumstance is overwritten each time the talent evolves, it's not a history log). Example at grant:
  `[Résistance au feu 1][Augmente vos chances de succès lors de quêtes vous confrontant aux flammes][Obtenu le 12/03 en bravant le souffle ardent du terrible Syrphax]`
  Example after a later quality-up (the whole third segment is replaced, not appended to):
  `[Résistance au feu 2][Augmente vos chances de succès lors de quêtes vous confrontant aux flammes][Obtenu le 19/03 en travaillant 7 jours et 7 nuits dans les forges de la déesse des volcans]`
  All bracketed text is in-game content, written in French.
- **Rarity auto-upgrade from quality**: rarity isn't purely fixed at grant time — reaching a quality threshold bumps it up if it's currently lower (never downgrades it): quality 3 → at least "rare", quality 4 → at least "très rare", quality 5 → at least "légendaire". A talent can still be granted at a higher rarity than its quality would imply (e.g. a "mythique" talent starting at quality 1) — these thresholds only guarantee a floor, they don't cap it. Applied in `performAction` at grant time (and must be re-applied by whatever future code path increases quality).

**Talent catalog** (decided): trainable/rarity/effect are authored once in a new `worldData/talents/items/{id}` collection (creator CRUD: `TalentsManager.jsx`), the same pattern as `worldData/traits/items`. `tier.talentGain` in `worldData/actionTypes/items/{id}` (authored via `ActionTypesManager.jsx`) references a `talentId` plus a starting `quality` and a French `circumstance` string (the narrative reason for the grant — becomes the tooltip's third bracket, prefixed with the auto-generated grant date). `performAction` resolves the catalog entry into a full denormalized object copied onto `character.talents` (same convention as `character.trait`/`character.background`), so renaming a catalog entry later doesn't rewrite already-granted talents.

`character.talents` shape:
```
talents: [{
  id: string,             -- worldData/talents/items id this was granted from
  name: string,           -- e.g. "Résistance au feu", French, copied at grant time
  quality: number,        -- 1-5
  trainable: boolean,
  rarity: "commun" | "peu_commun" | "rare" | "tres_rare" | "legendaire" | "mythique" | "divin" | "unique",
  effect: string,         -- French, shown in the tooltip's 2nd bracket
  lastChangeDate: string,        -- date of the most recent grant or quality-up
  lastChangeCircumstance: string, -- French, narrative reason for that change; overwritten on each change, not accumulated
}]
```

`tier.talentGain` shape (success tiers only):
```
talentGain: {
  talentId: string,       -- worldData/talents/items id
  quality: number,        -- 1-5, starting quality granted
  circumstance: string,   -- French, e.g. "en bravant le souffle ardent du terrible Syrphax"
}
```

**Still open (deliberately deferred)**:
- How a quest tier signals it's "relevant" to a given talent, for a random quality-up roll on quest success. Not implemented — for now, quality never changes after grant.
- The training-driven quality-up mechanic (via a "s'entraîner" action) — deferred entirely until the trainer system itself is designed, see [Trainers](#trainers) below.
- **Decided for whenever either path above ships**: each trigger bumps quality by a flat **+1** (no variable amounts).

Known gap: granting the same talent to a character more than once (e.g. via two different tiers) currently appends a duplicate entry to `character.talents` rather than merging/bumping quality — acceptable for now since there's no quality-up path yet either.

## Trainers

Design note only — nothing implemented. The talent system's "s'entraîner" (train) progression path was deliberately deferred because the trainer concept itself isn't designed yet: who/what a player trains with (an NPC? a location? a standalone action type?), whether training costs anything (gold, a full day's action slot, both), whether it's restricted to talents the character already has, and how it picks *which* trainable talent to bump when a character has several. Once this is designed, revisit "Still open" in [Expanded talent system](#expanded-talent-system) above — the mechanic should reuse the existing weighted-tier roll (a success tier grants +1 quality to a designated talent) rather than introduce a second RNG system, per prior decision.

## Trainer type creation page

Talents that are trainable now reference a required trainer type (`trainerTypeId`, a single-select on the talent form in `TalentsManager.jsx`, shown when "Entraînable" is checked). The trainer type catalog itself is only a bare-bones stub: `TrainerTypesManager.jsx` (registered as the "Types d'entraîneur" tab in `CreatorDashboard.jsx`) stores nothing beyond a `name` in `worldData/trainerTypes/items/{id}`.

- At minimum, a description field for what kind of trainer this represents (e.g. "Maître d'armes", "Sage ermite").
- This is the catalog side of the still-undesigned [Trainers](#trainers) mechanic above — region/location tied to a trainer, availability, and training cost/cadence are all open questions there and will likely shape what this page needs beyond a name and description.

Not implemented yet beyond the name-only stub described above.
