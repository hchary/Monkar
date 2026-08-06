const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { TRAINING_COST_BASE, trainingCost } = require("./trainingCost");

describe("trainingCost", () => {
  test("scales linearly with the talent's current quality", () => {
    assert.equal(trainingCost({ quality: 1 }), TRAINING_COST_BASE * 1);
    assert.equal(trainingCost({ quality: 2 }), TRAINING_COST_BASE * 2);
    assert.equal(trainingCost({ quality: 4 }), TRAINING_COST_BASE * 4);
  });

  test("a talent with no quality yet defaults to quality 1's cost", () => {
    assert.equal(trainingCost({}), TRAINING_COST_BASE);
    assert.equal(trainingCost(undefined), TRAINING_COST_BASE);
  });

  test("a non-numeric quality falls back to 1 rather than propagating NaN", () => {
    assert.equal(trainingCost({ quality: "beaucoup" }), TRAINING_COST_BASE);
  });
});
