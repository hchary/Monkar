# Planned features / backlog

Design notes for features that aren't implemented yet. Not a task tracker for in-progress work — see the session's task list for that. Add new entries here when a feature is decided but not yet built. The `## Roadmap` section right below is the priority-ordered index into everything below it — start there; the detailed `##` entries further down stay the reference/spec content they've always been.

## Roadmap

Priority-ordered, dependency-aware queue of everything below that isn't cleanly `Status: **implemented**`. `/next-todo` reads this table to pick the next item.

Columns: `Status` is `spec` (needs a design/decision pass, not code), `todo` (spec is settled, build it), or `done`. `Blocked by` lists row numbers that must all be `done` before a row is actually pickable — a row's own `Status` doesn't encode blocked-ness, it's always what the row *would be* once unblocked; readiness is always `Status ≠ done` AND every listed blocker is `done`. Rows are otherwise in priority order — earlier is more important, not just "more ready".

| # | Item | Status | Blocked by | Entry |
|---|------|--------|------------|-------|
| 1 | Mission and quest resolution — score & wound algorithm (spec) | done | — | [Mission and quest resolution algorithm](#mission-and-quest-resolution-algorithm) |
| 2 | Mission resolution result pop-up | done | 1 | [Mission resolution result pop-up](#mission-resolution-result-pop-up) |
| 3 | Aventure mission launch — UX polish | todo | — | [Aventure mission launch UX polish](#aventure-mission-launch-ux-polish) |
| 4 | Interval (12h action cycle) | done | — | [Interval (12h action cycle)](#interval-12h-action-cycle) |
| 5 | Rumor and mission system — spec | done | — | [Rumor and mission system](#rumor-and-mission-system) |
| 6 | Rumor and mission system — implementation | done | 5 | [Rumor and mission system](#rumor-and-mission-system) |
| 7 | Quest triggers and end-of-action pop-up pages — spec | spec | — | [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages) |
| 8 | Quest triggers and end-of-action pop-up pages — implementation | todo | 4, 7 | [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages) |
| 9 | Trainers — spec | spec | — | [Trainers](#trainers) |
| 10 | Training-driven talent quality-up ("s'entraîner") | todo | 9 | [Expanded talent system](#expanded-talent-system) |
| 11 | Profession initial assignment via quest/trainer | todo | 9 | [Profession (métier) creation](#profession-métier-creation) |
| 12 | Trainer type creation page — description field | todo | — | [Trainer type creation page](#trainer-type-creation-page) |
| 13 | Tag system unification (tagIds vs free-text tags) | todo | — | [Tag system unification](#tag-system-unification-tagids-vs-free-text-tags) |
| 14 | Location tags | todo | — | [Location tags](#location-tags) |
| 15 | Aventure exploration mechanics — spec | spec | 5 | [Aventure exploration mechanics (spec needed)](#aventure-exploration-mechanics-spec-needed) |
| 16 | Aventure exploration mechanics — implementation | todo | 15 | [Aventure exploration mechanics (implementation)](#aventure-exploration-mechanics-implementation) |
| 17 | Intermède actions — spec | spec | 5 | [Intermède actions (spec needed)](#intermède-actions-spec-needed) |
| 18 | Intermède actions — implementation | todo | 17 | [Intermède actions (implementation)](#intermède-actions-implementation) |
| 19 | Composite quests — spec | spec | 7 | [Composite quests (spec needed)](#composite-quests-spec-needed) |
| 20 | Composite quests — implementation | todo | 19 | [Composite quests (implementation)](#composite-quests-implementation) |
| 21 | Known recipes grant mechanism — spec | spec | 9 | [Known recipes tab (Xerotex)](#known-recipes-tab-xerotex) |
| 22 | Métier action-kind polish (subtypes, action `tagIds`, reputation/gold/location content) | todo | — | [Action kinds and Métier actions](#action-kinds-and-métier-actions) |
| 23 | Misc small polish (`favoredQuestIds` effect, profession evolution consumer, quest loot draw creator tooling, talent-relations cycle prevention) | todo | — | [Quest creation and editing](#quest-creation-and-editing), [Quest loot draw](#quest-loot-draw), [Talent relations](#talent-relations), [Profession (métier) creation](#profession-métier-creation) |

**Why this order**: Mission and quest resolution (#1) is first — it's a design document handed down separately from the rest of this list, fundamentally reworking how the already-shipped [Rumor and mission system](#rumor-and-mission-system) and [Quest loot draw](#quest-loot-draw) determine success, wounds, reputation, and loot, and it touches the quest objective schema, so its open integration questions are worth resolving before other work builds further on top of the current tier-based resolution. Its result pop-up (#2) follows directly, since it only has UI to build once #1's outcome shape is settled. Aventure mission launch polish (#3) is independent, small, and already mostly done, but stays this early so it doesn't fall to the bottom of a long list. Interval (#4) is next because three later entries (#5, #7, and transitively #15/#17) are written assuming its "per Interval" cadence exists, even though nothing hard-blocks writing those specs without it. Rumor/mission (#5) and Quest triggers (#7) come next because they're the two specs the most other entries lean on (#6, #15, #17 read on Rumor/mission; #19 reads on Quest triggers) — resolving them early avoids the later specs guessing at answers that get contradicted. Trainers (#9) is an independent track that unblocks two separate entries (#10, #11) plus loosely #21, so it runs in parallel rather than waiting. #12-14 are small, fully unblocked, and safe to pick up any time priority allows. #22-23 are intentionally last: real but low-stakes polish with no downstream dependents.

## Expanded talent system

Status: **implemented** (data model, catalog, grant flow, and UI). Quality-up progression via a lucky quest roll is now implemented — see [Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success). The training-driven path is still **not** implemented — see [Trainers](#trainers).

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
- The training-driven quality-up mechanic (via a "s'entraîner" action) — deferred entirely until the trainer system itself is designed, see [Trainers](#trainers) below.

The quest-luck quality-up path (tag + rarity based, no per-tier signal needed) is now implemented — see [Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success). As previously decided, it bumps quality by a flat **+1** per trigger.

Known gap: granting the same talent via `tier.talentGain` more than once (e.g. via two different tiers) still appends a duplicate entry to `character.talents` rather than merging/bumping quality. The quest-luck evolution path itself doesn't have this gap (it updates the existing entry in place, or skips unlocking an id the character already owns).

## Talent evolution and unlock on quest success

Status: **implemented**.

A successful quest ("Partir en quête") has a chance to evolve an owned talent or unlock a new one, for every talent sharing at least one tag with the quest or with a quest objective drawn (once per resolution, the same random-pick mechanism used for loot) for that occurrence:

- **Eligible talents**: the union of `character.talents` (evolution candidates) and every `worldData/talents/items` catalog entry the character doesn't own yet (unlock candidates), filtered down to those sharing a `tagIds` entry with `quest.tagIds` or the drawn objective's `tagIds`.
- **Rank**: a talent's "rank" is simply its own `rarity`, read as a 1-indexed position in the shared 8-tier scale (commun=1 .. unique=8) — the same field already used everywhere else, no new field introduced.
- **Rank gate**: evolution requires the objective's rarity to be **greater than or equal to** the talent's current rank; unlocking a not-yet-owned talent requires it to be **strictly greater** — a talent can never be unlocked by an objective merely as rare as it.
- **Chance formula**: `5% + 10% × quest difficulty level − 5% × talent rank level`, both levels 1-indexed on their own scale (difficulty: facile=1 .. mythique=6, positionally aligned with rarity per [Quest difficulty](#quest-difficulty)), clamped to [0%, 100%]. Example: a "difficile" (level 3) quest evolves a "commun" (level 1) talent at 30%. Each eligible talent is rolled independently.
- **On success**:
  - Evolution: quality +1, capped at 5 (the flat **+1** per trigger already decided in [Expanded talent system](#expanded-talent-system)), then `rarityFloor` is re-applied so rarity only ever rises with it, never drops.
  - Unlock: the talent is granted at quality 1, rarity = its catalog `rarity` (through the same `rarityFloor`, for consistency).
  - Both stamp `lastChangeDate`/`lastChangeCircumstance` (`"lors de la quête « {quest.name} »"`), exactly like any other talent change.
- Only rolled when the quest tier succeeds; nothing happens on a failure, and a quest with no objectives (or none drawn) is skipped entirely.
- Applied immediately in `resolve()` — like `tier.talentGain` — not deferred to `acknowledgeAction` the way loot is, since there's no equivalent "claim" step for a talent change.

Implemented in `functions/src/lib/talentEvolution.js` (`rollTalentEvolutions`/`evolutionChance`), called from `functions/src/actions/partirEnQuete.js`'s `resolve()`, which also now fetches the full talent catalog in `prepare()`.

**Interaction**: results appear in the end-of-quest pop-up (`ActionOutcome.jsx`), in a `fieldset` below "Butin obtenu" ("Amélioration de talent"), one chip per talent styled like the existing talent tab (`talent-card rarity-{rarity}`), prefixed "Nouveau : " for an unlock.

**Dependencies**: the 8-tier rarity scale and `rarityFloor` ([Expanded talent system](#expanded-talent-system)), the quest difficulty scale ([Quest difficulty](#quest-difficulty)), and quest/objective `tagIds` (same tag-union pattern as [Quest loot draw](#quest-loot-draw)). Independent from the ancestor/descendant talent graph — see [Talent relations](#talent-relations) below, whose own unlock mechanic remains a separate, still-undesigned feature.

## Talent relations

Status: **implemented** (relation storage and creator UI only). The actual unlock mechanic that consumes these relations is **not** implemented yet — see "Still open" below.

Each talent catalog entry (`worldData/talents/items/{id}`) now carries two id lists describing its position in a talent graph: `ancestorIds` (talents that will, eventually, unlock this one) and `descendantIds` (talents this one will, eventually, unlock). The two lists are always kept as mirror images of each other — adding talent A as an ancestor of talent B also adds B as a descendant of A, and the same symmetry applies to removal and to deleting a talent entirely (its id is pruned from every other talent's `ancestorIds`/`descendantIds`). `TalentsManager.jsx` maintains this invariant with a Firestore batch write on every create/edit/delete rather than requiring the creator to edit both sides by hand.

`worldData/talents/items/{id}` shape, new fields:
```
ancestorIds: [string]     -- other worldData/talents/items ids that unlock this talent (eventually)
descendantIds: [string]   -- other worldData/talents/items ids this talent unlocks (eventually)
```

**Interaction**: the talent edit form gains two `MultiSelectModalField` pickers ("Talents ancêtres" / "Talents descendants"), reusing the existing `matchesTalent` filter (name, effect, or rarity) and listing every other talent (the talent being edited is excluded from its own options). The read-only list view shows both relations by name under each talent, alongside its existing tags/favored quests/trainer info.

**Still open (deliberately deferred)**:
- The actual unlock mechanic: a character currently owning a talent's ancestors doesn't grant or reveal that talent anywhere — these links are pure data for now.
- Cycle prevention: nothing stops a creator from linking talents into a cycle (A ancestor of B, B ancestor of A) or from an ancestor/descendant list pointing back at itself indirectly. Not a problem while the graph has no gameplay consumer, but should be revisited once the unlock mechanic is designed.

## Trainers

Design note only — nothing implemented. The talent system's "s'entraîner" (train) progression path was deliberately deferred because the trainer concept itself isn't designed yet: who/what a player trains with (an NPC? a location? a standalone action type?), whether training costs anything (gold, a full day's action slot, both), whether it's restricted to talents the character already has, and how it picks *which* trainable talent to bump when a character has several. Once this is designed, revisit "Still open" in [Expanded talent system](#expanded-talent-system) above — the mechanic should reuse the existing weighted-tier roll (a success tier grants +1 quality to a designated talent) rather than introduce a second RNG system, per prior decision.

## Trainer type creation page

Talents that are trainable now reference a required trainer type (`trainerTypeId`, a single-select on the talent form in `TalentsManager.jsx`, shown when "Entraînable" is checked). The trainer type catalog itself is only a bare-bones stub: `TrainerTypesManager.jsx` (registered as the "Types d'entraîneur" tab in `CreatorDashboard.jsx`) stores nothing beyond a `name` in `worldData/trainerTypes/items/{id}`.

- At minimum, a description field for what kind of trainer this represents (e.g. "Maître d'armes", "Sage ermite").
- This is the catalog side of the still-undesigned [Trainers](#trainers) mechanic above — region/location tied to a trainer, availability, and training cost/cadence are all open questions there and will likely shape what this page needs beyond a name and description.

Not implemented yet beyond the name-only stub described above.

## Quest creation and editing

Status: **implemented**. `worldData/quests/items` via `QuestsManager.jsx`, registered as the "Quêtes" tab in `CreatorDashboard.jsx`. Loot on quest completion is a separate feature, see [Quest loot draw](#quest-loot-draw).

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
- How `favoredQuestIds` on a talent should affect gameplay is still undecided (see above).

Loot is now drawn on quest resolution — see [Quest loot draw](#quest-loot-draw). It ended up not needing a `lootTableId` field on the quest: which loot table is used is resolved dynamically per draw (by tag overlap and objective rarity) rather than fixed per quest.

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
- **Instance**: implemented as a display-only component (`Instance.jsx`, `InventoryTab.jsx`) — an Instance is an Object owned by a character, with an acquisition date, an owner (`characterId`), and a condition (neuf, usé, endommagé, cassé). Shown under the object's name in the character page's "Inventaire" tab, filterable by type, tag, and rarity, in a scrollable (non-growing) list. No creation UI yet — instance documents are only created by the [Quest loot draw](#quest-loot-draw) Cloud Function for now; there's still no manual/creator way to add one directly.

**Data model implications (Instance)**:
```
instances/{id}
  objectId: string        -- worldData/objects/items id
  characterId: string     -- characters/{id} id, the owner
  ownerUid: string         -- characters/{id}'s ownerUid, denormalized so firestore.rules
                            --   can check read access without a second lookup (same
                            --   convention as actionsLog)
  acquisitionDate: string -- "YYYY-MM-DD"
  condition: string        -- one of: neuf, use, endommage, casse
  description: string      -- optional, overrides the object's catalog description when
                            --   set (e.g. the quest loot draw appends
                            --   "[Obtenue lorsque {accomplishment message}]")
```

## Loot table creation

Status: **implemented**. `worldData/lootTables/items` via `TablesDeTirageManager.jsx`, registered as the "Tables de tirage" tab in `CreatorDashboard.jsx`, under the "Personnages" group.

A table de butin (loot table) is a named, tagged pool of `worldData/objects/items` a quest (or any future consumer) can draw from. It is characterized by:

- **Name**.
- **Tags**: multi-select against `worldData/tags/items`, same mechanism already used by quests, quest objectives, and objects.
- **Rarity**: reuses the 8-tier rarity enum shared with talents and objects — a single value per table (not per entry).
- **Objects**: multi-select against `worldData/objects/items`, via `MultiSelectModalField.jsx`.
- **Pondération (weighting)**: `Uniforme` (default) or `Manuelle`. In `Manuelle` mode, each selected object gets a per-item weight (1-100) entered as a percentage; the save button is disabled until every selected object has a weight in that range and the weights sum to exactly 100. Switching an object off the table also drops its stored weight.

**Loot table list page**: filtered list (rarity, tags, free-text search over name, with a reset button) plus a collapsible "Nouvelle table de tirage" form below — same list-then-create layout as [Object creation](#object-creation), except list actions ("Modifier"/"Tirer") only appear on hover instead of always being visible, to keep the row uncluttered; deleting a table is done from the edit form instead of the list.

**Drawing**: clicking "Tirer" on a table in the list rolls `drawLootTableItemId(table)` (`src/lib/lootTables.js`, mirrored server-side in `functions/src/lib/loot.js`) — a uniform random pick over the table's `itemIds`, or a weighted pick using `itemWeights` when `weightMode` is `manuelle` (falling back to uniform if the weights happen to sum to 0) — and shows the result in a popup. The drawn object's name links to `/creator?section=Objets&objectId={id}`, which `ObjectsManager.jsx` reads to auto-open that object's edit form. The draw function is a standalone, side-effect-free export specifically so other parts of the app (e.g. a future quest resolution flow) can reuse the same mechanic instead of reimplementing it.

**Data model implications**:
```
worldData/lootTables/items/{id}
  name: string
  rarity: string           -- one of the 8-tier rarity enum shared with talents
  tagIds: string[]          -- worldData/tags/items ids
  itemIds: string[]         -- worldData/objects/items ids
  weightMode: string        -- "uniforme" (default) or "manuelle"
  itemWeights: object       -- { [itemId]: number }, percentages summing to 100 — only meaningful when weightMode is "manuelle"
```

Quest integration is implemented — see [Quest loot draw](#quest-loot-draw).

## Quest loot draw

Status: **implemented**. A completed quest grants the character 1-3 random Instances (see "Still open" under [Object creation](#object-creation)), rolled server-side by `functions/src/actions/partirEnQuete.js` as part of the same `performAction` resolution as everything else (tier, gold, talent, etc.) — only committed to Firestore once the player closes the result pop-up (see "Interaction" below).

- **Rarity source**: Quest Objectives (`QuestObjectivesManager.jsx`, `worldData/narrativeSubjects/items` tagged "objectif de quête") now carry their own `rarity` field (the 8-tier enum shared with talents/objects/loot tables). A quest usually has several possible objectives; the objective used for rarity matching is re-rolled independently for each loot item, not fixed once for the whole quest.
- **Loot count**: driven by the quest's resolved difficulty (`quest.difficulty`, already rolled for quest selection — see [Quest difficulty](#quest-difficulty)), via `LOOT_COUNT_BY_DIFFICULTY` in `functions/src/lib/loot.js`: facile/moyen → 1, difficile/très difficile → 2, épique/mythique → 3.
- **Per-item draw** (`drawQuestLoot` in `partirEnQuete.js`, one pass per item): pick a random objective from the quest's objectives → filter `worldData/lootTables/items` to those whose `rarity` matches that objective's rarity AND whose `tagIds` overlaps the union of the quest's and that objective's `tagIds` → pick a random matching table → `drawLootTableItemId` (`functions/src/lib/loot.js`, a server-side copy of `src/lib/lootTables.js`'s draw) within it. An item is silently skipped (not retried) if no objective, no matching table, or no object is found — a content gap, not an error, so it never fails the quest itself.
- **Instance description**: each drafted loot item's description is computed at draw time as `` `${object.description} [Obtenue lorsque ${accomplishmentMessage}]` ``, where `accomplishmentMessage` is the same `narrativeText` already generated for the quest's success message. Stored per-item so it survives the object's catalog description changing later.

**Mechanic — roll vs. claim**: `resolve()` always writes the drafted loot (empty array on failure) to `lastAction.loot`, plus `lastAction.lootClaimed: false`, in the same transaction as the rest of quest resolution — so the outcome is fixed as soon as the action resolves, like everything else in `lastAction`. A separate callable, `claimQuestLoot` (`functions/src/index.js`), is what actually creates the `instances/{id}` documents; it runs when the player clicks "Fermer" on the result pop-up (see below), is idempotent (checks `lastAction.lootClaimed` first), and always flips `lootClaimed` to `true` even on a failed quest (nothing to create, just acknowledges the result) so the pop-up doesn't reopen on the next visit.

**Interaction — quest result pop-up**: `ActionPanel.jsx` auto-opens a `<dialog>` (via `showModal()`, not closable by Escape/backdrop click) as soon as a quest's `lastAction` is revealed (same 24h delay as the rest of "Action de la veille") and not yet claimed. It shows the quest name, "Succès"/"Échec", the narrative message, and — on success with a non-empty `loot` array — a "Butin obtenu" `<fieldset>` listing the drafted items as `.instance-card.rarity-{rarity}` chips (same colored-border treatment as the inventory tab), sorted with the rarest item first (topmost) down to the most common (bottommost). The only way to close it is the "Fermer" button, which calls `claimQuestLoot`; the dialog then stays closed for good once `lastAction.lootClaimed` flips to `true` (reactive via the existing character `onSnapshot`). The already-existing expanded "Action de la veille" detail also gained a permanent "Butin : ..." line so the loot is still visible after the pop-up is gone.

**Data model implications**:
```
worldData/narrativeSubjects/items/{id}  -- only the addition; see Quest creation and editing
  rarity: string    -- one of the 8-tier rarity enum shared with talents/objects/loot tables
                     --   (only meaningful for entries tagged "objectif de quête")

character.lastAction.loot: [{
  objectId: string, name: string, rarity: string, type: string, tagIds: string[],
  tableId: string, tableName: string, description: string,
}]
character.lastAction.lootClaimed: boolean   -- flips to true once claimQuestLoot runs
```

firestore.rules gained an `instances/{id}` rule (read: creator or the owning player via a denormalized `ownerUid`; write: false, Cloud Functions only) — it was missing entirely before this feature, so the "Inventaire" tab's `instances` query had no rule to authorize it.

**Still open**: no creator UI surfaces which loot tables/objectives are actually reachable together (e.g. a rarity/tag combination with zero matching tables) — a content author has to cross-reference `QuestObjectivesManager.jsx` and `TablesDeTirageManager.jsx` by hand to avoid dead combinations.

## Modular action framework

Status: **analysed, not implemented** — the analysis, architecture proposal, and phased
implementation plan asked for by this entry are done and live in
[docs/ISSUE-02-ACTION-FRAMEWORK.md](ISSUE-02-ACTION-FRAMEWORK.md). No production code written yet.

"Partir en quête" is currently the only action, and it is hardcoded end to end: a handler module
keyed by its own id in `performAction`, a flat unconditional button list in `ActionPanel.jsx`, and
a quest-specific result pop-up wired to a quest-specific `claimQuestLoot` callable. The goal is a
framework where adding an action is mostly content authoring: display conditions per character,
effects, a place in the UI, an end-of-action pop-up, and the ability for other game elements
(talents, instances) to modify it.

Target rules the framework has to satisfy:

- One action per day, per character; an action completes 24 h after it starts.
- Completion opens a result pop-up — immediately if the player is connected, otherwise at their
  next connection.
- Availability is decided per action by its own conditions (talent owned, profession, reputation
  level, …).
- Actions are grouped into four categories: Aventure, Intermède, Métier, Social. The example
  actions named for each (Repos, Marchander, Forger, Pêcher, …) are illustrations only —
  implementing them is explicitly out of scope.
- UI: the right-hand frame shows category tabs first, then that category's actions; an action's
  tab has a "Commencer" button; pressing it replaces the frame with a 24 h countdown colored by
  the quest's difficulty color, framed in the same style as the rest of the UI.

The analysis found one blocking prerequisite: the once-per-day lock (UTC calendar date,
`lastActionDate`) and the 24 h reveal (`lastActionAt + 24 h`, computed client-side) are two
different clocks today, so an action started at 23:00 UTC unlocks an hour later while its own
countdown still has 23 h to run. Both rules unify onto a single `lastAction.completesAt` instant
before the countdown UI can be built — see the linked document for the full finding list.

**Data model implications**: see [docs/ISSUE-02-ACTION-FRAMEWORK.md](ISSUE-02-ACTION-FRAMEWORK.md)
§3.2 and §3.6 for the full shapes. Summary — all additive, every field read-time-defaulted, no
migration or backfill required:
```
worldData/actionTypes/items/{id}
  categoryId, description, order, enabled, handlerId, durationHours,   -- NEW
  availability: { conditions, unmetBehaviour, unmetMessage },           -- NEW
  result: { accentSource, showLoot }                                    -- NEW
  -- label, tiers, questDifficultyWeights unchanged

worldData/talents/items/{id}.actionModifiers: [ ... ]   -- NEW
worldData/objects/items/{id}.actionModifiers: [ ... ]   -- NEW

characters/{id}.lastAction
  label, categoryId, startedAt, completesAt, accent,    -- NEW
  acknowledged: boolean                                  -- NEW, replaces lootClaimed
  -- lastActionDate kept but demoted to a logging/display field, no longer the lock
```

**Still open**: a handler currently runs its `resolve()` exactly once per action occurrence — there
is no notion of an action deciding, itself, how many resolution "rounds" it performs (e.g. drawing
several independent encounters within a single action). No design exists yet for this; the first
concrete case that needs it is "Partir explorer"'s T encounter draws — see
[Aventure exploration mechanics (spec needed)](#aventure-exploration-mechanics-spec-needed).

## Procedural narrative generation

Status: **implemented**. The feasibility study asked for by this entry is done
(`narrative-poc/report.md`), and the multi-slot tag-scored grammar it recommended has shipped in
`functions/src/textGeneration.js`, wired into quest resolution in
`functions/src/actions/partirEnQuete.js`. See:

- [docs/NARRATIVE-GENERATION.md](NARRATIVE-GENERATION.md) — how it works and how to author for it
- [narrative-poc/DEMO.md](../narrative-poc/DEMO.md) — a page of real generated output
- [narrative-poc/report.md](../narrative-poc/report.md) § 4 — quality review of the solution, the
  seven gaps found in the plan while building it, and what is deliberately still open
- [docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md) — the original implementation plan,
  kept for the record; parts of it were written against the retired `tiers` data model
- [docs/TEST-SCENARIO-NARRATIVE.md](TEST-SCENARIO-NARRATIVE.md) — manual post-deploy test scenario

Today most player-facing text is hand-authored: quest objectives, verb phrases, and per-tier
`narrativeText`. The goal is to generate coherent narration from the tags, names and
descriptions already attached to locations, quests, objectives, characters, talents, powers and
objects — e.g. a character with a fire spell, fighting an undead army during a village-protection
quest that ranks up their Pyromancie talent, getting a success message that mentions all three.

The analysis answered the three questions it posed:

- **Is it possible?** Yes for *selecting and assembling* the right pre-authored sentence
  fragments per context, including correct French agreement — this is what
  `functions/src/textGeneration.js` already does today for one sentence, generalized to a
  multi-sentence paragraph. No for *inventing* prose as vivid as the motivating example for tag
  combinations nobody wrote content for; template output degrades to correct-but-plainer text
  there, and coverage cost grows multiplicatively with the number of tag dimensions.
- **Without an LLM?** Yes, and that's the recommended default: a multi-slot, tag-scored template
  grammar (opening / climax / talent-growth slots, each with its own tagged pool), with the
  coverage gap above accepted as a designed-in limitation. Zero added infrastructure, no
  latency, no data leaving Firebase. The other non-LLM avenue tried in the POC — a statistical
  n-gram/Markov model trained on the game's own sentences — does not fit: the corpus will never
  be large enough, and it has no way to condition on tags at all.
- **If not, what's close?** A hosted LLM call from the Cloud Function is the only option that
  covers arbitrary tag combinations at the example's quality bar, at the cost of latency, an
  external dependency and non-determinism; small self-hosted models trade a small predictable
  cost for a large unpredictable one and are weaker at French prose. Recommended shape if the
  gap ever matters in practice: hybrid — template grammar for ordinary outcomes, LLM reserved
  for rare high-stakes tiers (epic/legendary, talent rank-ups), never as the default path.

Two pieces of pre-existing data-model debt surfaced while analysing this and are tracked
separately below, neither blocking: [Location tags](#location-tags) (locations have no tags to
match against at all) and
[Tag system unification (tagIds vs free-text tags)](#tag-system-unification-tagids-vs-free-text-tags)
(the generator matches free-text `tags`, while talents/quests store `tagIds`).

**Data model implications**: two additive optional fields on `worldData/verbPhrases/items`, plus new
read paths for talent/quest `tagIds`. No migration or backfill: a document without `slot` reads as
action content and behaves exactly as before.
```
worldData/verbPhrases/items/{id}
  slot: "opening" | "climax" | "talentGrowth"        -- optional, defaults to "climax"
  talentChange: "evolution" | "unlock" | "les_deux"  -- optional, "talentGrowth" only, defaults to "les_deux"
```
The one behavior change to existing content: tag matching went from "shares at least one tag" to "all
tags satisfied", so a multi-tagged phrase is harder to draw than it was. See
[narrative-poc/report.md](../narrative-poc/report.md) § 2.1 for why the looser rule had to go.

## Location tags

`worldData/adventureZones/items` (displayed as "Lieux de quête" in the creator UI,
`QuestLocationsManager.jsx`) currently has no tags at all — just `name` and `description`. This
is one of the two things explicitly deferred as a non-goal in
[docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md) (the multi-slot narrative grammar
engine spec), which wants a way to select an "opening"/stakes-setting narrative fragment
flavored by where the quest takes place (e.g. a forest, a coastal village, ruins) — the same way
it already plans to flavor fragments by the character's talent tags and the quest's own tags.

- **Tags field**: add `tagIds: string[]` to `worldData/adventureZones/items/{id}`, referencing
  `worldData/tags/items` — the same shared tag catalog and the same `MultiSelectModalField.jsx`
  picker mechanism already used by quests, objects, loot tables, and talents (see
  [docs/ARCHITECTURE.md](ARCHITECTURE.md)).
- **Creator UI**: add the `tagIds` multi-select field to `QuestLocationsManager.jsx`'s
  create/edit form, alphabetically sorted like the other `tagIds` pickers.
- **Consumption**: these `tagIds` would be resolved to tag names via the same "tag vocabulary
  bridge" pattern specified in [docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md)
  (resolving `tagIds` → `worldData/tags/items/{id}.name` at generation time, feeding into the
  grammar engine's context tag set alongside talent tags and quest tags), so the "opening" slot
  can be authored/matched by location flavor too, not just quest/talent flavor.
- This is a natural follow-up to the grammar engine issue, not a prerequisite for it — that
  engine's "opening" slot works fine without location tags (falls back to quest-tag-only or
  generic matching); this feature just adds a third tag source once the core engine is live.

**Data model implications**:
```
worldData/adventureZones/items/{id}
  tagIds: string[]   -- worldData/tags/items ids, same mechanism as quests/objects/loot
                      --   tables/talents; NEW field, rest of the shape unchanged
```

Not implemented yet. Depends conceptually on
[docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md)'s tag-vocabulary-bridge pattern
landing first for the `tagIds` → context-tags resolution to have a consumer, though the field
itself could be added to `QuestLocationsManager.jsx` independently of that.

## Tag system unification (tagIds vs free-text tags)

There is currently a dual, unrelated "tags" concept, documented in
[docs/ARCHITECTURE.md](ARCHITECTURE.md)'s data model section. `worldData/narrativeSubjects/items`
and `worldData/verbPhrases/items` each carry a `tags: string[]` field of free-text strings (e.g.
`["hostile", "humanoïde"]`) that **is** functionally read by the procedural text generator
(`generateResultText`/`generateNarrative` in `functions/src/textGeneration.js`) to match subjects
to verb phrases. Separately, `narrativeSubjects` (like quests, objects, loot tables, and talents)
also carries a `tagIds: string[]` field referencing the shared `worldData/tags/items` catalog
(CRUD'd via `TagsManager.jsx`) — but on `narrativeSubjects` that `tagIds` field is creator-only
metadata, never read by any player-facing or Cloud Function code, and `verbPhrases` doesn't have
a `tagIds` field at all.

This split was called out as unresolved debt in
[docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md) (the multi-slot narrative grammar
engine spec), which sidesteps it for now via a "tag vocabulary bridge" — resolving talents' and
quests' `tagIds` to tag *names* at generation time, then matching those names against
`narrativeSubjects`'/`verbPhrases`' free-text `tags`. That bridge works but has a real
content-authoring fragility: a tag like "feu" must be spelled *identically* in a
`worldData/tags/items` catalog entry's `name` and in every free-text `tags` array that wants to
reference it — no fuzzy matching, no referential integrity, easy to typo into a silent content
gap (a fragment that never matches because "feu" and "Feu" or "feu " don't compare equal). This
entry tracks the actual fix, as a separate, independently-decidable piece of work rather than a
prerequisite for the grammar engine.

- **Migration**: move `narrativeSubjects.tags` and `verbPhrases.tags` from free-text string
  arrays to `tagIds: string[]` referencing `worldData/tags/items`, matching every other tagged
  collection (objects, loot tables, quests, talents) and making the shared catalog the single
  source of truth for tag vocabulary everywhere, not just on some collections.
- **Cascade-delete cleanup**: `TagsManager.jsx`'s existing delete handler already strips a
  deleted tag's id from quests/objects/loot tables/talents (and `narrativeSubjects.tagIds`, the
  currently-unused field) before deleting the tag doc. Once migrated, this same cleanup needs to
  cover `verbPhrases.tagIds` and the newly-migrated, now-functional `narrativeSubjects.tagIds` —
  today's cleanup runs against the wrong (unused) field on `narrativeSubjects` and doesn't touch
  `verbPhrases` at all.
- **Data migration for existing content**: for each free-text tag string currently used in
  `narrativeSubjects.tags`/`verbPhrases.tags`, find-or-create a matching `worldData/tags/items`
  doc by name, then replace the free-text array with the resolved `tagIds` array. Expected to be
  a lightweight one-off script — there's no seeded example content in either collection beyond
  UI placeholder text, so the live dataset is small.
- **Open question**: `narrativeSubjects.tags` also carries the reserved sentinel value
  `"objectif de quête"` (which makes a subject show up as a selectable quest objective in
  `QuestObjectivesManager.jsx` — there's no separate collection for quest objectives). Migrating
  to `tagIds` means deciding whether that sentinel becomes a real `worldData/tags/items` entry
  referenced by id like any other tag, or stays a special-cased string check independent of the
  `tagIds` migration. Leaning toward a real tag entry for consistency, but this needs a decision
  before implementation, not an assumption baked into the migration script.
- Once migrated, the "tag vocabulary bridge" in
  [docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md) becomes unnecessary (`tagIds`
  sets can be compared/unioned directly, no name-resolution step needed) and could be simplified
  or removed as a follow-up.

**Data model implications**:
```
worldData/narrativeSubjects/items/{id}
  tagIds: string[]   -- worldData/tags/items ids; REPURPOSED to become the functional tag field,
                      --   replacing the free-text `tags` array below
  -- tags: string[]  -- REMOVED once migrated (was free-text, functionally used for matching)

worldData/verbPhrases/items/{id}
  tagIds: string[]   -- worldData/tags/items ids; NEW field, replaces the free-text `tags` array
  -- tags: string[]  -- REMOVED once migrated (was free-text, functionally used for matching)
```

Not implemented yet, deliberately deferred as independent from and not a prerequisite for
[docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md)'s grammar engine (see that doc's
Non-goals section) — the tag vocabulary bridge meets the grammar engine's immediate need without
this migration.

## Profession (métier) creation

Status: **implemented** (catalog, creator UI, and character link — see "Character link" below).
`worldData/professions/items` via `ProfessionsManager.jsx`, registered as the "Métiers" tab in
`CreatorDashboard.jsx`, under the "Personnages" group alongside Talents and Objets.

A profession is characterized by:

- **Name**.
- **Description**.
- **Talents**: multi-select against `worldData/talents/items`, same `MultiSelectModalField` +
  `matchesTalent` mechanism already used by `TalentsManager.jsx`'s own ancestor/descendant
  pickers.
- **Reputation condition**: a minimum reputation value required, mirroring the semantics of the
  existing `minReputation` predicate in `src/lib/actionConditions.js` (a single numeric threshold
  against `character.reputation`), rather than inventing a new condition shape.
- **Trainers**: multi-select against `worldData/trainerTypes/items` — the only "entraîneur"
  catalog that exists today (see [Trainer type creation page](#trainer-type-creation-page)),
  via `TrainerTypesManager.jsx`.
- **Evolution**: single-select referencing another `worldData/professions/items` entry (the
  profession this one evolves into) — self-referencing like talents' ancestor/descendant links,
  but single-valued here rather than a list.
- **Actions associées**: multi-select against `worldData/actionTypes/items`, same
  `MultiSelectModalField` + `matchesActionType` mechanism already exported by `ActionsManager.jsx`
  (option labels come from each action type's `label` field, not `name`). Restricted to actions of
  kind Métier, and kept in step with the action's own `professionIds` — see
  [Action kinds and Métier actions](#action-kinds-and-métier-actions).

**Interaction**: new "Métiers" tab in the creator dashboard, under the "Personnages" group.

**Data model implications**:
```
worldData/professions/items/{id}
  name: string              -- French, e.g. "Forgeron"
  description: string
  talentIds: string[]       -- worldData/talents/items ids
  minReputation: number     -- minimum character.reputation required, same semantics as
                             --   actionConditions.js's minReputation condition
  trainerTypeIds: string[]  -- worldData/trainerTypes/items ids
  evolutionId: string       -- worldData/professions/items id this profession evolves into, or ""
  actionIds: string[]       -- worldData/actionTypes/items ids
```

**Still open (deliberately deferred)**:
- No consumer reads `minReputation` or `evolutionId` yet — reputation-gated profession change and
  the evolution trigger are not implemented.
- How a character is first assigned a profession via a quest or a trainer is not implemented.
  Assignment at character creation, from the drawn origin's linked profession, is now handled by
  `createCharacter` (functions/src/index.js) — see "Character link" below.

### Character link

Status: **implemented**, except quest/trainer initial assignment (see "Still open" above).

A character has at most one active profession plus a mastery level (`professionLevel`, an integer
1-5, starting at 1 whenever a profession is (re)assigned), and a history of every profession it has
ever held (`knownProfessions`), each with its own remembered level.

Displayed in the character sheet's "Métier" tab (renamed from "Bénédictions", which it replaces —
`CharacterTabs.jsx`), via `ProfessionTab.jsx`: profession name and level, description, and associated
actions (resolved from `actionIds` against `worldData/actionTypes/items`). A profession carries no
income of its own — income is reserved for future actions, not tied to a profession. A "Métiers
connus" control opens a popup listing
`knownProfessions`; picking one swaps it in as the active profession, first upserting the previously
active profession's current level back into `knownProfessions` so no progress is lost
(`src/lib/professions.js`'s `withProfessionChange`).

**Data model implications**:
```
characters/{id}
  professionId: string | null       -- worldData/professions/items id, the active profession
  professionLevel: number | null    -- 1-5 mastery level, only meaningful when professionId is set
  knownProfessions: { professionId: string, level: number }[]
                                     -- every profession ever held, with its last known level
```

Deliberately left untouched: `character.profession` (the legacy free-text string copied from the
rolled background) and the `profession` action condition in `actionConditions.js` still key off that
string, not off `professionId` — reconciling the two remains part of the undecided initial-assignment
mechanic above. The newer `hasProfession` condition, which gates Métier actions, does read
`professionId`; both predicates coexist.

## Action kinds and Métier actions

Status: **implemented**.

An action type is now an instance of a *kind* — the "class" it inherits from — rather than a free
document filed under a category. `src/lib/actionKinds.js` ⇄ `functions/src/lib/actionKinds.js`
(mirrored pair, same convention as `actionConditions`/`actionCatalog`/`actionLifecycle`) holds the
tree:

- Four roots, one per category: **Aventure**, **Intermède**, **Métier**, **Social**. "Partir en
  quête" is an action of kind Aventure.
- A kind's **category is its root ancestor**, so `categoryId` stops being authored and becomes
  derived. The four categories and the four root kinds are the same four values, which is what
  makes that work; `ACTION_CATEGORIES` is now derived from the roots instead of restated.
- `parentId` exists for the subtypes the Métier branch will grow (Artisanat, Récolte, Transport,
  Recherche…). Each will inherit Métier's profession gate by being under it, with no new code.
- Every kind is selectable by an action: "abstract" describes the modelling, not a rule the code
  enforces, so there is no flag for it.

A **Métier action** is an action whose kind inherits from `metier`. It carries `professionIds`,
and is available only to a character *practising* one of those professions:

- The gate is **not an authored condition row**. `resolveConditions` (`actionCatalog.js`) injects
  `{ type: "hasProfession", professionIds }` for anything under Métier, so "which métiers may run
  this" is edited in exactly one field and cannot be forgotten or contradicted in the condition
  editor. `hasProfession` is therefore absent from `CONDITION_TYPES`.
- It matches `character.professionId` — the *active* profession. A profession the character used
  to hold (`knownProfessions`) does not open the action.
- It fails closed like every other malformed condition: a Métier action with no profession
  selected is available to nobody, and both creator screens say so inline.
- Enforced server-side by the same mirrored evaluator the client uses for display
  (`runActionPipeline` step 3), so the client's answer stays UX and the server's stays authority.

**The link is stored on both ends and synchronized both ways** (`src/lib/professionActions.js`):
saving an action writes its `professionIds` *and* `arrayUnion`/`arrayRemove`s itself into each
profession's `actionIds`, in one `writeBatch`; saving a profession does the mirror image. Deleting
either end drops the reference from the other, so no dangling id survives the delete. Both ends are
written because both are read without a join — the availability gate reads the action's side, the
character sheet's Métier tab reads the profession's. There is no Cloud Function in front of
`worldData` (it is creator-write per `firestore.rules`), so this runs in the creator's browser; a
concurrent delete fails the whole batch rather than half-committing.

**Data model implications**:
```
worldData/actionTypes/items/{id}
  kindId: string           -- NEW, src/lib/actionKinds.js value; defaults at read time to the
                           --   document's old categoryId, so no migration is needed
  categoryId: string       -- no longer written; derived from kindId's root ancestor. Existing
                           --   documents keep theirs and it still reads correctly.
  professionIds: string[]  -- NEW, worldData/professions/items ids; only meaningful for kinds
                           --   inheriting from "metier", cleared when the kind moves elsewhere
```

**Still open (deliberately deferred)**:
- No concrete Métier subtype exists yet beyond Récolte and Artisanat (Transport, Recherche...).
  Adding one is an entry in `ACTION_KINDS` plus, if it needs bespoke mechanics, a handler in
  `ACTION_HANDLERS` - see [Action de récolte](#action-de-récolte) and
  [Action d'artisanat](#action-dartisanat) for how those two did it. Candidate content for future
  Métier actions/subtypes: forger, couper du bois, cultiver, monter la garde, cuisiner, faire de la
  musique, construire, miner - illustrations only, same status as the example actions listed in
  [Modular action framework](#modular-action-framework)'s own analysis.
- A kind cannot declare which handlers or which extra form fields belong to it; the handler select
  still offers every registered handler regardless of kind. Worth revisiting when the next
  subtype needs its own fields.
- A Métier action's `resolve()` can already return `updates` touching `reputation`, `gold`, or
  `region` - the pipeline applies whatever a handler returns, nothing new to build there (see
  [Modular action framework](#modular-action-framework)). No handler exercises this today: Récolte
  and Artisanat only ever touch `instances`. Since the retired paliers system stopped rolling
  gold/reputation/wound changes entirely (`docs/ISSUE-02-ACTION-FRAMEWORK.md` §7), which action
  grants how much of what is undecided content, not a missing architecture piece.
- Action types have no `tagIds` field of their own yet, unlike every other catalog collection
  (quests, objects, loot tables, talents, recettes). Adding it is a small, low-risk change following
  the exact same `worldData/tags/items` + `MultiSelectModalField` pattern already used everywhere
  else - but no consumer is specified yet (filtering in the action browser? matching against the
  procedural narrative generator's tag vocabulary, per
  [Procedural narrative generation](#procedural-narrative-generation)?), so it's listed here rather
  than just added.

## Action de récolte

Status: **implemented**.

A **Récolte action** (`worldData/actionTypes/items/{id}.kindId: "recolte"`, `HARVEST_ACTION_KIND_ID`
in `src/lib/actionKinds.js` ⇄ `functions/src/lib/actionKinds.js`) is a Métier subtype - it inherits
the profession gate for free by being filed under Métier in the kind tree, exactly as the
[Action kinds and Métier actions](#action-kinds-and-métier-actions) entry anticipated. It is
characterized by everything a Métier action already carries (name, description, associated
professions, handler, tiers, conditions, …) plus two fields meaningful only for this kind:

- **Tags de butin** (`lootTagIds: string[]`, `worldData/tags/items` ids): a *different* tag
  vocabulary from action tags (not implemented yet - see
  [Tag system unification](#tag-system-unification-tagids-vs-free-text-tags) for the only tag
  concept that exists today). Used only to pick which loot table this harvest draws from.
- **Rareté** (`rarity`, the 8-tier enum shared with talents/objects/loot tables): combined with
  `lootTagIds`, narrows `worldData/lootTables/items` down to the candidate pool for this action.

**Mechanic** (`functions/src/actions/recolte.js`, registered under the shared `"recolte"`
handlerId - one handler for every Récolte action, keyed by `handlerId` like every other handler,
not by a per-action document id): on a successful tier (rolled exactly like any other action's
`tiers`), a random loot table is picked among those whose `tagIds` overlaps the action's
`lootTagIds` and whose `rarity` matches the action's `rarity`; `harvestFromLootTable`
(`functions/src/lib/harvest.js`) then draws `baseQuantity` items from it, one uniform draw at a
time (repeats are just repeated ids, same convention as everywhere else loot is drawn).
`baseQuantity` is the sum of the character's mastery level across every profession the action is
associated with (`professionIds`) - but **only for professions the character actually knows**
(its active `professionId`/`professionLevel`, or an entry in `knownProfessions`); a profession
listed on the action that the character never held contributes 0, it doesn't block the harvest.
No matching table, or a `baseQuantity` of 0, yields no loot rather than an error - a content gap,
not a failure, same convention as quest loot's per-item skip.

Loot is deferred exactly like quest loot: `resolve()` freezes the drawn items onto
`lastAction.loot` (reusing the same entry shape - `objectId`, `name`, `rarity`, `type`, `tagIds`,
`tableId`, `tableName`, `description` - so `ActionOutcome.jsx`'s "Butin obtenu" box needs no
Récolte-specific branch), and `commit()` turns each entry into its own `instances/{id}` document
once the player acknowledges the result (`acknowledgeAction`) - a harvest of quantity 5 from a
one-item table produces 5 separate Instance documents, not one stacked count (the client already
groups identical inventory items with a count badge, see
[Object creation](#object-creation)'s "Instance" note).

**Interaction**: no new UI. The creator's "Nouvelle action" form shows "Tags de butin"/"Rareté"
whenever the selected type inherits from Récolte, right where "Métiers associés" already appears
for any Métier action (`ActionsManager.jsx`); a character sees and starts a Récolte action exactly
like any other Métier action, through the existing `ActionBrowser`/`hasProfession` gate - no
mechanic 2 work was needed beyond that gate already being generic.

**Data model implications**:
```
worldData/actionTypes/items/{id}  -- only meaningful when kindId inherits from "recolte"
  lootTagIds: string[]   -- worldData/tags/items ids, distinct from any future action-tags field
  rarity: string          -- one of the 8-tier rarity enum shared with talents/objects/loot tables
```

`functions/src/lib/actionPipeline.js`'s `runActionPipeline` now also passes `actionTypeId` into
`handler.prepare`/`handler.resolve` (previously only available to `genericResolve`) - needed
because, unlike `partirEnQuete.js`, `recolte.js` has no single hardcoded action document id to
stamp onto `lastAction.actionTypeId`.

## Action d'artisanat

Status: **implemented**.

An **Artisanat action** (`worldData/actionTypes/items/{id}.kindId: "artisanat"`,
`CRAFTING_ACTION_KIND_ID` in `src/lib/actionKinds.js` ⇄ `functions/src/lib/actionKinds.js`) is a
Métier subtype, exactly like Récolte - it inherits the profession gate for free by being filed
under Métier in the kind tree. It carries one field meaningful only for this kind:

- **Catégories de recettes** (`recipeCategoryIds: string[]`, `worldData/tags/items` ids - the same
  catalog a recette's own `categoryIds` draws from): a recette qualifies for this action when its
  `categoryIds` overlaps this list.

**Mechanic** (`functions/src/actions/artisanat.js`, registered under the shared `"artisanat"`
handlerId): unlike Récolte or a quest, there's no rolled tier - crafting always succeeds once its
ingredients are confirmed present. `prepare()` validates the client-picked `recetteId` (present on
`character.knownRecipes`, and matching the action's `recipeCategoryIds`) and throws a friendly
precondition error otherwise, without consuming the daily lock. `resolve()` then re-checks
ingredient quantities against `instances` (`hasIngredients`, `functions/src/lib/crafting.js`) as
the authority and, if met, **consumes them immediately** (`tx.delete`, in the same transaction that
starts the action) - a player sees the ingredients leave their inventory the moment they click
"Commencer", not 24h later. The recette's results (`craftResults`, same module) are frozen onto
`lastAction.craftResults` and only turned into `instances/{id}` documents in `commit()`, once the
player acknowledges the result pop-up - the one difference from the crafting mechanic's original
single-shot sketch (`functions/src/actions/artisanat.js`'s previous `craft()`, which consumed and
produced in one immediate call rather than splitting across the action's lifecycle).

**Interaction**: no generic `ActionBrowser` entry - an Artisanat action instead surfaces as its own
sub-tab inside the character sheet's "Métier" tab (`ProfessionTab.jsx`; a sub-tab bar - "Description"
plus one tab per enabled Artisanat action tied to the active profession - only appears once such an
action exists). `CraftingTab.jsx` lists the character's `knownRecipes` restricted to the action's
`recipeCategoryIds`, alphabetically sorted and filterable by a free-text search (reusing
`RecettesManager.jsx`'s exported `matchesRecette`/`objectEntryLabel`), scrollable vertically.
Hovering a recette shows its ingredients/results via the shared `[data-tooltip]` CSS convention;
clicking selects it, showing the same detail below with a "Commencer" button, disabled with no
recette selected, while submitting, or while another action is already running. Starting it calls
`performAction({ actionTypeId, recetteId })` - the same callable every action goes through, just
carrying one extra field. The result pop-up (`ActionResultDialog.jsx`) special-cases
`lastAction.handlerId === "artisanat"`: no Succès/Échec line (crafting can't fail once it starts),
header reads "`{action label}: {recette name}`", results are listed under "Résultat", and the
acknowledge button reads "Terminer" instead of "Fermer" - everywhere else in the dialog this is
generic and shared with every other action.

**Data model implications**:
```
worldData/actionTypes/items/{id}  -- only meaningful when kindId inherits from "artisanat"
  recipeCategoryIds: string[]   -- worldData/tags/items ids, same catalog as a recette's categoryIds

characters/{id}
  lastAction: {
    recetteId: string        -- artisanat only, worldData/recettes/items id
    recetteName: string      -- denormalized at resolve time
    craftResults: [{ objectId, name, rarity, description }]   -- one entry per unit produced,
                                                                --   same convention as récolte's loot
  }
```

`functions/src/lib/actionPipeline.js`'s `runActionPipeline` now also accepts a `payload` object,
passed through to `handler.prepare`/`handler.resolve` alongside a `characterRef` (previously only
available to `commit`) - needed because, unlike every other handler so far, `resolve()` here must
itself query and delete `instances` documents, which requires the character's id before `commit()`
ever runs.

**Still open (deliberately deferred)**: nothing grants `knownRecipes` yet (see
[Known recipes tab (Xerotex)](#known-recipes-tab-xerotex)), so until some other mechanic populates
it, `CraftingTab.jsx` has nothing to list for any character.

## Known recipes tab (Xerotex)

Status: **implemented** (display only — no code path grants a recipe to a character yet).

The Xerotex page gains a "Recettes" tab listing the recipes a character knows, filterable and
sortable by rarity, category, tags, ingredients, and results — the same filter/sort logic already
used by the creator's Recettes page (`RecettesManager.jsx`), exported from that file and reused
rather than duplicated (`matchesRecette`, `tagNames`, `objectEntryLabel`, `SORT_FIELDS`,
`compareRecettes`).

- **Mechanic 1**: the "Recettes" tab is reachable from the Xerotex page's tab bar.
- **Mechanic 2**: the tab shows the character's known recipes (name, rarity, categories, tags,
  ingredients, results), filterable by rarity/category/tag and free-text name search, sortable by
  any of those fields plus ingredient/result count.
- **Interaction**: `XerotexRecipesTab.jsx` (new, sibling to `InventoryTab.jsx`), rendered from
  `Xerotex.jsx` alongside its existing tabs. Read-only — no edit/delete, unlike the creator's list.
  An empty `knownRecipes` shows the same `EmptyState` pattern used by every other stub tab.

**Data model implications**:
```
characters/{characterId}
  knownRecipes: string[]   -- worldData/recettes/items ids the character knows
```

**Still open (deliberately deferred)**: no mechanic grants `knownRecipes` yet - there is now a
crafting action that *consumes* it ([Action d'artisanat](#action-dartisanat)), but nothing that
*grants* it (a training action, a discovery, a starting background...), so every character's
`knownRecipes` stays empty until one is designed.

## Interval (12h action cycle)

Status: **implemented**. Every action used to lock a character for a fixed 24 h (`durationHours`,
defaulting to 24 — see [Modular action framework](#modular-action-framework), whose
`completesAt`-based lock already made the duration a single configurable number rather than a
hardcoded day). The game's base time unit is now a 12 h segment, named "Interval" in-game, so a
character can act roughly twice as often.

- **Default duration**: `durationHours`'s default dropped from 24 to 12
  (`DEFAULT_DURATION_HOURS` in `functions/src/lib/actionLifecycle.js` / `src/lib/actionLifecycle.js`,
  and the schema default in `functions/src/schema/actionType.js`). This is a global default, not
  just a new baseline for future documents: already-authored action types relying on the old
  default (absent `durationHours`, or explicitly `24`) were bulk-migrated to `12` via a one-off
  admin script, `functions/scripts/migrateActionDurationTo12h.js`. A per-action type still
  authored with its own deliberate value (e.g. 6 h, 48 h) is untouched either way — per-action
  overrides work exactly as before, only the fallback changed.
- **Terminology**: the three "day"-worded UI strings tied to the action lock were reworded to
  "Interval" — `ActionPanel.jsx`'s two headings ("Action du jour" → "Action de l'Interval",
  "Action de la veille" → "Dernier Interval") and the debug-only `[TEST] Avancer le temps d'un
  jour` button (→ "…d'un Interval"). No other player-facing copy referenced "jour"/"veille" for
  the action lock specifically.
- **Shared clock**: the rumor propagation and quest-trigger checks described below
  ([Rumor and mission system](#rumor-and-mission-system),
  [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages))
  are meant to tick on this same Interval boundary rather than introduce a separate cadence —
  "beginning of an Interval" is the moment both a character's own action can complete and the
  world-level systems (rumor propagation, quest trigger evaluation) advance. Not built yet; those
  are separate roadmap entries.
- **Phase cycle**: a player's Interval is described as three phases — Intermède → Action →
  Intermède — i.e. a character can spend Intermède actions (see
  [Intermède actions](#intermède-actions-spec-needed), capped at 3 total) both before and after
  their one main action for that Interval, not only in a single window before or after it. The
  Intermède mechanic itself (including how that 3-action cap is tracked) is still undesigned — see
  that entry's own open questions.

Depended on nothing else being built first — it was a default-value and copy change on top of the
already-implemented `completesAt` lock. The rumor/quest systems below are written assuming it
lands, since they're specified in terms of "per Interval".

## Rumor and mission system

Status: **implemented**, except region-to-region propagation (see "Still open" below — it depends
on the still-undecided Interval-tick cadence shared with
[Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)).
A rumor is a hand-authored piece of flavor text with a rarity and an optional link to a quest;
regions and characters each keep their own rumor journal, and a "Rumeur" action lets a character
harvest their region's better rumors and, separately, roll for local missions generated the same
way "Partir en quête" generates its narration.

- **Rumor catalog**: `worldData/rumors/items/{id}`, authored through a new `RumorsManager.jsx`
  ("Rumeurs" tab), same convention as quests/loot tables/narrative subjects — hand-authored, not
  procedurally generated. A rumor carries French flavor text, a rarity (the existing shared 8-tier
  scale — commun .. unique — reused as-is, not a separate lighter scale, for the same reason every
  other loot/talent/quest system already reuses it), the region(s) it originates in
  (`originRegionIds`, same shape as `quest.regionIds`), and an optional `linkedQuestId` pointing at
  `worldData/quests/items`.
- **Location = region**: resolved by investigation, not by design call. Propagation (below) needs
  an adjacency graph between locations, and that graph already exists — but only on
  `worldData/regions/items` (`neighbors: [{regionId, direction}]`, authored and wired up in
  `RegionsManager.jsx`), not on `worldData/adventureZones/items` (name + description only, no
  adjacency). So "location" for this whole feature means region, the same entity a character's
  `region` field already points to. This also settles the same open question raised in
  [Aventure exploration mechanics (spec needed)](#aventure-exploration-mechanics-spec-needed).
- **Region rumor journal**: a new subcollection, `worldData/regions/items/{regionId}/rumorSightings/{rumorId}`
  — one doc per rumor currently present in that region, holding the rumor's *effective* rarity at
  that location (see decay below) and an `arrivedAt` timestamp. A subcollection rather than an
  array field on the region document, since sightings accumulate indefinitely and are never pruned
  (see propagation below) — an array risks the document outgrowing Firestore's per-document limits
  over a long-running game the way a bounded list like `character.talents` doesn't.
- **Propagation and decay**: once per Interval (same shared cadence as the still-undecided
  trigger-check mechanism in
  [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages) —
  whichever mechanism ends up ticking that also ticks this), every region with a rumor sighting
  pushes it to each neighbor from `neighbors` (checked symmetrically — a region counts as a
  neighbor of its own listed neighbors even though the edge is authored on one side only, matching
  how `RegionsManager.jsx` already treats the list as undirected for display). Each hop drops the
  rumor's effective rarity by one tier from what it was at the sending region. A rumor already at
  "commun" does not propagate further (it would decay below the scale's floor); a rumor's very
  first hop out of its origin region carries the catalog's authored rarity unchanged. If the
  receiving region already has a sighting for that rumor id, the arrival is a no-op — the earlier
  sighting's rarity is never upgraded or downgraded by a later, differently-decayed arrival.
- **Character rumor journal**: `character.rumorJournal`, an unbounded array of denormalized copies
  (`{ id, text, rarity, linkedQuestId, receivedAt }`, same "copy the catalog entry so a later rename
  doesn't rewrite already-granted history" convention as `character.talents`) — the rumors a
  character has personally harvested via the Rumeur action, independent of any region's journal and
  never pruned.
- **Rumor banner**: a character standing in a region sees that region's `rumorSightings` scroll
  through a dedicated banner at the bottom of the screen, above the existing visual banner. A
  sighting is visually called out when its effective rarity is "rare" or above — a flat floor on
  the existing 8-tier scale, not scaled to whatever the rumor is about.
- **"Rumeur" action** (`kindId: "intermede"`, new `handlerId: "rumeur"`): performing it does two
  things in the same resolution:
  - Harvests up to `rumorHarvestCount` (new `worldData/actionTypes/items` field, only meaningful
    when `handlerId` is `"rumeur"`, default 1) sightings at or above "rare" from the character's
    current region into `character.rumorJournal`, skipping rumor ids the character already owns;
    harvesting fewer than requested when fewer qualify is not an error.
  - Generates `missionRollCount` (same convention, default 3) missions into
    `character.missionJournal`, replacing whatever was left there unclaimed (see mission journal
    below).
- **Mission generation**: reuses "Partir en quête"'s own generative building blocks instead of a
  new content pool — a mission is not hand-authored. Each rolled mission draws one random
  `worldData/narrativeSubjects/items` entry tagged "objectif de quête" (the same pool
  `QuestObjectivesManager.jsx` populates) and one difficulty, picked uniformly across the 6
  `DIFFICULTIES` tiers. The mission's `tagIds` are copied from the drawn objective's own `tagIds` —
  there is no mission-level catalog entry to carry them. `character.missionJournal` entries have
  the shape:
  ```
  { id, objectiveId, difficulty, tagIds, locationId, regionId, generatedAt }
  ```
  where `locationId` is drawn from the character's current region's `adventureZoneIds` (or `""`
  when the region lists none) and `regionId` is that region's id, both fixed at generation time.
- **Mission journal expiry**: `character.missionJournal` is not a growing history like the rumor
  journal — it's a rolling offer. Missions still sitting there unclaimed are simply overwritten the
  next time the Rumeur action resolves (see above); nothing else prunes them, since there's no
  global per-Interval tick to hook a separate expiry into yet (same open cadence question as
  propagation, above).
- **"Mission" action** (`kindId: "aventure"`, new `handlerId: "mission"`, sibling of
  `partirEnQuete`'s `handlerId: "partirEnQuete"`): a player picks one entry from
  `character.missionJournal` and it resolves through the exact same pipeline as
  `partirEnQuete.js`'s `resolve()` — narration, loot draw, talent evolution roll — reading
  `objectiveId`/`difficulty`/`tagIds` straight off the journal entry instead of loading a
  `worldData/quests/items` document. Once resolved, the entry is removed from
  `character.missionJournal`.
  **Correction, decided in [Mission and quest resolution algorithm](#mission-and-quest-resolution-algorithm):**
  `mission.js` currently evaluates `LOOT_COUNT_BY_DIFFICULTY` and the talent-evolution chance formula
  at `mission.difficulty` *one tier lower* than the difficulty actually rolled and narrated (clamped
  at "facile"), a "missions pay out like a quest a notch easier than their stated difficulty"
  discount (`rewardDifficulty`) — this was a balance mistake and is being removed. A mission's loot
  count and talent-evolution chance (and, once that entry is implemented, its success threshold,
  wound thresholds, and reputation reward) all read `mission.difficulty` directly instead, exactly
  like a quest reads `quest.difficulty`. `rewardDifficulty` and its "one tier lower" computation are
  dead as of this decision and should be deleted the next time `mission.js` is touched for the
  algorithm entry's implementation.

**Still open (deliberately deferred)**:
- Region-to-region propagation itself is not implemented: a rumor's sightings today only ever exist
  at its authored `originRegionIds` (seeded by `RumorsManager.jsx` on save) — nothing spreads it
  further. The exact tick/cadence mechanism both propagation and mission-journal expiry would run
  against — whether that's part of `performAction`'s resolution or a separate scheduled function —
  is the same open question [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)
  already defers; resolving it there resolves it here too. Everything else in this entry (catalog,
  sightings storage, both journals, both actions, the banner) is built and does not depend on it.
- `rumorHarvestCount` / `missionRollCount` defaults (1 / 3) and the mission reward's "one tier
  lower" scaling factor are starting balance values, not playtested — tunable without a further
  design pass once the feature is live.
- The Intermède-side "selling a mythic object spreads a rumor of its presence" mechanic (see
  [Intermède actions (spec needed)](#intermède-actions-spec-needed)) is a separate, still-undesigned
  trigger that would need to insert directly into a region's `rumorSightings`, once designed.

**Data model implications**:
```
worldData/rumors/items/{id}                                        -- NEW catalog
  text: string                       -- French flavor text
  rarity: string                     -- 8-tier RARITIES
  originRegionIds: string[]          -- worldData/regions/items ids, same shape as quest.regionIds
  linkedQuestId: string | null       -- worldData/quests/items id, or null

worldData/regions/items/{regionId}/rumorSightings/{rumorId}        -- NEW subcollection
  rarity: string                     -- effective rarity at this region (decayed from origin)
  arrivedAt: timestamp

worldData/actionTypes/items/{id}
  rumorHarvestCount: number          -- NEW, default 1, only meaningful when handlerId is "rumeur"
  missionRollCount: number           -- NEW, default 3, only meaningful when handlerId is "rumeur"

characters/{id}
  rumorJournal: [{ id, text, rarity, linkedQuestId, receivedAt }]                        -- NEW, unbounded
  missionJournal: [{ id, objectiveId, difficulty, tagIds, locationId, regionId, generatedAt }]  -- NEW, ephemeral
```

Implemented in `functions/src/actions/rumeur.js` and `functions/src/actions/mission.js` (registered
as the `rumeur`/`mission` handlers in `functions/src/index.ts`), `shared/schema/rumor.ts` and
`shared/schema/regionRumorSighting.ts`, the "Rumeurs" creator tab (`RumorsManager.jsx`), the rumor
banner (`RumorBanner.jsx`, wired into `CharacterProfile.jsx`), the "Rumeurs" character tab
(`CharacterTabs.jsx`), and the mission picker in `ActionBrowser.jsx`/`MissionPicker.jsx`. See the
"Still open" note above for what's deliberately not built yet (propagation).

## Quest triggers and end-of-action pop-up pages

Design note — not implemented. Quests are meant to be generated less frequently than missions and,
unlike missions, are given to a character based on a trigger the quest defines rather than picked
at will. A player who now satisfies a quest's trigger is notified at the start of their next
Interval, through a new page added to the existing end-of-action result pop-up
(`ActionResultDialog.jsx`).

- **Quest trigger**: each quest carries a trigger — a set of conditions on the character (owned
  talent, reputation, profession, region, …) — presumably reusing the existing condition system
  (`CONDITION_TYPES` in `src/lib/actionConditions.js` / its server mirror) already used to gate
  action availability and, per
  [Profession (métier) creation](#profession-métier-creation), reputation thresholds, rather than
  inventing a second condition format.
- **Trigger evaluation**: once per [Interval](#interval-12h-action-cycle), the server checks each
  character against quests they don't yet have and haven't yet triggered; a match grants/reveals
  that quest to the character.
- **Notification**: a newly triggered quest doesn't interrupt the player mid-session — it's
  surfaced the next time they see the end-of-action pop-up, on its own page.
- **Multi-page pop-up**: `ActionResultDialog.jsx` (today a single-page dialog, per action — see
  [Modular action framework](#modular-action-framework)) gains numbered, paginated pages:
  - Page 1: the current action's result (today's entire dialog content, unchanged).
  - Page 2: newly triggered quests, shown only when there are any for that Interval.
  - Page 3: received messages — a placeholder for now, since no messaging feature exists yet; the
    page exists in the pagination but has nothing to show.

**Still open (deliberately deferred)**:
- Where quest documents actually come from at the "generated less regularly" cadence — whether that
  means hand-authored quests get *released*/made eligible on a schedule, or an actual procedural
  quest-generation system, is unspecified.
- The exact trigger-check cadence and where it runs (as part of `performAction`'s resolution, or a
  separate scheduled function ticking on the Interval boundary) is undecided.
- The messages feature that page 3 anticipates doesn't exist anywhere yet — this entry only
  reserves the page, it doesn't design messaging.
- How page 2/3 interact with the dialog's existing "acknowledge to close" contract (loot/craft
  results commit their deferred side effects on close, per
  [Quest loot draw](#quest-loot-draw) and [Action d'artisanat](#action-dartisanat)) — whether
  paging past page 1 is required before the dialog can close, or purely optional browsing, is
  unspecified.

**Data model implications** (quest trigger only — the pop-up pagination is UI-only, no schema
change):
```
worldData/quests/items/{id}
  trigger: { conditions: [...] }   -- NEW, same condition shape as an action's availability
                                    --   conditions (src/lib/actionConditions.js), evaluated
                                    --   per character per Interval

characters/{id}
  triggeredQuestIds: string[]   -- NEW, quest ids already evaluated/granted, so re-evaluation
                                  --   doesn't re-trigger or re-notify the same quest
```

Not implemented yet. Depends on [Interval (12h action cycle)](#interval-12h-action-cycle) for its
evaluation cadence, and touches the same `ActionResultDialog.jsx` that
[Modular action framework](#modular-action-framework) generalized.

## Aventure exploration mechanics (spec needed)

Design note — not implemented, and too underspecified to build yet. Aventure actions are meant to
be tied either to a location (dungeon presence?) or to mission announcements the player has
discovered. Every Aventure action updates a character's state, fatigue, and wounds, and may also
edit inventory, reputation, gold, or location; fatigue is meant to necessarily increase after an
adventure. For a given Interval, the Aventure tab is meant to offer "Partir explorer": costs a time
T, and the player draws T encounters from the zone's encounter tables (possibly with increasing
difficulty as T grows).

This significantly extends the Aventure kind, whose only implemented instance today is "Partir en
quête" — which draws exactly one quest by difficulty and touches none of fatigue, wounds, gold, or
reputation, since the paliers system that used to roll those was retired outright (see
`docs/ISSUE-02-ACTION-FRAMEWORK.md` §7 "Abandoning the paliers system"): each handler now owns its
outcome entirely, there is no shared consequence roller left to hook into.

**Open questions this spec needs to answer before anything gets built:**
- What "location" means here — settled by
  [Rumor and mission system](#rumor-and-mission-system) as region (the only one of the two
  candidates with an authored adjacency graph today) — still open here is whether "dungeon
  presence" implies a new sub-catalog of dungeons/locations gating which Aventure actions are
  available where.
- **Encounter tables**: a wholly new catalog, comparable to loot tables, doesn't exist yet. What an
  encounter contains (a narrative subject? a monster? a skill check?), how it's tagged/weighted, and
  how T draws compose into a single action's outcome (T independent rolls? an accumulating
  difficulty? a first-failure-stops sequence?) are all undecided.
- **Fatigue**: a new field on `characters/{id}` (doesn't exist today, unlike `woundsLight` /
  `woundsSevere` / `woundsPermanent` — see [Expanded talent system](#expanded-talent-system)'s data
  model). Its scale, what spending/recovering it means, and whether it gates future actions (can a
  tired character still adventure?) are undecided.
- **Wounds**: whether "increases after an adventure" means Aventure actions become the mechanic
  that lands wounds again, now handler-owned instead of the retired generic tier roll.
- **Multi-step resolution**: "Partir explorer" is the first concrete case needing an action that
  runs several resolution rounds (T encounter draws) instead of the single `resolve()` call every
  handler makes today — see [Modular action framework](#modular-action-framework)'s "Still open"
  note. The handler contract, pipeline, and result pop-up (one outcome per action today) all assume
  a single round.
- How this coexists with "Partir en quête" — does "Partir explorer" replace it, sit alongside it as
  a second Aventure action, or subsume quest-drawing as one possible encounter outcome?

Not implemented. This entry exists to become a design doc — the same shape
[Modular action framework](#modular-action-framework) took in
[docs/ISSUE-02-ACTION-FRAMEWORK.md](ISSUE-02-ACTION-FRAMEWORK.md) — before any of this is built. See
the paired [Aventure exploration mechanics (implementation)](#aventure-exploration-mechanics-implementation)
entry below.

## Aventure exploration mechanics (implementation)

Status: blocked. Depends entirely on
[Aventure exploration mechanics (spec needed)](#aventure-exploration-mechanics-spec-needed) above —
nothing here is decided enough to build yet.

Once specced, expected shape based on precedent sibling systems already implemented (Récolte,
Artisanat, quest loot draw):
- A new encounter-table catalog and creator UI, comparable to `worldData/lootTables/items` /
  `TablesDeTirageManager.jsx`.
- A `fatigue` field on `characters/{id}` — new, doesn't exist today.
- A new handler under `functions/src/actions/` (e.g. `partirExplorer.js`), registered in
  `ACTION_HANDLERS`, most likely as a second Aventure-branch action alongside "Partir en quête"
  rather than replacing it — pending the spec's answer on that point.
- Whatever the spec decides for multi-step resolution, built as something any future action can
  reuse, not a one-off special case inside this handler alone.

Not implemented yet.

## Intermède actions (spec needed)

Design note — not implemented, and too underspecified to build yet. Intermède actions are bonus
actions, repeatable within an Interval, with a deliberately reduced scope — send a message, trade,
post an announcement. A player can perform at most 3 Intermède actions (see
[Interval (12h action cycle)](#interval-12h-action-cycle)'s phase-cycle note). Some Intermède
actions matter far more than their small scope suggests: selling a mythic object, for instance, is
meant to spread the rumor of that object's presence at the sale location, around the seller.

The `intermede` root kind already exists in `ACTION_KINDS`
(`src/lib/actionKinds.js` / its server mirror), reserved for exactly this since
[Action kinds and Métier actions](#action-kinds-and-métier-actions) was built — but no concrete
Intermède action, handler, or the "up to 3 per Interval" cap exists yet.

**Open questions this spec needs to answer before anything gets built:**
- Where the "max 3" cap is tracked and how it interacts with the once-per-Interval main-action lock
  — presumably a separate counter reset every Interval, since Intermède actions are explicitly not
  the one main-action slot `completesAt` already locks.
- Whether the two Intermède windows (before/after the main action, per
  [Interval (12h action cycle)](#interval-12h-action-cycle)'s phase-cycle note) share one budget of
  3 or each get their own, and how a character with no main action left for the Interval but unused
  Intermède budget is represented in the UI.
- What "envoyer un message" does — presumably feeds the still-undesigned messaging feature that
  [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)'s
  page 3 already reserves a slot for, but that's not confirmed.
- What "faire du commerce" means mechanically — no buy/sell UI or NPC pricing exists; gold and
  instances exist, but nothing exchanges them today.
- What "placer une annonce" produces — presumably feeds the mission-announcement idea already noted
  under [Rumor and mission system](#rumor-and-mission-system) ("aventure actions... tied to mission
  announcements discovered by the player" — see
  [Aventure exploration mechanics (spec needed)](#aventure-exploration-mechanics-spec-needed)), i.e.
  one player's announcement becoming another (or the same) player's discoverable Aventure hook. No
  cross-character interaction of this kind exists anywhere in the game yet.
- The rumor-spreading side effect of selling a mythic object: which sales qualify (a rarity
  threshold?) is still open. What it would write is not — it would insert a
  `worldData/regions/items/{regionId}/rumorSightings/{rumorId}` entry directly (skipping the normal
  hop-by-hop propagation decay), per the now-settled data model in
  [Rumor and mission system](#rumor-and-mission-system).

Not implemented. This entry exists to become a design doc before any of this is built. See the
paired [Intermède actions (implementation)](#intermède-actions-implementation) entry below.

## Intermède actions (implementation)

Status: blocked. Depends on [Intermède actions (spec needed)](#intermède-actions-spec-needed)
above, and transitively on [Rumor and mission system](#rumor-and-mission-system) for the
rumor-trigger example and on the messaging feature
[Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)
reserves a page for but doesn't design.

Not implemented yet — nothing to build until the spec entry resolves what an Intermède action
actually does and how the per-Interval cap is tracked.

## Composite quests (spec needed)

Design note — not implemented, and too underspecified to build yet. A composite quest is a
sequence of quests, where each step is revealed only once the previous one completes. Quests
already grant meaningfully better rewards than missions (gear, talent evolution — see
[Quest loot draw](#quest-loot-draw) and
[Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success));
a composite quest is presumably where that reward gap matters most, as a multi-Interval commitment.

**Open questions this spec needs to answer before anything gets built:**
- How a chain is authored: an ordered list of existing `worldData/quests/items` ids on a new parent
  document, or each quest carries a `nextQuestId` pointer? The former matches how
  [Quest creation and editing](#quest-creation-and-editing) already models a quest as a flat catalog
  entry; the latter needs no new collection.
- How "revealed at the end of the previous step" is tracked per character — a new field on
  `characters/{id}` recording chain progress (comparable to `knownProfessions` /
  `triggeredQuestIds`), or is a composite quest's next step simply granted the way
  [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)
  grants any triggered quest, with "completed the previous step" as one more condition type?
- Whether a composite quest's individual steps are drawn/offered the same way a normal quest is
  (`partirEnQuete.js`'s region/difficulty draw), or bypass that draw entirely once unlocked, since
  the player is meant to specifically continue a chain rather than have it compete with an
  unrelated quest in the random pool.
- How reward tiering differs for a composite quest's final step vs. its earlier steps, vs. a normal
  one-off quest.

Not implemented. See the paired [Composite quests (implementation)](#composite-quests-implementation)
entry below.

## Composite quests (implementation)

Status: blocked. Depends on [Composite quests (spec needed)](#composite-quests-spec-needed) above.
Likely touches `worldData/quests/items` (chain authoring), `characters/{id}` (progress tracking),
and `partirEnQuete.js` / the
[Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)
mechanic (how the next step gets offered), once those are decided.

Not implemented yet.

## Mission and quest resolution algorithm

Status: **implemented**. [Rumor and mission system](#rumor-and-mission-system) and
[Quest loot draw](#quest-loot-draw) currently resolve every quest/mission through
`partirEnQuete.js`'s existing pipeline: a quest always concludes successfully once drawn (the
retired paliers system used to roll a weighted tier deciding death/injury/gold/reputation — see
`docs/ISSUE-02-ACTION-FRAMEWORK.md` §7 "Abandoning the paliers system" — nothing has replaced it
since), and nothing touches `reputation`, `gold`, or wounds. A separate design document ("Résolution
missions/quêtes"), handed down outside this repo, specifies a replacement resolution mechanic: draw
a random score (1-100) and compare it against two independent difficulty-derived scales. This entry
resolves that document's open questions into a buildable spec.

**Scope** (resolved): applies to **both** "Partir en quête" and "Mission" — they already share one
`resolve()` pipeline (`buildNarrativeContext`, `narrateQuestSuccess`, `drawQuestLoot`,
`rollTalentEvolutions`, all defined once in `partirEnQuete.js` and reused by `mission.js`), and there
is no live tier roll left to "sit alongside" for either of them (paliers is fully retired, per
above) — the score becomes the sole success/failure gate for both, replacing today's
always-succeeds behavior outright. A quest/mission's `successPhraseIds` were the only narration path
exercised until now; failure gets a new, symmetric narration path off `failurePhraseIds` (mirroring
`narrateQuestSuccess`, e.g. `narrateQuestFailure`, same target-shape/slot-fallback logic, just
`resultat: "echec"`).

**Missions use their full, undiscounted difficulty everywhere** (resolved, and a correction to
already-shipped code): [Rumor and mission system](#rumor-and-mission-system)'s "one tier lower,
clamped at facile" reward discount for a mission's loot count and talent-evolution chance was a
balance mistake, not a decision to preserve or extend — it is removed. Missions look up the success
threshold, the wound thresholds, the reputation reward, the loot count, and the talent-evolution
chance all off `mission.difficulty` exactly as drawn/displayed, the same way a quest uses
`quest.difficulty`. `mission.js`'s `rewardDifficulty` ("one tier lower than `mission.difficulty`,
clamped at facile") is dead as of this spec and must be deleted when this entry is implemented —
every call site that reads it switches to reading `mission.difficulty` directly, same as
`partirEnQuete.js` already does with `quest.difficulty`.

- **The score roll**: one random integer 1-100 per resolution, compared against the two independent
  scales below.
- **A single objective drawn per resolution**: both the threshold adjustment and the wound
  adjustment below key off one `worldData/narrativeSubjects/items` objective, drawn once per
  resolution occurrence — the same draw already made for
  [Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success)
  (`objective: pickRandomLoot(questObjectives)` in `partirEnQuete.js`'s `resolve()`), reused here
  rather than drawn a second time. This is independent of loot's own per-item objective draw (see
  [Quest loot draw](#quest-loot-draw)), which keeps re-rolling separately for each item exactly as
  today.
- **`difficultyRange` (success threshold)**: a base threshold per the quest/mission's difficulty
  tier, reusing the existing 6-tier `DIFFICULTIES` scale (see [Quest difficulty](#quest-difficulty)):

  | Difficulté | Seuil de réussite | Niveau de Talent requis |
  |---|---|---|
  | Facile | 30 | 1 |
  | Moyen | 50 | 1 |
  | Difficile | 80 | 2 |
  | Très difficile | 90 | 3 |
  | Épique | 98 | 4 |
  | Mythique | 100 | 5 |

  The score must equal or beat this threshold to succeed. Adjustment: every character talent sharing
  a tag with the drawn objective reduces the threshold by 1, plus 1 more per talent level (i.e. its
  `quality`, 1-5) above the tier's required level (the table's third column). Example: a quality-3
  "Sens aiguisés" talent (tags "Survie"/"Sens") against a "difficile" objective tagged
  "Survie"/"Poison" — base 80, -2 (1 for the shared tag, 1 for being one level above the "difficile"
  row's required level 2) = 78. Gated by the strict objective condition below when the objective
  carries one.
- **Strict objective conditions**: a quest objective can optionally carry a condition (new, empty by
  default), evaluated with the same condition evaluator already used for action availability
  (`CONDITION_TYPES` in `src/lib/actionConditions.js` and its server mirror — most naturally a
  `hasTalentTag` row here, no new condition type needed). It gates, all-or-nothing, whether the
  talent-tag adjustments below apply at all for this resolution: when set, a character only benefits
  from its talents' tag overlap (for both the threshold and the wound adjustments) if it owns at
  least one talent matching the condition; when absent/null (the default), every owned talent
  sharing a tag with the drawn objective counts, exactly as described above.
- **`woundRange` (wound thresholds)**: base thresholds per difficulty tier, each with its own floor:

  | Niveau de difficulté | Blessure permanente (min 1) | Blessure grave (min 2) | Blessure légère (min 3) | Coût en talents parfaits pour baisser d'un palier |
  |---|---|---|---|---|
  | Facile | 1 | 5 | 20 | — |
  | Moyen | 2 | 10 | 50 | 1 |
  | Difficile | 5 | 30 | 60 | 2 |
  | Très difficile | 10 | 50 | 80 | 3 |
  | Épique | 30 | 80 | 95 | 4 |
  | Mythique | 50 | 95 | 100 | 5 |

  The same score is also compared against these thresholds: landing exactly on a threshold inflicts
  the corresponding wound, via the existing `applyWound`/`woundCounts` helpers in
  `functions/src/lib/wounds.js` — light→severe→permanent escalation and the death rule are already
  implemented there, but nothing calls them today. If more than one threshold coincides on the same
  value after adjustment (possible once floors compress the range), the most severe matching wound
  wins (permanent > severe > light) rather than stacking multiple wounds from one roll.

  **Perfect-talent tier drop** (resolved): the table's last column is a per-step cost ladder, not a
  flat "N talents = 1 step" rate — stepping from a tier down to the tier directly below it costs the
  number of quality-5 ("talent parfait") talents shown on the *upper* tier's row (e.g. stepping
  Mythique→Épique costs 5; Épique→Très difficile costs 4). Dropping multiple steps sums the cost of
  each step crossed: Mythique→Très difficile (2 steps) costs 5+4=9, matching the original design
  note's own example. A character's total count of owned quality-5 talents (tag-independent, unlike
  the adjustment below) is spent greedily from the quest/mission's actual difficulty tier downward —
  one step at a time, as long as the running total can afford the next step's cost — to find which
  row of this table is actually used to look up thresholds, floored at "Facile" (never drops below
  it, and any leftover, unaffordable balance is wasted, not banked).

  After the tier lookup above, every talent sharing a tag with the drawn objective (gated by the
  strict objective condition, same as the threshold adjustment) reduces each of the three resulting
  thresholds by 1, down to its own floor (permanent min 1, severe min 2, light min 3).
- **Rewards on success**: loot (unchanged, see [Quest loot draw](#quest-loot-draw), objective rarity
  drawn independently per item as today) plus reputation, scaled by the quest/mission's own
  difficulty — facile 1+1d2, moyen 5+1d4, difficile 10+1d6, très difficile 20+1d10, épique 80+1d20,
  mythique 200+1d100 (`1d[N]` = a random integer 0..N). [Talent evolution and unlock on quest
  success](#talent-evolution-and-unlock-on-quest-success) keeps running exactly as it does today
  (`rollTalentEvolutions`, unchanged chance formula) — it was never gated by the retired tiers roll
  in the first place, only by "the quest succeeds", so it now reads that flag off this entry's
  score-based success instead.
- **Rewards on failure** (new — today a failed quest/mission grants nothing): loot drawn the same
  way as success loot (`drawQuestLoot`, one random objective per item, independent of the single
  objective drawn above for thresholds), except matching loot tables against a rarity two ranks
  below each per-item objective's own rarity instead of an exact match, floored at "commun" — stays
  entirely on the existing 8-tier rarity scale used by [Quest loot draw](#quest-loot-draw), no new
  difficulty-to-rarity mapping introduced. No reputation, no talent evolution on failure.

**Resolution order** in `resolve()`: draw the single objective for this occurrence → roll the score
→ compute the (talent- and condition-adjusted) `difficultyRange` threshold and determine
success/failure → compute the (perfect-talent- and tag-adjusted) `woundRange` thresholds and apply
any matching wound immediately via `applyWound`/`woundCounts` (same "no claim step, apply directly
in `resolve()`" precedent as talent evolution — a wound is a character-stat change, not an
instance-creating side effect like loot) → on success: reputation reward, existing loot draw,
`rollTalentEvolutions` → on failure: degraded-rarity loot draw only → narrate (success or failure
phrases) using whichever outcome was decided.

**Data model implications**:
```
worldData/narrativeSubjects/items/{id}    -- only the addition; see Quest creation and editing
  condition: { conditions: [...] } | null  -- NEW, optional, default null/empty; same shape as an
                                            --   action's availability conditions (reuse, not a new
                                            --   format) — restricts which character talents count
                                            --   toward this objective's threshold/wound adjustments

character.lastAction (quest/mission handlers only, additive)
  success: boolean            -- unchanged field, but now genuinely varies instead of always true
  score: number                -- NEW, the 1-100 roll, shown in the result pop-up
  threshold: number             -- NEW, the (talent-adjusted) success threshold `score` was compared
                                --   against — added during implementation: the result pop-up needs
                                --   it to show alongside the score, and it wasn't listed here
                                --   originally even though the pop-up entry below always called for it
  wound: string | null         -- NEW, "light" | "severe" | "permanent" | null, this resolution's
                                --   wound (if any) — the character's post-resolution woundsLight/
                                --   woundsSevere/woundsPermanent counters are read off the character
                                --   document itself, not duplicated here
  reputationGained: number     -- NEW, 0 on failure
  loot: [...]                  -- unchanged shape (see Quest loot draw), now also populated (at
                                --   degraded rarity) on failure instead of only on success
```

Builds on [Rumor and mission system](#rumor-and-mission-system) (mission generation/journal, and the
now-removed reward discount above), [Quest loot draw](#quest-loot-draw) (loot table draw mechanics),
[Quest difficulty](#quest-difficulty) (the 6-tier scale reused here), and the
`applyWound`/`woundCounts` helpers in `functions/src/lib/wounds.js` (now actually called from
`resolveQuestOutcome`, shared by `functions/src/actions/partirEnQuete.js` and `mission.js`). The
pure score/threshold/wound math lives in `functions/src/lib/questResolution.js`. A wound severe
enough to trigger `applyWound`'s death rule flips `character.alive` to `false`, which is what
actually removes the character from play (`useOwnCharacter`'s query and `runActionPipeline`'s
character lookup both filter on `alive == true` already) — not a new mechanic, just the first
caller of a rule that already existed.

## Mission resolution result pop-up

Status: **implemented**. Built alongside
[Mission and quest resolution algorithm](#mission-and-quest-resolution-algorithm) above, per that
entry's own note that building this row was expected to include building the algorithm as a
prerequisite.

A resolved quest or mission still shows its outcome through the existing generic dialog
(`ActionResultDialog.jsx` / `ActionOutcome.jsx`, shared with every other action) — narration, a
"Succès"/"Échec" toggle, and a "Butin obtenu" fieldset (see [Quest loot draw](#quest-loot-draw), now
also populated at degraded rarity on failure, so it needed no changes of its own). `ActionOutcome.jsx`
gained a dedicated "Résolution" `fieldset` (a new section, not a generalization of "Butin obtenu" —
resolving the entry's one open UI-architecture question), shown whenever `lastAction.score != null`
(inert for every non-quest/mission handler):

- The rolled score and the (talent-adjusted) success threshold it was compared against, always shown.
- Any wound inflicted (`lastAction.wound`'s severity), alongside the character's current
  `woundsLight`/`woundsSevere`/`woundsPermanent` counters — read off a new `character` prop threaded
  through `ActionPanel.jsx` → `ActionResultDialog.jsx` → `DefaultResult.jsx` → `ActionOutcome.jsx`,
  since those counters live on the character document itself, not on `lastAction`.
- The reputation gained, shown on success when positive.

Applies to both "Partir en quête" and "Mission", which already shared one result pop-up path.

## Aventure mission launch UX polish

Status: mostly implemented, minor gap. [Rumor and mission system](#rumor-and-mission-system) already
implemented mission launching: `MissionPicker.jsx` lists a character's `missionJournal` entries and
starts the "Mission" action (`kindId: "aventure"`, `handlerId: "mission"`) with the picked
`missionId`, embedded in `ActionBrowser.jsx`'s Aventure category tab alongside "Partir en quête" and
"Rumeur".

- This already satisfies the substance of "launch missions from the Aventure tab, backed by the
  character's mission journal" — no separate mechanic left to build.
- The one gap against how the source design describes it ("l'onglet Aventure/missions") is
  presentational: missions are one action among others inside the shared Aventure tab, not a
  visually distinct "Missions" sub-tab or section. Worth a small UX pass — e.g. giving the mission
  list its own heading/sub-section within the Aventure tab — if that distinction matters in
  practice, but it's cosmetic, not a missing mechanic.

Not blocking anything else in this list; safe to pick up independently, low effort.
