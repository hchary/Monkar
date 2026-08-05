const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("./mission");
const { LOOT_COUNT_BY_DIFFICULTY } = require("../lib/loot");

const OBJECTIVE = { id: "obj1", nom: "bandits", article: "les", rarity: "commun", tagIds: ["tag-x"], tags: [] };

const MISSION = {
  id: "mission1",
  objectiveId: "obj1",
  difficulty: "difficile",
  tagIds: ["tag-x"],
  locationId: "",
  regionId: "region1",
  generatedAt: "2026-08-01",
};

const LOOT_TABLES = [{ id: "table1", rarity: "commun", tagIds: ["tag-x"], itemIds: ["obj-sword"] }];
const OBJECTS = [{ id: "obj-sword", name: "Épée", rarity: "commun", type: "arme", tagIds: [] }];

function baseContext(overrides = {}) {
  return {
    mission: MISSION,
    objective: OBJECTIVE,
    locationName: null,
    narrativeSubjects: [OBJECTIVE],
    verbPhrases: [],
    lootTables: LOOT_TABLES,
    objects: OBJECTS,
    talents: [],
    tags: [],
    ...overrides,
  };
}

function baseCharacter(overrides = {}) {
  return { talents: [], missionJournal: [MISSION], ...overrides };
}

describe("mission resolve()", () => {
  test("draws loot at the mission's own full difficulty, without the removed reward discount", async () => {
    // "difficile" draws 2 items per LOOT_COUNT_BY_DIFFICULTY - no longer scaled down to "moyen"'s 1
    // the way the retired rewardDifficulty discount used to (docs/TODO.md "Mission and quest
    // resolution algorithm": "a balance mistake... removed"). The single fixture loot table is
    // "commun", which both a success (exact match) and a failure (floored at "commun" after the
    // two-rank degrade) still match, so this is deterministic regardless of the score roll.
    assert.equal(LOOT_COUNT_BY_DIFFICULTY.difficile, 2);

    const { updates } = await resolve({
      character: baseCharacter(),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext(),
    });

    assert.equal(updates.lastAction.loot.length, 2);
    assert.equal(updates.lastAction.mission.difficulty, "difficile");
  });

  test("surfaces the score-roll outcome fields on lastAction", async () => {
    const { updates } = await resolve({
      character: baseCharacter(),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext(),
    });

    assert.equal(typeof updates.lastAction.score, "number");
    assert.equal(typeof updates.lastAction.threshold, "number");
    assert.equal(typeof updates.lastAction.success, "boolean");
    assert.equal(typeof updates.lastAction.reputationGained, "number");
    if (!updates.lastAction.success) assert.equal(updates.lastAction.reputationGained, 0);
  });

  test("guarantees success when talent tag overlap drops the threshold to the floor", async () => {
    // "difficile" bases at 80 with requiredTalentLevel 2; 79 quality-1 talents sharing the
    // objective's tag each contribute -1, driving the threshold to 1 - low enough that any
    // 1-100 score roll succeeds, without needing to mock Math.random.
    const talents = Array.from({ length: 79 }, (_, i) => ({
      id: `t${i}`,
      name: `Talent ${i}`,
      quality: 1,
      tagIds: ["tag-x"],
    }));

    const { updates } = await resolve({
      character: baseCharacter({ talents }),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext(),
    });

    assert.equal(updates.lastAction.success, true);
    assert.ok(updates.lastAction.reputationGained > 0);
  });

  test("removes only the resolved mission from missionJournal, keeping any others untouched", async () => {
    const otherMission = { ...MISSION, id: "mission2" };

    const { updates } = await resolve({
      character: baseCharacter({ missionJournal: [MISSION, otherMission] }),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext(),
    });

    assert.deepEqual(
      updates.missionJournal.map((m) => m.id),
      ["mission2"]
    );
  });

  test("fails closed when the mission's objective narrativeSubject no longer exists", async () => {
    await assert.rejects(() =>
      resolve({
        character: baseCharacter(),
        actionTypeId: "mission-action",
        today: "2026-08-05",
        context: baseContext({ objective: null }),
      })
    );
  });
});
