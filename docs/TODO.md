# Planned features / backlog

Design notes for features that aren't implemented yet. Not a task tracker for in-progress work — see the session's task list for that. Add new entries here when a feature is decided but not yet built. The `## Roadmap` section right below is the priority-ordered index into everything below it — start there; the detailed `##` entries further down stay the reference/spec content they've always been.

This roadmap was restarted on 2026-08-24 from [rework-plan.md](../rework-plan.md), the plan for porting the Python model's rules onto this project. The previous roadmap and all its entries — including the reference documentation for everything already shipped — are archived in [docs/archives/TODO-2026-08-24-pre-python-rework.md](archives/TODO-2026-08-24-pre-python-rework.md); read it for how any existing system currently works. The two planning documents this roadmap derives from live at the repo root: [python-model-logic-diff.md](../python-model-logic-diff.md) (the analysis) and [rework-plan.md](../rework-plan.md) (the plan itself, the one that drives this file). Each entry below summarises the plan's decisions; the plan itself is the long form, including the 17 resolved open calls (§1.3) and the risks (§9).

## Roadmap

Priority-ordered, dependency-aware queue of everything below that isn't cleanly `Status: **implemented**`. `/next-todo` reads this table to pick the next item.

Columns: `Status` is `spec` (needs a design/decision pass, not code), `todo` (spec is settled, build it), or `done`. `Blocked by` lists row numbers that must all be `done` before a row is actually pickable — a row's own `Status` doesn't encode blocked-ness, it's always what the row *would be* once unblocked; readiness is always `Status ≠ done` AND every listed blocker is `done`. Rows are otherwise in priority order — earlier is more important, not just "more ready".

| # | Item | Status | Blocked by | Entry |
|---|------|--------|------------|-------|
| 1 | Retire narration (generator, catalogs, creator pages, poc) | done | — | [Narration removal](#narration-removal) |
| 2 | Area and Monster contracts (Zod schemas, shared + functions) | done | — | [Area and Monster contracts](#area-and-monster-contracts) |
| 3 | Monster creator page (CRUD, inheritance preview) | done | 2 | [Monster creator page](#monster-creator-page) |
| 4 | Area creator page + `region.areaId` | todo | 2 | [Area creator page and region.areaId](#area-creator-page-and-regionareaid) |
| 5 | Content migration scripts (areas, monsters, reputation, triggers) | todo | 3, 4 | [Content migration scripts](#content-migration-scripts) |
| 6 | Resolution engine rebuild (thresholds, bands, tier drop) | todo | 1 | [Resolution engine rebuild](#resolution-engine-rebuild) |
| 7 | `ActionResult` + `applyActionResult`, all eight handlers | todo | 6 | [ActionResult and the single applier](#actionresult-and-the-single-applier) |
| 8 | Mission generation from the bestiary | todo | 5, 6 | [Mission generation from the bestiary](#mission-generation-from-the-bestiary) |
| 9 | Monster-pool loot with difficulty rarity ceiling | todo | 8 | [Monster-pool loot](#monster-pool-loot) |
| 10 | Per-region reputation (+ zero-sum invariant tests) | todo | 7 | [Per-region reputation](#per-region-reputation) |
| 11 | Talent training roll + monster talent reward | todo | 7, 8 | [Talent training roll and monster talent reward](#talent-training-roll-and-monster-talent-reward) |
| 12 | Quest chains on monsters + chain completion rewards | todo | 8, 10 | [Quest chains on monsters](#quest-chains-on-monsters) |
| 13 | Travel action ("Voyager") | todo | 10 | [Travel action (Voyager)](#travel-action-voyager) |
| 14 | Result pop-up rework (`Succès/Échec : {mission.name}`, signed reputation) | todo | 7 | [Result pop-up rework](#result-pop-up-rework) |
| 15 | Healing / wound recovery — spec | spec | 6 | [Healing and wound recovery](#healing-and-wound-recovery) |
| 16 | Métier rework: jobs, per-trainer ceilings, proficiency as rarity ceiling | todo | 7 | [Métier rework](#métier-rework) |
| 17 | Merchants and the buy side of the economy — spec | spec | 16 | [Merchants and the buy side of the economy](#merchants-and-the-buy-side-of-the-economy) |
| 18 | Region adjacency gating for travel | todo | 13 | [Region adjacency gating](#region-adjacency-gating) |

**Why this order**: the rows follow the rework plan's four waves, and the wave boundaries were chosen so the game is playable at the end of each one.

- **Wave 0 — rows 1-2.** Narration removal (#1) and the new contracts (#2) are both unblocked and change nothing else's behaviour, so they go first: #1 deletes the code #6 would otherwise have to keep calling, and #2 writes the schemas every content and rules row reads. Doing #2 before any creator page exists is deliberate — per `CLAUDE.md` the schema file is the contract, written first, then wired in.
- **Wave 1 — rows 3-5.** The content layer. Monster (#3) leads Area (#4) because it's the directive-2 deliverable and the bigger page; both need #2's schemas. Migration scripts (#5) come once both pages exist, so an author can fix up what the scripts can only guess at (`areaType` and `lootItemIds` have no source in the old data). **Budget an authoring pass between #5 and #8**: a region whose area type no monster covers generates an empty journal.
- **Wave 2 — rows 6-14.** The rules layer. The engine (#6) is the foundation and only waits on #1 clearing the narration calls out of `missionResolution.js`. `ActionResult` (#7) sits directly on it and is itself the blocker for most of the rest, because reputation (#10), talent effects (#11) and the pop-up (#14) are all just effect channels through the one applier. Generation (#8) needs both the content (#5) and the engine (#6); loot (#9) draws from the monster generation picked, so it trails. Quest chains (#12) need generation to key on monsters (#8) and reputation to be per-region (#10) before chain rewards can name a region. Travel (#13) is late in the wave because it's what makes per-region reputation (#10) an actual choice rather than a rename. The pop-up (#14) closes the wave — it's the visible half of directive 5 and only needs #7's outcome shape.
- **Wave 3 — rows 15-18.** Balance and economy. Healing (#15) is a *named* row and not a someday note because #6 raises injury frequency roughly sixfold with no drain on the ladder — see the risk note in that entry. The Métier rework (#16) carries the deferred gold/trainer/harvest calls (plan decisions 1 and 15), merchants (#17) follow it, and adjacency gating (#18) is last because it can only tighten a travel action that already ships in #13.

Not carried over from the archived roadmap: its four still-open rows (#32-35 there — Métier action-kind polish, misc small polish, rumor region-to-region propagation, known-recipes grant implementation). The rumor one is moot (the system was retired in `d05821c`); the other three are real but low-stakes, and are recorded in the archive's header rather than diluting this queue. Re-add them if they're still wanted.

## Narration removal

Directive 4 of the rework: the procedural narrative generator and everything authored for it are removed, and mission text stops being generated at all. Missions get their identity from the monster catalog instead (see [Mission generation from the bestiary](#mission-generation-from-the-bestiary)), so the five-slot title assembly and the grammar engine have no consumer left.

- **Deleted outright**: `functions/src/textGeneration.js` + its test, `functions/src/missionNaming.js` + its test, the whole `narrative-poc/` directory, `src/components/creator/TextGenerationManager.jsx`, `src/components/creator/NarrativeSubjectList.jsx`, and the `narrativeSubject` / `verbPhrase` schema files in both `shared/schema/` and `functions/src/schema/`. Deleting a retired collection's schema file follows the precedent set when `worldData/quests/items` was retired.
- **Moved, not deleted**: `docs/ISSUE-01-GRAMMAR-ENGINE.md`, `docs/NARRATIVE-GENERATION.md`, `docs/TEST-SCENARIO-NARRATIVE.md` go to `docs/retired/` so the design record survives.
- **`functions/src/missionResolution.js`** loses its narration half (`buildNarrativeContext`, `narrateQuestSuccess`, `narrateQuestFailure`, `preferQuestPhrasesPerSlot`, `pickNarratedEvolution`, and `resolveQuestOutcome`'s `narrate` / `defaultSuccessText` / `defaultSuccessClause` / `defaultFailureText` / `defaultFailureClause` parameters). The file is replaced wholesale by [Resolution engine rebuild](#resolution-engine-rebuild) anyway, so here it is enough to stop calling the generator and let `narrativeText` be `""` everywhere.
- **Loot provenance is dropped.** `drawQuestLoot` / `drawMissionLoot` currently embed `` `${description} [Obtenue lorsque ${accomplishmentMessage}]` `` into every drawn item; with no generator there is no clause to embed, so the item keeps its catalog description. `instances/{id}.description` stays a field — existing documents keep their sentences, it is just written unmodified from now on.
- **Front end**: `src/components/actions/ActionOutcome.jsx` drops `<p>{lastAction.narrativeText}</p>`. `src/pages/CreatorDashboard.jsx` loses the `Narration` group; its `Tag` tab is *not* narration-specific (tags drive talent matching and loot everywhere) and moves into a new `Système` group.
- **Schema audit**: `shared/schema/adventureZone.ts`, `talent.ts` and `tag.ts` each carry one `narrativeSubjects` reference in a `.describe()` string or a link field. Per `CLAUDE.md` a dead *field* is documented as legacy rather than deleted, but a stale sentence inside a `.describe()` is simply corrected. `shared/schema/character.ts` needs nothing — `lastAction` is `z.unknown()`.
- **`functions/scripts/migrateTagsToTagIds.js`** references the retired collections. Leave the historical script untouched (it has already run) and note the retirement in a header comment.
- **New script** `functions/scripts/dropNarrativeCollections.js` deletes `worldData/narrativeSubjects/items` and `worldData/verbPhrases/items`, following the `seedWorldData.js` / `migrateTagsToTagIds.js` convention: generated, reviewed and run by hand, never invoked from app code.

Tests deleted with the code: `textGeneration.test.js`, `missionNaming.test.js`.

**Mission naming, in the interim.** `missionNaming.js` is deleted here because its five-slot assembly mirrors the grammar engine's, but its consumer outlives it: `recherche.js` still draws missions from the subject/action catalogs until [Mission generation from the bestiary](#mission-generation-from-the-bestiary) rewrites it, and deleting the assembly outright would leave every generated mission unnamed for the whole of waves 1-2. So `assembleMissionName` moves into `recherche.js` as a local helper, marked interim, and goes away with the rest of that draw path when the bestiary generation lands.

Status: **implemented**. Generator, catalogs, schemas, creator page and `narrative-poc/` are gone; `missionResolution.js` and `missionLoot.js` no longer narrate or embed loot provenance; `resolveQuestOutcome` lost `narrativeSubjects` / `verbPhrases` / `narrate` / the four `default*Text`/`Clause` parameters and returns `narrativeText: ""`; the creator dashboard's `Narration` group is now `Système`, holding the `Tag` tab. `narrativeText` is deliberately kept as an always-`""` field on `lastAction`/`actionsLog` so pre-removal history stays readable — `CharactersOverview.jsx` still renders it when present. `dropNarrativeCollections.js` is written but, like every script in that directory, **still has to be run by hand** against Firestore. (Rework plan §3.)

## Area and Monster contracts

The Zod schemas the whole content layer reads, written before any page or handler consumes them, per `CLAUDE.md`: isomorphic shape in `shared/schema/`, a `functions/src/schema/` file re-exporting it with the collection-level header, `DEFAULTS` derived via `.pick(...).parse({})`.

**New: `shared/schema/area.ts`** → `worldData/areas/items/{areaId}`

```
name         string    French display name ("Marais de Ravenholm").
type         string    One of AREA_TYPES. The key mission generation matches on.
tagIds       string[]  worldData/tags/items — the area's own flavour tags.
lootTableIds string[]  worldData/lootTables/items — the harvest pool for jobs run here
                       (see Métier rework).
```

`AREA_TYPES` is a new shared constant in `shared/lib/areaTypes.ts`, mirroring the Python model's `AreaType` with its typo corrected: `ville | marais | grotte | plaine | montagne | desert | ruines_anciennes | volcan`. Stored keys are unaccented and snake_cased, matching every other stored enum in this repo; the French display labels live in the same file.

**New: `shared/schema/monster.ts`** → `worldData/monsters/items/{monsterId}`

```
name           string             French base name ("dragon", "dragon ancien").
difficulty     string             A DIFFICULTIES tier. NOT a gate on generation — it raises the
                                  loot rarity ceiling (see Monster-pool loot).
areaType       string|null        One of AREA_TYPES. Null = inherited from the parent chain.
parentId       string|null        worldData/monsters/items — prototypal inheritance.
tagIds         string[]           Talent-matching tags. CONCATENATED with the parent chain's.
lootItemIds    string[]           worldData/objects/items — the concrete loot pool. CONCATENATED
                                  with the parent chain's. Replaces loot-table selection for
                                  missions; lootTables survive for harvest only.
talentRewardId string|null        worldData/talents/items — granted at quality 1 on a successful
                                  hunt if not already owned. First non-null wins along the chain.
trigger        {conditions}|null  Moved verbatim from missionSubject.trigger.
```

**Edited contracts:**

- `shared/schema/region.ts` gains `areaId: string | null` — the `worldData/areas/items` entry this region sits in. `climateIds` / `reliefIds` stay (display, and origin matching); they simply stop driving mission generation.
- `shared/schema/character.ts`: `reputation: number` becomes **legacy** (documented, not deleted), superseded by `reputations: z.record(z.string(), z.number()).default({})`, keyed by region id. `missionJournal[]`'s `subjectId` / `actionId` become legacy, replaced by `targetMonsterId: string` — `name`, `difficulty`, `tagIds`, `locationId`, `regionId`, `generatedAt` are unchanged, except that `tagIds` is now the monster's resolved tag list rather than the tier ∪ variation union. `triggeredSubjectIds` becomes legacy, replaced by `triggeredMonsterIds: string[]` (same `arrayUnion` write, same notification pipeline).
- `shared/schema/questChain.ts`: `steps[].subjectId` → `steps[].monsterId`, plus chain-level rewards — `rewardItemIds: string[]`, `rewardTalentIds: string[]` (granted at quality 1), `rewardReputation: number`, `rewardRegionId: string|null` (null = wherever the character stands). See [Quest chains on monsters](#quest-chains-on-monsters).

**Retired schemas** (files deleted here, collections dropped by [Content migration scripts](#content-migration-scripts)): `missionSubject.ts`, `missionAction.ts`.

Stored enum *values* do not change anywhere in this rework. The Python model renames three difficulty labels (`moyen → normal`, `epique → extrême`, `mythique → impossible`); only the French labels in `src/lib/difficulties.js` change, the stored keys stay, which avoids a migration across `missionJournal[].difficulty`, `questChain.steps[].difficulty`, `monster.difficulty` and every `difficulty-text-{value}` CSS class. The 8-tier `RARITY_ORDER` also stays in full, even though the Python model drops `divin` and `unique` — nothing in the mission pipeline could ever reach them anyway, and dropping them would invalidate authored objects and `salePrice`'s two top rows for no mechanical gain.

Status: **implemented**. `shared/lib/areaTypes.ts` holds `AREA_TYPES` (the eight keys above, with
French labels and an `areaTypeLabel` helper); `shared/schema/area.ts` and `shared/schema/monster.ts`
are the new contracts, each re-exported by a `functions/src/schema/` file carrying the
collection-level header. `region.ts` gained `areaId` (and its `climateIds`/`reliefIds` descriptions
now say display/origin-matching only); `character.ts` gained `reputations` and
`triggeredMonsterIds`, with `reputation` / `triggeredSubjectIds` / `missionJournal[].subjectId` /
`missionJournal[].actionId` documented as legacy (the last two now `.optional()`, with the required
`targetMonsterId` alongside); `questChain.ts` moved `steps[]` to `monsterId` and gained the four
chain-level reward fields. `missionSubject.ts` and `missionAction.ts` are deleted on both sides.

Two deliberate interim states this leaves behind, both closed by later rows:

- **The live code reads shapes these contracts no longer describe.** `recherche.js` still draws from
  `worldData/missionSubjects/items`, the trigger sweep still writes `triggeredSubjectIds`, and
  `questChains.js` still reads `steps[].subjectId` — all until rows 5-8 and 12. `questTriggers.js`
  and `questChains.js` carry an `INTERIM` header note saying so, since their schema files now
  describe the target shape rather than the current one. The two retired collections are therefore
  live but undocumented between here and row 5; the archived entries in
  [docs/archives/TODO-2026-08-24-pre-python-rework.md](archives/TODO-2026-08-24-pre-python-rework.md)
  and the deleted files' git history are the reference in the meantime.
- **`character.reputation` stays required and is still written once** by `createCharacter`, because
  nothing reads `reputations` yet. New characters get `reputations: {}` from `DEFAULTS`; seeding it
  from the origin's `reputationStart` is [Per-region reputation](#per-region-reputation)'s job.

(Rework plan §3.4, §6.)

## Monster creator page

Directive 2 of the rework: monsters get a CRUD editing page on the creator side. `src/components/creator/MonstersManager.jsx`, modelled directly on `MissionSubjectsManager.jsx` — same `onSnapshot` list + `details`/`summary` form panel + `MultiSelectModalField` shape, same class names (`creator-section`, `creator-list`, `collapsible-group`, `condition-row`), no new styling (directive 3).

| Control | Field | Widget |
|---|---|---|
| Nom | `name` | text, required |
| Difficulté | `difficulty` | `<select>` over `DIFFICULTIES` |
| Type de zone | `areaType` | `<select>` over `AREA_TYPES`, with an "hériter du parent" empty option |
| Parent | `parentId` | `SoloSelectModalField` over monsters, **excluding self and every descendant** (client-side cycle prevention) |
| Tags | `tagIds` | `MultiSelectModalField` over tags, `matchesTag` filter, `createLink` to the Tag section |
| Butin | `lootItemIds` | `MultiSelectModalField` over objects, `createLink` to the Objets section |
| Talent enseigné | `talentRewardId` | `SoloSelectModalField` over talents, nullable |

Plus one thing no existing manager has and this one needs: a **read-only "hérité du parent" panel** showing the resolved tags, loot and talent reward contributed by the parent chain, so an author can see what a monster actually carries without opening its ancestors. It duplicates `resolveMonster`'s logic client-side — the project already accepts client/server twins for `actionConditions`, `actionKinds`, `loot`, `salePrice` and `trainingCost`, because `functions/` (CommonJS) shares no build with the Vite app.

`CreatorDashboard.jsx`: the `Missions` group's two tabs (`Actions de mission`, `Sujets de mission`) are replaced by a single `Monstres` tab. **Run the migration script before deleting those tabs, not after** — anyone mid-authoring in them loses their working set otherwise.

Status: **implemented**. `src/components/creator/MonstersManager.jsx` is the page, with every control in the table above; `src/lib/monsters.js` holds the client-side resolution (`monsterChain`, `resolveMonster`, `resolveInheritedFrom`, `selfAndDescendantIds`, a cycle guard and a depth cap of 8) that feeds the read-only "Hérité du parent" panel — the server twin `functions/src/lib/monsters.js` lands with [Mission generation from the bestiary](#mission-generation-from-the-bestiary), keep the two in step. `SoloSelectModalField` gained an optional `onClear` prop, since a radio list alone can never return a nullable field (`parentId`, `talentRewardId`) to "nothing selected". A blank form is seeded from `shared/schema/monster.ts`'s `DEFAULTS`, so the contract stays the single source of the field set.

Two deliberate deviations from the paragraph above:

- **The `Monstres` tab is added next to the two mission tabs, not in place of them.** Deleting them is the migration's job per this entry's own warning, and [Content migration scripts](#content-migration-scripts) hasn't run — `CreatorDashboard.jsx` carries a comment saying so. That row deletes both tabs and both managers.
- **`trigger` has no control**, exactly as it had none on `MissionSubjectsManager` (it is authored by script). The form round-trips whatever the document holds, so editing a migrated monster never drops its trigger.

(Rework plan §4.3.)

## Area creator page and region.areaId

`src/components/creator/AreasManager.jsx`, a small manager on the same pattern as the [Monster creator page](#monster-creator-page): name, a `type` select over `AREA_TYPES`, tags, and harvest loot tables. It joins the `Carte` group in `CreatorDashboard.jsx` as a `Zones` tab, and `RegionsManager.jsx` gains an `Area` selector writing `region.areaId`.

Areas exist because mission generation matches monsters on an area *type*, and because the Métier rework wants a per-area harvest pool. **Reduced-scope fallback if the catalog proves not worth its own collection**: put `areaType` directly on `Region` and drop the `areas` collection. That costs the shared area tags and the per-area harvest pool, so the full version is the recommendation — but the fallback is a one-field change and nothing else in this roadmap is affected by it.

Not implemented yet. (Rework plan §4.3.)

## Content migration scripts

The scripts that carry existing content onto the new contracts. All live in `functions/scripts/`, generated for review and run by hand, following the `seedWorldData.js` / `migrateTagsToTagIds.js` convention — never invoked from app code.

| Script | Does |
|---|---|
| `seedAreasFromRegions.js` | Creates one `areas` document per distinct region climate/relief combination and sets `region.areaId` |
| `migrateSubjectsToMonsters.js` | Best-effort: one `monsters` document per `missionSubject`, carrying `name`, `tagIds` (union across tiers and variations) and `trigger`. `areaType` and `lootItemIds` have no source in the old data and need hand-authoring afterwards — the script *flags* them in its output rather than guessing |
| `migrateReputationToPerRegion.js` | `reputation` → `reputations[character.region.id]`, leaving the scalar in place as legacy |
| `migrateTriggeredSubjectsToMonsters.js` | `triggeredSubjectIds` → `triggeredMonsterIds`, using the id map `migrateSubjectsToMonsters.js` writes |

Retired collections, dropped once the above have run: `worldData/missionSubjects/items`, `worldData/missionActions/items`. (`worldData/narrativeSubjects/items` and `worldData/verbPhrases/items` are dropped earlier, by [Narration removal](#narration-removal).)

`questChains` documents are **re-authored by hand** (`subjectId` → `monsterId`) rather than migrated — the same call the previous migration made when chains authored against `quests` were left stale.

**Content re-authoring is the real cost of this wave, not the code.** Until a monster has loot its missions pay nothing; until it has an `areaType` it is never drawn; a region whose area type no monster covers generates an empty journal. Budget an authoring pass before [Mission generation from the bestiary](#mission-generation-from-the-bestiary) ships, and consider a creator-side warning listing area types with no monsters and monsters with no loot.

Not implemented yet. (Rework plan §6.)

## Resolution engine rebuild

One file, `functions/src/lib/missionResolution.js`, **replaces** `functions/src/lib/questResolution.js` (145 lines) and the non-narration half of `functions/src/missionResolution.js` (270 lines). The wrapper layer that added nothing but renames disappears with it, and the "quest"/"objective" vocabulary goes with it — one name, *mission*, everywhere. Pure math, no Firestore, unit-testable against a seeded `Math.random`, which is the property `questResolution.js` already has and keeps.

```js
// Indexed by DIFFICULTY_ORDER position 0..5.
const SUCCESS_THRESHOLD = [10, 40, 70, 90, 95, 100];

const INJURY_THRESHOLDS = [
  { light: 5,  severe: 1,  permanent: 0  },
  { light: 10, severe: 5,  permanent: 1  },
  { light: 30, severe: 10, permanent: 5  },
  { light: 70, severe: 30, permanent: 10 },
  { light: 90, severe: 70, permanent: 30 },
  { light: 99, severe: 90, permanent: 70 },
];

// 25 / 45 / 20 / 6 / 3 / 1 percent — the Python model's DIFFICULTIES_WEIGHTS.
const DIFFICULTY_WEIGHTS = [25, 45, 20, 6, 3, 1];
```

- **`checkAgainstTalents(characterTalents, tagIds, difficultyIndex)`** → `{ relevantSum, perfectCount }`. A talent is relevant if it shares a tag with `tagIds` **and** `quality >= difficultyIndex` — a usefulness gate with no current web equivalent. `relevantSum` is the sum of those talents' qualities; `perfectCount` counts `quality === 5`.
- **`updateDifficulty(difficultyIndex, perfectCount)`** — while `perfectLeft > difficultyIndex && next >= 1`, spend the **original** difficulty per step and drop one tier. Consequence to keep and to test: a *single* level-5 talent never drops a tier, at any difficulty.
- **`injuryFromRoll(roll, effectiveDifficultyIndex)`** → `{ light, severe, permanent }`, exclusive bands, at most one flag set, permanent compared with **`<=`** — `permanent = roll <= t.permanent`, then `severe = !permanent && roll <= t.severe`, then `light`. The `<` in the source model is a bug: it leaves one roll per difficulty producing no wound at all (at difficulty 5 it is the *only* unwounded roll), so this shifts permanent-wound probability up by one point at every tier versus the diff's table — that table measures the bug, not the rule.
- **`resolveMission({ character, tagIds, difficulty })`** → `{ roll, relevantSum, updatedRoll, difficultyIndex, effectiveDifficultyIndex, threshold, success, injury, wound }`. `roll` is `0..99` (a domain change from the web's `1..100`), `updatedRoll = roll + relevantSum`, `success = updatedRoll >= threshold`, and `wound` is the injury triple collapsed to `"light" | "severe" | "permanent" | null`.

**Deleted with the old engine**: `SUCCESS_TABLE`, `WOUND_TABLE`, `WOUND_FLOORS`, `REPUTATION_REWARDS` (the 1→300 random scale), `computeSuccessThreshold`, `computeWoundThresholds`, `dropDifficultyTier`, `determineWoundSeverity`, `rollReputationReward`, `talentTagAdjustmentAllowed`. That last one is worth calling out: the objective-level strict condition gate has no counterpart in the new model — a monster's tags always count.

**Two rules are encoded explicitly rather than left as accidents of the tables**: `mythique` is unwinnable without talents (threshold 100, roll caps at 99) — a named constant and a test, not an emergent property; and a successful mission mathematically never wounds, because every light band sits strictly below its success threshold. `resolveMission` still returns the injury unconditionally, so it stays robust if the two tables are ever retuned apart, but a test asserts the property holds for the current tables.

**Wound application is unchanged.** `functions/src/lib/wounds.js` is not touched: its escalation ladder already matches the Python `Health` model (3 light → severe, 3 severe → permanent), and the web's death edge stays (3 permanent wounds survivable, the next severe/permanent kills, `alive: false` stored). The injury triple collapses to the existing severity string at the engine boundary, so the character document keeps its three flat counters — `notWounded` reads them directly, and nesting them under a `health` map is not free. `wounds.test.js` surviving untouched is the check that the ladder really did port unchanged.

**Injury frequency is the headline balance risk.** Weighted by the new difficulty distribution, a random mission carries roughly a 20 % chance of some wound and ~4 % of a permanent one, against the web's ~3 % / near-zero. With no healing path the ladder fills about six times faster than today — which is why [Healing and wound recovery](#healing-and-wound-recovery) is a named roadmap row and not a someday note. If the gap between the two is long, cap `permanent` or slow the bands as a stopgap; don't ship the combination unexamined.

**New test coverage this row owes**: the threshold/tier-drop pair including "one level-5 talent never drops a tier"; injury bands mutually exclusive and `roll === permanentThreshold` *does* wound; success never wounds for the current tables; `mythique` unwinnable at zero talents and winnable at one point of bonus. Deleted with the old code: `questResolution.test.js`. Rewritten: `missionResolution.test.js`.

Not implemented yet. (Rework plan §4.1.)

## ActionResult and the single applier

The rework's clearest structural win: eight handlers each building their own ad-hoc `updates` object become one closed effect vocabulary and one applier. New file `functions/src/lib/actionResult.js`.

```js
createActionResult({
  itemsGained = [],           // object ids — become `instances` at commit(), not at resolve()
  itemsLost = [],
  talentsGained = [],         // talent ids, granted at quality 1
  talentTrained = [],         // owned talent ids, +1 quality via bumpTalentQuality
  reputationGained = 0,       // signed
  reputationRegionId = null,  // null = the character's current region
  newRegionId = null,
  injury = null,              // { light, severe, permanent }
})

applyActionResult(character, result, { today, circumstance })
  → { updates, died }
```

Deliberate deviations from the Python model's nine fields:

- **`idleTime` is not ported.** Duration stays authored on the action type and stamped by `stampLifecycle` before the handler runs. The Python model relocates the clock into the outcome because it has no lifecycle envelope; the web has one, and nothing consumes `idleTime` on either side.
- **`talentsLost` is not ported.** Nothing on the web can take a talent away and nothing in the source model fills the field.
- **`reputationRegionId` is added.** The source `ActionResult` cannot name a region, which is why a quest spanning several regions credits wherever the character happens to stand.
- **`itemsGained` is deferred, not applied.** `applyActionResult` writes it to `lastAction.loot`; the existing per-handler `commit()` turns it into `instances` once the player acknowledges. The acknowledgement step is the web's anti-duplication guarantee and is not negotiable.

`applyActionResult` reads `injury` and routes it through `applyWound` — closing the harm chain the source model leaves broken at exactly this link.

The eight handlers (`mission`, `recherche`, `partirExplorer`, `recolte`, `artisanat`, `sEntrainer`, `apprentissage`, `faireDuCommerce`) each stop hand-rolling `updates` and return an `ActionResult` instead; `functions/src/lib/actionEffects.js` gains the merge into the lifecycle envelope. Everything else about the pipeline is explicitly **out of scope** and stays as it is: the Interval lock, `prepare`/`resolve`/`commit`, the transaction boundary, the `actionsLog` dual write, and server-authoritative rolls. `ActionResult` arrives as a *return value contract*, not as a replacement for the pipeline.

`partirExplorer` is kept and rewired in this pass: each round draws a monster from the current region's area instead of synthesising an objective, and resolves through `resolveMission`. It is the only action where wounds accumulate *within* one action, so it is the most exposed to the engine's injury-frequency rise — [Healing and wound recovery](#healing-and-wound-recovery) should be balanced against this handler specifically. Its `fatigue` keeps accumulating and keeps being unread; documented, not fixed here.

**Test**: every field applied exactly once, `injury` reaches `applyWound`, `reputationRegionId` respected.

Not implemented yet. (Rework plan §4.5, §4.10.)

## Mission generation from the bestiary

`functions/src/actions/recherche.js` is rewritten to draw missions from the monster catalog instead of the subject/action catalogs. Per draw:

```
difficulty = weightedDraw(DIFFICULTY_WEIGHTS)                // 25/45/20/6/3/1
candidates = monsters where resolvedAreaType === region.area.type
target     = pickRandom(candidates)                          // empty pool → skip this draw
name       = `Chasse ${target.name}`
tagIds     = resolveMonster(target).tagIds                   // parent chain concatenated
```

- **An empty candidate pool is a content gap: skipped, never fatal** — the convention `drawQuestLoot` already set, and the fix for the source model's `IndexError` on the area types no monster covers.
- **Region-locking is kept**: the journal entry keeps `regionId` and `mission.js` keeps its check. The source model lost the ability by deleting a parameter, which is a regression, not a design change.
- **`locationId` is kept**, still drawn from `region.adventureZoneIds`.
- **The forced chain slot is kept**, now keyed on `monsterId` instead of `subjectId`.
- `missionRollCount` stays where it is today.
- **Difficulty and target are drawn independently.** `monster.difficulty` does not gate which monsters can be drawn at which difficulty; it is used only as a floor on the loot rarity ceiling (see [Monster-pool loot](#monster-pool-loot)), which stops it being a dead field without constraining generation.

**Naming.** The source model's title is `[{difficulty} Chasse {monster.name}]`; the bracket-and-difficulty form is a debug placeholder and reads badly in the new pop-up line (`Succès : [Facile Chasse dragon]`). The name is **`Chasse {monster.name}`** — difficulty is already carried as its own field and already rendered with the `difficulty-text-*` accent class in both the journal and the pop-up. Richer names come back through the catalog itself: `parentId` makes "dragon ancien" a child of "dragon" inheriting its tags and loot, which is where the retired five-slot assembly's expressiveness relocates. No French article contraction is attempted ("Chasse dragon", not "Chasse au dragon").

**New: `functions/src/lib/monsters.js`** — `resolveMonster(monster, byId)` walks `parentId` and returns `{ tagIds, lootItemIds, areaType, difficulty, talentRewardId, chain }`. `tagIds` and `lootItemIds` concatenate down the chain (deduplicated); `areaType`, `difficulty` and `talentRewardId` take the first non-null, child first. Cycle guard, depth cap 8. Inheritance is resolved **at read time in the Cloud Function**, not flattened at write time — flattening would force the creator to re-flatten every descendant on each parent edit. Called at `prepare()` time from `recherche.js` and `mission.js`, both of which already fetch whole catalogs.

**Test**: concatenation down the chain, first-non-null scalars, cycle guard, depth cap. Rewritten test files: `recherche.test.js`, `mission.test.js`.

Not implemented yet. (Rework plan §4.2.)

## Monster-pool loot

`functions/src/missionLoot.js` is rewritten to draw from the target monster's own pool rather than by matching loot tables:

```
count      = success ? 3 : 1                                   // the outcome moves the count
rarityMax  = max(difficultyIndex, monsterDifficultyIndex)      // the rarity ceiling
pool       = resolvedLootItemIds → objects, filtered rarity <= rarityMax
if pool is empty → fall back to the unfiltered resolved pool   // content gap, never fatal
if still empty  → return []
draw `count` items uniformly, with replacement
```

Deliberate consequences:

- **`worldData/lootTables/items` loses its mission consumer.** It survives for harvest, so `TablesDeTirageManager.jsx`, the schema and the collection all stay — but `weightMode` / `itemWeights` no longer apply to missions, whose draws are now uniform. If the [Métier rework](#métier-rework) also moves harvest onto area pools, that whole collection goes dead at once; worth deciding then rather than discovering it.
- **Rarity is a ceiling, not an exact match.** A `mythique` mission against a common-loot monster still draws commons. The old exact match guaranteed the tier; the ceiling only permits it.
- **Failure pays undegraded loot at a smaller count**, where the web previously degraded rarity on a full-size haul. `rarityOffset` is removed rather than left dangling — keeping both levers would be coherent, but this takes one model's, not half of each.
- **Ownership stays per-`instance`.** The source model's `Dict[Item, int]` quantity map is not ported: `faireDuCommerce` sells *an instance*, and `condition` / `acquisitionDate` have nowhere to live in a quantity map. `character.inventory` stays reserved and unused.
- `functions/src/lib/loot.js`'s `LOOT_COUNT_BY_DIFFICULTY` (1/1/2/2/3/3) is deleted — count follows the outcome now, not the difficulty.

**Test** (`missionLoot.test.js`, rewritten): count follows outcome, the rarity ceiling applies, an empty pool degrades to unfiltered and then to `[]`, and nothing ever throws.

Not implemented yet. (Rework plan §4.4.)

## Per-region reputation

`character.reputation: number` becomes `character.reputations: { [regionId]: number }`. Reputation stops being a career score and becomes a relationship with a place.

- **Rewards**: success gives `1 + difficultyIndex`; failure gives `-(4 - difficultyIndex)`, unclamped — so `épique` costs nothing and `mythique` pays +1 even on a failure.
- **Credited to** `result.reputationRegionId ?? character.region.id`.
- **Seeding**: `createCharacter` writes `{ [regionId]: origin.reputationStart }`. Arriving in an unvisited region seeds that entry at `1`, and gaining reputation against a named region defaults a missing entry to `0` rather than raising.
- **The `minReputation` condition** (`functions/src/lib/actionConditions.js` and its `src/lib/` twin) reads the *current region's* entry. Say so in the predicate's documentation, since the meaning of "reputation" changes under it.
- **Migration**: `migrateReputationToPerRegion.js` (see [Content migration scripts](#content-migration-scripts)) writes `{ [character.region.id]: character.reputation }` and leaves the scalar in place as legacy.
- **Front end**: `CharacterBanner.jsx` shows the current region's score; the character sheet gains a small per-region list. No new styling — reuse `.instance-list` / `.quest-info`.

**The zero-sum invariant, stated and tested.** The success and failure formulas were chosen independently and happen to net to +0.0125 per mission across the generation weights for a talentless character. Nothing in the code says so today, so it wouldn't survive either formula being retuned. Two tests encode it:

1. The generation-weighted expectation for a talentless character stays within ±0.05 of zero.
2. The same expectation for a character holding one tag-matching level-5 talent is **strictly positive at every tier**, and rises with difficulty.

Test 2 is the answer to "nothing pushes a character up the ladder": the base curve is flat *by design*, and **talents are what make the higher tiers pay**. That makes the non-monotonic talentless curve a feature of the floor rather than a bug in the slope.

Not implemented yet. (Rework plan §4.6.)

## Talent training roll and monster talent reward

`functions/src/lib/talentEvolution.js` is rewritten. `evolutionChance` and `rollTalentEvolutions` are deleted — the rarity-curve unlock goes with them. `bumpTalentQuality` is **kept unchanged**: it already caps quality at 5 and re-applies `rarityFloor`, so talent rarity keeps rising with quality and the pop-up's rarity sort and `rarity-*` CSS classes keep working. `sEntrainer.js` already calls it and is unaffected.

Talent acquisition splits into two paths by role, replacing the three competing designs the analysis found:

**Training (successful missions only)** — levels a talent the character already owns:

```
if roll(2) !== 1 → nothing                                  // flat 50 %, once per resolution
candidates = owned talents sharing a tag with mission.tagIds
             && quality <= min(difficultyIndex + 1, 4)
if candidates is empty → nothing
pick exactly one uniformly → bumpTalentQuality
```

**Granting (successful missions only)** — `monster.talentRewardId`, resolved along the parent chain, granted at quality 1 if the character doesn't already own it. The source model declares this and never calls it; here it is wired.

`Talent.unlockChild` and the web's rarity-curve unlock are both dropped.

Two properties are worth testing because they are emergent rather than written down anywhere:

- The **training window** (`quality <= min(d+1, 4)`) and the **usefulness gate** (`quality >= d`, from the resolution engine) are written independently, and their intersection is the whole rule: 0-1 at facile, … , 4 only at épique, **and empty at mythique**. The top tier can teach nothing. Assert it, so it's a decision rather than an accident.
- The level-5 cap is enforced twice — in the candidate filter *and* in `bumpTalentQuality` — so a future second training path can't push a talent past 5, which would silently make the character *weaker*, since `perfectCount` tests `=== 5` exactly.

Deleted test file: `talentEvolution.test.js` (rewritten against the new paths).

Not implemented yet. (Rework plan §4.7.)

## Quest chains on monsters

`functions/src/lib/questChains.js` keys on `monsterId` instead of `subjectId`, and `character.triggeredSubjectIds` becomes `triggeredMonsterIds`. `questChainProgress` is unchanged: it stays an id-keyed map, because Firestore needs an id key.

- **New: completing the last step fires the chain's rewards** through an `ActionResult` — `rewardItemIds`, `rewardTalentIds`, `rewardReputation` and `rewardRegionId`. The web has no counterpart for this today; `rewardRegionId` is what stops a chain spanning several regions from crediting whichever one the character happens to be standing in.
- `ActionResultDialog.jsx`'s page 2 fetches `worldData/monsters/items` instead of `missionSubjects`, and its localStorage key becomes `shownTriggeredMonsters:{characterId}`.
- The scheduled sweep (`sweepQuestTriggers`, `functions/src/lib/questTriggers.js`) is kept and reads `monster.trigger` — triggers moved from `missionSubject.trigger` to `monster.trigger` with the contracts.
- Chain documents are re-authored by hand rather than migrated (see [Content migration scripts](#content-migration-scripts)).

Rewritten tests: `questChains.test.js`, `questTriggers.test.js`.

Not implemented yet. (Rework plan §4.9.)

## Travel action (Voyager)

A new handler `functions/src/actions/voyager.js` and a new action document under the `intermede` kind — so travel draws from the Intermède budget rather than burning the main Interval.

- Payload: `regionId`. Returns `createActionResult({ newRegionId })`.
- `applyActionResult` writes `character.region` and seeds `reputations[newRegionId] ??= 1`.
- **Any region is reachable** at this stage. Gating on the already-authored, currently-unread `region.neighbors` is [Region adjacency gating](#region-adjacency-gating); shipping it now would break travel wherever `neighbors` is unauthored.
- **Region-locked missions in the journal stay locked to where they were generated**, so travelling strands unclaimed missions. That is the intended trade-off, and it is what makes per-region reputation and area-keyed generation an actual choice.
- `ActionBrowser.jsx` needs a region picker for it, modelled on `CommercePicker.jsx` / `ProfessionPicker.jsx`.

**Playtest risk worth naming**: travel is an Intermède action, so a character can travel *and* still act — but a region-locked journal is worthless after a move until the next "Se renseigner", which *is* a main-Interval action. Playtest that exact sequence. It may want travel to refresh the journal, which would be a deviation from both models and should be a deliberate one, not a patch.

Not implemented yet. (Rework plan §4.8.)

## Result pop-up rework

Directive 5 of the rework, plus the outcome-display changes the new effect vocabulary forces.

`src/components/actions/results/DefaultResult.jsx` — when `lastAction.mission` is present, the outcome line becomes:

```jsx
<p className={`outcome ${outcomeClass}`.trim()}>
  {lastAction.success ? "Succès" : "Échec"} : {lastAction.mission.name}
</p>
```

Non-mission actions keep the bare `Succès` / `Échec`. `ActionOutcome.jsx` drops its separate `Mission : {name}` line, which would otherwise repeat the name two lines down; the location, if any, moves onto the `Résolution` fieldset.

**One deviation flagged rather than silently taken**: the directive spells it `Echec`; every other string in this codebase spells it `Échec` (`ActionOutcome.jsx`, `DefaultResult.jsx`). This implements `Échec` for consistency — it's a one-character change if the unaccented form is actually wanted.

`ActionOutcome.jsx` also needs, in the same pass:

- reputation rendered **signed** (`+2` / `−3`), since failure now moves it — the current `reputationGained > 0` guard hides every loss;
- the region the reputation landed in, now that it is per-region;
- `Talent entraîné` alongside the existing `Amélioration de talent` list, since training and granting are now two distinct effects (the old `rollTalentEvolutions` returned both through one list).

Other front-end follow-ups in the same pass: `MissionPicker.jsx` reads `targetMonsterId` (the difficulty accent is unchanged), `CharacterBanner.jsx` / `CharacterTabs.jsx` show per-region reputation, and `src/lib/actionConditions.js`'s `minReputation` twin stays in step with the server copy.

**Styling is not touched** (directive 3): `src/index.css` is untouched, and every new or reworked component reuses the existing class vocabulary — `creator-section`, `creator-list`, `collapsible-group`, `condition-row`, `action-loot-box`, `instance-list`, `instance-card`, `quest-info`, `outcome`, `difficulty-text-{value}`, `rarity-{value}`. The `difficulty-text-*` and `rarity-*` classes are keyed on the *stored* enum values, which is one more reason those keys don't change.

Not implemented yet. (Rework plan §5.)

## Healing and wound recovery

**Spec row — needs a design pass, not code.** The [Resolution engine rebuild](#resolution-engine-rebuild) raises injury frequency from roughly 3 % of missions to roughly 20 % (and permanent wounds from near-zero to ~4 %), against a wound ladder that has **no drain at all**: light wounds escalate to severe, severe to permanent, permanent accumulates until the fourth kills. Nothing anywhere removes a wound. At the new rates the ladder fills about six times faster than today, so a character's lifespan becomes a function of how long they play rather than how well.

Open questions this spec has to answer:

- What removes a wound — an action (rest, a healer NPC), time (wounds decay per Interval), gold, an item, or a combination?
- Does healing walk the ladder back down (severe → light) or clear a counter outright?
- Are permanent wounds actually permanent, or is "permanent" only permanent without expensive intervention?
- Where does it live in the action taxonomy — Intermède (cheap, parallel to acting) or main Interval (a real day spent not adventuring)?
- Balance target: what steady-state wound load should an average character carry? `partirExplorer` is the specific handler to balance against, since it is the only action where wounds accumulate *within* a single action.

If this row can't ship soon after the engine, apply a stopgap rather than shipping the combination unexamined: cap `permanent`, or slow the injury bands.

Not implemented yet. (Rework plan §4.1, §9.)

## Métier rework

The deferred economy and job calls, gathered into one wave-3 row. None of this is broken today — `gold`, `salePrice`, `trainingCost` and `faireDuCommerce` all work and are untouched by the earlier waves — so this is about extending the Métier side onto the new engine, not repairing it.

- **Jobs**: harvest and craft actions run against the new area catalog. `area.lootTableIds` is the per-area harvest pool the [Area creator page](#area-creator-page-and-regionareaid) authors, which is otherwise written and unread.
- **Proficiency as a rarity ceiling**: harvest yields cap at a rarity determined by the character's proficiency, mirroring how mission loot now caps at a difficulty-derived ceiling.
- **Per-trainer ceilings**: which ceiling wins when a trainer's cap and the talent system's cap disagree. Deferred here deliberately — the talent cap is enforced twice already (candidate filter and `bumpTalentQuality`), so this row can only tighten, never reopen, the level-5 hole.
- **Gold economy and training cost** revisited once the above are in place.

Note for when this lands: if harvest also moves onto area pools, `worldData/lootTables/items` loses its last consumer — the collection, its schema, `TablesDeTirageManager.jsx` and `weightMode`/`itemWeights` all go dead at once. Decide that here rather than discovering it later.

Not implemented yet. (Rework plan §1.3 decisions 1 and 15, §4.4.)

## Merchants and the buy side of the economy

**Spec row — needs a design pass, not code.** The web has a sell side (`faireDuCommerce` sells an instance at `salePrice`) and no buy side. The Python model has a `Merchant` class, but it is entirely unwired — `buy` raises and `buildInventory` is a TODO — so there is nothing to port, only to design. That is why this is a spec row and why it sits behind the [Métier rework](#métier-rework), which settles the gold economy it would spend.

Questions to answer: what stocks a merchant (a fixed catalog, a per-area pool, drawn from the `lootTables` harvest survives on?), whether stock is per-region and persistent or regenerated, how buy prices relate to `salePrice`, whether merchants gate on reputation (now per-region — a natural fit), and where buying sits in the action taxonomy.

Ownership constraint carried over from [Monster-pool loot](#monster-pool-loot): purchases create `instances`, not quantity-map entries. `character.inventory` stays reserved and unused.

Not implemented yet. (Rework plan §1.3 decision 1.)

## Region adjacency gating

`region.neighbors` is authored today and read by nothing. This row makes it real: [Travel action (Voyager)](#travel-action-voyager) ships with any region reachable from anywhere, and this restricts it to adjacent regions.

- Gate the region picker in `ActionBrowser.jsx` and re-check server-side in `voyager.js` — the picker is a convenience, the handler is the authority.
- **Blocked on content, not code**: shipping this while any region has an unauthored or asymmetric `neighbors` list strands characters. Audit the full region graph first — every region reachable, no one-way edges unless one-way edges are intended.
- Decide at that point whether travel to a non-adjacent region becomes a multi-Interval trip or is simply impossible.

Not implemented yet. (Rework plan §4.8.)
