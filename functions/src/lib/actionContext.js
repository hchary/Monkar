// Assembles what evaluateConditions needs beyond the character document itself.
//
// Server-only (it reads Firestore), unlike the pure evaluator it feeds - the client builds the
// same context from its own snapshots.

const { conditionsNeedInstances, conditionsNeedTrainerReachability } = require("./actionConditions");

// The owned-instance tag set costs two extra queries, so it is only loaded when a condition
// actually asks for it - no action does today, making this free in the common case.
//
// Tags are resolved through the object catalog rather than per instance: an instance stores only
// its objectId, so one collection read beats one lookup per owned item.
async function buildInstanceTagIds(db, characterId) {
  const [instancesSnap, objectsSnap] = await Promise.all([
    db.collection("instances").where("characterId", "==", characterId).get(),
    db.collection("worldData").doc("objects").collection("items").get(),
  ]);

  const tagIdsByObjectId = new Map(objectsSnap.docs.map((d) => [d.id, d.data().tagIds || []]));
  const instanceTagIds = new Set();
  for (const doc of instancesSnap.docs) {
    for (const tagId of tagIdsByObjectId.get(doc.data().objectId) || []) instanceTagIds.add(tagId);
  }
  return instanceTagIds;
}

// The trainerTypeIds reachable from the character's current region: every worldData/trainerTypes/
// items entry whose locationId is one of region.adventureZoneIds - the same reachability
// precedent functions/src/actions/rumeur.js's prepare() already uses (region doc ->
// adventureZoneIds). A character with no region reaches nothing, same fail-closed convention an
// absent instanceTagIds set uses. Only loaded when a condition actually asks for it.
async function buildReachableTrainerTypeIds(db, character) {
  const regionId = character?.region?.id;
  if (!regionId) return new Set();

  const [regionSnap, trainerTypesSnap] = await Promise.all([
    db.collection("worldData").doc("regions").collection("items").doc(regionId).get(),
    db.collection("worldData").doc("trainerTypes").collection("items").get(),
  ]);
  const adventureZoneIds = regionSnap.exists ? regionSnap.data().adventureZoneIds || [] : [];

  const reachable = new Set();
  for (const doc of trainerTypesSnap.docs) {
    if (adventureZoneIds.includes(doc.data().locationId)) reachable.add(doc.id);
  }
  return reachable;
}

async function buildConditionContext({ db, character, characterId, conditions }) {
  const [instanceTagIds, reachableTrainerTypeIds] = await Promise.all([
    conditionsNeedInstances(conditions) ? buildInstanceTagIds(db, characterId) : Promise.resolve(new Set()),
    conditionsNeedTrainerReachability(conditions)
      ? buildReachableTrainerTypeIds(db, character)
      : Promise.resolve(new Set()),
  ]);

  return { character, instanceTagIds, reachableTrainerTypeIds };
}

module.exports = { buildConditionContext };
