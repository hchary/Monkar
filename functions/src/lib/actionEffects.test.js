const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { applyTierEffects, isSuccess, resolveDurationHours, stampLifecycle } = require("./actionEffects");
const { HOUR_MS } = require("./actionLifecycle");

// FieldValue sentinels (increment/arrayUnion/serverTimestamp) are plain transform objects
// that compare correctly under deepStrictEqual, so the patch can be asserted as a whole
// rather than key by key - no Firestore connection or initializeApp() needed.

const TODAY = "2026-07-28";

describe("isSuccess", () => {
  test("a tier is a success unless it explicitly says otherwise", () => {
    assert.equal(isSuccess({ name: "Succès" }), true);
    assert.equal(isSuccess({ name: "Succès", success: true }), true);
    assert.equal(isSuccess({ name: "Échec", success: false }), false);
  });
});

describe("applyTierEffects", () => {
  test("a success tier grants every gain it declares", () => {
    const talentGained = { id: "t1", name: "Résistance au feu", quality: 1 };
    const tier = {
      name: "Exploit",
      goldGain: 40,
      itemGain: { name: "Corde", qty: 1 },
      reputationGain: 3,
      legendary: true,
    };

    const updates = applyTierEffects({
      tier,
      today: TODAY,
      actionTypeId: "partir-en-quete",
      narrativeText: "Vous avez triomphé des bandits",
      talentGained,
    });

    assert.deepStrictEqual(updates, {
      lastActionDate: TODAY,
      lastActionAt: FieldValue.serverTimestamp(),
      lastAction: {
        actionTypeId: "partir-en-quete",
        date: TODAY,
        tierName: "Exploit",
        success: true,
        narrativeText: "Vous avez triomphé des bandits",
        goldGain: 40,
        itemGain: { name: "Corde", qty: 1 },
        talentGain: talentGained,
        reputationGain: 3,
        legendary: true,
        consequence: null,
      },
      gold: FieldValue.increment(40),
      inventory: FieldValue.arrayUnion({ name: "Corde", qty: 1 }),
      talents: FieldValue.arrayUnion(talentGained),
      reputation: FieldValue.increment(3),
      legendLevel: FieldValue.increment(1),
    });
  });

  test("a success tier with no gains touches no character stat", () => {
    const updates = applyTierEffects({
      tier: { name: "Sans gain" },
      today: TODAY,
      actionTypeId: "se-reposer",
    });

    assert.deepStrictEqual(Object.keys(updates), ["lastActionDate", "lastActionAt", "lastAction"]);
    assert.deepStrictEqual(updates.lastAction, {
      actionTypeId: "se-reposer",
      date: TODAY,
      tierName: "Sans gain",
      success: true,
      narrativeText: "",
      goldGain: 0,
      itemGain: null,
      talentGain: null,
      reputationGain: 0,
      legendary: false,
      consequence: null,
    });
  });

  test("a wound tier records the wound and grants nothing", () => {
    const consequence = { type: "wound", name: "Côte fêlée", description: "Un coup de massue" };

    const updates = applyTierEffects({
      tier: { name: "Défaite", success: false, goldGain: 10, reputationGain: 2, consequence },
      today: TODAY,
      actionTypeId: "partir-en-quete",
    });

    assert.deepStrictEqual(updates.wounds, FieldValue.arrayUnion({
      name: "Côte fêlée",
      description: "Un coup de massue",
      date: TODAY,
    }));
    assert.equal(updates.lastAction.success, false);
    assert.deepStrictEqual(updates.lastAction.consequence, consequence);
    // The tier's gains are still reported in lastAction, but never applied on a failure.
    assert.equal(updates.lastAction.goldGain, 10);
    assert.equal("gold" in updates, false);
    assert.equal("reputation" in updates, false);
    assert.equal("alive" in updates, false);
  });

  test("a wound with no name or description falls back to the tier name and an empty string", () => {
    const updates = applyTierEffects({
      tier: { name: "Embuscade", success: false, consequence: { type: "wound" } },
      today: TODAY,
      actionTypeId: "partir-en-quete",
    });

    assert.deepStrictEqual(updates.wounds, FieldValue.arrayUnion({
      name: "Embuscade",
      description: "",
      date: TODAY,
    }));
  });

  test("a death tier kills the character and records no wound", () => {
    const updates = applyTierEffects({
      tier: {
        name: "Mort",
        success: false,
        consequence: { type: "death", description: "Dévoré par un troll" },
      },
      today: TODAY,
      actionTypeId: "partir-en-quete",
    });

    assert.equal(updates.alive, false);
    assert.equal("wounds" in updates, false);
  });

  test("lastActionExtra is merged into lastAction, leaving the shared fields intact", () => {
    const quest = { id: "q1", name: "Chasse aux bandits", difficulty: "moyen" };

    const updates = applyTierEffects({
      tier: { name: "Succès" },
      today: TODAY,
      actionTypeId: "partir-en-quete",
      lastActionExtra: { quest, loot: [], lootClaimed: false },
    });

    assert.deepStrictEqual(updates.lastAction.quest, quest);
    assert.deepStrictEqual(updates.lastAction.loot, []);
    assert.equal(updates.lastAction.tierName, "Succès");
    assert.equal(updates.lastAction.date, TODAY);
  });
});

describe("resolveDurationHours", () => {
  test("defaults to 24h", () => {
    assert.equal(resolveDurationHours({}), 24);
    assert.equal(resolveDurationHours(undefined), 24);
  });

  test("honours a positive duration", () => {
    assert.equal(resolveDurationHours({ durationHours: 8 }), 8);
    assert.equal(resolveDurationHours({ durationHours: "12" }), 12);
  });

  test("falls back to the default rather than producing an action that never completes", () => {
    assert.equal(resolveDurationHours({ durationHours: 0 }), 24);
    assert.equal(resolveDurationHours({ durationHours: -5 }), 24);
    assert.equal(resolveDurationHours({ durationHours: "bientôt" }), 24);
    assert.equal(resolveDurationHours({ durationHours: null }), 24);
  });
});

describe("stampLifecycle", () => {
  const NOW = Timestamp.fromMillis(Date.parse("2026-07-28T12:00:00Z"));
  const ACTION_TYPE = { label: "Partir en quête", categoryId: "aventure" };

  function stamp(updates, options) {
    return stampLifecycle(updates, { actionType: ACTION_TYPE, now: NOW, ...options });
  }

  test("completesAt is startedAt plus the action's duration", () => {
    const { lastAction } = stamp({ lastAction: {} });

    assert.deepStrictEqual(lastAction.startedAt, NOW);
    assert.deepStrictEqual(lastAction.completesAt, Timestamp.fromMillis(NOW.toMillis() + 24 * HOUR_MS));
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
      lastAction: { actionTypeId: "partir-en-quete", tierName: "Succès", quest: { id: "q1" } },
    });

    assert.equal(stamped.lastActionDate, TODAY);
    assert.deepStrictEqual(stamped.gold, FieldValue.increment(10));
    assert.equal(stamped.lastAction.actionTypeId, "partir-en-quete");
    assert.equal(stamped.lastAction.tierName, "Succès");
    assert.deepStrictEqual(stamped.lastAction.quest, { id: "q1" });
  });

  test("does not mutate the patch it was given", () => {
    const updates = { lastAction: { tierName: "Succès" } };
    stamp(updates);

    assert.deepStrictEqual(updates, { lastAction: { tierName: "Succès" } });
  });
});
