const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { generateResultText } = require("./textGeneration");

initializeApp();
const db = getFirestore();

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function rollWeighted(items) {
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  const roll = Math.random() * totalWeight;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight || 0;
    if (roll <= cumulative) return item;
  }
  return items[items.length - 1];
}

const BASE_STATS = { force: 5, agilite: 5, intelligence: 5, charisme: 5 };

const RARITY_ORDER = ["commun", "peu_commun", "rare", "tres_rare", "legendaire", "mythique", "divin", "unique"];

function rarityFloor(rarity, quality) {
  let floor = "commun";
  if (quality >= 5) floor = "legendaire";
  else if (quality >= 4) floor = "tres_rare";
  else if (quality >= 3) floor = "rare";
  const idx = Math.max(RARITY_ORDER.indexOf(rarity), RARITY_ORDER.indexOf(floor));
  return RARITY_ORDER[idx];
}

exports.createCharacter = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const { regionId, name } = request.data;
  if (!regionId || !name) throw new HttpsError("invalid-argument", "regionId and name are required.");

  const existingAlive = await db
    .collection("characters")
    .where("ownerUid", "==", uid)
    .where("alive", "==", true)
    .limit(1)
    .get();
  if (!existingAlive.empty) {
    throw new HttpsError("already-exists", "You already have a living character.");
  }

  const regionRef = db.collection("worldData").doc("regions").collection("items").doc(regionId);
  const regionSnap = await regionRef.get();
  if (!regionSnap.exists) throw new HttpsError("not-found", "Unknown region.");
  const region = regionSnap.data();

  const backgroundsSnap = await regionRef.collection("backgrounds").get();
  if (backgroundsSnap.empty) throw new HttpsError("failed-precondition", "This region has no backgrounds configured.");
  const background = rollWeighted(backgroundsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

  const traitsSnap = await db.collection("worldData").doc("traits").collection("items").get();
  if (traitsSnap.empty) throw new HttpsError("failed-precondition", "No traits configured.");
  const trait = rollWeighted(traitsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

  const stats = { ...BASE_STATS };
  for (const [stat, amount] of Object.entries(trait.bonuses || {})) {
    stats[stat] = (stats[stat] || 0) + amount;
  }

  const characterRef = db.collection("characters").doc();
  await characterRef.set({
    ownerUid: uid,
    name,
    age: 18,
    region: { id: regionId, name: region.name },
    background: { id: background.id, name: background.name, profession: background.profession || "" },
    trait: { id: trait.id, name: trait.name, description: trait.description || "" },
    title: "",
    profession: background.profession || "",
    reputation: background.reputationStart || 0,
    legendLevel: null,
    alive: true,
    stats,
    gold: background.startingGold || 0,
    inventory: background.startingItems || [],
    talents: [],
    blessings: [],
    curses: [],
    wounds: [],
    lastActionDate: null,
    lastActionAt: null,
    lastAction: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection("users").doc(uid).set({ role: "player", characterId: characterRef.id }, { merge: true });

  return { characterId: characterRef.id };
});

exports.performAction = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const { actionTypeId } = request.data;
  if (!actionTypeId) throw new HttpsError("invalid-argument", "actionTypeId is required.");

  const charSnap = await db
    .collection("characters")
    .where("ownerUid", "==", uid)
    .where("alive", "==", true)
    .limit(1)
    .get();
  if (charSnap.empty) throw new HttpsError("failed-precondition", "No living character found for this user.");
  const characterRef = charSnap.docs[0].ref;

  const actionTypeSnap = await db.collection("worldData").doc("actionTypes").collection("items").doc(actionTypeId).get();
  if (!actionTypeSnap.exists) throw new HttpsError("not-found", "Unknown action type.");
  const actionType = actionTypeSnap.data();

  const [narrativeSubjectsSnap, verbPhrasesSnap] = await Promise.all([
    db.collection("worldData").doc("narrativeSubjects").collection("items").get(),
    db.collection("worldData").doc("verbPhrases").collection("items").get(),
  ]);
  const narrativeSubjects = narrativeSubjectsSnap.docs.map((d) => d.data());
  const verbPhrases = verbPhrasesSnap.docs.map((d) => d.data());

  const today = todayUTC();

  await db.runTransaction(async (tx) => {
    const characterDoc = await tx.get(characterRef);
    const character = characterDoc.data();

    if (character.lastActionDate === today) {
      throw new HttpsError("already-exists", "Action already performed today.");
    }

    const tier = rollWeighted(actionType.tiers);
    const success = tier.success !== false;
    const bonusesApplied = tier.bonuses || {};

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

    let narrativeText = tier.narrativeText || "";
    if (tier.cible) {
      const generated = generateResultText({
        resultat: success ? "victoire" : "echec",
        cible: tier.cible,
        subjects: narrativeSubjects,
        verbPhrases,
      });
      if (generated) narrativeText = generated;
    }

    const updates = {
      lastActionDate: today,
      lastActionAt: FieldValue.serverTimestamp(),
      lastAction: {
        actionTypeId,
        date: today,
        tierName: tier.name,
        success,
        narrativeText,
        bonusesApplied,
        goldGain: tier.goldGain || 0,
        itemGain: tier.itemGain || null,
        talentGain: talentGained,
        reputationGain: tier.reputationGain || 0,
        legendary: !!tier.legendary,
        consequence: tier.consequence || null,
      },
    };

    for (const [stat, amount] of Object.entries(bonusesApplied)) {
      updates[`stats.${stat}`] = FieldValue.increment(amount);
    }

    if (success) {
      if (tier.goldGain) updates.gold = FieldValue.increment(tier.goldGain);
      if (tier.itemGain) updates.inventory = FieldValue.arrayUnion(tier.itemGain);
      if (talentGained) updates.talents = FieldValue.arrayUnion(talentGained);
      if (tier.reputationGain) updates.reputation = FieldValue.increment(tier.reputationGain);
      if (tier.legendary) {
        updates.legendLevel = FieldValue.increment(1);
      }
    } else if (tier.consequence?.type === "death") {
      updates.alive = false;
    } else if (tier.consequence?.type === "wound") {
      updates.wounds = FieldValue.arrayUnion({
        name: tier.consequence.name || tier.name,
        description: tier.consequence.description || "",
        date: today,
      });
    }

    tx.update(characterRef, updates);

    const logRef = db.collection("actionsLog").doc();
    tx.set(logRef, {
      characterId: characterRef.id,
      ownerUid: uid,
      actionTypeId,
      date: today,
      tierName: tier.name,
      success,
      bonusesApplied,
      narrativeText,
      consequence: tier.consequence || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
