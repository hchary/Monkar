const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { buildNarrativeContext, narrateQuestSuccess, preferQuestPhrasesPerSlot } = require("./partirEnQuete");

// worldData/tags/items: the id-keyed catalog quests and talents reference.
const TAGS_BY_ID = new Map([
  ["t-feu", "feu"],
  ["t-magie", "magie"],
  ["t-protection", "protection"],
  ["t-lame", "lame"],
]);

const QUEST = { id: "q1", name: "Le siège de Vaubourg", tagIds: ["t-protection"] };

const PYROMANCIE = { id: "tal-pyro", name: "Pyromancie", rarity: "rare", tagIds: ["t-feu", "t-magie"] };
const ESCRIME = { id: "tal-escrime", name: "Escrime", rarity: "commun", tagIds: ["t-lame"] };

describe("buildNarrativeContext", () => {
  test("resolves quest and progressed-talent tagIds to the free-text tag names the generator matches", () => {
    const context = buildNarrativeContext({
      quest: QUEST,
      locationName: "Vaubourg",
      talents: [PYROMANCIE],
      nextTalents: [PYROMANCIE],
      talentEvolutions: [{ talentId: "tal-pyro", name: "Pyromancie", kind: "evolution", rarity: "rare" }],
      tagsByIdName: TAGS_BY_ID,
    });

    assert.deepEqual(context.talentTags, ["feu", "magie"]);
    assert.deepEqual(context.questTags, ["protection"]);
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
      tagsByIdName: TAGS_BY_ID,
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
      tagsByIdName: TAGS_BY_ID,
    });

    assert.equal(context.talentName, "Pyromancie");
    assert.deepEqual(context.talentTags, ["feu", "magie"]);
  });

  test("finds a freshly unlocked talent that isn't on the character's sheet yet", () => {
    const context = buildNarrativeContext({
      quest: QUEST,
      talents: [PYROMANCIE],
      nextTalents: [],
      talentEvolutions: [{ talentId: "tal-pyro", name: "Pyromancie", kind: "unlock", rarity: "rare" }],
      tagsByIdName: TAGS_BY_ID,
    });

    assert.equal(context.talentChange, "unlock");
    assert.deepEqual(context.talentTags, ["feu", "magie"]);
  });

  test("drops tag ids with no catalog entry rather than leaking raw ids into the text", () => {
    const context = buildNarrativeContext({
      quest: { ...QUEST, tagIds: ["t-protection", "t-supprime"] },
      talents: [],
      nextTalents: [],
      talentEvolutions: [],
      tagsByIdName: TAGS_BY_ID,
    });

    assert.deepEqual(context.questTags, ["protection"]);
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
    { id: "s-bandits", type: "groupe", article: "les", nom: "bandits du col", tags: ["humanoide"] },
    { id: "s-chef", type: "individuel", article: "le", nom: "chef de la bande", tags: ["humanoide"] },
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
