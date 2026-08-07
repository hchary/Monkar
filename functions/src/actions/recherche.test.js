const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolve, drawMission } = require("./recherche");
const { DIFFICULTY_ORDER } = require("../lib/rolls");

const REGION = { id: "region1", adventureZoneIds: ["zone1"], climateIds: ["climat-tempere"] };

// A subject carrying a tier for every DIFFICULTIES value, so a mission draw always succeeds
// regardless of which difficulty gets picked - keeps the mission-generation tests deterministic
// without mocking Math.random.
const SUBJECT_ALL_TIERS = {
  id: "subj1",
  name: "dragon",
  type: "ennemis",
  climateIds: ["climat-tempere"],
  difficultyTiers: DIFFICULTY_ORDER.map((difficulty) => ({
    difficulty,
    prefix: null,
    suffix: "liche",
    tagIds: ["tag-x"],
  })),
  variations: [],
};

const ACTION = { id: "act1", phrase: "Vaincre", type: "ennemis" };

function context(overrides = {}) {
  return { region: REGION, missionSubjects: [], missionActions: [], ...overrides };
}

describe("recherche resolve()", () => {
  test("generates missionRollCount missions from climate/difficulty-matched Subjects paired with a type-matched Action", async () => {
    const character = { region: REGION, missionJournal: [], talents: [] };
    const actionType = { missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ missionSubjects: [SUBJECT_ALL_TIERS], missionActions: [ACTION] }),
    });

    assert.equal(updates.missionJournal.length, 3);
    for (const mission of updates.missionJournal) {
      assert.equal(mission.subjectId, "subj1");
      assert.equal(mission.actionId, "act1");
      assert.equal(mission.name, "Vaincre dragon liche");
      assert.ok(DIFFICULTY_ORDER.includes(mission.difficulty));
      assert.deepEqual(mission.tagIds, ["tag-x"]);
      assert.equal(mission.locationId, "zone1");
      assert.equal(mission.regionId, "region1");
    }
    // Every generated mission gets its own id, even when drawn from the same Subject/Action pair.
    assert.equal(new Set(updates.missionJournal.map((m) => m.id)).size, 3);
    // The result pop-up reads the generated missions from lastAction, not just a count.
    assert.deepEqual(updates.lastAction.missionsGenerated, updates.missionJournal);
  });

  test("replaces the whole mission journal rather than appending to it", async () => {
    const character = {
      region: REGION,
      missionJournal: [
        {
          id: "stale-mission",
          subjectId: "old",
          actionId: "old",
          name: "Vieille mission",
          difficulty: "facile",
          tagIds: [],
          locationId: "",
          regionId: "region1",
          generatedAt: "2026-08-01",
        },
      ],
      talents: [],
    };
    const actionType = { missionRollCount: 0 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context(),
    });

    assert.deepEqual(updates.missionJournal, []);
  });

  test("stops generating missions once no Subject matches the region's climate (content gap, not an error)", async () => {
    const character = { region: REGION, missionJournal: [], talents: [] };
    const actionType = { missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ missionSubjects: [], missionActions: [ACTION] }),
    });

    assert.deepEqual(updates.missionJournal, []);
  });

  test("skips (but does not retry) a Subject with no type-matched Action", async () => {
    const character = { region: REGION, missionJournal: [], talents: [] };
    const actionType = { missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ missionSubjects: [SUBJECT_ALL_TIERS], missionActions: [] }),
    });

    assert.deepEqual(updates.missionJournal, []);
  });

  test("forces a pending composite-quest-chain step into the batch, claiming one slot", async () => {
    const chain = {
      id: "chain1",
      steps: [
        { subjectId: "subj1", difficulty: "facile" },
        { subjectId: "subj1", difficulty: "moyen" },
      ],
    };
    const character = {
      region: REGION,
      missionJournal: [],
      talents: [],
      triggeredSubjectIds: ["subj1"],
      questChainProgress: { chain1: 1 },
    };
    const actionType = { missionRollCount: 2 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ missionSubjects: [SUBJECT_ALL_TIERS], missionActions: [ACTION], chains: [chain] }),
    });

    assert.equal(updates.missionJournal.length, 2);
    // The pending step is forced at exactly the chain's own difficulty, not the normal draw's -
    // findPendingChainStep's own contract, not re-tested here (see questChains.test.js).
    assert.ok(updates.missionJournal.some((m) => m.subjectId === "subj1" && m.difficulty === "moyen"));
  });
});

describe("drawMission()", () => {
  test("only pairs a Subject whose climateIds overlaps the region's own", () => {
    const otherClimateSubject = { ...SUBJECT_ALL_TIERS, id: "subj-other", climateIds: ["climat-desert"] };

    for (let i = 0; i < 20; i++) {
      const drawn = drawMission({
        region: REGION,
        missionSubjects: [otherClimateSubject],
        missionActions: [ACTION],
      });
      assert.equal(drawn, null);
    }
  });

  test("assembles the mission name from the drawn Action + Subject pair", () => {
    const drawn = drawMission({ region: REGION, missionSubjects: [SUBJECT_ALL_TIERS], missionActions: [ACTION] });
    assert.ok(drawn);
    assert.equal(drawn.name, "Vaincre dragon liche");
    assert.deepEqual(drawn.tagIds, ["tag-x"]);
  });
});
