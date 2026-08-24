const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("./partirExplorer");

const LOCATION = { id: "loc1", name: "Forêt sombre", tagIds: ["tag-flavour"] };

// Rounds are drawn against the bestiary now (docs/TODO.md "ActionResult and the single applier"),
// so the tags that drive talent matching and loot come from the monster, not from the location -
// which is why the location above carries a tag nothing matches.
// Loot comes from the monster's own resolved pool too (docs/TODO.md "Monster-pool loot"), so the
// fixture below carries its drop rather than relying on a loot table matched by rarity and tag.
const MONSTERS = [
  { id: "mon1", name: "loup des cendres", difficulty: "facile", tagIds: ["tag-x"], lootItemIds: ["obj-sword"] },
];

const OBJECTS = [{ id: "obj-sword", name: "Épée", rarity: "commun", type: "arme", tagIds: [] }];

// A single-entry weight table forces the difficulty draw deterministically, regardless of
// Math.random - the d100 roll inside resolveMission is what the per-test Math.random override then
// controls.
const FACILE_ONLY_WEIGHTS = [{ difficulty: "facile", weight: 100 }];

function baseContext(overrides = {}) {
  return {
    location: LOCATION,
    areaType: "grotte",
    candidateMonsters: MONSTERS,
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
  test("resolves encounterCount rounds, one monster encounter each", async () => {
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
      assert.equal(round.monsterId, "mon1");
      assert.equal(round.monsterName, "loup des cendres");
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
      // A roll of 99 always clears "facile"'s threshold of 10 - every round succeeds and grants
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
      // Credited to the region the character stands in, and kept in step with the legacy scalar
      // until docs/TODO.md "Per-region reputation" retires it.
      assert.equal(updates.reputations.region1, updates.lastAction.totalReputationGained);
      assert.equal(updates.reputation, updates.lastAction.totalReputationGained);
      // A successful round draws 3 items from its monster's pool, three rounds -> 9 items.
      assert.equal(updates.lastAction.loot.length, 9);
      for (const item of updates.lastAction.loot) assert.equal(item.objectId, "obj-sword");
    } finally {
      Math.random = originalRandom;
    }
  });

  test("stops the round loop early once a wound kills the character, recording fewer rounds", async () => {
    const originalRandom = Math.random;
    try {
      // A roll of 0 lands exactly on "facile"'s permanent-wound threshold (0), which wounds because
      // the band compares with <= - every resolved round inflicts a permanent wound. Starting at 2
      // permanent wounds, the first round pushes to 3 (not dead yet - the death check reads the
      // count *before* this wound), and the second round's death check then reads 3 and kills the
      // character, stopping the loop with only 2 of the 5 requested rounds recorded.
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

  test("resolves zero rounds when no monster covers the region's area", async () => {
    const { updates } = await resolve({
      character: baseCharacter(),
      actionType: baseActionType(),
      actionTypeId: "partir-explorer-action",
      today: "2026-08-06",
      context: baseContext({ areaType: null, candidateMonsters: [] }),
    });

    // A content gap, not an error: the action still resolves, it just met nothing.
    assert.deepEqual(updates.lastAction.rounds, []);
    assert.equal(updates.lastAction.success, false);
    assert.equal(updates.fatigue, 0);
    assert.deepEqual(updates.lastAction.loot, []);
  });

  test("records a null location when none was drawn, and still fights", async () => {
    const { updates } = await resolve({
      character: baseCharacter(),
      actionType: baseActionType({ encounterCount: 1 }),
      actionTypeId: "partir-explorer-action",
      today: "2026-08-06",
      context: baseContext({ location: null }),
    });

    assert.equal(updates.lastAction.location, null);
    assert.equal(updates.lastAction.rounds.length, 1);
  });
});
