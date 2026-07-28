// Reads where a character stands in the action lifecycle: idle -> running -> completed.
//
// Mirrored verbatim (bodies identical, only the export syntax differs) in
// src/lib/actionLifecycle.js, so the client can decide what to render and the Cloud Functions
// can decide what to authorize from the exact same rules. functions/ is CommonJS with no build
// step shared with the Vite app, so a duplicated pure module is the established answer here -
// same convention as functions/src/lib/loot.js vs src/lib/lootTables.js. This copy is the one
// covered by tests (actionLifecycle.test.js); keep the other in step when editing.
//
// `lastAction.completesAt` is the single source of truth for both the once-per-day lock and the
// countdown - see docs/ISSUE-02-ACTION-FRAMEWORK.md §3.6.

const DEFAULT_DURATION_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

// Accepts an Admin SDK Timestamp, a client SDK Timestamp, a Date, or raw millis - the same
// character document is read from both sides, through two different Firestore SDKs.
function toMillis(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return null;
}

// Documents written before completesAt existed fall back to their start instant + 24h, so no
// character is ever stuck behind an endless countdown. A lastAction with no usable instant at
// all is treated as long finished (null).
function actionCompletesAtMillis(character) {
  const lastAction = character?.lastAction;
  if (!lastAction) return null;

  const completesAt = toMillis(lastAction.completesAt);
  if (completesAt != null) return completesAt;

  const startedAt = toMillis(lastAction.startedAt ?? character.lastActionAt);
  return startedAt == null ? null : startedAt + DEFAULT_DURATION_HOURS * HOUR_MS;
}

// The once-per-day lock (server) and the countdown (client) are the same question.
function isActionRunning(character, nowMillis = Date.now()) {
  const completesAt = actionCompletesAtMillis(character);
  return completesAt != null && nowMillis < completesAt;
}

// `lootClaimed` is the pre-framework name of this flag, kept as a read-time fallback for
// characters whose last action resolved before acknowledgeAction replaced claimQuestLoot.
// Nothing writes it any more; drop the fallback once no live character can still carry one.
function isActionAcknowledged(character) {
  const lastAction = character?.lastAction;
  if (!lastAction) return true;
  return lastAction.acknowledged ?? lastAction.lootClaimed ?? false;
}

// "idle" covers both "never acted" and "acted, finished, result seen" - the player can start an
// action in either case, and the panel renders the same browser (plus a recap when there is a
// lastAction to recap).
function actionState(character, nowMillis = Date.now()) {
  if (!character?.lastAction) return "idle";
  if (isActionRunning(character, nowMillis)) return "running";
  return isActionAcknowledged(character) ? "idle" : "completed";
}

module.exports = {
  DEFAULT_DURATION_HOURS,
  HOUR_MS,
  toMillis,
  actionCompletesAtMillis,
  isActionRunning,
  isActionAcknowledged,
  actionState,
};
