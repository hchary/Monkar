// Assembles what evaluateConditions needs beyond the character document itself.
//
// Server-only (it reads Firestore), unlike the pure evaluator it feeds - the client builds the
// same context from its own snapshots.

const { conditionsNeedInstances } = require("./actionConditions");

// The owned-instance tag set costs two extra queries, so it is only loaded when a condition
// actually asks for it - no action does today, making this free in the common case.
//
// Tags are resolved through the object catalog rather than per instance: an instance stores only
// its objectId, so one collection read beats one lookup per owned item.
async function buildConditionContext({ db, character, characterId, conditions }) {
  if (!conditionsNeedInstances(conditions)) return { character, instanceTagIds: new Set() };

  const [instancesSnap, objectsSnap] = await Promise.all([
    db.collection("instances").where("characterId", "==", characterId).get(),
    db.collection("worldData").doc("objects").collection("items").get(),
  ]);

  const tagIdsByObjectId = new Map(objectsSnap.docs.map((d) => [d.id, d.data().tagIds || []]));
  const instanceTagIds = new Set();
  for (const doc of instancesSnap.docs) {
    for (const tagId of tagIdsByObjectId.get(doc.data().objectId) || []) instanceTagIds.add(tagId);
  }

  return { character, instanceTagIds };
}

module.exports = { buildConditionContext };
