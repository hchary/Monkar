const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolveDurationHours, normalizeActionType, evaluateAvailability } = require("./actionCatalog");
const { UNKNOWN_CONDITION_REASON } = require("./actionConditions");

describe("resolveDurationHours", () => {
  test("defaults to 24h", () => {
    assert.equal(resolveDurationHours({}), 24);
    assert.equal(resolveDurationHours(undefined), 24);
  });

  test("honours a positive duration", () => {
    assert.equal(resolveDurationHours({ durationHours: 8 }), 8);
    assert.equal(resolveDurationHours({ durationHours: "12" }), 12);
  });

  test("falls back to the default rather than producing an action that never completes", () => {
    assert.equal(resolveDurationHours({ durationHours: 0 }), 24);
    assert.equal(resolveDurationHours({ durationHours: -5 }), 24);
    assert.equal(resolveDurationHours({ durationHours: "bientôt" }), 24);
    assert.equal(resolveDurationHours({ durationHours: null }), 24);
  });
});

describe("normalizeActionType", () => {
  // The single document that exists today, authored before any of these fields did.
  test("a pre-framework document normalizes to a working action", () => {
    const normalized = normalizeActionType({
      label: "Partir en quête",
      tiers: [{ name: "Succès", weight: 10 }],
      questDifficultyWeights: [{ difficulty: "facile", weight: 55 }],
    });

    assert.equal(normalized.label, "Partir en quête");
    assert.equal(normalized.categoryId, null);
    assert.equal(normalized.description, "");
    assert.equal(normalized.order, 0);
    assert.equal(normalized.enabled, true);
    assert.equal(normalized.handlerId, null);
    assert.equal(normalized.durationHours, 24);
    assert.deepStrictEqual(normalized.availability, {
      conditions: [],
      unmetBehaviour: "hide",
      unmetMessage: "",
    });
    assert.deepStrictEqual(normalized.result, { accentSource: "category", showLoot: false });
    assert.deepStrictEqual(normalized.tiers, [{ name: "Succès", weight: 10 }]);
  });

  test("passes through fields it doesn't own", () => {
    const normalized = normalizeActionType({
      label: "Partir en quête",
      questDifficultyWeights: [{ difficulty: "epique", weight: 1 }],
    });
    assert.deepStrictEqual(normalized.questDifficultyWeights, [{ difficulty: "epique", weight: 1 }]);
  });

  test("enabled is opt-out, not opt-in", () => {
    assert.equal(normalizeActionType({}).enabled, true);
    assert.equal(normalizeActionType({ enabled: true }).enabled, true);
    assert.equal(normalizeActionType({ enabled: false }).enabled, false);
  });

  test("keeps authored values", () => {
    const normalized = normalizeActionType({
      label: "Se reposer",
      categoryId: "intermede",
      description: "Reprendre des forces.",
      order: 3,
      handlerId: "seReposer",
      durationHours: 12,
      availability: {
        conditions: [{ type: "notWounded" }],
        unmetBehaviour: "disable",
        unmetMessage: "Vous êtes déjà en pleine forme.",
      },
      result: { accentSource: "difficulty", showLoot: true },
    });

    assert.equal(normalized.categoryId, "intermede");
    assert.equal(normalized.order, 3);
    assert.equal(normalized.handlerId, "seReposer");
    assert.equal(normalized.durationHours, 12);
    assert.equal(normalized.availability.unmetBehaviour, "disable");
    assert.equal(normalized.availability.unmetMessage, "Vous êtes déjà en pleine forme.");
    assert.deepStrictEqual(normalized.result, { accentSource: "difficulty", showLoot: true });
  });

  test("coerces unusable values instead of propagating them", () => {
    const normalized = normalizeActionType({
      order: "troisième",
      handlerId: "",
      availability: { conditions: "aucune", unmetBehaviour: "explode" },
      result: { accentSource: "arc-en-ciel", showLoot: "oui" },
      tiers: "beaucoup",
    });

    assert.equal(normalized.order, 0);
    assert.equal(normalized.handlerId, null);
    assert.deepStrictEqual(normalized.availability.conditions, []);
    assert.equal(normalized.availability.unmetBehaviour, "hide");
    assert.equal(normalized.result.accentSource, "category");
    assert.equal(normalized.result.showLoot, false);
    assert.deepStrictEqual(normalized.tiers, []);
  });

  test("is idempotent - normalizing twice changes nothing", () => {
    const once = normalizeActionType({ label: "Partir en quête", durationHours: 6 });
    assert.deepStrictEqual(normalizeActionType(once), once);
  });
});

describe("evaluateAvailability", () => {
  const character = { reputation: 10, talents: [], wounds: [] };
  const ctx = { character, instanceTagIds: new Set() };

  test("an action with no conditions is available", () => {
    assert.deepStrictEqual(evaluateAvailability({ label: "Partir en quête" }, ctx), {
      ok: true,
      reason: null,
      behaviour: "hide",
    });
  });

  test("the authored message wins over the evaluator's default", () => {
    const actionType = {
      availability: {
        conditions: [{ type: "minReputation", value: 999 }],
        unmetBehaviour: "disable",
        unmetMessage: "Votre renom n'est pas encore parvenu jusqu'ici.",
      },
    };

    assert.deepStrictEqual(evaluateAvailability(actionType, ctx), {
      ok: false,
      reason: "Votre renom n'est pas encore parvenu jusqu'ici.",
      behaviour: "disable",
    });
  });

  test("falls back to the per-type reason when no message was authored", () => {
    const actionType = { availability: { conditions: [{ type: "minReputation", value: 999 }] } };
    const result = evaluateAvailability(actionType, ctx);

    assert.equal(result.ok, false);
    assert.equal(result.reason, "Votre réputation est insuffisante.");
    assert.equal(result.behaviour, "hide");
  });

  test("an unknown condition type blocks the action", () => {
    const actionType = { availability: { conditions: [{ type: "aLaBelleEtoile" }] } };
    assert.equal(evaluateAvailability(actionType, ctx).reason, UNKNOWN_CONDITION_REASON);
  });

  test("accepts a normalized action type as readily as a raw one", () => {
    const raw = { availability: { conditions: [{ type: "minReputation", value: 999 }], unmetBehaviour: "disable" } };
    assert.deepStrictEqual(evaluateAvailability(normalizeActionType(raw), ctx), evaluateAvailability(raw, ctx));
  });
});
