const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function rollQuality(tiers) {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const tier of tiers) {
    cumulative += tier.weight;
    if (roll <= cumulative) return tier;
  }
  return tiers[tiers.length - 1];
}

exports.performAction = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const { actionTypeId } = request.data;
  if (!actionTypeId) throw new HttpsError("invalid-argument", "actionTypeId is required.");

  const charSnap = await db.collection("characters").where("ownerUid", "==", uid).limit(1).get();
  if (charSnap.empty) throw new HttpsError("failed-precondition", "No character found for this user.");
  const characterRef = charSnap.docs[0].ref;

  const actionTypeSnap = await db.collection("worldData").doc("actionTypes").collection("items").doc(actionTypeId).get();
  if (!actionTypeSnap.exists) throw new HttpsError("not-found", "Unknown action type.");
  const actionType = actionTypeSnap.data();

  const today = todayUTC();

  return db.runTransaction(async (tx) => {
    const characterDoc = await tx.get(characterRef);
    const character = characterDoc.data();

    if (character.lastActionDate === today) {
      throw new HttpsError("already-exists", "Action already performed today.");
    }

    const tier = rollQuality(actionType.tiers);
    const bonusesApplied = tier.bonuses || {};

    const statUpdates = {};
    for (const [stat, amount] of Object.entries(bonusesApplied)) {
      statUpdates[`stats.${stat}`] = FieldValue.increment(amount);
    }

    tx.update(characterRef, {
      ...statUpdates,
      lastActionDate: today,
    });

    const logRef = db.collection("actionsLog").doc();
    tx.set(logRef, {
      characterId: characterRef.id,
      ownerUid: uid,
      actionTypeId,
      date: today,
      tierName: tier.name,
      bonusesApplied,
      narrativeText: tier.narrativeText || "",
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      tierName: tier.name,
      bonusesApplied,
      narrativeText: tier.narrativeText || "",
    };
  });
});
