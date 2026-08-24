const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { indexMonstersById, monsterChain, resolveMonster, monstersForAreaType } = require("./monsters");

const DRAGON = { id: "dragon", name: "dragon", difficulty: "epique", areaType: "montagne", tagIds: ["reptile"], lootItemIds: ["ecaille"], talentRewardId: "t-souffle" };
const DRAGON_ROUGE = { id: "dragon-rouge", name: "dragon rouge", parentId: "dragon", tagIds: ["feu"], lootItemIds: ["braise"] };
const DRAGON_ANCIEN = { id: "dragon-ancien", name: "dragon ancien", parentId: "dragon-rouge", difficulty: "mythique", talentRewardId: "t-terreur" };

const MONSTERS = [DRAGON, DRAGON_ROUGE, DRAGON_ANCIEN];

describe("monsterChain", () => {
  test("walks child first, up to the root", () => {
    const byId = indexMonstersById(MONSTERS);
    assert.deepEqual(
      monsterChain(DRAGON_ANCIEN, byId).map((m) => m.id),
      ["dragon-ancien", "dragon-rouge", "dragon"]
    );
  });

  test("survives a cycle rather than spinning on it", () => {
    const a = { id: "a", parentId: "b" };
    const b = { id: "b", parentId: "a" };
    const byId = indexMonstersById([a, b]);

    assert.deepEqual(
      monsterChain(a, byId).map((m) => m.id),
      ["a", "b"]
    );
  });

  test("stops at a parent that isn't in the catalog", () => {
    const orphan = { id: "orphan", parentId: "gone" };
    assert.deepEqual(monsterChain(orphan, indexMonstersById([orphan])).map((m) => m.id), ["orphan"]);
  });
});

describe("resolveMonster", () => {
  const byId = indexMonstersById(MONSTERS);

  test("scalars take the first value the chain carries, child first", () => {
    const resolved = resolveMonster(DRAGON_ANCIEN, byId);

    assert.equal(resolved.difficulty, "mythique"); // its own
    assert.equal(resolved.areaType, "montagne"); // inherited from the root
    assert.equal(resolved.talentRewardId, "t-terreur"); // its own wins over the root's
  });

  test("arrays concatenate down the chain, ancestors first, deduplicated", () => {
    const resolved = resolveMonster(DRAGON_ANCIEN, byId);

    assert.deepEqual(resolved.tagIds, ["reptile", "feu"]);
    assert.deepEqual(resolved.lootItemIds, ["ecaille", "braise"]);
  });

  test("name is never inherited", () => {
    assert.equal(resolveMonster(DRAGON_ANCIEN, byId).name, "dragon ancien");
    assert.equal(resolveMonster(DRAGON_ROUGE, byId).name, "dragon rouge");
  });
});

describe("monstersForAreaType", () => {
  test("matches on the resolved area type, so a variant inherits its parent's area", () => {
    const ids = monstersForAreaType(MONSTERS, "montagne").map((m) => m.id);

    assert.deepEqual(ids, ["dragon", "dragon-rouge", "dragon-ancien"]);
  });

  test("an area type nothing covers yields an empty pool, not everything", () => {
    assert.deepEqual(monstersForAreaType(MONSTERS, "marais"), []);
  });

  test("a null area type matches nothing - an unplaced bestiary entry is a gap, not a wildcard", () => {
    assert.deepEqual(monstersForAreaType([{ id: "nowhere", name: "chose", areaType: null }], null), []);
  });
});
