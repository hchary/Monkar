const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { rollWeighted } = require("./lib/rolls");
const { stampLifecycle } = require("./lib/actionEffects");
const { isActionRunning, isActionAcknowledged } = require("./lib/actionLifecycle");
const { normalizeActionType, evaluateAvailability } = require("./lib/actionCatalog");
const { buildConditionContext } = require("./lib/actionContext");
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
  const actionType = normalizeActionType(actionTypeSnap.data());

  if (!actionType.enabled) {
    throw new HttpsError("failed-precondition", "Cette action n'est pas disponible.");
  }

  // Availability is enforced here, not only in the UI: the client evaluates the same conditions
  // through the mirrored evaluator to decide what to display, but that answer is UX - this one
  // is authority. Both fail closed on a condition type they don't recognize.
  const conditionContext = await buildConditionContext({
    db,
    character,
    characterId: characterRef.id,
    conditions: actionType.availability.conditions,
  });
  const availability = evaluateAvailability(actionType, conditionContext);
  if (!availability.ok) throw new HttpsError("failed-precondition", availability.reason);

  const today = todayUTC();

  // Pre-transaction prep (e.g. drawing a quest) can throw a friendly precondition
  // error - deliberately outside the transaction so it never consumes the day's lock.
  const context = await handler.prepare({ db, character, actionType });

  await db.runTransaction(async (tx) => {
    const characterDoc = await tx.get(characterRef);
    const freshCharacter = characterDoc.data();
    const now = Timestamp.now();

    // An action occupies its character until it completes, which is what makes "one action per
    // day" and "an action lasts 24h" one rule instead of two clocks that drift apart at the day
    // boundary - see docs/ISSUE-02-ACTION-FRAMEWORK.md §3.6.
    if (isActionRunning(freshCharacter, now.toMillis())) {
      throw new HttpsError("already-exists", "Action already in progress.");
    }

    const { updates, logFields } = await handler.resolve({ tx, db, character: freshCharacter, actionType, today, context });

    tx.update(characterRef, stampLifecycle(updates, { actionType, now }));

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

// Closes the loop on a finished action: runs whatever the action deferred until the player
// actually saw the result (a quest's rolled loot becomes Instance documents, see
// partirEnQuete.commit), then marks it acknowledged so the result pop-up doesn't reopen and
// re-clicking "Fermer" can't duplicate anything.
//
// Deferring the commit is deliberate: the outcome is fixed the moment the action resolves, but
// nothing lands in the character's inventory until they have been shown what they got. Replaces
// the quest-specific claimQuestLoot - every action gets the same acknowledgement mechanism, and
// the per-action side effect is the handler's commit() hook.
exports.acknowledgeAction = onCall(async (request) => {
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
    if (!lastAction) throw new HttpsError("failed-precondition", "No action result to acknowledge.");

    // Idempotent: the pop-up can be closed twice (two tabs, a retried call) without committing
    // the same loot twice.
    if (isActionAcknowledged(character)) return;

    // The result is only revealed once the action has run its course; acknowledging it before
    // then would materialize the loot early.
    if (isActionRunning(character, Date.now())) {
      throw new HttpsError("failed-precondition", "This action has not finished yet.");
    }

    const handler = ACTION_HANDLERS[lastAction.actionTypeId];
    if (handler?.commit) {
      await handler.commit({ tx, db, characterRef, character, lastAction, uid, today: todayUTC() });
    }

    tx.update(characterRef, { "lastAction.acknowledged": true });
  });

  return { ok: true };
});
