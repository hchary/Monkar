const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  CONDITION_TYPES,
  UNKNOWN_CONDITION_REASON,
  evaluateConditions,
  conditionsNeedInstances,
  conditionsNeedTrainerReachability,
} = require("./actionConditions");

const CHARACTER = {
  profession: "Pêcheur",
  professionId: "pecheur",
  reputation: 40,
  legendLevel: 2,
  region: { id: "cote-des-brumes", name: "Côte des Brumes" },
  woundsLight: 0,
  woundsSevere: 0,
  woundsPermanent: 0,
  talents: [
    { id: "resistance-au-feu", quality: 3, tagIds: ["feu", "protection"] },
    { id: "peche", quality: 1, tagIds: [] },
  ],
};

const ctx = (overrides = {}) => ({ character: CHARACTER, instanceTagIds: new Set(), ...overrides });

// Asserts a single condition in isolation, which is how the creator authors them one row at a time.
function check(condition, context = ctx()) {
  return evaluateConditions([condition], context).ok;
}

describe("evaluateConditions - no conditions", () => {
  test("an action with no conditions is available", () => {
    assert.deepStrictEqual(evaluateConditions(undefined, ctx()), { ok: true, reason: null });
    assert.deepStrictEqual(evaluateConditions(null, ctx()), { ok: true, reason: null });
    assert.deepStrictEqual(evaluateConditions([], ctx()), { ok: true, reason: null });
  });

  test("a conditions field that isn't a list fails closed", () => {
    assert.deepStrictEqual(evaluateConditions("aucune", ctx()), {
      ok: false,
      reason: UNKNOWN_CONDITION_REASON,
    });
  });
});

describe("evaluateConditions - hasTalent", () => {
  test("matches a talent the character owns", () => {
    assert.equal(check({ type: "hasTalent", talentId: "peche" }), true);
    assert.equal(check({ type: "hasTalent", talentId: "alchimie" }), false);
  });

  test("minQuality gates on the talent's quality, and defaults to 1", () => {
    assert.equal(check({ type: "hasTalent", talentId: "resistance-au-feu", minQuality: 3 }), true);
    assert.equal(check({ type: "hasTalent", talentId: "resistance-au-feu", minQuality: 4 }), false);
    assert.equal(check({ type: "hasTalent", talentId: "peche", minQuality: 2 }), false);
    assert.equal(check({ type: "hasTalent", talentId: "peche" }), true);
  });

  test("a missing or malformed talentId fails closed", () => {
    assert.equal(check({ type: "hasTalent" }), false);
    assert.equal(check({ type: "hasTalent", talentId: "" }), false);
    assert.equal(check({ type: "hasTalent", talentId: "peche", minQuality: "beaucoup" }), false);
  });
});

describe("evaluateConditions - hasTalentTag", () => {
  test("matches any owned talent carrying the tag", () => {
    assert.equal(check({ type: "hasTalentTag", tagId: "feu" }), true);
    assert.equal(check({ type: "hasTalentTag", tagId: "glace" }), false);
  });

  test("respects minQuality on the tagged talent", () => {
    assert.equal(check({ type: "hasTalentTag", tagId: "feu", minQuality: 3 }), true);
    assert.equal(check({ type: "hasTalentTag", tagId: "feu", minQuality: 5 }), false);
  });

  test("a talent granted before tagIds were copied never matches", () => {
    const legacy = { ...CHARACTER, talents: [{ id: "resistance-au-feu", quality: 5 }] };
    assert.equal(check({ type: "hasTalentTag", tagId: "feu" }, ctx({ character: legacy })), false);
  });
});

describe("evaluateConditions - numeric thresholds", () => {
  test("minReputation compares against the character's reputation", () => {
    assert.equal(check({ type: "minReputation", value: 40 }), true);
    assert.equal(check({ type: "minReputation", value: 41 }), false);
  });

  test("minLegendLevel treats a never-set level as zero", () => {
    assert.equal(check({ type: "minLegendLevel", value: 2 }), true);
    assert.equal(check({ type: "minLegendLevel", value: 3 }), false);

    const novice = { ...CHARACTER, legendLevel: null };
    assert.equal(check({ type: "minLegendLevel", value: 1 }, ctx({ character: novice })), false);
    assert.equal(check({ type: "minLegendLevel", value: 0 }, ctx({ character: novice })), true);
  });

  test("a missing or malformed threshold fails closed", () => {
    assert.equal(check({ type: "minReputation" }), false);
    assert.equal(check({ type: "minReputation", value: null }), false);
    assert.equal(check({ type: "minReputation", value: "beaucoup" }), false);
  });
});

describe("evaluateConditions - profession and region", () => {
  test("profession matches the character's denormalized profession string", () => {
    assert.equal(check({ type: "profession", values: ["Pêcheur", "Forgeron"] }), true);
    assert.equal(check({ type: "profession", values: ["Forgeron"] }), false);
  });

  test("region matches the character's region id", () => {
    assert.equal(check({ type: "region", regionIds: ["cote-des-brumes"] }), true);
    assert.equal(check({ type: "region", regionIds: ["montagnes"] }), false);
  });

  test("an empty allowlist allows nobody", () => {
    assert.equal(check({ type: "profession", values: [] }), false);
    assert.equal(check({ type: "region", regionIds: [] }), false);
    assert.equal(check({ type: "hasProfession", professionIds: [] }), false);
  });
});

// The gate behind every Métier action. Injected by the catalog from the action's professionIds
// (see actionCatalog.js's resolveConditions), which is why it isn't offered by CONDITION_TYPES.
describe("evaluateConditions - hasProfession", () => {
  test("matches the profession the character is actually practising", () => {
    assert.equal(check({ type: "hasProfession", professionIds: ["pecheur", "forgeron"] }), true);
    assert.equal(check({ type: "hasProfession", professionIds: ["forgeron"] }), false);
  });

  // Distinct from the older `profession` predicate: that one reads the free-text trade copied
  // from the rolled background, this one reads the profession catalog id.
  test("reads professionId, not the free-text profession string", () => {
    assert.equal(check({ type: "hasProfession", professionIds: ["Pêcheur"] }), false);
  });

  test("a character practising nothing matches nothing", () => {
    const noProfession = { ...CHARACTER, professionId: null };
    assert.equal(
      check({ type: "hasProfession", professionIds: ["pecheur"] }, ctx({ character: noProfession })),
      false
    );
  });

  test("a known-but-not-active profession does not open the action", () => {
    const retired = { ...CHARACTER, professionId: "forgeron", knownProfessions: [{ professionId: "pecheur", level: 3 }] };
    assert.equal(check({ type: "hasProfession", professionIds: ["pecheur"] }, ctx({ character: retired })), false);
  });
});

describe("evaluateConditions - hasInstanceTag", () => {
  test("matches a tag on an owned instance", () => {
    const context = ctx({ instanceTagIds: new Set(["outil-de-peche"]) });
    assert.equal(check({ type: "hasInstanceTag", tagId: "outil-de-peche" }, context), true);
    assert.equal(check({ type: "hasInstanceTag", tagId: "arme" }, context), false);
  });

  // A caller that skipped the extra reads cannot prove ownership, so it must not assume it.
  test("fails closed when the instance tag set was never loaded", () => {
    assert.equal(check({ type: "hasInstanceTag", tagId: "arme" }, { character: CHARACTER }), false);
  });
});

// The gate behind every Entraînement action. Injected by the catalog from the action's own
// trainerTypeId (see actionCatalog.js's resolveConditions), which is why it isn't offered by
// CONDITION_TYPES either, same as hasProfession.
describe("evaluateConditions - trainerReachable", () => {
  test("matches a trainerTypeId present in the reachable set", () => {
    const context = ctx({ reachableTrainerTypeIds: new Set(["maitre-armes"]) });
    assert.equal(check({ type: "trainerReachable", trainerTypeId: "maitre-armes" }, context), true);
    assert.equal(check({ type: "trainerReachable", trainerTypeId: "sage-ermite" }, context), false);
  });

  // A caller that skipped the extra reads cannot prove reachability, so it must not assume it.
  test("fails closed when the reachable set was never loaded", () => {
    assert.equal(
      check({ type: "trainerReachable", trainerTypeId: "maitre-armes" }, { character: CHARACTER }),
      false
    );
  });

  test("a missing trainerTypeId fails closed", () => {
    const context = ctx({ reachableTrainerTypeIds: new Set(["maitre-armes"]) });
    assert.equal(check({ type: "trainerReachable" }, context), false);
  });
});

// The gate behind every Apprentissage action. Injected by the catalog whenever the action's kind
// inherits from PROFESSION_LEARNING_ACTION_KIND_ID (see actionCatalog.js's resolveConditions),
// same reason as hasProfession/trainerReachable for not being offered by CONDITION_TYPES.
describe("evaluateConditions - professionless", () => {
  test("a character already practising a profession fails it", () => {
    assert.equal(check({ type: "professionless" }), false);
  });

  test("a character practising nothing passes it", () => {
    const noProfession = { ...CHARACTER, professionId: null };
    assert.equal(check({ type: "professionless" }, ctx({ character: noProfession })), true);
  });
});

// The gate behind "Se renseigner". Injected by the catalog whenever the action's kind inherits
// from RENSEIGNEMENT_ACTION_KIND_ID (see actionCatalog.js's resolveConditions), same reason as
// hasIntermedeBudget for not being offered by CONDITION_TYPES.
describe("evaluateConditions - renseignementAvailable", () => {
  test("passes once missionsSinceRenseignement reaches the reputation-scaled requirement", () => {
    // CHARACTER.reputation is 40, so missionsRequiredForRenseignement(40) is 3.
    const notEnough = { ...CHARACTER, missionsSinceRenseignement: 2 };
    const enough = { ...CHARACTER, missionsSinceRenseignement: 3 };
    assert.equal(check({ type: "renseignementAvailable" }, ctx({ character: notEnough })), false);
    assert.equal(check({ type: "renseignementAvailable" }, ctx({ character: enough })), true);
  });

  test("a character who never resolved a mission fails it", () => {
    const noCounter = { ...CHARACTER };
    delete noCounter.missionsSinceRenseignement;
    assert.equal(check({ type: "renseignementAvailable" }, ctx({ character: noCounter })), false);
  });

  test("a higher reputation lowers the requirement", () => {
    const highReputation = { ...CHARACTER, reputation: 1000, missionsSinceRenseignement: 1 };
    assert.equal(check({ type: "renseignementAvailable" }, ctx({ character: highReputation })), true);
  });
});

describe("evaluateConditions - notWounded", () => {
  test("passes only while the character carries no wound", () => {
    assert.equal(check({ type: "notWounded" }), true);

    const lightlyWounded = { ...CHARACTER, woundsLight: 1 };
    assert.equal(check({ type: "notWounded" }, ctx({ character: lightlyWounded })), false);

    const severelyWounded = { ...CHARACTER, woundsSevere: 1 };
    assert.equal(check({ type: "notWounded" }, ctx({ character: severelyWounded })), false);

    const permanentlyWounded = { ...CHARACTER, woundsPermanent: 1 };
    assert.equal(check({ type: "notWounded" }, ctx({ character: permanentlyWounded })), false);
  });
});

describe("evaluateConditions - composition", () => {
  test("every condition must hold", () => {
    const conditions = [
      { type: "minReputation", value: 10 },
      { type: "hasTalent", talentId: "peche" },
      { type: "notWounded" },
    ];
    assert.equal(evaluateConditions(conditions, ctx()).ok, true);

    conditions.push({ type: "minLegendLevel", value: 99 });
    assert.equal(evaluateConditions(conditions, ctx()).ok, false);
  });

  test("the first failing condition decides the message", () => {
    const result = evaluateConditions(
      [
        { type: "minReputation", value: 999 },
        { type: "hasTalent", talentId: "alchimie" },
      ],
      ctx()
    );
    assert.equal(result.ok, false);
    assert.equal(result.reason, "Votre réputation est insuffisante.");
  });

  test("every reason is French player-facing text, never an id", () => {
    for (const { value } of CONDITION_TYPES) {
      const result = evaluateConditions([{ type: value }], ctx({ character: { woundsLight: 1 } }));
      assert.equal(result.ok, false, `${value} should fail with an empty condition`);
      assert.match(result.reason, /^[A-ZÀ-Ü].*\.$/, `${value} reason should read as a sentence`);
    }
  });
});

describe("evaluateConditions - unknown types fail closed", () => {
  // A catalog authored against a newer schema than the deployed code must hide the action, never
  // grant it - and the client copy must fail the same way, or a stale client would offer an
  // action the server refuses.
  test("an unrecognized condition type blocks the action", () => {
    const result = evaluateConditions([{ type: "aLaBelleEtoile" }], ctx());
    assert.deepStrictEqual(result, { ok: false, reason: UNKNOWN_CONDITION_REASON });
  });

  test("a condition with no type at all blocks the action", () => {
    assert.equal(evaluateConditions([{}], ctx()).ok, false);
    assert.equal(evaluateConditions([null], ctx()).ok, false);
  });

  test("an unknown type blocks even when every other condition passes", () => {
    const conditions = [{ type: "minReputation", value: 1 }, { type: "aLaBelleEtoile" }];
    assert.equal(evaluateConditions(conditions, ctx()).ok, false);
  });
});

describe("conditionsNeedInstances", () => {
  test("is true only when a condition actually reads owned instances", () => {
    assert.equal(conditionsNeedInstances([{ type: "hasInstanceTag", tagId: "arme" }]), true);
    assert.equal(
      conditionsNeedInstances([{ type: "minReputation", value: 1 }, { type: "hasInstanceTag", tagId: "arme" }]),
      true
    );
  });

  test("is false for condition sets that never touch instances", () => {
    assert.equal(conditionsNeedInstances([{ type: "minReputation", value: 1 }]), false);
    assert.equal(conditionsNeedInstances([{ type: "hasTalent", talentId: "peche" }]), false);
    assert.equal(conditionsNeedInstances([]), false);
    assert.equal(conditionsNeedInstances(undefined), false);
  });
});

describe("conditionsNeedTrainerReachability", () => {
  test("is true only when a condition actually reads trainer reachability", () => {
    assert.equal(conditionsNeedTrainerReachability([{ type: "trainerReachable", trainerTypeId: "x" }]), true);
    assert.equal(
      conditionsNeedTrainerReachability([
        { type: "minReputation", value: 1 },
        { type: "trainerReachable", trainerTypeId: "x" },
      ]),
      true
    );
  });

  test("is false for condition sets that never touch trainer reachability", () => {
    assert.equal(conditionsNeedTrainerReachability([{ type: "minReputation", value: 1 }]), false);
    assert.equal(conditionsNeedTrainerReachability([]), false);
    assert.equal(conditionsNeedTrainerReachability(undefined), false);
  });
});
