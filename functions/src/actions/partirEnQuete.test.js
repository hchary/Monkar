const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildNarrativeContext,
  narrateQuestSuccess,
  narrateQuestFailure,
  preferQuestPhrasesPerSlot,
  resolveQuestOutcome,
} = require("./partirEnQuete");

const QUEST = { id: "q1", name: "Le siège de Vaubourg", tagIds: ["t-protection"] };

const PYROMANCIE = { id: "tal-pyro", name: "Pyromancie", rarity: "rare", tagIds: ["t-feu", "t-magie"] };
const ESCRIME = { id: "tal-escrime", name: "Escrime", rarity: "commun", tagIds: ["t-lame"] };

describe("buildNarrativeContext", () => {
  test("carries the quest's and the progressed talent's tagIds straight through as context tags", () => {
    const context = buildNarrativeContext({
      quest: QUEST,
      locationName: "Vaubourg",
      talents: [PYROMANCIE],
      nextTalents: [PYROMANCIE],
      talentEvolutions: [{ talentId: "tal-pyro", name: "Pyromancie", kind: "evolution", rarity: "rare" }],
    });

    assert.deepEqual(context.talentTags, ["t-feu", "t-magie"]);
    assert.deepEqual(context.questTags, ["t-protection"]);
    assert.equal(context.talentChange, "evolution");
    assert.equal(context.talentName, "Pyromancie");
    assert.equal(context.locationName, "Vaubourg");
    assert.equal(context.questName, "Le siège de Vaubourg");
  });

  test("carries no talent context when nothing progressed, so no flourish can fire", () => {
    const context = buildNarrativeContext({
      quest: QUEST,
      locationName: "Vaubourg",
      talents: [PYROMANCIE],
      nextTalents: [PYROMANCIE],
      talentEvolutions: [],
    });

    assert.deepEqual(context.talentTags, []);
    assert.equal(context.talentChange, null);
    assert.equal(context.talentName, null);
  });

  test("narrates the rarest change when several talents progressed at once", () => {
    const context = buildNarrativeContext({
      quest: QUEST,
      talents: [PYROMANCIE, ESCRIME],
      nextTalents: [PYROMANCIE, ESCRIME],
      talentEvolutions: [
        { talentId: "tal-escrime", name: "Escrime", kind: "evolution", rarity: "commun" },
        { talentId: "tal-pyro", name: "Pyromancie", kind: "evolution", rarity: "rare" },
      ],
    });

    assert.equal(context.talentName, "Pyromancie");
    assert.deepEqual(context.talentTags, ["t-feu", "t-magie"]);
  });

  test("finds a freshly unlocked talent that isn't on the character's sheet yet", () => {
    const context = buildNarrativeContext({
      quest: QUEST,
      talents: [PYROMANCIE],
      nextTalents: [],
      talentEvolutions: [{ talentId: "tal-pyro", name: "Pyromancie", kind: "unlock", rarity: "rare" }],
    });

    assert.equal(context.talentChange, "unlock");
    assert.deepEqual(context.talentTags, ["t-feu", "t-magie"]);
  });
});

describe("preferQuestPhrasesPerSlot", () => {
  const global = [
    { id: "g-open", slot: "opening", template: "le calme est revenu" },
    { id: "g-climax", slot: "climax", template: "vous avez triomphé de {sujet}" },
    { id: "g-growth", slot: "talentGrowth", template: "vous sentez votre {talent} grandir" },
  ];

  test("a quest's own phrase overrides the global pool only for the slot it belongs to", () => {
    const own = [{ id: "q-climax", slot: "climax", template: "vous avez brisé le siège devant {sujet}" }];
    const pool = preferQuestPhrasesPerSlot({ questVerbPhrases: own, verbPhrases: [...global, ...own] });

    assert.deepEqual(
      pool.map((v) => v.id),
      ["g-open", "q-climax", "g-growth"]
    );
  });

  test("falls back to the whole global pool for a quest that links no phrases", () => {
    const pool = preferQuestPhrasesPerSlot({ questVerbPhrases: [], verbPhrases: global });
    assert.deepEqual(
      pool.map((v) => v.id),
      ["g-open", "g-climax", "g-growth"]
    );
  });

  test("treats a slotless linked phrase as the quest's own action content", () => {
    const own = [{ id: "q-legacy", template: "vous avez repoussé {sujet}" }];
    const pool = preferQuestPhrasesPerSlot({ questVerbPhrases: own, verbPhrases: [...global, ...own] });

    assert.deepEqual(
      pool.map((v) => v.id),
      ["g-open", "q-legacy", "g-growth"]
    );
  });
});

describe("narrateQuestSuccess", () => {
  const subjects = [
    { id: "s-bandits", type: "groupe", article: "les", nom: "bandits du col", tagIds: ["humanoide"] },
    { id: "s-chef", type: "individuel", article: "le", nom: "chef de la bande", tagIds: ["humanoide"] },
  ];
  const verbPhrases = [
    { id: "v-groupe", resultat: "victoire", cible: "groupe", template: "vous avez dispersé {sujet}" },
    { id: "v-individuel", resultat: "victoire", cible: "individuel", template: "vous avez capturé {sujet}" },
  ];

  test("generates for whichever target shape is drawn, both being authored", () => {
    const results = new Set();
    for (let i = 0; i < 40; i++) {
      results.add(narrateQuestSuccess({ quest: QUEST, questObjectives: subjects, narrativeSubjects: subjects, verbPhrases, context: {} }).text);
    }

    assert.deepEqual(
      [...results].sort(),
      ["Vous avez capturé le chef de la bande.", "Vous avez dispersé les bandits du col."]
    );
  });

  test("falls back to the global subject pool when the quest declares no objectives", () => {
    const narrative = narrateQuestSuccess({
      quest: QUEST,
      questObjectives: [],
      narrativeSubjects: subjects,
      verbPhrases,
      context: {},
    });

    assert.ok(narrative.text.startsWith("Vous avez "));
  });

  test("returns null on an empty catalog so resolve() keeps its own fallback sentence", () => {
    assert.equal(
      narrateQuestSuccess({ quest: QUEST, questObjectives: [], narrativeSubjects: [], verbPhrases: [], context: {} }),
      null
    );
  });
});

describe("narrateQuestFailure", () => {
  const subjects = [
    { id: "s-bandits", type: "groupe", article: "les", nom: "bandits du col", tagIds: ["humanoide"] },
    { id: "s-chef", type: "individuel", article: "le", nom: "chef de la bande", tagIds: ["humanoide"] },
  ];
  const verbPhrases = [
    { id: "v-groupe", resultat: "echec", cible: "groupe", template: "vous avez été repoussé par {sujet}" },
    { id: "v-individuel", resultat: "echec", cible: "individuel", template: "vous avez échoué face à {sujet}" },
  ];

  test("mirrors narrateQuestSuccess against the failure side (failurePhraseIds, resultat: echec)", () => {
    const results = new Set();
    for (let i = 0; i < 40; i++) {
      results.add(narrateQuestFailure({ quest: QUEST, questObjectives: subjects, narrativeSubjects: subjects, verbPhrases, context: {} }).text);
    }

    assert.deepEqual(
      [...results].sort(),
      ["Vous avez échoué face à le chef de la bande.", "Vous avez été repoussé par les bandits du col."]
    );
  });

  test("falls back to the global subject pool when the quest declares no objectives", () => {
    const narrative = narrateQuestFailure({
      quest: QUEST,
      questObjectives: [],
      narrativeSubjects: subjects,
      verbPhrases,
      context: {},
    });

    assert.ok(narrative.text.startsWith("Vous avez "));
  });

  test("returns null on an empty catalog", () => {
    assert.equal(
      narrateQuestFailure({ quest: QUEST, questObjectives: [], narrativeSubjects: [], verbPhrases: [], context: {} }),
      null
    );
  });

  test("only picks phrases linked via quest.failurePhraseIds, not successPhraseIds", () => {
    const quest = { ...QUEST, successPhraseIds: ["v-groupe"], failurePhraseIds: ["v-individuel"] };
    // With only "v-individuel" preferred and the "individuel" cible forced by a single-shape
    // subject pool, the success-linked phrase never has a chance to fire.
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(
        narrateQuestFailure({ quest, questObjectives: [subjects[1]], narrativeSubjects: subjects, verbPhrases, context: {} }).text
      );
    }
    assert.deepEqual([...results], ["Vous avez échoué face à le chef de la bande."]);
  });
});

describe("resolveQuestOutcome", () => {
  const objective = { id: "obj1", nom: "bandits", article: "les", rarity: "rare", tagIds: ["t-protection"] };
  const lootTables = [
    { id: "table-rare", rarity: "rare", tagIds: ["t-protection"], itemIds: ["obj-shield"] },
    { id: "table-commun", rarity: "commun", tagIds: ["t-protection"], itemIds: ["obj-stick"] },
  ];
  const objects = [
    { id: "obj-shield", name: "Bouclier", rarity: "rare", type: "armure", tagIds: [] },
    { id: "obj-stick", name: "Bâton", rarity: "commun", type: "arme", tagIds: [] },
  ];

  function baseArgs(overrides = {}) {
    return {
      character: { talents: [], reputation: 0 },
      quest: { id: "q1", name: "Le siège de Vaubourg", tagIds: ["t-protection"], difficulty: "mythique" },
      questObjectives: [objective],
      narrativeSubjects: [objective],
      verbPhrases: [],
      lootTables,
      objects,
      talents: [],
      locationName: null,
      today: "2026-08-05",
      circumstance: "lors de la quête « Le siège de Vaubourg »",
      defaultSuccessText: "Succès par défaut.",
      defaultSuccessClause: "succès par défaut",
      defaultFailureText: "Échec par défaut.",
      defaultFailureClause: "échec par défaut",
      ...overrides,
    };
  }

  test("draws degraded-rarity loot (two ranks down, floored at commun) and grants no reputation on a forced failure", () => {
    const originalRandom = Math.random;
    try {
      // "mythique" has a success threshold of 100; a score fixed at 1 (Math.random -> 0) can
      // never reach it, guaranteeing failure deterministically without a statistical loop.
      Math.random = () => 0;

      const outcome = resolveQuestOutcome(baseArgs());

      assert.equal(outcome.success, false);
      assert.equal(outcome.score, 1);
      assert.equal(outcome.reputationGained, 0);
      assert.deepEqual(outcome.talentEvolutions, []);
      assert.equal(outcome.narrativeText, "Échec par défaut.");
      // Objective rarity "rare" (index 2) minus 2 ranks -> "commun" (index 0), not "rare".
      // "mythique" draws 3 loot items (LOOT_COUNT_BY_DIFFICULTY), all matching the "commun" table.
      assert.equal(outcome.loot.length, 3);
      assert.ok(outcome.loot.every((item) => item.rarity === "commun"));
    } finally {
      Math.random = originalRandom;
    }
  });

  test("draws exact-rarity loot, rolls reputation, and may evolve talents on a forced success", () => {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.999;

      const outcome = resolveQuestOutcome(baseArgs({ quest: { ...baseArgs().quest, difficulty: "facile" } }));

      assert.equal(outcome.success, true);
      assert.ok(outcome.reputationGained > 0);
      assert.equal(outcome.narrativeText, "Succès par défaut.");
      assert.equal(outcome.loot.length, 1);
      assert.equal(outcome.loot[0].rarity, "rare");
    } finally {
      Math.random = originalRandom;
    }
  });
});
