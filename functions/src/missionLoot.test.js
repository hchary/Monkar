const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { difficultyToRarity, drawMissionLoot } = require("./missionLoot");

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

describe("drawMissionLoot", () => {
  const SWORD = { id: "sword", name: "Épée", description: "Une épée.", rarity: "rare", type: "arme", tagIds: [] };

  const MATCHING_TABLE = {
    id: "table-rare-feu",
    name: "Table rare feu",
    rarity: "rare",
    tagIds: ["feu"],
    itemIds: ["sword"],
  };

  const NON_MATCHING_RARITY_TABLE = {
    id: "table-legendaire-feu",
    name: "Table légendaire feu",
    rarity: "legendaire",
    tagIds: ["feu"],
    itemIds: ["sword"],
  };

  const NON_MATCHING_TAG_TABLE = {
    id: "table-rare-glace",
    name: "Table rare glace",
    rarity: "rare",
    tagIds: ["glace"],
    itemIds: ["sword"],
  };

  test("draws the difficulty's loot count from tables matching rarity and tag overlap", () => {
    const loot = drawMissionLoot({
      difficulty: "difficile", // -> rare
      tagIds: ["feu"],
      lootTables: [MATCHING_TABLE, NON_MATCHING_RARITY_TABLE, NON_MATCHING_TAG_TABLE],
      objects: [SWORD],
    });

    assert.equal(loot.length, 2); // LOOT_COUNT_BY_DIFFICULTY.difficile
    for (const item of loot) {
      assert.equal(item.objectId, "sword");
      assert.equal(item.tableId, "table-rare-feu");
      // The catalog description verbatim - the "[Obtenue lorsque ...]" provenance clause went with
      // the narrative generator (docs/TODO.md "Narration removal").
      assert.equal(item.description, "Une épée.");
    }
  });

  test("returns no loot when no table matches rarity/tag", () => {
    const loot = drawMissionLoot({
      difficulty: "difficile",
      tagIds: ["glace"],
      lootTables: [MATCHING_TABLE],
      objects: [SWORD],
    });
    assert.deepEqual(loot, []);
  });

  test("returns no loot for an unknown difficulty", () => {
    const loot = drawMissionLoot({
      difficulty: "inconnu",
      tagIds: ["feu"],
      lootTables: [MATCHING_TABLE],
      objects: [SWORD],
    });
    assert.deepEqual(loot, []);
  });

  test("rarityOffset shifts the target rarity down that many ranks (failure consolation loot)", () => {
    // "difficile" -> "rare" (index 2); an offset of 2 targets "commun" (index 0) instead.
    const commonTable = { ...MATCHING_TABLE, id: "table-commun-feu", rarity: "commun" };

    const loot = drawMissionLoot({
      difficulty: "difficile",
      tagIds: ["feu"],
      lootTables: [MATCHING_TABLE, commonTable],
      objects: [SWORD],
      rarityOffset: 2,
    });

    assert.equal(loot.length, 2);
    for (const item of loot) assert.equal(item.tableId, "table-commun-feu");
  });

  test("rarityOffset floors at the scale's lowest rank rather than going negative", () => {
    // "facile" -> "commun" (index 0) already; an offset of 5 still targets "commun".
    const commonTable = { ...MATCHING_TABLE, id: "table-commun-feu", rarity: "commun" };

    const loot = drawMissionLoot({
      difficulty: "facile",
      tagIds: ["feu"],
      lootTables: [commonTable],
      objects: [SWORD],
      rarityOffset: 5,
    });

    assert.equal(loot.length, 1); // LOOT_COUNT_BY_DIFFICULTY.facile
    assert.equal(loot[0].tableId, "table-commun-feu");
  });
});
