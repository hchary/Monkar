const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { drawLootTableItemId } = require("./loot");

describe("drawLootTableItemId", () => {
  test("returns null when the table has no items", () => {
    assert.equal(drawLootTableItemId({ itemIds: [] }), null);
  });

  test("draws uniformly when weightMode is not manuelle", (t) => {
    t.mock.method(Math, "random", () => 0.99);
    const table = { itemIds: ["a", "b", "c"] };
    assert.equal(drawLootTableItemId(table), "c");
  });

  test("draws by weight when weightMode is manuelle", (t) => {
    const table = { itemIds: ["a", "b"], weightMode: "manuelle", itemWeights: { a: 20, b: 80 } };

    t.mock.method(Math, "random", () => 0); // roll = 0 -> falls in a's [0, 20) slice
    assert.equal(drawLootTableItemId(table), "a");

    t.mock.restoreAll();
    t.mock.method(Math, "random", () => 0.99); // roll = 99 -> falls in b's [20, 100) slice
    assert.equal(drawLootTableItemId(table), "b");
  });

  test("falls back to uniform draw when manual weights sum to 0", (t) => {
    t.mock.method(Math, "random", () => 0.99);
    const table = { itemIds: ["a", "b"], weightMode: "manuelle", itemWeights: { a: 0, b: 0 } };
    assert.equal(drawLootTableItemId(table), "b");
  });
});
