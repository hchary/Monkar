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

**Talent catalog** (decided): trainable/rarity/effect are authored once in a new `worldData/talents/items/{id}` collection (creator CRUD: `TalentsManager.jsx`). `tier.talentGain` in `worldData/actionTypes/items/{id}` (no creator UI — authored directly in the Firestore console) references a `talentId` plus a starting `quality` and a French `circumstance` string (the narrative reason for the grant — becomes the tooltip's third bracket, prefixed with the auto-generated grant date). `performAction` resolves the catalog entry into a full denormalized object copied onto `character.talents` (same convention as `character.background`), so renaming a catalog entry later doesn't rewrite already-granted talents.

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

## Quest creation and editing

Status: **implemented**, except loot (see "Still open" below). `worldData/quests/items` via `QuestsManager.jsx`, registered as the "Quêtes" tab in `CreatorDashboard.jsx`.

A quest is characterized by:

- **Quest objectives**: multi-select of existing "Objectifs de quête" (`QuestObjectivesManager.jsx`) — quest-themed `worldData/narrativeSubjects/items` tagged `"objectif de quête"` (see [docs/ARCHITECTURE.md](ARCHITECTURE.md)). A quest can have several.
- **Possible difficulty levels**: multi-select from a dedicated 6-tier difficulty scale — facile, moyen, difficile, très difficile, épique, mythique — semantically about how hard the quest is, not how rare it was to author (see [Quest difficulty](#quest-difficulty) below). Own enum, exported as `DIFFICULTIES` from `QuestsManager.jsx`, decoupled from the 8-tier rarity enum shared by talents (see [Expanded talent system](#expanded-talent-system)).
- **Success phrases**: multi-select of existing verb phrases (`worldData/verbPhrases/items` via `VerbPhrasesManager.jsx` in `TextGenerationManager.jsx`) whose `resultat` is `"victoire"`, with a link over to the verb phrase creation UI.
- **Failure phrases**: same, filtered to `resultat: "echec"`.
- **Possible regions**: multi-select of existing regions (`worldData/regions/items` via `RegionsManager.jsx`).
- **Quest location**: single-select. This reuses what used to be called "Zones d'aventure", now displayed as "Lieu(x) de quête" (`QuestLocationsManager.jsx`, renamed from `AdventureZonesManager.jsx`). The underlying Firestore collection id (`worldData/adventureZones/items`) deliberately kept its original name to avoid a data migration — only the display text and component name changed. This same catalog is also what a region's `adventureZoneIds` multi-select (`RegionsManager.jsx`) draws from.
- It's already referenced by `TalentsManager.jsx`'s `favoredQuestIds` multi-select (a talent can be tagged as favoring certain quests), but that link is purely informational today — nothing consumes it to influence quest selection or rewards. How it should eventually affect gameplay (e.g. weighting which quest gets offered, or which quest can trigger that talent's quality-up) is still undecided.

Quest *drawing* is now wired into the "Partir en quête" action (`functions/src/actions/partirEnQuete.js`) — see [docs/ARCHITECTURE.md](ARCHITECTURE.md) for the full mechanism: a difficulty is rolled first (default weights facile 55/moyen 30/difficile 10/tres_difficile 4/epique 1, redrawn until a matching quest exists), then a random quest of that difficulty is picked from the character's region.

**Quest list page**: quests are shown in a filtered list, filterable by quest objectives, difficulty level, possible regions, and quest location. A reset button clears all filters. Selected filters are injected as default values into the matching fields of the "New quest" creation form below (resynced live whenever the filters change, as long as no existing quest is being edited).

**Quest creation**: the creation section is a collapsible panel (`<details>`), closed by default, opened automatically when editing an existing quest. In that form, the potentially large catalogs (objectives, success/failure phrases, regions) are picked via a searchable `<dialog>` popup — `MultiSelectModalField.jsx`, a shared component (not specific to quests) — rather than an inline checkbox list; a text filter narrows the popup's options, and picked items show as chips once closed. Difficulty levels stay an inline checkbox list (`MultiSelectField`, still local to `QuestsManager.jsx`) since that catalog is small and fixed (6 tiers).

`MultiSelectModalField` takes a `matchesFilter(option, query)` prop (defaulting to a plain name match) so each catalog can define what its popup search actually matches against, instead of hardcoding name-only search in the shared component. Each catalog's manager exports its own: `matchesQuestObjective` (name or tag) in `QuestObjectivesManager.jsx`, `matchesVerbPhrase` (template text, cible, or tag) in `TextGenerationManager.jsx`, `matchesRegion` (name or description) in `RegionsManager.jsx`, `matchesQuest` (name) in `QuestsManager.jsx`, and `matchesTalent` (name, effect, or rarity) in `TalentsManager.jsx` — the last two aren't wired into any `MultiSelectModalField` usage yet (e.g. `TalentsManager.jsx`'s `favoredQuestIds` still uses a plain inline checkbox list), but are ready for whenever those fields switch to the modal picker too.

**Data model implications**:
```
worldData/quests/items/{id}
  name: string                -- French, e.g. "Chasse aux bandits"
  objectiveIds: string[]      -- worldData/narrativeSubjects/items ids tagged "objectif de quête"
  difficulties: string[]      -- subset of the quest difficulty enum, see Quest difficulty below
  successPhraseIds: string[]  -- worldData/verbPhrases/items ids, resultat: "victoire"
  failurePhraseIds: string[]  -- worldData/verbPhrases/items ids, resultat: "echec"
  regionIds: string[]         -- worldData/regions/items ids
  locationId: string          -- worldData/adventureZones/items id
```

**Still open (deliberately deferred)**:
- **Loot**: a quest should eventually single-select a loot table, but that needs a loot table creation page first (and, before that, an item creation page). Not implemented — `worldData/quests/items` has no `lootTableId` field yet, and the quest draw in `partirEnQuete.js` deliberately doesn't roll loot yet either.
- How `favoredQuestIds` on a talent should affect gameplay is still undecided (see above).

## Quest difficulty

Status: **implemented**. Replaces the earlier reuse of the talent rarity enum for quests ("Rareté") with a dedicated, semantically-named difficulty scale.

A quest's difficulty is drawn from its own 6-tier enum, exported as `DIFFICULTIES` from `QuestsManager.jsx`: facile, moyen, difficile, très difficile, épique, mythique (positionally equivalent to the talent rarity tiers commun, peu commun, rare, très rare, légendaire, mythique, but a separate enum — quests have no "divin"/"unique" tier). Each tier has its own color, shown as a border/text color rather than the talent system's border-only treatment:

- Facile → green
- Moyen → yellow
- Difficile → orange
- Très difficile → light red
- Épique → gold, with an animated diagonal pixel-striped shine sweeping across the panel
- Mythique → gold-and-silver gradient border/text

**UI**: when the last action drew a quest, the "Action de la veille" panel (`.last-action` in `ActionPanel.jsx`) takes a border colored by `lastAction.quest.difficulty`. In the expanded action detail, the "Succès" toggle text (not "Échec") is colored the same way. Colors live in `src/index.css` as `.last-action.difficulty-{value}` and `.difficulty-text-{value}`.

**Quest drawing**: `partirEnQuete.js` rolls a difficulty first against `actionType.questDifficultyWeights` (defaults to facile 55/moyen 30/difficile 10/tres_difficile 4/epique 1), then picks a random quest carrying that difficulty from the region's catalog — see [docs/ARCHITECTURE.md](ARCHITECTURE.md).

No Firestore migration was needed for this rename — there was no real quest data yet, so the old `rarities` field/values were replaced outright rather than converted.

## Object creation

Status: **implemented**, except the `Instance` component (see "Still open" below). `worldData/objects/items` via `ObjectsManager.jsx`, registered as the "Objets" tab in `CreatorDashboard.jsx`, under the "Personnages" group.

An object is characterized by:

- **Name**.
- **Tags**: multi-select against `worldData/tags/items`, same mechanism already used by quests and quest objectives.
- **Rarity**: reuses the 8-tier rarity enum shared with talents (see [Expanded talent system](#expanded-talent-system)), rather than introducing a separate scale like quest difficulty did.
- **Type**: single-select from a fixed, own enum exported as `OBJECT_TYPES` from `ObjectsManager.jsx` — armes, armures, consommables, composants, ingrédient, grimoires, parchemin, objet magique, titres de propriété, vêtement. No creator UI to add new types for now.
- **Description**: a plain string.

Objet is deliberately a general, catalog-level component — weapon, armor, component, grimoire, magic item, currency, property deed, etc. are all expected to eventually be represented as objects, distinguished by their dedicated `type` field (see above) plus any number of tags.

**Object list page**: filtered list (rarity, type, tags, free-text search over name/description, with a reset button) plus a collapsible "Nouvel objet" creation form below — same list-then-create layout as [Quest creation and editing](#quest-creation-and-editing).

**Data model implications**:
```
worldData/objects/items/{id}
  name: string
  description: string
  rarity: string        -- one of the 8-tier rarity enum shared with talents
  type: string           -- one of the fixed OBJECT_TYPES enum (arme, armure, consommable, composant,
                          --   ingredient, grimoire, parchemin, objet_magique, titre_propriete, vetement)
  tagIds: string[]       -- worldData/tags/items ids
```

**Still open (deliberately deferred)**:
- **Instance**: implemented as a display-only component (`Instance.jsx`, `InventoryTab.jsx`) — an Instance is an Object owned by a character, with an acquisition date, an owner (`characterId`), and a condition (neuf, usé, endommagé, cassé). Shown under the object's name in the character page's "Inventaire" tab, filterable by type, tag, and rarity, in a scrollable (non-growing) list. No creation UI yet — instance documents must be added directly in Firestore.

**Data model implications (Instance)**:
```
instances/{id}
  objectId: string        -- worldData/objects/items id
  characterId: string     -- characters/{id} id, the owner
  acquisitionDate: string -- "YYYY-MM-DD"
  condition: string        -- one of: neuf, use, endommage, casse
```

## Loot table creation

Status: **implemented**. `worldData/lootTables/items` via `TablesDeTirageManager.jsx`, registered as the "Tables de tirage" tab in `CreatorDashboard.jsx`, under the "Personnages" group.

A table de butin (loot table) is a named, tagged pool of `worldData/objects/items` a quest (or any future consumer) can draw from. It is characterized by:

- **Name**.
- **Tags**: multi-select against `worldData/tags/items`, same mechanism already used by quests, quest objectives, and objects.
- **Rarity**: reuses the 8-tier rarity enum shared with talents and objects — a single value per table (not per entry).
- **Objects**: multi-select against `worldData/objects/items`, via `MultiSelectModalField.jsx`.

**Loot table list page**: filtered list (rarity, tags, free-text search over name, with a reset button) plus a collapsible "Nouvelle table de tirage" form below — same list-then-create layout as [Object creation](#object-creation), except list actions ("Modifier"/"Tirer") only appear on hover instead of always being visible, to keep the row uncluttered; deleting a table is done from the edit form instead of the list.

**Drawing**: clicking "Tirer" on a table in the list rolls `drawLootTableItemId(table)` (`src/lib/lootTables.js`) — a uniform random pick over the table's `itemIds` — and shows the result in a popup. The drawn object's name links to `/creator?section=Objets&objectId={id}`, which `ObjectsManager.jsx` reads to auto-open that object's edit form. The draw function is a standalone, side-effect-free export specifically so other parts of the app (e.g. a future quest resolution flow) can reuse the same mechanic instead of reimplementing it.

**Data model implications**:
```
worldData/lootTables/items/{id}
  name: string
  rarity: string      -- one of the 8-tier rarity enum shared with talents
  tagIds: string[]    -- worldData/tags/items ids
  itemIds: string[]   -- worldData/objects/items ids
```

**Still open (deliberately deferred)**:
- **Quest integration**: `worldData/quests/items` has no `lootTableId` field yet, so a quest can't single-select a loot table and no loot is drawn on quest resolution (`partirEnQuete.js`) — see [Quest creation and editing](#quest-creation-and-editing).
- **Weighted entries**: the draw is uniform across all objects in a table; per-entry weighting (like `RegionsManager.jsx`'s backgrounds) isn't supported.
