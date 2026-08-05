const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("./rumeur");
const { DIFFICULTY_ORDER } = require("../lib/rolls");

const REGION = { id: "region1", adventureZoneIds: ["zone1"] };
const OBJECTIVE_TAG = "objectif de quête";

function context(overrides = {}) {
  return { region: REGION, sightings: [], rumors: [], objectives: [], ...overrides };
}

describe("rumeur resolve()", () => {
  test("harvests only sightings at or above rare, skipping already-owned ids", async () => {
    const sightings = [
      { id: "r-commun", rarity: "commun" },
      { id: "r-rare", rarity: "rare" },
      { id: "r-owned", rarity: "tres_rare" },
    ];
    const rumors = [
      { id: "r-commun", text: "Rumeur commune", linkedQuestId: null },
      { id: "r-rare", text: "Rumeur rare", linkedQuestId: null },
      { id: "r-owned", text: "Rumeur déjà connue", linkedQuestId: null },
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
    const rumors = [{ id: "r1", text: "Une rumeur qui a beaucoup voyagé", linkedQuestId: null }];
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
    const rumors = sightings.map((s) => ({ id: s.id, text: s.id, linkedQuestId: null }));
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

  test("generates missionRollCount missions from objectif-de-quête narrativeSubjects", async () => {
    const objectives = [{ id: "obj1", nom: "bandits", tags: [OBJECTIVE_TAG], tagIds: ["tag-x"] }];
    const character = { region: REGION, rumorJournal: [], missionJournal: [], talents: [] };
    const actionType = { rumorHarvestCount: 0, missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
      today: "2026-08-05",
      context: context({ objectives }),
    });

    assert.equal(updates.missionJournal.length, 3);
    for (const mission of updates.missionJournal) {
      assert.equal(mission.objectiveId, "obj1");
      assert.ok(DIFFICULTY_ORDER.includes(mission.difficulty));
      assert.deepEqual(mission.tagIds, ["tag-x"]);
      assert.equal(mission.locationId, "zone1");
      assert.equal(mission.regionId, "region1");
    }
    // Every generated mission gets its own id, even when drawn from the same single objective.
    assert.equal(new Set(updates.missionJournal.map((m) => m.id)).size, 3);
  });

  test("replaces the whole mission journal rather than appending to it", async () => {
    const character = {
      region: REGION,
      rumorJournal: [],
      missionJournal: [
        {
          id: "stale-mission",
          objectiveId: "old",
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

  test("stops generating missions once the objectif-de-quête pool is empty (content gap, not an error)", async () => {
    const character = { region: REGION, rumorJournal: [], missionJournal: [], talents: [] };
    const actionType = { rumorHarvestCount: 0, missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "rumeur-action",
      today: "2026-08-05",
      context: context({ objectives: [] }),
    });

    assert.deepEqual(updates.missionJournal, []);
  });
});
