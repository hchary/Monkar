const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("./partirExplorer");
const { LOOT_COUNT_BY_DIFFICULTY } = require("../lib/loot");

const LOCATION = { id: "loc1", name: "Forêt sombre", tagIds: ["tag-x"] };

// difficultyToRarity("facile") -> "commun" (docs/TODO.md "Mission loot and rarity mapping") - the
// same positional mapping missions use, now shared by exploration's own synthetic per-round
// objective (docs/TODO.md "Retiring quests and quest objectives for the subject-action system").
const LOOT_TABLES = [{ id: "table1", rarity: "commun", tagIds: ["tag-x"], itemIds: ["obj-sword"] }];
const OBJECTS = [{ id: "obj-sword", name: "Épée", rarity: "commun", type: "arme", tagIds: [] }];

// A single-entry weight table forces the difficulty draw deterministically, regardless of
// Math.random - the score roll inside resolveQuestOutcome is what the per-test Math.random
// override then controls.
const FACILE_ONLY_WEIGHTS = [{ difficulty: "facile", weight: 100 }];

function baseContext(overrides = {}) {
  return {
    location: LOCATION,
    narrativeSubjects: [],
    verbPhrases: [],
    lootTables: LOOT_TABLES,
    objects: OBJECTS,
    talents: [],
    ...overrides,
  };
}

function baseCharacter(overrides = {}) {
  return {
    talents: [],
    reputation: 0,
    fatigue: 0,
    woundsLight: 0,
    woundsSevere: 0,
    woundsPermanent: 0,
    region: { id: "region1", name: "Vallée" },
    ...overrides,
  };
}

function baseActionType(overrides = {}) {
  return { encounterCount: 3, questDifficultyWeights: FACILE_ONLY_WEIGHTS, ...overrides };
}

describe("partirExplorer resolve()", () => {
  test("resolves encounterCount rounds, one full resolveQuestOutcome roll each", async () => {
    const { updates } = await resolve({
      character: baseCharacter(),
      actionType: baseActionType(),
      actionTypeId: "partir-explorer-action",
      today: "2026-08-06",
      context: baseContext(),
    });

    assert.equal(updates.lastAction.rounds.length, 3);
    for (const round of updates.lastAction.rounds) {
      assert.equal(round.difficulty, "facile");
      assert.equal(typeof round.score, "number");
      assert.equal(typeof round.threshold, "number");
      assert.equal(typeof round.success, "boolean");
    }
    assert.equal(updates.fatigue, 3);
    assert.equal(updates.lastAction.location.name, "Forêt sombre");
  });

  test("sums reputation and flattens loot/talentEvolutions across every round on forced successes", async () => {
    const originalRandom = Math.random;
    try {
      // Score 100 always clears "facile"'s threshold of 30 - every round succeeds and grants
      // reputation and loot deterministically.
      Math.random = () => 0.999;

      const { updates } = await resolve({
        character: baseCharacter(),
        actionType: baseActionType(),
        actionTypeId: "partir-explorer-action",
        today: "2026-08-06",
        context: baseContext(),
      });

      assert.equal(updates.lastAction.success, true);
      assert.equal(
        updates.lastAction.totalReputationGained,
        updates.lastAction.rounds.reduce((sum, r) => sum + r.reputationGained, 0)
      );
      assert.ok(updates.lastAction.totalReputationGained > 0);
      assert.equal(updates.reputation, updates.lastAction.totalReputationGained);
      // "facile" draws 1 loot item per LOOT_COUNT_BY_DIFFICULTY, three rounds -> 3 items.
      assert.equal(LOOT_COUNT_BY_DIFFICULTY.facile, 1);
      assert.equal(updates.lastAction.loot.length, 3);
    } finally {
      Math.random = originalRandom;
    }
  });

  test("stops the round loop early once a wound kills the character, recording fewer rounds", async () => {
    const originalRandom = Math.random;
    try {
      // Score 1 always lands exactly on "facile"'s floored permanent-wound threshold (1) - every
      // resolved round inflicts a permanent wound. Starting at 2 permanent wounds, the first round
      // pushes to 3 (not dead yet - the death check reads the count *before* this wound), and the
      // second round's death check then reads 3 and kills the character, stopping the loop with
      // only 2 of the 5 requested rounds recorded.
      Math.random = () => 0;

      const { updates } = await resolve({
        character: baseCharacter({ woundsPermanent: 2 }),
        actionType: baseActionType({ encounterCount: 5 }),
        actionTypeId: "partir-explorer-action",
        today: "2026-08-06",
        context: baseContext(),
      });

      assert.equal(updates.lastAction.rounds.length, 2);
      assert.equal(updates.fatigue, 2);
      assert.equal(updates.woundsPermanent, 3);
      assert.equal(updates.alive, false);
    } finally {
      Math.random = originalRandom;
    }
  });

  test("synthesizes an untagged objective and a null location when none was drawn", async () => {
    const { updates } = await resolve({
      character: baseCharacter(),
      actionType: baseActionType({ encounterCount: 1 }),
      actionTypeId: "partir-explorer-action",
      today: "2026-08-06",
      context: baseContext({ location: null }),
    });

    assert.equal(updates.lastAction.location, null);
    assert.equal(updates.lastAction.rounds.length, 1);
    // No location tags to draw loot against - a content gap, not an error.
    assert.deepEqual(updates.lastAction.loot, []);
  });
});
