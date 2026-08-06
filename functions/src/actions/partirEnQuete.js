const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { rollWeighted, RARITY_ORDER } = require("../lib/rolls");
const { pickRandom: pickRandomLoot, drawLootTableItemId, LOOT_COUNT_BY_DIFFICULTY } = require("../lib/loot");
const { rollTalentEvolutions } = require("../lib/talentEvolution");
const { applyWound } = require("../lib/wounds");
const {
  rollScore,
  rollReputationReward,
  computeSuccessThreshold,
  computeWoundThresholds,
  determineWoundSeverity,
} = require("../lib/questResolution");
const { generateNarrative, slotOf, SLOT_ORDER } = require("../textGeneration");

const ACTION_TYPE_ID = "partir-en-quete";

const DEFAULT_QUEST_DIFFICULTY_WEIGHTS = [
  { difficulty: "facile", weight: 55 },
  { difficulty: "moyen", weight: 30 },
  { difficulty: "difficile", weight: 10 },
  { difficulty: "tres_difficile", weight: 4 },
  { difficulty: "epique", weight: 1 },
];

// Safety net in case a region's quests never carry a difficulty present in the weight
// table (e.g. only "mythique" quests) - without this the draw loop below would spin
// forever.
const MAX_DIFFICULTY_DRAWS = 50;

function pickRandom(items) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// Draws a difficulty first, then a random quest of that difficulty within the given
// pool, redrawing the difficulty whenever no quest matches - so harder quests are
// rarer to draw, not just rarer to exist.
function drawQuest(regionQuests, difficultyWeights) {
  for (let i = 0; i < MAX_DIFFICULTY_DRAWS; i++) {
    const difficulty = rollWeighted(difficultyWeights).difficulty;
    const candidates = regionQuests.filter((q) => (q.difficulties || []).includes(difficulty));
    if (candidates.length > 0) return { ...pickRandom(candidates), difficulty };
  }
  return { ...pickRandom(regionQuests), difficulty: null };
}

async function prepare({ db, character, actionType }) {
  const questsSnap = await db
    .collection("worldData")
    .doc("quests")
    .collection("items")
    .where("regionIds", "array-contains", character.region.id)
    .get();
  const regionQuests = questsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (regionQuests.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Aucune quête disponible dans la région, prenez le temps de vous reposer."
    );
  }

  const difficultyWeights = actionType.questDifficultyWeights || DEFAULT_QUEST_DIFFICULTY_WEIGHTS;
  const quest = drawQuest(regionQuests, difficultyWeights);

  let locationName = null;
  if (quest.locationId) {
    const locationSnap = await db
      .collection("worldData")
      .doc("adventureZones")
      .collection("items")
      .doc(quest.locationId)
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

  return { quest, locationName, narrativeSubjects, verbPhrases, lootTables, objects, talents };
}

// Draws the quest's loot: one loot table per item, picked among those sharing at least one
// tag with the quest or the (randomly chosen, per item) quest objective and matching that
// objective's rarity - then a uniform item draw within that table. Items with no matching
// table/objective are silently skipped rather than failing the whole quest (content gap).
//
// `rarityOffset` (default 0) shifts the target rarity down that many ranks on the shared 8-tier
// scale, floored at "commun" - used to draw the degraded-rarity consolation loot a failed
// resolution grants (docs/TODO.md "Mission and quest resolution algorithm"), instead of matching
// the drawn objective's rarity exactly the way a success does.
function drawQuestLoot({ quest, difficulty, questObjectives, lootTables, objects, accomplishmentMessage, rarityOffset = 0 }) {
  const count = LOOT_COUNT_BY_DIFFICULTY[difficulty] || 0;
  const loot = [];
  for (let i = 0; i < count; i++) {
    const objective = pickRandomLoot(questObjectives);
    if (!objective) continue;

    const targetRarityIndex = Math.max(RARITY_ORDER.indexOf(objective.rarity) - rarityOffset, 0);
    const targetRarity = RARITY_ORDER[targetRarityIndex] ?? objective.rarity;

    const relevantTagIds = new Set([...(quest.tagIds || []), ...(objective.tagIds || [])]);
    const candidateTables = lootTables.filter(
      (table) => table.rarity === targetRarity && (table.tagIds || []).some((id) => relevantTagIds.has(id))
    );
    const table = pickRandomLoot(candidateTables);
    if (!table) continue;

    const objectId = drawLootTableItemId(table);
    const object = objects.find((o) => o.id === objectId);
    if (!object) continue;

    loot.push({
      objectId: object.id,
      name: object.name,
      rarity: object.rarity,
      type: object.type,
      tagIds: object.tagIds || [],
      tableId: table.id,
      tableName: table.name,
      description: `${object.description || ""} [Obtenue lorsque ${accomplishmentMessage}]`.trim(),
    });
  }
  return loot;
}

// A quest's success/failure is now decided by resolveQuestOutcome's score roll (docs/TODO.md
// "Mission and quest resolution algorithm"), replacing the always-succeeds behaviour left over
// from the retired paliers system (see "Abandoning the paliers system" in
// docs/ISSUE-02-ACTION-FRAMEWORK.md). What still varies between two resolutions of the same quest,
// on top of that roll, is its narration, its loot, and any talent progress - each its own draw.
const NARRATION_CIBLES = ["individuel", "groupe"];
const DEFAULT_NARRATIVE_TEXT = "Vous revenez de votre quête.";
const DEFAULT_ACCOMPLISHMENT_CLAUSE = "vous revenez de votre quête";
const DEFAULT_FAILURE_TEXT = "Vous rentrez bredouille de votre quête.";
const DEFAULT_FAILURE_CLAUSE = "vous rentrez bredouille de votre quête";

// The talent flourish names a single talent, so the most notable change wins - the rarest one, the
// same ordering the result popup already uses for its "Amélioration de talent" list.
function pickNarratedEvolution(evolutions) {
  return (
    [...evolutions].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0] || null
  );
}

// A quest's successPhraseIds are the sentences its author judged to fit it; the global catalog is
// the fallback. Resolved per slot rather than over the whole pool, so linking one climax phrase to a
// quest doesn't also deprive that quest of every opening line and talent flourish.
function preferQuestPhrasesPerSlot({ questVerbPhrases, verbPhrases }) {
  return SLOT_ORDER.flatMap((slot) => {
    const own = questVerbPhrases.filter((v) => slotOf(v) === slot);
    return own.length > 0 ? own : verbPhrases.filter((v) => slotOf(v) === slot);
  });
}

// Everything the generator needs to know about this resolution, gathered in one pure function so
// the narrative-poc demo harness and the unit tests build the exact same context the live action
// does. Only the talent that actually progressed feeds `talentTags`, not the character's whole
// sheet: matching against every talent they own would let a swordsman's quest borrow the fire
// imagery of a Pyromancie they never used, which is the wrong-flavor failure the subset rule exists
// to prevent.
function buildNarrativeContext({ quest, locationName, talents, nextTalents, talentEvolutions }) {
  const narratedEvolution = pickNarratedEvolution(talentEvolutions || []);
  const narratedTalent = narratedEvolution
    ? (nextTalents || []).find((t) => t.id === narratedEvolution.talentId) ||
      (talents || []).find((t) => t.id === narratedEvolution.talentId)
    : null;

  return {
    talentTags: narratedTalent?.tagIds || [],
    questTags: quest.tagIds || [],
    talentChange: narratedEvolution?.kind || null,
    talentName: narratedEvolution?.name || null,
    locationName,
    questName: quest.name,
  };
}

// Tries a randomly-ordered target shape (a lone foe vs a group) against the quest's own objectives
// first, then the global subject pool, before trying the other shape - the same two-level fallback
// the old per-tier `cible` used to drive, just no longer needing a tier to pick a target from.
// Returns null if nothing in the catalog matches either shape (a content gap, not an error).
function narrateQuestSuccess({ quest, questObjectives, narrativeSubjects, verbPhrases, context }) {
  const cibles = Math.random() < 0.5 ? NARRATION_CIBLES : [...NARRATION_CIBLES].reverse();
  const questVerbPhrases = verbPhrases.filter((v) => (quest.successPhraseIds || []).includes(v.id));
  const pool = preferQuestPhrasesPerSlot({ questVerbPhrases, verbPhrases });

  for (const cible of cibles) {
    for (const subjects of [questObjectives, narrativeSubjects]) {
      const narrative = generateNarrative({ resultat: "victoire", cible, subjects, verbPhrases: pool, context });
      if (narrative) return narrative;
    }
  }

  return null;
}

// Mirrors narrateQuestSuccess exactly, just against the failure side: quest.failurePhraseIds
// instead of successPhraseIds, resultat: "echec" instead of "victoire".
function narrateQuestFailure({ quest, questObjectives, narrativeSubjects, verbPhrases, context }) {
  const cibles = Math.random() < 0.5 ? NARRATION_CIBLES : [...NARRATION_CIBLES].reverse();
  const questVerbPhrases = verbPhrases.filter((v) => (quest.failurePhraseIds || []).includes(v.id));
  const pool = preferQuestPhrasesPerSlot({ questVerbPhrases, verbPhrases });

  for (const cible of cibles) {
    for (const subjects of [questObjectives, narrativeSubjects]) {
      const narrative = generateNarrative({ resultat: "echec", cible, subjects, verbPhrases: pool, context });
      if (narrative) return narrative;
    }
  }

  return null;
}

// The shared score-roll resolution engine behind both "Partir en quête" and "Mission" - they
// already share every other piece of this pipeline (narration, loot, talent evolution), and now
// share the success/failure/wound roll itself too (docs/TODO.md "Mission and quest resolution
// algorithm"). Draws one objective, rolls one score, compares it against the two independent
// difficulty-derived scales, and only then narrates/rewards accordingly.
function resolveQuestOutcome({
  character,
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
  defaultSuccessText,
  defaultSuccessClause,
  defaultFailureText,
  defaultFailureClause,
}) {
  // Reused for the threshold/wound adjustments below and for talent evolution - the same single
  // draw already made for that mechanism, not a second roll. Independent of loot's own per-item
  // objective draw inside drawQuestLoot.
  const objective = pickRandomLoot(questObjectives);

  const score = rollScore();
  const threshold = computeSuccessThreshold({ character, objective, difficulty: quest.difficulty });
  const success = score >= threshold;

  const woundThresholds = computeWoundThresholds({ character, objective, difficulty: quest.difficulty });
  const wound = determineWoundSeverity({ score, thresholds: woundThresholds });
  const woundResult = wound ? applyWound(character, wound) : null;

  // Talent evolution was never gated by the retired tiers roll, only by "the quest succeeds" - it
  // now reads that flag off this score-based success instead. Rolled *before* the narration: the
  // narration's closing sentence names the talent that progressed, so it can't be written until
  // the roll has decided which one - if any - changed.
  let nextTalents = character.talents || [];
  let talentEvolutions = [];
  if (success) {
    ({ talents: nextTalents, evolutions: talentEvolutions } = rollTalentEvolutions({
      characterTalents: character.talents || [],
      catalogTalents: talents,
      quest,
      objective,
      difficulty: quest.difficulty,
      today,
      circumstance,
    }));
  }

  const narrativeContext = buildNarrativeContext({ quest, locationName, talents, nextTalents, talentEvolutions });
  const narrative = success
    ? narrateQuestSuccess({ quest, questObjectives, narrativeSubjects, verbPhrases, context: narrativeContext })
    : narrateQuestFailure({ quest, questObjectives, narrativeSubjects, verbPhrases, context: narrativeContext });

  const narrativeText = narrative?.text || (success ? defaultSuccessText : defaultFailureText);
  const reputationGained = success ? rollReputationReward(quest.difficulty) : 0;

  const loot = drawQuestLoot({
    quest,
    difficulty: quest.difficulty,
    questObjectives,
    lootTables,
    objects,
    // The climax clause, not the whole paragraph: this is embedded mid-sentence in each item's
    // description ("[Obtenue lorsque ...]"), which a three-sentence narrative would read badly in.
    accomplishmentMessage: narrative?.clause || (success ? defaultSuccessClause : defaultFailureClause),
    // New rewards on failure (docs/TODO.md): loot drawn the same way, just two rarity ranks below
    // each per-item objective's own rarity, floored at "commun" - no reputation, no talent evolution.
    rarityOffset: success ? 0 : 2,
  });

  return { score, threshold, success, wound, woundResult, reputationGained, loot, talentEvolutions, nextTalents, narrativeText };
}

async function resolve({ character, today, context }) {
  const { quest, locationName, narrativeSubjects, verbPhrases, lootTables, objects, talents } = context;

  const questObjectives = narrativeSubjects.filter((s) => (quest.objectiveIds || []).includes(s.id));

  const outcome = resolveQuestOutcome({
    character,
    quest,
    questObjectives,
    narrativeSubjects,
    verbPhrases,
    lootTables,
    objects,
    talents,
    locationName,
    today,
    circumstance: `lors de la quête « ${quest.name} »`,
    defaultSuccessText: DEFAULT_NARRATIVE_TEXT,
    defaultSuccessClause: DEFAULT_ACCOMPLISHMENT_CLAUSE,
    defaultFailureText: DEFAULT_FAILURE_TEXT,
    defaultFailureClause: DEFAULT_FAILURE_CLAUSE,
  });

  const questSummary = {
    id: quest.id,
    name: quest.name,
    difficulty: quest.difficulty,
    locationId: quest.locationId || null,
    locationName,
  };

  const updates = {
    lastActionDate: today,
    lastActionAt: FieldValue.serverTimestamp(),
    lastAction: {
      actionTypeId: ACTION_TYPE_ID,
      date: today,
      success: outcome.success,
      score: outcome.score,
      threshold: outcome.threshold,
      wound: outcome.wound,
      reputationGained: outcome.reputationGained,
      narrativeText: outcome.narrativeText,
      quest: questSummary,
      loot: outcome.loot,
      talentEvolutions: outcome.talentEvolutions,
      // A quest colors its own frame and countdown by the difficulty that was actually drawn,
      // rather than falling back to the action's category color.
      accent: quest.difficulty ? { kind: "difficulty", value: quest.difficulty } : null,
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
    quest: questSummary,
  };

  return { updates, logFields };
}

// Runs when the player closes the quest result pop-up (see acknowledgeAction). The loot was
// already rolled and frozen onto lastAction.loot during resolve(); this is what turns it into
// Instance documents the character actually owns.
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

module.exports = {
  prepare,
  resolve,
  commit,
  buildNarrativeContext,
  narrateQuestSuccess,
  narrateQuestFailure,
  preferQuestPhrasesPerSlot,
  drawQuestLoot,
  resolveQuestOutcome,
};
