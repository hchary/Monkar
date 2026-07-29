// The shared resolution pipeline behind performAction - docs/ISSUE-02-ACTION-FRAMEWORK.md §3.5.
//
// An action type with no handlerId (or one naming a handler that isn't registered) resolves
// through the generic tier roller: this is the framework's central claim, that adding an action
// is mostly a content-authoring task. A handler is the escape hatch for actions whose mechanics
// don't fit that shape (drawing a quest, picking a trainer...).

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { genericResolve, stampLifecycle } = require("./actionEffects");
const { isActionRunning } = require("./actionLifecycle");
const { normalizeActionType, evaluateAvailability } = require("./actionCatalog");
const { buildConditionContext } = require("./actionContext");

async function runActionPipeline({ db, uid, actionTypeId, actionHandlers, today, payload = {} }) {
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

  const handler = (actionType.handlerId && actionHandlers[actionType.handlerId]) || null;

  // Pre-transaction prep (e.g. drawing a quest) can throw a friendly precondition error -
  // deliberately outside the transaction so it never consumes the day's lock.
  const context = handler?.prepare
    ? await handler.prepare({ db, character, actionType, actionTypeId, payload })
    : undefined;

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

    const { updates, logFields } = handler
      ? await handler.resolve({
          tx,
          db,
          character: freshCharacter,
          characterRef,
          actionType,
          actionTypeId,
          today,
          context,
          payload,
        })
      : genericResolve({ actionType, actionTypeId, today, character: freshCharacter });

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
}

module.exports = { runActionPipeline };
