const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { evolutionChance, bumpTalentQuality, rollTalentEvolutionIds } = require("./talentEvolution");

const TODAY = "2026-07-28";

// The one quality-up step, applied from functions/src/lib/actionResult.js for both the
// resolution-luck path (rollTalentEvolutionIds) and the trainer path
// (functions/src/actions/sEntrainer.js) - see docs/TODO.md "Trainers".
describe("bumpTalentQuality", () => {
  test("bumps quality by exactly 1", () => {
    const bumped = bumpTalentQuality(
      { id: "t1", name: "Résistance au feu", quality: 2, rarity: "commun" },
      { today: TODAY, circumstance: "en s'entraînant" }
    );
    assert.equal(bumped.quality, 3);
  });

  test("caps at 5", () => {
    const bumped = bumpTalentQuality(
      { id: "t1", quality: 5, rarity: "legendaire" },
      { today: TODAY, circumstance: "en s'entraînant" }
    );
    assert.equal(bumped.quality, 5);
  });

  test("a talent with no quality yet starts from 1", () => {
    const bumped = bumpTalentQuality({ id: "t1", rarity: "commun" }, { today: TODAY, circumstance: "x" });
    assert.equal(bumped.quality, 2);
  });

  test("re-applies rarityFloor off the new quality, never lowering an already-higher rarity", () => {
    const toRare = bumpTalentQuality({ id: "t1", quality: 2, rarity: "commun" }, { today: TODAY, circumstance: "x" });
    assert.equal(toRare.quality, 3);
    assert.equal(toRare.rarity, "rare");

    const staysLegendaire = bumpTalentQuality(
      { id: "t1", quality: 1, rarity: "legendaire" },
      { today: TODAY, circumstance: "x" }
    );
    assert.equal(staysLegendaire.rarity, "legendaire");
  });

  test("stamps lastChangeDate and lastChangeCircumstance, overwriting any previous value", () => {
    const bumped = bumpTalentQuality(
      { id: "t1", quality: 1, rarity: "commun", lastChangeDate: "2020-01-01", lastChangeCircumstance: "avant" },
      { today: TODAY, circumstance: "Entraînement : Forge" }
    );
    assert.equal(bumped.lastChangeDate, TODAY);
    assert.equal(bumped.lastChangeCircumstance, "Entraînement : Forge");
  });

  test("preserves every other field on the talent", () => {
    const bumped = bumpTalentQuality(
      { id: "t1", name: "Résistance au feu", quality: 1, rarity: "commun", trainable: true, tagIds: ["feu"] },
      { today: TODAY, circumstance: "x" }
    );
    assert.equal(bumped.id, "t1");
    assert.equal(bumped.name, "Résistance au feu");
    assert.equal(bumped.trainable, true);
    assert.deepStrictEqual(bumped.tagIds, ["feu"]);
  });
});

describe("evolutionChance", () => {
  test("matches the design's own example: a difficile quest evolves a commun talent at 30%", () => {
    assert.equal(evolutionChance({ difficulty: "difficile", talentRarity: "commun" }), 0.3);
  });

  test("scales up with difficulty and down with talent rank", () => {
    assert.equal(evolutionChance({ difficulty: "facile", talentRarity: "commun" }), 0.1);
    assert.equal(evolutionChance({ difficulty: "mythique", talentRarity: "commun" }), 0.6);
    assert.equal(evolutionChance({ difficulty: "difficile", talentRarity: "rare" }), 0.2);
  });

  test("never goes below 0 or above 1", () => {
    assert.equal(evolutionChance({ difficulty: "facile", talentRarity: "unique" }), 0);
    assert.equal(evolutionChance({ difficulty: "mythique", talentRarity: "commun" }) <= 1, true);
  });

  test("an unknown difficulty or rarity yields no chance", () => {
    assert.equal(evolutionChance({ difficulty: null, talentRarity: "commun" }), 0);
    assert.equal(evolutionChance({ difficulty: "facile", talentRarity: "inconnue" }), 0);
  });
});

describe("rollTalentEvolutionIds", () => {
  const TAG_IDS = ["feu"];

  // Selection only: this function names the talents a resolution moves, it never applies the move -
  // that is the applier's job (docs/TODO.md "ActionResult and the single applier"), covered in
  // actionResult.test.js.
  function roll(overrides = {}) {
    return rollTalentEvolutionIds({
      characterTalents: [],
      catalogTalents: [],
      tagIds: TAG_IDS,
      objectiveRarity: "rare",
      difficulty: "difficile",
      ...overrides,
    });
  }

  test("an unknown objective rarity means no roll at all", () => {
    const characterTalents = [{ id: "t1", name: "Résistance au feu", quality: 1, rarity: "commun", tagIds: ["feu"] }];
    const { trainedIds, gainedIds } = roll({ characterTalents, objectiveRarity: null });

    assert.deepStrictEqual(trainedIds, []);
    assert.deepStrictEqual(gainedIds, []);
  });

  test("skips a talent sharing no tag with the resolution", (t) => {
    t.mock.method(Math, "random", () => 0);
    const characterTalents = [{ id: "t1", name: "Sans rapport", quality: 1, rarity: "commun", tagIds: ["glace"] }];

    assert.deepStrictEqual(roll({ characterTalents }).trainedIds, []);
  });

  test("skips an owned talent whose rank exceeds the objective's rarity", (t) => {
    t.mock.method(Math, "random", () => 0);
    const characterTalents = [{ id: "t1", name: "Maîtrise du feu", quality: 5, rarity: "legendaire", tagIds: ["feu"] }];

    // objectiveRarity "rare" sits below "legendaire".
    assert.deepStrictEqual(roll({ characterTalents, difficulty: "mythique" }).trainedIds, []);
  });

  test("names an eligible owned talent for training when the roll succeeds", (t) => {
    t.mock.method(Math, "random", () => 0); // always "succeeds" the roll
    const characterTalents = [{ id: "t1", name: "Résistance au feu", quality: 2, rarity: "commun", tagIds: ["feu"] }];

    assert.deepStrictEqual(roll({ characterTalents }).trainedIds, ["t1"]);
  });

  test("a failed roll names nothing", (t) => {
    t.mock.method(Math, "random", () => 0.99);
    const characterTalents = [{ id: "t1", name: "Résistance au feu", quality: 2, rarity: "commun", tagIds: ["feu"] }];

    assert.deepStrictEqual(roll({ characterTalents }).trainedIds, []);
  });

  test("names a not-yet-owned catalog talent strictly below the objective's rarity as gained", (t) => {
    t.mock.method(Math, "random", () => 0);
    const catalogTalents = [{ id: "t2", name: "Instinct des flammes", rarity: "peu_commun", tagIds: ["feu"] }];

    assert.deepStrictEqual(roll({ catalogTalents, difficulty: "epique" }).gainedIds, ["t2"]);
  });

  test("does not name a catalog talent whose rarity equals the objective's (gain requires strictly higher)", (t) => {
    t.mock.method(Math, "random", () => 0);
    const catalogTalents = [{ id: "t2", name: "Talent égal", rarity: "rare", tagIds: ["feu"] }];

    assert.deepStrictEqual(roll({ catalogTalents, difficulty: "mythique" }).gainedIds, []);
  });

  test("does not name a talent the character already owns as gained", (t) => {
    t.mock.method(Math, "random", () => 0);
    const characterTalents = [{ id: "t2", name: "Déjà acquis", quality: 1, rarity: "commun", tagIds: ["feu"] }];
    const catalogTalents = [{ id: "t2", name: "Déjà acquis", rarity: "commun", tagIds: ["feu"] }];

    const { trainedIds, gainedIds } = roll({ characterTalents, catalogTalents, difficulty: "mythique" });
    assert.deepStrictEqual(gainedIds, []);
    assert.deepStrictEqual(trainedIds, ["t2"]);
  });
});
