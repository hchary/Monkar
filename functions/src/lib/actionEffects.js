const { Timestamp } = require("firebase-admin/firestore");
const { HOUR_MS } = require("./actionLifecycle");
const { resolveDurationHours } = require("./actionCatalog");

// What's left here once the weighted-paliers system was retired (see "Abandoning the paliers
// system" in docs/ISSUE-02-ACTION-FRAMEWORK.md): every handler now decides its own outcome,
// gains, and consequences directly in code, and returns its own `updates`/`lastAction` shape from
// `resolve()`. `stampLifecycle` is the one piece every handler still shares - the timing/labeling
// envelope wrapped around whatever they produced.

// Stamps onto a handler's character patch the lifecycle fields every action shares: when it
// started, when it completes, how the frame should be colored, and whether the player has seen
// the result yet. The dispatcher owns this rather than the handlers, so every handler is timed
// identically no matter how differently it resolves.
//
// `completesAt` cannot be derived from FieldValue.serverTimestamp(): that is a write sentinel
// with no readable value, so it cannot be offset by a duration. Both instants therefore come
// from the function's own clock. Sub-second drift against Firestore's clock is irrelevant at a
// 24h granularity, and `lastActionAt` keeps using the sentinel exactly as before.
function stampLifecycle(updates, { actionType, now = Timestamp.now(), durationHours } = {}) {
  const hours = durationHours ?? resolveDurationHours(actionType);
  const categoryId = actionType?.categoryId || null;

  return {
    ...updates,
    lastAction: {
      ...updates.lastAction,
      label: actionType?.label || "",
      categoryId,
      // Denormalized so acknowledgeAction can find the right handler's commit() by the same
      // key ACTION_HANDLERS is registered under, without a second actionType read - see D13.
      handlerId: actionType?.handlerId || null,
      startedAt: now,
      completesAt: Timestamp.fromMillis(now.toMillis() + hours * HOUR_MS),
      // A handler that knows better (a quest exposes its difficulty) sets its own accent;
      // everything else is colored by its category.
      accent: updates.lastAction?.accent || { kind: "category", value: categoryId },
      acknowledged: false,
    },
  };
}

module.exports = { stampLifecycle };
