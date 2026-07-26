# Architecture

Technical reference for how Monkar is built. For setup instructions, see [README.md](../README.md).

## Overview

Monkar is a daily-action text RPG. Each player owns one character and picks a single action per day (quest, rest, training, shopping...). The outcome is decided by a weighted random roll, and the character can't act again until the next day. A separate "creator" role can inspect every character's history and author the game world's content (factions, regions, gods, creatures, action types).

GitHub Pages only serves static files, so all stateful and security-sensitive logic lives in Firebase:

```
┌─────────────────────┐        ┌──────────────────────────────────────────┐
│  GitHub Pages        │        │  Firebase project: monkar-rpg            │
│  (static React app)  │◄──────►│  - Auth (email/password)                 │
│  github.io/Monkar    │        │  - Firestore (characters, world data)    │
└─────────────────────┘        │  - Cloud Functions (performAction)       │
                                └──────────────────────────────────────────┘
```

The front never talks to a custom server — it calls the Firebase client SDK directly (Auth, Firestore reads/writes allowed by security rules, and the one callable Cloud Function).

## Why a Cloud Function at all

Firestore security rules can enforce a lot on their own (see below), including the daily-action lock, using `request.time` — a timestamp Firestore evaluates server-side, which the client cannot forge. What rules **cannot** do is guarantee that a "random" roll a client submits was actually random: a rule can restrict the *shape* of a value (e.g. an integer between 1 and 100) but not audit *how* it was produced. The `performAction` Cloud Function exists specifically to compute that roll server-side, so the result can't be fabricated from devtools.

This was a deliberate tradeoff, not a hard requirement — see the "Alternatives" section below for the no-Cloud-Functions option.

## Data model (Firestore)

```
users/{uid}
  role: "player" | "creator"
  characterId: string

characters/{characterId}
  ownerUid: string
  name: string                     -- in-game character name, French
  stats: { force, agilite, intelligence, charisme }
  lastActionDate: string | null    -- "YYYY-MM-DD", UTC, written by performAction only
  createdAt: string

actionsLog/{logId}
  characterId, ownerUid, actionTypeId, date
  tierName: string                 -- e.g. "Réussite", French in-game content
  bonusesApplied: { [stat]: number }
  narrativeText: string            -- French in-game content
  createdAt: server timestamp

worldData/actionTypes/items/{id}
  label: string                    -- e.g. "Partir en quête"
  tiers: [
    { name, weight, bonuses: { [stat]: number }, narrativeText }
  ]
  -- weight is a relative weight out of 100 across all tiers of one actionType

worldData/factions/{id}            -- not yet consumed by the app, reserved for
worldData/regions/{id}                the creator dashboard (Phase 3)
worldData/gods/{id}
worldData/creatures/{id}
```

`worldData` uses a mixed depth on purpose: `actionTypes` nests an `items` subcollection because tiers are naturally grouped per action, while `factions`/`regions`/`gods`/`creatures` are flatter collections. The Firestore rule for `worldData` uses a recursive wildcard (`{document=**}`) specifically so it authorizes reads/writes at any depth, instead of hardcoding one shape.

## Security rules (`firestore.rules`)

- `users/{uid}`: a signed-in user can read their own doc, and create it once (on signup) with `role` forced to `"player"` — role escalation to `"creator"` never goes through a client write, only through the `setCreatorRole` admin script (see below).
- `characters/{id}`: a player can read/update only their own character (`ownerUid == request.auth.uid`); the creator role can read/update/delete any character.
- `actionsLog/{id}`: read-only from the client (player sees their own, creator sees all); all writes happen inside the `performAction` transaction, never directly from the client.
- `worldData/**`: any signed-in user can read (needed to show action choices, and later faction/region lore); only the creator role can write.

The creator role itself is a **custom claim** on the Firebase Auth ID token (`request.auth.token.role == 'creator'`), not a Firestore field — Firestore rules can't trust a plain document field for authorization since a malicious client could otherwise just set `role: "creator"` on their own `users/{uid}` doc (which is why that field is only informational for the UI, and the `create` rule forces it to `"player"`).

## The `performAction` Cloud Function

Callable function, `functions/src/index.js`. Given an `actionTypeId`:
1. Rejects if the caller isn't authenticated.
2. Looks up the caller's character (`characters` where `ownerUid == uid`).
3. Loads the `actionType` document and its `tiers` (name/weight/bonuses/narrativeText).
4. In a Firestore transaction: re-reads the character, rejects if `lastActionDate` is already today (UTC), otherwise rolls a tier by cumulative weight, applies `bonuses` to `stats` via `FieldValue.increment`, sets `lastActionDate`, and writes an `actionsLog` entry.
5. Returns `{ tierName, bonusesApplied, narrativeText }` to the client.

The transaction is what actually prevents a double-action race (e.g. two tabs clicking at once) — the lock check and the write happen atomically.

## Granting the creator role

There is no in-app UI for this (deliberately — it's a one-time, high-privilege operation). `functions/scripts/setCreatorRole.js` uses `firebase-admin` with a downloaded service account key to call `auth.setCustomUserClaims(uid, { role: "creator" })`. The user must sign out/in afterward so the client fetches a fresh ID token carrying the new claim.

## Front-end structure

```
src/
  lib/firebase.js          Firebase client SDK initialization (reads VITE_* env vars)
  context/AuthContext.jsx  subscribes to onAuthStateChanged, exposes { user, loading };
                           user.role is read from the ID token's custom claims
  components/
    ProtectedRoute.jsx     redirects to /login if signed out, or to / if requireCreator
                           is set and the user isn't a creator
  pages/
    Login.jsx, Signup.jsx  Signup also creates the character doc and the users/{uid} doc
    CharacterProfile.jsx   reads the character (live via onSnapshot), reads
                           worldData/actionTypes/items (live), calls performAction
    CreatorDashboard.jsx   placeholder — CRUD for world content is Phase 3, not built yet
```

Routing uses React Router with `basename={import.meta.env.BASE_URL}` so it works under the `/Monkar/` subpath GitHub Pages serves from. `public/404.html` plus the inline script in `index.html` implement the standard GitHub Pages SPA fallback (redirect through a `?redirect=` query param) since GitHub Pages has no server-side rewrite rules for client-side routes like `/login`.

## Deployment

- **Front**: `.github/workflows/deploy.yml` builds with Vite on every push to `main` (base path derived from the repo name automatically) and publishes via GitHub's native Pages Actions (`configure-pages` / `upload-pages-artifact` / `deploy-pages`), not a `gh-pages` branch. Firebase config values are injected at build time from GitHub Actions secrets — see README for the exact list.
- **Backend**: Firestore rules and indexes deploy via `firebase deploy --only firestore:rules`; the Cloud Function via `firebase deploy --only functions`. Both are manual steps (not wired into CI) since backend changes are lower-frequency and the creator wants to review them before they go live.

Current deployed project: `monkar-rpg` (Firebase, Blaze plan — required for Cloud Functions, see "Alternatives" for why). Repo: `hchary/Monkar` (public — GitHub Pages needs a public repo on GitHub's Free plan hosting is only available for private repos on paid plans).

## Alternatives considered

**Skipping Cloud Functions entirely** (Firestore rules only, Spark/free plan, no billing needed): the daily lock still works reliably via `request.time` in rules. The random roll would have to be computed client-side and merely shape-validated by rules (e.g. an integer in range), which a technically inclined player could fake via devtools. Not implemented, since the project already has Cloud Functions running, but worth remembering as a no-cost fallback if the Blaze plan ever becomes undesirable — it would mean deleting `functions/` and moving the roll logic into `CharacterProfile.jsx`, writing directly to Firestore under updated rules.

**Cloudflare Workers / Supabase Edge Functions**: would keep a fully server-side roll without needing Firebase's Blaze plan (their free tiers generally don't require a card, though policies change — verify at signup). Not implemented; would mean keeping Firebase Auth + Firestore as-is and only moving `performAction`'s logic to an HTTP endpoint on that other platform, called from the client instead of `httpsCallable`.

## Known gaps (as of this writing)

- Creator dashboard (`CreatorDashboard.jsx`) is a placeholder; no CRUD yet for factions, regions, gods, creatures, or action types. All `worldData` content currently has to be created by hand in the Firestore console.
- No narrative text variety beyond whatever is authored per tier; no visual theme/styling pass yet.
- Only one `actionType` needs to exist for the game to be playable at all — see README step 6 for the seed shape.
