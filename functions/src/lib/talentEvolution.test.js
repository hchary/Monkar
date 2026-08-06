const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { evolutionChance, bumpTalentQuality, rollTalentEvolutions } = require("./talentEvolution");

const TODAY = "2026-07-28";

// Shared by rollTalentEvolutions (quest-luck path) and functions/src/actions/sEntrainer.js
// (training path) - see docs/TODO.md "Trainers".
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

describe("rollTalentEvolutions", () => {
  const quest = { tagIds: ["feu"] };
  const objective = { rarity: "rare", tagIds: [] };

  test("no objective means no roll at all", () => {
    const characterTalents = [{ id: "t1", name: "Résistance au feu", quality: 1, rarity: "commun", tagIds: ["feu"] }];
    const { talents, evolutions } = rollTalentEvolutions({
      characterTalents,
      catalogTalents: [],
      quest,
      objective: null,
      difficulty: "difficile",
      today: TODAY,
      circumstance: "test",
    });

    assert.equal(talents, characterTalents);
    assert.deepStrictEqual(evolutions, []);
  });

  test("skips a talent sharing no tag with the quest or objective", () => {
    const characterTalents = [{ id: "t1", name: "Sans rapport", quality: 1, rarity: "commun", tagIds: ["glace"] }];
    const { talents, evolutions } = rollTalentEvolutions({
      characterTalents,
      catalogTalents: [],
      quest,
      objective,
      difficulty: "difficile",
      today: TODAY,
      circumstance: "test",
    });

    assert.equal(talents, characterTalents);
    assert.deepStrictEqual(evolutions, []);
  });

  test("skips an owned talent whose rank exceeds the objective's rarity", () => {
    const characterTalents = [
      { id: "t1", name: "Maîtrise du feu", quality: 5, rarity: "legendaire", tagIds: ["feu"] },
    ];
    const { talents, evolutions } = rollTalentEvolutions({
      characterTalents,
      catalogTalents: [],
      quest,
      objective, // rarity: "rare", lower than legendaire
      difficulty: "mythique",
      today: TODAY,
      circumstance: "test",
    });

    assert.equal(talents, characterTalents);
    assert.deepStrictEqual(evolutions, []);
  });

  test("bumps quality by +1 and re-applies the rarity floor when the roll succeeds", (t) => {
    t.mock.method(Math, "random", () => 0); // always "succeeds" the roll
    const characterTalents = [
      { id: "t1", name: "Résistance au feu", quality: 2, rarity: "commun", tagIds: ["feu"] },
    ];
    const { talents, evolutions } = rollTalentEvolutions({
      characterTalents,
      catalogTalents: [],
      quest,
      objective, // rarity: "rare" >= talent's "commun", eligible for evolution
      difficulty: "difficile",
      today: TODAY,
      circumstance: "en affrontant les flammes",
    });

    assert.notEqual(talents, characterTalents);
    assert.deepStrictEqual(talents[0], {
      id: "t1",
      name: "Résistance au feu",
      quality: 3,
      rarity: "rare", // rarityFloor bumps commun -> rare at quality 3
      tagIds: ["feu"],
      lastChangeDate: TODAY,
      lastChangeCircumstance: "en affrontant les flammes",
    });
    assert.deepStrictEqual(evolutions, [
      { talentId: "t1", name: "Résistance au feu", kind: "evolution", quality: 3, rarity: "rare" },
    ]);
  });

  test("caps quality at 5", (t) => {
    t.mock.method(Math, "random", () => 0);
    const characterTalents = [{ id: "t1", name: "Maîtrise", quality: 5, rarity: "rare", tagIds: ["feu"] }];
    const { talents } = rollTalentEvolutions({
      characterTalents,
      catalogTalents: [],
      quest,
      objective,
      difficulty: "difficile",
      today: TODAY,
      circumstance: "test",
    });

    assert.equal(talents[0].quality, 5);
  });

  test("unlocks a not-yet-owned catalog talent strictly below the objective's rarity", (t) => {
    t.mock.method(Math, "random", () => 0);
    const catalogTalents = [{ id: "t2", name: "Instinct des flammes", rarity: "peu_commun", tagIds: ["feu"], effect: "...", trainable: true }];
    const { talents, evolutions } = rollTalentEvolutions({
      characterTalents: [],
      catalogTalents,
      quest,
      objective, // rarity: "rare" > "peu_commun"
      difficulty: "epique",
      today: TODAY,
      circumstance: "en dominant les flammes",
    });

    assert.deepStrictEqual(talents, [
      {
        id: "t2",
        name: "Instinct des flammes",
        quality: 1,
        trainable: true,
        rarity: "peu_commun",
        effect: "...",
        tagIds: ["feu"],
        lastChangeDate: TODAY,
        lastChangeCircumstance: "en dominant les flammes",
      },
    ]);
    assert.deepStrictEqual(evolutions, [
      { talentId: "t2", name: "Instinct des flammes", kind: "unlock", quality: 1, rarity: "peu_commun" },
    ]);
  });

  test("does not unlock a talent whose rarity equals the objective's (unlock requires strictly higher)", () => {
    const catalogTalents = [{ id: "t2", name: "Talent égal", rarity: "rare", tagIds: ["feu"] }];
    const { talents, evolutions } = rollTalentEvolutions({
      characterTalents: [],
      catalogTalents,
      quest,
      objective, // rarity: "rare", same as catalog talent
      difficulty: "mythique",
      today: TODAY,
      circumstance: "test",
    });

    assert.deepStrictEqual(talents, []);
    assert.deepStrictEqual(evolutions, []);
  });

  test("does not re-unlock a talent the character already owns", () => {
    const characterTalents = [{ id: "t2", name: "Déjà acquis", quality: 1, rarity: "commun", tagIds: ["feu"] }];
    const catalogTalents = [{ id: "t2", name: "Déjà acquis", rarity: "commun", tagIds: ["feu"] }];
    const { evolutions } = rollTalentEvolutions({
      characterTalents,
      catalogTalents,
      quest,
      objective,
      difficulty: "mythique",
      today: TODAY,
      circumstance: "test",
    });

    assert.equal(evolutions.some((e) => e.kind === "unlock"), false);
  });
});
