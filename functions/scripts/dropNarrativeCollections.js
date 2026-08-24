// One-off admin script: node scripts/dropNarrativeCollections.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Part of the "Narration removal" change (docs/TODO.md): deletes the two catalogs the retired
// procedural narrative generator read, now that nothing in the codebase does.
//
//   worldData/narrativeSubjects/items   -- the "who/what" a generated sentence was about
//   worldData/verbPhrases/items         -- the authored sentence templates it assembled
//
// Nothing references either collection any more: functions/src/textGeneration.js and its schema
// files are gone, partirExplorer.js (the last reader) no longer fetches them, and
// src/components/creator/TextGenerationManager.jsx (the only writer) is deleted. The parent
// worldData/narrativeSubjects and worldData/verbPhrases documents are deleted too when they exist
// as real documents rather than the empty ancestors Firestore reports for a subcollection path.
//
// Like every script in this directory, this is generated, reviewed and run by hand - never invoked
// from app code. It is destructive and not reversible: take a Firestore export first if the
// authored catalogs are worth keeping outside the game.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

const COLLECTIONS = ["narrativeSubjects", "verbPhrases"];

// Batched deletes, 400 at a time - under Firestore's 500-write batch limit with room to spare, the
// same margin seedWorldData.js keeps for its own writes.
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
