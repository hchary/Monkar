const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { hasIngredients, craftResults } = require("./crafting");

describe("hasIngredients", () => {
  test("true when every ingredient quantity is met", () => {
    const recette = {
      ingredients: [
        { objectId: "bois", qty: 2 },
        { objectId: "fer", qty: 1 },
      ],
    };
    const ownedQuantities = { bois: 3, fer: 1 };

    assert.equal(hasIngredients({ recette, ownedQuantities }), true);
  });

  test("false when one ingredient is missing entirely", () => {
    const recette = {
      ingredients: [
        { objectId: "bois", qty: 2 },
        { objectId: "fer", qty: 1 },
      ],
    };
    const ownedQuantities = { bois: 3 };

    assert.equal(hasIngredients({ recette, ownedQuantities }), false);
  });

  test("false when one ingredient quantity is insufficient", () => {
    const recette = { ingredients: [{ objectId: "bois", qty: 2 }] };
    const ownedQuantities = { bois: 1 };

    assert.equal(hasIngredients({ recette, ownedQuantities }), false);
  });

  test("true when the recette has no ingredients", () => {
    assert.equal(hasIngredients({ recette: { ingredients: [] }, ownedQuantities: {} }), true);
  });
});

describe("craftResults", () => {
  test("flattens each result into one entry per unit", () => {
    const recette = {
      results: [
        { objectId: "epee", qty: 1 },
        { objectId: "clou", qty: 3 },
      ],
    };

    assert.deepStrictEqual(craftResults(recette), [
      { objectId: "epee" },
      { objectId: "clou" },
      { objectId: "clou" },
      { objectId: "clou" },
    ]);
  });

  test("returns an empty list when the recette has no results", () => {
    assert.deepStrictEqual(craftResults({ results: [] }), []);
  });
});
