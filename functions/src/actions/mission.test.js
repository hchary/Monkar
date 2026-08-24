const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { FieldValue } = require("firebase-admin/firestore");
const { resolve } = require("./mission");

// Loot comes from the target monster's own resolved pool now (docs/TODO.md "Monster-pool loot"),
// so the fixture below is a monster carrying one drop rather than a loot table matched by rarity
// and tag. prepare() is what walks the parent chain, so the context here holds an already-resolved
// monster.
const MISSION = {
  id: "mission1",
  targetMonsterId: "mon-dragon",
  name: "Chasse dragon",
  difficulty: "difficile",
  tagIds: ["tag-x"],
  locationId: "",
  regionId: "region1",
  generatedAt: "2026-08-01",
};

const TARGET_MONSTER = {
  id: "mon-dragon",
  name: "dragon",
  difficulty: "difficile",
  areaType: "montagne",
  tagIds: ["tag-x"],
  lootItemIds: ["obj-sword"],
  talentRewardId: null,
  trigger: null,
};
const OBJECTS = [{ id: "obj-sword", name: "Épée", rarity: "rare", type: "arme", tagIds: [] }];

function baseContext(overrides = {}) {
  return {
    mission: MISSION,
    locationName: null,
    targetMonster: TARGET_MONSTER,
    objects: OBJECTS,
    talents: [],
    ...overrides,
  };
}

function baseCharacter(overrides = {}) {
  // A region is required for reputation to land anywhere: the applier credits a named region, and
  // drops a gain it has nowhere to put rather than writing it under an empty key.
  return {
    talents: [],
    missionJournal: [MISSION],
    region: { id: "region1", name: "Vaubourg" },
    ...overrides,
  };
}

describe("mission resolve()", () => {
  test("draws loot from the target monster's pool, three items on a success and one on a failure", async () => {
    // The count follows the outcome, not the difficulty (docs/TODO.md "Monster-pool loot"), and
    // both counts draw the same undegraded pool - the fixture's rare sword is exactly at
    // "difficile"'s ceiling, so it is drawable either way.
    const { updates } = await resolve({
      character: baseCharacter(),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext(),
    });

    assert.equal(updates.lastAction.mission.difficulty, "difficile");
    assert.equal(updates.lastAction.mission.name, "Chasse dragon");
    assert.equal(updates.lastAction.loot.length, updates.lastAction.success ? 3 : 1);
    for (const item of updates.lastAction.loot) assert.equal(item.objectId, "obj-sword");
  });

  test("pays no loot when the journal entry names a monster the bestiary no longer holds", async () => {
    const { updates } = await resolve({
      character: baseCharacter(),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext({ targetMonster: null }),
    });

    // A content gap costs the reward, not the resolution: the mission still succeeds or fails
    // normally, it just brings nothing back.
    assert.equal(typeof updates.lastAction.success, "boolean");
    assert.equal("loot" in updates.lastAction, false);
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
    // The applier only writes an effect that happened, so a failed mission carries no reputation
    // key at all rather than a zero (docs/TODO.md "ActionResult and the single applier").
    if (updates.lastAction.success) {
      assert.ok(updates.lastAction.reputationGained > 0);
      assert.equal(updates.lastAction.reputationRegionId, "region1");
      assert.equal(updates.reputations.region1, updates.lastAction.reputationGained);
    } else {
      assert.equal("reputationGained" in updates.lastAction, false);
      assert.equal(updates.reputations, undefined);
    }
  });

  test("guarantees success when the character's relevant talents raise the roll past the threshold", async () => {
    // Talents raise the roll rather than lower the bar (docs/TODO.md "Resolution engine rebuild"),
    // and at "difficile" (index 2) only talents of quality >= 2 count at all. Fourteen quality-5
    // talents sharing the mission's own tagIds are worth +70 on the roll, and their count also
    // drops the tier all the way to "facile" (threshold 10) - so any 0-99 roll succeeds, without
    // needing to mock Math.random.
    const talents = Array.from({ length: 14 }, (_, i) => ({
      id: `t${i}`,
      name: `Talent ${i}`,
      quality: 5,
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
    assert.equal(updates.lastAction.loot.length, 3);
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

  test("advances a composite-quest chain and grants the next step's monster on a matching success", async () => {
    const chain = {
      id: "chain1",
      steps: [
        { monsterId: "mon-dragon", difficulty: "difficile" },
        { monsterId: "mon-next", difficulty: "epique" },
      ],
    };
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.999; // guarantees success against "difficile"'s threshold

      const { updates } = await resolve({
        character: baseCharacter(),
        actionTypeId: "mission-action",
        today: "2026-08-05",
        context: baseContext({ chains: [chain] }),
      });

      assert.equal(updates.lastAction.success, true);
      assert.deepEqual(updates.questChainProgress, { chain1: 1 });
      assert.deepStrictEqual(updates.triggeredSubjectIds, FieldValue.arrayUnion("mon-next"));
    } finally {
      Math.random = originalRandom;
    }
  });

  test("does not advance any chain when the mission's monster/difficulty matches no step", async () => {
    const chain = { id: "chain1", steps: [{ monsterId: "unrelated", difficulty: "difficile" }] };
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.999;

      const { updates } = await resolve({
        character: baseCharacter(),
        actionTypeId: "mission-action",
        today: "2026-08-05",
        context: baseContext({ chains: [chain] }),
      });

      assert.equal(updates.questChainProgress, undefined);
      assert.equal(updates.triggeredSubjectIds, undefined);
    } finally {
      Math.random = originalRandom;
    }
  });
});
