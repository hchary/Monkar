# Rework plan: porting the Python model onto the web project

Companion to [python-model-logic-diff.md](python-model-logic-diff.md) (the analysis). This is
**what to change in `functions/`, `shared/` and `src/` so the web project runs the Python model's
rules**, on the web project's existing architecture and existing look.

The diff document is analysis only and ends with 17 questions that "need a call". This plan makes
every one of those calls (§1.3), so the work below is buildable without a second design pass.

---

## 1. Scope

### 1.1 The five directives

| # | Directive | Where it lands |
|---|---|---|
| 1 | The Python logic between components is implemented | Waves 1–3 — the bulk of this plan |
| 2 | Monster gets a CRUD editing page on the creator side | Wave 1, §4.3 |
| 3 | The current web front style stays | §7 — no CSS rewrite, no component library, no restyle |
| 4 | Narration components are removed | Wave 0, §3 |
| 5 | Mission pop-up message is `Succès/Échec : {mission.name}` | Wave 2, §5.2 |

### 1.2 What this rework is *not*

The Python model is an in-process, synchronous, single-file-catalog skeleton. Three whole
categories of its differences from the web are artefacts of that, not design decisions, and are
**not** ported:

- **Persistence, authority and timing** (diff §13). The Interval lock, `prepare`/`resolve`/`commit`,
  the transaction boundary, the acknowledgement step that defers loot ownership, the `actionsLog`
  dual write, and server-authoritative rolls all stay exactly as they are. Python has none of them
  because it has no clock, no database and no adversary; the web has all three. `ActionResult`
  arrives as a *return value contract* (§4.5), not as a replacement for the pipeline.
- **The condition vocabulary** (diff §5). Python's `isVisible()` returning `False` by default is
  unfinished plumbing, not a rule. The eight authored predicates and the kind tree stay. Two of
  them need updating for per-region reputation (§4.6).
- **Catalogs as code.** `BESTIARY`, `MAP`, `AreaType`, `ItemCategory` are Python literals marked
  *[not yet]* in the diff, explicitly "will be translated to a firebase database". Here they are
  Firestore collections with creator pages, which is what the web already does well.

Everything else in the diff marked **[changed]** is in scope.

### 1.3 The 17 open calls, decided

The diff's §15 list, resolved. "Flip cost" is what it takes to change the decision later.

| # | Question (diff §15) | Decision | Flip cost |
|---|---|---|---|
| 1 | Gold economy, training cost, merchants | **Deferred to Wave 3.** `gold`, `salePrice`, `trainingCost` and `faireDuCommerce` already work on the web and are untouched by this rework; Python's `Merchant` is entirely unwired (`buy` raises, `buildInventory` is a TODO). Porting unwired code is speculative. | Low — additive |
| 2 | Intermède budget / Interval lock | **Kept as-is.** Web plumbing, out of scope per §1.2. | — |
| 3 | Action lifecycle, `completesAt`, deferred commit | **Kept as-is.** `ActionResult.idleTime` is *not* ported — duration stays authored on the action type. | Medium |
| 4 | Condition vocabulary, triggers, sweep, `notWounded` | **Kept.** Triggers move from `missionSubject.trigger` to `monster.trigger` (§4.3). | — |
| 5 | "Se renseigner" as an action | **Stays an action.** Python auto-fills the journal because it has no clock; the web does, and "spend today looking for work" is a real trade-off. | Low |
| 6 | `partirExplorer` | **Kept**, rewired onto the new resolution engine (§4.7). Deleting a shipped action is not in scope. | — |
| 7 | Character creation, origins, `age`, `title`, `legendLevel` | **Kept.** Python simply doesn't model creation. `origin.reputationStart` now seeds the starting region's entry (§4.6). | — |
| 8 | Adventure zones, region adjacency, NPC siting | **Adventure zones kept** (missions keep `locationId`). Adjacency stays authored-and-unread for now — travel is unrestricted in Wave 2, adjacency-gating is a Wave 3 follow-up (§4.8). | Low |
| 9 | **Which of three talent-acquisition designs wins** | **Two of three, split by role:** `monster.talentRewardId` grants a *new* talent on a successful hunt (deterministic — Python's unread `talent_reward`); the 50 % roll *levels* an owned one (Python's wired `levelUpTalent`). `Talent.unlockChild` and the web's rarity-curve unlock are both dropped. This is the split the diff itself points at. | Medium |
| 10 | Region-locking of missions | **Kept.** The web already enforces it via `mission.regionId`; Python lost the ability by deleting a parameter, which is a regression, not a design change. | — |
| 11 | Healing / death end-state | **Death rule: the web's** (3 permanent wounds survivable, the next severe/permanent kills; `alive: false` stored). **Healing: a named Wave 3 item**, because injury frequency rises ~6× (§4.4) and the ladder has no drain. | Low |
| 12 | Should difficulty still connect to reward | **Yes, through rarity.** Loot count follows the outcome (3 on success, 1 on failure — Python), and difficulty supplies a **rarity ceiling** on the monster's pool. `LootTable.loot` already takes `rarity_max`; the mission path just never passes it. | Low |
| 13 | Should the monster constrain the difficulty draw | **No.** Difficulty is drawn from the weighted bag, the target from the area filter, independently — Python's behaviour. `monster.difficulty` is authored and used **only** as the rarity ceiling's floor (§4.2), so it stops being a dead field without gating generation. | Low |
| 14 | Monster parent-inheritance under Firestore | **Resolved at read time**, in the Cloud Function, with a cycle guard and a depth cap of 8. Not flattened at write time: the creator would have to re-flatten every descendant on each parent edit. | Medium |
| 15 | Trainer gating and which ceiling wins | **Deferred to Wave 3** with #1. | — |
| 16 | Should the reputation curve be zero-sum | **Yes — and it becomes a stated invariant, not a coincidence.** Formulas are adopted verbatim (`+1 + d` on success, `-(4 - d)` on failure), and a unit test asserts the generation-weighted expectation for a talentless character stays within ±0.05 of zero. Climbing the ladder is rewarded *by talents*, not by the base curve — also asserted (§4.6). | Low |
| 17 | Where the talent ceiling lives | **On the applier.** `bumpTalentQuality` already caps quality at 5; the candidate filter keeps Python's `min(d + 1, 4)` window as well. Two independent guards, so a future second training path can't reopen the hole. | — |

### 1.4 Python defects that are fixed on the way in

Every rule is ported as the diff's *intended* rule, with §14's wiring defects corrected. The ones
that change behaviour rather than just stopping a crash:

- `Injury.fromRollAndDiff`'s permanent band uses `<=`, not `<`. Without this, one roll per difficulty
  produces no wound at all (at difficulty 5 it is the *only* unwounded roll). **This shifts the
  permanent-wound probability up by one point at every tier** versus the diff's §1b.2 table — the
  table there measures the bug, not the rule.
- `levelUpTalent` returns `[]` on an empty candidate list instead of raising.
- Loot draws from an empty pool return `[]` instead of raising (the web's existing "content gap is
  silently skipped, never fatal" convention).
- Mission difficulty generation never draws a target from an empty area pool (§4.2 falls back).
- `applyActionResult` reads `injury` — the middle link Python still leaves unconnected (diff §1b.4).
- `ActionResult` carries `reputationRegionId`, so a reward can name the region it was earned in
  instead of crediting wherever the character happens to be standing (diff §2, §8).

---

## 2. Wave plan

Three waves, each independently shippable. Wave boundaries are chosen so the game is playable at
the end of each.

| Wave | Theme | Ends with |
|---|---|---|
| **0** | Narration removal + contracts | Narration gone, all new schemas written, nothing else behaves differently |
| **1** | Content layer | Monster + Area catalogs live with creator pages, seeded from existing content |
| **2** | Rules layer | The new resolution engine, `ActionResult`, per-region reputation, talent training, travel, the new pop-up |
| **3** | Métier / economy / balance | Jobs, trainers, merchants, healing, adjacency, harvest proficiency-as-ceiling |

Waves 0 and 1 are prerequisites for 2. Wave 3 is independent of nothing but 2.

---

## 3. Wave 0 — Narration removal and contracts

### 3.1 Delete outright

| Path | Note |
|---|---|
| `functions/src/textGeneration.js` + `.test.js` | 241 + 377 lines, the grammar engine |
| `functions/src/missionNaming.js` + `.test.js` | Five-slot title assembly; replaced by §4.2 |
| `narrative-poc/` | Whole directory — the demo harness for the generator |
| `src/components/creator/TextGenerationManager.jsx` | 445 lines |
| `src/components/creator/NarrativeSubjectList.jsx` | |
| `shared/schema/narrativeSubject.ts`, `shared/schema/verbPhrase.ts` | |
| `functions/src/schema/narrativeSubject.ts`, `functions/src/schema/verbPhrase.ts` | |
| `docs/ISSUE-01-GRAMMAR-ENGINE.md`, `docs/NARRATIVE-GENERATION.md`, `docs/TEST-SCENARIO-NARRATIVE.md` | Move to a `docs/retired/` folder rather than deleting, so the design record survives |

Deleting a retired collection's schema file follows the precedent set when `worldData/quests/items`
was retired (there is no `quest.ts`, but `questChain.ts` survives).

### 3.2 Edit

- **`functions/src/missionResolution.js`** — the narration halves (`buildNarrativeContext`,
  `narrateQuestSuccess`, `narrateQuestFailure`, `preferQuestPhrasesPerSlot`, `pickNarratedEvolution`,
  and `resolveQuestOutcome`'s `narrate` / `defaultSuccessText` / `defaultSuccessClause` /
  `defaultFailureText` / `defaultFailureClause` parameters) go. The file is replaced wholesale in
  Wave 2 anyway (§4.1), so in Wave 0 it is enough to stop calling the generator and let
  `narrativeText` be `""` everywhere.
- **Loot provenance.** `drawQuestLoot` / `drawMissionLoot` embed
  `` `${description} [Obtenue lorsque ${accomplishmentMessage}]` `` in every drawn item. With the
  generator gone there is no clause to embed. **Decision: drop the provenance suffix entirely** —
  the item keeps its catalog description. Python's `Item` has a static description and no
  per-instance record to hang provenance on either. `instances/{id}.description` stays a field
  (existing documents keep their sentences), it is just written unmodified from now on.
- **`src/components/actions/ActionOutcome.jsx`** — remove `<p>{lastAction.narrativeText}</p>`.
- **`src/pages/CreatorDashboard.jsx`** — delete the `Narration` group. Its `Tag` tab is *not*
  narration-specific (tags drive talent matching and loot everywhere): move it into a new
  `Système` group alongside future system-level catalogs.
- **`shared/schema/adventureZone.ts`, `talent.ts`, `tag.ts`** — each carries one
  `narrativeSubjects` reference in a `.describe()` string or a link field. Audit all three; per
  `CLAUDE.md`, a dead *field* is documented as legacy rather than deleted, but a stale sentence
  inside a `.describe()` is just corrected.
- **`shared/schema/character.ts`** — no narration fields, nothing to do. `lastAction` is
  `z.unknown()`, so `narrativeText` going empty needs no schema change.
- **`functions/scripts/migrateTagsToTagIds.js`** — references the retired collections; leave the
  historical script untouched (it has already run) but note the retirement in a header comment.

### 3.3 New script

`functions/scripts/dropNarrativeCollections.js` — deletes `worldData/narrativeSubjects/items` and
`worldData/verbPhrases/items`, following the `seedWorldData.js` / `migrateTagsToTagIds.js`
convention (generated, reviewed and run by hand, never invoked from app code).

### 3.4 New contracts (written in Wave 0, consumed in Waves 1–2)

Per `CLAUDE.md`: Zod, `shared/schema/` for the isomorphic shape, `functions/src/schema/`
re-exporting it with the collection-level header, `DEFAULTS` derived via `.pick(...).parse({})`.

**`shared/schema/area.ts`** → `worldData/areas/items/{areaId}`

```
name        string     French display name ("Marais de Ravenholm").
type        string     One of AREA_TYPES (see below). The key mission generation matches on.
tagIds      string[]   worldData/tags/items — the area's own flavour tags.
lootTableIds string[]  worldData/lootTables/items — the harvest pool for jobs run here (Wave 3).
```

`AREA_TYPES`, a new shared constant in `shared/lib/areaTypes.ts`, mirroring Python's `AreaType`
with the typo corrected:
`ville | marais | grotte | plaine | montagne | desert | ruines_anciennes | volcan`
(stored keys unaccented and snake_cased, matching every other stored enum in this repo;
French labels live in the same file for display).

**`shared/schema/monster.ts`** → `worldData/monsters/items/{monsterId}`

```
name           string          French base name ("dragon", "dragon ancien").
difficulty     string          A DIFFICULTIES tier. NOT a gate on generation (decision #13) —
                               it raises the loot rarity ceiling (§4.2).
areaType       string|null     One of AREA_TYPES. Null = inherited from parent.
parentId       string|null     worldData/monsters/items — prototypal inheritance (diff §4b).
tagIds         string[]        Talent-matching tags. CONCATENATED with the parent chain's.
lootItemIds    string[]        worldData/objects/items — the concrete pool. CONCATENATED with
                               the parent chain's. Replaces loot-table selection for missions
                               (diff §11); lootTables survive for harvest only.
talentRewardId string|null     worldData/talents/items — granted at quality 1 on a successful
                               hunt if not already owned (decision #9). First non-null wins
                               along the parent chain.
trigger        {conditions}|null   Moved verbatim from missionSubject.trigger.
```

**`shared/schema/region.ts`** — add `areaId: string | null`, describing the `worldData/areas/items`
entry this region sits in. `climateIds` / `reliefIds` stay (display, and origin matching); they
simply stop driving mission generation.

**`shared/schema/character.ts`** — three changes:

- `reputation: number` → **legacy**, documented, not deleted (per `CLAUDE.md`); superseded by
  `reputations: z.record(z.string(), z.number()).default({})` — `{ [regionId]: score }`.
- `missionJournal[]` entries: `subjectId` / `actionId` → **legacy**, replaced by
  `targetMonsterId: string`. `name`, `difficulty`, `tagIds`, `locationId`, `regionId`,
  `generatedAt` are unchanged — `tagIds` is now the monster's resolved tag list rather than the
  tier ∪ variation union.
- `triggeredSubjectIds` → **legacy**, replaced by `triggeredMonsterIds: string[]`, same
  `arrayUnion` write and same notification pipeline.

**`shared/schema/questChain.ts`** — `steps[].subjectId` → `steps[].monsterId`, plus chain-level
rewards, matching Python's `Quest(itemRewards, talentReward, reputationReward)`:

```
steps            [{ monsterId, difficulty }]
rewardItemIds    string[]      worldData/objects/items, granted on completing the last step.
rewardTalentIds  string[]      worldData/talents/items, granted at quality 1.
rewardReputation number        Credited to the chain's own region — see reputationRegionId (§4.5).
rewardRegionId   string|null   Which region the reputation lands in; null = wherever the
                               character stands. Closes diff §8's "a quest spanning several
                               regions credits whichever one you happen to be in".
```

**Retired schemas** (files deleted, collections dropped in Wave 1): `missionSubject.ts`,
`missionAction.ts`.

---

## 4. Wave 1 + 2 — the port

### 4.1 The resolution engine

**Replaces** `functions/src/lib/questResolution.js` (145 lines) **and** the non-narration half of
`functions/src/missionResolution.js` (270 lines) with one file:
`functions/src/lib/missionResolution.js`. The wrapper layer that adds nothing but renames
disappears with it, and the "quest"/"objective" vocabulary goes with it —
one name, *mission*, everywhere.

Pure math, no Firestore, unit-testable against a seeded `Math.random` — the property
`questResolution.js` already has and keeps.

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

// 25 / 45 / 20 / 6 / 3 / 1 percent — Python's DIFFICULTIES_WEIGHTS.
const DIFFICULTY_WEIGHTS = [25, 45, 20, 6, 3, 1];
```

**`checkAgainstTalents(characterTalents, tagIds, difficultyIndex)`** →
`{ relevantSum, perfectCount }`

- relevant = talents sharing a tag with `tagIds` **and** `quality >= difficultyIndex`
  (diff §1.1 difference 3 — the gate with no web equivalent).
- `relevantSum` = Σ of those talents' `quality`. `perfectCount` = count of `quality === 5`.

**`updateDifficulty(difficultyIndex, perfectCount)`** — Python verbatim: while
`perfectLeft > difficultyIndex && next >= 1`, spend the **original** difficulty per step and drop
one tier. Consequence to keep and to test: a *single* level-5 talent never drops a tier at any
difficulty.

**`injuryFromRoll(roll, effectiveDifficultyIndex)`** → `{ light, severe, permanent }`, exclusive
bands, at most one flag set, `permanent` comparison **`<=`** (§1.4):

```
permanent = roll <= t.permanent
severe    = !permanent && roll <= t.severe
light     = !permanent && !severe && roll <= t.light
```

**`resolveMission({ character, tagIds, difficulty })`** →

```js
{
  roll,                  // 0..99  — note the domain change from the web's 1..100
  relevantSum,
  updatedRoll,           // roll + relevantSum
  difficultyIndex,
  effectiveDifficultyIndex,
  threshold,             // SUCCESS_THRESHOLD[effectiveDifficultyIndex]
  success,               // updatedRoll >= threshold
  injury,                // the triple
  wound,                 // "light" | "severe" | "permanent" | null — the triple, collapsed
}
```

**Deleted with the old engine:** `SUCCESS_TABLE`, `WOUND_TABLE`, `WOUND_FLOORS`,
`REPUTATION_REWARDS` (the 1→300 random scale), `computeSuccessThreshold`,
`computeWoundThresholds`, `dropDifficultyTier`, `determineWoundSeverity`, `rollReputationReward`,
`talentTagAdjustmentAllowed`. The last one is worth calling out: the objective-level strict
condition gate has no Python counterpart and no home in the new model — a monster's tags always
count.

**Two rules encoded explicitly rather than left as accidents of the tables** (diff §1.2, §1b.2):

- `mythique` is unwinnable without talents (`threshold 100`, roll caps at 99). A named constant and
  a test, not an emergent property.
- A successful mission mathematically never wounds, because every light band sits strictly below
  its success threshold. `resolveMission` still returns the injury unconditionally (robust if the
  two tables are ever retuned apart), but a test asserts the property holds for the current tables.

**Wound application** — `functions/src/lib/wounds.js` is **unchanged**. Its escalation ladder
already matches Python's `Health` (3 light → severe, 3 severe → permanent), and the web's death
edge (the 4th permanent kills, not the 3rd) is decision #11. The `Injury` triple is collapsed to
the existing severity string at the engine boundary, so the character document keeps its three
flat counters — `notWounded` reads them directly, and nesting them under a `health` map is not free
(diff §7).

**Injury frequency is the headline balance risk.** Weighted by the new difficulty distribution, a
random mission carries roughly a 20 % chance of some wound and ~4 % of a permanent one, against
the web's ~3 % / near-zero. With no healing path, the ladder fills about six times faster than
today. This is why healing is a named Wave 3 item and not a "someday" note.

### 4.2 Mission generation

**`functions/src/actions/recherche.js`** — rewritten. Per draw:

```
difficulty = weightedDraw(DIFFICULTY_WEIGHTS)                       // 25/45/20/6/3/1
candidates = monsters where resolvedAreaType === region.area.type
target     = pickRandom(candidates)                                 // [] → skip this draw
name       = `Chasse ${target.name}`
tagIds     = resolveMonster(target).tagIds                          // parent chain concatenated
```

- **Empty candidate pool is a content gap, skipped, not fatal** — the convention `drawQuestLoot`
  already set, and the fix for Python's `IndexError` on the 7 uncovered `AreaType`s.
- **Region-locking kept**: the journal entry keeps `regionId`, `mission.js` keeps its check.
- **`locationId` kept**: still drawn from `region.adventureZoneIds`.
- **The forced chain slot is kept**, now keyed on `monsterId` instead of `subjectId`.
- `missionRollCount` stays where it is today.

**Naming.** Python's title is `[{difficulty} Chasse {monster.name}]`. The bracket-and-difficulty
form is a debug placeholder, and it reads badly in the new pop-up line
(`Succès : [Facile Chasse dragon]`). **Decision: `Chasse {monster.name}`** — difficulty is already
carried as its own field and already rendered with the `difficulty-text-*` accent class in both
the journal and the pop-up, so repeating it in the title is redundant. Richer names come back
through the monster catalog itself: `parentId` makes "dragon ancien" a child of "dragon" that
inherits its tags and loot, which is where the retired five-slot assembly's expressiveness
relocates.

No French article contraction is attempted ("Chasse dragon", not "Chasse au dragon") — that logic
lived in the deleted generator, and Python doesn't attempt it either.

**Monster inheritance resolution** — new `functions/src/lib/monsters.js`:

```js
resolveMonster(monster, byId)  // walks parentId
  → { tagIds, lootItemIds, areaType, difficulty, talentRewardId, chain }
```

`tagIds` and `lootItemIds` concatenate down the chain (deduplicated); `areaType`, `difficulty` and
`talentRewardId` take the first non-null, child first. Cycle guard, depth cap 8. Called at
`prepare()` time from `recherche.js` and `mission.js`, both of which already fetch whole catalogs.

**Retired here:** `worldData/missionSubjects/items`, `worldData/missionActions/items`, and the
`missionActions`/`missionSubjects` fetch pairs in `recherche.js`.

### 4.3 The Monster creator page (directive 2)

`src/components/creator/MonstersManager.jsx`, modelled directly on
`MissionSubjectsManager.jsx` — the same `onSnapshot` list + `details`/`summary` form panel +
`MultiSelectModalField` shape, the same class names (`creator-section`, `creator-list`,
`collapsible-group`, `condition-row`), no new styling (directive 3).

Fields:

| Control | Field | Widget |
|---|---|---|
| Nom | `name` | text, required |
| Difficulté | `difficulty` | `<select>` over `DIFFICULTIES` |
| Type de zone | `areaType` | `<select>` over `AREA_TYPES`, with an "hériter du parent" empty option |
| Parent | `parentId` | `SoloSelectModalField` over monsters, **excluding self and every descendant** (cycle prevention, client-side) |
| Tags | `tagIds` | `MultiSelectModalField` over `tags`, `matchesTag` filter, `createLink` to the Tag section |
| Butin | `lootItemIds` | `MultiSelectModalField` over `objects`, `createLink` to the Objets section |
| Talent enseigné | `talentRewardId` | `SoloSelectModalField` over talents, nullable |

Plus one thing no existing manager has and this one needs: a **read-only "hérité du parent" panel**
showing the resolved tags, loot and talent reward contributed by the parent chain, so an author can
see what a monster actually carries without opening its ancestors. Same `resolveMonster` logic,
duplicated client-side — the project already accepts client/server twins for `actionConditions`,
`actionKinds`, `loot`, `salePrice` and `trainingCost` because `functions/` (CommonJS) shares no
build with the Vite app.

`CreatorDashboard.jsx`: the `Missions` group's two tabs (`Actions de mission`, `Sujets de mission`)
are replaced by `Monstres`. A `Zones` tab joins the `Carte` group for `AreasManager.jsx` — a small
manager (name, type select, tags, harvest loot tables) built on the same pattern, plus an `Area`
selector added to `RegionsManager.jsx`.

**Reduced-scope fallback if Area proves not worth its own catalog:** put `areaType` directly on
`Region` and drop the `areas` collection. It costs the shared area tags and the per-area harvest
pool (which Wave 3 wants), so the full version is the recommendation — but the fallback is a
one-field change and the rest of this plan is unaffected by it.

### 4.4 Loot

**`functions/src/missionLoot.js`** — rewritten to draw from the monster's own pool rather than by
matching loot tables:

```
count      = success ? 3 : 1                                        // Python: outcome moves count
rarityMax  = max(difficultyIndex, monsterDifficultyIndex)           // decision #12 + #13
pool       = resolvedLootItemIds → objects, filtered rarity <= rarityMax
if pool is empty → fall back to the unfiltered resolved pool        // content gap, never fatal
if still empty  → return []                                          // fixes Python's IndexError
draw `count` items uniformly, with replacement
```

Consequences, all deliberate:

- **`worldData/lootTables/items` loses its mission consumer.** It survives for harvest (Wave 3), so
  `TablesDeTirageManager.jsx`, the schema and the collection all stay. `weightMode` / `itemWeights`
  no longer apply to missions — mission draws are uniform, as in Python.
- **Rarity is a ceiling, not an exact match.** A `mythique` mission against a common-loot monster
  still draws commons. The web's exact-match guaranteed the tier; the ceiling only permits it.
- **Failure pays undegraded loot at a smaller count**, where the web degraded rarity on a full-size
  haul. `rarityOffset` is deleted. The diff notes keeping both levers would be coherent; this plan
  takes Python's, and the `rarityOffset` parameter is removed rather than left dangling.
- **Ownership stays per-`instance`.** Python's `Dict[Item, int]` quantity map is not ported:
  `faireDuCommerce` sells *an instance*, and `condition` / `acquisitionDate` have nowhere to live in
  a quantity map. `character.inventory` stays reserved and unused.

`functions/src/lib/loot.js`'s `LOOT_COUNT_BY_DIFFICULTY` (1/1/2/2/3/3) is deleted —
count now follows the outcome, not the difficulty.

### 4.5 `ActionResult` and one applier

New `functions/src/lib/actionResult.js`. This is the diff's clearest structural win (§6): eight
handlers each building their own ad-hoc `updates` object become one closed effect vocabulary and
one applier.

```js
createActionResult({
  itemsGained = [],        // object ids — become `instances` at commit(), not at resolve()
  itemsLost = [],
  talentsGained = [],      // talent ids, granted at quality 1
  talentTrained = [],      // owned talent ids, +1 quality via bumpTalentQuality
  reputationGained = 0,    // signed
  reputationRegionId = null,  // null = the character's current region
  newRegionId = null,
  injury = null,           // { light, severe, permanent }
})

applyActionResult(character, result, { today, circumstance })
  → { updates, died }
```

Deviations from Python's nine fields, each with a reason:

- **`idleTime` is not ported** (decision #3). Duration stays authored on the action type and
  stamped by `stampLifecycle` before the handler runs. Python relocates the clock to the outcome
  because it has no lifecycle envelope; the web does, and nothing consumes `idleTime` on either side.
- **`talentsLost` is not ported.** Nothing on the web can take a talent away and nothing in Python
  fills the field. Adding an unused effect channel is exactly what §14 keeps flagging.
- **`reputationRegionId` is added** — Python's `ActionResult` cannot name a region, which is why a
  quest spanning several regions credits wherever the character happens to stand (diff §2, §8).
- **`itemsGained` is deferred, not applied.** `applyActionResult` writes it to `lastAction.loot`;
  the existing per-handler `commit()` turns it into `instances` once the player acknowledges. The
  acknowledgement step is the web's anti-duplication guarantee and is not negotiable (§1.2).

`applyActionResult` reads `injury` and routes it through `applyWound` — closing the harm chain
Python still leaves broken at exactly this link (diff §1b.4).

The eight handlers (`mission`, `recherche`, `partirExplorer`, `recolte`, `artisanat`, `sEntrainer`,
`apprentissage`, `faireDuCommerce`) each stop hand-rolling `updates` and return an `ActionResult`
instead. `functions/src/lib/actionEffects.js` gains the merge into the lifecycle envelope.

### 4.6 Reputation

`character.reputation: number` → `character.reputations: { [regionId]: number }`.

- **Rewards** (Python verbatim, decision #16): success `1 + difficultyIndex`; failure
  `-(4 - difficultyIndex)`, unclamped, so `épique` costs nothing and `mythique` pays +1.
- **Credited to** `result.reputationRegionId ?? character.region.id`.
- **Seeding**: `createCharacter` writes `{ [regionId]: origin.reputationStart }`. Arriving in an
  unvisited region seeds that entry at `1` (Python's `Character.update` behaviour), and
  `gainReputation` against a named region defaults a missing entry to `0` rather than raising
  Python's `KeyError`.
- **`minReputation` condition** (`functions/src/lib/actionConditions.js` and its `src/lib/` twin)
  reads the *current region's* entry. Documented in the predicate, since "reputation" stops being a
  career score and becomes a relationship with a place.
- **Migration**: `functions/scripts/migrateReputationToPerRegion.js` writes
  `{ [character.region.id]: character.reputation }` and leaves the scalar in place as legacy.
- **`CharacterBanner.jsx`** shows the current region's score; the character sheet gains a small
  per-region list. No new styling — reuse `.instance-list` / `.quest-info`.

**The zero-sum invariant, stated and tested.** The success and failure formulas were chosen
independently and happen to net to +0.0125 per mission across the generation weights for a
talentless character. The diff's point is that nothing in the code says so, so it won't survive
either formula being retuned. Two tests encode it:

1. The generation-weighted expectation for a talentless character stays within ±0.05 of zero.
2. The same expectation for a character holding one tag-matching level-5 talent is **strictly
   positive at every tier**, and rises with difficulty.

Test 2 is the answer to "nothing pushes a character up the ladder": the base curve is flat by
design, and **talents are what make the higher tiers pay**. That is a statable design intent rather
than a coincidence, and it makes the non-monotonic talentless curve a feature of the floor rather
than a bug in the slope.

### 4.7 Talent progression

Rewrites `functions/src/lib/talentEvolution.js`. `evolutionChance` and `rollTalentEvolutions` are
deleted; `bumpTalentQuality` is **kept unchanged** (it already caps quality at 5 and re-applies
`rarityFloor`, so talent rarity keeps rising with quality and the pop-up's rarity sort and
`rarity-*` CSS classes keep working).

Two paths, per decision #9:

**Training (success only)** — Python's `levelUpTalent`, guarded:

```
if roll(2) !== 1 → nothing                                    // flat 50 %, once per resolution
candidates = owned talents sharing a tag with mission.tagIds
             && quality <= min(difficultyIndex + 1, 4)
if candidates is empty → nothing                              // fixes Python's IndexError
pick exactly one uniformly → bumpTalentQuality
```

**Granting (success only)** — `monster.talentRewardId`, resolved along the parent chain, granted at
quality 1 if the character doesn't already own it. Python declares this and never calls it; the web
wires it.

Two properties worth testing because they are emergent, not written down anywhere in Python:

- The **training window** (`quality <= min(d+1, 4)`) and the **usefulness gate** (`quality >= d`)
  are written independently and their intersection is the whole rule: 0–1 at facile, … , 4 only at
  épique, **and empty at mythique**. The top tier can teach nothing. Assert it, so it's a decision.
- The level-5 cap is enforced twice (candidate filter *and* `bumpTalentQuality`), so a future second
  training path can't push a talent past 5 — which would silently make the character *weaker*,
  since `perfectCount` tests `=== 5` exactly.

`sEntrainer.js` already calls `bumpTalentQuality` and is unaffected.

### 4.8 Travel

New handler `functions/src/actions/voyager.js`, new action document under the `intermede` kind
(so it draws from the Intermède budget rather than burning the main Interval — the web has that
budget and Python has no clock at all, so this is the cheapest correct home for it).

- Payload: `regionId`. Returns `createActionResult({ newRegionId })`.
- `applyActionResult` writes `character.region` and seeds `reputations[newRegionId] ??= 1`.
- **Any region is reachable** in Wave 2 — Python's "the player can move to all regions for now".
  Adjacency-gating on the already-authored, currently-unread `region.neighbors` is a Wave 3 item;
  shipping it now would break travel wherever `neighbors` is unauthored.
- Region-locked missions in the journal stay locked to where they were generated, so travelling
  strands unclaimed missions. That is the intended trade-off, and it is what makes per-region
  reputation and area-keyed generation into an actual choice.

### 4.9 Quest chains

`functions/src/lib/questChains.js` keys on `monsterId` instead of `subjectId`;
`character.triggeredSubjectIds` → `triggeredMonsterIds`; `questChainProgress` is unchanged (id-keyed
map — Firestore needs an id key, so the web's shape wins over Python's object-keyed
`Dict[Quest, int]`).

New: **completing the last step fires the chain's rewards** through an `ActionResult`
(`rewardItemIds`, `rewardTalentIds`, `rewardReputation` + `rewardRegionId`) — Python's
`Quest.finish()`, which the web has no counterpart for today.

`ActionResultDialog.jsx`'s page 2 fetches `worldData/monsters/items` instead of `missionSubjects`,
and its localStorage key becomes `shownTriggeredMonsters:{characterId}`.

The scheduled sweep (`sweepQuestTriggers`, `functions/src/lib/questTriggers.js`) is kept and reads
`monster.trigger`. Python has no counterpart because it has no scheduler.

### 4.10 `partirExplorer`

Kept (decision #6), rewired: each round draws a monster from the current region's area instead of
synthesising an objective, and resolves through `resolveMission`. The narration calls go with Wave
0. `fatigue` keeps accumulating and keeps being unread — documented, not fixed here.

Worth noting: this is the only action where wounds accumulate *within* one action, so it is the
most exposed to §4.1's ~6× injury-frequency rise. Wave 3's healing item should be balanced against
this handler specifically.

---

## 5. Front end

### 5.1 Style (directive 3)

`src/index.css` is not touched. Every new or reworked component reuses the existing class
vocabulary — `creator-section`, `creator-list`, `collapsible-group`, `condition-row`,
`action-loot-box`, `instance-list`, `instance-card`, `quest-info`, `outcome`,
`difficulty-text-{value}`, `rarity-{value}`. The `difficulty-text-*` and `rarity-*` classes are
keyed on the *stored* enum values, which is one more reason those keys don't change (§6).

### 5.2 The mission result pop-up (directive 5)

`src/components/actions/results/DefaultResult.jsx` — the outcome line becomes, when
`lastAction.mission` is present:

```jsx
<p className={`outcome ${outcomeClass}`.trim()}>
  {lastAction.success ? "Succès" : "Échec"} : {lastAction.mission.name}
</p>
```

Non-mission actions keep the bare `Succès` / `Échec`. `ActionOutcome.jsx` drops its separate
`Mission : {name}` line, which would otherwise repeat the name two lines down; the location, if
any, moves onto the `Résolution` fieldset.

**One deviation flagged, not silently taken:** the directive spells it `Echec`; every other string
in this codebase spells it `Échec` (`ActionOutcome.jsx`, `DefaultResult.jsx`). The plan implements
`Échec` for consistency — say the word if the unaccented form is wanted and it's a one-character
change.

`ActionOutcome.jsx` also needs, in the same pass:

- reputation rendered signed (`+2` / `−3`), since failure now moves it — the current
  `reputationGained > 0` guard hides every loss;
- the region the reputation landed in, now that it is per-region;
- `Talent entraîné` alongside the existing `Amélioration de talent` list, since training and
  granting are now two distinct effects (Python separates `talentTrained` from `talentsGained`; the
  web's `rollTalentEvolutions` returned both through one list).

### 5.3 Other front changes

- `MissionPicker.jsx` — reads `targetMonsterId`; the difficulty accent is unchanged.
- `CharacterBanner.jsx`, `CharacterTabs.jsx` — per-region reputation.
- `ActionBrowser.jsx` — the new `Voyager` action needs a region picker, modelled on
  `CommercePicker.jsx` / `ProfessionPicker.jsx`.
- `src/lib/actionConditions.js` — the `minReputation` twin, kept in step with the server copy.

---

## 6. Migration and data

Stored enum **values** do not change. Python renames three difficulty labels
(`moyen → normal`, `epique → extrême`, `mythique → impossible`), and the diff notes the indices are
stable while the strings are not. **Decision: change the French labels in `src/lib/difficulties.js`
only, keep the stored keys.** That buys Python's vocabulary for free and avoids a migration across
`missionJournal[].difficulty`, `questChain.steps[].difficulty`, `monster.difficulty`, and every
`difficulty-text-{value}` CSS class.

Python's rarity scale drops the web's top two tiers (`divin`, `unique`). Nothing in the mission
pipeline could ever reach them (the difficulty→rarity map topped out at index 5), so **the 8-tier
`RARITY_ORDER` stays** — dropping two tiers would invalidate authored objects and `salePrice`'s two
top rows for no mechanical gain.

Scripts, in `functions/scripts/`, generated for review and run by hand:

| Script | Does |
|---|---|
| `dropNarrativeCollections.js` | Deletes `narrativeSubjects` and `verbPhrases` (Wave 0) |
| `seedAreasFromRegions.js` | Creates one `areas` document per distinct region climate/relief combination, sets `region.areaId` |
| `migrateSubjectsToMonsters.js` | Best-effort: one `monsters` document per `missionSubject`, carrying `name`, `tagIds` (union across tiers/variations), `trigger`; `areaType` and `lootItemIds` need hand-authoring afterwards — flagged in the script's output, not guessed |
| `migrateReputationToPerRegion.js` | `reputation` → `reputations[region.id]` |
| `migrateTriggeredSubjectsToMonsters.js` | `triggeredSubjectIds` → `triggeredMonsterIds`, using the id map the previous script writes |

`questChains` documents need re-authoring by hand (`subjectId` → `monsterId`) — the same call the
previous migration made when chains authored against `quests` were left stale rather than migrated.

---

## 7. Tests

Existing test files, 18 of them. Disposition:

| Deleted | Rewritten | Untouched |
|---|---|---|
| `textGeneration.test.js`, `missionNaming.test.js`, `questResolution.test.js`, `talentEvolution.test.js` | `missionResolution.test.js`, `missionLoot.test.js`, `mission.test.js`, `recherche.test.js`, `partirExplorer.test.js`, `questChains.test.js`, `questTriggers.test.js` | `wounds.test.js`, `actionConditions.test.js`, `actionKinds.test.js`, `actionCatalog.test.js`, `actionLifecycle.test.js`, `actionEffects.test.js`, `crafting.test.js`, `harvest.test.js`, `loot.test.js`, `trainingCost.test.js` |

`wounds.test.js` surviving untouched is the check that the escalation ladder really did port
unchanged (diff §1b.3).

New coverage the port specifically needs, because each of these is a rule that exists only as an
interaction between two independently-written comparisons:

1. `SUCCESS_THRESHOLD` / `updateDifficulty` — including "one level-5 talent never drops a tier".
2. Injury bands are mutually exclusive, and `roll === permanentThreshold` **does** wound.
3. Success never wounds, for the current tables.
4. `mythique` is unwinnable at zero talents and winnable at one point of bonus.
5. Reputation: talentless expectation within ±0.05 of zero; one level-5 talent makes every tier
   positive and rising (§4.6).
6. Talent training window ∩ usefulness gate per tier, including the empty intersection at
   `mythique`.
7. Quality never exceeds 5 through either path.
8. `resolveMonster` — concatenation down the chain, first-non-null scalars, cycle guard, depth cap.
9. Loot: count follows outcome, rarity ceiling applies, empty pool degrades to unfiltered then to
   `[]`, never throws.
10. `applyActionResult` — every field applied exactly once, `injury` reaches `applyWound`,
    `reputationRegionId` respected.

---

## 8. Roadmap rows for `docs/TODO.md`

To append to the Roadmap table (numbering continues from the current #35). Spec rows are already
resolved by this document, so all rows start at `todo`.

| # | Item | Status | Blocked by |
|---|---|---|---|
| 36 | Retire narration (generator, catalogs, creator pages, poc) | todo | — |
| 37 | Area and Monster contracts (Zod schemas, shared + functions) | todo | — |
| 38 | Monster creator page (CRUD, inheritance preview) | todo | 37 |
| 39 | Area creator page + `region.areaId` | todo | 37 |
| 40 | Content migration scripts (areas, monsters, reputation, triggers) | todo | 38, 39 |
| 41 | Resolution engine rebuild (thresholds, bands, tier drop) | todo | 36 |
| 42 | `ActionResult` + `applyActionResult`, all eight handlers | todo | 41 |
| 43 | Mission generation from the bestiary | todo | 40, 41 |
| 44 | Monster-pool loot with difficulty rarity ceiling | todo | 43 |
| 45 | Per-region reputation (+ zero-sum invariant tests) | todo | 42 |
| 46 | Talent training roll + monster talent reward | todo | 42, 43 |
| 47 | Quest chains on monsters + chain completion rewards | todo | 43, 45 |
| 48 | Travel action ("Voyager") | todo | 45 |
| 49 | Result pop-up rework (`Succès/Échec : {mission.name}`, signed reputation) | todo | 42 |
| 50 | Healing / wound recovery — spec | todo | 41 |
| 51 | Métier rework: jobs, per-trainer ceilings, proficiency as rarity ceiling | todo | 42 |
| 52 | Merchants and the buy side of the economy — spec | todo | 51 |
| 53 | Region adjacency gating for travel | todo | 48 |

---

## 9. Risks

**Injury frequency without a healing path** (§4.1). ~20 % wounds per mission against the web's ~3 %,
on a ladder with no drain and an uncapped permanent counter. Wave 2 ships this; Wave 3 fixes it.
If the gap between them is long, cap `permanent` or slow the bands as a stopgap — don't ship the
combination unexamined.

**Content re-authoring is the real cost, not the code.** `missionSubjects` → `monsters` migrates
names, tags and triggers, but `areaType` and `lootItemIds` are new axes nothing existing can supply.
Until a monster has loot, its missions pay nothing; until it has an `areaType`, it is never drawn.
A region whose area type no monster covers generates an empty journal. **Budget an authoring pass
between Wave 1 and Wave 2**, and consider a creator-side warning listing area types with no
monsters and monsters with no loot.

**The loot-table collection loses most of its purpose.** It keeps only harvest. If Wave 3's Métier
rework also moves harvest onto area pools, `worldData/lootTables/items`, its schema, its creator
page and `weightMode`/`itemWeights` all become dead at once — worth deciding then rather than
discovering it.

**Two front-end catalogs disappear at once** (`Actions de mission`, `Sujets de mission`). Anyone
mid-authoring in those tabs loses their working set. Run the migration script before deleting the
tabs, not after.

**The Interval lock plus travel.** Travel is an Intermède action, so a character can travel and
still act — but region-locked missions mean the journal is worthless after a move until the next
"Se renseigner", which *is* a main-Interval action. Playtest that specific sequence; it may want
travel to refresh the journal, which would be a deviation from both models and should be a
deliberate one.
