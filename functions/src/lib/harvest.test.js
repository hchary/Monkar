const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { harvestFromLootTable } = require("./harvest");

describe("harvestFromLootTable", () => {
  test("draws baseQuantity items when no modifier is given", () => {
    const lootTable = { itemIds: ["potion"] };

    const items = harvestFromLootTable({ lootTable, baseQuantity: 3 });

    assert.deepStrictEqual(items, ["potion", "potion", "potion"]);
  });

  test("draws baseQuantity*modifier items when a modifier is given", () => {
    const lootTable = { itemIds: ["bois"] };

    const items = harvestFromLootTable({ lootTable, baseQuantity: 2, modifier: 3 });

    assert.equal(items.length, 6);
    assert.ok(items.every((id) => id === "bois"));
  });

  test("draws only ids present in the loot table", () => {
    const lootTable = { itemIds: ["fer", "cuivre"] };

    const items = harvestFromLootTable({ lootTable, baseQuantity: 20 });

    assert.equal(items.length, 20);
    assert.ok(items.every((id) => lootTable.itemIds.includes(id)));
  });

  test("returns an empty set when the loot table has no items", () => {
    const items = harvestFromLootTable({ lootTable: { itemIds: [] }, baseQuantity: 5 });

    assert.deepStrictEqual(items, []);
  });

  for (const baseQuantity of [0, -1, 1.5, "3", null, undefined]) {
    test(`rejects a non-positive-integer baseQuantity (${JSON.stringify(baseQuantity)})`, () => {
      assert.throws(
        () => harvestFromLootTable({ lootTable: { itemIds: ["x"] }, baseQuantity }),
        /baseQuantity must be a positive integer/
      );
    });
  }

  for (const modifier of [0, -2, 2.5, "2"]) {
    test(`rejects a non-positive-integer modifier (${JSON.stringify(modifier)})`, () => {
      assert.throws(
        () => harvestFromLootTable({ lootTable: { itemIds: ["x"] }, baseQuantity: 1, modifier }),
        /modifier must be a positive integer/
      );
    });
  }
});
