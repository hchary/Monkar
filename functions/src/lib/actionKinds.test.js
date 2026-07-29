const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  ACTION_KINDS,
  PROFESSION_ACTION_KIND_ID,
  findActionKind,
  actionKindAncestry,
  actionKindInheritsFrom,
  actionKindCategoryId,
  actionKindLabel,
  actionKindsInTreeOrder,
} = require("./actionKinds");

describe("the registry itself", () => {
  test("every parentId names a kind that exists", () => {
    for (const kind of ACTION_KINDS) {
      if (kind.parentId == null) continue;
      assert.ok(findActionKind(kind.parentId), `unknown parent "${kind.parentId}" on "${kind.value}"`);
    }
  });

  test("kind values are unique", () => {
    const values = ACTION_KINDS.map((kind) => kind.value);
    assert.equal(new Set(values).size, values.length);
  });

  test("the profession kind is one of them", () => {
    assert.ok(findActionKind(PROFESSION_ACTION_KIND_ID));
  });

  test("every kind resolves to a root category", () => {
    for (const kind of ACTION_KINDS) {
      assert.ok(actionKindCategoryId(kind.value), `"${kind.value}" has no category`);
    }
  });
});

describe("actionKindAncestry", () => {
  test("a root kind is its own whole ancestry", () => {
    assert.deepStrictEqual(actionKindAncestry("metier"), ["metier"]);
  });

  test("an unknown kind has no ancestry, so callers fail closed rather than guess", () => {
    assert.deepStrictEqual(actionKindAncestry("recolte"), []);
    assert.deepStrictEqual(actionKindAncestry(null), []);
    assert.deepStrictEqual(actionKindAncestry(undefined), []);
  });
});

describe("actionKindInheritsFrom", () => {
  test("inheritance is reflexive - a Métier action is of kind Métier", () => {
    assert.equal(actionKindInheritsFrom("metier", PROFESSION_ACTION_KIND_ID), true);
  });

  test("sibling roots don't inherit from each other", () => {
    assert.equal(actionKindInheritsFrom("aventure", PROFESSION_ACTION_KIND_ID), false);
    assert.equal(actionKindInheritsFrom("intermede", PROFESSION_ACTION_KIND_ID), false);
    assert.equal(actionKindInheritsFrom("social", PROFESSION_ACTION_KIND_ID), false);
  });

  // Multi-level inheritance has no fixture to assert against while the tree is one level deep -
  // rather than test a copy of the traversal against a fake table, the invariants above ("every
  // parentId names a kind that exists", "every kind resolves to a root category") are what will
  // catch a mis-authored Récolte/Artisanat entry the day one is added under Métier.
  test("an unknown kind inherits from nothing", () => {
    assert.equal(actionKindInheritsFrom("recolte", PROFESSION_ACTION_KIND_ID), false);
  });
});

describe("actionKindCategoryId", () => {
  test("a root kind is its own category - which is why the ids coincide", () => {
    assert.equal(actionKindCategoryId("aventure"), "aventure");
    assert.equal(actionKindCategoryId("metier"), "metier");
  });

  test("an unknown kind has no category", () => {
    assert.equal(actionKindCategoryId("recolte"), null);
    assert.equal(actionKindCategoryId(undefined), null);
  });
});

describe("actionKindLabel", () => {
  test("labels the known kinds and stays empty for the rest", () => {
    assert.equal(actionKindLabel("metier"), "Métier");
    assert.equal(actionKindLabel("recolte"), "");
  });
});

describe("actionKindsInTreeOrder", () => {
  test("lists every kind exactly once, roots at depth 0", () => {
    const flattened = actionKindsInTreeOrder();
    assert.equal(flattened.length, ACTION_KINDS.length);
    assert.deepStrictEqual(
      flattened.map((kind) => kind.value),
      ACTION_KINDS.map((kind) => kind.value)
    );
    assert.ok(flattened.every((kind) => kind.depth === 0));
  });
});
