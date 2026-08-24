const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { difficultyToRarity, rarityCeilingIndex, drawMissionLoot } = require("./missionLoot");

describe("difficultyToRarity", () => {
  test("maps each difficulty tier positionally onto the shared rarity scale", () => {
    assert.equal(difficultyToRarity("facile"), "commun");
    assert.equal(difficultyToRarity("moyen"), "peu_commun");
    assert.equal(difficultyToRarity("difficile"), "rare");
    assert.equal(difficultyToRarity("tres_difficile"), "tres_rare");
    assert.equal(difficultyToRarity("epique"), "legendaire");
    assert.equal(difficultyToRarity("mythique"), "mythique");
  });

  test("returns null for an unknown difficulty", () => {
    assert.equal(difficultyToRarity("inconnu"), null);
  });
});

describe("rarityCeilingIndex", () => {
  test("takes the higher of the mission's and the monster's difficulty", () => {
    assert.equal(rarityCeilingIndex({ difficulty: "facile", monsterDifficulty: "epique" }), 4);
    assert.equal(rarityCeilingIndex({ difficulty: "epique", monsterDifficulty: "facile" }), 4);
  });

  test("ignores an unknown difficulty on either side rather than capping at commun", () => {
    assert.equal(rarityCeilingIndex({ difficulty: "difficile", monsterDifficulty: null }), 2);
    assert.equal(rarityCeilingIndex({ difficulty: null, monsterDifficulty: "difficile" }), 2);
    assert.equal(rarityCeilingIndex({ difficulty: null, monsterDifficulty: null }), -1);
  });
});

describe("drawMissionLoot", () => {
  const DAGGER = { id: "dagger", name: "Dague", description: "Une dague.", rarity: "commun", type: "arme", tagIds: ["feu"] };
  const SWORD = { id: "sword", name: "Épée", description: "Une épée.", rarity: "rare", type: "arme", tagIds: [] };
  const CROWN = { id: "crown", name: "Couronne", description: "Une couronne.", rarity: "legendaire", type: "bijou", tagIds: [] };
  const OBJECTS = [DAGGER, SWORD, CROWN];

  test("draws three items on a success and one on a failure, from the monster's own pool", () => {
    const draw = (success) =>
      drawMissionLoot({
        success,
        difficulty: "difficile",
        monsterDifficulty: "difficile",
        lootItemIds: ["dagger", "sword"],
        objects: OBJECTS,
      });

    assert.equal(draw(true).length, 3);
    assert.equal(draw(false).length, 1);
    for (const item of [...draw(true), ...draw(false)]) {
      assert.ok(["dagger", "sword"].includes(item.objectId));
      // The catalog description verbatim - the "[Obtenue lorsque ...]" provenance clause went with
      // the narrative generator (docs/TODO.md "Narration removal").
      assert.equal(item.description, item.objectId === "dagger" ? "Une dague." : "Une épée.");
    }
  });

  test("failure pays undegraded loot: the same rarity ceiling, only a smaller haul", () => {
    const loot = drawMissionLoot({
      success: false,
      difficulty: "epique", // ceiling "legendaire" - reachable on a failure too
      monsterDifficulty: "facile",
      lootItemIds: ["crown"],
      objects: OBJECTS,
    });

    assert.equal(loot.length, 1);
    assert.equal(loot[0].rarity, "legendaire");
  });

  test("filters the pool by the rarity ceiling, which is a ceiling and not an exact match", () => {
    // "difficile" -> index 2 ("rare"): the commun dagger and the rare sword both qualify, the
    // legendaire crown does not.
    const loot = drawMissionLoot({
      success: true,
      difficulty: "difficile",
      monsterDifficulty: "facile",
      lootItemIds: ["dagger", "sword", "crown"],
      objects: OBJECTS,
    });

    assert.equal(loot.length, 3);
    for (const item of loot) assert.notEqual(item.objectId, "crown");
  });

  test("the monster's own difficulty raises the ceiling above the mission's", () => {
    // A "facile" hunt (index 0) against a "epique" monster (index 4) can still drop the crown.
    const loot = drawMissionLoot({
      success: true,
      difficulty: "facile",
      monsterDifficulty: "epique",
      lootItemIds: ["crown"],
      objects: OBJECTS,
    });

    assert.equal(loot.length, 3);
    for (const item of loot) assert.equal(item.objectId, "crown");
  });

  test("degrades to the unfiltered pool when nothing sits under the ceiling", () => {
    // A "facile" hunt against a "facile" monster whose only drop is legendaire: the content gap
    // costs the rarity guarantee, not the reward.
    const loot = drawMissionLoot({
      success: true,
      difficulty: "facile",
      monsterDifficulty: "facile",
      lootItemIds: ["crown"],
      objects: OBJECTS,
    });

    assert.equal(loot.length, 3);
    for (const item of loot) assert.equal(item.objectId, "crown");
  });

  test("returns [] when the monster has no loot authored, or none of it resolves", () => {
    assert.deepEqual(
      drawMissionLoot({ success: true, difficulty: "difficile", monsterDifficulty: "difficile", lootItemIds: [], objects: OBJECTS }),
      []
    );
    assert.deepEqual(
      drawMissionLoot({
        success: true,
        difficulty: "difficile",
        monsterDifficulty: "difficile",
        lootItemIds: ["ghost"],
        objects: OBJECTS,
      }),
      []
    );
  });

  test("never throws on missing arguments", () => {
    assert.deepEqual(drawMissionLoot({}), []);
    assert.deepEqual(drawMissionLoot({ success: true, lootItemIds: ["sword"] }), []);
    // Both difficulties unknown: the ceiling sits below the scale, so the unfiltered fallback pays.
    const loot = drawMissionLoot({ success: false, lootItemIds: ["sword"], objects: OBJECTS });
    assert.equal(loot.length, 1);
    assert.equal(loot[0].objectId, "sword");
  });
});
