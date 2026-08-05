const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { stampLifecycle } = require("./actionEffects");
const { HOUR_MS } = require("./actionLifecycle");

// FieldValue sentinels (increment/arrayUnion/serverTimestamp) are plain transform objects
// that compare correctly under deepStrictEqual, so a patch can be asserted as a whole rather
// than key by key - no Firestore connection or initializeApp() needed.

const TODAY = "2026-07-28";

describe("stampLifecycle", () => {
  const NOW = Timestamp.fromMillis(Date.parse("2026-07-28T12:00:00Z"));
  const ACTION_TYPE = { label: "Partir en quête", categoryId: "aventure", handlerId: "partirEnQuete" };

  function stamp(updates, options) {
    return stampLifecycle(updates, { actionType: ACTION_TYPE, now: NOW, ...options });
  }

  test("completesAt is startedAt plus the action's duration", () => {
    const { lastAction } = stamp({ lastAction: {} });

    assert.deepStrictEqual(lastAction.startedAt, NOW);
    assert.deepStrictEqual(lastAction.completesAt, Timestamp.fromMillis(NOW.toMillis() + 12 * HOUR_MS));
  });

  test("honours a per-action duration, and an explicit override on top of it", () => {
    const fromCatalog = stampLifecycle(
      { lastAction: {} },
      { actionType: { ...ACTION_TYPE, durationHours: 6 }, now: NOW }
    );
    assert.deepStrictEqual(
      fromCatalog.lastAction.completesAt,
      Timestamp.fromMillis(NOW.toMillis() + 6 * HOUR_MS)
    );

    const overridden = stampLifecycle(
      { lastAction: {} },
      { actionType: { ...ACTION_TYPE, durationHours: 6 }, now: NOW, durationHours: 2 }
    );
    assert.deepStrictEqual(
      overridden.lastAction.completesAt,
      Timestamp.fromMillis(NOW.toMillis() + 2 * HOUR_MS)
    );
  });

  test("denormalizes the label and category, and starts unacknowledged", () => {
    const { lastAction } = stamp({ lastAction: {} });

    assert.equal(lastAction.label, "Partir en quête");
    assert.equal(lastAction.categoryId, "aventure");
    assert.equal(lastAction.handlerId, "partirEnQuete");
    assert.equal(lastAction.acknowledged, false);
  });

  test("keeps a handler's own accent, and falls back to the category otherwise", () => {
    const questAccent = { kind: "difficulty", value: "epique" };
    assert.deepStrictEqual(stamp({ lastAction: { accent: questAccent } }).lastAction.accent, questAccent);

    assert.deepStrictEqual(stamp({ lastAction: {} }).lastAction.accent, {
      kind: "category",
      value: "aventure",
    });
    assert.deepStrictEqual(stamp({ lastAction: { accent: null } }).lastAction.accent, {
      kind: "category",
      value: "aventure",
    });
  });

  test("leaves the handler's own fields untouched, inside lastAction and beside it", () => {
    const stamped = stamp({
      lastActionDate: TODAY,
      gold: FieldValue.increment(10),
      lastAction: { actionTypeId: "partir-en-quete", success: true, quest: { id: "q1" } },
    });

    assert.equal(stamped.lastActionDate, TODAY);
    assert.deepStrictEqual(stamped.gold, FieldValue.increment(10));
    assert.equal(stamped.lastAction.actionTypeId, "partir-en-quete");
    assert.equal(stamped.lastAction.success, true);
    assert.deepStrictEqual(stamped.lastAction.quest, { id: "q1" });
  });

  test("does not mutate the patch it was given", () => {
    const updates = { lastAction: { success: true } };
    stamp(updates);

    assert.deepStrictEqual(updates, { lastAction: { success: true } });
  });
});
