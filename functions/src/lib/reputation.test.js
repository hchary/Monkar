const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { successReputation, failureReputation, reputationForOutcome } = require("./reputation");
const { SUCCESS_THRESHOLD, DIFFICULTY_WEIGHTS, MAX_ROLL } = require("./missionResolution");
const { DIFFICULTY_ORDER } = require("./rolls");

// The chance a character clears a tier's threshold with `bonus` points of talent behind the roll.
// The roll is uniform over 0..MAX_ROLL, so this is exact rather than sampled - the invariants below
// are properties of the two tables, not of any particular seed.
function successChance(difficultyIndex, bonus = 0) {
  const rollsThatWin = (MAX_ROLL + 1) - Math.max(0, SUCCESS_THRESHOLD[difficultyIndex] - bonus);
  return Math.min(Math.max(rollsThatWin, 0), MAX_ROLL + 1) / (MAX_ROLL + 1);
}

// Expected reputation from one mission at one tier, for a character carrying `bonus` points of
// relevant talent.
function expectedAtTier(difficultyIndex, bonus = 0) {
  const p = successChance(difficultyIndex, bonus);
  return p * successReputation(difficultyIndex) + (1 - p) * failureReputation(difficultyIndex);
}

// The same expectation over a mission drawn the way generation draws one: a difficulty from
// DIFFICULTY_WEIGHTS, then a roll against that tier.
function expectedPerMission(bonus = 0) {
  const totalWeight = DIFFICULTY_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  return DIFFICULTY_WEIGHTS.reduce(
    (sum, weight, index) => sum + (weight / totalWeight) * expectedAtTier(index, bonus),
    0
  );
}

describe("reputationForOutcome", () => {
  test("a success pays 1 + difficultyIndex", () => {
    assert.deepStrictEqual(
      DIFFICULTY_ORDER.map((difficulty) => reputationForOutcome({ success: true, difficulty })),
      [1, 2, 3, 4, 5, 6]
    );
  });

  test("a failure costs 4 - difficultyIndex, unclamped: epique is free and mythique still pays", () => {
    assert.deepStrictEqual(
      DIFFICULTY_ORDER.map((difficulty) => reputationForOutcome({ success: false, difficulty })),
      [-4, -3, -2, -1, 0, 1]
    );
  });

  test("an unknown difficulty pays nothing in either direction", () => {
    assert.equal(reputationForOutcome({ success: true, difficulty: "impossible" }), 0);
    assert.equal(reputationForOutcome({ success: false, difficulty: undefined }), 0);
    assert.equal(reputationForOutcome({ success: false, difficulty: null }), 0);
  });
});

// The two formulas were chosen independently of the success thresholds and of the generation
// weights, and what they add up to is the whole balance of the system. Nothing in the three tables
// says so, so retuning any one of them silently breaks the design unless these fail.
describe("the zero-sum invariant", () => {
  test("a talentless character's expected reputation per mission is zero, within a rounding error", () => {
    const expectation = expectedPerMission(0);

    assert.ok(
      Math.abs(expectation) < 0.05,
      `talentless expectation should sit within +/-0.05 of zero, got ${expectation}`
    );
    // The exact value under the current tables, pinned so a retune has to notice it moved.
    assert.ok(Math.abs(expectation - 0.0125) < 1e-9, `expected +0.0125, got ${expectation}`);
  });

  test("talents, not tiers, are what make missions pay", () => {
    // One tag-matching quality-5 talent: +5 on the roll, and - since a single perfect talent never
    // drops a tier (see updateDifficulty) - the same tier resolved against the same table.
    const talented = DIFFICULTY_ORDER.map((_, index) => expectedAtTier(index, 5));
    const talentless = DIFFICULTY_ORDER.map((_, index) => expectedAtTier(index, 0));

    for (const [index, value] of talented.entries()) {
      assert.ok(value > talentless[index], `tier ${index}: ${value} should beat ${talentless[index]}`);
      // Exactly +0.25 at every tier, because the success/failure spread is a constant 5: talent is
      // worth the same wherever it is spent, which is what keeps the flat base curve fair rather
      // than merely flat. The tier only changes how *fast* a talented character climbs in absolute
      // terms, not whether climbing pays.
      assert.ok(
        Math.abs(value - talentless[index] - 0.25) < 1e-9,
        `tier ${index}: a quality-5 talent should be worth +0.25, got ${value - talentless[index]}`
      );
    }

    assert.ok(expectedPerMission(5) > expectedPerMission(0));
  });

  test("the success/failure spread is the constant 5 that invariant rests on", () => {
    for (const [index] of DIFFICULTY_ORDER.entries()) {
      assert.equal(successReputation(index) - failureReputation(index), 5, `spread differs at tier ${index}`);
    }
  });
});
