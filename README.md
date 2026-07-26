# Jeu de rôle textuel — quotidien

Jeu web où chaque joueur choisit une action par jour pour son personnage (quête, repos, entraînement, shopping...), avec un résultat tiré aléatoirement côté serveur. Front hébergé sur GitHub Pages, backend sur Firebase (Auth, Firestore, Cloud Functions).

## Stack
- **Front** : React + Vite
- **Backend** : Firebase Auth, Firestore, Cloud Functions
- **Hébergement front** : GitHub Pages (déploiement automatique via GitHub Actions)

## Structure du projet
```
src/
  lib/firebase.js        config client Firebase
  context/AuthContext.jsx état d'authentification global
  components/             composants partagés (ProtectedRoute...)
  pages/                  Login, Signup, CharacterProfile, CreatorDashboard
functions/
  src/index.js            Cloud Function performAction (tirage + verrou quotidien)
  scripts/setCreatorRole.js script admin pour se donner le rôle "créateur"
firestore.rules            règles de sécurité Firestore
```

## Mise en place (étapes manuelles)

### 1. Créer le projet Firebase
1. Aller sur https://console.firebase.google.com, créer un nouveau projet.
2. Activer **Authentication** → méthode Email/Password (et Google si voulu).
3. Activer **Firestore Database** (mode production).
4. Dans "Paramètres du projet" → section "Vos applications" → ajouter une app Web, récupérer la config (`apiKey`, `authDomain`, etc.).

### 2. Configurer les variables d'environnement locales
Copier `.env.example` en `.env` et remplir avec les valeurs de la config Firebase :
```bash
cp .env.example .env
```

### 3. Installer les dépendances et lancer en local
```bash
npm install
npm run dev
```

### 4. Déployer les règles Firestore et les Cloud Functions
Nécessite le CLI Firebase (`npm install -g firebase-tools`, puis `firebase login`).
```bash
firebase use --add          # sélectionner le projet Firebase créé
firebase deploy --only firestore:rules
cd functions && npm install && cd ..
firebase deploy --only functions
```

### 5. Se donner le rôle créateur
1. Créer ton compte joueur normalement via l'écran d'inscription du site.
2. Récupérer ton `uid` (Firebase Console → Authentication → Users).
3. Télécharger une clé de compte de service : Paramètres du projet → Comptes de service → "Générer une nouvelle clé privée", sauvegarder sous `functions/serviceAccountKey.json` (déjà ignoré par git, ne jamais committer ce fichier).
4. Lancer :
```bash
cd functions
node scripts/setCreatorRole.js <ton-uid>
```
5. Se déconnecter/reconnecter sur le site pour que le nouveau rôle soit pris en compte.

### 6. Créer les données de départ du monde
Dans Firestore, créer manuellement (ou via un futur écran admin) au moins un document dans `worldData/actionTypes/items/{id}` avec cette forme :
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
(`weight` = poids relatif sur 100 au total pour le tirage aléatoire)

### 7. Déploiement GitHub Pages
1. Créer le repo sur GitHub et pousser ce projet sur la branche `main`.
2. Dans les Settings du repo GitHub → Pages → Source : choisir **GitHub Actions**.
3. Dans Settings → Secrets and variables → Actions, ajouter les secrets suivants (mêmes valeurs que le `.env` local) :
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Chaque push sur `main` déclenche le build et le déploiement automatique (voir `.github/workflows/deploy.yml`).

## État actuel (Phase 0 terminée)
- ✅ Auth email/password + création de personnage
- ✅ Profil personnage + liste des actions du jour
- ✅ Cloud Function `performAction` avec verrou quotidien et tirage pondéré
- ✅ Règles Firestore (joueur = ses propres données, créateur = tout)
- ⏳ Espace créateur : page présente mais CRUD (factions, régions, dieux, créatures) pas encore implémenté
- ⏳ Textes narratifs, thème visuel, équilibrage des tirages
