const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  ACTION_KINDS,
  PROFESSION_ACTION_KIND_ID,
  HARVEST_ACTION_KIND_ID,
  CRAFTING_ACTION_KIND_ID,
  TRAINING_ACTION_KIND_ID,
  PROFESSION_LEARNING_ACTION_KIND_ID,
  RENSEIGNEMENT_ACTION_KIND_ID,
  findActionKind,
  actionKindAncestry,
  actionKindInheritsFrom,
  actionKindCategoryId,
  actionKindLabel,
  actionKindsInTreeOrder,
} = require("./actionKinds");

// Genuinely unregistered - unlike "recolte", which is now a real Métier subtype and must not be
// used any more as a stand-in for "a kind this build doesn't know".
const UNKNOWN_KIND = "transport";

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

  test("the harvest kind is one of them, nested under the profession kind", () => {
    assert.ok(findActionKind(HARVEST_ACTION_KIND_ID));
    assert.equal(findActionKind(HARVEST_ACTION_KIND_ID).parentId, PROFESSION_ACTION_KIND_ID);
  });

  test("the crafting kind is one of them, nested under the profession kind", () => {
    assert.ok(findActionKind(CRAFTING_ACTION_KIND_ID));
    assert.equal(findActionKind(CRAFTING_ACTION_KIND_ID).parentId, PROFESSION_ACTION_KIND_ID);
  });

  test("the training kind is one of them, nested under the intermède kind", () => {
    assert.ok(findActionKind(TRAINING_ACTION_KIND_ID));
    assert.equal(findActionKind(TRAINING_ACTION_KIND_ID).parentId, "intermede");
  });

  test("the profession-learning kind is one of them, nested under the training kind", () => {
    assert.ok(findActionKind(PROFESSION_LEARNING_ACTION_KIND_ID));
    assert.equal(findActionKind(PROFESSION_LEARNING_ACTION_KIND_ID).parentId, TRAINING_ACTION_KIND_ID);
  });

  test("the renseignement kind is one of them, nested under the intermède kind", () => {
    assert.ok(findActionKind(RENSEIGNEMENT_ACTION_KIND_ID));
    assert.equal(findActionKind(RENSEIGNEMENT_ACTION_KIND_ID).parentId, "intermede");
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

  test("a Métier subtype's ancestry climbs up to the root, nearest first", () => {
    assert.deepStrictEqual(actionKindAncestry(HARVEST_ACTION_KIND_ID), ["recolte", "metier"]);
  });

  test("an unknown kind has no ancestry, so callers fail closed rather than guess", () => {
    assert.deepStrictEqual(actionKindAncestry(UNKNOWN_KIND), []);
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

  test("the training kind inherits from intermède, not from métier", () => {
    assert.equal(actionKindInheritsFrom(TRAINING_ACTION_KIND_ID, "intermede"), true);
    assert.equal(actionKindInheritsFrom(TRAINING_ACTION_KIND_ID, PROFESSION_ACTION_KIND_ID), false);
  });

  test("the profession-learning kind inherits from the training kind and from intermède", () => {
    assert.equal(actionKindInheritsFrom(PROFESSION_LEARNING_ACTION_KIND_ID, TRAINING_ACTION_KIND_ID), true);
    assert.equal(actionKindInheritsFrom(PROFESSION_LEARNING_ACTION_KIND_ID, "intermede"), true);
    assert.equal(actionKindInheritsFrom(PROFESSION_LEARNING_ACTION_KIND_ID, PROFESSION_ACTION_KIND_ID), false);
  });

  // Récolte is the first real multi-level fixture: a Métier subtype must inherit the profession
  // gate through its parent without restating it, which is the whole point of the parentId edge.
  test("a Métier subtype inherits from Métier", () => {
    assert.equal(actionKindInheritsFrom(HARVEST_ACTION_KIND_ID, PROFESSION_ACTION_KIND_ID), true);
  });

  test("an unknown kind inherits from nothing", () => {
    assert.equal(actionKindInheritsFrom(UNKNOWN_KIND, PROFESSION_ACTION_KIND_ID), false);
  });
});

describe("actionKindCategoryId", () => {
  test("a root kind is its own category - which is why the ids coincide", () => {
    assert.equal(actionKindCategoryId("aventure"), "aventure");
    assert.equal(actionKindCategoryId("metier"), "metier");
  });

  test("a Métier subtype's category is Métier, its root ancestor", () => {
    assert.equal(actionKindCategoryId(HARVEST_ACTION_KIND_ID), "metier");
  });

  test("an unknown kind has no category", () => {
    assert.equal(actionKindCategoryId(UNKNOWN_KIND), null);
    assert.equal(actionKindCategoryId(undefined), null);
  });
});

describe("actionKindLabel", () => {
  test("labels the known kinds and stays empty for the rest", () => {
    assert.equal(actionKindLabel("metier"), "Métier");
    assert.equal(actionKindLabel(HARVEST_ACTION_KIND_ID), "Récolte");
    assert.equal(actionKindLabel(UNKNOWN_KIND), "");
  });
});

describe("actionKindsInTreeOrder", () => {
  test("lists every kind exactly once, depth-first, a subtype nested right under its parent", () => {
    const flattened = actionKindsInTreeOrder();
    assert.equal(flattened.length, ACTION_KINDS.length);
    assert.deepStrictEqual(
      flattened.map((kind) => kind.value),
      [
        "aventure",
        "intermede",
        "entrainement",
        "apprentissage",
        "commerce",
        "renseignement",
        "metier",
        "recolte",
        "artisanat",
        "social",
      ]
    );
    const subtypes = ["recolte", "artisanat", "entrainement", "commerce", "renseignement"];
    for (const value of subtypes) {
      assert.equal(flattened.find((kind) => kind.value === value).depth, 1);
    }
    // apprentissage nests one level deeper still, under entrainement itself.
    assert.equal(flattened.find((kind) => kind.value === "apprentissage").depth, 2);
    assert.ok(
      flattened
        .filter((kind) => !subtypes.includes(kind.value) && kind.value !== "apprentissage")
        .every((kind) => kind.depth === 0)
    );
  });
});
