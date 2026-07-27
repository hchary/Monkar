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
  wounds: [{ name, description, date }]
  lastActionDate: string | null    -- "YYYY-MM-DD" UTC, the once-per-day lock
  lastActionAt: Timestamp | null   -- precise instant, used for the 24h reveal delay
  lastAction: { ... } | null       -- full result of the last action, see performAction below
  createdAt: server timestamp

actionsLog/{logId}                 -- permanent history, independent of lastAction
  characterId, ownerUid, actionTypeId, date
  tierName: string, success: boolean
  narrativeText: string
  consequence: { type: "wound" | "death", name?, description } | null
  createdAt: server timestamp

worldData/actionTypes/items/{id}
  label: string                    -- e.g. "Partir en quête"
  tiers: [{
    name, weight, success, narrativeText,
    cible: "groupe" | "individuel" | undefined,  -- opts this tier into procedural narrativeText
                                                  -- generation (see below); when absent, narrativeText
                                                  -- is used verbatim
    goldGain, itemGain: { name, qty },    -- success only
    talentGain: { talentId, quality, circumstance },  -- success only; talentId references worldData/talents/items,
                                                       -- circumstance is French narrative text (see Talents below)
    reputationGain: number,               -- success only
    legendary: boolean,                   -- success only, bumps legendLevel
    consequence: { type: "wound"|"death", name?, description }  -- failure only
  }]
  -- weight is a relative weight; performAction sums all tiers' weights and rolls against that total

worldData/narrativeSubjects/items/{id}   -- procedural narrativeText generation, see below (distinct
                                          -- from worldData/questSubjects, which is the région-linked
                                          -- quest theme/category list)
  type: "groupe" | "individuel"
  article: "le" | "la" | "les" | "l'"    -- elided with a following "de" (du/de la/des/de l')
  nom: string                            -- French, e.g. "bandits", "chef des bandits"
  genre: "m" | "f"
  nombre: "singulier" | "pluriel"
  tags: [string]                         -- e.g. ["hostile", "humanoïde"]

worldData/verbPhrases/items/{id}     -- procedural narrativeText generation, see below
  resultat: "victoire" | "echec" | "partielle"   -- only "victoire"/"echec" are produced today,
                                                  -- since tiers only have a boolean success
  cible: "groupe" | "individuel" | "les_deux"
  template: string                       -- French, contains a {sujet} placeholder,
                                          -- e.g. "avez triomphé de {sujet}"
  tags: [string]                         -- optional; when set, only pairs with subjects sharing
                                          -- at least one tag

worldData/regions/items/{id}
  name: string
  nameSuggestions: [string]         -- shown to the player when naming their character

worldData/regions/items/{regionId}/backgrounds/{id}
  name, profession, weight, reputationStart, startingGold, startingItems: [{name, qty}]

worldData/talents/items/{id}
  name: string                     -- French, e.g. "Résistance au feu"
  trainable: boolean               -- shown with a trailing asterisk in the UI
  rarity: "commun" | "peu_commun" | "rare" | "tres_rare" | "legendaire" | "mythique" | "divin" | "unique"
  effect: string                   -- French, shown in the character sheet tooltip

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

Callable, `functions/src/index.js`. Given `{ regionId, name }`:
1. Rejects if the caller isn't authenticated, or already has a character with `alive == true` (one living character per account).
2. Loads the chosen region, rolls a background from `worldData/regions/items/{regionId}/backgrounds` (weighted).
3. Creates the `characters` doc (region chosen, background rolled as above; `title` empty, `legendLevel` null, `alive: true`, `reputation`/`gold`/`inventory` from the background) and upserts `users/{uid}` with `role: "player"` and the new `characterId`.

Region is a player *choice*; background is *rolled* server-side specifically so a player can't simply pick the best possible starting character.

## The `performAction` Cloud Function

Callable. Given an `actionTypeId`:
1. Rejects if the caller isn't authenticated, or has no character with `alive == true`.
2. Loads the `actionType` document and its `tiers`, plus the full `worldData/narrativeSubjects/items` and `worldData/verbPhrases/items` collections (small, shared reference data — read once, outside the transaction).
3. In a Firestore transaction: re-reads the character, rejects if `lastActionDate` is already today (UTC), otherwise rolls a tier by cumulative weight and:
   - if the rolled tier has a `cible`, calls `generateResultText` (`functions/src/textGeneration.js`) with `resultat` derived from the tier's `success` (`"victoire"` or `"echec"`) and the tier's `cible`, to pick a compatible verb phrase + subject and produce a fresh `narrativeText`; falls back to the tier's own `narrativeText` if the tier has no `cible` or if no compatible verb phrase/subject pair exists (e.g. an empty pool). Subject/verb-phrase matching is done by `cible`/`type` plus tag overlap when a verb phrase restricts to specific subject tags, and the `{sujet}` placeholder is filled in with French elision of the subject's article after "de" (`de le` → `du`, `de les` → `des`, `de la` → `de la`, `de l'` → `de l'`).
   - on success: increments `gold`/`reputation`, `arrayUnion`s `itemGain` into `inventory`; if `tier.talentGain` is set, reads the referenced `worldData/talents/items/{talentId}` doc, applies the rarity floor-bump for the granted `quality` (see [docs/TODO.md](TODO.md) — quality 3/4/5 floor rarity at rare/très rare/légendaire respectively, never downgrading), and `arrayUnion`s the resulting denormalized talent object into `talents`; increments `legendLevel` if `tier.legendary` is set (Firestore's `increment` on a `null` field just sets it, which is what makes "hidden until first legendary exploit" work),
   - on failure with `consequence.type === "death"`: sets `alive: false` (permadeath — the front-end then shows character creation again),
   - on failure with `consequence.type === "wound"`: `arrayUnion`s a wound into `wounds`,
   - always sets `lastActionDate`, `lastActionAt` (server timestamp), and the full `lastAction` snapshot, and writes a mirrored `actionsLog` entry.
4. Returns only `{ ok: true }` — deliberately not the roll result, since the outcome must stay hidden for 24h even from the player who just acted (see below).

The transaction is what actually prevents a double-action race (e.g. two tabs clicking at once) — the lock check and the write happen atomically.

## The 24-hour reveal delay

Design intent: submitting an action computes and commits the outcome immediately (so the anti-cheat properties above hold), but the *result* stays hidden behind an "En cours..." (in progress) status for 24 real hours, even for the player who triggered it — it's a narrative pacing choice, not a security one. `ActionPanel.jsx` computes `hoursSince(character.lastActionAt)` client-side and only renders `tierName`/`narrativeText`/gains/consequence once that crosses 24h; before that, nothing but the action's label and "En cours..." is shown. Because this gate is purely a display decision (the data is already sitting in the character doc), gating it client-side is an accepted tradeoff — a player could theoretically peek early via devtools, but there's nothing to exploit gameplay-wise by doing so.

Note this is intentionally decoupled from the once-per-day *lock*, which remains based on the UTC calendar date (`lastActionDate`) as before — the two can drift apart by a few hours at the day boundary, which is fine.

## Granting the creator role

There is no in-app UI for this (deliberately — it's a one-time, high-privilege operation, and letting any authenticated write grant it would defeat the point of a custom claim). `functions/scripts/setCreatorRole.js` and `functions/scripts/seedWorldData.js` both use `firebase-admin` authenticated via Application Default Credentials (`gcloud auth application-default login`) rather than a downloaded service account key file — nothing extra to download, and nothing sensitive to remember to keep out of git. `setCreatorRole.js` takes either a uid or an email (it resolves the email via `auth.getUserByEmail`) and calls `auth.setCustomUserClaims(uid, { role: "creator" })`. The user must sign out/in afterward so the client fetches a fresh ID token carrying the new claim.

## Seeding world data

`functions/scripts/seedWorldData.js` populates example regions (with nested backgrounds) and one actionType (`Partir en quête`, with a death tier, a wound tier, a plain success tier, and a legendary tier) — see the script for the exact shapes, or just use it as a one-time bootstrap and then manage everything through the creator dashboard's CRUD (see below) from that point on.

## Creator dashboard (`CreatorDashboard.jsx`)

No longer a placeholder — it's a client-side CRUD UI, gated by `ProtectedRoute requireCreator` and by the same `worldData`/`characters`/`actionsLog` Firestore rules described above (writes to `worldData` require the creator custom claim; there's no Cloud Function in this path since, unlike player-facing rolls, there's no anti-cheat concern — the creator is the trusted party rules already gate). Several sections, switched locally (no sub-routing), including:

- **`RegionsManager.jsx`**: CRUD for `worldData/regions/items`, and per-region CRUD for the nested `backgrounds` subcollection (expand a region to manage its own background pool inline).
- **`TalentsManager.jsx`**: CRUD for the global `worldData/talents/items` catalog (name, trainable flag, rarity, effect text) — see [docs/TODO.md](TODO.md) for the full talent system design.
- **`ActionTypesManager.jsx`**: CRUD for `worldData/actionTypes/items`. The `tiers` array is edited via a structured per-tier form (not raw JSON) that toggles between "success" fields (gold/item/talent/reputation gains, legendary flag) and "failure" fields (wound vs. death consequence) depending on the tier's `success` checkbox — see `formToTier`/`tierToForm` for the mapping between form state and the Firestore shape documented above. The talent grant fields are a select over `worldData/talents/items` (populated live) plus a starting quality and a French circumstance string, mapping to the `tier.talentGain` shape above. A tier's optional `cible` select opts it into the procedural `narrativeText` generation described below instead of using the tier's own fixed text.
- **`TextGenerationManager.jsx`**: CRUD for `worldData/narrativeSubjects/items` and `worldData/verbPhrases/items` (see "Procedural quest-result text" below) — two sub-forms in one section, following the same pattern as the other managers.
- **`CharactersOverview.jsx`**: lists every character (any `alive` state) and, on click, shows the full character sheet plus its complete `actionsLog` history. Reads all of `characters`/`actionsLog` unfiltered, which the rules permit for the creator role — see the `actionsLog` list-query note above for why a *player's own* history tab needs an `ownerUid` filter but the creator's doesn't (the rule's `isCreator()` branch doesn't depend on `resource.data`, so it authorizes any query shape once true).

## Procedural quest-result text

A tier can either carry a fixed `narrativeText` (used verbatim, as before) or opt into procedural generation by setting `cible: "groupe" | "individuel"`. When set, `performAction` calls `generateResultText` (`functions/src/textGeneration.js`) with the tier's outcome (`"victoire"` or `"echec"`, from `tier.success`) and `cible`:

1. Filters `worldData/verbPhrases/items` to those matching the outcome and target (`cible: "les_deux"` matches either target), and picks one at random.
2. Filters `worldData/narrativeSubjects/items` to those of the matching `type`, further narrowed to subjects sharing at least one tag with the verb phrase's `tags` if it declares any, and picks one at random.
3. Substitutes the picked verb phrase's `{sujet}` placeholder with the subject's `nom`, prefixed by the French elision of its `article` after "de" (`le` → `du`, `les` → `des`, `la` → `de la`, `l'` → `de l'`) — this contraction lives in `contractDe`, a single dedicated function, rather than being duplicated per verb phrase. The past participle in these templates doesn't agree with a complement introduced by "de", so no further grammatical-agreement logic is needed.

If no verb phrase or no subject matches, `generateResultText` returns `null` and the tier's own `narrativeText` is used as a fallback — a tier can therefore opt into procedural generation without needing every outcome/target combination populated up front. The `resultat: "partielle"` value on verb phrases is accepted by the schema but never produced today, since tiers only have a boolean `success`, not a tri-state outcome.

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
      ActionTypesManager.jsx actionTypes CRUD with a structured tiers sub-form
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

**Skipping Cloud Functions entirely** (Firestore rules only, Spark/free plan, no billing needed): the daily lock still works reliably via `request.time` in rules. The random rolls (background at creation, tier at each action) would have to be computed client-side and merely shape-validated by rules, which a technically inclined player could fake via devtools. Not implemented, since the project already has Cloud Functions running, but worth remembering as a no-cost fallback if the Blaze plan ever becomes undesirable.

**Cloudflare Workers / Supabase Edge Functions**: would keep fully server-side rolls without needing Firebase's Blaze plan (their free tiers generally don't require a card, though policies change — verify at signup). Not implemented; would mean keeping Firebase Auth + Firestore as-is and only moving `createCharacter`/`performAction`'s logic to HTTP endpoints on that other platform, called from the client instead of `httpsCallable`.

## Known gaps (as of this writing)

- The creator dashboard has CRUD for regions/backgrounds/talents/actionTypes only (the data the game actually consumes today). Factions, gods, and creatures have no CRUD yet and still have to be created by hand in the Firestore console — deliberately deferred since nothing in the app reads them yet either.
- `title`, `legendLevel` progression beyond the raw counter, `blessings`, `curses`, quest journal, world-knowledge lore, and messaging are all stubs — visually present (or, for messaging, not even that) but not wired to real game logic yet, by design (deferred until the underlying systems are designed).
- Procedural `narrativeText` generation (see "Procedural quest-result text" above) only covers `"victoire"`/`"echec"` outcomes; tiers still need a hand-authored `narrativeText` fallback for when no subject/verb-phrase pair is populated for a given target. No visual theme/styling pass yet.
