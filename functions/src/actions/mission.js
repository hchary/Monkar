// Handler for the "Mission" action (docs/TODO.md "Rumor and mission system"), registered under
// the shared "mission" handlerId, the sole Aventure-branch action drawing on generated content
// since "Partir en quête" was retired (docs/TODO.md "Retiring quests and quest objectives for the
// subject-action system"). A mission is not hand-authored the way a quest was: the player picks
// one entry from their own character.missionJournal (generated earlier by the "recherche" handler,
// see recherche.js), passed in as payload.missionId exactly like artisanat.js's payload.recetteId.
//
// Resolution is now assembled here rather than delegated to a wrapper (docs/TODO.md "ActionResult
// and the single applier", which deleted functions/src/missionResolution.js): the d100 engine
// (lib/missionResolution.js) says whether it succeeded and what it cost, the talent roll
// (lib/talentEvolution.js) and the loot draw (missionLoot.js) say what it granted, and every one of
// those effects goes into one ActionResult that lib/actionResult.js's applier writes onto the
// character. The handler itself only owns what the effect vocabulary has no word for: the mission
// journal and the quest chain's progress.
//
// A mission carries no objective document of its own: its title and tags are already assembled at
// generation time (see recherche.js), so the talent roll matches against the mission's own tagIds
// and reads its rarity from its difficulty (missionLoot.js's difficultyToRarity). No outcome is
// narrated anywhere any more (docs/TODO.md "Narration removal"), so the result pop-up shows only
// "Succès"/"Échec".

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { resolveMission } = require("../lib/missionResolution");
const { rollTalentEvolutionIds } = require("../lib/talentEvolution");
const { rollReputationReward } = require("../lib/reputation");
const { createActionResult, applyActionResult } = require("../lib/actionResult");
const { drawMissionLoot, difficultyToRarity } = require("../missionLoot");
const { findChainAdvance } = require("../lib/questChains");

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

  const [lootTablesSnap, objectsSnap, talentsSnap, chainsSnap] = await Promise.all([
    db.collection("worldData").doc("lootTables").collection("items").get(),
    db.collection("worldData").doc("objects").collection("items").get(),
    db.collection("worldData").doc("talents").collection("items").get(),
    db.collection("worldData").doc("questChains").collection("items").get(),
  ]);
  const lootTables = lootTablesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const objects = objectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const talents = talentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const chains = chainsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { mission, locationName, lootTables, objects, talents, chains };
}

async function resolve({ character, actionTypeId, today, context }) {
  const { mission, locationName, lootTables, objects, talents, chains } = context;

  const tagIds = mission.tagIds || [];
  const circumstance = `lors de la mission « ${mission.name} »`;
  const outcome = resolveMission({ character, tagIds, difficulty: mission.difficulty });

  // Talent luck is gated on the mission succeeding, exactly as it always was - only the selection
  // and the application are now two separate steps.
  const { trainedIds, gainedIds } = outcome.success
    ? rollTalentEvolutionIds({
        characterTalents: character.talents || [],
        catalogTalents: talents,
        tagIds,
        objectiveRarity: difficultyToRarity(mission.difficulty),
        difficulty: mission.difficulty,
      })
    : { trainedIds: [], gainedIds: [] };

  const loot = drawMissionLoot({
    difficulty: mission.difficulty,
    tagIds,
    lootTables,
    objects,
    // Rewards on failure: loot drawn the same way, just two rarity ranks below, floored at
    // "commun" - and no reputation, no talent luck.
    rarityOffset: outcome.success ? 0 : 2,
  });

  const result = createActionResult({
    itemsGained: loot,
    talentsGained: gainedIds,
    talentTrained: trainedIds,
    reputationGained: outcome.success ? rollReputationReward(mission.difficulty) : 0,
    injury: outcome.injury,
  });

  const { updates: effects } = applyActionResult(character, result, {
    today,
    circumstance,
    talentCatalog: talents,
  });
  const { lastAction: effectSummary = {}, ...stateUpdates } = effects;

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
    ...stateUpdates,
    lastAction: {
      actionTypeId,
      date: today,
      success: outcome.success,
      // The *raised* roll - the number the engine actually compared against the threshold, and the
      // one the pop-up's "Jet : X (seuil de réussite : Y)" line has to show for the comparison to
      // read true. The raw 0..99 roll and the talent bonus that raised it are kept alongside for
      // docs/TODO.md "Result pop-up rework" to display separately if it wants them.
      score: outcome.updatedRoll,
      roll: outcome.roll,
      talentBonus: outcome.relevantSum,
      threshold: outcome.threshold,
      narrativeText: "",
      mission: missionSummary,
      ...effectSummary,
      accent: mission.difficulty ? { kind: "difficulty", value: mission.difficulty } : null,
    },
  };

  // Composite quests (docs/TODO.md "Composite quests", ported by "Retiring quests and quest
  // objectives for the subject-action system"): a successful step advances its chain and, unless
  // it was the chain's last step, grants the next one through the same triggeredSubjectIds
  // arrayUnion convention functions/src/lib/questTriggers.js's scheduled sweep already uses for a
  // normal trigger match - reusing the whole reveal/notification pipeline for free. Chain progress
  // is handler-specific state: the ActionResult vocabulary has no word for it, and docs/TODO.md
  // "Quest chains on monsters" is what re-keys it off the monster.
  if (outcome.success) {
    const advance = findChainAdvance({ subjectId: mission.subjectId, difficulty: mission.difficulty, chains: chains || [] });
    if (advance) {
      updates.questChainProgress = { ...(character.questChainProgress || {}), [advance.chainId]: advance.nextStepIndex };
      if (advance.nextSubjectId) updates.triggeredSubjectIds = FieldValue.arrayUnion(advance.nextSubjectId);
    }
  }

  const logFields = {
    success: outcome.success,
    narrativeText: "",
    mission: missionSummary,
  };

  return { updates, logFields };
}

// Identical in shape to the other Aventure handlers' own commit() - turns the loot frozen onto
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
