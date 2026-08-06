// Handler for the "Partir explorer" action (docs/TODO.md "Aventure exploration mechanics"),
// registered under the shared "partirExplorer" handlerId - a second, sibling Aventure-branch
// action alongside partirEnQuete.js's "Partir en quête" and mission.js's "Mission", not a
// replacement for either.
//
// Draws one worldData/adventureZones/items location at random from the character's current
// region, once per action occurrence, then resolves actionType.encounterCount independent rounds
// of partirEnQuete.js's own resolveQuestOutcome against a synthetic, in-memory pseudo-quest built
// from that location - the same shared score-roll engine "Partir en quête"/"Mission" already use,
// called in a loop instead of once. No second consequence roller, no new encounter catalog: quest
// objectives are drawn from the same "objectif de quête" pool every other generated content
// (missions) already reuses, filtered by the location's own tagIds when it has any.

const { FieldValue } = require("firebase-admin/firestore");
const { rollWeighted } = require("../lib/rolls");
const { pickRandom } = require("../lib/loot");
const { resolveQuestOutcome, DEFAULT_QUEST_DIFFICULTY_WEIGHTS } = require("./partirEnQuete");

// Same reserved tag id QuestObjectivesManager.jsx's OBJECTIVE_TAG_ID forces onto every quest
// objective it authors - duplicated as a literal here rather than imported, same convention as
// rumeur.js (functions/ shares no build step with the Vite app).
const OBJECTIVE_TAG_ID = "objectif-de-quete";

async function prepare({ db, character }) {
  const regionId = character.region?.id || null;
  const regionSnap = regionId
    ? await db.collection("worldData").doc("regions").collection("items").doc(regionId).get()
    : null;
  const adventureZoneIds = (regionSnap?.exists && regionSnap.data().adventureZoneIds) || [];

  // A location with no candidates (region has none authored yet) is a content gap, not an error -
  // the action still runs, its encounter pool just stays unfiltered by location tags (see resolve).
  const locationId = pickRandom(adventureZoneIds);
  let location = null;
  if (locationId) {
    const locationSnap = await db
      .collection("worldData")
      .doc("adventureZones")
      .collection("items")
      .doc(locationId)
      .get();
    if (locationSnap.exists) location = { id: locationSnap.id, ...locationSnap.data() };
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

  return { location, narrativeSubjects, verbPhrases, lootTables, objects, talents };
}

async function resolve({ character, actionType, actionTypeId, today, context }) {
  const { location, narrativeSubjects, verbPhrases, lootTables, objects, talents } = context;

  const locationName = location?.name || null;
  const locationTagIds = location?.tagIds || [];
  const objectivePool = narrativeSubjects.filter((s) => (s.tagIds || []).includes(OBJECTIVE_TAG_ID));
  const questObjectives =
    locationTagIds.length > 0
      ? objectivePool.filter((o) => (o.tagIds || []).some((id) => locationTagIds.includes(id)))
      : objectivePool;

  const difficultyWeights = actionType.questDifficultyWeights || DEFAULT_QUEST_DIFFICULTY_WEIGHTS;
  const encounterCount = Number(actionType.encounterCount) || 1;
  const circumstance = locationName ? `lors d'une exploration à ${locationName}` : "lors d'une exploration";

  // Threaded forward each round so a mid-run talent evolution or escalating wound state genuinely
  // affects the next round's threshold/wound math, instead of every round rolling against the
  // character's pre-action snapshot (docs/TODO.md "Aventure exploration mechanics").
  let roundCharacter = character;
  const rounds = [];
  const loot = [];
  const talentEvolutions = [];
  let totalReputationGained = 0;
  let anyWound = false;
  let died = false;
  let lastNarrativeText = null;

  for (let i = 0; i < encounterCount; i++) {
    const difficulty = rollWeighted(difficultyWeights)?.difficulty || null;
    const quest = {
      id: `${actionTypeId}-round-${i}`,
      name: locationName || "exploration",
      tagIds: locationTagIds,
      locationId: location?.id || null,
      difficulty,
    };

    const outcome = resolveQuestOutcome({
      character: roundCharacter,
      quest,
      questObjectives,
      narrativeSubjects,
      verbPhrases,
      lootTables,
      objects,
      talents,
      locationName,
      today,
      circumstance,
      defaultSuccessText: "Vous triomphez d'une rencontre.",
      defaultSuccessClause: "vous triomphez d'une rencontre",
      defaultFailureText: "Vous échouez face à une rencontre.",
      defaultFailureClause: "vous échouez face à une rencontre",
    });

    rounds.push({
      objectiveId: outcome.objective?.id || null,
      difficulty,
      score: outcome.score,
      threshold: outcome.threshold,
      success: outcome.success,
      wound: outcome.wound,
      reputationGained: outcome.reputationGained,
    });

    loot.push(...outcome.loot);
    talentEvolutions.push(...outcome.talentEvolutions);
    totalReputationGained += outcome.reputationGained;
    lastNarrativeText = outcome.narrativeText;
    roundCharacter = { ...roundCharacter, talents: outcome.nextTalents };

    if (outcome.woundResult) {
      anyWound = true;
      roundCharacter = {
        ...roundCharacter,
        woundsLight: outcome.woundResult.woundsLight,
        woundsSevere: outcome.woundResult.woundsSevere,
        woundsPermanent: outcome.woundResult.woundsPermanent,
      };
      // An already-dead character doesn't draw further encounters - the loop stops immediately,
      // leaving fewer than encounterCount rounds recorded for this occurrence.
      if (outcome.woundResult.died) {
        died = true;
        break;
      }
    }
  }

  const updates = {
    lastActionDate: today,
    lastActionAt: FieldValue.serverTimestamp(),
    fatigue: (character.fatigue || 0) + rounds.length,
    lastAction: {
      actionTypeId,
      date: today,
      // At least one encounter went the character's way - the per-round detail in `rounds` is
      // what actually distinguishes a clean sweep from a costly one (docs/TODO.md "Aventure
      // exploration mechanics", "Result pop-up" left this UI/summary decision to this entry).
      success: rounds.some((r) => r.success),
      narrativeText: lastNarrativeText || "Vous n'avez rien trouvé à explorer.",
      location: location ? { id: location.id, name: location.name } : null,
      rounds,
      totalReputationGained,
      loot,
      talentEvolutions,
    },
  };

  if (talentEvolutions.length > 0) updates.talents = roundCharacter.talents;
  if (totalReputationGained > 0) updates.reputation = (character.reputation || 0) + totalReputationGained;
  if (anyWound) {
    updates.woundsLight = roundCharacter.woundsLight;
    updates.woundsSevere = roundCharacter.woundsSevere;
    updates.woundsPermanent = roundCharacter.woundsPermanent;
    if (died) updates.alive = false;
  }

  const logFields = {
    success: updates.lastAction.success,
    narrativeText: updates.lastAction.narrativeText,
    location: updates.lastAction.location,
    roundsResolved: rounds.length,
  };

  return { updates, logFields };
}

// Identical in shape to partirEnQuete.js's/mission.js's own commit() - turns the loot flattened
// onto lastAction.loot during resolve() into Instance documents the character actually owns.
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
