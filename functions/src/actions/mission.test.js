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
  test("draws loot at one difficulty tier below the mission's own, not the tier actually narrated", async () => {
    // "difficile" draws 2 items per LOOT_COUNT_BY_DIFFICULTY; scaled down one tier to "moyen" draws 1.
    assert.equal(LOOT_COUNT_BY_DIFFICULTY.difficile, 2);
    assert.equal(LOOT_COUNT_BY_DIFFICULTY.moyen, 1);

    const { updates } = await resolve({
      character: baseCharacter(),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext(),
    });

    assert.equal(updates.lastAction.loot.length, 1);
    // The narrated/displayed difficulty stays the mission's real one, only the reward is scaled.
    assert.equal(updates.lastAction.mission.difficulty, "difficile");
  });

  test("clamps the scaled-down difficulty at facile instead of going below the scale", async () => {
    const mission = { ...MISSION, difficulty: "facile" };

    const { updates } = await resolve({
      character: baseCharacter({ missionJournal: [mission] }),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext({ mission }),
    });

    // facile's own loot count (1) is what a further-scaled-down draw would also produce - the
    // real assertion is that this resolves cleanly instead of indexing past the scale.
    assert.equal(updates.lastAction.loot.length, 1);
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
