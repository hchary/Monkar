const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");
const {
  DEFAULT_DURATION_HOURS,
  HOUR_MS,
  toMillis,
  actionCompletesAtMillis,
  isActionRunning,
  isActionAcknowledged,
  actionState,
} = require("./actionLifecycle");

const NOW = Date.parse("2026-07-28T12:00:00Z");
const hoursFromNow = (h) => Timestamp.fromMillis(NOW + h * HOUR_MS);

// A character whose action started `startedHoursAgo` ago and runs for `durationHours`.
function characterWith({ startedHoursAgo = 0, durationHours = DEFAULT_DURATION_HOURS, ...lastAction } = {}) {
  return {
    lastActionAt: hoursFromNow(-startedHoursAgo),
    lastAction: {
      actionTypeId: "partir-en-quete",
      startedAt: hoursFromNow(-startedHoursAgo),
      completesAt: hoursFromNow(durationHours - startedHoursAgo),
      acknowledged: false,
      ...lastAction,
    },
  };
}

describe("toMillis", () => {
  test("reads every timestamp shape the two Firestore SDKs hand back", () => {
    assert.equal(toMillis(Timestamp.fromMillis(NOW)), NOW);
    assert.equal(toMillis(new Date(NOW)), NOW);
    assert.equal(toMillis(NOW), NOW);
    assert.equal(toMillis({ toDate: () => new Date(NOW) }), NOW);
  });

  test("returns null for anything unusable rather than NaN", () => {
    assert.equal(toMillis(null), null);
    assert.equal(toMillis(undefined), null);
    assert.equal(toMillis({}), null);
  });
});

describe("actionCompletesAtMillis", () => {
  test("uses completesAt when present", () => {
    const character = characterWith({ startedHoursAgo: 3 });
    assert.equal(actionCompletesAtMillis(character), NOW + 9 * HOUR_MS);
  });

  test("falls back to startedAt + 12h for documents written before completesAt existed", () => {
    const character = { lastAction: { startedAt: hoursFromNow(-3) } };
    assert.equal(actionCompletesAtMillis(character), NOW + 9 * HOUR_MS);
  });

  test("falls back to the root lastActionAt when lastAction has no instant of its own", () => {
    const character = { lastActionAt: hoursFromNow(-10), lastAction: { actionTypeId: "partir-en-quete" } };
    assert.equal(actionCompletesAtMillis(character), NOW + 2 * HOUR_MS);
  });

  test("returns null when there is no action, or no usable instant anywhere", () => {
    assert.equal(actionCompletesAtMillis({}), null);
    assert.equal(actionCompletesAtMillis(null), null);
    assert.equal(actionCompletesAtMillis({ lastAction: { actionTypeId: "partir-en-quete" } }), null);
  });
});

describe("isActionRunning", () => {
  test("is true while the action still has time left", () => {
    assert.equal(isActionRunning(characterWith({ startedHoursAgo: 11 }), NOW), true);
  });

  test("is false once completesAt is reached, and exactly at completesAt", () => {
    assert.equal(isActionRunning(characterWith({ startedHoursAgo: 12 }), NOW), false);
    assert.equal(isActionRunning(characterWith({ startedHoursAgo: 13 }), NOW), false);
  });

  test("is false for a character that has never acted", () => {
    assert.equal(isActionRunning({}, NOW), false);
  });

  // The behaviour change this whole phase exists for: under the old UTC-date lock, an action
  // started at 23:00 unlocked at midnight, one hour later.
  test("an action started at 23:00 UTC is still running at 00:30 the next day", () => {
    const startedAt = Timestamp.fromMillis(Date.parse("2026-07-28T23:00:00Z"));
    const character = {
      lastAction: { startedAt, completesAt: Timestamp.fromMillis(startedAt.toMillis() + 24 * HOUR_MS) },
    };
    assert.equal(isActionRunning(character, Date.parse("2026-07-29T00:30:00Z")), true);
    assert.equal(isActionRunning(character, Date.parse("2026-07-29T23:30:00Z")), false);
  });

  test("honours a non-default duration", () => {
    assert.equal(isActionRunning(characterWith({ startedHoursAgo: 5, durationHours: 8 }), NOW), true);
    assert.equal(isActionRunning(characterWith({ startedHoursAgo: 9, durationHours: 8 }), NOW), false);
  });
});

describe("isActionAcknowledged", () => {
  test("reads the acknowledged flag", () => {
    assert.equal(isActionAcknowledged(characterWith({ acknowledged: true })), true);
    assert.equal(isActionAcknowledged(characterWith({ acknowledged: false })), false);
  });

  test("falls back to the pre-framework lootClaimed flag", () => {
    assert.equal(isActionAcknowledged({ lastAction: { lootClaimed: true } }), true);
    assert.equal(isActionAcknowledged({ lastAction: { lootClaimed: false } }), false);
  });

  test("prefers acknowledged over lootClaimed when both are present", () => {
    assert.equal(isActionAcknowledged({ lastAction: { acknowledged: false, lootClaimed: true } }), false);
  });

  test("defaults to false for a result carrying neither flag", () => {
    assert.equal(isActionAcknowledged({ lastAction: { actionTypeId: "partir-en-quete" } }), false);
  });

  test("is true when there is no action at all - nothing is waiting to be seen", () => {
    assert.equal(isActionAcknowledged({}), true);
  });
});

describe("actionState", () => {
  test("idle before ever acting", () => {
    assert.equal(actionState({}, NOW), "idle");
  });

  test("running, then completed, then idle once acknowledged", () => {
    assert.equal(actionState(characterWith({ startedHoursAgo: 1 }), NOW), "running");
    assert.equal(actionState(characterWith({ startedHoursAgo: 25 }), NOW), "completed");
    assert.equal(actionState(characterWith({ startedHoursAgo: 25, acknowledged: true }), NOW), "idle");
  });

  test("a running action is never 'completed', even if somehow already acknowledged", () => {
    assert.equal(actionState(characterWith({ startedHoursAgo: 1, acknowledged: true }), NOW), "running");
  });
});
