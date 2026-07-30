# Planned features / backlog

Design notes for features that aren't implemented yet. Not a task tracker for in-progress work — see the session's task list for that. Add new entries here when a feature is decided but not yet built.

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
  [Action d'artisanat](#action-dartisanat) for how those two did it.
- A kind cannot declare which handlers or which extra form fields belong to it; the handler select
  still offers every registered handler regardless of kind. Worth revisiting when the next
  subtype needs its own fields.

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
