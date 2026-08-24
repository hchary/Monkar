const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  SUCCESS_THRESHOLD,
  INJURY_THRESHOLDS,
  DIFFICULTY_WEIGHTS,
  MAX_ROLL,
  rollD100,
  isWinnableWithoutTalents,
  checkAgainstTalents,
  updateDifficulty,
  injuryFromRoll,
  resolveMission,
} = require("./missionResolution");

// Fixes the engine's single roll: rollD100 is Math.floor(Math.random() * 100), so a stub returning
// roll/100 produces exactly `roll`.
function withRoll(roll, fn) {
  const originalRandom = Math.random;
  Math.random = () => roll / 100;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

describe("rollD100", () => {
  test("always rolls an integer in [0, MAX_ROLL]", () => {
    for (let i = 0; i < 200; i++) {
      const roll = rollD100();
      assert.ok(Number.isInteger(roll));
      assert.ok(roll >= 0 && roll <= MAX_ROLL);
    }
  });
});

describe("checkAgainstTalents", () => {
  const TAG_IDS = ["t-survie", "t-poison"];

  test("sums the qualities of every tag-sharing talent that reaches the difficulty index", () => {
    const talents = [
      { tagIds: ["t-survie"], quality: 3 },
      { tagIds: ["t-poison", "t-feu"], quality: 4 },
    ];
    assert.deepEqual(checkAgainstTalents(talents, TAG_IDS, 3), { relevantSum: 7, perfectCount: 0 });
  });

  test("gates on quality >= difficultyIndex - a weak talent contributes nothing at a high tier", () => {
    const talents = [{ tagIds: ["t-survie"], quality: 2 }];
    assert.deepEqual(checkAgainstTalents(talents, TAG_IDS, 2), { relevantSum: 2, perfectCount: 0 });
    assert.deepEqual(checkAgainstTalents(talents, TAG_IDS, 3), { relevantSum: 0, perfectCount: 0 });
  });

  test("ignores talents sharing no tag with the mission, however good they are", () => {
    const talents = [{ tagIds: ["t-feu"], quality: 5 }];
    assert.deepEqual(checkAgainstTalents(talents, TAG_IDS, 0), { relevantSum: 0, perfectCount: 0 });
  });

  test("counts quality-5 talents among the relevant ones only", () => {
    const talents = [
      { tagIds: ["t-survie"], quality: 5 },
      { tagIds: ["t-feu"], quality: 5 },
    ];
    assert.deepEqual(checkAgainstTalents(talents, TAG_IDS, 5), { relevantSum: 5, perfectCount: 1 });
  });
});

describe("updateDifficulty", () => {
  test("a single quality-5 talent never drops a tier, at any difficulty", () => {
    for (let index = 0; index < SUCCESS_THRESHOLD.length; index++) {
      assert.equal(updateDifficulty(index, 1), index, `difficulty ${index}`);
    }
  });

  test("spends the original difficulty per step and floors at facile", () => {
    // difficulty 2, 11 perfect: 11 > 2 -> pay 2, drop to 1; 9 > 2 -> pay 2, drop to 0; floor.
    assert.equal(updateDifficulty(2, 11), 0);
    // difficulty 5, 11 perfect: 11 > 5 -> pay 5, drop to 4; 6 > 5 -> pay 5, drop to 3; 1 > 5 stops.
    assert.equal(updateDifficulty(5, 11), 3);
  });

  test("takes no step when the count only equals the cost - the loop needs strictly more", () => {
    assert.equal(updateDifficulty(3, 3), 3);
    assert.equal(updateDifficulty(3, 4), 2);
  });

  test("never runs at difficulty 0, whatever the count", () => {
    assert.equal(updateDifficulty(0, 99), 0);
  });
});

describe("injuryFromRoll", () => {
  test("sets at most one flag, for every tier and every roll in the domain", () => {
    for (let index = 0; index < INJURY_THRESHOLDS.length; index++) {
      for (let roll = 0; roll <= MAX_ROLL; roll++) {
        const injury = injuryFromRoll(roll, index);
        const set = [injury.light, injury.severe, injury.permanent].filter(Boolean).length;
        assert.ok(set <= 1, `difficulty ${index}, roll ${roll} set ${set} flags`);
      }
    }
  });

  test("wounds on a roll landing exactly on the permanent threshold - the comparison is <=", () => {
    for (let index = 0; index < INJURY_THRESHOLDS.length; index++) {
      const injury = injuryFromRoll(INJURY_THRESHOLDS[index].permanent, index);
      assert.deepEqual(injury, { light: false, severe: false, permanent: true }, `difficulty ${index}`);
    }
  });

  test("leaves an unknown difficulty index unwounded rather than throwing", () => {
    assert.deepEqual(injuryFromRoll(0, 42), { light: false, severe: false, permanent: false });
  });
});

describe("resolveMission", () => {
  const TAG_IDS = ["t-survie"];

  test("raises the roll by the relevant talents instead of lowering the threshold", () => {
    const character = { talents: [{ tagIds: TAG_IDS, quality: 3 }] };
    const outcome = withRoll(38, () => resolveMission({ character, tagIds: TAG_IDS, difficulty: "moyen" }));

    assert.equal(outcome.roll, 38);
    assert.equal(outcome.relevantSum, 3);
    assert.equal(outcome.updatedRoll, 41);
    assert.equal(outcome.threshold, 40);
    assert.equal(outcome.success, true);
  });

  test("applies the tier drop to both the threshold and the injury bands", () => {
    // Four quality-5 talents at difficulty 2: 4 > 2 -> pay 2, drop to 1; 2 > 2 stops.
    const character = { talents: Array.from({ length: 4 }, () => ({ tagIds: TAG_IDS, quality: 5 })) };
    const outcome = withRoll(0, () => resolveMission({ character, tagIds: TAG_IDS, difficulty: "difficile" }));

    assert.equal(outcome.difficultyIndex, 2);
    assert.equal(outcome.effectiveDifficultyIndex, 1);
    assert.equal(outcome.threshold, SUCCESS_THRESHOLD[1]);
    // updatedRoll 20 against difficulty 1's bands (light 10): no wound, where difficulty 2's
    // light band of 30 would have produced one.
    assert.equal(outcome.updatedRoll, 20);
    assert.equal(outcome.wound, null);
  });

  test("mythique is unwinnable without talents and winnable on a single point of bonus", () => {
    assert.equal(isWinnableWithoutTalents(SUCCESS_THRESHOLD.length - 1), false);
    assert.ok(SUCCESS_THRESHOLD.slice(0, -1).every((_, index) => isWinnableWithoutTalents(index)));

    const talentless = withRoll(MAX_ROLL, () =>
      resolveMission({ character: { talents: [] }, tagIds: TAG_IDS, difficulty: "mythique" })
    );
    assert.equal(talentless.threshold, 100);
    assert.equal(talentless.success, false);

    // A quality-5 talent clears the difficulty-5 usefulness gate and is worth +5 on the roll, but
    // one of them still never drops the tier.
    const talented = withRoll(MAX_ROLL, () =>
      resolveMission({
        character: { talents: [{ tagIds: TAG_IDS, quality: 5 }] },
        tagIds: TAG_IDS,
        difficulty: "mythique",
      })
    );
    assert.equal(talented.effectiveDifficultyIndex, 5);
    assert.equal(talented.success, true);
  });

  test("a success never wounds under the current tables", () => {
    for (let index = 0; index < SUCCESS_THRESHOLD.length; index++) {
      assert.ok(
        INJURY_THRESHOLDS[index].light < SUCCESS_THRESHOLD[index],
        `difficulty ${index}: light band overlaps its success threshold`
      );
      // Exhaustively, through the engine's own comparison rather than the tables alone: every
      // roll (raised or not) that succeeds also comes out unwounded.
      for (let roll = 0; roll <= MAX_ROLL + 25; roll++) {
        if (roll < SUCCESS_THRESHOLD[index]) continue;
        const injury = injuryFromRoll(roll, index);
        assert.deepEqual(injury, { light: false, severe: false, permanent: false }, `difficulty ${index}, roll ${roll}`);
      }
    }
  });

  test("collapses the injury triple to a single severity string", () => {
    const outcome = withRoll(0, () =>
      resolveMission({ character: { talents: [] }, tagIds: TAG_IDS, difficulty: "facile" })
    );
    assert.deepEqual(outcome.injury, { light: false, severe: false, permanent: true });
    assert.equal(outcome.wound, "permanent");
    assert.equal(outcome.success, false);
  });

  test("resolves an unknown difficulty as a wound-free failure", () => {
    const outcome = withRoll(0, () =>
      resolveMission({ character: { talents: [] }, tagIds: TAG_IDS, difficulty: "inconnue" })
    );
    assert.equal(outcome.success, false);
    assert.equal(outcome.wound, null);
    assert.equal(outcome.difficultyIndex, null);
    assert.equal(outcome.threshold, Infinity);
  });
});

describe("DIFFICULTY_WEIGHTS", () => {
  test("is a per-tier percentage distribution summing to 100", () => {
    assert.equal(DIFFICULTY_WEIGHTS.length, SUCCESS_THRESHOLD.length);
    assert.equal(
      DIFFICULTY_WEIGHTS.reduce((sum, weight) => sum + weight, 0),
      100
    );
  });
});
