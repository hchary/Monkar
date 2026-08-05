// One-off admin script: node scripts/migrateActionDurationTo12h.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Part of the Interval (12h action cycle) change: DEFAULT_DURATION_HOURS dropped from 24 to 12
// (functions/src/lib/actionLifecycle.js), but that only affects documents that don't carry an
// explicit durationHours. This migrates already-authored worldData/actionTypes/items documents
// relying on the old default onto the new one, so every action actually takes half as long
// starting right after this runs - see "Interval (12h action cycle)" in docs/TODO.md.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

async function migrate() {
  const itemsRef = db.collection("worldData").doc("actionTypes").collection("items");
  const snap = await itemsRef.get();

  let updated = 0;
  for (const doc of snap.docs) {
    const current = doc.data().durationHours;
    // Only touch documents relying on the old default (absent, or explicitly 24) - an action
    // deliberately authored with a different duration (e.g. 6h, 48h) is a real override and stays.
    if (current === undefined || current === 24) {
      await doc.ref.update({ durationHours: 12 });
      updated++;
    }
  }

  console.log(`Updated ${updated}/${snap.size} action types to durationHours: 12.`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
