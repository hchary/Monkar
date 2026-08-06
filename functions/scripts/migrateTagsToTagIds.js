// One-off admin script: node scripts/migrateTagsToTagIds.js
// Uses Application Default Credentials (run `gcloud auth application-default login` first).
//
// Part of the "Tag system unification (tagIds vs free-text tags)" change (docs/TODO.md): moves
// worldData/narrativeSubjects/items and worldData/verbPhrases/items off their free-text `tags`
// string arrays onto `tagIds`, the same worldData/tags/items id-based catalog every other tagged
// collection already uses. For each free-text tag name found, resolves (or creates) a matching
// worldData/tags/items doc by exact name, then rewrites the document's `tagIds` (merging with any
// ids it already carried - narrativeSubjects acting as quest objectives already had real tagIds
// from QuestObjectivesManager.jsx) and deletes the old `tags` field.
//
// The reserved "objectif de quête" sentinel (functions/src/actions/rumeur.js's OBJECTIVE_TAG_ID,
// src/components/creator/QuestObjectivesManager.jsx's OBJECTIVE_TAG_ID) is special-cased onto a
// fixed tag doc id ("objectif-de-quete") instead of a name lookup, so every consumer can reference
// it without a name-resolution step.
const admin = require("firebase-admin");

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "monkar-rpg" });
const db = admin.firestore();

const OBJECTIVE_TAG_NAME = "objectif de quête";
const OBJECTIVE_TAG_ID = "objectif-de-quete";

async function ensureObjectiveTag() {
  const ref = db.collection("worldData").doc("tags").collection("items").doc(OBJECTIVE_TAG_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ name: OBJECTIVE_TAG_NAME });
    console.log(`Created reserved tag doc ${OBJECTIVE_TAG_ID} ("${OBJECTIVE_TAG_NAME}").`);
  }
}

// Builds a name -> id map from the existing catalog, creating a new tag doc for any free-text name
// encountered that has no matching entry yet (exact, case-sensitive match - free-text tags were
// always documented as needing to be spelled identically to the catalog name).
function makeTagResolver(existingTags) {
  const byName = new Map(existingTags.map((t) => [t.name, t.id]));
  const itemsRef = db.collection("worldData").doc("tags").collection("items");

  return async function resolveTagId(name) {
    if (name === OBJECTIVE_TAG_NAME) return OBJECTIVE_TAG_ID;
    const existing = byName.get(name);
    if (existing) return existing;

    const ref = itemsRef.doc();
    await ref.set({ name });
    byName.set(name, ref.id);
    console.log(`Created tag doc for "${name}" (${ref.id}).`);
    return ref.id;
  };
}

async function migrateCollection(collectionName, resolveTagId) {
  const itemsRef = db.collection("worldData").doc(collectionName).collection("items");
  const snap = await itemsRef.get();

  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!("tags" in data)) continue; // already migrated, or never had free-text tags

    const freeTextTags = data.tags || [];
    const resolvedIds = [];
    for (const name of freeTextTags) {
      resolvedIds.push(await resolveTagId(name));
    }
    const mergedTagIds = [...new Set([...(data.tagIds || []), ...resolvedIds])];

    const update = { tags: admin.firestore.FieldValue.delete() };
    // verbPhrases.tagIds is optional and omitted entirely when empty (see shared/schema/verbPhrase.ts);
    // narrativeSubjects.tagIds always defaults to [] so it's fine to always write it there.
    if (mergedTagIds.length > 0 || collectionName === "narrativeSubjects") {
      update.tagIds = mergedTagIds;
    }
    await doc.ref.update(update);
    updated++;
  }

  console.log(`Updated ${updated}/${snap.size} ${collectionName} documents.`);
}

async function migrate() {
  await ensureObjectiveTag();

  const tagsSnap = await db.collection("worldData").doc("tags").collection("items").get();
  const existingTags = tagsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const resolveTagId = makeTagResolver(existingTags);

  await migrateCollection("narrativeSubjects", resolveTagId);
  await migrateCollection("verbPhrases", resolveTagId);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
