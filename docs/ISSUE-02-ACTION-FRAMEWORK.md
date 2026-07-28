# Issue 02 — Modular action framework

Status: **not implemented** (analysis, architecture, and implementation plan only).

Today "Partir en quête" is the only real action in the game, and it is hardcoded end to end: a
handler module keyed by its own id in the Cloud Function, a flat button list in the UI, and a
quest-specific result pop-up. This document analyses what actually blocks adding a second
action, proposes a framework that makes "add an action" mostly a content-authoring task, and
lays out a phased plan for the agent that implements it.

**Nothing here asks for the example actions themselves to be built.** Repos, Marchander,
S'entraîner, Forger, Pêcher and friends are used throughout only to pressure-test the design —
implementing them is explicitly a non-goal (see [Non-goals](#non-goals)).

---

## 1. Target rules (the spec this design answers)

Restated from the feature request, since every design decision below traces back to one of
these:

| # | Rule |
|---|------|
| R1 | One action per day, per character. |
| R2 | An action completes 24 h after it is started. |
| R3 | When an action completes, a result pop-up opens — at completion time if the player is connected, otherwise at their next connection. |
| R4 | Which actions a player can access is decided per action by its own conditions (talent owned, profession, reputation level, …). |
| R5 | Actions belong to categories: Aventure, Intermède, Métier, Social. |
| R6 | Actions must be modifiable by other game elements (talents, instances). |
| R7 | Available actions are shown in the right-hand frame of the player screen. |
| R8 | In that frame, the first level of tabs is the categories; each category holds its own actions. |
| R9 | An action's tab shows, for now, a single "Commencer" button. |
| R10 | Once "Commencer" is pressed, the action frame is replaced by a 24 h countdown, colored by the quest's difficulty color, with a border in the same style as the rest of the UI. |

---

## 2. Analysis of the current state

References are to files at the tip of `main` when this was written.

### 2.1 What exists today

- **`functions/src/index.js`** — `performAction` is already a dispatcher rather than a monolith:
  it handles auth, character lookup, the daily lock, the transaction, and `actionsLog` writing,
  then delegates to a per-action handler exposing `prepare()` / `resolve()`.
- **`functions/src/actions/partirEnQuete.js`** — the one handler: draws a quest, rolls a tier,
  generates narrative text, draws loot, and writes the character patch.
- **`functions/src/index.js` → `claimQuestLoot`** — a second callable that materialises the
  drafted loot into `instances/{id}` documents when the player closes the result pop-up.
- **`src/components/ActionPanel.jsx`** — subscribes to `worldData/actionTypes/items`, renders one
  button per action type, then renders the previous action's status behind a client-side 24 h
  reveal gate, plus the quest result `<dialog>`.
- **`worldData/actionTypes/items/{id}`** — `label` + `tiers[]` (+ `questDifficultyWeights` for the
  quest action). No creator UI: authored by hand in the Firestore console.

The dispatcher shape is genuinely good and this design keeps it. What is missing is everything
*around* it.

### 2.2 Findings

**F1 — The only extension point is code, even for actions that need none.**
`ACTION_HANDLERS` (`functions/src/index.js:18`) maps `actionTypeId` → module, so every new action
needs a new module and a functions deploy. Yet the generic part — roll a weighted tier, then
apply `goldGain` / `itemGain` / `talentGain` / `reputationGain` / `legendary` / `consequence` — is
not shared: it is inlined at the bottom of `partirEnQuete.resolve()`
(`functions/src/actions/partirEnQuete.js:180-215`). An action like "Se reposer" needs *none* of
the quest logic and *all* of that generic logic, and today has no way to get it without
copy-paste.

**F2 — `ActionPanel.jsx` renders every action type unconditionally.**
`actionTypes.map(...)` (`src/components/ActionPanel.jsx:89`) has no notion of category, ordering,
availability, or description. An action type document with no registered handler is still
rendered as a clickable button and fails with `invalid-argument` after the click — the UI has no
way to know which actions the backend can actually run.

**F3 — There is no creator UI for action types.**
`ActionTypesManager.jsx` was removed (recorded as a known gap in
[docs/ARCHITECTURE.md](ARCHITECTURE.md)); action types are hand-edited in the Firestore console.
A framework whose whole point is "an action is mostly data" is unusable without that UI coming
back, so it is part of this feature, not a follow-up.

**F4 — The completion pop-up is quest-specific in three coupled places.**
The render guard (`revealed && lastAction?.quest && !lastAction?.lootClaimed`), the dialog body
(quest name, "Butin obtenu" fieldset), and the callable it invokes (`claimQuestLoot`) are all
tied to quests. R3 is therefore not a markup change: the *acknowledgement mechanism* has to be
generalised, and the per-action side effect it commits (loot, for quests) has to become a hook.

**F5 — Two different clocks govern what R1 and R2 describe as one mechanism.**
The daily lock is the UTC calendar date (`lastActionDate`, checked server-side inside the
transaction); the reveal is `lastActionAt + 24 h`, computed client-side
(`src/components/ActionPanel.jsx:33`). They drift by design today, which is documented and was
fine when the result was just a collapsible panel. It stops being fine under R10: an action
started at 23:00 UTC unlocks at 00:00 UTC — one hour later — while its own countdown still has
23 h to run, so the panel would have to show a countdown *and* an action browser at the same
time. **Unifying both rules on a single `completesAt` instant is a prerequisite for the
countdown UI, not a nice-to-have.**

**F6 — Nothing re-renders when the deadline passes.**
`revealed` is derived from `Date.now()` at render time with no timer anywhere, so a player
sitting on the page at T+24 h keeps seeing "En cours…" until they reload. R3's "at completion
time if connected" is not satisfiable without a ticking clock — and the countdown component R10
asks for is exactly that clock, so it must drive the state transition, not merely display it.

**F7 — `claimQuestLoot` does not check the 24 h delay.**
It verifies `lastAction.quest` and `lastAction.lootClaimed` only, so a client can call it
straight after acting and materialise the loot instances before the reveal. Impact today is
small (the loot is already decided and the reveal gate is explicitly a display choice), but the
generic replacement should gate on `completesAt` — it costs one comparison.

**F8 — There is no shared-code path between `src/` and `functions/`.**
`functions/` is CommonJS with no build step; `functions/src/lib/loot.js` documents duplicating
`src/lib/lootTables.js` for precisely this reason. R4's conditions must be evaluated on both
sides — client to decide what to display, server to authorise — so the established repo answer
applies: a small, pure, deliberately-duplicated module pair with cross-referencing comments, not
a new shared package or build step.

**F9 — There is no test runner in either workspace.**
Neither `package.json` nor `functions/package.json` declares a `test` script or a test
dependency. The condition evaluator and the modifier pipeline are pure functions with
combinatorial behaviour and fail-closed semantics — exactly what needs tests. Node 20's built-in
`node --test` covers `functions/` with zero added dependencies.

**F10 — "Métier" as a condition input only half-exists.**
`character.profession` is a plain denormalized string copied from the rolled background
(`functions/src/index.js:56`); there is no profession catalog, as the feature request itself
notes. A `profession` condition can match that string today, but must be specified so it can
become an id match later without rewriting authored content.

**F11 — The modifier sources named by R6 have nowhere to declare a modifier.**
`worldData/talents/items` has `tagIds` but it is creator-only metadata with no gameplay effect;
`instances/{id}` documents are only read by the inventory tab. Neither collection has a field
where "this element changes action X" could be written, so R6 needs a new declared shape, not
just new reader code.

**F12 — The right-hand frame is narrow and collapses on mobile.**
`.character-layout` is a `2fr 1fr` grid that becomes a single column under 720 px
(`src/index.css:119-130`). Two nested tab rows (4 categories, then N actions) plus a countdown
have to survive that width — the wrapping `.tab-list` treatment already used by
`.character-tabs` is the pattern to reuse.

**F13 — The difficulty colors are selector-locked to `.last-action`.**
`.last-action.difficulty-epique::after` (the animated shine) and
`.last-action.difficulty-mythique` (the gradient border), plus the four plain-color tiers, are
all scoped under `.last-action` (`src/index.css:436-488`). R10 wants that exact treatment on the
countdown, so those rules need extracting into a reusable class before a second consumer exists,
rather than being duplicated.

### 2.3 Inherited constraints the design must respect

- **Server-side authority for anything rollable.** The reason Cloud Functions exist at all
  ([docs/ARCHITECTURE.md](ARCHITECTURE.md)). Conditions and modifiers therefore get evaluated
  client-side *for display only*; the server re-evaluates and is the authority.
- **Denormalize-at-grant-time.** `character.background`, `character.talents`, and
  `lastAction.loot` all copy catalog fields at write time so later catalog edits don't rewrite
  history. The action framework follows the same convention (`lastAction` carries the action's
  `label`/`categoryId`).
- **Small fixed enums live in JS, not Firestore.** `DIFFICULTIES` (`QuestsManager.jsx`),
  `RARITIES` (`TalentsManager.jsx`), `OBJECT_TYPES` (`ObjectsManager.jsx`) are all exported
  constants. The four action categories follow suit (see [§5](#5-decisions-taken), D6).
- **Read-time defaults instead of migrations.** The quest-difficulty rename and
  [docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md)'s `slot` field both avoid
  backfills by defaulting at read time. Every new field below does the same, so no migration
  script is needed anywhere in this feature.

---

## 3. Proposed architecture

### 3.1 Layers

```
┌────────────────────────────────────────────────────────────────────┐
│ L5  Presentation      ActionPanel (state machine)                  │
│                       ├─ ActionBrowser   (category tabs → actions) │
│                       ├─ ActionCountdown (ticks, drives L4)        │
│                       └─ ActionResultDialog (generic pop-up)       │
├────────────────────────────────────────────────────────────────────┤
│ L4  Lifecycle         idle → running → completed → acknowledged    │
│                       single source of truth: lastAction.completesAt│
├────────────────────────────────────────────────────────────────────┤
│ L3  Resolution        performAction → pipeline → generic tier roll  │
│                       + optional handler override + commit() hook   │
├────────────────────────────────────────────────────────────────────┤
│ L2  Modifiers         talents / objects declare actionModifiers[]   │
│                       applied at 3 named hooks                      │
├────────────────────────────────────────────────────────────────────┤
│ L1  Availability      pure evaluateConditions(), duplicated         │
│                       src/lib ⇄ functions/src/lib (see F8)          │
├────────────────────────────────────────────────────────────────────┤
│ L0  Catalog           worldData/actionTypes/items + ActionsManager  │
└────────────────────────────────────────────────────────────────────┘
```

The load-bearing idea is **L3's default path**: an action whose mechanics are "roll a weighted
tier and apply its gains" needs no code at all. A code handler becomes an escape hatch for
actions with bespoke mechanics (drawing a quest, picking a trainer, choosing a recipe), not the
entry fee for existing.

### 3.2 Catalog: `worldData/actionTypes/items/{id}`

```
worldData/actionTypes/items/{id}
  label: string                  -- French, e.g. "Partir en quête"          [existing]
  tiers: [ ... ]                 -- unchanged, see docs/ARCHITECTURE.md     [existing]
  questDifficultyWeights: [ ... ]-- handler-specific, unchanged             [existing]

  categoryId: string             -- "aventure"|"intermede"|"metier"|"social"   [NEW]
  description: string            -- French, shown on the action's tab          [NEW]
  order: number                  -- sort within its category, default 0        [NEW]
  enabled: boolean               -- authoring kill switch, default true        [NEW]
  handlerId: string | null       -- functions/src/actions/ module key;          [NEW]
                                 --   null/absent = generic tier roller
  durationHours: number          -- default 24                                 [NEW]
  availability: {                                                              [NEW]
    conditions: Condition[]      -- ANDed; [] = always available
    unmetBehaviour: "hide" | "disable"   -- default "hide"
    unmetMessage: string         -- French, shown when "disable"
  }
  result: {                                                                    [NEW]
    accentSource: "difficulty" | "category"   -- default "category"
    showLoot: boolean                          -- default false
  }
```

Every new field has a read-time default, so the single existing `partir-en-quete` document keeps
working untouched; it only needs `categoryId: "aventure"`, `handlerId: "partirEnQuete"`, and
`result.accentSource: "difficulty"` set to gain the new behaviour, which the creator UI
(§3.8) can do by hand.

`handlerId` is deliberately **not** the document id: keying `ACTION_HANDLERS` by `handlerId`
lets two action documents share one handler (e.g. two differently-tuned quest actions) and lets
an action be renamed without touching code.

### 3.3 L1 — Availability conditions

A condition is a tagged object; an action's conditions are ANDed. This stays a closed set of
typed predicates rather than an expression language: it is authorable in a form, serialisable,
and testable, and every predicate can be checked identically on both sides.

```
Condition =
  | { type: "hasTalent",      talentId: string, minQuality?: number }
  | { type: "hasTalentTag",   tagId: string,    minQuality?: number }
  | { type: "minReputation",  value: number }
  | { type: "minLegendLevel", value: number }
  | { type: "profession",     values: string[] }     -- see F10
  | { type: "region",         regionIds: string[] }
  | { type: "hasInstanceTag", tagId: string }
  | { type: "notWounded" }
```

Evaluator, duplicated in `src/lib/actionConditions.js` and
`functions/src/lib/actionConditions.js` (see F8), each carrying a comment pointing at the other:

```js
evaluateConditions(conditions, ctx) -> { ok: boolean, reason: string | null }
conditionsNeedInstances(conditions) -> boolean
```

- `ctx` is `{ character, instanceTagIds: Set<string> }`.
- `reason` is French player-facing text (the `unmetMessage`, or a per-type default), and is only
  surfaced when `unmetBehaviour === "disable"`.
- **Unknown `type` fails closed** (`ok: false`). A document authored against a schema newer than
  the deployed evaluator must hide the action, never grant it — and because both sides fail
  closed identically, a client running stale JS can't see an action the server would refuse.
- `instanceTagIds` is only assembled when `conditionsNeedInstances(...)` is true, so the common
  case (no instance condition) costs zero extra Firestore reads on either side.

`hasTalentTag` needs `worldData/talents/items/{id}.tagIds` resolved for the character's granted
talents. `character.talents[]` denormalizes the talent's fields at grant time but **not** its
`tagIds`; rather than adding a read, the implementer should extend the grant-time copy in
`partirEnQuete.js` to include `tagIds` (harmless, additive) and have `hasTalentTag` read
`character.talents[].tagIds ?? []` — already-granted talents simply won't match until re-granted,
which is acceptable for a field nothing consumes yet.

### 3.4 L2 — Modifiers

R6's "modifiable by other game elements". Sources declare, the pipeline applies:

```
worldData/talents/items/{id}.actionModifiers: Modifier[]   [NEW]
worldData/objects/items/{id}.actionModifiers: Modifier[]   [NEW]   -- via owned instances

Modifier = {
  scope: { actionTypeId?: string, categoryId?: string },  -- both absent = every action
  hook: "tierWeight" | "duration" | "reward",
  -- hook === "tierWeight": { tierName: string, multiplier: number }
  -- hook === "duration":   { hoursDelta: number }
  -- hook === "reward":     { field: "goldGain" | "reputationGain", multiplier: number }
}
```

`functions/src/lib/actionModifiers.js`:

```js
collectModifiers({ character, actionType, talentCatalog, ownedObjects }) -> Modifier[]
applyTierWeights(tiers, modifiers) -> tiers       // returns a copy, never mutates
applyDuration(durationHours, modifiers) -> number // clamped to >= 1
applyRewards(tier, modifiers) -> tier             // returns a copy
```

Rules that keep this deterministic and debuggable:

- **Multipliers multiply, deltas sum.** Both are commutative, so collection order can't change
  the outcome — no priority field, no "last writer wins" surprises.
- **Pure and copy-returning.** `actionType.tiers` is a Firestore-loaded object; mutating it in
  place would leak between hooks.
- **Three hooks only, on purpose.** A general expression engine is unbounded and untestable at
  this stage. `tierWeight` covers "this talent makes you likelier to succeed", `duration` covers
  "this item makes the action faster", `reward` covers "this talent earns you more gold". A
  fourth hook is a small, well-understood change once a concrete need appears.
- **Availability is deliberately *not* a modifier hook.** "This talent unlocks this action" is
  already expressible as a `hasTalent` condition on the action itself, and keeping unlock rules
  in exactly one place is worth more than the symmetry.

Modifiers are server-side only. The client never applies them — it would have to duplicate the
whole pipeline for no user-visible gain, and the numbers stay hidden behind the 24 h reveal
anyway.

### 3.5 L3 — Resolution pipeline

New module `functions/src/lib/actionPipeline.js`, called by `performAction`:

```
 1. load actionType, reject if missing or enabled === false
 2. resolve handler = ACTION_HANDLERS[actionType.handlerId] ?? null
 3. evaluateConditions(actionType.availability.conditions, ctx)   ← server authority
 4. collectModifiers(...)
 5. handler?.prepare({ db, character, actionType, modifiers })    ← outside the transaction,
                                                                     may throw failed-precondition
                                                                     without consuming the lock
 ── transaction ──────────────────────────────────────────────────
 6. re-read character; reject if now < lastAction.completesAt      ← the lock (R1 + R2)
 7. tier = rollWeighted(applyTierWeights(actionType.tiers, modifiers))
 8. tier = applyRewards(tier, modifiers)
 9. { updates, logFields } = handler?.resolve({ ..., tier, modifiers })
                             ?? genericResolve({ ..., tier, modifiers })
10. tx.update(character, updates); tx.set(actionsLog, { ...common, ...logFields })
```

The handler interface becomes fully optional, plus one new hook:

```js
module.exports = {
  prepare?  ({ db, character, actionType, modifiers }) -> context,
  resolve?  ({ tx, db, character, actionType, today, context, tier, modifiers })
              -> { updates, logFields },
  commit?   ({ tx, db, character, lastAction, uid })   // NEW — runs on acknowledgeAction
};
```

`genericResolve` and `applyTierEffects` (extracted verbatim from
`partirEnQuete.js:180-215`) live in `functions/src/lib/actionEffects.js` and are shared by both
paths — the extraction is a pure refactor and should land first, before anything else changes
(see Phase 0).

`partirEnQuete.js` keeps `prepare`/`resolve` and **gains a `commit()`** holding the loot-instance
creation currently inlined in `claimQuestLoot`.

### 3.6 L4 — Lifecycle and timing

The whole of R1/R2/R3/R10 reduces to one instant on the character document.

```
characters/{characterId}
  lastAction: {
    actionTypeId, date, tierName, success, narrativeText, goldGain,
    itemGain, talentGain, reputationGain, legendary, consequence,
    quest, loot                       -- all unchanged

    label: string                     -- NEW, denormalized for the countdown header
    categoryId: string                -- NEW, denormalized for the accent fallback
    startedAt: Timestamp              -- NEW
    completesAt: Timestamp            -- NEW ← the single source of truth
    accent: { kind: "difficulty" | "category", value: string } | null   -- NEW
    acknowledged: boolean             -- NEW, replaces lootClaimed
  }
  lastActionAt: Timestamp    -- kept, equals lastAction.startedAt
  lastActionDate: string     -- kept: still written, still mirrored into actionsLog.date and
                             --   the history tab; NO LONGER the lock
```

**Implementation detail that will otherwise bite:** `FieldValue.serverTimestamp()` is a write
sentinel and cannot be offset, so `completesAt` cannot be derived from it. Compute both with the
Admin SDK clock inside the function:

```js
const startedAt = Timestamp.now();
const completesAt = Timestamp.fromMillis(startedAt.toMillis() + durationHours * 3600 * 1000);
```

Keep `lastActionAt: FieldValue.serverTimestamp()` as it is; sub-second drift between the
function's clock and Firestore's is irrelevant here.

**Lock change (behaviour change — call this out at review).** The transaction check moves from
`freshCharacter.lastActionDate === today` to `now < freshCharacter.lastAction?.completesAt`.
Under today's rule an action started at 23:00 UTC unlocks one hour later; under the new rule it
unlocks a full 24 h later. That is what R1 + R2 describe, and it is the only way the countdown in
R10 can be the panel's sole content while an action runs.

**Client state machine** (`ActionPanel.jsx`), derived from one `now` that ticks every second:

| Condition | State | Renders |
|---|---|---|
| `!lastAction` | `browse` | `ActionBrowser` |
| `now < completesAt` | `running` | `ActionCountdown` (replaces the frame's contents, R10) |
| `now >= completesAt && !acknowledged` | `completed` | `ActionResultDialog` (modal, R3) |
| `now >= completesAt && acknowledged` | `browse` | `ActionBrowser` + the existing recap below |

R3's "or at their next connection" falls out for free: `acknowledged` is persisted, so the
`completed` state is re-entered on load until the player closes the dialog. R3's "at completion
time if connected" falls out of the ticking `now`, which fixes F6 by construction rather than by
adding a second timer.

`acknowledgeAction` (generic callable, replaces `claimQuestLoot`):

1. reject if there is no `lastAction`;
2. reject if `now < lastAction.completesAt` (closes F7);
3. return early if `lastAction.acknowledged` (idempotent, as `claimQuestLoot` already is);
4. run `handler?.commit({ tx, db, character, lastAction, uid })` — for quests, this creates the
   `instances/{id}` documents;
5. set `lastAction.acknowledged = true`.

**Backward compatibility:** live characters may carry `lastAction.lootClaimed`. The client reads
`lastAction.acknowledged ?? lastAction.lootClaimed ?? false` for one release, then the fallback
is dropped. Characters with a `lastAction` but no `completesAt` are treated as completed
(`completesAt ?? lastActionAt + 24 h`), so nobody gets stuck behind an infinite countdown.

**Rollout order matters:** the front deploys automatically on push to `main`, functions deploy
manually. Deploy the functions *before* merging the front-end phases, or a freshly deployed
client will call an `acknowledgeAction` callable that does not exist yet.

The `[TEST] Avancer le temps d'un jour` button in `ActionPanel.jsx` currently nulls
`lastActionDate`/`lastActionAt`; it must instead backdate `lastAction.completesAt` (and
`lastAction.startedAt`) by 24 h, otherwise it silently stops working under the new lock.

### 3.7 L5 — Player-facing UI

```
src/components/ActionPanel.jsx                  state machine + ticking clock
src/components/actions/ActionBrowser.jsx        category tabs → action tabs → detail + "Commencer"
src/components/actions/ActionCountdown.jsx      HH:MM:SS, accent frame, onComplete callback
src/components/actions/ActionResultDialog.jsx   generic result pop-up
src/lib/actionCategories.js                     ACTION_CATEGORIES enum
src/lib/actionConditions.js                     pure evaluator (mirror of functions/src/lib/)
```

**`ACTION_CATEGORIES`** — a JS constant, following `DIFFICULTIES`/`RARITIES`/`OBJECT_TYPES`:

```js
export const ACTION_CATEGORIES = [
  { value: "aventure",  label: "Aventure"  },
  { value: "intermede", label: "Intermède" },
  { value: "metier",    label: "Métier"    },
  { value: "social",    label: "Social"    },
];
```

**`ActionBrowser`** (R7/R8/R9): two nested tab rows reusing the existing `.tab-list` /
`.tab-content` styling from `.character-tabs` (wrapping flex, so F12's narrow column is fine).
Row 1 = categories, row 2 = that category's available actions sorted by `order` then `label`,
content = the action's `description` plus a "Commencer" button. Behaviour worth specifying:

- A category with zero available actions is still shown, with an empty state — a disappearing tab
  row is more disorienting than an empty tab, and the categories are a fixed vocabulary.
- Actions whose conditions fail are hidden or shown disabled with `unmetMessage`, per the
  action's own `unmetBehaviour`.
- Actions whose `handlerId` names no registered handler are hidden (fixes F2's dead buttons).
  Since the client cannot know the server's registry, expose it as a small exported constant
  mirrored client-side, or — simpler and preferred — treat `enabled: false` as the authoring
  answer and have the creator UI warn on an unknown `handlerId` (§3.8).
- The default selected category is the first one with at least one available action.

**`ActionCountdown`** (R10): replaces the panel's contents entirely while `running`. Shows the
action label and a `HH:MM:SS` remaining, ticking once per second, and calls `onComplete` when it
reaches zero so `ActionPanel` transitions to `completed` without a reload. Framed with
`clip-path: var(--pixel-frame)` and a 2 px border like the rest of the UI.

**Accent color:** `lastAction.accent` is written server-side at resolution time. For quests
`{ kind: "difficulty", value: quest.difficulty }`, otherwise
`{ kind: "category", value: categoryId }`. The countdown applies
`difficulty-frame difficulty-{value}` or `category-frame category-{value}`.

This means the difficulty is visible *before* the result is revealed — which is already true
today (`.last-action.difficulty-*` is applied regardless of `revealed`,
`src/components/ActionPanel.jsx:100`), so it is a continuation of existing behaviour, not a new
leak. Worth a one-line note in the PR so it is a decision, not an accident.

**CSS refactor (F13):** extract `.last-action.difficulty-*` (the four plain colors, the `epique`
shine `::after` + `@keyframes`, and the `mythique` gradient border) into a
selector-independent `.difficulty-frame.difficulty-{value}` block, and have `.last-action`
compose it. `ActionCountdown` then reuses it with no duplication. Add a matching
`.category-frame.category-{value}` set for the four categories.

**`ActionResultDialog`** (R3/F4): the current quest dialog, generalised.

- Title: `lastAction.label` — plus `— {quest.name}` when `lastAction.quest` exists.
- Body: outcome (`Succès`/`Échec`), `narrativeText`, then the gains list already rendered in the
  expanded recap (gold, item, talent, reputation, legendary) or the consequence list on failure.
- Loot fieldset: only when `actionType.result.showLoot` and `lastAction.loot?.length`.
- Not closable by Escape or backdrop (unchanged); the single "Fermer" button calls
  `acknowledgeAction`.

The gains/consequence rendering is currently duplicated inline in the recap and would now be
duplicated a third time — extract it into one `ActionOutcome` presentational component used by
both the dialog and the recap.

### 3.8 Creator UI

`src/components/creator/ActionsManager.jsx`, registered in `CreatorDashboard.jsx` as a new
top-level group **"Actions"** (its content belongs to none of Carte / Quêtes / Narration / PNJs /
Personnages, and the group has obvious room to grow later).

Following the established filtered-list-plus-collapsible-form layout (`QuestsManager.jsx`,
`ObjectsManager.jsx`):

- List filterable by category and by enabled state, with a free-text search over label and
  description.
- Form fields: label, `categoryId` select, description, `order`, `enabled`, `handlerId` select
  (populated from a `KNOWN_HANDLER_IDS` constant kept in step with `ACTION_HANDLERS`, plus an
  explicit "Aucun (générique)" option), `durationHours`, the `availability` condition editor, and
  `result.accentSource` / `result.showLoot`.
- The condition editor is a repeatable row: a `type` select that swaps in that type's own inputs
  (talent picker via `MultiSelectModalField`'s `matchesTalent`, tag picker via `matchesTag`,
  region picker via `matchesRegion`, plain number/text otherwise).
- Warn inline when `handlerId` names no known handler — the closest thing to compile-time safety
  a Firestore-authored catalog can have (F2).

The `tiers` editor is explicitly **out of scope** here: it is a large form of its own (the
removed `ActionTypesManager.jsx` had it), and tiers keep working exactly as they do today when
authored in the Firestore console. Re-adding the tier editor is a natural follow-up once this
framework is in, and should be its own TODO entry.

### 3.9 Security rules

No changes needed.

- `worldData/**` is already signed-in-read / creator-write, which covers `actionTypes` and the
  new `actionModifiers` fields.
- `instances` stays `write: false` (Cloud Functions only) — `acknowledgeAction` uses the Admin
  SDK exactly as `claimQuestLoot` does.
- `characters` update stays owner-writable, which is what the `[TEST]` button needs; the daily
  lock's authority is the transaction in `performAction`, not the rules, and that is unchanged in
  kind.

Worth stating explicitly in the PR: making availability data-driven does **not** weaken anything,
because the client-side evaluation is display-only and step 3 of the pipeline (§3.5) re-checks
server-side with the same fail-closed evaluator.

---

## 4. Implementation plan

Six phases, each independently mergeable and independently reviewable. Phases 0–1 change live
behaviour and carry the risk; 2–6 are additive.

### Phase 0 — Groundwork (no behaviour change) — **done**

1. Create `functions/src/lib/actionEffects.js`; move the character-patch construction from
   `partirEnQuete.resolve()` (`functions/src/actions/partirEnQuete.js:180-215`) into
   `applyTierEffects({ tier, talentGained, today })` returning the `updates` fragment. Have
   `partirEnQuete.js` call it.
2. Add `"test": "node --test src/**/*.test.js"` to `functions/package.json` (F9) and one test
   for `applyTierEffects` covering the success branch, the wound branch, and the death branch.

**Acceptance:** `npm --prefix functions test` passes; a quest resolution produces a character
patch identical to before.

*As shipped:* `applyTierEffects({ tier, today, actionTypeId, narrativeText, talentGained,
lastActionExtra })` returns the whole patch, with handler-specific `lastAction` fields (quest
summary, loot) merged in through `lastActionExtra` — so the generic path of Phase 3 can call it
with no extra argument. `isSuccess(tier)` is exported alongside it so the `tier.success !== false`
rule lives in one place. Equivalence was verified by replaying the pre-refactor inline block
against the extracted function over 160 tier/talent/quest/loot/text combinations (identical
patches, including key order) rather than through the emulator, which needs a Java runtime and
credentials this environment doesn't have.

### Phase 1 — Lifecycle unification

1. `performAction` writes `lastAction.startedAt` / `completesAt` / `acknowledged: false` /
   `label` / `categoryId` / `accent`, using `Timestamp.now()` per §3.6. Keep writing
   `lastActionDate` and `lastActionAt`.
2. Move the transaction lock from `lastActionDate === today` to
   `now < lastAction.completesAt`.
3. Rename `claimQuestLoot` → `acknowledgeAction`; add the `completesAt` gate (F7), move the loot
   creation into `partirEnQuete.commit()`, and set `acknowledged` instead of `lootClaimed`.
4. `ActionPanel.jsx`: derive state from `completesAt` with the
   `acknowledged ?? lootClaimed ?? false` and `completesAt ?? lastActionAt + 24 h` fallbacks;
   call `acknowledgeAction`; fix the `[TEST]` button to backdate `completesAt`/`startedAt`.

**Acceptance:** starting an action at 23:00 UTC still blocks a second action at 00:30 UTC.
Closing the result dialog still grants loot instances exactly once. Calling `acknowledgeAction`
before `completesAt` is rejected. **Deploy functions before merging** (§3.6).

### Phase 2 — Catalog and conditions

1. `src/lib/actionCategories.js` with `ACTION_CATEGORIES`.
2. `src/lib/actionConditions.js` and `functions/src/lib/actionConditions.js` (mirrored pair per
   F8, each with a comment pointing at the other) implementing `evaluateConditions` and
   `conditionsNeedInstances`, fail-closed on unknown types.
3. Tests for the evaluator: one per condition type, one for AND-composition, one asserting an
   unknown type yields `ok: false`, one asserting `conditionsNeedInstances` is false for a
   condition set with no instance predicate.
4. Read-time defaults for every new `actionType` field, in one `normalizeActionType()` helper
   duplicated on both sides so client and server agree on defaults.
5. `performAction` evaluates conditions (pipeline step 3) and rejects with `failed-precondition`
   and the French `unmetMessage`.
6. Extend the grant-time talent copy with `tagIds` (§3.3).

**Acceptance:** an action with `{ type: "minReputation", value: 999 }` is refused by the callable
even when invoked directly, with the authored French message.

### Phase 3 — Generic resolution

1. `functions/src/lib/actionPipeline.js` implementing §3.5's ten steps.
2. Re-key `ACTION_HANDLERS` by `handlerId` (`{ partirEnQuete }`), with `null`/unknown falling
   through to `genericResolve`.
3. `genericResolve` in `actionEffects.js`: roll the tier, apply `applyTierEffects`, build
   `lastAction` + `logFields` — no quest, no loot, no narrative generation (the tier's own
   `narrativeText` is used verbatim).
4. `performAction` becomes a thin wrapper over the pipeline.

**Acceptance:** a hand-authored `worldData/actionTypes/items/se-reposer` document with
`handlerId: null` and two tiers resolves end to end with **zero new code** — this is the phase
that makes the framework's central claim true, so verify it explicitly rather than by
inspection.

### Phase 4 — Player UI

1. CSS refactor per F13: `.difficulty-frame.difficulty-{value}` + `.category-frame.category-{value}`,
   with `.last-action` composing the former.
2. `ActionCountdown.jsx` — ticking `HH:MM:SS`, accent frame, `onComplete`.
3. `ActionBrowser.jsx` — nested category/action tabs, availability filtering, "Commencer".
4. `ActionResultDialog.jsx` + the extracted `ActionOutcome` shared with the recap.
5. `ActionPanel.jsx` becomes the state machine of §3.6, with the one-second tick.

**Acceptance (verify in the browser preview, not by reading the diff):** press "Commencer" → the
frame is replaced by a countdown in the drawn quest's difficulty color; backdate `completesAt` via
the `[TEST]` button → the dialog opens without a reload; reload mid-countdown → the countdown
resumes at the right remaining time; reload after completion without closing the dialog → the
dialog reopens. Check the 720 px breakpoint (F12).

### Phase 5 — Creator UI

1. `ActionsManager.jsx` per §3.8, registered as a new "Actions" group in `CreatorDashboard.jsx`.
2. Backfill the existing `partir-en-quete` document from that UI: `categoryId: "aventure"`,
   `handlerId: "partirEnQuete"`, `durationHours: 24`, `result.accentSource: "difficulty"`,
   `result.showLoot: true`.

**Acceptance:** a new Intermède action can be created, made conditional on a talent, and started
in the player UI without touching the Firestore console.

### Phase 6 — Modifiers

1. `actionModifiers: Modifier[]` on `worldData/talents/items` and `worldData/objects/items`, with
   editors in `TalentsManager.jsx` and `ObjectsManager.jsx`.
2. `functions/src/lib/actionModifiers.js` with `collectModifiers` / `applyTierWeights` /
   `applyDuration` / `applyRewards`, all pure and copy-returning.
3. Wire into pipeline steps 4, 7, 8, and into `durationHours` before `completesAt` is computed.
4. Tests: multiplier composition is order-independent; scope filtering by `actionTypeId` and by
   `categoryId`; duration clamped at 1 h; an unknown `hook` is ignored rather than throwing.

**Acceptance:** a talent with `{ scope: { actionTypeId: "partir-en-quete" }, hook: "tierWeight",
tierName: "Succès", multiplier: 2 }` measurably shifts outcomes over a scripted batch of
resolutions, and a character without that talent is unaffected.

### Documentation to update when the last phase lands

- [docs/ARCHITECTURE.md](ARCHITECTURE.md): the data model block, "The `performAction` Cloud
  Function", "The 24-hour reveal delay" (now `completesAt`), "Front-end structure", and the
  creator dashboard list. Note that this file is already stale on `claimQuestLoot`, `instances`,
  and several creator managers (`ClimatsManager`, `ReliefsManager`, `OriginsManager`,
  `FactionsManager`, `InventoryTab`, `Instance`) — worth catching up in the same pass.
- [docs/TODO.md](TODO.md): flip this feature's entry to implemented, and add a new entry for the
  deferred tier editor (§3.8).

---

## 5. Decisions taken

Recorded so the implementer does not re-open them; each was a real fork.

| # | Decision | Why |
|---|---|---|
| D1 | The daily lock becomes `completesAt`-based, replacing the UTC-date lock | R1 + R2 describe one mechanism; the countdown UI is unrepresentable otherwise (F5) |
| D2 | Generic tier roller as the default, code handler as the escape hatch | Otherwise "modular" still means "one module per action" (F1) |
| D3 | Conditions are a closed set of typed predicates, not an expression language | Authorable in a form, serialisable, testable; an expression engine is unbounded |
| D4 | Both evaluators fail closed on unknown condition types | A stale client must never offer an action the server refuses |
| D5 | The condition evaluator is a deliberately duplicated module pair | The repo's established answer to F8, already used by `loot.js` |
| D6 | Categories are a JS constant, not a Firestore collection | Matches `DIFFICULTIES`/`RARITIES`/`OBJECT_TYPES`; four fixed values |
| D7 | Three modifier hooks (`tierWeight`, `duration`, `reward`), no `availability` hook | Bounded and testable; unlock rules stay in the action's own conditions |
| D8 | Modifiers are server-side only | The client would duplicate the pipeline for no visible gain |
| D9 | Countdown accent = quest difficulty when present, else the category color | R10 names difficulty; non-quest actions need a defined fallback |
| D10 | The difficulty color stays visible before the reveal | Already today's behaviour (`ActionPanel.jsx:100`); changing it is a separate decision |
| D11 | `lastAction` is extended, not replaced by a new `currentAction` field | Keeps `CharactersOverview`, the recap, and `actionsLog` working with no migration |
| D12 | `lastActionDate` is kept but demoted to a logging/display field | Still feeds `actionsLog.date` and the history tab; removing it is unnecessary churn |
| D13 | `ACTION_HANDLERS` is keyed by `handlerId`, not by document id | Lets actions share a handler and be renamed without a code change |
| D14 | The `tiers` editor stays out of the creator UI for now | A large form of its own; tiers keep working as authored today |

## 6. Open questions

None blocking — each has a working default, listed for the record:

- **Empty categories.** Shown with an empty state (§3.7). If the four fixed categories end up
  looking sparse in play, hiding empty ones is a one-line change.
- **Client-side handler registry.** §3.7 prefers `enabled: false` plus a creator-UI warning over
  mirroring `ACTION_HANDLERS` client-side. If dead actions still slip through in practice,
  mirroring the id list is the fallback.
- **Per-action durations.** `durationHours` is in the schema and honoured by the pipeline, but
  every action is 24 h under R2. The countdown formats `HH:MM:SS` and would need a day component
  if an action ever exceeds 24 h.
- **Profession conditions** match `character.profession` as a string until a profession catalog
  exists (F10). When it does, `{ type: "profession", values: [...] }` becomes an id match and
  authored content needs a one-off rewrite — small, and unavoidable either way.
- **Reputation *levels*.** R4 mentions "niveau de réputation"; `character.reputation` is a raw
  number, so the condition is `minReputation`. If named tiers are introduced later, a
  `reputationLevel` condition type is additive.

## Non-goals

- **Implementing any of the example actions** (Repos, Marchander, S'entraîner, Apprendre un sort,
  Forger, Cuisiner, Pêcher, and anything Social). The feature request states these are
  illustrations. Phase 3's acceptance test authors a throwaway `se-reposer` document purely to
  prove the generic path works; it is not a game-design commitment.
- **The profession/métier system** (F10) — a prerequisite for real Métier actions, tracked
  separately.
- **Multiple or queued actions per day**, action costs (energy/gold to start), and cancelling a
  running action. R1 is one action per day, full stop.
- **Actions lasting other than 24 h.** The schema supports it; no content uses it.
- **Re-adding the `tiers` editor** to the creator dashboard (§3.8, D14).
- **Narrative generation changes.** [docs/ISSUE-01-GRAMMAR-ENGINE.md](ISSUE-01-GRAMMAR-ENGINE.md)
  is orthogonal: it changes how an outcome's text is produced, this issue changes how actions are
  declared, selected, and timed. They touch `partirEnQuete.js` in different places and can land in
  either order.
