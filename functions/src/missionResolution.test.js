const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolveQuestOutcome } = require("./missionResolution");

describe("resolveQuestOutcome", () => {
  const objective = { id: "obj1", nom: "bandits", article: "les", rarity: "rare", tagIds: ["t-protection"] };
  const lootTables = [
    { id: "table-rare", rarity: "rare", tagIds: ["t-protection"], itemIds: ["obj-shield"] },
    { id: "table-commun", rarity: "commun", tagIds: ["t-protection"], itemIds: ["obj-stick"] },
  ];
  const objects = [
    { id: "obj-shield", name: "Bouclier", rarity: "rare", type: "armure", tagIds: [] },
    { id: "obj-stick", name: "Bâton", rarity: "commun", type: "arme", tagIds: [] },
  ];

  function baseArgs(overrides = {}) {
    return {
      character: { talents: [], reputation: 0 },
      quest: { id: "q1", name: "Le siège de Vaubourg", tagIds: ["t-protection"], difficulty: "mythique" },
      questObjectives: [objective],
      lootTables,
      objects,
      talents: [],
      locationName: null,
      today: "2026-08-05",
      circumstance: "lors de la quête « Le siège de Vaubourg »",
      ...overrides,
    };
  }

  test("draws degraded-rarity loot (two ranks down, floored at commun) and grants no reputation on a forced failure", () => {
    const originalRandom = Math.random;
    try {
      // "mythique" has a success threshold of 100 and the roll's domain is 0..99, so a talentless
      // character cannot clear it at all (docs/TODO.md "Resolution engine rebuild") - a roll fixed
      // at 0 (Math.random -> 0) fails deterministically without a statistical loop.
      Math.random = () => 0;

      const outcome = resolveQuestOutcome(baseArgs());

      assert.equal(outcome.success, false);
      assert.equal(outcome.score, 0);
      // A roll of 0 is inside "mythique"'s permanent band (70), and the wound is applied here.
      assert.equal(outcome.wound, "permanent");
      assert.equal(outcome.woundResult.woundsPermanent, 1);
      assert.equal(outcome.reputationGained, 0);
      assert.deepEqual(outcome.talentEvolutions, []);
      // Objective rarity "rare" (index 2) minus 2 ranks -> "commun" (index 0), not "rare".
      // "mythique" draws 3 loot items (LOOT_COUNT_BY_DIFFICULTY), all matching the "commun" table.
      assert.equal(outcome.loot.length, 3);
      assert.ok(outcome.loot.every((item) => item.rarity === "commun"));
    } finally {
      Math.random = originalRandom;
    }
  });

  test("draws exact-rarity loot, rolls reputation, and may evolve talents on a forced success", () => {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.999;

      const outcome = resolveQuestOutcome(baseArgs({ quest: { ...baseArgs().quest, difficulty: "facile" } }));

      assert.equal(outcome.success, true);
      assert.ok(outcome.reputationGained > 0);
      assert.equal(outcome.loot.length, 1);
      assert.equal(outcome.loot[0].rarity, "rare");
    } finally {
      Math.random = originalRandom;
    }
  });

  test("never narrates: narrativeText is empty and loot keeps its catalog description verbatim", () => {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.999;

      const outcome = resolveQuestOutcome(
        baseArgs({
          quest: { ...baseArgs().quest, difficulty: "facile" },
          objects: [{ ...objects[0], description: "Un bouclier cabossé." }],
        })
      );

      assert.equal(outcome.success, true);
      assert.equal(outcome.narrativeText, "");
      // No "[Obtenue lorsque ...]" provenance clause any more (docs/TODO.md "Narration removal").
      assert.equal(outcome.loot[0].description, "Un bouclier cabossé.");
    } finally {
      Math.random = originalRandom;
    }
  });
});
