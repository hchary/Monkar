const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateResultText, generateNarrative } = require("./textGeneration");

test("generateResultText: existing exported contract still works (docs/ARCHITECTURE.md)", () => {
  const verbPhrases = [
    { resultat: "victoire", cible: "individuel", tags: ["feu"], template: "Vous avez terrassé {sujet}." },
  ];
  const subjects = [{ type: "individuel", tags: ["feu"], article: "le", nom: "gobelin" }];

  const result = generateResultText({ resultat: "victoire", cible: "individuel", subjects, verbPhrases });

  assert.equal(result, "Vous avez terrassé le gobelin.");
});

test("generateResultText: subject must now carry ALL of the verb phrase's tags, not just one", () => {
  const verbPhrases = [
    { resultat: "victoire", cible: "individuel", tags: ["feu", "lame"], template: "Vous avez terrassé {sujet}." },
  ];
  const subjects = [
    { type: "individuel", tags: ["feu"], article: "le", nom: "gobelin" }, // only shares one tag - must be excluded
    { type: "individuel", tags: ["feu", "lame"], article: "la", nom: "harpie" }, // carries both - qualifies
  ];

  const result = generateResultText({ resultat: "victoire", cible: "individuel", subjects, verbPhrases });

  assert.equal(result, "Vous avez terrassé la harpie.");
});

test("generateResultText: returns null when no subject/verb-phrase pair matches", () => {
  const verbPhrases = [
    { resultat: "victoire", cible: "individuel", tags: ["feu"], template: "Vous avez terrassé {sujet}." },
  ];
  const subjects = [{ type: "individuel", tags: ["glace"], article: "le", nom: "gobelin" }];

  const result = generateResultText({ resultat: "victoire", cible: "individuel", subjects, verbPhrases });

  assert.equal(result, null);
});

const subjects = [{ type: "individuel", tags: ["mort-vivant"], article: "le", nom: "squelette" }];

const verbPhrases = [
  {
    id: "o-protect-village",
    slot: "opening",
    tags: ["protection", "village"],
    template: "Le village n'a pas perdu une seule planche grâce à vous.",
  },
  {
    id: "o-protect-generic",
    slot: "opening",
    tags: ["protection"],
    template: "Ce que vous deviez protéger est resté intact.",
  },
  { id: "o-generic", slot: "opening", tags: [], template: "Votre mission touche à sa fin." },

  {
    id: "c-feu-mortvivant",
    slot: "climax",
    resultat: "victoire",
    cible: "individuel",
    tags: ["feu", "mort-vivant"],
    template: "Vous avez carbonisé {sujet}.",
  },
  {
    id: "c-feu-generic",
    slot: "climax",
    resultat: "victoire",
    cible: "individuel",
    tags: ["feu"],
    template: "Vos flammes ont eu raison de {sujet}.",
  },
  {
    id: "c-generic",
    slot: "climax",
    resultat: "victoire",
    cible: "individuel",
    tags: [],
    template: "Vous avez triomphé de {sujet}.",
  },

  {
    id: "g-feu",
    slot: "talentGrowth",
    requiresTalentGain: true,
    tags: ["feu"],
    template: "Vous sentez {talent} progresser en vous.",
  },
  {
    id: "g-generic",
    slot: "talentGrowth",
    requiresTalentGain: true,
    tags: [],
    template: "Une nouvelle maîtrise s'éveille en vous.",
  },
];

test("generateNarrative: composes opening + climax + talentGrowth in order, space-joined", () => {
  const context = { talentTags: ["feu"], questTags: [], talentGained: true, talentName: "Pyromancie" };

  const result = generateNarrative({ resultat: "victoire", cible: "individuel", context, subjects, verbPhrases });

  assert.equal(
    result,
    "Votre mission touche à sa fin. Vous avez carbonisé le squelette. Vous sentez Pyromancie progresser en vous."
  );
});

test("does not select a fragment when only some of its tags are present in context", () => {
  // Regression test for the POC bug: context only has "protection", not "village", so the
  // village-specific opening fragment must NOT be picked - the less-specific "protection"-only
  // fallback should be chosen instead.
  const context = { talentTags: [], questTags: ["protection"], talentGained: false };

  const result = generateNarrative({ resultat: "victoire", cible: "individuel", context, subjects, verbPhrases });

  assert.ok(result.startsWith("Ce que vous deviez protéger est resté intact."));
  assert.ok(!result.includes("Le village n'a pas perdu"));
});

test("talentGrowth fragments are never selected when context.talentGained is falsy, even if tags match", () => {
  const context = { talentTags: ["feu"], questTags: [], talentGained: false };

  const result = generateNarrative({ resultat: "victoire", cible: "individuel", context, subjects, verbPhrases });

  assert.ok(!result.includes("progresser en vous"));
  assert.ok(!result.includes("Une nouvelle maîtrise"));
});

test("generateNarrative returns null when climax has no match at all, even with opening/growth candidates", () => {
  const context = { talentTags: [], questTags: [], talentGained: true, talentName: "Pyromancie" };
  const noClimaxPhrases = verbPhrases.filter((v) => v.slot !== "climax");

  const result = generateNarrative({
    resultat: "victoire",
    cible: "individuel",
    context,
    subjects,
    verbPhrases: noClimaxPhrases,
  });

  assert.equal(result, null);
});

test("generateNarrative returns null when climax pool is entirely empty", () => {
  const context = { talentTags: [], questTags: [], talentGained: false };

  const result = generateNarrative({
    resultat: "victoire",
    cible: "individuel",
    context,
    subjects,
    verbPhrases: [],
  });

  assert.equal(result, null);
});
