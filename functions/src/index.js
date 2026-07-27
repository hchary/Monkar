const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { rollWeighted } = require("./lib/rolls");
const partirEnQuete = require("./actions/partirEnQuete");

initializeApp();
const db = getFirestore();

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Each action type owns its full resolution logic (see functions/src/actions/) since
// different actions (quêtes, marchander, s'entraîner, voyager...) have little in common
// beyond "roll something and update the character" - performAction below is just the
// shared plumbing (auth, character lookup, once-per-day lock, transaction, logging).
const ACTION_HANDLERS = {
  "partir-en-quete": partirEnQuete,
};

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

  const characterRef = db.collection("characters").doc();
  await characterRef.set({
    ownerUid: uid,
    name,
    age: 18,
    region: { id: regionId, name: region.name },
    background: { id: background.id, name: background.name, profession: background.profession || "" },
    title: "",
    profession: background.profession || "",
    reputation: background.reputationStart || 0,
    legendLevel: null,
    alive: true,
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

  const handler = ACTION_HANDLERS[actionTypeId];
  if (!handler) throw new HttpsError("invalid-argument", "Unknown or unsupported action type.");

  const charSnap = await db
    .collection("characters")
    .where("ownerUid", "==", uid)
    .where("alive", "==", true)
    .limit(1)
    .get();
  if (charSnap.empty) throw new HttpsError("failed-precondition", "No living character found for this user.");
  const characterRef = charSnap.docs[0].ref;
  const character = charSnap.docs[0].data();

  const actionTypeSnap = await db.collection("worldData").doc("actionTypes").collection("items").doc(actionTypeId).get();
  if (!actionTypeSnap.exists) throw new HttpsError("not-found", "Unknown action type.");
  const actionType = actionTypeSnap.data();

  const today = todayUTC();

  // Pre-transaction prep (e.g. drawing a quest) can throw a friendly precondition
  // error - deliberately outside the transaction so it never consumes the day's lock.
  const context = await handler.prepare({ db, character, actionType });

  await db.runTransaction(async (tx) => {
    const characterDoc = await tx.get(characterRef);
    const freshCharacter = characterDoc.data();

    if (freshCharacter.lastActionDate === today) {
      throw new HttpsError("already-exists", "Action already performed today.");
    }

    const { updates, logFields } = await handler.resolve({ tx, db, character: freshCharacter, actionType, today, context });

    tx.update(characterRef, updates);

    const logRef = db.collection("actionsLog").doc();
    tx.set(logRef, {
      characterId: characterRef.id,
      ownerUid: uid,
      actionTypeId,
      date: today,
      createdAt: FieldValue.serverTimestamp(),
      ...logFields,
    });
  });

  return { ok: true };
});

// Grants a resolved quest's rolled loot (see partirEnQuete.js) as Instance documents, and
// marks it claimed so re-clicking "Fermer" (or reloading before it closes) can't duplicate
// them. Separate from performAction: loot is rolled with the rest of the quest resolution,
// but only committed to the character's inventory once the player closes the result pop-up.
exports.claimQuestLoot = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required.");

  const charSnap = await db
    .collection("characters")
    .where("ownerUid", "==", uid)
    .where("alive", "==", true)
    .limit(1)
    .get();
  if (charSnap.empty) throw new HttpsError("failed-precondition", "No living character found for this user.");
  const characterRef = charSnap.docs[0].ref;

  await db.runTransaction(async (tx) => {
    const characterDoc = await tx.get(characterRef);
    const character = characterDoc.data();
    const lastAction = character.lastAction;
    if (!lastAction || !lastAction.quest) {
      throw new HttpsError("failed-precondition", "No quest result to claim.");
    }
    if (lastAction.lootClaimed) return;

    const today = todayUTC();
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

    tx.update(characterRef, { "lastAction.lootClaimed": true });
  });

  return { ok: true };
});
