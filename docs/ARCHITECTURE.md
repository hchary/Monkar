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
  reputation: number                -- starts at background.reputationStart, +N per tier.reputationGain
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
  createdAt: server timestamp

actionsLog/{logId}                 -- permanent history, independent of lastAction
  characterId, ownerUid, actionTypeId, date
  success: boolean
  narrativeText: string
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

worldData/narrativeSubjects/items/{id}   -- procedural narrativeText generation, see below
  type: "groupe" | "individuel"
  article: "le" | "la" | "les" | "l'"    -- elided with a following "de" (du/de la/des/de l')
  nom: string                            -- French, e.g. "bandits", "chef des bandits"
  genre: "m" | "f"
  nombre: "singulier" | "pluriel"
  tags: [string]                         -- e.g. ["hostile", "humanoïde"]; "objectif de quête" is a
                                          -- reserved tag value that makes a subject show up as a
                                          -- quest objective (see QuestObjectivesManager.jsx below) —
                                          -- there is no separate questObjectives collection
  tagIds: [string]                       -- worldData/tags/items ids, set from the quest objective edit
                                          -- form; unrelated to the free-text `tags` above. Read by
                                          -- partirEnQuete.js when the subject acts as a quest objective:
                                          -- drawQuestLoot matches loot tables against it, and
                                          -- rollTalentEvolutions gates talent progress on it

worldData/verbPhrases/items/{id}     -- procedural narrativeText generation, see below
  resultat: "victoire" | "echec" | "partielle"   -- only "victoire" is produced today - quests
                                                  -- always succeed (see "Quest drawing" below), so
                                                  -- "echec"/"partielle" verb phrases are currently
                                                  -- unused, but authoring them costs nothing
  cible: "groupe" | "individuel" | "les_deux"
  slot: "opening" | "climax" | "talentGrowth"     -- which sentence of the generated paragraph this
                                                  -- phrase can fill; absent means "climax", so every
                                                  -- document written before slots existed is valid
                                                  -- action content with no migration
  talentChange: "evolution" | "unlock" | "les_deux"  -- "talentGrowth" slot only, optional (defaults
                                                  -- to "les_deux"): whether the phrase suits a talent
                                                  -- that improved, one that was just unlocked, or both
  template: string                       -- French, authored as an uncapitalized, unpunctuated clause
                                          -- (the engine presents it as a sentence, and reuses the
                                          -- climax mid-sentence in loot descriptions). Placeholders:
                                          -- {sujet}, {lieu}, {quete}, {talent}
  tags: [string]                         -- optional; the phrase is only eligible when *every* one of
                                          -- these is in the resolution's context tag set (enemy tags
                                          -- + quest tags + progressed-talent tags) - a subset match,
                                          -- not an overlap match, see below

worldData/tags/items/{id}          -- standalone label catalog, "Narration" creator tab (narrativeSubjects
  name: string                        and verbPhrases above still store their own free-text `tags`
                                       arrays, unrelated to this id-based catalog) -- referenced by id from
                                       worldData/quests/items and worldData/narrativeSubjects/items (both
                                       tagIds); deleting a tag strips its id from every quest and narrative
                                       subject that references it before deleting the tag doc itself

worldData/regions/items/{id}
  name: string
  nameSuggestions: [string]         -- shown to the player when naming their character

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
  favoredQuestIds: [string]        -- worldData/quests/items ids, purely informational for now
  trainerTypeId: string            -- worldData/trainerTypes/items id, only meaningful when trainable

worldData/trainerTypes/items/{id}
  name: string                     -- e.g. "Maître d'armes"
  description: string              -- free-text French description of the trainer, e.g. "Sage ermite"
  locationId: string               -- worldData/adventureZones/items id, where a character must be
                                    -- able to reach (via their region's adventureZoneIds) to train
                                    -- with this trainer type - see the "S'entraîner" action below

worldData/adventureZones/items/{id}   -- displayed as "Lieu(x) de quête" in the UI; the collection id
  name: string                        -- itself keeps its original name to avoid a data migration
  description: string                 -- referenced by both worldData/regions/items (adventureZoneIds,
                                       -- a region's available locations) and worldData/quests/items
                                       -- (locationId, a single quest's location)

worldData/quests/items/{id}
  name: string                 -- French, e.g. "Chasse aux bandits"
  objectiveIds: [string]       -- worldData/narrativeSubjects/items ids tagged "objectif de quête"
  difficulties: [string]       -- subset of "facile" | "moyen" | "difficile" | "tres_difficile" |
                                --   "epique" | "mythique" -- own scale, not the talent rarity enum above
  successPhraseIds: [string]   -- worldData/verbPhrases/items ids, resultat: "victoire"
  failurePhraseIds: [string]   -- worldData/verbPhrases/items ids, resultat: "echec"
  regionIds: [string]          -- worldData/regions/items ids
  locationId: string           -- worldData/adventureZones/items id
  tagIds: [string]             -- worldData/tags/items ids; creator-only, never shown to the player
  -- lootTableId: TBD -- quests don't reference a loot table yet, see docs/TODO.md

worldData/objects/items/{id}       -- general item catalog: weapons, armor, components, knowledge
  name: string                     -- tomes, magic items, currency, property deeds, etc.
  description: string
  rarity: string                   -- one of the 8-tier rarity enum shared with talents, above
  type: string                     -- one of the fixed OBJECT_TYPES enum (ObjectsManager.jsx):
                                    -- arme, armure, consommable, composant, ingredient, grimoire,
                                    -- parchemin, objet_magique, titre_propriete, vetement
  tagIds: [string]                 -- worldData/tags/items ids
  -- not yet consumed by any Cloud Function or linked to a character's inventory, see docs/TODO.md

worldData/lootTables/items/{id}    -- loot table catalog: a named, tagged pool of objects a quest
  name: string                     -- (or any future consumer) can draw from
  rarity: string                   -- one of the 8-tier rarity enum shared with talents, above
  tagIds: [string]                 -- worldData/tags/items ids
  itemIds: [string]                -- worldData/objects/items ids; draw is uniform over this list
                                    -- (see drawLootTableItemId, src/lib/lootTables.js)
  -- not yet referenced by worldData/quests/items.lootTableId, see docs/TODO.md

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

`performAction` (`functions/src/index.ts`) is a thin dispatcher, not a monolithic roller — each `actionTypeId` has its own handler module under `functions/src/actions/` (today: `partirEnQuete.js`; future actions like marchander/s'entraîner/voyager/explorer/travailler get their own module rather than being squeezed into one generic tier-roller, since their mechanics have little in common). A handler exports:

- `prepare({ db, character, actionType })` — async, runs **before** the transaction. Does any read-only setup specific to that action (e.g. drawing a quest, see below) and can `throw HttpsError` for a precondition that should block the action *without* consuming the daily lock (nothing has been written yet at this point).
- `resolve({ tx, db, character, actionType, today, context })` — runs **inside** the transaction, after the once-per-day lock re-check. Returns `{ updates, logFields }`: `updates` is the full `characters/{id}` patch (`lastActionDate`, `lastActionAt`, `lastAction`, plus whatever else the handler decides to write - gold/inventory/talents/reputation/legendLevel/alive/wound counters are all just fields a handler can choose to touch, not a shared mechanic every action goes through), `logFields` is the handler-specific subset merged into the `actionsLog` entry (the dispatcher adds the common `characterId`/`ownerUid`/`actionTypeId`/`date`/`createdAt` fields itself).

There is no generic resolution path: an `actionTypeId` whose `handlerId` doesn't resolve to a registered handler is refused outright, the same way an unmet condition is (see "Abandoning the paliers system", [docs/ISSUE-02-ACTION-FRAMEWORK.md](ISSUE-02-ACTION-FRAMEWORK.md)).

Given an `actionTypeId`, `performAction`:
1. Rejects if the caller isn't authenticated, has no character with `alive == true`, or `actionTypeId` has no registered handler.
2. Loads the `actionType` document, calls the handler's `prepare(...)`.
3. In a Firestore transaction: re-reads the character, rejects if `lastActionDate` is already today (UTC), otherwise calls the handler's `resolve(...)` and writes the returned `updates` + a mirrored `actionsLog` entry.
4. Returns only `{ ok: true }` — deliberately not the roll result, since the outcome must stay hidden for 24h even from the player who just acted (see below).

The transaction is what actually prevents a double-action race (e.g. two tabs clicking at once) — the lock check and the write happen atomically. `rollWeighted`/`rarityFloor`/`RARITY_ORDER` (shared by `createCharacter`'s background roll and by quest handlers) live in `functions/src/lib/rolls.js`.

### `partirEnQuete.js`: drawing a quest

`prepare` queries `worldData/quests/items` `where regionIds array-contains character.region.id` to get the region's full quest catalog. If it's empty, it throws `failed-precondition` with *"Aucune quête disponible dans la région, prenez le temps de vous reposer."* — the player isn't locked out for the day and can retry once the creator adds quests for that region.

Otherwise the quest is drawn **difficulty-first**: a difficulty is rolled against `actionType.questDifficultyWeights` (defaults to facile 55 / moyen 30 / difficile 10 / tres_difficile 4 / epique 1 when the field is absent), then a random quest whose `difficulties` includes that difficulty is picked from the region's catalog; if none matches, the difficulty is redrawn and the process repeats (capped at 50 attempts, after which it falls back to a uniform pick over the region's whole catalog — only reachable if the region's quests carry difficulties absent from the weight table). This makes harder quests rarer to encounter, not merely rarer to have been authored.

Once a quest is drawn, if `quest.locationId` is set its `worldData/adventureZones/items` name is resolved once for display. The quest then always concludes successfully — there is no more per-tier roll deciding gold, wounds, death, or reputation (see "Abandoning the paliers system", [docs/ISSUE-02-ACTION-FRAMEWORK.md](ISSUE-02-ACTION-FRAMEWORK.md)). What `resolve` still draws, **in this order**: any talent progression, via `rollTalentEvolutions`; a narration, via `generateNarrative` (see "Procedural quest-result text" below); and loot, via `drawQuestLoot` (below). The order matters and is not the historical one — the narration's closing sentence names the talent that progressed and is selected against that talent's own tags, so it can't be written before the talent roll; and the loot descriptions embed the narration's climax clause, so they can't be written before the narration. `narrateQuestSuccess` tries a randomly-ordered pair of target shapes (`cible: "individuel"` then `"groupe"`, or the reverse), with subjects limited to `quest.objectiveIds` before falling back to the global `narrativeSubjects` pool, and verb phrases limited to `quest.successPhraseIds` **per slot** before falling back to the global pool for that slot — so linking a single climax phrase to a quest doesn't also deprive it of every opening and talent flourish. If nothing matches either shape, `resolve` falls back to a fixed sentence (*"Vous revenez de votre quête."*) and a fixed loot clause. `prepare` additionally reads `worldData/tags/items` once, to resolve the quest's and the progressed talent's `tagIds` to the tag *names* the generator matches on. The drawn quest (`id`, `name`, `difficulty` — the one actually rolled, not the quest's full `difficulties` list — `locationId`, `locationName`) is recorded on both `lastAction.quest` and the `actionsLog` entry.

`drawQuestLoot` draws one loot table per item (count set by the quest's difficulty via `LOOT_COUNT_BY_DIFFICULTY`), among those sharing a tag with the quest or a randomly-picked objective and matching that objective's rarity, then a uniform item draw within that table; items with no matching table/objective are silently skipped (a content gap, not an error).

## The `sweepQuestTriggers` scheduled Cloud Function

The first scheduled (non-request-triggered) Cloud Function in the project — every other mechanic (loot draw, talent evolution, rumor harvest, mission generation, quest resolution) resolves lazily on a player action instead. Registered in `functions/src/index.ts` via `onSchedule({ schedule: "0 0,12 * * *", timeZone: "UTC" }, ...)`, so it ticks on fixed Interval boundaries (00:00 and 12:00 UTC) independent of any individual character's own `completesAt` clock.

Each tick calls `sweepQuestTriggers` (`functions/src/lib/questTriggers.js`): loads every `worldData/quests/items` document carrying a `trigger.conditions` array (see docs/TODO.md's "Quest triggers and end-of-action pop-up pages"), and every living character, then for each character evaluates every not-yet-triggered quest's `trigger.conditions` through the same `evaluateConditions` used to gate action availability (`functions/src/lib/actionConditions.js`). A match adds the quest's id to `character.triggeredQuestIds` (via `arrayUnion`, so a character never loses a quest already granted, even if it later stops meeting the trigger). The instance-tag lookup that `hasInstanceTag` conditions need is only ever queried when at least one triggerable quest actually uses that condition type, same "pay only when asked" guard as `actionContext.js`'s `buildConditionContext`.

A newly triggered quest is not pushed to the client in any way — it is simply readable the next time the player's own `ActionResultDialog.jsx` opens, on a dedicated page (see "Quest result pop-up" pattern below and docs/TODO.md). There is no server-side "unseen" flag; the client tracks which triggered quest ids it has already shown per character in `localStorage`, since `triggeredQuestIds` itself is a permanent, ever-growing list.

## The 24-hour reveal delay

Design intent: submitting an action computes and commits the outcome immediately (so the anti-cheat properties above hold), but the *result* stays hidden behind an "En cours..." (in progress) status for 24 real hours, even for the player who triggered it — it's a narrative pacing choice, not a security one. `ActionPanel.jsx` computes `hoursSince(character.lastActionAt)` client-side and only renders `narrativeText`/gains once that crosses 24h; before that, nothing but the action's label and "En cours..." is shown. Because this gate is purely a display decision (the data is already sitting in the character doc), gating it client-side is an accepted tradeoff — a player could theoretically peek early via devtools, but there's nothing to exploit gameplay-wise by doing so.

Note this is intentionally decoupled from the once-per-day *lock*, which remains based on the UTC calendar date (`lastActionDate`) as before — the two can drift apart by a few hours at the day boundary, which is fine.

## Granting the creator role

There is no in-app UI for this (deliberately — it's a one-time, high-privilege operation, and letting any authenticated write grant it would defeat the point of a custom claim). `functions/scripts/setCreatorRole.js` and `functions/scripts/seedWorldData.js` both use `firebase-admin` authenticated via Application Default Credentials (`gcloud auth application-default login`) rather than a downloaded service account key file — nothing extra to download, and nothing sensitive to remember to keep out of git. `setCreatorRole.js` takes either a uid or an email (it resolves the email via `auth.getUserByEmail`) and calls `auth.setCustomUserClaims(uid, { role: "creator" })`. The user must sign out/in afterward so the client fetches a fresh ID token carrying the new claim.

## Seeding world data

`functions/scripts/seedWorldData.js` populates example regions (with nested backgrounds) and a bare `Partir en quête` actionType document — see the script for the exact shapes, or just use it as a one-time bootstrap and then manage everything through the creator dashboard's CRUD (see below) from that point on. It predates `handlerId`/`kindId` and isn't kept in step with them; the live `partir-en-quete` document is edited through `ActionsManager.jsx` instead.

## Creator dashboard (`CreatorDashboard.jsx`)

No longer a placeholder — it's a client-side CRUD UI, gated by `ProtectedRoute requireCreator` and by the same `worldData`/`characters`/`actionsLog` Firestore rules described above (writes to `worldData` require the creator custom claim; there's no Cloud Function in this path since, unlike player-facing rolls, there's no anti-cheat concern — the creator is the trusted party rules already gate). Several sections, switched locally (no sub-routing), including:

- **`RegionsManager.jsx`**: CRUD for `worldData/regions/items`, and per-region CRUD for the nested `backgrounds` subcollection (expand a region to manage its own background pool inline).
- **`OriginsManager.jsx`**: CRUD for `worldData/origins/items` — see the shape above. Its `regionIds` restriction, `talentIds`, and `startingItemIds` fields are picked via `MultiSelectModalField.jsx` (against `worldData/regions/items`, `worldData/talents/items`, and `worldData/objects/items` respectively); `profession` is a plain optional text field, and `reputationStart` a plain (possibly negative) number field. Not yet consumed by `CharacterCreation.jsx` or any Cloud Function — currently creator-only data entry.
- **`TalentsManager.jsx`**: CRUD for the global `worldData/talents/items` catalog (name, trainable flag, rarity, effect text, a `favoredQuestIds` multi-select against `worldData/quests/items`, and a `trainerTypeId` single-select shown when trainable) — see [docs/TODO.md](TODO.md) for the full talent system design.
- **`ActionTypesManager.jsx`**: CRUD for `worldData/actionTypes/items`. The `tiers` array is edited via a structured per-tier form (not raw JSON) that toggles between "success" fields (gold/item/talent/reputation gains, legendary flag) and "failure" fields (wound vs. death consequence) depending on the tier's `success` checkbox — see `formToTier`/`tierToForm` for the mapping between form state and the Firestore shape documented above. The talent grant fields are a select over `worldData/talents/items` (populated live) plus a starting quality and a French circumstance string, mapping to the `tier.talentGain` shape above. A tier's optional `cible` select opts it into the procedural `narrativeText` generation described below instead of using the tier's own fixed text.
- **`TextGenerationManager.jsx`**: read/edit/delete for all of `worldData/narrativeSubjects/items` (grouped by `type` into collapsible, alphabetically sorted sections via the shared `NarrativeSubjectList.jsx`) plus full CRUD for `worldData/verbPhrases/items` (see "Procedural quest-result text" below). The verb-phrase form carries the narrative `slot` select (defaulting to `"climax"`, matching the storage default) and a `talentChange` select shown only for the `talentGrowth` slot; switching slot moves the `cible` default to `"les_deux"` for the non-climax slots, since most openings and flourishes don't name `{sujet}` and pinning them to one target shape would hide them half the time. The list is filterable by slot, and `matchesVerbPhrase` (also used by `QuestsManager.jsx`'s phrase pickers, which label each option with its slot) matches on the slot label too. Exports `NARRATIVE_SLOTS` and `slotLabel`. Creating a *new* narrative subject isn't done here — see `QuestObjectivesManager.jsx` below, currently the only type-specific creation entry point.
- **`QuestObjectivesManager.jsx`**: also reads/writes `worldData/narrativeSubjects/items` (via `NarrativeSubjectList.jsx`), filtered to those tagged `"objectif de quête"`; its create/edit form always sets that tag on submit. Quest objectives are a *type* of narrative subject, not a separate collection. Its form also has a `tagIds` field (against `worldData/tags/items`, alphabetically sorted, via `MultiSelectModalField.jsx`) — creator-only metadata with no gameplay effect, never shown to the player; `NarrativeSubjectList.jsx` displays the resolved tag names when passed a `tagsCatalog` prop (only this manager passes one).
- **`QuestLocationsManager.jsx`**: CRUD for `worldData/adventureZones/items` (name + description), displayed as "Lieux de quête" — a region's `adventureZoneIds` multi-select (`RegionsManager.jsx`) and a quest's `locationId` single-select (`QuestsManager.jsx`) both draw from this same catalog.
- **`QuestsManager.jsx`**: CRUD for `worldData/quests/items` — see the shape above. The page is a filtered list (filterable by quest objectives, difficulty levels, possible regions, and quest location, with a reset button) plus a collapsible "Nouvelle quête" form (closed by default, opened automatically when editing an existing quest). Whatever is currently selected in the list filters is applied as the default value of the matching creation-form fields, resyncing whenever the filters change (as long as no existing quest is being edited). Loot is deliberately not a field yet — see [docs/TODO.md](TODO.md). Its potentially large catalogs (objectives, phrases, regions, tags) are picked via `MultiSelectModalField.jsx` (see below) instead of an inline checkbox list. The `tagIds` field (against `worldData/tags/items`, alphabetically sorted) is creator-only metadata with no gameplay effect — never read by any player-facing or Cloud Function code.
- **`ObjectsManager.jsx`**: CRUD for `worldData/objects/items` — see the shape above. A general-purpose item catalog (name, description, rarity, tags), registered as the "Objets" tab under the "Personnages" group. The page follows the same filtered-list-plus-collapsible-creation-form layout as `QuestsManager.jsx`, filterable by rarity, tags, and a free-text search over name/description. This is the base component that future item specializations (weapon, armor, component, grimoire, currency, property deed, etc.) will build on via an `Instance` component (an object plus an acquisition date and a link to a character's inventory) — see [docs/TODO.md](TODO.md); neither `Instance` nor item-type-specific tags exist yet, a type is just a regular tag for now.
- **`TablesDeTirageManager.jsx`**: CRUD for `worldData/lootTables/items` — see the shape above. A loot table is a name, a rarity, tags, and a multi-select of `worldData/objects/items` (both catalogs picked via `MultiSelectModalField.jsx`), registered as the "Tables de tirage" tab under the "Personnages" group. Hovering a table in the list reveals "Modifier"/"Tirer" buttons instead of always-visible actions (the only manager with hover-reveal actions, since a third always-visible button would crowd the row); "Supprimer" lives in the edit form instead. "Tirer" calls `drawLootTableItemId` (`src/lib/lootTables.js` — uniform random pick over `itemIds`, exported standalone so any future consumer, e.g. quest resolution, can reuse the same draw logic) and shows the result in a popup, with the drawn object's name linking to `/creator?section=Objets&objectId={id}` — `ObjectsManager.jsx` watches for that `objectId` query param and auto-opens the matching object's edit form, then strips the param.
- **`RecettesManager.jsx`**: CRUD for `worldData/recettes/items` — see the shape above. A recipe is a name, a rarity, two independent tag picks against the same `worldData/tags/items` catalog (`categoryIds` and `tagIds`), and two `QuantitySelectField.jsx` pickers against `worldData/objects/items` (`ingredients` and `results`, each `{ objectId, qty }`), registered as the "Recettes" tab under the "Actions" group. The list is filterable (rarity, category, tags, free-text name/rarity via `matchesRecette`) the same way as other managers, plus a "Trier par" field/direction control (name, rarity, category, tags, ingredient count, result count) — the only manager with an explicit sort control, since every other list only filters.
- **`TagsManager.jsx`**: CRUD for the standalone `worldData/tags/items` label catalog (name only), alphabetically sorted, editable via a popup dialog (edit or delete). Deleting a tag first strips its id from every quest's, narrative subject's, object's, loot table's, and recette's `tagIds` (and a recette's `categoryIds`, since it draws from the same catalog) — via a `tagIds`/`categoryIds` `array-contains` query against each collection — before deleting the tag doc, since `QuestsManager.jsx`, `QuestObjectivesManager.jsx`, `ObjectsManager.jsx`, `TablesDeTirageManager.jsx`, and `RecettesManager.jsx` are the consumers that reference tag ids. `ObjectsManager.jsx` similarly strips a deleted object's id from every loot table's `itemIds` and every recette's `ingredients`/`results` entries before deleting the object (the latter can't use an `array-contains` query since each entry is a `{objectId, qty}` map, not a bare id, so it fetches all recettes and filters client-side instead).
- **`MultiSelectModalField.jsx`**: a shared, catalog-agnostic multi-select control — a `<dialog>` popup with a text-filtered checkbox list and selected-item chips, used wherever a form needs to pick several items out of a potentially large catalog. Its search behavior isn't hardcoded: a `matchesFilter(option, query)` prop decides what the popup's text filter actually matches against (defaults to a plain name match), and its trigger button label defaults to "Choisir" but can be overridden via `buttonLabel` (e.g. `QuestsManager.jsx`'s and `QuestObjectivesManager.jsx`'s tags fields use "Ajouter tags"). Each catalog's own manager exports a matching function shaped for its data — `matchesQuestObjective` (`QuestObjectivesManager.jsx`, matches name or tag), `matchesVerbPhrase` (`TextGenerationManager.jsx`, matches template text/cible/tag), `matchesRegion` (`RegionsManager.jsx`, matches name or description), `matchesQuest` (`QuestsManager.jsx`), `matchesTalent` (`TalentsManager.jsx`), `matchesTag` (`TagsManager.jsx`), `matchesObject` (`ObjectsManager.jsx`, matches name/description/rarity), `matchesOrigin` (`OriginsManager.jsx`, matches name/description), `matchesRecette` (`RecettesManager.jsx`, matches name/rarity) — so any future `MultiSelectModalField` usage against that catalog reuses the same filter instead of redefining it. `matchesQuest`/`matchesTalent` are exported ahead of any consumer, ready for e.g. `TalentsManager.jsx`'s `favoredQuestIds` field to switch over later.
- **`QuantitySelectField.jsx`**: like `MultiSelectModalField.jsx`, but each selected option carries a quantity — `entries: [{ objectId, qty }]` instead of a plain id array, with a number input on each chip (`onQtyChange`) alongside the remove button (`onToggle`, reused for both adding via the popup checkbox list and removing via the chip). Currently only used by `RecettesManager.jsx`'s `ingredients`/`results` fields.
- **`TrainerTypesManager.jsx`**: CRUD for `worldData/trainerTypes/items` (`name`, a `description` textarea, and a `locationId` single-select against `worldData/adventureZones/items`).
- **`CharactersOverview.jsx`**: lists every character (any `alive` state) and, on click, shows the full character sheet plus its complete `actionsLog` history. Reads all of `characters`/`actionsLog` unfiltered, which the rules permit for the creator role — see the `actionsLog` list-query note above for why a *player's own* history tab needs an `ownerUid` filter but the creator's doesn't (the rule's `isCreator()` branch doesn't depend on `resource.data`, so it authorizes any query shape once true).

## Procedural quest-result text

A handler can call `generateNarrative` (`functions/src/textGeneration.js`) to build a short **paragraph** — one sentence per narrative slot — out of the tagged content the creator authored. Creator-facing guide, including the authoring conventions: [docs/NARRATIVE-GENERATION.md](NARRATIVE-GENERATION.md). Feasibility analysis, quality review and a page of real generated output: [narrative-poc/](../narrative-poc/).

It takes a target shape (`cible: "groupe" | "individuel"`), an outcome (`"victoire" | "echec" | "partielle"`), the subject/verb-phrase pools the caller chooses to pass, and a `context` describing the resolution: `talentTags`, `questTags`, `talentChange`, `talentName`, `locationName`, `questName`.

1. **Context tag set.** The union of `context.talentTags` (the tags of the talent that progressed this resolution — *only* that one, not the character's whole sheet) and `context.questTags`, plus the tags of whichever subject is chosen in step 2.
2. **The climax and its subject are chosen as a pair.** Every (subject of the matching `type` × `slot: "climax"` verb phrase) combination is scored, and the most specific eligible pair wins (ties broken at random). Picking them independently per slot is what lets a paragraph open on one enemy and climax on another; picking the subject first discards the information a phrase's tags carry. If no pair is eligible, `generateNarrative` returns `null` and the caller keeps its own fallback text.
3. **The remaining slots** (`opening`, then `talentGrowth` — the latter only when `context.talentChange` is set) are filled against that same context, so every sentence talks about the same enemy. Neither is required: a missing one just shortens the paragraph.
4. **Eligibility, per slot.** A phrase qualifies when its `resultat` matches, its `cible` matches (`"les_deux"` matches either), **every** one of its `tags` is in the context tag set, and every placeholder it uses has a value. Among those, the phrase with the most tags wins — most specific, not merely overlapping. An untagged phrase is eligible in every context, which is what keeps a slot from coming up empty.
5. **Substitution.** `{sujet}` becomes the subject's `nom` prefixed by its `article`, contracted after "de" (`le` → `du`, `les` → `des`, `la` → `de la`, `l'` → `de l'`) by `contractDe`; an elided article is glued to its noun (`l'ours`, not `l' ours`). `{lieu}`, `{quete}` and `{talent}` come from the context. The past participle in these templates doesn't agree with a complement introduced by "de", so no further agreement logic is needed.
6. **Presentation.** The engine returns both `text` (the slots joined, each capitalized and terminated) and `clause` (the climax alone, left as authored, for callers that embed the accomplishment mid-sentence — see `drawQuestLoot` below). Phrases are therefore authored as uncapitalized, unpunctuated clauses.

The subset rule in step 4 is a **behavior change** from the single-sentence generator it replaces, which kept a subject sharing *at least one* tag with the verb phrase. That looser rule silently produces wrong-flavor text once a slot draws on more than one tag source — a caravan-escort quest tagged `protection` matching an opening authored for `protection` + `village`, and announcing a village that isn't in the quest. See [narrative-poc/report.md](../narrative-poc/report.md) § 2.1, and `functions/src/textGeneration.test.js`'s named regression test for it.

The `resultat: "echec"`/`"partielle"` values are accepted and filtered on uniformly, but currently unproduced: `partirEnQuete.js` is the only caller today and only ever asks for `"victoire"`, since a quest always concludes successfully (see "Abandoning the paliers system", [docs/ISSUE-02-ACTION-FRAMEWORK.md](ISSUE-02-ACTION-FRAMEWORK.md)).

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
      TextGenerationManager.jsx narrativeSubjects + verbPhrases CRUD for procedural narrativeText
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
- Procedural `narrativeText` generation (see "Procedural quest-result text" above) is only ever asked for the `"victoire"` outcome today, since quests always succeed. Authoring guidance for it lives in [docs/NARRATIVE-GENERATION.md](NARRATIVE-GENERATION.md); there is no in-app preview of what a given catalog generates yet — `narrative-poc/demo.js` is that tool without a UI. No visual theme/styling pass yet.
