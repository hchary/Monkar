const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { assembleMissionName } = require("./missionNaming");

const VAINCRE = { phrase: "Vaincre", type: "ennemis" };

const DRAGON = {
  name: "dragon",
  type: "ennemis",
  difficultyTiers: [
    { difficulty: "difficile", prefix: "jeune", suffix: null, tagIds: [] },
    { difficulty: "epique", prefix: null, suffix: "liche", tagIds: ["mort-vivant"] },
  ],
  variations: [{ prefix: null, suffix: "rouge", tagIds: ["feu"] }],
};

describe("assembleMissionName", () => {
  test("matches docs/TODO.md's worked example - tier suffix + variation suffix", () => {
    const name = assembleMissionName({
      action: VAINCRE,
      subject: DRAGON,
      difficulty: "epique",
      variation: DRAGON.variations[0],
    });
    assert.equal(name, "Vaincre dragon rouge liche");
  });

  test("a tier prefix and no variation renders just the prefix + name", () => {
    const name = assembleMissionName({
      action: VAINCRE,
      subject: DRAGON,
      difficulty: "difficile",
      variation: null,
    });
    assert.equal(name, "Vaincre jeune dragon");
  });

  test("a difficulty with no matching tier skips the tier's slots entirely", () => {
    const name = assembleMissionName({
      action: VAINCRE,
      subject: DRAGON,
      difficulty: "mythique",
      variation: null,
    });
    assert.equal(name, "Vaincre dragon");
  });
});
