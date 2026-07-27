const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { rollWeighted, rarityFloor } = require("../lib/rolls");
const { generateResultText } = require("../textGeneration");

const ACTION_TYPE_ID = "partir-en-quete";

const DEFAULT_QUEST_RARITY_WEIGHTS = [
  { rarity: "commun", weight: 55 },
  { rarity: "peu_commun", weight: 30 },
  { rarity: "rare", weight: 10 },
  { rarity: "tres_rare", weight: 4 },
  { rarity: "legendaire", weight: 1 },
];

// Safety net in case a region's quests never carry a rarity present in the weight
// table (e.g. only "mythique"/"divin"/"unique" quests) - without this the draw loop
// below would spin forever.
const MAX_RARITY_DRAWS = 50;

function pickRandom(items) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// Draws a rarity first, then a random quest of that rarity within the given pool,
// redrawing the rarity whenever no quest matches - so rarer quests are rarer to draw,
// not just rarer to exist.
function drawQuest(regionQuests, rarityWeights) {
  for (let i = 0; i < MAX_RARITY_DRAWS; i++) {
    const rarity = rollWeighted(rarityWeights).rarity;
    const candidates = regionQuests.filter((q) => (q.rarities || []).includes(rarity));
    if (candidates.length > 0) return { ...pickRandom(candidates), rarity };
  }
  return { ...pickRandom(regionQuests), rarity: null };
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

  const rarityWeights = actionType.questRarityWeights || DEFAULT_QUEST_RARITY_WEIGHTS;
  const quest = drawQuest(regionQuests, rarityWeights);

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

  const [narrativeSubjectsSnap, verbPhrasesSnap] = await Promise.all([
    db.collection("worldData").doc("narrativeSubjects").collection("items").get(),
    db.collection("worldData").doc("verbPhrases").collection("items").get(),
  ]);
  const narrativeSubjects = narrativeSubjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const verbPhrases = verbPhrasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { quest, locationName, narrativeSubjects, verbPhrases };
}

async function resolve({ tx, db, character, actionType, today, context }) {
  const { quest, locationName, narrativeSubjects, verbPhrases } = context;

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

  // The quest's own objective/phrase pools are tried first so the result text stays
  // on-theme with the drawn quest; if the quest has no pool for this outcome, fall
  // back to the global pools exactly like a quest-less action would.
  let narrativeText = tier.narrativeText || "";
  if (tier.cible) {
    const resultat = success ? "victoire" : "echec";
    const questPhraseIds = resultat === "victoire" ? quest.successPhraseIds : quest.failurePhraseIds;
    const questSubjects = narrativeSubjects.filter((s) => (quest.objectiveIds || []).includes(s.id));
    const questVerbPhrases = verbPhrases.filter((v) => (questPhraseIds || []).includes(v.id));
    let generated = generateResultText({ resultat, cible: tier.cible, subjects: questSubjects, verbPhrases: questVerbPhrases });
    if (!generated) {
      generated = generateResultText({ resultat, cible: tier.cible, subjects: narrativeSubjects, verbPhrases });
    }
    if (generated) narrativeText = generated;
  }

  const questSummary = {
    id: quest.id,
    name: quest.name,
    rarity: quest.rarity,
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
