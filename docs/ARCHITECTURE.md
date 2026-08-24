# Architecture

Technical reference for how Monkar is built. For setup instructions, see [README.md](../README.md).

## Overview

Monkar is a daily-action text RPG. On first login, a player picks a region, a background is rolled for them, and they name their character. From then on they pick one action per day (quest, rest, training, shopping...); the outcome is a weighted random roll, revealed a day later, and the character can't act again until the next day. Failure can wound the character or end their life permanently (permadeath) — at which point the player goes through character creation again. A separate "creator" role can inspect every character's history and author the game world's content (regions, backgrounds, talents, action types, and eventually factions/gods/creatures).

GitHub Pages only serves static files, so all stateful and security-sensitive logic lives in Firebase:

```
┌─────────────────────┐        ┌──────────────────────────────────────────┐
│  GitHub Pages        │        │  Firebase project: monkar-rpg            │
│  (static React app)  │◄──────►│  - Auth (email/password)                 │
│  github.io/Monkar    │        │  - Firestore (characters, world data)    │
└─────────────────────┘        │  - Cloud Functions (createCharacter,     │
                                │    performAction)                        │
                                └──────────────────────────────────────────┘
```

The front never talks to a custom server — it calls the Firebase client SDK directly (Auth, Firestore reads/writes allowed by security rules, and the two callable Cloud Functions).

## Why Cloud Functions at all

Firestore security rules can enforce a lot on their own (see below), including the daily-action lock, using `request.time` — a timestamp Firestore evaluates server-side, which the client cannot forge. What rules **cannot** do is guarantee that a "random" roll a client submits was actually random: a rule can restrict the *shape* of a value (e.g. an integer between 1 and 100) but not audit *how* it was produced. `createCharacter` and `performAction` exist specifically to compute rolls server-side, so results can't be fabricated from devtools.

This was a deliberate tradeoff, not a hard requirement — see the "Alternatives" section below for the no-Cloud-Functions option.

## Data model (Firestore)

```
users/{uid}
  role: "player" | "creator"
  characterId: string              -- points at the current (living) character

characters/{characterId}
  ownerUid: string
  name: string                     -- in-game character name, French
  age: 18                          -- fixed for every character
  region: { id, name }
  background: { id, name, profession }
  title: string                    -- empty until the creator/game grants one (stub)
  profession: string               -- starts equal to background.profession
  reputation: number                -- LEGACY, superseded by `reputations` below: a single global
                                     -- score, starting at background.reputationStart. Still the one
                                     -- every handler reads and writes today
  reputations: { [regionId]: number } -- per-region reputation (docs/TODO.md "Per-region
                                     -- reputation"). Declared and written empty at creation; not
                                     -- read by any handler yet
  triggeredMonsterIds: [string]     -- worldData/monsters/items ids granted by the trigger sweep,
                                     -- replacing triggeredSubjectIds (which the sweep still writes
                                     -- until the bestiary generation lands)
  legendLevel: number | null        -- null until the first tier.legendary roll, then increments
  alive: boolean                   -- false = permadeath; the player creates a new character
  gold: number
  inventory: [{ name, qty }]
  talents: [{ id, name, quality, trainable, rarity, effect, lastChangeDate, lastChangeCircumstance }]
                                    -- id references worldData/talents/items; fields are a denormalized
                                    -- copy taken at grant time, same convention as `background` above
  blessings: [string]              -- not yet granted by any code path (stub)
  curses: [string]                 -- not yet granted by any code path (stub)
  woundsLight: number         -- "blessures légères"; attributing a 4th escalates to woundsSevere instead
  woundsSevere: number        -- "blessures graves"; attributing a 4th escalates to woundsPermanent instead
  woundsPermanent: number     -- "blessures permanentes"; attributing a severe/permanent wound while
                                  already at 3 kills the character (alive: false) instead of incrementing
                                  further - see functions/src/lib/wounds.js. Shown in the character's
                                  "Santé" tab (CharacterTabs.jsx).
  knownRecipes: [string]           -- worldData/recettes/items ids; shown read-only in the Xerotex
                                    -- page's "Recettes" tab (XerotexRecipesTab.jsx), and gates which
                                    -- recettes an Artisanat action's crafting tab offers
                                    -- (CraftingTab.jsx). Not yet granted by any code path (stub) —
                                    -- see docs/TODO.md
  lastActionDate: string | null    -- "YYYY-MM-DD" UTC, the once-per-day lock
  lastActionAt: Timestamp | null   -- precise instant, used for the 24h reveal delay
  lastAction: { ... } | null       -- full result of the last action, see performAction below
  intermedeActionsThisInterval: number  -- bonus Intermède actions used this Interval, capped at 3,
                                    -- reset by sweepQuestTriggers - see "Intermède-budget actions"
                                    -- below; fully decoupled from lastAction/lastActionDate above
  missionsSinceRenseignement: number  -- legacy/dead: used to gate an implicit renseignementAvailable
                                    -- condition on "Se renseigner" (handlerId "recherche"), removed
                                    -- because that action must always be available with no
                                    -- condition - see docs/TODO.md "Se renseigner intermède action".
                                    -- No longer read or written by any code.
  createdAt: server timestamp

actionsLog/{logId}                 -- permanent history, independent of lastAction
  characterId, ownerUid, actionTypeId, date
  success: boolean
  narrativeText: string              -- always "" since "Narration removal" (docs/TODO.md) retired the
                                      -- generator; kept on the shape so entries logged before it stay
                                      -- readable against the same field
  quest: { id, name, difficulty, locationId, locationName } | undefined  -- "partir-en-quete" only, see below
  createdAt: server timestamp
  -- plus whatever else the handler's own logFields choose to add (e.g. recolte's lootCount) - see
  -- "The performAction Cloud Function" below

worldData/actionTypes/items/{id}
  label: string                    -- e.g. "Partir en quête"
  handlerId: string                -- must resolve to a registered entry in functions/src/index.ts's
                                    -- ACTION_HANDLERS - an action has no generic fallback any more,
                                    -- see "The performAction Cloud Function" below
  questDifficultyWeights: [{ difficulty, weight }]  -- "partir-en-quete" only, optional; defaults to
                                             -- facile 55 / moyen 30 / difficile 10 / tres_difficile 4 / epique 1
                                             -- when absent, see "Quest drawing" below
  trainerTypeId: string | null      -- worldData/trainerTypes/items id this action trains at; only
                                     -- meaningful when kindId inherits from "entrainement" - the
                                     -- "S'entraîner" action itself (handlerId "sEntrainer"), or its
                                     -- "apprentissage" subtype (handlerId "apprentissage"), which
                                     -- grants a character its first worldData/professions/items
                                     -- entry instead of bumping a talent's quality, and is
                                     -- additionally reserved to characters with no professionId yet
                                     -- (the implicit "professionless" condition)
  -- there used to be a `tiers: [...]` field here (a per-action weighted roll deciding
  -- success/failure, gold, wounds, death, narrativeText) - retired; each handler now decides its
  -- own outcome and gains directly in code. A `tiers` array left over on an old document is inert.

-- worldData/narrativeSubjects/items and worldData/verbPhrases/items used to live here: the two
-- catalogs the procedural narrative generator read. Both were retired by "Narration removal"
-- (docs/TODO.md) along with the generator itself, and are deleted from Firestore by
-- functions/scripts/dropNarrativeCollections.js. The design record is archived under docs/retired/.

worldData/tags/items/{id}          -- standalone label catalog, "Tags" creator tab -- referenced by id
  name: string                        from tagIds on missionSubjects, objects, lootTables, talents
                                       and recettes; deleting a tag
                                       strips its id from every referencing document before deleting
                                       the tag doc itself

worldData/regions/items/{id}
  name: string
  nameSuggestions: [string]         -- shown to the player when naming their character
  areaId: string | null             -- worldData/areas/items id, the terrain this region sits in;
                                     -- what mission generation filters the bestiary on once
                                     -- docs/TODO.md "Mission generation from the bestiary" lands.
                                     -- climateIds/reliefIds stay, but only for display and origin
                                     -- matching - they no longer drive generation

worldData/regions/items/{regionId}/backgrounds/{id}
  name, profession, weight, reputationStart, startingGold, startingItems: [{name, qty}]

worldData/origins/items/{id}
  name: string
  description: string
  regionIds: [string]          -- worldData/regions/items ids; empty means no restriction (usable
                                -- from any region) -- independent of, and not synced with, the
                                -- region-side worldData/regions/items.originIds field above
  talentIds: [string]          -- worldData/talents/items ids, optional
  profession: string           -- free text, optional; no profession catalog exists yet (see F10,
                                -- docs/ISSUE-02-ACTION-FRAMEWORK.md), same convention as backgrounds.profession
  reputationStart: number       -- can be negative
  startingItemIds: [string]    -- worldData/objects/items ids

worldData/talents/items/{id}
  name: string                     -- French, e.g. "Résistance au feu"
  trainable: boolean               -- shown with a trailing asterisk in the UI
  rarity: "commun" | "peu_commun" | "rare" | "tres_rare" | "legendaire" | "mythique" | "divin" | "unique"
  effect: string                   -- French, shown in the character sheet tooltip
  trainerTypeId: string            -- worldData/trainerTypes/items id, only meaningful when trainable

worldData/trainerTypes/items/{id}
  name: string                     -- e.g. "Maître d'armes"
  description: string              -- free-text French description of the trainer, e.g. "Sage ermite"
  locationId: string               -- worldData/adventureZones/items id, where a character must be
                                    -- able to reach (via their region's adventureZoneIds) to train
                                    -- with this trainer type - see the "S'entraîner" action below

worldData/adventureZones/items/{id}   -- displayed as "Lieu(x) de quête" in the UI; the collection id
  name: string                        -- itself keeps its original name to avoid a data migration
  description: string                 -- referenced by worldData/regions/items (adventureZoneIds, a
                                       -- region's available locations) and a mission's locationId
  tagIds: [string]                    -- worldData/tags/items ids describing this location's flavour
                                       -- (forest, coastal village, ruins, ...); read by
                                       -- partirExplorer.js for each round's objective and loot pool

worldData/areas/items/{id}         -- terrain catalog: the type of place a region sits in.
  name: string                     -- French display name, e.g. "Marais de Ravenholm"
  type: string                     -- one of AREA_TYPES (shared/lib/areaTypes.ts): ville | marais |
                                    -- grotte | plaine | montagne | desert | ruines_anciennes |
                                    -- volcan. Several regions can share one Area, and two Areas
                                    -- with the same type draw from the same monsters
  tagIds: [string]                 -- worldData/tags/items ids, flavour only
  lootTableIds: [string]           -- worldData/lootTables/items ids, the harvest pool for jobs run
                                    -- here (docs/TODO.md "Métier rework")

worldData/monsters/items/{id}      -- the bestiary: what a generated mission hunts, replacing the
  name: string                     -- missionSubject x missionAction pair
  difficulty: string               -- a DIFFICULTIES tier. NOT a gate on generation - it only raises
                                    -- the loot rarity ceiling (docs/TODO.md "Monster-pool loot")
  areaType: string | null          -- one of AREA_TYPES; matched against the region's Area type.
                                    -- null = inherited from the parent chain
  parentId: string | null          -- worldData/monsters/items id: prototypal inheritance, resolved
                                    -- at read time with a cycle guard and a depth cap of 8, never
                                    -- flattened in Firestore. Array fields concatenate down the
                                    -- chain, scalars take the first non-null
  tagIds: [string]                 -- worldData/tags/items ids; talent matching. Concatenated
  lootItemIds: [string]            -- worldData/objects/items ids; the mission loot pool, replacing
                                    -- loot-table selection for missions. Concatenated
  talentRewardId: string | null    -- worldData/talents/items id granted at quality 1 on a
                                    -- successful hunt if not already owned
  trigger: { conditions } | null   -- same shape and sweep as the retired missionSubject.trigger
  -- CONTRACT ONLY so far: shared/schema/{area,monster}.ts and their functions/src/schema/
  -- re-exports exist, but no creator page writes these collections and no handler reads them yet -
  -- see docs/TODO.md rows 3-5 and 8

-- worldData/quests/items - RETIRED by "Retiring quests and quest objectives for the subject-action
-- system" (docs/TODO.md), along with QuestsManager.jsx and the "Partir en quête" handler. Missions
-- (worldData/missionSubjects/items x worldData/missionActions/items, generated on the fly by
-- recherche.js) are the sole Aventure-branch content generator now - see mission.js below and docs/
-- TODO.md "Regional mission generation and journal". Any leftover worldData/quests/items documents
-- in a live Firestore project are orphaned data, not read by any code path any more.

worldData/objects/items/{id}       -- general item catalog: weapons, armor, components, knowledge
  name: string                     -- tomes, magic items, currency, property deeds, etc.
  description: string
  rarity: string                   -- one of the 8-tier rarity enum shared with talents, above
  type: string                     -- one of the fixed OBJECT_TYPES enum (ObjectsManager.jsx):
                                    -- arme, armure, consommable, composant, ingredient, grimoire,
                                    -- parchemin, objet_magique, titre_propriete, vetement
  tagIds: [string]                 -- worldData/tags/items ids
  -- not yet consumed by any Cloud Function or linked to a character's inventory, see docs/TODO.md

worldData/lootTables/items/{id}    -- loot table catalog: a named, tagged pool of objects a mission
  name: string                     -- (or any other consumer) can draw from
  rarity: string                   -- one of the 8-tier rarity enum shared with talents, above
  tagIds: [string]                 -- worldData/tags/items ids
  itemIds: [string]                -- worldData/objects/items ids; draw is uniform over this list
                                    -- (see drawLootTableItemId, src/lib/lootTables.js)
  -- which table is used is resolved dynamically per draw (rarity + tag overlap), not referenced by
  -- id from any other document - see functions/src/missionLoot.js

worldData/recettes/items/{id}      -- crafting recipe catalog: ingredients consumed to produce results
  name: string
  rarity: string                   -- one of the 8-tier rarity enum shared with talents, above
  categoryIds: [string]            -- worldData/tags/items ids; same catalog as tagIds below, just a
                                    -- second, independently-picked field
  tagIds: [string]                 -- worldData/tags/items ids
  ingredients: [{ objectId, qty }] -- objectId: worldData/objects/items id, qty: number
  results: [{ objectId, qty }]     -- objectId: worldData/objects/items id, qty: number
  -- consumed by an Artisanat action's "artisanat" handler (functions/src/actions/artisanat.js) —
  -- see docs/TODO.md "Action d'artisanat"

worldData/factions/{id}            -- not yet consumed by the app, reserved for
worldData/gods/{id}                   the creator dashboard (Phase 3)
worldData/creatures/{id}
```

`worldData` uses a mixed depth on purpose (`actionTypes` and `regions` nest an `items` subcollection, `regions/items/{id}/backgrounds` nests one level further so each region has its own background pool, while `talents` is global and shared across regions). The Firestore rule for `worldData` uses a recursive wildcard (`{document=**}`) specifically so it authorizes reads/writes at any depth, instead of hardcoding one shape.

**Why `lastAction` is stored on the character doc instead of only in `actionsLog`**: the action panel needs to read "the most recent result" on every page load without an extra indexed query, and it needs `lastActionAt` (a precise instant) to compute the 24h reveal delay. `actionsLog` remains the append-only, permanent history shown in the "Historique du personnage" tab.

## Security rules (`firestore.rules`)

- `users/{uid}`: a signed-in user can read their own doc, and create it once (on signup) with `role` forced to `"player"` — role escalation to `"creator"` never goes through a client write, only through the `setCreatorRole` admin script (see below). In practice `createCharacter` (Admin SDK, bypasses rules) is what actually writes/updates this doc now.
- `characters/{id}`: a player can read/update only their own character (`ownerUid == request.auth.uid`); the creator role can read/update/delete any character.
- `actionsLog/{id}`: read-only from the client (player sees their own, creator sees all); all writes happen inside the `performAction` transaction, never directly from the client. **Any query against this collection must filter by `ownerUid` (or be run as the creator role)** — Firestore rejects list queries outright if no query filter lines up with the rule's `resource.data` condition, regardless of whether matching documents exist.
- `worldData/**`: any signed-in user can read (needed to show action/region/background choices); only the creator role can write.

The creator role itself is a **custom claim** on the Firebase Auth ID token (`request.auth.token.role == 'creator'`), not a Firestore field — Firestore rules can't trust a plain document field for authorization since a malicious client could otherwise just set `role: "creator"` on their own `users/{uid}` doc (which is why that field is only informational for the UI, and the `create` rule forces it to `"player"`).

## The `createCharacter` Cloud Function

Callable, `functions/src/index.ts`. Given `{ regionId, name }`:
1. Rejects if the caller isn't authenticated, or already has a character with `alive == true` (one living character per account).
2. Loads the chosen region, rolls a background from `worldData/regions/items/{regionId}/backgrounds` (weighted).
3. Creates the `characters` doc (region chosen, background rolled as above; `title` empty, `legendLevel` null, `alive: true`, `reputation`/`gold`/`inventory` from the background) and upserts `users/{uid}` with `role: "player"` and the new `characterId`.

Region is a player *choice*; background is *rolled* server-side specifically so a player can't simply pick the best possible starting character.

## The `performAction` Cloud Function

`performAction` (`functions/src/index.ts`) is a thin dispatcher, not a monolithic roller — each `actionTypeId` has its own handler module under `functions/src/actions/` (`mission.js`, `recherche.js`, `partirExplorer.js`, `recolte.js`, `artisanat.js`, `sEntrainer.js`, `apprentissage.js`, `faireDuCommerce.js`; each mechanic gets its own module rather than being squeezed into one generic tier-roller, since their mechanics have little in common). A handler exports:

- `prepare({ db, character, actionType })` — async, runs **before** the transaction. Does any read-only setup specific to that action (e.g. drawing a mission's supporting catalogs, see below) and can `throw HttpsError` for a precondition that should block the action *without* consuming the daily lock (nothing has been written yet at this point).
- `resolve({ tx, db, character, actionType, today, context })` — runs **inside** the transaction, after the once-per-day lock re-check. Returns `{ updates, logFields }`: `updates` is the full `characters/{id}` patch (`lastActionDate`, `lastActionAt`, `lastAction`, plus whatever else the handler decides to write - gold/inventory/talents/reputation/legendLevel/alive/wound counters are all just fields a handler can choose to touch, not a shared mechanic every action goes through), `logFields` is the handler-specific subset merged into the `actionsLog` entry (the dispatcher adds the common `characterId`/`ownerUid`/`actionTypeId`/`date`/`createdAt` fields itself).

There is no generic resolution path: an `actionTypeId` whose `handlerId` doesn't resolve to a registered handler is refused outright, the same way an unmet condition is (see "Abandoning the paliers system", [docs/ISSUE-02-ACTION-FRAMEWORK.md](ISSUE-02-ACTION-FRAMEWORK.md)).

Given an `actionTypeId`, `performAction`:
1. Rejects if the caller isn't authenticated, has no character with `alive == true`, or `actionTypeId` has no registered handler.
2. Loads the `actionType` document, calls the handler's `prepare(...)`.
3. In a Firestore transaction: re-reads the character, rejects if `lastActionDate` is already today (UTC), otherwise calls the handler's `resolve(...)` and writes the returned `updates` + a mirrored `actionsLog` entry.
4. Returns only `{ ok: true }` — deliberately not the roll result, since the outcome must stay hidden for 24h even from the player who just acted (see below).

The transaction is what actually prevents a double-action race (e.g. two tabs clicking at once) — the lock check and the write happen atomically. `rollWeighted`/`rarityFloor`/`RARITY_ORDER` (shared by `createCharacter`'s background roll and by quest handlers) live in `functions/src/lib/rolls.js`.

### Intermède-budget actions: bypassing the main lock

Some actions (docs/TODO.md "Intermède actions") are bonus actions, repeatable up to 3 times per Interval, independent of the character's one main action per Interval. `functions/src/lib/actionKinds.js`'s `actionUsesIntermedeBudget(kindId)` marks which kinds these are (today: `commerce`, the "Faire du commerce" sell handler); `runActionPipeline` (`functions/src/lib/actionPipeline.js`) checks it before touching the character document and, when true, skips both the once-per-Interval `isActionRunning` lock check and the `stampLifecycle` envelope that would otherwise overwrite `lastAction`/`completesAt` — the handler's `updates` land on the character document as-is. Availability is instead gated by the implicit `hasIntermedeBudget` condition (`functions/src/lib/actionConditions.js`), checked against `character.intermedeActionsThisInterval < 3` and incremented by the handler itself on success; the counter resets to 0 every Interval tick as a sibling pass inside `sweepQuestTriggers` (see below).

Since these actions never write `lastAction`, they have no result pop-up to surface their outcome through. `performAction` instead threads back whatever the handler's `resolve()` returns under a `response` key (`{ ok: true, response }`), and the client-side picker (`CommercePicker.jsx`) reads its confirmation directly off `performAction`'s own return value rather than off the character snapshot. `ActionBrowser.jsx`'s `budgetActionsOnly` mode lets `ActionPanel.jsx` keep offering these actions even while the character's main action is still counting down.

### `mission.js`: resolving a generated mission

Quests and "Partir en quête" are retired (docs/TODO.md "Retiring quests and quest objectives for the subject-action system"); `mission.js` is now the sole Aventure-branch content resolver. A mission is generated ahead of time by `recherche.js` into `character.missionJournal` (see docs/TODO.md "Regional mission generation and journal") — `mission.js`'s `prepare` just looks the chosen `payload.missionId` up in that journal and region-locks it (`mission.regionId` must match the character's current region).

`resolve` calls `functions/src/missionResolution.js`'s exported `resolveQuestOutcome` — the shared score-roll engine also used by `partirExplorer.js` (below) — passing a synthetic `{ tagIds, rarity }` objective stand-in built from the mission's own `tagIds` and its difficulty's rarity equivalence (`missionLoot.js`'s `difficultyToRarity`). Nothing is narrated — the generator was removed by "Narration removal" (docs/TODO.md) — so a mission's result pop-up shows only "Succès"/"Échec". Loot is drawn through `missionLoot.js`'s `drawMissionLoot` (resolved once per mission occurrence from its own `tagIds`/rarity, not re-rolled per item). The resolved mission (`id`, `name`, `difficulty`, `locationId`, `locationName`) is recorded on both `lastAction.mission` and the `actionsLog` entry, and the resolved entry is removed from `character.missionJournal`.

`drawQuestLoot` (`missionResolution.js`'s own default `drawLoot`, used when a caller doesn't override it) draws one loot table per item (count set by difficulty via `LOOT_COUNT_BY_DIFFICULTY`), among those sharing a tag with the resolution's own tags or a randomly-picked objective and matching that objective's rarity, then a uniform item draw within that table; items with no matching table/objective are silently skipped (a content gap, not an error).

### Composite quests: chained `worldData/questChains/items`

`worldData/questChains/items/{id}` (no creator UI, authored directly in the Firestore console) holds an ordered `steps: [{ monsterId, difficulty }]` array, step 1 first, plus the chain-level `rewardItemIds` / `rewardTalentIds` / `rewardReputation` / `rewardRegionId` paid out on its last step (contract only so far - `questChains.js` still reads the previous `subjectId` shape and pays no rewards, until docs/TODO.md "Quest chains on monsters") — ported from a `questIds: string[]` list of hand-authored quests by "Retiring quests and quest objectives for the subject-action system" (docs/TODO.md). Step 1 is just an ordinary mission draw, discoverable however missions normally are; a chain only starts mattering once step 1 resolves successfully. Logic lives in `functions/src/lib/questChains.js` (`findPendingChainStep`/`findChainAdvance`), shared by `recherche.js` (generation) and `mission.js` (advancement).

`recherche.js`'s `resolve` calls `findPendingChainStep({ character, chains })` before its normal mission-generation loop: it looks for a chain whose `character.questChainProgress[chainId]` names a step index beyond 0 whose `subjectId` is also present in `character.triggeredSubjectIds` (i.e. a step already granted but not yet resolved). If found, that step's `{ subjectId, difficulty }` pair claims one guaranteed slot of the batch — its Subject and difficulty are fixed, only the type-matched Action and variation are still drawn randomly — and the remaining slots draw normally. If more than one chain has a step pending, the earliest-granted one wins (earliest index in `triggeredSubjectIds`).

`mission.js`'s `resolve` calls `findChainAdvance({ subjectId: mission.subjectId, difficulty: mission.difficulty, chains })` after a successful resolution: if the resolved mission's `{ subjectId, difficulty }` pair belongs to a chain step, `character.questChainProgress[chainId]` is bumped to the next step index, and — unless it was the chain's last step — the next step's subject id is pushed into `character.triggeredSubjectIds` via the same `arrayUnion` convention `sweepQuestTriggers` uses for a normal trigger match (see below), reusing that entire reveal/notification pipeline for free. A failed step advances nothing, so the same step stays pending and is offered again next time. Progress is still bumped (with no next subject id to grant) when the *last* step succeeds, so a finished chain's final step stops being reported as pending.

### `partirExplorer.js`: multiple encounters in one action

A second, sibling Aventure-branch handler (`docs/TODO.md` "Aventure exploration mechanics") — not a replacement for `mission.js`, registered under its own `partirExplorer` handlerId. `prepare` draws one `worldData/adventureZones/items` entry at random from the character's region's `adventureZoneIds` (an empty list is a content gap, not a failure - the action still runs with `location: null`) and fetches the same catalogs `mission.js` already fetches.

`resolve` then calls `missionResolution.js`'s exported `resolveQuestOutcome` up to `actionType.encounterCount` times in a loop - the same shared score-roll engine, not a second one - each round against a synthetic, in-memory pseudo-quest built from the drawn location (`tagIds` from the location, a difficulty rolled independently per round from `actionType.questDifficultyWeights`) and a synthetic per-round `{ tagIds, rarity }` objective built the same way `mission.js` builds its own (`missionLoot.js`'s `difficultyToRarity`) - not drawn from the retired "objectif de quête" pool. Loot is drawn through `missionLoot.js`'s `drawMissionLoot`, same as `mission.js`. Each round threads its `nextTalents` and updated wound counters into the next round's `character` argument - a mid-run talent evolution or an accumulating wound genuinely changes the next round's threshold and wound math - and the loop stops immediately if a round's wound kills the character, leaving fewer than `encounterCount` rounds recorded. `lastAction` flattens `loot`/`talentEvolutions` across every round and adds a `rounds: [{ difficulty, score, threshold, success, wound, reputationGained }]` array plus a summed `totalReputationGained`; `ActionOutcome.jsx`'s "Rencontres" fieldset renders that array (the existing single-score "Résolution" fieldset stays gated on `lastAction.score != null`, so it never fires for this handler). A `fatigue` counter on `characters/{id}` increments by 1 per round actually resolved; nothing reads or recovers it yet.

## The `sweepQuestTriggers` scheduled Cloud Function

The first scheduled (non-request-triggered) Cloud Function in the project — every other mechanic (loot draw, talent evolution, mission generation, mission resolution) resolves lazily on a player action instead. Registered in `functions/src/index.ts` via `onSchedule({ schedule: "0 0,12 * * *", timeZone: "UTC" }, ...)`, so it ticks on fixed Interval boundaries (00:00 and 12:00 UTC) independent of any individual character's own `completesAt` clock.

Each tick calls `sweepQuestTriggers` (`functions/src/lib/questTriggers.js`): loads every `worldData/missionSubjects/items` document carrying a `trigger.conditions` array (see docs/TODO.md's "Quest triggers and end-of-action pop-up pages" and "Retiring quests and quest objectives for the subject-action system" for the rename from `worldData/quests/items`), and every living character, then for each character evaluates every not-yet-triggered Subject's `trigger.conditions` through the same `evaluateConditions` used to gate action availability (`functions/src/lib/actionConditions.js`). A match adds the Subject's id to `character.triggeredSubjectIds` (via `arrayUnion`, so a character never loses a Subject already granted, even if it later stops meeting the trigger). The instance-tag lookup that `hasInstanceTag` conditions need is only ever queried when at least one triggerable Subject actually uses that condition type, same "pay only when asked" guard as `actionContext.js`'s `buildConditionContext`. The same per-character loop also resets `character.intermedeActionsThisInterval` to 0 whenever it's nonzero (docs/TODO.md "Intermède actions") — a sibling pass sharing this tick rather than a second cron schedule.

A newly triggered Subject is not pushed to the client in any way — it is simply readable the next time the player's own `ActionResultDialog.jsx` opens, on a dedicated page (see "Quest result pop-up" pattern below and docs/TODO.md). There is no server-side "unseen" flag; the client tracks which triggered Subject ids it has already shown per character in `localStorage`, since `triggeredSubjectIds` itself is a permanent, ever-growing list.

## The 24-hour reveal delay

Design intent: submitting an action computes and commits the outcome immediately (so the anti-cheat properties above hold), but the *result* stays hidden behind an "En cours..." (in progress) status for 24 real hours, even for the player who triggered it — it's a narrative pacing choice, not a security one. `ActionPanel.jsx` computes `hoursSince(character.lastActionAt)` client-side and only renders the outcome and gains once that crosses 24h; before that, nothing but the action's label and "En cours..." is shown. Because this gate is purely a display decision (the data is already sitting in the character doc), gating it client-side is an accepted tradeoff — a player could theoretically peek early via devtools, but there's nothing to exploit gameplay-wise by doing so.

Note this is intentionally decoupled from the once-per-day *lock*, which remains based on the UTC calendar date (`lastActionDate`) as before — the two can drift apart by a few hours at the day boundary, which is fine.

## Granting the creator role

There is no in-app UI for this (deliberately — it's a one-time, high-privilege operation, and letting any authenticated write grant it would defeat the point of a custom claim). `functions/scripts/setCreatorRole.js` and `functions/scripts/seedWorldData.js` both use `firebase-admin` authenticated via Application Default Credentials (`gcloud auth application-default login`) rather than a downloaded service account key file — nothing extra to download, and nothing sensitive to remember to keep out of git. `setCreatorRole.js` takes either a uid or an email (it resolves the email via `auth.getUserByEmail`) and calls `auth.setCustomUserClaims(uid, { role: "creator" })`. The user must sign out/in afterward so the client fetches a fresh ID token carrying the new claim.

## Seeding world data

`functions/scripts/seedWorldData.js` populates example regions (with nested backgrounds) and a bare `Partir en quête` actionType document (a stale, pre-retirement fixture — see docs/TODO.md "Retiring quests and quest objectives for the subject-action system") — see the script for the exact shapes, or just use it as a one-time bootstrap and then manage everything through the creator dashboard's CRUD (see below) from that point on. It predates `handlerId`/`kindId` and isn't kept in step with them; a live action document is edited through `ActionsManager.jsx` instead.

## Creator dashboard (`CreatorDashboard.jsx`)

No longer a placeholder — it's a client-side CRUD UI, gated by `ProtectedRoute requireCreator` and by the same `worldData`/`characters`/`actionsLog` Firestore rules described above (writes to `worldData` require the creator custom claim; there's no Cloud Function in this path since, unlike player-facing rolls, there's no anti-cheat concern — the creator is the trusted party rules already gate). Several sections, switched locally (no sub-routing), including:

- **`RegionsManager.jsx`**: CRUD for `worldData/regions/items`, and per-region CRUD for the nested `backgrounds` subcollection (expand a region to manage its own background pool inline).
- **`OriginsManager.jsx`**: CRUD for `worldData/origins/items` — see the shape above. Its `regionIds` restriction, `talentIds`, and `startingItemIds` fields are picked via `MultiSelectModalField.jsx` (against `worldData/regions/items`, `worldData/talents/items`, and `worldData/objects/items` respectively); `profession` is a plain optional text field, and `reputationStart` a plain (possibly negative) number field. Not yet consumed by `CharacterCreation.jsx` or any Cloud Function — currently creator-only data entry.
- **`TalentsManager.jsx`**: CRUD for the global `worldData/talents/items` catalog (name, trainable flag, rarity, effect text, and a `trainerTypeId` single-select shown when trainable) — see [docs/TODO.md](TODO.md) for the full talent system design.
- **`ActionTypesManager.jsx`**: CRUD for `worldData/actionTypes/items`. The `tiers` array is edited via a structured per-tier form (not raw JSON) that toggles between "success" fields (gold/item/talent/reputation gains, legendary flag) and "failure" fields (wound vs. death consequence) depending on the tier's `success` checkbox — see `formToTier`/`tierToForm` for the mapping between form state and the Firestore shape documented above. The talent grant fields are a select over `worldData/talents/items` (populated live) plus a starting quality and a French circumstance string, mapping to the `tier.talentGain` shape above. LEGACY: a tier's optional `cible` select used to opt it into procedural `narrativeText` generation; `tiers` itself is inert (see the shape above) and the generator is gone ("Narration removal", docs/TODO.md).
- **`QuestLocationsManager.jsx`**: CRUD for `worldData/adventureZones/items` (name, description, and a `tagIds` multi-select against `worldData/tags/items`), displayed as "Lieux de quête" — a region's `adventureZoneIds` multi-select (`RegionsManager.jsx`) and a mission's `locationId` (drawn by `recherche.js`, not creator-authored) both draw from this same catalog.
- **`ObjectsManager.jsx`**: CRUD for `worldData/objects/items` — see the shape above. A general-purpose item catalog (name, description, rarity, tags), registered as the "Objets" tab under the "Personnages" group. The page follows the same filtered-list-plus-collapsible-creation-form layout as `QuestsManager.jsx`, filterable by rarity, tags, and a free-text search over name/description. This is the base component that future item specializations (weapon, armor, component, grimoire, currency, property deed, etc.) will build on via an `Instance` component (an object plus an acquisition date and a link to a character's inventory) — see [docs/TODO.md](TODO.md); neither `Instance` nor item-type-specific tags exist yet, a type is just a regular tag for now.
- **`TablesDeTirageManager.jsx`**: CRUD for `worldData/lootTables/items` — see the shape above. A loot table is a name, a rarity, tags, and a multi-select of `worldData/objects/items` (both catalogs picked via `MultiSelectModalField.jsx`), registered as the "Tables de tirage" tab under the "Personnages" group. Hovering a table in the list reveals "Modifier"/"Tirer" buttons instead of always-visible actions (the only manager with hover-reveal actions, since a third always-visible button would crowd the row); "Supprimer" lives in the edit form instead. "Tirer" calls `drawLootTableItemId` (`src/lib/lootTables.js` — uniform random pick over `itemIds`, exported standalone so any future consumer, e.g. quest resolution, can reuse the same draw logic) and shows the result in a popup, with the drawn object's name linking to `/creator?section=Objets&objectId={id}` — `ObjectsManager.jsx` watches for that `objectId` query param and auto-opens the matching object's edit form, then strips the param.
- **`RecettesManager.jsx`**: CRUD for `worldData/recettes/items` — see the shape above. A recipe is a name, a rarity, two independent tag picks against the same `worldData/tags/items` catalog (`categoryIds` and `tagIds`), and two `QuantitySelectField.jsx` pickers against `worldData/objects/items` (`ingredients` and `results`, each `{ objectId, qty }`), registered as the "Recettes" tab under the "Actions" group. The list is filterable (rarity, category, tags, free-text name/rarity via `matchesRecette`) the same way as other managers, plus a "Trier par" field/direction control (name, rarity, category, tags, ingredient count, result count) — the only manager with an explicit sort control, since every other list only filters.
- **`TagsManager.jsx`**: CRUD for the standalone `worldData/tags/items` label catalog (name only), alphabetically sorted, editable via a popup dialog (edit or delete). Deleting a tag first strips its id from every mission subject's, object's, loot table's, and recette's `tagIds` (and a recette's `categoryIds`, since it draws from the same catalog) — via a `tagIds`/`categoryIds` `array-contains` query against each collection — before deleting the tag doc, since `MissionSubjectsManager.jsx`, `ObjectsManager.jsx`, `TablesDeTirageManager.jsx`, and `RecettesManager.jsx` are the consumers that reference tag ids. `ObjectsManager.jsx` similarly strips a deleted object's id from every loot table's `itemIds` and every recette's `ingredients`/`results` entries before deleting the object (the latter can't use an `array-contains` query since each entry is a `{objectId, qty}` map, not a bare id, so it fetches all recettes and filters client-side instead).
- **`MultiSelectModalField.jsx`**: a shared, catalog-agnostic multi-select control — a `<dialog>` popup with a text-filtered checkbox list and selected-item chips, used wherever a form needs to pick several items out of a potentially large catalog. Its search behavior isn't hardcoded: a `matchesFilter(option, query)` prop decides what the popup's text filter actually matches against (defaults to a plain name match), and its trigger button label defaults to "Choisir" but can be overridden via `buttonLabel` (e.g. tags fields across several managers use "Ajouter tags"). Each catalog's own manager exports a matching function shaped for its data — `matchesMissionSubject` (`MissionSubjectsManager.jsx`, matches name or type), `matchesRegion` (`RegionsManager.jsx`, matches name or description), `matchesTalent` (`TalentsManager.jsx`), `matchesTag` (`TagsManager.jsx`), `matchesObject` (`ObjectsManager.jsx`, matches name/description/rarity), `matchesOrigin` (`OriginsManager.jsx`, matches name/description), `matchesRecette` (`RecettesManager.jsx`, matches name/rarity) — so any future `MultiSelectModalField` usage against that catalog reuses the same filter instead of redefining it.
- **`QuantitySelectField.jsx`**: like `MultiSelectModalField.jsx`, but each selected option carries a quantity — `entries: [{ objectId, qty }]` instead of a plain id array, with a number input on each chip (`onQtyChange`) alongside the remove button (`onToggle`, reused for both adding via the popup checkbox list and removing via the chip). Currently only used by `RecettesManager.jsx`'s `ingredients`/`results` fields.
- **`TrainerTypesManager.jsx`**: CRUD for `worldData/trainerTypes/items` (`name`, a `description` textarea, and a `locationId` single-select against `worldData/adventureZones/items`).
- **`CharactersOverview.jsx`**: lists every character (any `alive` state) and, on click, shows the full character sheet plus its complete `actionsLog` history. Reads all of `characters`/`actionsLog` unfiltered, which the rules permit for the creator role — see the `actionsLog` list-query note above for why a *player's own* history tab needs an `ownerUid` filter but the creator's doesn't (the rule's `isCreator()` branch doesn't depend on `resource.data`, so it authorizes any query shape once true).

## Procedural quest-result text — retired

Outcomes are no longer narrated. `functions/src/textGeneration.js`'s slot-based grammar engine, the `worldData/narrativeSubjects/items` / `worldData/verbPhrases/items` catalogs it read, and `TextGenerationManager.jsx` (the creator page that authored them) were all removed by "Narration removal" (docs/TODO.md, rework plan §3): a mission now takes its identity from the monster catalog instead, so the five-slot assembly had no consumer left. `narrativeText` survives as an always-`""` field on `lastAction`/`actionsLog` so entries written before the removal stay readable.

The design record is kept, unmaintained, under `docs/retired/`: [ISSUE-01-GRAMMAR-ENGINE.md](retired/ISSUE-01-GRAMMAR-ENGINE.md) (the engine's design), [NARRATIVE-GENERATION.md](retired/NARRATIVE-GENERATION.md) (the creator-facing authoring guide) and [TEST-SCENARIO-NARRATIVE.md](retired/TEST-SCENARIO-NARRATIVE.md) (its manual test scenario). The `narrative-poc/` feasibility harness was deleted outright.

## Front-end structure

```
src/
  lib/firebase.js            Firebase client SDK initialization (reads VITE_* env vars)
  context/AuthContext.jsx    subscribes to onAuthStateChanged, exposes { user, loading };
                             user.role is read from the ID token's custom claims
  components/
    ProtectedRoute.jsx       redirects to /login if signed out, or to / if requireCreator
                             is set and the user isn't a creator
    CharacterCreation.jsx    region picker -> name picker (with region-based suggestions) ->
                             calls createCharacter; shown whenever there's no living character
    CharacterBanner.jsx      name/title/reputation/legendLevel(if set)/age/profession
    CharacterTabs.jsx        the 9-tab left panel (inventory/talents/blessings/curses/wounds/
                             quest journal/history/world knowledge/messaging); several tabs
                             are empty-state stubs pending real content or features; talents
                             render as rarity-bordered rectangles with a hover tooltip
    ActionPanel.jsx          today's action buttons (if free to act) and/or yesterday's
                             action status with the 24h reveal gate described above
    creator/
      RegionsManager.jsx     regions + nested per-region backgrounds CRUD
      TalentsManager.jsx     global talent catalog CRUD (name/trainable/rarity/effect)
      CharactersOverview.jsx list of every character -> full sheet + history on click
  pages/
    Login.jsx, Signup.jsx    auth only; Signup no longer touches Firestore directly
    CharacterProfile.jsx     orchestrator: queries the living character, renders
                             CharacterCreation if none exists, else the banner+tabs+panel
    CreatorDashboard.jsx     section nav switching between the creator/ components above
```

`NavBar.jsx` renders a "Mon personnage" link always, an "Espace créateur" link only when `user.role === "creator"`, and sign-out — it's the only way to reach `/creator` or log out, and only shows once a user is signed in.

Routing uses React Router with `basename={import.meta.env.BASE_URL}` so it works under the `/Monkar/` subpath GitHub Pages serves from. `public/404.html` plus the inline script in `index.html` implement the standard GitHub Pages SPA fallback (redirect through a `?redirect=` query param) since GitHub Pages has no server-side rewrite rules for client-side routes like `/login`.

## Deployment

- **Front**: `.github/workflows/deploy.yml` builds with Vite on every push to `main` (base path derived from the repo name automatically) and publishes via GitHub's native Pages Actions (`configure-pages` / `upload-pages-artifact` / `deploy-pages`), not a `gh-pages` branch. Firebase config values are injected at build time from GitHub Actions secrets — see README for the exact list.
- **Backend**: Firestore rules and indexes deploy via `firebase deploy --only firestore:rules`; Cloud Functions via `firebase deploy --only functions`. Both are manual steps (not wired into CI) since backend changes are lower-frequency and the creator wants to review them before they go live.

Current deployed project: `monkar-rpg` (Firebase, Blaze plan — required for Cloud Functions, see "Alternatives" for why). Repo: `hchary/Monkar` (public — GitHub Pages Free-plan hosting is only available for public repos; private repos need a paid GitHub plan).

## Alternatives considered

**Skipping Cloud Functions entirely** (Firestore rules only, Spark/free plan, no billing needed): the daily lock still works reliably via `request.time` in rules. The random rolls (background at creation, each handler's own draw at every action) would have to be computed client-side and merely shape-validated by rules, which a technically inclined player could fake via devtools. Not implemented, since the project already has Cloud Functions running, but worth remembering as a no-cost fallback if the Blaze plan ever becomes undesirable.

**Cloudflare Workers / Supabase Edge Functions**: would keep fully server-side rolls without needing Firebase's Blaze plan (their free tiers generally don't require a card, though policies change — verify at signup). Not implemented; would mean keeping Firebase Auth + Firestore as-is and only moving `createCharacter`/`performAction`'s logic to HTTP endpoints on that other platform, called from the client instead of `httpsCallable`.

## Known gaps (as of this writing)

- The creator dashboard has CRUD for regions/backgrounds/talents only (the data the game actually consumes today). `actionTypes` has no CRUD UI (removed — out of scope for now) and, like factions, gods, and creatures, has to be created by hand in the Firestore console.
- `title`, `legendLevel` progression beyond the raw counter, `blessings`, `curses`, quest journal, world-knowledge lore, and messaging are all stubs — visually present (or, for messaging, not even that) but not wired to real game logic yet, by design (deferred until the underlying systems are designed).
- A resolved action has no prose recap at all since "Narration removal" (docs/TODO.md) — the result pop-up shows outcome, gains and losses only. No visual theme/styling pass yet.
