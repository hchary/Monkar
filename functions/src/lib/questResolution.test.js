const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  rollScore,
  rollReputationReward,
  computeSuccessThreshold,
  dropDifficultyTier,
  computeWoundThresholds,
  determineWoundSeverity,
  REPUTATION_REWARDS,
} = require("./questResolution");

describe("rollScore", () => {
  test("always rolls an integer in [1, 100]", () => {
    for (let i = 0; i < 200; i++) {
      const score = rollScore();
      assert.ok(Number.isInteger(score));
      assert.ok(score >= 1 && score <= 100);
    }
  });
});

describe("rollReputationReward", () => {
  test("stays within base..base+diceMax for every difficulty", () => {
    for (const [difficulty, cfg] of Object.entries(REPUTATION_REWARDS)) {
      for (let i = 0; i < 50; i++) {
        const reward = rollReputationReward(difficulty);
        assert.ok(reward >= cfg.base && reward <= cfg.base + cfg.diceMax, `${difficulty}: ${reward}`);
      }
    }
  });

  test("returns 0 for an unknown difficulty", () => {
    assert.equal(rollReputationReward("inconnu"), 0);
  });
});

describe("computeSuccessThreshold", () => {
  const OBJECTIVE = { tagIds: ["t-survie", "t-poison"] };

  test("matches the spec's own worked example: 80 base, -2 for a quality-3 talent one level above the requirement", () => {
    const character = { talents: [{ tagIds: ["t-survie", "t-sens"], quality: 3 }] };
    const threshold = computeSuccessThreshold({ character, objective: OBJECTIVE, difficulty: "difficile" });
    assert.equal(threshold, 78);
  });

  test("sums the reduction across every qualifying talent", () => {
    const character = {
      talents: [
        { tagIds: ["t-survie"], quality: 1 },
        { tagIds: ["t-poison"], quality: 1 },
      ],
    };
    // difficile: base 80, requiredTalentLevel 2 - each talent at quality 1 contributes -1 (no bonus, below requirement).
    const threshold = computeSuccessThreshold({ character, objective: OBJECTIVE, difficulty: "difficile" });
    assert.equal(threshold, 78);
  });

  test("ignores talents sharing no tag with the objective", () => {
    const character = { talents: [{ tagIds: ["t-feu"], quality: 5 }] };
    assert.equal(computeSuccessThreshold({ character, objective: OBJECTIVE, difficulty: "moyen" }), 50);
  });

  test("falls back to the unadjusted base threshold when no objective was drawn", () => {
    const character = { talents: [{ tagIds: ["t-survie"], quality: 5 }] };
    assert.equal(computeSuccessThreshold({ character, objective: null, difficulty: "moyen" }), 50);
  });

  describe("strict objective condition (all-or-nothing gate)", () => {
    const gatedObjective = {
      tagIds: ["t-survie"],
      condition: { conditions: [{ type: "hasTalentTag", tagId: "t-requis" }] },
    };

    test("denies every talent's bonus when the condition is unmet", () => {
      const character = { talents: [{ tagIds: ["t-survie"], quality: 5 }] };
      assert.equal(computeSuccessThreshold({ character, objective: gatedObjective, difficulty: "moyen" }), 50);
    });

    test("lets every tag-sharing talent count once the condition is met, not just the one that satisfied it", () => {
      const character = {
        // Satisfies the condition (owns a "t-requis" talent) and also shares the objective's tag.
        talents: [
          { tagIds: ["t-requis", "t-survie"], quality: 1 },
          // Shares the objective's tag but does NOT itself satisfy the condition - still counts,
          // since the gate is all-or-nothing rather than a per-talent filter.
          { tagIds: ["t-survie"], quality: 1 },
        ],
      };
      // Both talents count once the gate opens: -1 each off the moyen base of 50.
      assert.equal(computeSuccessThreshold({ character, objective: gatedObjective, difficulty: "moyen" }), 48);
    });
  });
});

describe("dropDifficultyTier", () => {
  test("stepping Mythique -> Épique costs 5 perfect talents", () => {
    assert.equal(dropDifficultyTier("mythique", 5), "epique");
    assert.equal(dropDifficultyTier("mythique", 4), "mythique");
  });

  test("stepping Mythique -> Très difficile (2 steps) costs 5+4=9", () => {
    assert.equal(dropDifficultyTier("mythique", 9), "tres_difficile");
    assert.equal(dropDifficultyTier("mythique", 8), "epique");
  });

  test("never drops below facile, and any leftover balance is wasted", () => {
    assert.equal(dropDifficultyTier("moyen", 100), "facile");
  });

  test("facile has nothing to drop to", () => {
    assert.equal(dropDifficultyTier("facile", 100), "facile");
  });
});

describe("computeWoundThresholds", () => {
  const OBJECTIVE = { tagIds: ["t-survie"] };

  test("uses the base row unadjusted with no qualifying talents", () => {
    const character = { talents: [] };
    assert.deepEqual(computeWoundThresholds({ character, objective: OBJECTIVE, difficulty: "difficile" }), {
      permanent: 5,
      severe: 30,
      light: 60,
    });
  });

  test("reduces every threshold by 1 per tag-sharing talent, applied after the tier-drop lookup", () => {
    const character = {
      talents: [
        { tagIds: ["t-survie"], quality: 1 },
        { tagIds: ["t-survie"], quality: 1 },
      ],
    };
    assert.deepEqual(computeWoundThresholds({ character, objective: OBJECTIVE, difficulty: "difficile" }), {
      permanent: 3,
      severe: 28,
      light: 58,
    });
  });

  test("floors each threshold independently instead of going negative", () => {
    const character = {
      talents: Array.from({ length: 20 }, () => ({ tagIds: ["t-survie"], quality: 1 })),
    };
    assert.deepEqual(computeWoundThresholds({ character, objective: OBJECTIVE, difficulty: "facile" }), {
      permanent: 1,
      severe: 2,
      light: 3,
    });
  });

  test("applies the perfect-talent tier drop before the tag reduction", () => {
    const character = {
      talents: [
        { tagIds: [], quality: 5 },
        { tagIds: [], quality: 5 },
        { tagIds: [], quality: 5 },
        { tagIds: [], quality: 5 },
        { tagIds: [], quality: 5 },
      ],
    };
    // 5 perfect talents drop mythique -> epique (cost 5), no tag-sharing talents so no further reduction.
    assert.deepEqual(computeWoundThresholds({ character, objective: OBJECTIVE, difficulty: "mythique" }), {
      permanent: 30,
      severe: 80,
      light: 95,
    });
  });
});

describe("determineWoundSeverity", () => {
  test("matches the wound whose threshold the score lands exactly on", () => {
    const thresholds = { permanent: 5, severe: 30, light: 60 };
    assert.equal(determineWoundSeverity({ score: 60, thresholds }), "light");
    assert.equal(determineWoundSeverity({ score: 30, thresholds }), "severe");
    assert.equal(determineWoundSeverity({ score: 5, thresholds }), "permanent");
    assert.equal(determineWoundSeverity({ score: 6, thresholds }), null);
  });

  test("the most severe matching wound wins when thresholds coincide", () => {
    const thresholds = { permanent: 3, severe: 3, light: 3 };
    assert.equal(determineWoundSeverity({ score: 3, thresholds }), "permanent");
  });
});
