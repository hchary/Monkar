// Handler for the "Mission" action (docs/TODO.md "Rumor and mission system"), registered under
// the shared "mission" handlerId - a sibling of partirEnQuete's "partirEnQuete" handlerId under
// the same Aventure kind. A mission is not hand-authored the way a quest is: the player picks one
// entry from their own character.missionJournal (generated earlier by the "rumeur" handler, see
// rumeur.js), passed in as payload.missionId exactly like artisanat.js's payload.recetteId.
//
// Resolution reuses partirEnQuete.js's own resolveQuestOutcome (score roll, narration, talent-
// evolution pipeline) wholesale rather than duplicating it - except for loot, which is drawn
// through missionLoot.js's drawMissionLoot instead (docs/TODO.md "Mission loot and rarity
// mapping"): a mission's loot pool is resolved once per occurrence from its own tagIds/rarity, not
// re-rolled per item against a curated objectives list the way a quest's drawQuestLoot works.
// Rewards use the mission's own drawn difficulty exactly, the same way a quest uses
// quest.difficulty - the earlier "one tier lower, clamped at facile" reward discount was a balance
// mistake (docs/TODO.md "Mission and quest resolution algorithm") and has been removed, not
// preserved.
//
// A mission carries no worldData/narrativeSubjects/items objective of its own any more (docs/
// TODO.md "Regional mission generation and journal" replaced the old objectiveId-based draw with
// the missionSubjects/missionActions catalog pair, and the mission's title is already assembled at
// generation time - see rumeur.js). The threshold/wound/talent-evolution pipeline, which expects
// an "objective"-shaped { tagIds, rarity } for its own tag/rank matching, is instead fed a
// synthetic stand-in built from the mission's own tagIds and its difficulty's rarity equivalence
// (missionLoot.js's difficultyToRarity - the same mapping quest objectives already used). The
// narration itself still falls back to the global narrativeSubjects catalog
// (resolveQuestOutcome's own [questObjectives, narrativeSubjects] fallback, since the synthetic
// objective has no `type` field and can never itself be picked as a narration subject) - that
// catalog is unrelated to how a mission is titled.

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { resolveQuestOutcome } = require("./partirEnQuete");
const { drawMissionLoot, difficultyToRarity } = require("../missionLoot");

async function prepare({ db, character, payload }) {
  const missionId = payload?.missionId;
  if (!missionId) throw new HttpsError("invalid-argument", "missionId is required.");

  const mission = (character.missionJournal || []).find((m) => m.id === missionId);
  if (!mission) {
    throw new HttpsError("failed-precondition", "Cette mission n'est plus disponible.");
  }

  // Region-locked (docs/TODO.md "Regional mission generation and journal"): a mission stays tied
  // to the region it was generated in, even if the character has since travelled elsewhere.
  if (mission.regionId && mission.regionId !== character.region?.id) {
    throw new HttpsError(
      "failed-precondition",
      "Cette mission n'est accessible que depuis sa région d'origine."
    );
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

  const [narrativeSubjectsSnap, verbPhrasesSnap, lootTablesSnap, objectsSnap, talentsSnap] = await Promise.all([
    db.collection("worldData").doc("narrativeSubjects").collection("items").get(),
    db.collection("worldData").doc("verbPhrases").collection("items").get(),
    db.collection("worldData").doc("lootTables").collection("items").get(),
    db.collection("worldData").doc("objects").collection("items").get(),
    db.collection("worldData").doc("talents").collection("items").get(),
  ]);
  const narrativeSubjects = narrativeSubjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const verbPhrases = verbPhrasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lootTables = lootTablesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const objects = objectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const talents = talentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { mission, locationName, narrativeSubjects, verbPhrases, lootTables, objects, talents };
}

async function resolve({ character, actionTypeId, today, context }) {
  const { mission, locationName, narrativeSubjects, verbPhrases, lootTables, objects, talents } = context;

  // Stands in for the "objective" resolveQuestOutcome's threshold/wound/talent-evolution pipeline
  // expects - see the header comment above.
  const missionObjective = { tagIds: mission.tagIds || [], rarity: difficultyToRarity(mission.difficulty) };

  const missionAsQuest = {
    id: mission.id,
    name: mission.name,
    tagIds: mission.tagIds || [],
    locationId: mission.locationId || null,
    difficulty: mission.difficulty,
  };

  function drawLoot({ difficulty, lootTables: tables, objects: objectCatalog, accomplishmentMessage, rarityOffset }) {
    return drawMissionLoot({
      difficulty,
      tagIds: mission.tagIds || [],
      lootTables: tables,
      objects: objectCatalog,
      accomplishmentMessage,
      rarityOffset,
    });
  }

  const outcome = resolveQuestOutcome({
    character,
    quest: missionAsQuest,
    questObjectives: [missionObjective],
    narrativeSubjects,
    verbPhrases,
    lootTables,
    objects,
    talents,
    locationName,
    today,
    circumstance: `lors de la mission « ${mission.name} »`,
    defaultSuccessText: "Vous revenez de votre mission.",
    defaultSuccessClause: "vous revenez de votre mission",
    defaultFailureText: "Vous rentrez bredouille de votre mission.",
    defaultFailureClause: "vous rentrez bredouille de votre mission",
    drawLoot,
  });

  const missionSummary = {
    id: mission.id,
    name: mission.name,
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
