const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolve, drawMission } = require("./rumeur");
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
  return { region: REGION, sightings: [], rumors: [], missionSubjects: [], missionActions: [], ...overrides };
}

describe("rumeur resolve()", () => {
  test("harvests only sightings at or above rare, skipping already-owned ids", async () => {
    const sightings = [
      { id: "r-commun", rarity: "commun" },
      { id: "r-rare", rarity: "rare" },
      { id: "r-owned", rarity: "tres_rare" },
    ];
    const rumors = [
      { id: "r-commun", text: "Rumeur commune" },
      { id: "r-rare", text: "Rumeur rare" },
      { id: "r-owned", text: "Rumeur déjà connue" },
    ];
    const character = { region: REGION, rumorJournal: [{ id: "r-owned" }], talents: [] };
    const actionType = { rumorHarvestCount: 5, missionRollCount: 0 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
      today: "2026-08-05",
      context: context({ sightings, rumors }),
    });

    // r-commun is below the "rare" floor, so only r-rare is newly harvested - r-owned was already
    // in the journal (the pre-existing stub used for the dedup check) and stays there untouched,
    // since rumorJournal accumulates rather than being replaced.
    assert.deepEqual(
      updates.rumorJournal.map((r) => r.id),
      ["r-owned", "r-rare"]
    );
    const harvested = updates.rumorJournal.find((r) => r.id === "r-rare");
    assert.equal(harvested.rarity, "rare");
    assert.equal(harvested.text, "Rumeur rare");
  });

  test("stores the sighting's effective (decayed) rarity, not the rumor catalog's own", async () => {
    const sightings = [{ id: "r1", rarity: "legendaire" }];
    const rumors = [{ id: "r1", text: "Une rumeur qui a beaucoup voyagé" }];
    const character = { region: REGION, rumorJournal: [], talents: [] };
    const actionType = { rumorHarvestCount: 1, missionRollCount: 0 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
      today: "2026-08-05",
      context: context({ sightings, rumors }),
    });

    assert.equal(updates.rumorJournal[0].rarity, "legendaire");
  });

  test("caps the harvest at rumorHarvestCount even when more qualify", async () => {
    const sightings = [
      { id: "r1", rarity: "rare" },
      { id: "r2", rarity: "rare" },
      { id: "r3", rarity: "rare" },
    ];
    const rumors = sightings.map((s) => ({ id: s.id, text: s.id }));
    const character = { region: REGION, rumorJournal: [], talents: [] };
    const actionType = { rumorHarvestCount: 2, missionRollCount: 0 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
      today: "2026-08-05",
      context: context({ sightings, rumors }),
    });

    assert.equal(updates.rumorJournal.length, 2);
  });

  test("generates missionRollCount missions from climate/difficulty-matched Subjects paired with a type-matched Action", async () => {
    const character = { region: REGION, rumorJournal: [], missionJournal: [], talents: [] };
    const actionType = { rumorHarvestCount: 0, missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
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
  });

  test("replaces the whole mission journal rather than appending to it", async () => {
    const character = {
      region: REGION,
      rumorJournal: [],
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
    const actionType = { rumorHarvestCount: 0, missionRollCount: 0 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
      today: "2026-08-05",
      context: context(),
    });

    assert.deepEqual(updates.missionJournal, []);
  });

  test("stops generating missions once no Subject matches the region's climate (content gap, not an error)", async () => {
    const character = { region: REGION, rumorJournal: [], missionJournal: [], talents: [] };
    const actionType = { rumorHarvestCount: 0, missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
      today: "2026-08-05",
      context: context({ missionSubjects: [], missionActions: [ACTION] }),
    });

    assert.deepEqual(updates.missionJournal, []);
  });

  test("skips (but does not retry) a Subject with no type-matched Action", async () => {
    const character = { region: REGION, rumorJournal: [], missionJournal: [], talents: [] };
    const actionType = { rumorHarvestCount: 0, missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
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
      rumorJournal: [],
      missionJournal: [],
      talents: [],
      triggeredSubjectIds: ["subj1"],
      questChainProgress: { chain1: 1 },
    };
    const actionType = { rumorHarvestCount: 0, missionRollCount: 2 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
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
