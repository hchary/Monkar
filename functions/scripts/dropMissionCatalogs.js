// One-off admin script: node scripts/dropMissionCatalogs.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Part of the "Content migration scripts" change (docs/TODO.md): deletes the two catalogs the
// retired subject-action mission generation read, now that the bestiary replaces them.
//
//   worldData/missionSubjects/items   -- the "what the mission is about" half
//   worldData/missionActions/items    -- the "what you do to it" half
//
// DO NOT RUN THIS YET. Unlike the other scripts in this change, this one is destructive AND early:
// three live code paths still read worldData/missionSubjects/items as of this writing -
// functions/src/actions/recherche.js (mission generation), functions/src/lib/questTriggers.js (the
// Interval trigger sweep) and src/components/actions/ActionResultDialog.jsx (the notification page).
// They are all repointed at the bestiary by docs/TODO.md "Mission generation from the bestiary";
// deleting the collections before that lands leaves every character with an empty mission journal.
//
// The order this is safe in:
//   1. scripts/migrateSubjectsToMonsters.js       (carry the content onto worldData/monsters/items)
//   2. scripts/migrateTriggeredSubjectsToMonsters.js
//   3. re-author worldData/questChains/items steps[].subjectId as steps[].monsterId - by hand, no
//      script: the same call the previous migration made for chains authored against `quests`
//   4. ship docs/TODO.md "Mission generation from the bestiary"
//   5. this script
//
// The parent worldData/missionSubjects and worldData/missionActions documents are deleted too when
// they exist as real documents rather than the empty ancestors Firestore reports for a subcollection
// path - same handling as scripts/dropNarrativeCollections.js.
//
// Like every script in this directory, this is generated, reviewed and run by hand - never invoked
// from app code. It is destructive and not reversible: take a Firestore export first if the authored
// catalogs are worth keeping outside the game.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

const COLLECTIONS = ["missionSubjects", "missionActions"];

// Batched deletes, 400 at a time - under Firestore's 500-write batch limit with room to spare, the
// same margin dropNarrativeCollections.js and seedWorldData.js keep for their own writes.
const BATCH_SIZE = 400;

async function dropCollection(collectionName) {
  const itemsRef = db.collection("worldData").doc(collectionName).collection("items");
  const snap = await itemsRef.get();

  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH_SIZE)) batch.delete(doc.ref);
    await batch.commit();
  }

  const parentRef = db.collection("worldData").doc(collectionName);
  const parentSnap = await parentRef.get();
  if (parentSnap.exists) await parentRef.delete();

  console.log(`Deleted ${snap.size} ${collectionName} documents.`);
}

async function drop() {
  for (const collectionName of COLLECTIONS) await dropCollection(collectionName);
}

drop()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
