const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { resolveDurationHours, resolveConditions, normalizeActionType, evaluateAvailability } = require("./actionCatalog");
const { UNKNOWN_CONDITION_REASON } = require("./actionConditions");

describe("resolveDurationHours", () => {
  test("defaults to 12h", () => {
    assert.equal(resolveDurationHours({}), 12);
    assert.equal(resolveDurationHours(undefined), 12);
  });

  test("honours a positive duration", () => {
    assert.equal(resolveDurationHours({ durationHours: 8 }), 8);
    assert.equal(resolveDurationHours({ durationHours: "6" }), 6);
  });

  test("falls back to the default rather than producing an action that never completes", () => {
    assert.equal(resolveDurationHours({ durationHours: 0 }), 12);
    assert.equal(resolveDurationHours({ durationHours: -5 }), 12);
    assert.equal(resolveDurationHours({ durationHours: "bientôt" }), 12);
    assert.equal(resolveDurationHours({ durationHours: null }), 12);
  });
});

describe("normalizeActionType", () => {
  // The single document that exists today, authored before any of these fields did.
  test("a pre-framework document normalizes to a working action", () => {
    const normalized = normalizeActionType({
      label: "Partir en quête",
      questDifficultyWeights: [{ difficulty: "facile", weight: 55 }],
    });

    assert.equal(normalized.label, "Partir en quête");
    assert.equal(normalized.kindId, null);
    assert.equal(normalized.categoryId, null);
    assert.deepStrictEqual(normalized.professionIds, []);
    assert.equal(normalized.description, "");
    assert.equal(normalized.order, 0);
    assert.equal(normalized.enabled, true);
    assert.equal(normalized.handlerId, null);
    assert.equal(normalized.durationHours, 12);
    assert.deepStrictEqual(normalized.availability, {
      conditions: [],
      unmetBehaviour: "hide",
      unmetMessage: "",
    });
    assert.deepStrictEqual(normalized.result, { accentSource: "category", showLoot: false });
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
      durationHours: 6,
      availability: {
        conditions: [{ type: "notWounded" }],
        unmetBehaviour: "disable",
        unmetMessage: "Vous êtes déjà en pleine forme.",
      },
      result: { accentSource: "difficulty", showLoot: true },
    });

    assert.equal(normalized.kindId, "intermede");
    assert.equal(normalized.categoryId, "intermede");
    assert.equal(normalized.order, 3);
    assert.equal(normalized.handlerId, "seReposer");
    assert.equal(normalized.durationHours, 6);
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
    });

    assert.equal(normalized.order, 0);
    assert.equal(normalized.handlerId, null);
    assert.deepStrictEqual(normalized.availability.conditions, []);
    assert.equal(normalized.availability.unmetBehaviour, "hide");
    assert.equal(normalized.result.accentSource, "category");
    assert.equal(normalized.result.showLoot, false);
  });

  test("is idempotent - normalizing twice changes nothing", () => {
    const once = normalizeActionType({ label: "Partir en quête", durationHours: 6 });
    assert.deepStrictEqual(normalizeActionType(once), once);
  });

  test("is idempotent for a Métier action too - the implicit gate isn't injected twice", () => {
    const once = normalizeActionType({ label: "Forger", kindId: "metier", professionIds: ["forgeron"] });
    assert.deepStrictEqual(normalizeActionType(once), once);
    assert.equal(once.availability.conditions.filter((c) => c.type === "hasProfession").length, 1);
  });

  test("is idempotent for an Entraînement action too - the implicit gate isn't injected twice", () => {
    const once = normalizeActionType({ label: "S'entraîner", kindId: "entrainement", trainerTypeId: "maitre-armes" });
    assert.deepStrictEqual(normalizeActionType(once), once);
    assert.equal(once.availability.conditions.filter((c) => c.type === "trainerReachable").length, 1);
  });

  test("is idempotent for an Apprentissage action too - both implicit gates aren't injected twice", () => {
    const once = normalizeActionType({ label: "Apprentissage", kindId: "apprentissage", trainerTypeId: "maitre-armes" });
    assert.deepStrictEqual(normalizeActionType(once), once);
    assert.equal(once.availability.conditions.filter((c) => c.type === "trainerReachable").length, 1);
    assert.equal(once.availability.conditions.filter((c) => c.type === "professionless").length, 1);
  });
});

// An action carries a kindId and its category falls out of the kind's root - the four categories
// being exactly the four root kinds is what lets a pre-kinds document read as the kind it always
// implied, with no migration.
describe("normalizeActionType - kinds", () => {
  test("a document authored before kinds reads its categoryId as its kind", () => {
    const normalized = normalizeActionType({ label: "Partir en quête", categoryId: "aventure" });
    assert.equal(normalized.kindId, "aventure");
    assert.equal(normalized.categoryId, "aventure");
  });

  test("an authored kindId wins over a stale categoryId", () => {
    const normalized = normalizeActionType({ kindId: "metier", categoryId: "aventure" });
    assert.equal(normalized.kindId, "metier");
    assert.equal(normalized.categoryId, "metier");
  });

  test("a kind this build doesn't know keeps whatever category it was filed under", () => {
    const normalized = normalizeActionType({ kindId: "transport", categoryId: "metier" });
    assert.equal(normalized.kindId, "transport");
    assert.equal(normalized.categoryId, "metier");
  });

  test("a Métier subtype's category is derived as Métier, not left as whatever was authored", () => {
    const normalized = normalizeActionType({ kindId: "recolte", categoryId: "aventure" });
    assert.equal(normalized.kindId, "recolte");
    assert.equal(normalized.categoryId, "metier");
  });

  test("professionIds drops anything that isn't an id", () => {
    assert.deepStrictEqual(normalizeActionType({ professionIds: "forgeron" }).professionIds, []);
    assert.deepStrictEqual(normalizeActionType({ professionIds: ["forgeron", null, 3] }).professionIds, ["forgeron"]);
  });
});

// "Une action de Métier est une action disponible uniquement pour les personnages possédant le
// métier associé" - expressed as a condition the catalog injects, never one the creator authors,
// so the "Métiers associés" field is the single place that rule is edited.
describe("resolveConditions - the implicit profession gate", () => {
  test("a Métier action is gated on its own professionIds", () => {
    const conditions = resolveConditions({ kindId: "metier", professionIds: ["forgeron", "armurier"] });
    assert.deepStrictEqual(conditions, [{ type: "hasProfession", professionIds: ["forgeron", "armurier"] }]);
  });

  test("the gate is appended to the authored conditions, not substituted for them", () => {
    const conditions = resolveConditions({
      kindId: "metier",
      professionIds: ["forgeron"],
      availability: { conditions: [{ type: "notWounded" }] },
    });
    assert.deepStrictEqual(conditions, [
      { type: "notWounded" },
      { type: "hasProfession", professionIds: ["forgeron"] },
    ]);
  });

  test("actions outside the Métier branch are left alone", () => {
    for (const kindId of ["aventure", "intermede", "social"]) {
      assert.deepStrictEqual(resolveConditions({ kindId, professionIds: ["forgeron"] }), []);
    }
  });

  test("a Métier action reserved to nobody is available to nobody", () => {
    const character = { professionId: "forgeron" };
    const ctx = { character, instanceTagIds: new Set() };
    assert.equal(evaluateAvailability({ kindId: "metier", professionIds: [] }, ctx).ok, false);
    assert.equal(evaluateAvailability({ kindId: "metier" }, ctx).ok, false);
  });
});

// "Une action d'Entraînement n'est disponible que là où son entraîneur est accessible" -
// expressed the same way as the profession gate: injected by the catalog from the action's own
// trainerTypeId, never authored by hand.
describe("resolveConditions - the implicit trainer-reachability gate", () => {
  test("an Entraînement action is gated on its own trainerTypeId", () => {
    const conditions = resolveConditions({ kindId: "entrainement", trainerTypeId: "maitre-armes" });
    assert.deepStrictEqual(conditions, [{ type: "trainerReachable", trainerTypeId: "maitre-armes" }]);
  });

  test("the gate is appended to the authored conditions, not substituted for them", () => {
    const conditions = resolveConditions({
      kindId: "entrainement",
      trainerTypeId: "maitre-armes",
      availability: { conditions: [{ type: "notWounded" }] },
    });
    assert.deepStrictEqual(conditions, [
      { type: "notWounded" },
      { type: "trainerReachable", trainerTypeId: "maitre-armes" },
    ]);
  });

  test("actions outside the Entraînement branch are left alone, even a Métier action with a stray trainerTypeId", () => {
    for (const kindId of ["aventure", "intermede", "social"]) {
      assert.deepStrictEqual(resolveConditions({ kindId, trainerTypeId: "maitre-armes" }), []);
    }
    const conditions = resolveConditions({
      kindId: "metier",
      professionIds: ["forgeron"],
      trainerTypeId: "maitre-armes",
    });
    assert.deepStrictEqual(conditions, [{ type: "hasProfession", professionIds: ["forgeron"] }]);
  });
});

// "Une action d'Apprentissage n'est disponible qu'à un personnage n'exerçant encore aucun
// métier" - expressed the same way as the other implicit gates: injected by the catalog whenever
// the action's kind inherits from Apprentissage, never authored by hand. Apprentissage nests
// under Entraînement, so an Apprentissage action also gets the trainer-reachability gate above.
describe("resolveConditions - the implicit professionless gate", () => {
  test("an Apprentissage action is gated on trainer reachability and on having no profession", () => {
    const conditions = resolveConditions({ kindId: "apprentissage", trainerTypeId: "maitre-armes" });
    assert.deepStrictEqual(conditions, [
      { type: "trainerReachable", trainerTypeId: "maitre-armes" },
      { type: "professionless" },
    ]);
  });

  test("the gate is appended to the authored conditions, not substituted for them", () => {
    const conditions = resolveConditions({
      kindId: "apprentissage",
      trainerTypeId: "maitre-armes",
      availability: { conditions: [{ type: "notWounded" }] },
    });
    assert.deepStrictEqual(conditions, [
      { type: "notWounded" },
      { type: "trainerReachable", trainerTypeId: "maitre-armes" },
      { type: "professionless" },
    ]);
  });

  test("actions outside the Apprentissage branch are left alone, including plain Entraînement", () => {
    for (const kindId of ["aventure", "intermede", "social", "metier", "entrainement"]) {
      assert.ok(!resolveConditions({ kindId, trainerTypeId: "maitre-armes" }).some((c) => c.type === "professionless"));
    }
  });

  test("an Apprentissage action is unavailable to a character who already practises a profession", () => {
    const actionType = { kindId: "apprentissage", trainerTypeId: "maitre-armes" };
    const ctx = { character: { professionId: "forgeron" }, instanceTagIds: new Set(), reachableTrainerTypeIds: new Set(["maitre-armes"]) };
    const result = evaluateAvailability(actionType, ctx);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "Vous exercez déjà un métier.");
  });
});

describe("evaluateAvailability - Métier actions", () => {
  const actionType = { kindId: "metier", professionIds: ["forgeron"] };
  const ctxFor = (character) => ({ character, instanceTagIds: new Set() });

  test("the character practising the profession may act", () => {
    assert.equal(evaluateAvailability(actionType, ctxFor({ professionId: "forgeron" })).ok, true);
  });

  test("a character practising another profession may not", () => {
    const result = evaluateAvailability(actionType, ctxFor({ professionId: "pecheur" }));
    assert.equal(result.ok, false);
    assert.equal(result.reason, "Vous n'exercez pas le métier requis pour cette action.");
  });

  test("a character with no profession at all may not", () => {
    assert.equal(evaluateAvailability(actionType, ctxFor({ professionId: null })).ok, false);
    assert.equal(evaluateAvailability(actionType, ctxFor({})).ok, false);
  });

  // The gate must hold for a caller that passed the raw Firestore document straight through,
  // exactly as it does for a normalized one - otherwise skipping normalizeActionType would
  // silently open a Métier action to everyone.
  test("holds whether the action type is raw or normalized", () => {
    const character = { professionId: "pecheur" };
    assert.deepStrictEqual(
      evaluateAvailability(normalizeActionType(actionType), ctxFor(character)),
      evaluateAvailability(actionType, ctxFor(character))
    );
  });
});

describe("evaluateAvailability", () => {
  const character = { reputation: 10, talents: [], woundsLight: 0, woundsSevere: 0, woundsPermanent: 0 };
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
