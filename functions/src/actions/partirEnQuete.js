const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { rollWeighted, rarityFloor } = require("../lib/rolls");
const { pickRandom: pickRandomLoot, drawLootTableItemId, LOOT_COUNT_BY_DIFFICULTY } = require("../lib/loot");
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

  const [narrativeSubjectsSnap, verbPhrasesSnap, lootTablesSnap, objectsSnap] = await Promise.all([
    db.collection("worldData").doc("narrativeSubjects").collection("items").get(),
    db.collection("worldData").doc("verbPhrases").collection("items").get(),
    db.collection("worldData").doc("lootTables").collection("items").get(),
    db.collection("worldData").doc("objects").collection("items").get(),
  ]);
  const narrativeSubjects = narrativeSubjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const verbPhrases = verbPhrasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const lootTables = lootTablesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const objects = objectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { quest, locationName, narrativeSubjects, verbPhrases, lootTables, objects };
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

async function resolve({ tx, db, character, actionType, today, context }) {
  const { quest, locationName, narrativeSubjects, verbPhrases, lootTables, objects } = context;

  const tier = rollWeighted(actionType.tiers);
  const success = tier.success !== false;

  let talentGained = null;
  if (success && tier.talentGain?.talentId) {
    const talentRef = db.collection("worldData").doc("talents").collection("items").doc(tier.talentGain.talentId);
    const talentSnap = await tx.get(talentRef);
    if (talentSnap.exists) {
      const talent = talentSnap.data();
      const quality = tier.talentGain.quality || 1;
      talentGained = {
        id: talentSnap.id,
        name: talent.name,
        quality,
        trainable: !!talent.trainable,
        rarity: rarityFloor(talent.rarity, quality),
        effect: talent.effect || "",
        lastChangeDate: today,
        lastChangeCircumstance: tier.talentGain.circumstance || "",
      };
    }
  }

  const questObjectives = narrativeSubjects.filter((s) => (quest.objectiveIds || []).includes(s.id));

  // The quest's own objective/phrase pools are tried first so the result text stays
  // on-theme with the drawn quest; if the quest has no pool for this outcome, fall
  // back to the global pools exactly like a quest-less action would.
  let narrativeText = tier.narrativeText || "";
  if (tier.cible) {
    const resultat = success ? "victoire" : "echec";
    const questPhraseIds = resultat === "victoire" ? quest.successPhraseIds : quest.failurePhraseIds;
    const questVerbPhrases = verbPhrases.filter((v) => (questPhraseIds || []).includes(v.id));
    let generated = generateResultText({ resultat, cible: tier.cible, subjects: questObjectives, verbPhrases: questVerbPhrases });
    if (!generated) {
      generated = generateResultText({ resultat, cible: tier.cible, subjects: narrativeSubjects, verbPhrases });
    }
    if (generated) narrativeText = generated;
  }

  const loot = success
    ? drawQuestLoot({
        quest,
        difficulty: quest.difficulty,
        questObjectives,
        lootTables,
        objects,
        accomplishmentMessage: narrativeText,
      })
    : [];

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
      tierName: tier.name,
      success,
      narrativeText,
      goldGain: tier.goldGain || 0,
      itemGain: tier.itemGain || null,
      talentGain: talentGained,
      reputationGain: tier.reputationGain || 0,
      legendary: !!tier.legendary,
      consequence: tier.consequence || null,
      quest: questSummary,
      loot,
      lootClaimed: false,
    },
  };

  if (success) {
    if (tier.goldGain) updates.gold = FieldValue.increment(tier.goldGain);
    if (tier.itemGain) updates.inventory = FieldValue.arrayUnion(tier.itemGain);
    if (talentGained) updates.talents = FieldValue.arrayUnion(talentGained);
    if (tier.reputationGain) updates.reputation = FieldValue.increment(tier.reputationGain);
    if (tier.legendary) updates.legendLevel = FieldValue.increment(1);
  } else if (tier.consequence?.type === "death") {
    updates.alive = false;
  } else if (tier.consequence?.type === "wound") {
    updates.wounds = FieldValue.arrayUnion({
      name: tier.consequence.name || tier.name,
      description: tier.consequence.description || "",
      date: today,
    });
  }

  const logFields = {
    tierName: tier.name,
    success,
    narrativeText,
    consequence: tier.consequence || null,
    quest: questSummary,
  };

  return { updates, logFields };
}

module.exports = { prepare, resolve };
