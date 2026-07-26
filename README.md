# Monkar — daily text RPG

Web game where each player picks one action per day for their character (quest, rest, training, shopping...), with a server-side random roll for the outcome. Front hosted on GitHub Pages, backend on Firebase (Auth, Firestore, Cloud Functions).

## Stack
- **Front**: React + Vite
- **Backend**: Firebase Auth, Firestore, Cloud Functions
- **Front hosting**: GitHub Pages (automatic deployment via GitHub Actions)

## Project structure
```
src/
  lib/firebase.js        Firebase client config
  context/AuthContext.jsx global auth state
  components/             shared components (ProtectedRoute...)
  pages/                  Login, Signup, CharacterProfile, CreatorDashboard
functions/
  src/index.js            performAction Cloud Function (roll + daily lock)
  scripts/setCreatorRole.js admin script to grant yourself the "creator" role
firestore.rules            Firestore security rules
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
2. Get your `uid` (Firebase Console → Authentication → Users).
3. Download a service account key: Project settings → Service accounts → "Generate new private key", save it as `functions/serviceAccountKey.json` (already gitignored, never commit this file).
4. Run:
```bash
cd functions
node scripts/setCreatorRole.js <your-uid>
```
5. Log out/back in on the site for the new role to take effect.

### 6. Seed the world's starting data
In Firestore, manually create (or via a future admin screen) at least one document in `worldData/actionTypes/items/{id}` shaped like:
```json
{
  "label": "Partir en quête",
  "tiers": [
    { "name": "Échec", "weight": 20, "bonuses": {}, "narrativeText": "La quête tourne court." },
    { "name": "Réussite", "weight": 60, "bonuses": { "force": 1 }, "narrativeText": "Tu reviens victorieux." },
    { "name": "Exploit", "weight": 20, "bonuses": { "force": 3 }, "narrativeText": "Un exploit mémorable !" }
  ]
}
```
(`weight` = relative weight out of 100 total for the random roll. `label`, tier `name`s, and `narrativeText` are in-game content, written in French.)

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

## Current status (Phase 0 complete)
- Done: email/password auth + character creation
- Done: character profile page + daily action list
- Done: `performAction` Cloud Function with daily lock and weighted roll
- Done: Firestore rules (player = own data only, creator = everything)
- Pending: creator dashboard page exists but the CRUD (factions, regions, gods, creatures) isn't built yet
- Pending: narrative texts, visual theme, roll balancing
