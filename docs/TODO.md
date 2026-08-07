# Planned features / backlog

Design notes for features that aren't implemented yet. Not a task tracker for in-progress work — see the session's task list for that. Add new entries here when a feature is decided but not yet built. The `## Roadmap` section right below is the priority-ordered index into everything below it — start there; the detailed `##` entries further down stay the reference/spec content they've always been.

## Roadmap

Priority-ordered, dependency-aware queue of everything below that isn't cleanly `Status: **implemented**`. `/next-todo` reads this table to pick the next item.

Columns: `Status` is `spec` (needs a design/decision pass, not code), `todo` (spec is settled, build it), or `done`. `Blocked by` lists row numbers that must all be `done` before a row is actually pickable — a row's own `Status` doesn't encode blocked-ness, it's always what the row *would be* once unblocked; readiness is always `Status ≠ done` AND every listed blocker is `done`. Rows are otherwise in priority order — earlier is more important, not just "more ready".

| # | Item | Status | Blocked by | Entry |
|---|------|--------|------------|-------|
| 1 | Mission and quest resolution — score & wound algorithm (spec) | done | — | [Mission and quest resolution algorithm](#mission-and-quest-resolution-algorithm) |
| 2 | Mission resolution result pop-up | done | 1 | [Mission resolution result pop-up](#mission-resolution-result-pop-up) |
| 3 | Aventure mission launch — UX polish | done | — | [Aventure mission launch UX polish](#aventure-mission-launch-ux-polish) |
| 4 | Interval (12h action cycle) | done | — | [Interval (12h action cycle)](#interval-12h-action-cycle) |
| 5 | Rumor and mission system — spec | done | — | [Rumor and mission system](#rumor-and-mission-system) |
| 6 | Rumor and mission system — implementation | done | 5 | [Rumor and mission system](#rumor-and-mission-system) |
| 7 | Quest triggers and end-of-action pop-up pages — spec | done | — | [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages) |
| 8 | Quest triggers and end-of-action pop-up pages — implementation | done | 4, 7 | [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages) |
| 9 | Trainers — spec | done | — | [Trainers](#trainers) |
| 10 | Training-driven talent quality-up ("s'entraîner") | done | 9 | [Expanded talent system](#expanded-talent-system) |
| 11 | Profession initial assignment via quest/trainer | done | 9 | [Profession (métier) creation](#profession-métier-creation) |
| 12 | Trainer type creation page — description field | done | — | [Trainer type creation page](#trainer-type-creation-page) |
| 13 | Tag system unification (tagIds vs free-text tags) | done | — | [Tag system unification](#tag-system-unification-tagids-vs-free-text-tags) |
| 14 | Location tags | done | — | [Location tags](#location-tags) |
| 15 | Aventure exploration mechanics — spec | done | 5 | [Aventure exploration mechanics (spec needed)](#aventure-exploration-mechanics-spec-needed) |
| 16 | Aventure exploration mechanics — implementation | done | 15 | [Aventure exploration mechanics (implementation)](#aventure-exploration-mechanics-implementation) |
| 17 | Intermède actions — spec | done | 5 | [Intermède actions (spec needed)](#intermède-actions-spec-needed) |
| 18 | Intermède actions — implementation | done | 17 | [Intermède actions (implementation)](#intermède-actions-implementation) |
| 19 | Composite quests — spec | done | 7 | [Composite quests (spec needed)](#composite-quests-spec-needed) |
| 20 | Composite quests — implementation | done | 19 | [Composite quests (implementation)](#composite-quests-implementation) |
| 21 | Known recipes grant mechanism — spec | done | 9 | [Known recipes tab (Xerotex)](#known-recipes-tab-xerotex) |
| 22 | Mission subject and action catalog — spec | done | — | [Mission subject and action catalog (spec needed)](#mission-subject-and-action-catalog-spec-needed) |
| 23 | Mission loot and rarity mapping — spec | done | 22 | [Mission loot and rarity mapping (spec needed)](#mission-loot-and-rarity-mapping-spec-needed) |
| 24 | Regional mission generation and journal — spec | done | 22, 23 | [Regional mission generation and journal (spec needed)](#regional-mission-generation-and-journal-spec-needed) |
| 25 | Retiring quests and quest objectives for the subject-action system — spec | spec | 22, 23, 24 | [Retiring quests and quest objectives for the subject-action system (spec needed)](#retiring-quests-and-quest-objectives-for-the-subject-action-system-spec-needed) |
| 26 | Se renseigner intermède action — spec | spec | 24, 25 | [Se renseigner intermède action (spec needed)](#se-renseigner-intermède-action-spec-needed) |
| 27 | Métier action-kind polish (subtypes, reputation/gold/location content) — action `tagIds` done | todo | — | [Action kinds and Métier actions](#action-kinds-and-métier-actions) |
| 28 | Misc small polish (`favoredQuestIds` effect, profession evolution consumer, quest loot draw creator tooling, talent-relations cycle prevention) | todo | — | [Quest creation and editing](#quest-creation-and-editing), [Quest loot draw](#quest-loot-draw), [Talent relations](#talent-relations), [Profession (métier) creation](#profession-métier-creation) |
| 29 | Rumor region-to-region propagation sweep | todo | 8 | [Rumor and mission system](#rumor-and-mission-system) |
| 30 | Known recipes grant mechanism — implementation | todo | 21 | [Known recipes tab (Xerotex)](#known-recipes-tab-xerotex) |

**Why this order**: Mission and quest resolution (#1) is first — it's a design document handed down separately from the rest of this list, fundamentally reworking how the already-shipped [Rumor and mission system](#rumor-and-mission-system) and [Quest loot draw](#quest-loot-draw) determine success, wounds, reputation, and loot, and it touches the quest objective schema, so its open integration questions are worth resolving before other work builds further on top of the current tier-based resolution. Its result pop-up (#2) follows directly, since it only has UI to build once #1's outcome shape is settled. Aventure mission launch polish (#3) is independent, small, and already mostly done, but stays this early so it doesn't fall to the bottom of a long list. Interval (#4) is next because three later entries (#5, #7, and transitively #15/#17) are written assuming its "per Interval" cadence exists, even though nothing hard-blocks writing those specs without it. Rumor/mission (#5) and Quest triggers (#7) come next because they're the two specs the most other entries lean on (#6, #15, #17 read on Rumor/mission; #19 reads on Quest triggers) — resolving them early avoids the later specs guessing at answers that get contradicted. Trainers (#9) is an independent track that unblocks two separate entries (#10, #11) plus loosely #21, so it runs in parallel rather than waiting. #12-14 are small, fully unblocked, and safe to pick up any time priority allows.

**#22-26 — mission/quest simplification chantier**: inserted ahead of the pre-existing #22-25 polish tier (now #27-30, renumbered — see below) per explicit priority direction, since this reworks the core Aventure loop those polish items merely touch. Strict dependency chain: the Subject/Action catalog (#22) is the foundation everything else assembles a mission name from; loot/rarity mapping (#23) only makes sense once that catalog exists to draw tags from; regional generation and the mission journal (#24) needs both #22 (what to draw) and #23 (how it pays out) settled; retiring the hand-authored quest catalog (#25) is deliberately last among the four core-mechanic entries because it has to enumerate every existing feature built on top of what's being deleted (composite quests, quest triggers, verb-phrase narration), which only stabilizes once the replacement (#22-24) is itself spec'd; "Se renseigner" (#26) trails all of them since it's a consumer of the regional generation routine (#24) and its rumor-harvesting half depends on #25's still-open call on the flavor-text rumor mechanic's fate.

#27-28 (previously #22-23) are intentionally after the mission chantier now: real but low-stakes polish with no downstream dependents. #29 (previously #24) trails everything: it only became buildable once #8 shipped the scheduled function it hooks into, and nothing else depends on it — though its own relevance may need revisiting once #25 decides the rumor-flavor-text mechanic's fate. #30 (previously #25) stays last, comparable in scope to #27-28's polish tier, not urgent enough to warrant further reordering churn.

## Expanded talent system

Status: **implemented** (data model, catalog, grant flow, and UI). Both quality-up progression paths are now implemented: the lucky quest roll (see [Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success)) and the training-driven "s'entraîner" path (see [Trainers](#trainers)).

`character.talents` moved from a flat array of strings to an array of richer objects, granted via `tier.talentGain` in `performAction`. Talents support:

- **Quality**: a value from 1 to 5 (e.g. "Résistance au feu 3").
- **Trainable flag**: a talent can be marked trainable (shown with an asterisk in the name, e.g. "Résistance au feu*"). Only trainable talents improve through training (see [Trainers](#trainers)); others only improve via a lucky roll on a quest that specifically showcases that talent (see [Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success)).
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

The training-driven quality-up path is implemented in `functions/src/actions/sEntrainer.js` (the "S'entraîner" action handler, registered under the shared `sEntrainer` handlerId), reusing `bumpTalentQuality` — extracted from `functions/src/lib/talentEvolution.js` so both the quest-luck path and the training path share the exact same "+1 quality, re-apply `rarityFloor`" logic. See [Trainers](#trainers) for the full mechanic (reachability gate, gold cost, talent picker).

The quest-luck quality-up path (tag + rarity based, no per-tier signal needed) is also implemented — see [Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success). Both paths bump quality by a flat **+1** per trigger.

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

**Implementation scope** (roadmap #28 — ancestor/descendant cycle prevention):
- Read: `src/components/creator/TalentsManager.jsx` (the batch-write create/edit/delete handlers maintaining the `ancestorIds`/`descendantIds` mirror invariant, where a cycle check would be inserted).
- Update: `src/components/creator/TalentsManager.jsx`.
- Do not read or open any other file without asking the user first.

## Trainers

Status: **implemented**.

A trainer is **location-tied**: each `worldData/trainerTypes/items/{id}` references a single quest location (`locationId`, `worldData/adventureZones/items` — the same "Lieu(x) de quête" catalog quests already draw from, see [Quest creation and editing](#quest-creation-and-editing)). A character can train with that trainer type whenever their current region's `adventureZoneIds` includes that location — the same region-contains-location reachability quests already use, no separate mechanism introduced. NPC- and dedicated-location-catalog options were considered and rejected in favor of reusing the existing location primitive.

Training itself is performed via a **"S'entraîner" action** (`worldData/actionTypes/items/{id}.kindId: "entrainement"`, `TRAINING_ACTION_KIND_ID` in `src/lib/actionKinds.js` ⇄ `functions/src/lib/actionKinds.js`, nested under `intermede`) — a normal action type (per the [Modular action framework](#modular-action-framework)), registered under the shared `sEntrainer` handlerId (`functions/src/actions/sEntrainer.js`, one handler for every S'entraîner action, same "one handler, several action documents" convention as [Action de récolte](#action-de-récolte)/[Action d'artisanat](#action-dartisanat)). Availability is gated by the trainer reachability above, injected as an implicit `trainerReachable` condition by `actionCatalog.js`'s `resolveConditions` (same convention as the Métier branch's implicit `hasProfession` gate) — not a bespoke UI flow.

Correction to an earlier assumption in this entry: training does **not** reuse a "weighted-tier success roll" — that mechanism was fully retired codebase-wide before this was built (see "Abandoning the paliers system" in `docs/ISSUE-02-ACTION-FRAMEWORK.md`; [Action de récolte](#action-de-récolte)/[Action d'artisanat](#action-dartisanat) confirm neither of the two most recently built non-quest handlers rolls anything). Training instead follows Artisanat's precedent: **precondition-gated, always succeeds** once reachability, ownership of a matching trainable talent, and sufficient gold are all confirmed — no roll, no failure tier. On success, the trained talent's quality is bumped by +1 (the flat **+1** per trigger already decided in [Expanded talent system](#expanded-talent-system)), with `rarityFloor` re-applied — via `bumpTalentQuality`, extracted from `functions/src/lib/talentEvolution.js` so this and [Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success) share the exact same mechanism rather than a second RNG system.

The remaining open questions are resolved as:

- **Cost**: consumes the character's daily action slot, plus a **gold cost that scales with the trained talent's current quality** — training a talent that's already further along costs more. Implemented as `trainingCost(talent) = 50 × talent.quality` (`functions/src/lib/trainingCost.js` ⇄ `src/lib/trainingCost.js`); rarity isn't a separate factor since it's never authored independently of quality for an owned talent (`rarityFloor` re-derives it on every bump), so quality alone already carries the scaling this line asks for.
- **Eligibility**: training only bumps a **trainable talent the character already owns** — it can never unlock a new one. Unlocking a not-yet-owned talent stays exclusive to the quest-luck path ([Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success)).
- **Which talent gets trained**: when a character owns several trainable talents matching the trainer's type, **the player picks explicitly** — `TalentPicker.jsx`, an eligible-talent selector (owned, `trainable: true`, catalog `trainerTypeId` matching this action's own `trainerTypeId`, not already at quality 5) shown in `ActionBrowser.jsx` before starting the action (same non-Métier payload-picker pattern as `MissionPicker.jsx`), never a random or auto-picked choice. Re-validated server-side in `sEntrainer.js`'s `prepare()`/`resolve()`, never trusted from the client.

**Data model implications**:
```
worldData/trainerTypes/items/{id}
  locationId: string   -- worldData/adventureZones/items id, where a character must be able to
                        --   reach (via their region's adventureZoneIds) to train with this
                        --   trainer type

worldData/actionTypes/items/{id}
  trainerTypeId: string | null   -- worldData/trainerTypes/items id this action trains at; only
                                  --   meaningful under the Entraînement kind branch

character.lastAction.talentEvolutions: [{ talentId, name, kind: "evolution", quality, rarity }]
character.lastAction.goldSpent: number
```

Implemented in `functions/src/actions/sEntrainer.js`, `functions/src/lib/actionContext.js` (`buildReachableTrainerTypeIds`), `functions/src/lib/actionConditions.js` ⇄ `src/lib/actionConditions.js` (`trainerReachable` predicate), and `src/components/actions/TalentPicker.jsx`. The result pop-up needed no new code: `ActionOutcome.jsx`'s existing "Amélioration de talent" fieldset already renders `lastAction.talentEvolutions` in the shape this handler writes.

## Trainer type creation page

Status: **implemented**.

Talents that are trainable now reference a required trainer type (`trainerTypeId`, a single-select on the talent form in `TalentsManager.jsx`, shown when "Entraînable" is checked). The trainer type catalog stores `name`, `description`, and `locationId` in `worldData/trainerTypes/items/{id}`; `TrainerTypesManager.jsx` (registered as the "Types d'entraîneur" tab in `CreatorDashboard.jsx`) has a `locationId` single-select against `worldData/adventureZones/items`, same pattern as `QuestsManager.jsx`'s own `locationId` field, plus a plain `description` textarea (free-text French, e.g. "Maître d'armes", "Sage ermite") shown under the trainer type's name in the list, same textarea pattern as `ProfessionsManager.tsx`'s own `description` field.

**Data model implications**:
```
worldData/trainerTypes/items/{id}
  description: string   -- free-text French description of what kind of trainer this
                         --   represents; NEW field, defaults to ""
```

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

**Implementation scope** (roadmap #28 — `favoredQuestIds` effect):
- Read: `src/components/creator/TalentsManager.jsx` (`favoredQuestIds` multi-select, purely informational today), `functions/src/actions/partirEnQuete.js` (the quest-drawing code this would need to weight), and `functions/src/actions/mission.js` (the mission-generation path, if this should apply there too).
- Update: whichever of the above ends up implementing the weighting, plus `functions/src/schema/talent.ts` / `shared/schema/talent.ts` if the field's meaning changes.
- This needs a decision on *how* `favoredQuestIds` should affect gameplay before implementation — confirm the intended effect with the user first if it isn't already decided elsewhere.
- Do not read or open any other file without asking the user first.

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

**Implementation scope** (roadmap #28 — creator tooling for unreachable loot combinations):
- Read: `src/components/creator/QuestObjectivesManager.jsx` and `src/components/creator/TablesDeTirageManager.jsx` (the two catalogs a content author currently has to cross-reference by hand), and `functions/src/actions/partirEnQuete.js`'s `drawQuestLoot` (the exact matching rule — rarity + tag overlap — the new tooling must mirror).
- Update: likely a new read-only report/warning surfaced in `src/components/creator/TablesDeTirageManager.jsx` or `src/components/creator/QuestObjectivesManager.jsx` — exact placement is a UI decision, confirm with the user before picking one.
- Do not read or open any other file without asking the user first.

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

Status: **implemented** (field and creator UI only — see "Still open" below).

`worldData/adventureZones/items` (displayed as "Lieux de quête" in the creator UI,
`QuestLocationsManager.jsx`) now carries a `tagIds: string[]` field, referencing
`worldData/tags/items` via the same `MultiSelectModalField.jsx` picker mechanism already used by
quests, objects, loot tables, and talents (see [docs/ARCHITECTURE.md](ARCHITECTURE.md)). This
closes one of the two things explicitly deferred as a non-goal in
[docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md) (the multi-slot narrative grammar
engine spec), which wants a way to select an "opening"/stakes-setting narrative fragment
flavored by where the quest takes place (e.g. a forest, a coastal village, ruins) — the same way
it already plans to flavor fragments by the character's talent tags and the quest's own tags.

`QuestLocationsManager.jsx`'s create/edit form gained the `tagIds` multi-select (alphabetically
sorted, same as the other `tagIds` pickers), and its list rows show the resolved tag names, same
pattern as `ObjectsManager.jsx`. `TagsManager.jsx`'s cascade-delete cleanup now also strips a
deleted tag's id from `adventureZones.tagIds`, alongside the collections it already covered.

**Data model implications**:
```
worldData/adventureZones/items/{id}
  tagIds: string[]   -- worldData/tags/items ids, same mechanism as quests/objects/loot
                      --   tables/talents; NEW field, defaults to []
```

**Still open (deliberately deferred)**: nothing consumes these `tagIds` yet. The original plan was
to resolve them to tag names via the "tag vocabulary bridge" pattern in
[docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md), but that bridge was actually retired
codebase-wide by [Tag system unification](#tag-system-unification-tagids-vs-free-text-tags) —
`functions/src/textGeneration.js` now reads `tagIds` straight through instead of resolving through
a name bridge. Wiring location `tagIds` into the "opening" slot's context tag set (alongside quest
and talent tags) is future work with no scheduled owner; the field ships alone for now, per the
note this entry always carried that it isn't a prerequisite for the grammar engine's opening slot,
which already works without it.

## Tag system unification (tagIds vs free-text tags)

Status: **implemented**. `worldData/narrativeSubjects/items` and `worldData/verbPhrases/items`
now carry `tagIds: string[]` referencing the shared `worldData/tags/items` catalog, the same
mechanism every other tagged collection (objects, loot tables, quests, talents) already used. The
free-text `tags: string[]` field is gone from both schemas; `functions/src/textGeneration.js`'s
`tagsOf` reads `tagIds` directly, and the "tag vocabulary bridge" that used to resolve quest/talent
`tagIds` to tag *names* before matching (`resolveTagNames`/`tagsByIdName` in `partirEnQuete.js` and
`mission.js`) is gone — `buildNarrativeContext` now passes `tagIds` straight through.

**The reserved sentinel**: the free-text `"objectif de quête"` value that used to mark a
narrativeSubject as a selectable quest objective is now a real `worldData/tags/items` entry, at
the fixed document id `"objectif-de-quete"` (`OBJECTIVE_TAG_ID`, exported from
`QuestObjectivesManager.jsx`, hand-mirrored as a literal in `functions/src/actions/rumeur.js` per
the project's usual functions/src ⇄ src convention). `QuestObjectivesManager.jsx` force-injects
that id into `tagIds` on every save and hides it from its own tags picker (never a user-toggled
choice); `rumeur.js` and `QuestsManager.jsx` filter on it the same way `.tags.includes(...)` used
to.

**Cascade-delete cleanup**: `TagsManager.jsx`'s delete handler now also strips a deleted tag's id
from `verbPhrases.tagIds`, alongside the collections it already covered.

**Data migration for existing content**: `functions/scripts/migrateTagsToTagIds.js` (same one-off
admin-script convention as `migrateActionDurationTo12h.js`) resolves every free-text tag name still
sitting in `narrativeSubjects.tags`/`verbPhrases.tags` to a `worldData/tags/items` id (creating the
catalog entry if none matches by name yet), merges the result into `tagIds`, and deletes the old
`tags` field. It also ensures the reserved `"objectif-de-quete"` tag doc exists. **Not run against
production yet** — mutating live Firestore data needs a separate go-ahead; run with
`node functions/scripts/migrateTagsToTagIds.js` after `gcloud auth application-default login`.

**Data model implications**:
```
worldData/narrativeSubjects/items/{id}
  tagIds: string[]   -- worldData/tags/items ids; now the functional tag field, read by
                      --   textGeneration.js and by partirEnQuete.js's loot draw / talent
                      --   evolution gating when the subject acts as a quest objective
  -- tags: string[]  -- REMOVED (was free-text, functionally used for matching)

worldData/verbPhrases/items/{id}
  tagIds: string[]   -- worldData/tags/items ids, optional (omitted when empty)
  -- tags: string[]  -- REMOVED (was free-text, functionally used for matching)
```

Once the migration script has run against production, the "tag vocabulary bridge" section of
[docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md) is stale and could be trimmed as a
follow-up — not done in this pass since it's documentation-only and low priority.

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

**Initial assignment (roadmap #11)**: **implemented**, via two paths, deliberately not three —
a quest-driven grant was considered and dropped from scope, leaving:

- **Origin** (pre-existing): at character creation, `createCharacter` (`functions/src/index.ts`)
  resolves the drawn origin's linked profession and sets `professionId`/`professionLevel: 1`/
  `knownProfessions` together with the legacy `profession` string, all in one write.
- **Trainer** (new): a character practising no profession at all (`professionId` unset) can learn
  one at a trainer. A new action kind, `apprentissage` (nested under `entrainement` in
  `functions/src/lib/actionKinds.js` ⇄ `src/lib/actionKinds.js`, `PROFESSION_LEARNING_ACTION_KIND_ID`)
  reuses Entraînement's existing `trainerTypeId` field and `trainerReachable` gate — filed there
  rather than as a Métier subtype, since it's mediated by a trainer location, not gated by an
  already-held profession — and additionally injects an implicit `professionless` condition
  (`actionCatalog.js`'s `resolveConditions`, same "nobody authors this row" convention as
  `hasProfession`/`trainerReachable`). Registered under the shared `apprentissage` handlerId
  (`functions/src/actions/apprentissage.js`, one handler for every such action, same "one handler,
  several action documents" convention as [Trainers](#trainers)' `sEntrainer`). The player picks
  from the professions actually taught at that action's own trainer type (`profession.trainerTypeIds`
  matching the action's `trainerTypeId`) via `ProfessionPicker.jsx`, re-validated server-side in
  `prepare()`/`resolve()`, never trusted from the client. Grants at level 1 via
  `src/lib/professions.js`'s `withProfessionChange` (the same helper `switchKnownProfession`
  reuses), and — per the reconciliation note under "Character link" below — also sets the legacy
  `character.profession` string, kept in step with what the origin path already does. No gold cost:
  unlike training a talent's quality (which scales against the talent's current quality), there is
  no equivalent progress variable to scale an initiation fee against.

**Still open (deliberately deferred)**:
- No consumer reads `minReputation` or `evolutionId` yet — reputation-gated profession change and
  the evolution trigger are not implemented.
- A quest-driven initial-assignment path (granting a profession as a quest reward, mirroring
  `tier.talentGain`) was explicitly not built in this pass — only origin and trainer exist. Revisit
  as its own entry if a quest-driven grant turns out to be wanted later.

**Implementation scope**:
- **Evolution consumer (roadmap #28, misc polish)**: read `src/lib/professions.js`, `functions/src/schema/profession.ts` / `shared/schema/profession.ts` (the unread `evolutionId` field), and `src/components/ProfessionTab.jsx` (where a reached-evolution notice would surface). Update whichever of those ends up hosting the evolution trigger.
- Do not read or open any other file for this entry without asking the user first.

### Character link

Status: **implemented**, including trainer-driven initial assignment (see "Initial assignment"
above). A quest-driven initial-assignment path remains deliberately unbuilt, see "Still open" above.

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

`character.profession` (the legacy free-text string copied from the rolled background) is kept in
step with `professionId` by every path that sets the latter — origin at character creation, and now
the trainer-driven `apprentissage` handler too — so the `profession` action condition in
`actionConditions.js`, which still keys off that string, keeps working for characters assigned
either way. `switchKnownProfession` (a later switch between professions already known) does not
touch it, so it can still drift from `professionId` after a switch — left as is, since nothing reads
`character.profession` as anything other than the origin-time trade today. The newer `hasProfession`
condition, which gates Métier actions, reads `professionId` directly; both predicates coexist.

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

**Action tags** (roadmap #27, one of the bundled items — **implemented**): `worldData/actionTypes/items/{id}`
now carries a `tagIds: string[]` field, referencing `worldData/tags/items` via the same
`MultiSelectModalField.jsx` picker mechanism already used by quests, objects, loot tables, talents,
locations, and recettes. Generic and unconditional — unlike `lootTagIds`/`recipeCategoryIds`, it
isn't scoped to a single kind branch, so every action type carries it regardless of kind.
`ActionsManager.jsx`'s create/edit form gained the picker right after the description field, and its
list rows show the resolved tag names, same pattern as `ObjectsManager.jsx`/`QuestLocationsManager.jsx`.
`TagsManager.jsx`'s cascade-delete cleanup now also strips a deleted tag's id from `actionTypes.tagIds`,
alongside the collections it already covered. No consumer reads it yet — this entry only closes the
"the field doesn't exist" gap, per the note it always carried that a consumer (filtering in the action
browser? matching against the procedural narrative generator's tag vocabulary, per
[Procedural narrative generation](#procedural-narrative-generation)?) is still undecided.

**Data model implications**:
```
worldData/actionTypes/items/{id}
  kindId: string           -- NEW, src/lib/actionKinds.js value; defaults at read time to the
                           --   document's old categoryId, so no migration is needed
  categoryId: string       -- no longer written; derived from kindId's root ancestor. Existing
                           --   documents keep theirs and it still reads correctly.
  professionIds: string[]  -- NEW, worldData/professions/items ids; only meaningful for kinds
                           --   inheriting from "metier", cleared when the kind moves elsewhere
  tagIds: string[]         -- NEW, worldData/tags/items ids; generic, unconditional, defaults to [];
                           --   no consumer yet
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
**Implementation scope** (roadmap #27 — bundles several independent small polish items; the action
`tagIds` field is now done, see above — the remaining two are still open):
- Read: `src/lib/actionKinds.js` / `functions/src/lib/actionKinds.js` (`ACTION_KINDS` tree, to extend with a new Métier subtype), `functions/src/actions/recolte.js` and `functions/src/actions/artisanat.js` (precedent for how a Métier subtype adds its own handler + fields), `functions/src/lib/actionCatalog.js` (`resolveConditions`, where the `hasProfession` gate is injected), and `functions/src/schema/actionType.ts` / `shared/schema/actionType.ts`.
- Update: whichever of the above the specific polish item touches. This row still bundles two independent items (a new Métier subtype, gold/reputation/region content on an existing handler) — confirm with the user which one to pick up first rather than doing both in one pass.
- Do not read or open any other file without asking the user first.

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

Status: **implemented** (display only). The grant mechanism is now spec'd — see "Grant mechanism"
below — but not yet built.

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

**Grant mechanism (roadmap #21) — resolved decisions**: two paths, deliberately not three — a
discovery-based grant (finding a recipe while foraging/crafting) was considered and dropped from
scope, the same call already made for profession's own initial-assignment design (see "Initial
assignment" under [Profession (métier) creation](#profession-métier-creation)):

- **Origin**: `worldData/origins/items/{id}` gains `startingRecetteIds: string[]`, granted at
  character creation alongside `talentIds`/`startingItemIds` — `createCharacter` resolves each id
  against `worldData/recettes/items` and writes the union straight onto `character.knownRecipes`,
  plus a `{ id, name }` snapshot onto `character.origin.recettes` (same convention as
  `origin.talents`/`origin.items`). An id pointing at a deleted recette is silently skipped, same
  as `talentIds`.
- **Trainer**: a new action kind, `transmission` (nested under `entrainement`,
  `RECIPE_LEARNING_ACTION_KIND_ID` in `functions/src/lib/actionKinds.js` ⇄ `src/lib/actionKinds.js`,
  sibling to `apprentissage`), reuses Entraînement's `trainerTypeId` field and `trainerReachable`
  gate — same "mediated by a physical trainer" precedent as [Trainers](#trainers)' `sEntrainer` and
  Profession's own trainer path. `worldData/recettes/items/{id}` gains an optional
  `trainerTypeId: string` (default `""`; no "trainable" boolean gate needed the way talents have
  one — an empty id simply never appears at any trainer, the same net effect as an untrainable
  talent's absent `trainerTypeId`). The player picks from recettes actually taught at that action's
  own trainer type (`recette.trainerTypeId` matching the action's `trainerTypeId`) via a new
  `RecettePicker.jsx`, same non-Métier payload-picker pattern as `TalentPicker.jsx`/
  `ProfessionPicker.jsx`, re-validated server-side in the new `transmission` handler's
  `prepare()`/`resolve()`, never trusted from the client. Always succeeds once reachability, the
  picked recette's `trainerTypeId` match, and not-already-known are confirmed — same
  precondition-gated convention as `sEntrainer.js`/`apprentissage.js`, no roll. No gold cost, same
  reasoning as `apprentissage.js`: unlike a talent's quality, a known/not-known recette has no
  progress variable to scale a fee against.

**Data model implications (grant mechanism)**:
```
worldData/origins/items/{id}
  startingRecetteIds: string[]   -- worldData/recettes/items ids granted at creation; NEW field,
                                  --   defaults to []

worldData/recettes/items/{id}
  trainerTypeId: string   -- worldData/trainerTypes/items id this recette is taught at via the
                           --   transmission action kind, or "" for none; NEW field, defaults to ""

characters/{id}
  knownRecipes: string[]   -- worldData/recettes/items ids the character knows; documented here for
                            --   the first time - already read by functions/src/actions/artisanat.js
                            --   but missing from shared/schema/character.ts until now
  origin.recettes: { id: string, name: string }[]   -- snapshot of startingRecetteIds granted at
                                                      --   creation, same convention as
                                                      --   origin.talents/origin.items
```

**Implementation scope** (roadmap #30, now unblocked):
- Read: `functions/src/index.ts` (`createCharacter`'s talent/item-granting loop, the pattern
  `startingRecetteIds` extends), `functions/src/actions/apprentissage.js` and
  `functions/src/actions/sEntrainer.js` (the two existing trainer-mediated handlers the new
  `transmission` handler mirrors), `functions/src/lib/actionKinds.js` / `src/lib/actionKinds.js`
  (where the new kind is added), `shared/schema/origin.ts`, `shared/schema/recette.ts`, and
  `shared/schema/character.ts` (`knownRecipes` needs adding, not just documenting).
- Create: `functions/src/actions/transmission.js`, `src/components/actions/RecettePicker.jsx`.
- Update: `shared/schema/origin.ts` (`startingRecetteIds`), `shared/schema/recette.ts`
  (`trainerTypeId`), `shared/schema/character.ts` (`knownRecipes`), `functions/src/index.ts`
  (origin-grant loop), `functions/src/lib/actionKinds.js` ⇄ `src/lib/actionKinds.js`, and the
  creator UI for both new fields (`OriginsManager.jsx`, `RecettesManager.jsx`).
- Do not read or open any other file without asking the user first.

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

Status: **implemented**, except region-to-region propagation (roadmap #29, see "Still open"
below — the Interval-tick cadence it depends on is now built, shared with
[Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages),
but the propagation logic itself is still not written).
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
  further. The tick/cadence mechanism it (and mission-journal expiry) would run against is now
  built — the scheduled `sweepQuestTriggers` Cloud Function
  ([Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages),
  `functions/src/index.ts`, ticking every Interval at 00:00/12:00 UTC) — but propagation's actual
  sweep logic still needs to be written and hooked into it, tracked as roadmap #29 (see
  "Implementation scope" below). Everything else in this entry (catalog, sightings storage, both
  journals, both actions, the banner) is built and does not depend on it.
- `rumorHarvestCount` / `missionRollCount` defaults (1 / 3) and the mission reward's "one tier
  lower" scaling factor are starting balance values, not playtested — tunable without a further
  design pass once the feature is live.
- The Intermède-side "selling a mythic object spreads a rumor of its presence" mechanic (see
  [Intermède actions (spec needed)](#intermède-actions-spec-needed)) is a separate, still-undesigned
  trigger that would need to insert directly into a region's `rumorSightings`, once designed.

**Implementation scope** (roadmap #29 — region-to-region propagation sweep):
- Read: `functions/src/lib/questTriggers.js` (`sweepQuestTriggers`, the sibling sweep already
  registered on the same schedule — propagation should run alongside it, e.g. a second exported
  function called from the same `functions/src/index.ts` scheduled handler, or its own scheduled
  export on the same cron), `src/components/creator/RegionsManager.jsx` (the `neighbors:
  [{regionId, direction}]` adjacency graph to walk, authored as one-directional but meant to be
  read symmetrically per this entry's "Propagation and decay" note above), and
  `shared/schema/regionRumorSighting.ts` (the `worldData/regions/items/{regionId}/rumorSightings`
  shape to write into, including the one-tier-per-hop rarity decay and the "first sighting for a
  rumor id wins, never re-decayed" no-op rule already decided above).
- Update: `functions/src/index.ts` and/or `functions/src/lib/questTriggers.js` (or a new sibling
  lib file, e.g. `functions/src/lib/rumorPropagation.js`, if keeping the two sweeps' logic
  separate reads better than folding propagation into the trigger-sweep file).
- Do not read or open any other file for this entry without asking the user first.

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

Status: **implemented**, except the region-to-region rumor propagation the same scheduled tick
was always meant to drive (split out as its own follow-up, roadmap #29, once this entry's
implementation was under way — see [Rumor and mission system](#rumor-and-mission-system)). Quests
are meant to be generated less frequently than
missions and, unlike missions, are given to a character based on a trigger the quest defines rather
than picked at will. A player who now satisfies a quest's trigger is notified at the start of their
next Interval, through a new page added to the existing end-of-action result pop-up
(`ActionResultDialog.jsx`).

- **Quest documents**: no new generation system. Quests stay the existing hand-authored catalog
  (`worldData/quests/items` via `QuestsManager.jsx`) — this feature only adds a trigger that gates
  which characters currently qualify for which already-existing quest, the same way conditions
  already gate action availability. "Generated less frequently than missions" describes the
  player-facing effect of a trigger being rare to satisfy, not an actual content-generation cadence.
- **Quest trigger**: each quest carries a trigger — a set of conditions on the character (owned
  talent, reputation, profession, region, …) — reusing the existing condition system
  (`CONDITION_TYPES` in `src/lib/actionConditions.js` / its server mirror) already used to gate
  action availability and, per
  [Profession (métier) creation](#profession-métier-creation), reputation thresholds, rather than
  inventing a second condition format.
- **Trigger evaluation and cadence**: a new global scheduled Cloud Function (Firebase Cloud
  Scheduler / pub/sub, not request-triggered), ticking on fixed Interval boundaries (every 12h,
  e.g. 00:00 and 12:00 UTC) rather than piggybacking on any individual character's own
  `completesAt` clock. Each tick sweeps every character against every quest they don't yet own and
  haven't yet triggered (`triggeredQuestIds`); a match grants/reveals that quest to the character.
  This was the first scheduled, non-request-triggered Cloud Function in the project — every other
  mechanic so far (loot draw, talent evolution, rumor harvest, mission generation) resolves lazily
  on a player action instead. The same tick is also meant to drive
  [Rumor and mission system](#rumor-and-mission-system)'s region-to-region propagation, whose
  implementation was deferred pending this exact cadence decision; the cadence now exists, but the
  propagation sweep itself is a separate follow-up (roadmap #29) rather than something this
  entry's implementation pass bundled in — the two are independent Firestore sweeps that happen to
  share a cron schedule, not one combined pass.
- **Notification**: a newly triggered quest doesn't interrupt the player mid-session — it's
  surfaced the next time they see the end-of-action pop-up, on its own page.
- **Multi-page pop-up**: `ActionResultDialog.jsx` (today a single-page dialog, per action — see
  [Modular action framework](#modular-action-framework)) gains numbered, paginated pages:
  - Page 1: the current action's result (today's entire dialog content, unchanged).
  - Page 2: newly triggered quests, shown only when there are any for that Interval.
  - Page 3: received messages — a placeholder for now, since no messaging feature exists yet; the
    page exists in the pagination but has nothing to show.
- **Pop-up gating**: "Fermer" closes the dialog from any page — paging to 2/3 is optional browsing,
  not required to close. Unlike loot/craft results (which commit a deferred side effect on close,
  per [Quest loot draw](#quest-loot-draw) and [Action d'artisanat](#action-dartisanat)), a newly
  triggered quest needs no "claim" step: it's simply available (e.g. in a future quest list/journal)
  from the moment the scheduled tick grants it, whether or not the player ever opens page 2.

**Implemented in**: `functions/src/lib/questTriggers.js` (`questsWithTriggers` /
`evaluateQuestTriggersForCharacter` / `sweepQuestTriggers`, unit-tested in
`questTriggers.test.js`), registered as the scheduled `sweepQuestTriggers` export in
`functions/src/index.ts` (`onSchedule({ schedule: "0 0,12 * * *", timeZone: "UTC" }, ...)`),
`shared/schema/quest.ts`'s `trigger` field and `shared/schema/character.ts`'s
`triggeredQuestIds` field (both reused by their `functions/src/schema/*` re-exports), and the
paginated `src/components/actions/ActionResultDialog.jsx`.

- **"Newly triggered … for that Interval" tracking**: the data model deliberately adds no field
  for this (`character.triggeredQuestIds` only ever grows, it doesn't distinguish seen from
  unseen) — so which triggered quests are still "new" is tracked client-side, in
  `localStorage` under a per-character key (`ActionResultDialog.jsx`'s
  `loadShownTriggeredQuestIds`/`markTriggeredQuestsShown`). Page 2 shows whatever's in
  `triggeredQuestIds` that this browser hasn't marked shown yet, and marks it shown when the
  dialog closes. This is a pragmatic reading of "UI-only, no schema change" below, not a
  precisely "per Interval" cadence — a player switching browsers/devices sees every
  not-yet-shown quest at once instead of losing track of which Interval granted what, which is
  strictly friendlier than the alternative.
- **No creator UI**: `trigger` is authored directly in the Firestore console, same convention as
  `tier.talentGain` (see [Expanded talent system](#expanded-talent-system)). `QuestsManager.jsx`'s
  save handler was switched from a bare `setDoc` to `setDoc(ref, {...}, { merge: true })` so
  editing a quest through the form no longer silently drops a hand-authored `trigger` (or any
  other out-of-form field) — the same protection `ActionsManager.jsx` already had for
  `questDifficultyWeights`.
- **Incidental fix**: `results/DefaultResult.jsx` (the page 1 result view for every handler
  without its own `RESULT_COMPONENTS` entry — quests, missions, rumeur) referenced `ActionOutcome`
  without importing it, a latent `ReferenceError` on every render of that path. Fixed while
  restructuring the dialog for pagination.
- **Propagation split out**: the scheduled function this entry adds is also meant to drive
  [Rumor and mission system](#rumor-and-mission-system)'s region-to-region propagation sweep, but
  that sweep's own logic (walking `neighbors`, decaying rarity per hop) is independent enough,
  and touches enough files outside this entry's original scope, that it was tracked separately
  as roadmap #29 instead of bundled into this pass.

**Implementation scope**: exhausted — see "Implemented in" above. Roadmap #24 (propagation) is a
separate follow-up with its own scope, listed under
[Rumor and mission system](#rumor-and-mission-system).

**Still open (deliberately deferred)**:
- The messages feature that page 3 anticipates doesn't exist anywhere yet — this entry only
  reserves the page, it doesn't design messaging.
- Region-to-region rumor propagation itself — see roadmap #29 above and
  [Rumor and mission system](#rumor-and-mission-system)'s own "Still open" note.

**Data model implications**:
```
worldData/quests/items/{id}
  trigger: { conditions: [...] } | null   -- NEW, same condition row shape as an action's
                                            --   availability.conditions (shared/schema/actionType.ts's
                                            --   ActionAvailabilityConditionSchema), evaluated per
                                            --   character every Interval tick. Null/absent: never
                                            --   auto-granted. No creator UI - Firestore console only.

characters/{id}
  triggeredQuestIds: string[]   -- NEW, quest ids already granted by the sweep, so re-evaluation
                                  --   doesn't re-trigger or re-notify the same quest. Which of these
                                  --   are still unseen is tracked client-side (localStorage), not here.
```

Depends on [Interval (12h action cycle)](#interval-12h-action-cycle) for its evaluation cadence, and
touches the same `ActionResultDialog.jsx` that [Modular action framework](#modular-action-framework)
generalized. Its scheduled-tick decision also resolves
[Rumor and mission system](#rumor-and-mission-system)'s propagation cadence question (see roadmap #29
for that sweep's own implementation).

## Aventure exploration mechanics (spec needed)

Status: **designed, not implemented**. The open questions below are now resolved by reuse of
machinery [Mission and quest resolution algorithm](#mission-and-quest-resolution-algorithm) and
[Rumor and mission system](#rumor-and-mission-system) already built, rather than by inventing a
parallel system — see [Aventure exploration mechanics (implementation)](#aventure-exploration-mechanics-implementation)
for the resulting build plan.

Aventure actions are tied to a location, updating a character's state, fatigue, and wounds, and may
also edit inventory, reputation, gold. For a given Interval, the Aventure tab offers "Partir
explorer": costs a time T, and the player draws T encounters from the zone (possibly with
increasing difficulty as T grows).

This extends the Aventure kind, whose implemented instances today are "Partir en quête" and
"Mission" — both drawing exactly one occurrence and resolving it through
`resolveQuestOutcome` (`functions/src/actions/partirEnQuete.js`), the shared score-roll engine
[Mission and quest resolution algorithm](#mission-and-quest-resolution-algorithm) built: one
random score (1-100) per resolution, compared against a difficulty-derived success threshold and
wound-threshold scale, landing loot, reputation, talent evolution, and wounds through
`applyWound`. "Partir explorer" reuses this engine verbatim, called T times in one action instead
of once — no second consequence roller is introduced.

**Resolved decisions:**
- **Location**: region, per [Rumor and mission system](#rumor-and-mission-system)'s "Location =
  region" resolution. No new dungeon/location sub-catalog: at the start of the action, a single
  `worldData/adventureZones/items` entry is drawn at random from the character's current region's
  `adventureZoneIds` — the exact same draw [Rumor and mission system](#rumor-and-mission-system)
  already performs for a generated mission's own `locationId` — and stays fixed for every encounter
  drawn within that one action occurrence. Its `tagIds` (see [Location tags](#location-tags)) gate
  which encounter content can be drawn, giving that field its first consumer; a location with no
  tags (the common case today, since nothing has authored any yet) leaves the encounter pool
  unfiltered rather than empty. No reachability condition gates the action itself (unlike
  [Trainers](#trainers)' `trainerReachable`) — the zone is drawn from the region automatically, the
  player doesn't travel to a specific one.
- **Encounter content**: no new catalog. Each encounter is one round of `resolveQuestOutcome`
  against a synthetic, in-memory pseudo-quest built for that round: `difficulty` rolled
  independently per round from the action's own `questDifficultyWeights` (same field/mechanism
  `partirEnQuete.js` already reads, no new one introduced — automatic difficulty *escalation* across
  rounds is deliberately not built now, see "Still open" below), `tagIds` from the drawn location,
  `objectiveIds` the full `worldData/narrativeSubjects/items` pool tagged "objectif de quête"
  (`OBJECTIVE_TAG_ID`) filtered by overlap with the location's `tagIds` when it has any, and no
  `successPhraseIds`/`failurePhraseIds` of its own — `resolveQuestOutcome`'s existing per-slot
  fallback (`preferQuestPhrasesPerSlot`) already falls back to the global verb-phrase pool when a
  "quest" carries none, so this needs no new fallback logic either. This mirrors
  [Rumor and mission system](#rumor-and-mission-system)'s own precedent of reusing the objective
  pool for generated content instead of authoring a second one.
- **Multi-step resolution**: T = `encounterCount`, a new `worldData/actionTypes/items` field (same
  convention as `rumorHarvestCount`/`missionRollCount`, only meaningful for this handler),
  author-set rather than player-chosen — keeps the action a plain "Commencer" button, no new picker.
  The handler calls `resolveQuestOutcome` up to `encounterCount` times, sequentially: each round's
  `character` argument carries forward the previous round's `nextTalents` and updated wound counters
  (`woundResult`), so a mid-run talent evolution or escalating wound state genuinely affects the
  next round's threshold/wound math instead of every round rolling against the character's
  pre-action snapshot. If a round's wound kills the character (`woundResult.died`), the loop stops
  immediately — an already-dead character doesn't draw further encounters — leaving fewer than
  `encounterCount` rounds recorded for that occurrence. This is the generic "several resolution
  rounds in one action" mechanism [Modular action framework](#modular-action-framework)'s "Still
  open" note asked for, and it's exactly `resolveQuestOutcome` called in a loop, not a parallel
  implementation — any future action needing multiple rounds can reuse the same pattern.
- **Fatigue**: new `character.fatigue` field (integer, default 0, doesn't exist today — sits
  alongside `woundsLight`/`woundsSevere`/`woundsPermanent` in the schema). Increases by a flat +1
  per encounter round actually resolved (not scaled by difficulty — wounds already carry that
  scaling burden), regardless of that round's success/failure. Nothing recovers or reads it yet (no
  "Repos" action exists — [Modular action framework](#modular-action-framework) names it an
  out-of-scope illustration only) — it accumulates, unconsumed, same as
  [Location tags](#location-tags)' `tagIds` shipped before textGeneration read them.
- **Wounds**: yes — "increases after an adventure" means each encounter round is a full
  `resolveQuestOutcome` wound roll (`computeWoundThresholds`/`determineWoundSeverity`/`applyWound`),
  not a new mechanic. A single action can land several wounds, one per round that happens to hit a
  threshold, same escalation/death rules as a single quest already has via `wounds.js`.
- **Coexistence with "Partir en quête"**: "Partir explorer" is a second, sibling Aventure-branch
  action (registered under its own `partirExplorer` handlerId), alongside "Partir en quête" and
  "Mission" — not a replacement, and it does not subsume quest-drawing as an encounter outcome.
  Encounters draw plain objectives from the shared pool, never a full `worldData/quests/items`
  document; quests and missions keep their own distinct, larger-stakes actions untouched by this
  feature.

**Still open (deliberately deferred)**:
- **Escalating difficulty across rounds**: the design note's "possibly with increasing difficulty
  as T grows" isn't built as an automatic mechanic — each round independently rolls from the same
  `questDifficultyWeights`. A content author can already bias that weighting harder without any new
  code; a genuine escalation curve (e.g. a per-round tier bump) is future balance work if flat
  per-round weights turn out to feel wrong in play, same "starting balance, not playtested" status
  as `rumorHarvestCount`/`missionRollCount`.
- **Fatigue as a gate**: whether a tired character can still adventure, and how fatigue would ever
  recover, are unanswered — the field ships write-only, exactly like `triggeredQuestIds` or
  `Location tags`' `tagIds` shipped before anything consumed them.
- **Result pop-up**: `ActionOutcome.jsx`'s existing "Résolution" fieldset assumes one score/threshold
  pair (gated on `lastAction.score != null`); a multi-round action needs its own new section
  listing each round. Left to the implementation entry below, not designed here.

**Implementation scope**: see [Aventure exploration mechanics (implementation)](#aventure-exploration-mechanics-implementation)
below — now unblocked by this entry's decisions.

## Aventure exploration mechanics (implementation)

Status: **implemented**. Built exactly to the shape [Aventure exploration mechanics (spec
needed)](#aventure-exploration-mechanics-spec-needed) above decided.

`functions/src/actions/partirExplorer.js`, registered under a new `partirExplorer` handlerId in
`ACTION_HANDLERS` (`functions/src/index.ts`), is a second Aventure-branch action alongside "Partir
en quête" and "Mission" — not a replacement. `prepare()` draws one `worldData/adventureZones/items`
entry from the character's region's `adventureZoneIds` (a content gap — an empty `adventureZoneIds`
— leaves `location` null rather than failing the action) and fetches the same catalogs
`partirEnQuete.js`/`mission.js` already fetch. `resolve()` then calls `partirEnQuete.js`'s exported
`resolveQuestOutcome` up to `actionType.encounterCount` times in a loop, each round against a
synthetic pseudo-quest (`difficulty` rolled independently per round from
`actionType.questDifficultyWeights` — falling back to the same `DEFAULT_QUEST_DIFFICULTY_WEIGHTS`
`partirEnQuete.js` exports — `tagIds` from the drawn location, and objectives drawn from the
"objectif de quête" pool, filtered by overlap with the location's own `tagIds` when it has any).
Each round threads its `nextTalents` and updated wound counters into the next round's `character`
argument, and the loop stops immediately once a round's wound kills the character
(`outcome.woundResult.died`), leaving fewer than `encounterCount` rounds recorded. `resolveQuestOutcome`
was extended to also return the objective it drew, so each round can record its own `objectiveId`
without a second, redundant draw.

`encounterCount` was added to `worldData/actionTypes/items` (`shared/schema/actionType.ts`), gated
by `handlerId === "partirExplorer"` the same way `rumorHarvestCount`/`missionRollCount` are gated by
`handlerId === "rumeur"` — including a plain number input in `ActionsManager.jsx`, added next to the
existing rumeur fields since it was a cheap addition while already touching that form. `fatigue` was
added to `characters/{id}` (`shared/schema/character.ts`), `+1` per round actually resolved (not
`encounterCount`, so an early wound-death doesn't over-count) — nothing reads or recovers it yet, per
the spec entry's own "Still open" note.

`lastAction` for this handler flattens `loot`/`talentEvolutions` across every round (so
`ActionOutcome.jsx`'s existing "Butin obtenu"/"Amélioration de talent" fieldsets needed no changes),
plus a new `rounds: [{ objectiveId, difficulty, score, threshold, success, wound, reputationGained }]`
array and a summed `totalReputationGained`. `ActionOutcome.jsx` gained a "Rencontres" fieldset
listing each round (difficulty label and color reused from `QuestsManager.jsx`'s `DIFFICULTIES`,
wound label reused from the existing "Résolution" fieldset's `WOUND_LABELS`) — genuinely new UI, not
a reuse of the existing single-score fieldset, which stays gated on `lastAction.score != null` and
so never renders for this handler. The top-level `lastAction.success` (which colors the "Succès"/
"Échec" line `DefaultResult.jsx` already renders unchanged) is `true` when at least one round
succeeded — a judgment call the spec entry left to this one, since no single boolean can capture a
multi-round outcome exactly.

**Data model implications**:
```
worldData/actionTypes/items/{id}
  encounterCount: number   -- how many rounds partirExplorer resolves per occurrence; only
                            --   meaningful when handlerId is "partirExplorer", defaults to 1

characters/{id}
  fatigue: number           -- +1 per encounter round resolved by partirExplorer; defaults to 0,
                             --   write-only for now (see "Still open" above)

characters/{id}.lastAction (partirExplorer shape)
  location: { id, name } | null
  rounds: [{ objectiveId, difficulty, score, threshold, success, wound, reputationGained }]
  totalReputationGained: number
  loot / talentEvolutions: flattened across every round, same shape as partirEnQuete.js/mission.js
```

Tested in `functions/src/actions/partirExplorer.test.js`: multi-round resolution, reputation/loot
summed and flattened across rounds, the wound-death early stop (fewer than `encounterCount` rounds
recorded), and the no-location content-gap fallback.

Escalating difficulty across rounds and fatigue-as-a-gate remain deliberately unbuilt, exactly as
the spec entry's own "Still open" section already flagged.

## Intermède actions (spec needed)

Status: **designed, not implemented**. Intermède actions are bonus actions, repeatable within an
Interval, with a deliberately reduced scope — send a message, trade, post an announcement. A
player can perform at most 3 Intermède actions per Interval, shared across both Intermède windows
(see "Cap tracking" below). Some Intermède actions matter far more than their small scope
suggests: selling a mythic object, for instance, is meant to spread the rumor of that object's
presence at the sale location, around the seller.

The `intermede` root kind already exists in `ACTION_KINDS`
(`src/lib/actionKinds.js` / its server mirror), reserved for exactly this since
[Action kinds and Métier actions](#action-kinds-and-métier-actions) was built — this entry resolves
what a concrete Intermède action does and how its per-Interval cap is tracked; the paired
[Intermède actions (implementation)](#intermède-actions-implementation) entry builds what turned
out to be buildable.

**Resolved decisions:**
- **Cap tracking**: a new counter, `character.intermedeActionsThisInterval` (integer, default 0),
  fully decoupled from the main-action lock (`lastAction.completesAt`) — Intermède actions never
  touch it. Availability is instead gated by an implicit condition (same "nobody authors this row"
  convention as `hasProfession`/`trainerReachable`/`professionless`, see
  [Action kinds and Métier actions](#action-kinds-and-métier-actions) and
  [Trainers](#trainers)), checked against `< 3` and incremented by 1 on each successful resolution.
  Reset to 0 by the same Interval-boundary scheduled tick already driving
  [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)'s
  `sweepQuestTriggers` — the shared cadence the
  [Interval (12h action cycle)](#interval-12h-action-cycle) entry's "Shared clock" bullet calls for
  — as a sibling reset pass inside that same scheduled function, not a second cron schedule.
- **Shared budget across both windows**: one shared budget of 3 total per Interval, not 3 per
  window — the reading the [Interval (12h action cycle)](#interval-12h-action-cycle) entry's
  phase-cycle note already implied ("capped at 3 total"), confirmed explicitly here rather than
  left ambiguous. Since the budget check never reads `lastAction.completesAt`, a character with no
  main action slot left for the Interval (mid-countdown) but unused Intermède budget still has
  their Intermède category tabs active — the UI represents this the same way the main Action tab
  already shows its own lock state (disabling "Commencer" and showing e.g. "X/3 restantes cet
  Interval" once exhausted), not a separate UI concept.
- **"faire du commerce"**: scoped to selling only, not buying — buying would need an NPC/shop
  pricing catalog that doesn't exist and isn't part of this pass. Mechanically: the player sells one
  owned Instance (see [Object creation](#object-creation)) for gold; the sale removes the Instance
  and credits `character.gold`. The exact price formula is left to the implementation entry (same
  "starting balance, decided at build time" precedent as `trainingCost`, see
  [Trainers](#trainers)), not fixed here.
- **Mythic-sale rumor side effect — which sales qualify**: the sold object's own rarity (see
  [Object creation](#object-creation)) must be "mythique" or above (mythique, divin, unique on the
  shared 8-tier scale) — reusing the exact tier the original design note named ("selling a mythic
  object") as the floor, rather than inventing a separate threshold. What the side effect writes was
  already settled by [Rumor and mission system](#rumor-and-mission-system): a direct
  `worldData/regions/items/{regionId}/rumorSightings/{rumorId}` entry at the seller's current
  region, skipping the normal hop-by-hop propagation decay.

**Still open (deliberately deferred):**
- **"envoyer un message"**: confirmed to feed the still-undesigned messaging feature
  ([Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)'s
  page 3 reserves a slot for it but doesn't design it). Not buildable until messaging gets its own
  spec entry — out of this pass's and the paired implementation entry's scope.
- **"placer une annonce"**: confirmed to feed the mission-announcement idea noted under
  [Rumor and mission system](#rumor-and-mission-system) — one player's announcement becoming
  another (or the same) player's discoverable Aventure hook. [Aventure exploration mechanics
  (implementation)](#aventure-exploration-mechanics-implementation) shipped without any such hook:
  "Partir explorer" only ever draws encounters from the static "objectif de quête" pool, never from
  anything player-generated. Building "placer une annonce" needs that discoverable-hook mechanism
  designed first — no cross-character interaction of this kind exists anywhere in the game yet, and
  this pass doesn't invent one.
- **Mythic-sale rumor content**: a sale has no backing `worldData/rumors/items` catalog entry to
  copy text/rarity from the way a hand-authored rumor does — how the sighting's (and, once
  harvested, the character journal entry's) flavor text gets generated for a sale-triggered sighting
  isn't decided here. Left to the implementation entry.

**Implementation scope**: see
[Intermède actions (implementation)](#intermède-actions-implementation) below — partially
unblocked by this entry's decisions (cap tracking and "faire du commerce" are buildable now;
"envoyer un message" and "placer une annonce" stay out of scope until their own prerequisites are
designed).

## Intermède actions (implementation)

Status: **implemented**, scoped down to what
[Intermède actions (spec needed)](#intermède-actions-spec-needed) actually resolved: the
per-Interval cap-tracking mechanism, plus "faire du commerce" (sell only). "envoyer un message" and
"placer une annonce" stay out of scope — both need prerequisites (the still-undesigned messaging
feature [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)
reserves a page for, and a not-yet-existing player-announcement discoverable-hook mechanism for
[Aventure exploration mechanics](#aventure-exploration-mechanics-implementation)) that this pass
deliberately didn't build.

A blocking architecture gap surfaced while implementing this that the spec entry hadn't
anticipated: every action type up to now (`runActionPipeline` in
`functions/src/lib/actionPipeline.js`) unconditionally checks the once-per-Interval
`isActionRunning` lock and unconditionally overwrites `character.lastAction` via `stampLifecycle`
— including "S'entraîner"/"Apprentissage", which sit under the `intermede` root kind in
`actionKinds.js` but consume the *main* lock, not this budget. Resolved by making the bypass
kind-scoped rather than root-scoped: a new `commerce` kind (`parentId: "intermede"`, sibling to
`entrainement`), and `actionKinds.js`'s `actionUsesIntermedeBudget(kindId)` — currently just
`["commerce"]`, the list "envoyer un message"/"placer une annonce" will join once built — which
`runActionPipeline` checks to skip *both* the lock check and the `stampLifecycle` envelope for
these kinds specifically, leaving `entrainement`/`apprentissage` unaffected. A second gap: since a
budget action never writes `lastAction`, it has no result pop-up to show its outcome through —
resolved by having `performAction` thread the handler's `resolve()` return value back to the
caller under a `response` key (`{ ok: true, response }`, additive — every other handler leaves it
undefined), which `CommercePicker.jsx` reads directly instead of watching the character snapshot.
See [docs/ARCHITECTURE.md](ARCHITECTURE.md)'s "Intermède-budget actions" section for the full
mechanism.

**Built**:
- `character.intermedeActionsThisInterval` (default 0, `shared/schema/character.ts`), incremented
  by the handler on success, reset to 0 as a sibling pass inside `sweepQuestTriggers`
  (`functions/src/lib/questTriggers.js`) — not a second cron schedule.
- The implicit `hasIntermedeBudget` condition (`functions/src/lib/actionConditions.js` ⇄
  `src/lib/actionConditions.js`), injected by `resolveConditions` (`actionCatalog.js`) for any kind
  `actionUsesIntermedeBudget` recognizes, checked against `< 3`.
- `faireDuCommerce.js` (`functions/src/actions/faireDuCommerce.js`, registered under the shared
  `faireDuCommerce` handlerId): the player sells one owned Instance (picked client-side via the new
  `CommercePicker.jsx`, re-validated server-side, never trusted from the client) for gold, priced
  by a fixed per-rarity table (`functions/src/lib/salePrice.js` ⇄ `src/lib/salePrice.js`, same
  mirrored-module convention as `trainingCost.js` — a starting-balance table, not a formula, since
  an object has no "quality" of its own to scale against like a talent does): commun 10, peu commun
  25, rare 50, très rare 100, légendaire 250, mythique 600, divin 1500, unique 4000.
- **Mythic-sale rumor side effect**: selling an object of rarity "mythique" or above authors a new
  `worldData/rumors/items` entry on the fly (there being no hand-authored rumor to copy from for a
  sale, unlike `RumorsManager.jsx`'s own flow) with generated French flavor text naming the object
  and the seller's region, plus the matching
  `worldData/regions/items/{regionId}/rumorSightings/{rumorId}` entry — same shape
  `RumorsManager.jsx` itself seeds — at the seller's current region only, skipping the normal
  hop-by-hop propagation decay.
- UI: `ActionBrowser.jsx` gained a `budgetActionsOnly` mode (Intermède-budget actions only, no
  category tabs) so `ActionPanel.jsx` can still offer "Faire du commerce" while the character's
  main action is counting down, plus an inline "X/3 restantes cet Interval" indicator on the
  Intermède tab.

**Not built** (see "Still open" under the spec entry): "envoyer un message", "placer une annonce".

## Composite quests (spec needed)

Status: **implemented** — see the paired [Composite quests (implementation)](#composite-quests-implementation) entry below for what shipped. A composite quest is a sequence of quests, where each step
beyond the first is revealed only once the previous step is completed. Quests already grant
meaningfully better rewards than missions (gear, talent evolution — see
[Quest loot draw](#quest-loot-draw) and
[Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success)); a
composite quest is where that reward gap matters most, as a multi-Interval commitment — resolved
below by reusing the existing reward engine verbatim rather than adding a second one.

**Resolved decisions:**
- **Chain authoring**: a new catalog, `worldData/questChains/items/{id}`, each entry an ordered
  array `questIds: string[]` of existing `worldData/quests/items` ids (step 1 first) — not a
  `nextQuestId` pointer on the quest document itself. An explicit ordered list gives the chain its
  own identity to track progress against, and avoids the cycle-safety problem
  [Talent relations](#talent-relations) already flagged for a pairwise ancestor/descendant-style
  link; it also matches how every other catalog in this project (loot tables' `itemIds`,
  professions' `actionIds`, quests' own `objectiveIds`) already references another catalog through
  an id array on a parent document, rather than a self-referencing pointer. No creator UI in the
  first pass — authored directly in the Firestore console, same convention as `quest.trigger` and
  `tier.talentGain`.
- **Reveal mechanism**: reused, not reinvented. A composite quest's first step is just an ordinary
  quest, discoverable however quests normally are (the random region/difficulty draw, or its own
  `trigger` per
  [Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages)) —
  a chain only starts mattering once step 1 is *completed*. When `partirEnQuete.js`'s `resolve()`
  resolves a quest **successfully**, it checks whether that quest's id appears in some chain's
  `questIds`; if so, and it isn't that chain's last step, the next step's quest id is pushed
  straight into `character.triggeredQuestIds` (the same `FieldValue.arrayUnion` write
  `questTriggers.js`'s scheduled sweep already does for a normal trigger match), and
  `character.questChainProgress[chainId]` is bumped to the new step index. This reuses the entire
  existing reveal/notification pipeline (end-of-action pop-up page 2, localStorage "shown"
  tracking) for free, with no new condition type and no new "completed quests" history field —
  only a small, chain-scoped progress counter is added. A failed step does not advance the chain;
  the character keeps the same step pending and simply attempts it again.
- **Drawing steps 2+**: once a chain step beyond the first is pending (granted into
  `triggeredQuestIds` but not yet reflected in `questChainProgress[chainId]`), it does not compete
  in `partirEnQuete.js`'s normal random region/difficulty pool. `prepare()` checks for a pending
  chain step first; if the character has one, that exact quest is used, bypassing the `regionIds`
  filter entirely (the chain has already earned the right to be offered regardless of where the
  character currently is), and a difficulty is picked uniformly at random from the step's own
  `difficulties` array (content authors are expected to author chain steps with a single difficulty
  each to keep this deterministic, though nothing enforces it). Resolution then falls straight
  through to the existing `resolveQuestOutcome` engine, unchanged. While a chain step is pending,
  "Partir en quête" offers only that step — no unrelated quest can be drawn instead, matching the
  design intent that a chain shouldn't compete with an unrelated quest in the random pool.
  "Mission" (`mission.js`) is untouched: composite quests only ever apply to the hand-authored
  `worldData/quests/items` catalog "Partir en quête" draws from, not missions' on-the-fly generated
  offers.
- **Multiple pending chains**: if a character somehow has more than one chain's step pending at
  once, the earliest-granted pending step wins (earliest insertion into `triggeredQuestIds`) — a
  rare content-authoring edge case, resolved with a simple deterministic tiebreak rather than left
  ambiguous.
- **Reward tiering**: unchanged from a normal quest — no new reward math. Difficulty, and
  therefore loot count, reputation, and talent-evolution chance, are still whatever each step's own
  `difficulties` says, exactly like
  [Mission and quest resolution algorithm](#mission-and-quest-resolution-algorithm) already
  resolves for any quest. A chain's escalating stakes (a modest early step, an epic finale) are
  purely a content-authoring choice — pick harder quests for later steps — not a mechanic the engine
  special-cases, the same way [Aventure exploration mechanics](#aventure-exploration-mechanics-spec-needed)
  resolved its own "how do rounds differ" question by reusing the resolution engine verbatim.

**Data model implications**:
```
worldData/questChains/items/{id}   -- NEW collection
  name: string           -- French, for reference/authoring only; not shown to players yet
  questIds: string[]     -- worldData/quests/items ids, ordered, step 1 first

characters/{id}
  questChainProgress: { [chainId: string]: number }   -- NEW, number of steps of that chain
                                                        --   completed so far (0 = chain not
                                                        --   started) - an index into the chain's
                                                        --   questIds this character has cleared
```

**Implementation scope** (roadmap #20, now unblocked):
- Read: `functions/src/actions/partirEnQuete.js` (`prepare()`'s region/difficulty draw and
  `resolve()`'s success handling — both need the chain-step branch described above),
  `functions/src/lib/questTriggers.js` (the `triggeredQuestIds` arrayUnion convention this reuses),
  `shared/schema/quest.ts` and `shared/schema/character.ts` (where `questChainProgress` and the new
  collection's schema land, per this project's schema-file convention).
- Create: a `worldData/questChains/items` schema file (Zod format, per this project's rule for new
  components) and the collection itself.
- Update: `functions/src/actions/partirEnQuete.js`, `shared/schema/character.ts`
  (`questChainProgress`), and the `functions/src/schema/quest.ts`/`character.ts` re-exports.
- Do not read or open any other file without asking the user first.

See the paired [Composite quests (implementation)](#composite-quests-implementation) entry below
for what shipped.

## Composite quests (implementation)

Status: **implemented**. Builds exactly the shape
[Composite quests (spec needed)](#composite-quests-spec-needed) above decided: a new
`worldData/questChains/items` catalog (`shared/schema/questChain.ts` ⇄
`functions/src/schema/questChain.ts`, no creator UI, authored directly in the Firestore console),
a `character.questChainProgress` counter (`shared/schema/character.ts`), and the chain-step branch
in `partirEnQuete.js`'s `prepare()`/`resolve()` (`findPendingChainStep`/`findChainAdvance`) — see
[docs/ARCHITECTURE.md](ARCHITECTURE.md)'s "Composite quests" section for the full mechanism.
`mission.js` is untouched, per the spec's own scoping.

**Implementation scope**: see
[Composite quests (spec needed)](#composite-quests-spec-needed)'s own "Implementation scope"
above — the same file list applies here, since the spec pass already scoped exactly what building
it touches.

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

Status: **implemented**. [Rumor and mission system](#rumor-and-mission-system) already
implemented mission launching: `MissionPicker.jsx` lists a character's `missionJournal` entries and
starts the "Mission" action (`kindId: "aventure"`, `handlerId: "mission"`) with the picked
`missionId`, embedded in `ActionBrowser.jsx`'s Aventure category tab alongside "Partir en quête" and
"Rumeur".

- This already satisfies the substance of "launch missions from the Aventure tab, backed by the
  character's mission journal" — no separate mechanic left to build.
- The presentational gap against the source design ("l'onglet Aventure/missions") — missions being
  one action among others inside the shared Aventure tab, with no visual distinction — is now
  closed: `MissionPicker.jsx` wraps its mission list in a `<fieldset className="action-loot-box">`
  with a `<legend>Missions en cours</legend>`, the same titled-subsection convention already used
  by `ActionOutcome.jsx` for "Butin obtenu" and "Amélioration de talent", giving the mission list
  its own heading within the Aventure tab's action detail panel.

Not blocking anything else in this list.

## Mission subject and action catalog (spec needed)

Status: **spec resolved, not implemented**. Replaces the multi-slot narrative grammar system
(`worldData/verbPhrases/items`, see
[Procedural narrative generation](#procedural-narrative-generation)) as the source of a mission's
*name* with a much simpler two-part model: an **Action** and a **Subject**, concatenated to read as
a title — "Protéger caravane marchande", "Vaincre dragon noir", "Enquêter sur meurtres macabres".
This is a new, dedicated catalog pair — distinct from `worldData/actionTypes/items` (the gameplay
action a character actually performs, e.g. "Partir en mission", "S'entraîner") — narrative
title-building blocks only.

- **Shared type field**: both a mission-name Action and a Subject carry a `type` string. It starts
  seeded with four values — ennemis, livraison, trésor, protection — but is plain free text, not a
  hardcoded frontend enum (unlike, say, `OBJECT_TYPES`): a content author adds a new type simply by
  giving an Action or Subject an unseen `type` value, no code change needed, the same
  no-code-touch-to-extend convention already used for tag ids. Generation only ever pairs an Action
  and a Subject sharing the same `type` value.
- **Mission-name Action catalog** (new, `worldData/missionActions/items` — named to avoid colliding
  with "verb phrase" from the grammar system it replaces): a French phrase template ("Protéger",
  "Vaincre", "Enquêter sur") plus its `type`. The phrase is authored as a complete bare prefix,
  including any trailing preposition it needs ("Enquêter sur" is one authored string, not "Enquêter"
  plus a separate preposition field) — the same "author the whole fragment, no placeholder grammar"
  convention `textGeneration.js` already uses elsewhere. Kept deliberately separate from the
  gameplay `worldData/actionTypes/items` catalog — nothing about starting a mission ties to which
  phrase named it. Has its own creator UI, `MissionActionsManager.jsx`, registered as a tab in
  `CreatorDashboard.jsx` — this catalog is meant to keep growing with content the way quests, objects,
  and talents do, so it gets the same list-then-create management screen those get, rather than the
  Firestore-console-only route used for a single narrow field like `tier.talentGain`.
- **Subject catalog** (new, `worldData/missionSubjects/items`): a base French name ("caravane
  marchande", "dragon", "meurtres"), its `type`, and:
  - **Climates**: a multi-select of the climates it may appear in (used later to match a subject to
    the region it's generated for — see
    [Regional mission generation and journal](#regional-mission-generation-and-journal-spec-needed)).
  - **Difficulty tiers**: for each of some subset of the existing 6-tier difficulty scale (see
    [Quest difficulty](#quest-difficulty)) the subject can appear at, an optional prefix and/or
    suffix string, plus any extra `tagIds` that tier contributes. Example: "dragon" — prefix "jeune"
    at difficile, prefix "ancien" at mythique, suffix "adulte" at très difficile, suffix "liche" at
    épique (contributing e.g. a "mort-vivant" tag).
  - **Variations**: a separate, difficulty-independent list of prefix/suffix flavor modifiers, each
    with its own `tagIds` — e.g. suffix "rouge" (tags: feu), suffix "blanc" (tags: glace). One
    variation is drawn at random per generation, independent of the difficulty draw.
  Also gets its own creator UI, `MissionSubjectsManager.jsx`, same tab-in-`CreatorDashboard.jsx`
  convention as the Action catalog above, since its per-entry structure (climates, difficulty tiers,
  variations) is richer than a single-field console edit would comfortably support.
- **Name assembly**: at generation time, once a `type`-matched Action and Subject are picked (plus a
  difficulty and a random variation for the Subject), the final mission name is assembled in a fixed
  slot order — difficulty-tier prefix, then variation prefix, then the Subject's base name, then
  variation suffix, then difficulty-tier suffix — with any absent slot simply skipped, then the whole
  Subject string appended after the Action's phrase. Example: Action "Vaincre" + Subject "dragon"
  drawn at épique with the "liche" difficulty suffix and the "rouge" variation suffix →
  "Vaincre dragon rouge liche". As with the rest of `textGeneration.js`, there's no automatic French
  grammatical agreement check on the assembled result — a content-authoring discipline, not a code
  guarantee.

**Data model implications**:
```
worldData/missionActions/items/{id}   -- NEW catalog
  phrase: string      -- French, complete phrase including any trailing preposition,
                       --   e.g. "Protéger", "Vaincre", "Enquêter sur"
  type: string         -- free text, matched against a Subject's own type; seeded with
                        --   ennemis | livraison | tresor | protection, open to more

worldData/missionSubjects/items/{id}  -- NEW catalog
  name: string                        -- French base name, e.g. "dragon"
  type: string                        -- free text, matched against a mission Action's own type
  climateIds: string[]                -- climates this subject can be generated for
  difficultyTiers: [{
    difficulty: string,               -- one of the 6-tier DIFFICULTIES scale
    prefix: string | null,
    suffix: string | null,
    tagIds: string[],
  }]
  variations: [{
    prefix: string | null,
    suffix: string | null,
    tagIds: string[],
  }]
```

Not implemented yet. Current mission naming instead draws one `worldData/narrativeSubjects/items`
objective and runs it through the multi-slot verb-phrase grammar — see
[Rumor and mission system](#rumor-and-mission-system) and
[Procedural narrative generation](#procedural-narrative-generation).

**Implementation scope** (roadmap #22):
- Create: `worldData/missionActions/items` and `worldData/missionSubjects/items` schema files
  (`functions/src/schema/`), `MissionActionsManager.jsx` and `MissionSubjectsManager.jsx`
  (`src/components/creator/`), plus the name-assembly helper (mirroring `textGeneration.js`'s
  existing slot-assembly style).
- Update: `CreatorDashboard.jsx` (register the two new tabs).
- Do not read or open any other file without asking the user first — the drawing/generation logic
  that calls this assembly helper is [Regional mission generation and journal](#regional-mission-generation-and-journal-spec-needed)'s
  scope, not this entry's.

## Mission loot and rarity mapping (spec needed)

Status: **spec resolved, not implemented**. Blocked by
[Mission subject and action catalog](#mission-subject-and-action-catalog-spec-needed). Once a
mission is generated from a difficulty and a Subject (with its difficulty-tier and variation
`tagIds`), this entry pins down how that combination selects a `worldData/lootTables/items` entry —
reusing the exact matching mechanism [Quest loot draw](#quest-loot-draw) already built (rarity match
+ tag overlap against `worldData/lootTables/items`), not a new one.

- **Difficulty-to-rarity equivalence**: the mission's difficulty tier (the existing 6-tier
  `DIFFICULTIES` scale) maps onto the existing 8-tier rarity scale the same way
  `worldData/narrativeSubjects/items` objectives already do it today (see
  [Quest loot draw](#quest-loot-draw)'s rarity source) — reused, not redefined.
- **Tag source for matching**: the union of the difficulty-tier `tagIds` and variation `tagIds`
  drawn for this Subject at generation time (see
  [Mission subject and action catalog](#mission-subject-and-action-catalog-spec-needed)) — the
  Subject catalog has no separate base-level `tagIds` of its own, only per-difficulty-tier and
  per-variation ones.
- **Resolved once per mission occurrence, not re-rolled per item**: unlike
  [Quest loot draw](#quest-loot-draw), where each loot item independently re-rolls a random
  objective (and therefore its own rarity/tag pool), every loot item drawn for one mission
  occurrence shares the exact same rarity and tag pool. A mission's difficulty, Subject,
  difficulty-tier, and variation are all already fixed once, at generation time — there is no
  second candidate to re-roll per item the way a quest's several possible objectives allow. Only
  the loot table pick and the `drawLootTableItemId` draw within it vary per item.
- **Loot count**: still driven by `LOOT_COUNT_BY_DIFFICULTY` (see
  [Quest loot draw](#quest-loot-draw)), unchanged.

Not implemented yet.

## Regional mission generation and journal (spec needed)

Status: **spec resolved, not implemented**. Blocked by
[Mission subject and action catalog](#mission-subject-and-action-catalog-spec-needed) and
[Mission loot and rarity mapping](#mission-loot-and-rarity-mapping-spec-needed). Replaces
[Rumor and mission system](#rumor-and-mission-system)'s mission-generation mechanic (today: one
random `worldData/narrativeSubjects/items` objective and a uniformly random difficulty) with a
climate-aware draw against the new Subject/Action catalog, and ties each generated mission to the
region it was generated in.

- **Region climate**: regions gain a `climateIds: string[]` field (multi-select, mirroring the
  Subject catalog's own `climateIds` rather than a single value) — a region bordering several
  biomes can list more than one climate. No such field exists on `worldData/regions/items` today.
- **Generation**: for each mission rolled, draw a difficulty, then a random Subject whose
  `climateIds` overlaps the region's `climateIds` (same tag-overlap-style matching already used
  elsewhere in this catalog, e.g. [Quest loot draw](#quest-loot-draw)'s tag matching — not an
  exact-set match) and whose difficulty-tier list includes the drawn difficulty, then a random
  Action sharing that Subject's `type`, then a random variation for the Subject (independent of
  difficulty) — assembling the mission name per
  [Mission subject and action catalog](#mission-subject-and-action-catalog-spec-needed).
- **Generation trigger**: mission generation is triggered exclusively by performing "Se renseigner"
  ([Se renseigner intermède action](#se-renseigner-intermède-action-spec-needed)) — mirroring how
  the "Rumeur" action it replaces is today's sole trigger for a `missionRollCount` batch of draws
  (see [Rumor and mission system](#rumor-and-mission-system)). No passive or scheduled source
  generates missions; the scheduled Interval tick (`sweepQuestTriggers`) stays reserved for quest
  triggers and rumor propagation, not mission generation.
- **Roll count and overwrite semantics unchanged**: `missionRollCount` (missions rolled per
  trigger, still a `worldData/actionTypes/items` field, default 3) and the "unclaimed journal
  entries are simply overwritten on the next roll" rule (see
  [Rumor and mission system](#rumor-and-mission-system)) both carry over unchanged — climate-gating
  only narrows which Subjects are eligible for a given roll, it doesn't change how many missions
  are rolled or what happens to leftovers. A region whose climate has too few matching Subjects to
  fill `missionRollCount` is a content-coverage gap (same "silently skipped, not retried" precedent
  as [Quest loot draw](#quest-loot-draw)), not a mechanic change.
- **Region-locked**: a generated mission is tied to its origin region (already true of
  `character.missionJournal` entries' `regionId`/`locationId` today — see
  [Rumor and mission system](#rumor-and-mission-system)) and can only be completed there; a
  character who travels to a different region should not be able to resolve a mission generated
  elsewhere. This needs an explicit check added to the mission-resolution handler
  (`functions/src/actions/mission.js`), since today's implementation records `regionId` but never
  enforces it against the character's current region at resolution time.
- **Mission journal UI**: the player's mission journal — already the `character.missionJournal`
  array and its `MissionPicker.jsx` display (see [Rumor and mission system](#rumor-and-mission-system),
  [Aventure mission launch UX polish](#aventure-mission-launch-ux-polish)) — is reused, not rebuilt,
  but its listing needs grouping/sorting by region first, then difficulty within each region, rather
  than today's flat list.
- **"Partir en mission"**: the existing "Mission" action (`kindId: "aventure"`, `handlerId:
  "mission"`) and its `MissionPicker.jsx` entry point in the Aventure tab already satisfy "select a
  journal entry and perform it from the Aventure tab" — no new action or entry point needed, only
  its generation source and journal display change.

**Data model implications** (sketch):
```
worldData/regions/items/{id}
  climateIds: string[]   -- NEW, climates this region draws mission Subjects from

characters/{id}.missionJournal[]   -- shape mostly unchanged (see Rumor and mission system),
                                     --   but objectiveId/tagIds replaced by references into the
                                     --   new Subject/Action catalog and the drawn variation
```

Not implemented yet.

## Retiring quests and quest objectives for the subject-action system (spec needed)

Status: **designed, not implemented**. Blocked by
[Mission subject and action catalog](#mission-subject-and-action-catalog-spec-needed),
[Mission loot and rarity mapping](#mission-loot-and-rarity-mapping-spec-needed), and
[Regional mission generation and journal](#regional-mission-generation-and-journal-spec-needed). The
description handed down for this chantier is explicit that both "objectif de quête"
(`worldData/narrativeSubjects/items` tagged "objectif de quête") and "quête"
(`worldData/quests/items`, the hand-authored catalog) disappear, replaced everywhere by the
Subject/Action mission system above. Several already-implemented features are built directly on top
of the catalog being retired here, so this entry exists to decide, explicitly, what happens to each
rather than leave it as an unplanned casualty.

- **Hand-authored quests gone**: `worldData/quests/items`, `QuestsManager.jsx`, and the "Partir en
  quête" action/handler (`partirEnQuete.js`) are retired. "Partir en mission" (see
  [Regional mission generation and journal](#regional-mission-generation-and-journal-spec-needed))
  becomes the sole Aventure-branch action drawing on this generative content; whether "Partir en
  quête" is deleted outright or simply stops being offered (`enabled: false`) is an
  implementation-time call, not a design one.
- **"Objectif de quête" gone**: `worldData/narrativeSubjects/items` tagged "objectif de quête" and
  `QuestObjectivesManager.jsx` are superseded by the new Subject catalog everywhere they were
  previously the rarity/tag source — [Quest loot draw](#quest-loot-draw),
  [Talent evolution and unlock on quest success](#talent-evolution-and-unlock-on-quest-success), and
  [Aventure exploration mechanics](#aventure-exploration-mechanics-implementation)'s encounter draw
  all currently read from this pool and need to be repointed at the Subject catalog instead.
- **Verb phrases superseded for mission naming**:
  [Procedural narrative generation](#procedural-narrative-generation)'s multi-slot grammar
  (`worldData/verbPhrases/items`) stops being the source of a mission's *name*, per
  [Mission subject and action catalog](#mission-subject-and-action-catalog-spec-needed) — but it may
  still have a role narrating the mission's *outcome* (the success/failure paragraph shown in the
  result pop-up), which is a separate concern from the title. Whether outcome narration keeps using
  verb phrases as-is, keyed off the mission's Subject `tagIds` instead of an objective's, or is
  retired too, is an open question below.

**Still open (deliberately deferred) — needs a decision before this entry can be implemented**:
- **Composite quests** ([Composite quests](#composite-quests-implementation),
  `worldData/questChains/items`, `character.questChainProgress`): built entirely on the
  hand-authored quest catalog being retired here. No equivalent "chain of missions" concept exists
  in the description. Does this feature get ported onto Subjects (a chain of Subject/difficulty
  pairs instead of quest ids), retired outright, or left stranded as dead code/data until a future
  decision? Confirm with the user before implementing this entry.
- **Quest triggers**
  ([Quest triggers and end-of-action pop-up pages](#quest-triggers-and-end-of-action-pop-up-pages),
  `quest.trigger`, `character.triggeredQuestIds`, the scheduled `sweepQuestTriggers` sweep): a
  condition-gated grant mechanism keyed to specific hand-authored quests. With no hand-authored
  quest catalog left, this either needs a new target to grant (a specific Subject? a guaranteed
  mission generation?) or is retired. Confirm with the user before implementing this entry.
- **Mission and quest resolution algorithm**
  ([Mission and quest resolution algorithm](#mission-and-quest-resolution-algorithm), the score-roll
  success/wound/reward engine): written to be difficulty- and tag-driven, not quest-catalog-specific,
  so it should carry over onto the new mission shape largely unchanged — flagged here for
  confirmation, not because it's expected to need real rework.
- **`favoredQuestIds`** (talents, see [Quest creation and editing](#quest-creation-and-editing)) and
  **`worldData/rumors/items.linkedQuestId`** (see [Rumor and mission system](#rumor-and-mission-system))
  both reference `worldData/quests/items` ids directly and go dangling once that catalog is retired
  — needs cleanup (drop the fields, or repoint them) as part of implementing this entry.

**Implementation scope**: not scoped yet — this entry's own open questions (composite quests, quest
triggers) need the user's decision first; scoping the actual file-by-file removal/migration is left
to whichever pass resolves those.

Not implemented yet.

## Se renseigner intermède action (spec needed)

Status: **designed, not implemented**. Blocked by
[Regional mission generation and journal](#regional-mission-generation-and-journal-spec-needed)
(needs the new generation routine to call) and, for the "Rumeur" harvesting half described below,
[Retiring quests and quest objectives for the subject-action system](#retiring-quests-and-quest-objectives-for-the-subject-action-system-spec-needed)
(needs that entry's still-open question about the rumor-flavor-text mechanic's fate resolved first).
Replaces the "Rumeur" action (`kindId: "intermede"`, `handlerId: "rumeur"`, see
[Rumor and mission system](#rumor-and-mission-system)) with "Se renseigner" — same Intermède-kind
action slot, but no longer always available: it is only offered again once the character has
completed a certain number of missions, that count itself scaled by reputation, mirroring how rumor
availability used to be paced.

- **Renamed and repurposed**: "Se renseigner" takes over "Rumeur"'s role of generating new
  `character.missionJournal` entries (now via the climate/Subject draw in
  [Regional mission generation and journal](#regional-mission-generation-and-journal-spec-needed)
  instead of the current objective+uniform-difficulty draw).
- **Reputation-scaled cadence**: rather than being available every Interval like any other Intermède
  action, "Se renseigner" only reappears once the character has completed
  `missionsRequiredForRenseignement(reputation)` missions since it was last available — the exact
  formula/table is left open below, but the shape (a reputation-scaled mission count, not a flat
  cooldown) mirrors [Rumor and mission system](#rumor-and-mission-system)'s original design intent
  for rumor pacing.

**Still open (deliberately deferred)**:
- The exact reputation-to-mission-count formula or table.
- Whether "Se renseigner" still harvests `worldData/rumors/items` sightings into
  `character.rumorJournal` the way "Rumeur" did, or drops that half entirely and becomes
  mission-generation-only — depends on
  [Retiring quests and quest objectives for the subject-action system](#retiring-quests-and-quest-objectives-for-the-subject-action-system-spec-needed)'s
  still-undecided fate for the flavor-text rumor mechanic (region rumor sightings/propagation,
  `RumorBanner.jsx`, etc., none of which this chantier's description explicitly mentions removing).
- How the "count since it was last available" counter is tracked (a new `character` field, mirroring
  `character.intermedeActionsThisInterval`'s "nobody authors this row" convention, most likely) and
  where it resets/increments — needs pinning down alongside the reputation formula above.

**Data model implications** (sketch):
```
characters/{id}
  missionsSinceRenseignement: number   -- NEW (name TBD), increments on each completed mission,
                                         --   reset to 0 once "Se renseigner" becomes available again
```

Not implemented yet.
