const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { FieldValue } = require("firebase-admin/firestore");
const { resolve } = require("./mission");
const { LOOT_COUNT_BY_DIFFICULTY } = require("../lib/loot");

// difficultyToRarity("difficile") -> "rare" (docs/TODO.md "Mission loot and rarity mapping"), so
// the loot table below must match "rare" (not the objective's own rarity, since a mission has no
// objective any more - it reads its rarity from its own difficulty).
const MISSION = {
  id: "mission1",
  subjectId: "subj1",
  actionId: "act1",
  name: "Vaincre dragon",
  difficulty: "difficile",
  tagIds: ["tag-x"],
  locationId: "",
  regionId: "region1",
  generatedAt: "2026-08-01",
};

const LOOT_TABLES = [{ id: "table1", rarity: "rare", tagIds: ["tag-x"], itemIds: ["obj-sword"] }];
const OBJECTS = [{ id: "obj-sword", name: "Épée", rarity: "rare", type: "arme", tagIds: [] }];

function baseContext(overrides = {}) {
  return {
    mission: MISSION,
    locationName: null,
    lootTables: LOOT_TABLES,
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
  test("draws loot at the mission's own full difficulty, without the removed reward discount", async () => {
    // "difficile" draws 2 items per LOOT_COUNT_BY_DIFFICULTY - no longer scaled down to "moyen"'s 1
    // the way the retired rewardDifficulty discount used to (docs/TODO.md "Mission and quest
    // resolution algorithm": "a balance mistake... removed"). The single fixture loot table
    // matches "rare" (difficile's rarity equivalence), so both a success (exact match) and a
    // failure (floored at "commun" after the two-rank degrade would miss it) - see the next test
    // for the failure case - this one only asserts the success-path count.
    assert.equal(LOOT_COUNT_BY_DIFFICULTY.difficile, 2);

    const { updates } = await resolve({
      character: baseCharacter(),
      actionTypeId: "mission-action",
      today: "2026-08-05",
      context: baseContext(),
    });

    assert.equal(updates.lastAction.mission.difficulty, "difficile");
    assert.equal(updates.lastAction.mission.name, "Vaincre dragon");
    if (updates.lastAction.success) assert.equal(updates.lastAction.loot.length, 2);
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
    assert.equal(updates.lastAction.loot.length, 2);
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

  test("advances a composite-quest chain and grants the next step's subject on a matching success", async () => {
    const chain = {
      id: "chain1",
      steps: [
        { subjectId: "subj1", difficulty: "difficile" },
        { subjectId: "subj-next", difficulty: "epique" },
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
      assert.deepStrictEqual(updates.triggeredSubjectIds, FieldValue.arrayUnion("subj-next"));
    } finally {
      Math.random = originalRandom;
    }
  });

  test("does not advance any chain when the mission's subject/difficulty matches no step", async () => {
    const chain = { id: "chain1", steps: [{ subjectId: "unrelated", difficulty: "difficile" }] };
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
