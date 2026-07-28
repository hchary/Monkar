const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { FieldValue } = require("firebase-admin/firestore");
const { applyTierEffects, isSuccess } = require("./actionEffects");

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
    assert.equal(updates.lastAction.lootClaimed, false);
    assert.equal(updates.lastAction.tierName, "Succès");
    assert.equal(updates.lastAction.date, TODAY);
  });
});
