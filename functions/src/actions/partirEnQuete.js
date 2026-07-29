const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { rollWeighted } = require("../lib/rolls");
const { pickRandom: pickRandomLoot, drawLootTableItemId, LOOT_COUNT_BY_DIFFICULTY } = require("../lib/loot");
const { rollTalentEvolutions } = require("../lib/talentEvolution");
const { generateResultText } = require("../textGeneration");

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
function drawQuestLoot({ quest, difficulty, questObjectives, lootTables, objects, accomplishmentMessage }) {
  const count = LOOT_COUNT_BY_DIFFICULTY[difficulty] || 0;
  const loot = [];
  for (let i = 0; i < count; i++) {
    const objective = pickRandomLoot(questObjectives);
    if (!objective) continue;

    const relevantTagIds = new Set([...(quest.tagIds || []), ...(objective.tagIds || [])]);
    const candidateTables = lootTables.filter(
      (table) => table.rarity === objective.rarity && (table.tagIds || []).some((id) => relevantTagIds.has(id))
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

// A quest always concludes successfully once drawn - there is no more weighted roll deciding
// death, injury, gold, or reputation the way the retired paliers system used to (see "Abandoning
// the paliers system" in docs/ISSUE-02-ACTION-FRAMEWORK.md). What still varies between two
// resolutions of the same quest is its narration, its loot, and any talent progress - each its
// own draw, made here rather than read off a per-tier Firestore field.
const NARRATION_CIBLES = ["individuel", "groupe"];
const DEFAULT_NARRATIVE_TEXT = "Vous revenez de votre quête.";

// Tries a randomly-ordered target shape (a lone foe vs a group) against the quest's own
// objective/phrase pools first, then the global pools, before trying the other shape - the same
// two-level fallback the old per-tier `cible` used to drive, just no longer needing a tier to pick
// a target from. Falls back to a fixed sentence only if nothing in the catalog matches either
// shape (a content gap, not an error).
function narrateQuestSuccess({ quest, questObjectives, narrativeSubjects, verbPhrases }) {
  const cibles = Math.random() < 0.5 ? NARRATION_CIBLES : [...NARRATION_CIBLES].reverse();
  const questVerbPhrases = verbPhrases.filter((v) => (quest.successPhraseIds || []).includes(v.id));

  for (const cible of cibles) {
    const fromQuest = generateResultText({ resultat: "victoire", cible, subjects: questObjectives, verbPhrases: questVerbPhrases });
    if (fromQuest) return fromQuest;

    const fromGlobal = generateResultText({ resultat: "victoire", cible, subjects: narrativeSubjects, verbPhrases });
    if (fromGlobal) return fromGlobal;
  }

  return DEFAULT_NARRATIVE_TEXT;
}

async function resolve({ character, today, context }) {
  const { quest, locationName, narrativeSubjects, verbPhrases, lootTables, objects, talents } = context;

  const questObjectives = narrativeSubjects.filter((s) => (quest.objectiveIds || []).includes(s.id));
  const narrativeText = narrateQuestSuccess({ quest, questObjectives, narrativeSubjects, verbPhrases });

  const loot = drawQuestLoot({
    quest,
    difficulty: quest.difficulty,
    questObjectives,
    lootTables,
    objects,
    accomplishmentMessage: narrativeText,
  });

  // Every quest has a chance to evolve or unlock a talent sharing a tag with it, gated on a
  // single objective drawn for this occurrence (same draw mechanism as loot's per-item objective,
  // but rolled once for the whole talent pass rather than per talent) - see docs/TODO.md
  // "Amélioration de talent".
  const { talents: nextTalents, evolutions: talentEvolutions } = rollTalentEvolutions({
    characterTalents: character.talents || [],
    catalogTalents: talents,
    quest,
    objective: pickRandomLoot(questObjectives),
    difficulty: quest.difficulty,
    today,
    circumstance: `lors de la quête « ${quest.name} »`,
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
      success: true,
      narrativeText,
      quest: questSummary,
      loot,
      talentEvolutions,
      // A quest colors its own frame and countdown by the difficulty that was actually drawn,
      // rather than falling back to the action's category color.
      accent: quest.difficulty ? { kind: "difficulty", value: quest.difficulty } : null,
    },
  };

  if (talentEvolutions.length > 0) updates.talents = nextTalents;

  const logFields = {
    success: true,
    narrativeText,
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

module.exports = { prepare, resolve, commit };
