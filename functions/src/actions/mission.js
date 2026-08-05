// Handler for the "Mission" action (docs/TODO.md "Rumor and mission system"), registered under
// the shared "mission" handlerId - a sibling of partirEnQuete's "partirEnQuete" handlerId under
// the same Aventure kind. A mission is not hand-authored the way a quest is: the player picks one
// entry from their own character.missionJournal (generated earlier by the "rumeur" handler, see
// rumeur.js), passed in as payload.missionId exactly like artisanat.js's payload.recetteId.
//
// Resolution reuses partirEnQuete.js's own resolveQuestOutcome (score roll, narration, loot,
// talent-evolution pipeline) wholesale rather than duplicating it, treating the mission journal
// entry as a single-objective, unnamed "quest" shape. Rewards use the mission's own drawn
// difficulty exactly, the same way a quest uses quest.difficulty - the earlier "one tier lower,
// clamped at facile" reward discount was a balance mistake (docs/TODO.md "Mission and quest
// resolution algorithm") and has been removed, not preserved.

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { resolveQuestOutcome } = require("./partirEnQuete");

async function prepare({ db, character, payload }) {
  const missionId = payload?.missionId;
  if (!missionId) throw new HttpsError("invalid-argument", "missionId is required.");

  const mission = (character.missionJournal || []).find((m) => m.id === missionId);
  if (!mission) {
    throw new HttpsError("failed-precondition", "Cette mission n'est plus disponible.");
  }

  let locationName = null;
  if (mission.locationId) {
    const locationSnap = await db
      .collection("worldData")
      .doc("adventureZones")
      .collection("items")
      .doc(mission.locationId)
      .get();
    if (locationSnap.exists) locationName = locationSnap.data().name || null;
  }

  const [narrativeSubjectsSnap, verbPhrasesSnap, lootTablesSnap, objectsSnap, talentsSnap, tagsSnap] = await Promise.all([
    db.collection("worldData").doc("narrativeSubjects").collection("items").get(),
    db.collection("worldData").doc("verbPhrases").collection("items").get(),
    db.collection("worldData").doc("lootTables").collection("items").get(),
    db.collection("worldData").doc("objects").collection("items").get(),
    db.collection("worldData").doc("talents").collection("items").get(),
    db.collection("worldData").doc("tags").collection("items").get(),
  ]);
  const narrativeSubjects = narrativeSubjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const verbPhrases = verbPhrasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lootTables = lootTablesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const objects = objectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const talents = talentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const tags = tagsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Missions carry a single objectiveId rather than a curated list (see rumeur.js) - resolved
  // here so resolve() below can fail closed if the narrativeSubject it points to was deleted
  // between generation and resolution, instead of narrating with nothing.
  const objective = narrativeSubjects.find((s) => s.id === mission.objectiveId) || null;

  return { mission, objective, locationName, narrativeSubjects, verbPhrases, lootTables, objects, talents, tags };
}

async function resolve({ character, actionTypeId, today, context }) {
  const { mission, objective, locationName, narrativeSubjects, verbPhrases, lootTables, objects, talents, tags } = context;

  if (!objective) {
    throw new HttpsError("failed-precondition", "L'objectif de cette mission n'existe plus.");
  }

  const questObjectives = [objective];
  const tagsByIdName = new Map((tags || []).map((tag) => [tag.id, tag.name]));

  // The shape every reused partirEnQuete helper expects - a mission has no catalog name, so the
  // drawn objective's own noun stands in for one (only used for the {quete} narration placeholder
  // and the talent-evolution circumstance text below).
  const missionName = objective.nom ? objective.nom.charAt(0).toUpperCase() + objective.nom.slice(1) : "mission";
  const missionAsQuest = {
    id: mission.id,
    name: missionName,
    tagIds: mission.tagIds || [],
    locationId: mission.locationId || null,
    difficulty: mission.difficulty,
  };

  const outcome = resolveQuestOutcome({
    character,
    quest: missionAsQuest,
    questObjectives,
    narrativeSubjects,
    verbPhrases,
    lootTables,
    objects,
    talents,
    tagsByIdName,
    locationName,
    today,
    circumstance: `lors de la mission « ${missionName} »`,
    defaultSuccessText: "Vous revenez de votre mission.",
    defaultSuccessClause: "vous revenez de votre mission",
    defaultFailureText: "Vous rentrez bredouille de votre mission.",
    defaultFailureClause: "vous rentrez bredouille de votre mission",
  });

  const missionSummary = {
    id: mission.id,
    name: missionName,
    difficulty: mission.difficulty,
    locationId: mission.locationId || null,
    locationName,
  };

  const updates = {
    lastActionDate: today,
    lastActionAt: FieldValue.serverTimestamp(),
    // Resolving a mission removes it from the rolling offer - any other unclaimed missions stay.
    missionJournal: (character.missionJournal || []).filter((m) => m.id !== mission.id),
    lastAction: {
      actionTypeId,
      date: today,
      success: outcome.success,
      score: outcome.score,
      threshold: outcome.threshold,
      wound: outcome.wound,
      reputationGained: outcome.reputationGained,
      narrativeText: outcome.narrativeText,
      mission: missionSummary,
      loot: outcome.loot,
      talentEvolutions: outcome.talentEvolutions,
      accent: mission.difficulty ? { kind: "difficulty", value: mission.difficulty } : null,
    },
  };

  if (outcome.talentEvolutions.length > 0) updates.talents = outcome.nextTalents;
  if (outcome.reputationGained > 0) updates.reputation = (character.reputation || 0) + outcome.reputationGained;
  if (outcome.woundResult) {
    updates.woundsLight = outcome.woundResult.woundsLight;
    updates.woundsSevere = outcome.woundResult.woundsSevere;
    updates.woundsPermanent = outcome.woundResult.woundsPermanent;
    if (outcome.woundResult.died) updates.alive = false;
  }

  const logFields = {
    success: outcome.success,
    narrativeText: outcome.narrativeText,
    mission: missionSummary,
  };

  return { updates, logFields };
}

// Identical in shape to partirEnQuete.js's commit() - turns the loot frozen onto
// lastAction.loot during resolve() into Instance documents the character actually owns.
async function commit({ tx, db, characterRef, lastAction, uid, today }) {
  for (const item of lastAction.loot || []) {
    const instanceRef = db.collection("instances").doc();
    tx.set(instanceRef, {
      objectId: item.objectId,
      characterId: characterRef.id,
      ownerUid: uid,
      acquisitionDate: today,
      condition: "neuf",
      description: item.description,
    });
  }
}

module.exports = { prepare, resolve, commit };
