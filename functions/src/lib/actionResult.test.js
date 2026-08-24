const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { createActionResult, applyActionResult } = require("./actionResult");

const TODAY = "2026-08-24";
const OPTIONS = { today: TODAY, circumstance: "à l'épreuve" };

const CATALOG = [
  { id: "cat1", name: "Instinct des flammes", rarity: "peu_commun", tagIds: ["feu"], effect: "...", trainable: true },
];

function baseCharacter(overrides = {}) {
  return {
    talents: [],
    reputation: 0,
    reputations: {},
    region: { id: "region1", name: "Vaubourg" },
    woundsLight: 0,
    woundsSevere: 0,
    woundsPermanent: 0,
    ...overrides,
  };
}

describe("createActionResult", () => {
  test("defaults every field to 'this action did not do that'", () => {
    assert.deepStrictEqual(createActionResult(), {
      itemsGained: [],
      itemsLost: [],
      talentsGained: [],
      talentTrained: [],
      reputationGained: 0,
      reputationRegionId: null,
      newRegionId: null,
      injury: null,
    });
  });
});

describe("applyActionResult", () => {
  test("an empty result writes nothing at all", () => {
    const { updates, died } = applyActionResult(baseCharacter(), createActionResult(), OPTIONS);

    assert.deepStrictEqual(updates, {});
    assert.equal(died, false);
  });

  test("itemsGained lands on lastAction.loot rather than becoming instances here", () => {
    const loot = [{ objectId: "obj1", name: "Épée", rarity: "rare" }];
    const { updates } = applyActionResult(baseCharacter(), createActionResult({ itemsGained: loot }), OPTIONS);

    // The acknowledgement step (each handler's commit()) is what materializes these - the web's
    // anti-duplication guarantee, not something the applier is allowed to shortcut.
    assert.deepStrictEqual(updates.lastAction.loot, loot);
    assert.equal(updates.talents, undefined);
  });

  test("a bare object id is normalized to a loot entry", () => {
    const { updates } = applyActionResult(baseCharacter(), createActionResult({ itemsGained: ["obj1"] }), OPTIONS);

    assert.deepStrictEqual(updates.lastAction.loot, [{ objectId: "obj1" }]);
  });

  test("itemsLost is recorded, never deleted here", () => {
    const { updates } = applyActionResult(baseCharacter(), createActionResult({ itemsLost: ["obj1", "obj1"] }), OPTIONS);

    assert.deepStrictEqual(updates.lastAction.itemsLost, [{ objectId: "obj1" }, { objectId: "obj1" }]);
  });

  test("talentTrained bumps the named talent exactly once and re-applies the rarity floor", () => {
    const character = baseCharacter({
      talents: [
        { id: "t1", name: "Résistance au feu", quality: 2, rarity: "commun", tagIds: ["feu"] },
        { id: "t2", name: "Ailleurs", quality: 1, rarity: "commun", tagIds: ["glace"] },
      ],
    });

    // The same id twice is one bump: an action either trains a talent or it doesn't.
    const result = createActionResult({ talentTrained: ["t1", "t1"] });
    const { updates } = applyActionResult(character, result, OPTIONS);

    assert.deepStrictEqual(updates.talents[0], {
      id: "t1",
      name: "Résistance au feu",
      quality: 3,
      rarity: "rare", // rarityFloor lifts commun -> rare at quality 3
      tagIds: ["feu"],
      lastChangeDate: TODAY,
      lastChangeCircumstance: "à l'épreuve",
    });
    assert.deepStrictEqual(updates.talents[1], character.talents[1]);
    assert.deepStrictEqual(updates.lastAction.talentEvolutions, [
      { talentId: "t1", name: "Résistance au feu", kind: "evolution", quality: 3, rarity: "rare" },
    ]);
  });

  test("talentsGained grants a catalog talent at quality 1", () => {
    const { updates } = applyActionResult(baseCharacter(), createActionResult({ talentsGained: ["cat1"] }), {
      ...OPTIONS,
      talentCatalog: CATALOG,
    });

    assert.deepStrictEqual(updates.talents, [
      {
        id: "cat1",
        name: "Instinct des flammes",
        quality: 1,
        trainable: true,
        rarity: "peu_commun",
        effect: "...",
        tagIds: ["feu"],
        lastChangeDate: TODAY,
        lastChangeCircumstance: "à l'épreuve",
      },
    ]);
    assert.deepStrictEqual(updates.lastAction.talentEvolutions, [
      { talentId: "cat1", name: "Instinct des flammes", kind: "unlock", quality: 1, rarity: "peu_commun" },
    ]);
  });

  test("granting a talent the character already owns is skipped, not a reset to quality 1", () => {
    const character = baseCharacter({
      talents: [{ id: "cat1", name: "Instinct des flammes", quality: 4, rarity: "tres_rare", tagIds: ["feu"] }],
    });
    const { updates } = applyActionResult(character, createActionResult({ talentsGained: ["cat1"] }), {
      ...OPTIONS,
      talentCatalog: CATALOG,
    });

    assert.deepStrictEqual(updates, {});
  });

  test("a talent id missing from the catalog is a content gap, skipped rather than thrown", () => {
    const { updates } = applyActionResult(baseCharacter(), createActionResult({ talentsGained: ["ghost"] }), {
      ...OPTIONS,
      talentCatalog: CATALOG,
    });

    assert.deepStrictEqual(updates, {});
  });

  test("reputation is credited to the character's current region by default", () => {
    const character = baseCharacter({ reputation: 7, reputations: { region1: 4 } });
    const { updates } = applyActionResult(character, createActionResult({ reputationGained: 3 }), OPTIONS);

    assert.deepStrictEqual(updates.reputations, { region1: 7 });
    assert.equal(updates.reputation, 10); // the legacy scalar, kept in step for now
    assert.equal(updates.lastAction.reputationGained, 3);
    assert.equal(updates.lastAction.reputationRegionId, "region1");
  });

  test("reputationRegionId overrides the region the character stands in", () => {
    const character = baseCharacter({ reputations: { region1: 4 } });
    const result = createActionResult({ reputationGained: 2, reputationRegionId: "region2" });
    const { updates } = applyActionResult(character, result, OPTIONS);

    assert.deepStrictEqual(updates.reputations, { region1: 4, region2: 2 });
    assert.equal(updates.lastAction.reputationRegionId, "region2");
  });

  test("a loss is applied signed, and an unvisited named region starts the count at 0", () => {
    const character = baseCharacter({ reputation: 5, reputations: {} });
    const result = createActionResult({ reputationGained: -3, reputationRegionId: "region2" });
    const { updates } = applyActionResult(character, result, OPTIONS);

    assert.deepStrictEqual(updates.reputations, { region2: -3 });
    assert.equal(updates.reputation, 2);
  });

  test("a gain with no region to land in is dropped rather than written under an empty key", () => {
    const character = baseCharacter({ region: null });
    const { updates } = applyActionResult(character, createActionResult({ reputationGained: 5 }), OPTIONS);

    assert.deepStrictEqual(updates, {});
  });

  test("newRegionId moves the character and seeds an unvisited region's reputation at 1", () => {
    const character = baseCharacter({ reputations: { region1: 4 } });
    const result = createActionResult({ newRegionId: "region2" });
    const { updates } = applyActionResult(character, result, { ...OPTIONS, regionName: "Ravenholm" });

    assert.deepStrictEqual(updates.region, { id: "region2", name: "Ravenholm" });
    assert.deepStrictEqual(updates.reputations, { region1: 4, region2: 1 });
  });

  test("arriving somewhere already known leaves its score alone", () => {
    const character = baseCharacter({ reputations: { region1: 4, region2: 12 } });
    const { updates } = applyActionResult(character, createActionResult({ newRegionId: "region2" }), OPTIONS);

    assert.equal(updates.reputations, undefined);
    assert.deepStrictEqual(updates.region, { id: "region2", name: "" });
  });

  test("a move that also pays credits the destination, on top of its seed", () => {
    const character = baseCharacter({ reputations: { region1: 4 } });
    const result = createActionResult({ newRegionId: "region2", reputationGained: 2 });
    const { updates } = applyActionResult(character, result, { ...OPTIONS, regionName: "Ravenholm" });

    assert.deepStrictEqual(updates.reputations, { region1: 4, region2: 3 });
    assert.equal(updates.lastAction.reputationRegionId, "region2");
  });

  test("injury reaches applyWound, collapsed to the worst severity set", () => {
    const character = baseCharacter({ woundsLight: 1 });
    const injury = { light: true, severe: true, permanent: false };
    const { updates, died } = applyActionResult(character, createActionResult({ injury }), OPTIONS);

    // "severe" wins over "light" - woundFromInjury reads most severe first.
    assert.equal(updates.lastAction.wound, "severe");
    assert.deepStrictEqual(
      { l: updates.woundsLight, s: updates.woundsSevere, p: updates.woundsPermanent },
      { l: 1, s: 1, p: 0 }
    );
    assert.equal(died, false);
    assert.equal(updates.alive, undefined);
  });

  test("a wound-free injury triple writes nothing", () => {
    const injury = { light: false, severe: false, permanent: false };
    const { updates } = applyActionResult(baseCharacter(), createActionResult({ injury }), OPTIONS);

    assert.deepStrictEqual(updates, {});
  });

  test("a killing wound reports died and flips alive", () => {
    const character = baseCharacter({ woundsPermanent: 3 });
    const injury = { light: false, severe: false, permanent: true };
    const { updates, died } = applyActionResult(character, createActionResult({ injury }), OPTIONS);

    assert.equal(died, true);
    assert.equal(updates.alive, false);
    assert.equal(updates.woundsPermanent, 3);
  });

  test("every field of a full result is applied, once each", () => {
    const character = baseCharacter({
      talents: [{ id: "t1", name: "Résistance au feu", quality: 2, rarity: "commun", tagIds: ["feu"] }],
      reputation: 1,
      reputations: { region1: 1 },
    });
    const result = createActionResult({
      itemsGained: [{ objectId: "obj1", name: "Épée" }],
      itemsLost: ["obj0"],
      talentsGained: ["cat1"],
      talentTrained: ["t1"],
      reputationGained: 4,
      reputationRegionId: "region2",
      newRegionId: "region3",
      injury: { light: true, severe: false, permanent: false },
    });

    const { updates, died } = applyActionResult(character, result, {
      ...OPTIONS,
      talentCatalog: CATALOG,
      regionName: "Ravenholm",
    });

    assert.equal(updates.talents.length, 2);
    assert.equal(updates.talents[0].quality, 3);
    assert.equal(updates.talents[1].id, "cat1");
    assert.equal(updates.lastAction.talentEvolutions.length, 2);
    assert.deepStrictEqual(updates.region, { id: "region3", name: "Ravenholm" });
    // region3 seeded at 1 by the move, region2 named explicitly by the gain, region1 untouched.
    assert.deepStrictEqual(updates.reputations, { region1: 1, region3: 1, region2: 4 });
    assert.equal(updates.reputation, 5);
    assert.equal(updates.woundsLight, 1);
    assert.deepStrictEqual(updates.lastAction.loot, [{ objectId: "obj1", name: "Épée" }]);
    assert.deepStrictEqual(updates.lastAction.itemsLost, [{ objectId: "obj0" }]);
    assert.equal(updates.lastAction.wound, "light");
    assert.equal(died, false);
  });

  test("the applier never mutates the character it was handed", () => {
    const character = baseCharacter({
      talents: [{ id: "t1", name: "Résistance au feu", quality: 2, rarity: "commun", tagIds: ["feu"] }],
      reputations: { region1: 1 },
    });
    const snapshot = JSON.parse(JSON.stringify(character));

    applyActionResult(
      character,
      createActionResult({
        talentTrained: ["t1"],
        talentsGained: ["cat1"],
        reputationGained: 3,
        injury: { light: true, severe: false, permanent: false },
      }),
      { ...OPTIONS, talentCatalog: CATALOG }
    );

    assert.deepStrictEqual(character, snapshot);
  });
});
