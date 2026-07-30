const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { contractDe, fillSubjectPlaceholder, generateNarrative } = require("./textGeneration");

const MORTS_VIVANTS = {
  id: "morts-vivants",
  type: "groupe",
  article: "les",
  nom: "hordes de morts-vivants",
  genre: "f",
  nombre: "pluriel",
  tags: ["mort-vivant", "hostile"],
};

const BANDITS = {
  id: "bandits",
  type: "groupe",
  article: "les",
  nom: "bandits du col",
  genre: "m",
  nombre: "pluriel",
  tags: ["humanoide", "hostile"],
};

const LOUP = {
  id: "loup-geant",
  type: "individuel",
  article: "le",
  nom: "loup géant",
  genre: "m",
  nombre: "singulier",
  tags: ["bete", "hostile"],
};

// Mirrors the shape of worldData/verbPhrases/items documents.
function phrase(overrides) {
  return { resultat: "victoire", cible: "les_deux", template: "", ...overrides };
}

const GENERIC_CLIMAX = phrase({ id: "c-generic", template: "vous avez triomphé de {sujet}" });

describe("contractDe", () => {
  test("contracts de + le/les and leaves la/l' alone", () => {
    assert.equal(contractDe({ article: "le", nom: "chef" }), "du chef");
    assert.equal(contractDe({ article: "les", nom: "bandits" }), "des bandits");
    assert.equal(contractDe({ article: "la", nom: "sorcière" }), "de la sorcière");
  });

  test("glues an elided article to its noun instead of leaving a space", () => {
    assert.equal(contractDe({ article: "l'", nom: "ogre" }), "de l'ogre");
    assert.equal(fillSubjectPlaceholder("vous avez chassé {sujet}", { article: "l'", nom: "ogre" }), "vous avez chassé l'ogre");
  });

  test("rejects an unknown article rather than silently mis-agreeing", () => {
    assert.throws(() => contractDe({ article: "des", nom: "bandits" }), /Unknown subject article/);
  });
});

describe("fillSubjectPlaceholder", () => {
  test("uses the contraction after 'de' and the plain article otherwise", () => {
    assert.equal(fillSubjectPlaceholder("vous avez triomphé de {sujet}", BANDITS), "vous avez triomphé des bandits du col");
    assert.equal(fillSubjectPlaceholder("vous avez carbonisé {sujet}", BANDITS), "vous avez carbonisé les bandits du col");
  });

  test("substitutes every occurrence, in either form", () => {
    assert.equal(
      fillSubjectPlaceholder("{sujet} vous fuyaient, et vous avez eu raison de {sujet}", BANDITS),
      "les bandits du col vous fuyaient, et vous avez eu raison des bandits du col"
    );
  });
});

describe("generateNarrative slot composition", () => {
  const verbPhrases = [
    phrase({ id: "o", slot: "opening", template: "votre mission touche à sa fin" }),
    GENERIC_CLIMAX,
    phrase({ id: "g", slot: "talentGrowth", template: "vous sentez votre {talent} progresser en vous" }),
  ];

  test("joins opening, climax and talentGrowth in that order, as capitalized sentences", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases,
      context: { talentChange: "evolution", talentName: "Pyromancie" },
    });

    assert.equal(
      result.text,
      "Votre mission touche à sa fin. Vous avez triomphé des bandits du col. Vous sentez votre Pyromancie progresser en vous."
    );
  });

  test("exposes the climax alone as an embeddable clause, uncapitalized and unpunctuated", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases,
      context: { talentChange: "evolution", talentName: "Pyromancie" },
    });

    assert.equal(result.clause, "vous avez triomphé des bandits du col");
    assert.equal(`[Obtenue lorsque ${result.clause}]`, "[Obtenue lorsque vous avez triomphé des bandits du col]");
  });

  test("keeps author-supplied terminal punctuation instead of adding a second one", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases: [phrase({ template: "vous avez écrasé {sujet} !" })],
    });

    assert.equal(result.text, "Vous avez écrasé les bandits du col !");
    // The clause drops the mark *and* the French space in front of it, so it can be embedded
    // mid-sentence without a stray double space.
    assert.equal(result.clause, "vous avez écrasé les bandits du col");
  });

  test("degrades to the climax alone when no opening or growth fragment exists", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases: [GENERIC_CLIMAX],
      context: { talentChange: "evolution", talentName: "Pyromancie" },
    });

    assert.equal(result.text, "Vous avez triomphé des bandits du col.");
  });

  test("treats a verb phrase with no slot as climax content, so a pre-slots catalog still generates", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases: [phrase({ template: "vous avez triomphé de {sujet}" })],
    });

    assert.equal(result.text, "Vous avez triomphé des bandits du col.");
  });
});

describe("generateNarrative fragment selection", () => {
  test("prefers the most specific fragment whose tags are all satisfied", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [MORTS_VIVANTS],
      verbPhrases: [
        GENERIC_CLIMAX,
        phrase({ tags: ["feu"], template: "vos flammes ont eu raison de {sujet}" }),
        phrase({
          tags: ["feu", "mort-vivant"],
          template: "d'un geste, d'une incantation, vous avez carbonisé {sujet}",
        }),
      ],
      context: { talentTags: ["feu", "magie"] },
    });

    assert.equal(result.text, "D'un geste, d'une incantation, vous avez carbonisé les hordes de morts-vivants.");
  });

  test("REGRESSION: a partially-overlapping context must not select a more specific fragment", () => {
    // The caravan/village case from narrative-poc/report.md: the quest is tagged "protection" but
    // not "village", so the village-specific opening must stay out even though it shares a tag.
    const verbPhrases = [
      phrase({ id: "o-village", slot: "opening", tags: ["protection", "village"], template: "{lieu} n'a pas perdu une seule planche grâce à vous" }),
      phrase({ id: "o-generic", slot: "opening", tags: [], template: "votre mission touche à sa fin" }),
      GENERIC_CLIMAX,
    ];

    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases,
      context: { questTags: ["protection"], locationName: "la caravane marchande" },
    });

    assert.equal(result.text, "Votre mission touche à sa fin. Vous avez triomphé des bandits du col.");

    // ...and the same fragment IS selected once "village" is genuinely in the context.
    const village = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases,
      context: { questTags: ["protection", "village"], locationName: "le village de Vaubourg" },
    });

    assert.equal(
      village.text,
      "Le village de Vaubourg n'a pas perdu une seule planche grâce à vous. Vous avez triomphé des bandits du col."
    );
  });

  test("picks the subject and the climax as a pair, so every slot talks about the same enemy", () => {
    // Only the undead subject can satisfy the specific climax; the engine must pick it rather than
    // opening on one enemy and climaxing on another.
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS, MORTS_VIVANTS],
      verbPhrases: [
        GENERIC_CLIMAX,
        phrase({ tags: ["mort-vivant"], template: "vous avez carbonisé {sujet}" }),
        phrase({ slot: "opening", tags: ["mort-vivant"], template: "{sujet} avançaient sans un bruit" }),
      ],
      context: {},
    });

    assert.equal(
      result.text,
      "Les hordes de morts-vivants avançaient sans un bruit. Vous avez carbonisé les hordes de morts-vivants."
    );
  });

  test("only offers subjects matching the drawn cible", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "individuel",
      subjects: [BANDITS, LOUP],
      verbPhrases: [GENERIC_CLIMAX],
    });

    assert.equal(result.text, "Vous avez triomphé du loup géant.");
  });

  test("honors cible on every slot, so an opening can agree with the enemy's number", () => {
    // An opening that mentions {sujet} has to agree with it: "les loups approchaient" can't be
    // reused for a lone wolf. Declaring a cible on a non-climax slot is what makes that possible.
    const verbPhrases = [
      phrase({ cible: "groupe", template: "vous avez dispersé {sujet}" }),
      phrase({ cible: "individuel", template: "vous avez abattu {sujet}" }),
      phrase({ slot: "opening", cible: "groupe", template: "{sujet} approchaient en nombre" }),
      phrase({ slot: "opening", cible: "individuel", template: "{sujet} chassait seul" }),
    ];

    const alone = generateNarrative({ resultat: "victoire", cible: "individuel", subjects: [LOUP], verbPhrases });
    assert.equal(alone.text, "Le loup géant chassait seul. Vous avez abattu le loup géant.");

    const pack = generateNarrative({ resultat: "victoire", cible: "groupe", subjects: [BANDITS], verbPhrases });
    assert.equal(pack.text, "Les bandits du col approchaient en nombre. Vous avez dispersé les bandits du col.");
  });

  test("a 'les_deux' opening is used whichever shape was drawn", () => {
    const verbPhrases = [
      GENERIC_CLIMAX,
      phrase({ slot: "opening", cible: "les_deux", template: "le calme est revenu" }),
    ];

    for (const [cible, subject, expected] of [
      ["groupe", BANDITS, "Le calme est revenu. Vous avez triomphé des bandits du col."],
      ["individuel", LOUP, "Le calme est revenu. Vous avez triomphé du loup géant."],
    ]) {
      assert.equal(generateNarrative({ resultat: "victoire", cible, subjects: [subject], verbPhrases }).text, expected);
    }
  });

  test("drops a fragment whose placeholder has no value instead of showing the raw placeholder", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases: [
        phrase({ slot: "opening", template: "{lieu} peut respirer" }),
        phrase({ slot: "opening", template: "le calme est revenu" }),
        GENERIC_CLIMAX,
      ],
      context: {},
    });

    assert.equal(result.text, "Le calme est revenu. Vous avez triomphé des bandits du col.");
    assert.ok(!result.text.includes("{"));
  });

  test("filters by resultat across every slot", () => {
    const result = generateNarrative({
      resultat: "echec",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases: [
        phrase({ resultat: "victoire", slot: "opening", template: "le calme est revenu" }),
        phrase({ resultat: "echec", slot: "opening", template: "tout est allé de travers" }),
        phrase({ resultat: "echec", template: "vous avez fui devant {sujet}" }),
        GENERIC_CLIMAX,
      ],
    });

    assert.equal(result.text, "Tout est allé de travers. Vous avez fui devant les bandits du col.");
  });
});

describe("generateNarrative talent growth gating", () => {
  const growth = phrase({ slot: "talentGrowth", template: "vous sentez votre {talent} progresser en vous" });

  test("never selects a talentGrowth fragment when nothing changed this resolution", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases: [GENERIC_CLIMAX, growth],
      context: { talentName: "Pyromancie" },
    });

    assert.equal(result.text, "Vous avez triomphé des bandits du col.");
  });

  test("matches an evolution-only fragment on an evolution, not on an unlock", () => {
    const verbPhrases = [
      GENERIC_CLIMAX,
      phrase({ slot: "talentGrowth", talentChange: "evolution", template: "votre {talent} n'a jamais été aussi affûtée" }),
      phrase({ slot: "talentGrowth", talentChange: "unlock", template: "vous vous découvrez un don pour la {talent}" }),
    ];
    const context = { talentName: "Pyromancie" };

    const evolved = generateNarrative({ resultat: "victoire", cible: "groupe", subjects: [BANDITS], verbPhrases, context: { ...context, talentChange: "evolution" } });
    assert.equal(evolved.text, "Vous avez triomphé des bandits du col. Votre Pyromancie n'a jamais été aussi affûtée.");

    const unlocked = generateNarrative({ resultat: "victoire", cible: "groupe", subjects: [BANDITS], verbPhrases, context: { ...context, talentChange: "unlock" } });
    assert.equal(unlocked.text, "Vous avez triomphé des bandits du col. Vous vous découvrez un don pour la Pyromancie.");
  });

  test("uses a talentChange-agnostic fragment for either kind of change", () => {
    const verbPhrases = [GENERIC_CLIMAX, phrase({ slot: "talentGrowth", talentChange: "les_deux", template: "vous sentez votre {talent} vibrer" })];

    for (const talentChange of ["evolution", "unlock"]) {
      const result = generateNarrative({
        resultat: "victoire",
        cible: "groupe",
        subjects: [BANDITS],
        verbPhrases,
        context: { talentChange, talentName: "Pyromancie" },
      });
      assert.equal(result.text, "Vous avez triomphé des bandits du col. Vous sentez votre Pyromancie vibrer.");
    }
  });
});

describe("generateNarrative fallback to the caller's own text", () => {
  test("returns null when the catalog has no climax content at all", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases: [phrase({ slot: "opening", template: "le calme est revenu" })],
    });

    assert.equal(result, null);
  });

  test("returns null when no subject matches the drawn cible", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [LOUP],
      verbPhrases: [GENERIC_CLIMAX],
    });

    assert.equal(result, null);
  });

  test("returns null when every climax requires a tag the context lacks", () => {
    const result = generateNarrative({
      resultat: "victoire",
      cible: "groupe",
      subjects: [BANDITS],
      verbPhrases: [phrase({ tags: ["mort-vivant"], template: "vous avez carbonisé {sujet}" })],
      context: {},
    });

    assert.equal(result, null);
  });
});
