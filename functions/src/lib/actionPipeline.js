// The shared resolution pipeline behind performAction - docs/ISSUE-02-ACTION-FRAMEWORK.md §3.5.
//
// There is no generic resolution path any more (the weighted-paliers roller that used to back it
// was retired - see "Abandoning the paliers system" in that doc). Every action type must name a
// handlerId resolving to a registered entry in functions/src/index.js's ACTION_HANDLERS; the
// pipeline's only remaining job for resolution is calling that handler with the right inputs and
// applying what it returns. An actionType with no usable handler is refused before the
// transaction opens, the same way an unmet condition is - a content-authoring mistake, not a
// server fault, and one that now costs the player nothing to hit.

const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { stampLifecycle } = require("./actionEffects");
const { isActionRunning } = require("./actionLifecycle");
const { normalizeActionType, evaluateAvailability } = require("./actionCatalog");
const { buildConditionContext } = require("./actionContext");
const { actionUsesIntermedeBudget } = require("./actionKinds");

async function runActionPipeline({ db, uid, actionTypeId, actionHandlers, today, payload = {} }) {
  const charSnap = await db
    .collection("characters")
    .where("ownerUid", "==", uid)
    .where("alive", "==", true)
    .limit(1)
    .get();
  if (charSnap.empty) throw new HttpsError("failed-precondition", "No living character found for this user.");
  const characterRef = charSnap.docs[0].ref;
  const characterId = characterRef.id;
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
    characterId,
    conditions: actionType.availability.conditions,
  });
  const availability = evaluateAvailability(actionType, conditionContext);
  if (!availability.ok) throw new HttpsError("failed-precondition", availability.reason);

  const handler = (actionType.handlerId && actionHandlers[actionType.handlerId]) || null;
  if (!handler) {
    throw new HttpsError("failed-precondition", "Cette action n'a pas de gestionnaire configuré.");
  }

  // Intermède-budget actions (docs/TODO.md "Intermède actions") never occupy the character's main
  // action slot: they're bonus actions, repeatable up to the shared per-Interval cap regardless of
  // whatever the main action is doing, so neither the once-per-Interval lock nor the lastAction
  // envelope stamped by stampLifecycle applies to them - see actionKinds.js's
  // actionUsesIntermedeBudget.
  const usesIntermedeBudget = actionUsesIntermedeBudget(actionType.kindId);

  // Pre-transaction prep (e.g. drawing a quest) can throw a friendly precondition error -
  // deliberately outside the transaction so it never consumes the day's lock.
  const context = handler.prepare
    ? await handler.prepare({ db, character, characterId, actionType, actionTypeId, payload })
    : undefined;

  let response;

  await db.runTransaction(async (tx) => {
    const characterDoc = await tx.get(characterRef);
    const freshCharacter = characterDoc.data();
    const now = Timestamp.now();

    // An action occupies its character until it completes, which is what makes "one action per
    // day" and "an action lasts 24h" one rule instead of two clocks that drift apart at the day
    // boundary - see docs/ISSUE-02-ACTION-FRAMEWORK.md §3.6. Intermède-budget actions are exempt -
    // see above.
    if (!usesIntermedeBudget && isActionRunning(freshCharacter, now.toMillis())) {
      throw new HttpsError("already-exists", "Action already in progress.");
    }

    const result = await handler.resolve({
      tx,
      db,
      character: freshCharacter,
      characterRef,
      characterId,
      actionType,
      actionTypeId,
      today,
      context,
      payload,
    });

    const { updates, logFields } = result;
    response = result.response;

    // Intermède-budget actions skip the lifecycle envelope entirely - their updates land as-is,
    // never touching lastAction/completesAt.
    tx.update(characterRef, usesIntermedeBudget ? updates : stampLifecycle(updates, { actionType, now }));

    const logRef = db.collection("actionsLog").doc();
    tx.set(logRef, {
      characterId,
      ownerUid: uid,
      actionTypeId,
      date: today,
      createdAt: FieldValue.serverTimestamp(),
      ...logFields,
    });
  });

  return { response };
}

module.exports = { runActionPipeline };
