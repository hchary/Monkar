# Monkar — daily text RPG

Web game where each player picks one action per day for their character (quest, rest, training, shopping...), with a server-side random roll for the outcome. Front hosted on GitHub Pages, backend on Firebase (Auth, Firestore, Cloud Functions).

**The game design is being revamped.** The previous direction (actions, missions, monsters,
professions, talents, crafting, quests and their creator pages) was removed in the revamp reset:
only the front shell, authentication and the character definition remain. Its documentation is
kept under [docs/archives/](docs/archives/) - [ARCHITECTURE.md](docs/archives/ARCHITECTURE.md)
for the old technical deep dive, [TODO-2026-09-18-pre-revamp.md](docs/archives/TODO-2026-09-18-pre-revamp.md)
for the old roadmap - as reference for what was built, not as a description of the current code.

## Stack
- **Front**: React + Vite
- **Backend**: Firebase Auth, Firestore, Cloud Functions
- **Front hosting**: GitHub Pages (automatic deployment via GitHub Actions)

## Project structure
```
src/
  lib/firebase.js           Firebase client config
  context/AuthContext.jsx   global auth state
  components/               NavBar, ProtectedRoute
  hooks/useOwnCharacter.js  live subscription to the caller's character document
  pages/                    Login, Signup, CharacterProfile (placeholder)
shared/schema/character.ts  the character contract, shared by client and functions
functions/
  src/index.ts              createCharacter Cloud Function
  src/schema/character.ts   server-side wrapper over the shared character contract
  scripts/setCreatorRole.js admin script to grant yourself the "creator" role
firestore.rules             Firestore security rules
```

## Setup (manual steps)

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com, create a new project.
2. Enable **Authentication** → Email/Password method (and Google if you want it).
3. Enable **Firestore Database** (production mode).
4. In "Project settings" → "Your apps" section → add a Web app, get the config (`apiKey`, `authDomain`, etc.).

### 2. Configure local environment variables
Copy `.env.example` to `.env` and fill it with the Firebase config values:
```bash
cp .env.example .env
```

### 3. Install dependencies and run locally
```bash
npm install
npm run dev
```

### 4. Deploy Firestore rules and Cloud Functions
Requires the Firebase CLI (`npm install -g firebase-tools`, then `firebase login`).
```bash
firebase use --add          # select the Firebase project you created
firebase deploy --only firestore:rules
cd functions && npm install && cd ..
firebase deploy --only functions
```

### 5. Grant yourself the creator role
1. Create your player account normally through the site's signup screen.
2. Authenticate the Google Cloud CLI so the script can use your own credentials (no service account key file needed): `gcloud auth login` then `gcloud auth application-default login`.
3. Run:
```bash
cd functions
node scripts/setCreatorRole.js <your-email-or-uid>
```
4. Log out/back in on the site for the new role to take effect. The creator dashboard itself was removed in the revamp reset, so the role currently only widens what Firestore rules let you read and write.

### 6. Seed the world's starting data
The game needs at least one region (with a background pool) and one action type to be playable. Run the seed script (uses your `gcloud` login, no service account key needed):
```bash
gcloud auth application-default login
cd functions
node scripts/seedWorldData.js
```
`createCharacter` still draws the new character's region and origin from `worldData`, so that data has to exist for character creation to succeed. The seed script and the Firestore console are the only ways to edit it now that the creator pages are gone. It seeds the pre-revamp world shape, which the revamp is expected to replace.

### 7. GitHub Pages deployment
1. Create the repo on GitHub and push this project to the `main` branch.
2. In the GitHub repo Settings → Pages → Source: choose **GitHub Actions**.
3. In Settings → Secrets and variables → Actions, add the following secrets (same values as the local `.env`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Every push to `main` triggers the automatic build and deployment (see `.github/workflows/deploy.yml`).

## Current status (revamp reset)
What survived the reset:
- Email/password auth, protected routing, the nav bar and the existing stylesheet
- The character contract (`shared/schema/character.ts`) and the `createCharacter` Cloud Function
- Firestore rules and indexes, the Firebase and GitHub Pages deployment wiring

What was removed, pending the new design:
- Every action (récolte, artisanat, recherche, mission, entraînement, apprentissage, exploration, commerce) and the action framework behind them
- Every world component other than the character: origins, professions, talents, monsters, regions, factions, objects, recettes, tags, loot tables, quest chains, areas, climats, reliefs, adventure zones
- The whole creator dashboard and its per-component CRUD pages
- The character screen's banner, tabs, inventory, crafting and action panel — `CharacterProfile` is a placeholder dumping the raw character document
