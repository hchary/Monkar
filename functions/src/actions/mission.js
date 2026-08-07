// Handler for the "Mission" action (docs/TODO.md "Rumor and mission system"), registered under
// the shared "mission" handlerId, the sole Aventure-branch action drawing on generated content
// since "Partir en quête" was retired (docs/TODO.md "Retiring quests and quest objectives for the
// subject-action system"). A mission is not hand-authored the way a quest was: the player picks
// one entry from their own character.missionJournal (generated earlier by the "recherche" handler,
// see recherche.js), passed in as payload.missionId exactly like artisanat.js's payload.recetteId.
//
// Resolution reuses missionResolution.js's resolveQuestOutcome (score roll, talent-evolution
// pipeline) wholesale rather than duplicating it - except for loot, which is drawn through
// missionLoot.js's drawMissionLoot instead (docs/TODO.md "Mission loot and rarity mapping"): a
// mission's loot pool is resolved once per occurrence from its own tagIds/rarity, not re-rolled per
// item against a curated objectives list the way the retired drawQuestLoot works. Rewards use the
// mission's own drawn difficulty exactly, the same way a quest used to use quest.difficulty.
//
// A mission carries no worldData/narrativeSubjects/items objective of its own (docs/TODO.md
// "Regional mission generation and journal" draws from the missionSubjects/missionActions catalog
// pair instead, and the mission's title is already assembled at generation time - see recherche.js).
// The threshold/wound/talent-evolution pipeline, which expects an "objective"-shaped
// { tagIds, rarity } for its own tag/rank matching, is instead fed a synthetic stand-in built from
// the mission's own tagIds and its difficulty's rarity equivalence (missionLoot.js's
// difficultyToRarity). A mission's outcome is never narrated via the verb-phrase generator (docs/
// TODO.md "Retiring quests..." - that paragraph retired along with the hand-authored catalog it
// used to link successPhraseIds/failurePhraseIds from): resolveQuestOutcome is called with
// narrate: false, so the result pop-up shows only "Succès"/"Échec", same as other non-narrated
// actions.

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { resolveQuestOutcome } = require("../missionResolution");
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
    lootTables,
    objects,
    talents,
    locationName,
    today,
    circumstance: `lors de la mission « ${mission.name} »`,
    narrate: false,
    defaultSuccessText: "",
    defaultSuccessClause: "vous revenez de votre mission",
    defaultFailureText: "",
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

  // Composite quests (docs/TODO.md "Composite quests", ported by "Retiring quests and quest
  // objectives for the subject-action system"): a successful step advances its chain and, unless
  // it was the chain's last step, grants the next one through the same triggeredSubjectIds
  // arrayUnion convention functions/src/lib/questTriggers.js's scheduled sweep already uses for a
  // normal trigger match - reusing the whole reveal/notification pipeline for free.
  if (outcome.success) {
    const advance = findChainAdvance({ subjectId: mission.subjectId, difficulty: mission.difficulty, chains: chains || [] });
    if (advance) {
      updates.questChainProgress = { ...(character.questChainProgress || {}), [advance.chainId]: advance.nextStepIndex };
      if (advance.nextSubjectId) updates.triggeredSubjectIds = FieldValue.arrayUnion(advance.nextSubjectId);
    }
  }

  const logFields = {
    success: outcome.success,
    narrativeText: outcome.narrativeText,
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
