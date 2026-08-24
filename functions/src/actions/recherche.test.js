const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolve, drawMission } = require("./recherche");
const { DIFFICULTY_ORDER } = require("../lib/rolls");
const { monstersForAreaType } = require("../lib/monsters");

const REGION = { id: "region1", adventureZoneIds: ["zone1"], areaId: "area-marais" };

// A root monster and a child inheriting everything but its own name, so the tests cover both the
// plain case and the parent-chain concatenation the draw relies on.
const DRAGON = {
  id: "mon-dragon",
  name: "dragon",
  difficulty: "difficile",
  areaType: "marais",
  parentId: null,
  tagIds: ["tag-x"],
  lootItemIds: ["obj-ecaille"],
  talentRewardId: null,
  trigger: null,
};

const DRAGON_ANCIEN = {
  id: "mon-dragon-ancien",
  name: "dragon ancien",
  difficulty: null,
  areaType: null,
  parentId: "mon-dragon",
  tagIds: ["tag-y"],
  lootItemIds: [],
  talentRewardId: null,
  trigger: null,
};

// What prepare() hands resolve(): the raw bestiary plus the pool already filtered on the region's
// area type and resolved through the parent chain.
function context({ monsters = [DRAGON], areaType = "marais", ...overrides } = {}) {
  return {
    region: REGION,
    areaType,
    monsters,
    candidateMonsters: monstersForAreaType(monsters, areaType),
    chains: [],
    ...overrides,
  };
}

describe("recherche resolve()", () => {
  test("generates missionRollCount missions against the monsters covering the region's area", async () => {
    const character = { region: REGION, missionJournal: [], talents: [] };
    const actionType = { missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context(),
    });

    assert.equal(updates.missionJournal.length, 3);
    for (const mission of updates.missionJournal) {
      assert.equal(mission.targetMonsterId, "mon-dragon");
      assert.equal(mission.name, "Chasse dragon");
      assert.ok(DIFFICULTY_ORDER.includes(mission.difficulty));
      assert.deepEqual(mission.tagIds, ["tag-x"]);
      assert.equal(mission.locationId, "zone1");
      assert.equal(mission.regionId, "region1");
      // The retired Subject/Action draw's ids are gone from the journal entry entirely.
      assert.equal(mission.subjectId, undefined);
      assert.equal(mission.actionId, undefined);
    }
    // Every generated mission gets its own id, even when drawn against the same monster.
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
          targetMonsterId: "mon-old",
          name: "Chasse vieux monstre",
          difficulty: "facile",
          tagIds: [],
          locationId: "",
          regionId: "region1",
          generatedAt: "2026-08-01",
        },
      ],
      talents: [],
    };
    const actionType = { missionRollCount: 2 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context(),
    });

    assert.equal(updates.missionJournal.length, 2);
    assert.ok(!updates.missionJournal.some((m) => m.id === "stale-mission"));
  });

  test("generates nothing when no monster covers the region's area (content gap, not an error)", async () => {
    const character = { region: REGION, missionJournal: [], talents: [] };
    const actionType = { missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ monsters: [{ ...DRAGON, areaType: "volcan" }] }),
    });

    assert.deepEqual(updates.missionJournal, []);
    assert.equal(updates.lastAction.success, true);
  });

  test("generates nothing when the region has no area authored yet", async () => {
    const character = { region: REGION, missionJournal: [], talents: [] };
    const actionType = { missionRollCount: 3 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ areaType: null }),
    });

    assert.deepEqual(updates.missionJournal, []);
  });

  test("forces a pending composite-quest-chain step into the batch, claiming one slot", async () => {
    const chain = {
      id: "chain1",
      steps: [
        { monsterId: "mon-dragon", difficulty: "facile" },
        { monsterId: "mon-dragon-ancien", difficulty: "moyen" },
      ],
    };
    const character = {
      region: REGION,
      missionJournal: [],
      talents: [],
      triggeredSubjectIds: ["mon-dragon-ancien"],
      questChainProgress: { chain1: 1 },
    };
    const actionType = { missionRollCount: 2 };

    const { updates } = await resolve({
      character,
      actionType,
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ monsters: [DRAGON, DRAGON_ANCIEN], chains: [chain] }),
    });

    assert.equal(updates.missionJournal.length, 2);
    // The pending step is forced at exactly the chain's own difficulty, not the normal draw's -
    // findPendingChainStep's own contract, not re-tested here (see questChains.test.js).
    assert.ok(
      updates.missionJournal.some((m) => m.targetMonsterId === "mon-dragon-ancien" && m.difficulty === "moyen")
    );
  });

  test("forces a chain step whose monster the area filter excludes", async () => {
    // A chain sends the character after the monster it names, wherever that monster lives - the
    // forced slot bypasses the area pool the same way it bypasses the difficulty draw.
    const elsewhere = { ...DRAGON, id: "mon-volcan", name: "salamandre", areaType: "volcan" };
    const chain = {
      id: "chain1",
      steps: [
        { monsterId: "mon-dragon", difficulty: "facile" },
        { monsterId: "mon-volcan", difficulty: "epique" },
      ],
    };
    const character = {
      region: REGION,
      missionJournal: [],
      talents: [],
      triggeredSubjectIds: ["mon-volcan"],
      questChainProgress: { chain1: 1 },
    };

    const { updates } = await resolve({
      character,
      actionType: { missionRollCount: 1 },
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ monsters: [DRAGON, elsewhere], chains: [chain] }),
    });

    assert.equal(updates.missionJournal.length, 1);
    assert.equal(updates.missionJournal[0].targetMonsterId, "mon-volcan");
    assert.equal(updates.missionJournal[0].name, "Chasse salamandre");
    assert.equal(updates.missionJournal[0].difficulty, "epique");
  });

  test("skips a pending chain step whose monster no longer exists in the bestiary", async () => {
    const chain = {
      id: "chain1",
      steps: [
        { monsterId: "mon-dragon", difficulty: "facile" },
        { monsterId: "mon-deleted", difficulty: "moyen" },
      ],
    };
    const character = {
      region: REGION,
      missionJournal: [],
      talents: [],
      triggeredSubjectIds: ["mon-deleted"],
      questChainProgress: { chain1: 1 },
    };

    const { updates } = await resolve({
      character,
      actionType: { missionRollCount: 1 },
      actionTypeId: "recherche-action",
      today: "2026-08-05",
      context: context({ chains: [chain] }),
    });

    // The slot falls back to a normal draw rather than the action failing.
    assert.equal(updates.missionJournal.length, 1);
    assert.equal(updates.missionJournal[0].targetMonsterId, "mon-dragon");
  });
});

describe("drawMission()", () => {
  test("returns null on an empty candidate pool rather than throwing", () => {
    assert.equal(drawMission({ candidateMonsters: [] }), null);
    assert.equal(drawMission({}), null);
  });

  test("names the mission after the monster, with no difficulty in the title", () => {
    const drawn = drawMission({ candidateMonsters: monstersForAreaType([DRAGON], "marais") });
    assert.equal(drawn.name, "Chasse dragon");
    assert.equal(drawn.targetMonsterId, "mon-dragon");
    assert.deepEqual(drawn.tagIds, ["tag-x"]);
  });

  test("names a child monster after itself while carrying the whole chain's tags", () => {
    // The child inherits "marais" from its parent, which is what makes it a candidate at all; its
    // tags are the chain's, ancestors first and deduplicated.
    const candidates = monstersForAreaType([DRAGON_ANCIEN, DRAGON], "marais");
    assert.equal(candidates.length, 2);

    const child = candidates.filter((m) => m.id === "mon-dragon-ancien");
    const drawn = drawMission({ candidateMonsters: child });
    assert.equal(drawn.name, "Chasse dragon ancien");
    assert.deepEqual(drawn.tagIds, ["tag-x", "tag-y"]);
  });

  test("draws the difficulty independently of the monster's own", () => {
    // monster.difficulty is "difficile" and never gates the draw: over enough rolls the weighted
    // table produces the two commonest tiers, neither of which is the monster's.
    const candidates = monstersForAreaType([DRAGON], "marais");
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(drawMission({ candidateMonsters: candidates }).difficulty);
    assert.ok(seen.has("facile"));
    assert.ok(seen.has("moyen"));
    for (const difficulty of seen) assert.ok(DIFFICULTY_ORDER.includes(difficulty));
  });
});
