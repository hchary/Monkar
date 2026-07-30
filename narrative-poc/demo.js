// Demonstration harness for the shipped narrative generator.
//
// It imports the *production* code - functions/src/textGeneration.js and partirEnQuete.js's
// buildNarrativeContext/narrateQuestSuccess - and only supplies sample content (src/data/catalog.js)
// in place of Firestore. Nothing about the generation logic is reimplemented here, so what this
// prints is what the game prints given the same catalog.
//
//   node demo.js              # human-readable run
//   node demo.js --markdown   # regenerates DEMO.md's body
//
// Math.random is seeded so both outputs are reproducible; the live game is of course unseeded.

const path = require("path");
const { buildNarrativeContext, narrateQuestSuccess } = require(
  path.join(__dirname, "..", "functions", "src", "actions", "partirEnQuete.js")
);
const { tags, subjects, verbPhrases, quests, talents } = require("./src/data/catalog");
const markov = require("./src/markovDemo");

const tagsByIdName = new Map(tags.map((t) => [t.id, t.name]));
const questById = new Map(quests.map((q) => [q.id, q]));
const talentById = new Map(talents.map((t) => [t.id, t]));

// A deterministic linear congruential generator, so a re-run produces the same document.
function seedRandom(seed) {
  let state = seed;
  Math.random = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Mirrors what rollTalentEvolutions returns for the talent that progressed, which is all
// buildNarrativeContext consumes of it.
function evolutionOf(talentId, kind) {
  const talent = talentById.get(talentId);
  return [{ talentId: talent.id, name: talent.name, kind, rarity: talent.rarity }];
}

function generate({ questId, talentId, talentChange, subjectIds }) {
  const quest = questById.get(questId);
  const talentEvolutions = talentId ? evolutionOf(talentId, talentChange) : [];
  const context = buildNarrativeContext({
    quest,
    locationName: quest.locationName,
    talents,
    nextTalents: talents,
    talentEvolutions,
    tagsByIdName,
  });

  // The quest's own objective pool, exactly as resolve() narrows it.
  const questObjectives = subjects.filter((s) => subjectIds.includes(s.id));
  const narrative = narrateQuestSuccess({
    quest: { ...quest, successPhraseIds: [] },
    questObjectives,
    narrativeSubjects: subjects,
    verbPhrases,
    context,
  });

  return narrative;
}

// Distinct outputs only: the point is to show the range a scenario can produce, not to pad the
// document with repeats of whichever fragment the RNG favored.
function samples(scenario, count) {
  const seen = new Map();
  for (let i = 0; i < count; i++) {
    const narrative = generate(scenario);
    if (narrative && !seen.has(narrative.text)) seen.set(narrative.text, narrative);
  }
  return [...seen.values()];
}

const SCENARIOS = [
  {
    title: "La cible de la demande d'analyse",
    blurb:
      "Un personnage doté d'un sort de feu, face à une armée de morts-vivants, pendant une quête de " +
      "protection de village, au cours de laquelle sa Pyromancie monte de rang. Toutes les dimensions " +
      "sont couvertes par du contenu écrit à la main pour ces combinaisons.",
    scenario: {
      questId: "q-vaubourg",
      talentId: "tal-pyromancie",
      talentChange: "evolution",
      subjectIds: ["sub-morts-vivants", "sub-liche"],
    },
  },
  {
    title: "Même personnage, talent débloqué au lieu d'amélioré",
    blurb:
      "Le même contexte, mais la Pyromancie vient d'apparaître au lieu de progresser : la phrase de " +
      "clôture change de sens, elle ne peut pas parler d'un talent « plus fort que jamais ».",
    scenario: {
      questId: "q-vaubourg",
      talentId: "tal-pyromancie",
      talentChange: "unlock",
      subjectIds: ["sub-morts-vivants", "sub-liche"],
    },
  },
  {
    title: "Un escrimeur sur la même quête",
    blurb:
      "Rien n'a changé sauf le talent qui a progressé. L'ouverture reste celle du village, l'action et " +
      "la clôture basculent entièrement sur la lame.",
    scenario: {
      questId: "q-vaubourg",
      talentId: "tal-escrime",
      talentChange: "evolution",
      subjectIds: ["sub-bandits", "sub-chef-bandits"],
    },
  },
  {
    title: "Escorte de caravane : le garde-fou du sous-ensemble",
    blurb:
      "La quête est taguée « protection » mais pas « village ». L'ouverture spécifique au village " +
      "partage un tag avec le contexte et doit malgré tout rester dehors — c'est le bug trouvé en " +
      "construisant le POC (report.md § 2.1), et la raison pour laquelle un fragment n'est retenu que " +
      "si *tous* ses tags sont satisfaits.",
    scenario: {
      questId: "q-caravane",
      talentId: "tal-escrime",
      talentChange: "evolution",
      subjectIds: ["sub-bandits", "sub-chef-bandits"],
    },
  },
  {
    title: "Une combinaison que personne n'a écrite : dégradation",
    blurb:
      "Un talent de furtivité en forêt contre un ours. Il n'existe aucun fragment « furtivité × bête » " +
      "ni aucune clôture « furtivité » : le moteur retombe sur du générique correct mais visiblement " +
      "plus plat. C'est la limite structurelle décrite en report.md § 1, pas un défaut d'exécution.",
    scenario: {
      questId: "q-sylve",
      talentId: "tal-marche-silencieuse",
      talentChange: "evolution",
      subjectIds: ["sub-ours", "sub-loups"],
    },
  },
  {
    title: "Aucun talent n'a progressé",
    blurb:
      "La quête se résout sans progression : la phrase de clôture disparaît complètement au lieu " +
      "d'annoncer un progrès qui n'a pas eu lieu, et le récit se réduit à deux phrases.",
    scenario: {
      questId: "q-tumulus",
      talentId: null,
      talentChange: null,
      subjectIds: ["sub-morts-vivants", "sub-liche"],
    },
  },
  {
    title: "Un mage sur les tumulus",
    blurb:
      "Une quête sans tag du tout : seuls les tags de la cible et du talent alimentent la sélection, ce " +
      "qui suffit à obtenir une action spécifique « magie × mort-vivant ».",
    scenario: {
      questId: "q-tumulus",
      talentId: "tal-pyromancie",
      talentChange: "evolution",
      subjectIds: ["sub-liche", "sub-morts-vivants"],
    },
  },
];

function runText() {
  for (const { title, scenario } of SCENARIOS) {
    console.log(`\n=== ${title} ===`);
    for (const narrative of samples(scenario, 60)) {
      console.log(`  - ${narrative.text}`);
    }
  }

  console.log("\n=== Clause réutilisée dans les descriptions de butin ===");
  const narrative = generate(SCENARIOS[0].scenario);
  console.log(`  paragraphe : ${narrative.text}`);
  console.log(`  butin      : [Obtenue lorsque ${narrative.clause}]`);

  console.log("\n=== Alternative statistique non-LLM (chaîne de Markov), pour contraste ===");
  markov.demo();
}

function runMarkdown() {
  console.log("<!-- Generated by `node narrative-poc/demo.js --markdown`. Do not edit by hand. -->");
  for (const { title, blurb, scenario } of SCENARIOS) {
    console.log(`\n## ${title}\n`);
    console.log(`${blurb}\n`);
    for (const narrative of samples(scenario, 60)) {
      console.log(`> ${narrative.text}\n`);
    }
  }

  const narrative = generate(SCENARIOS[0].scenario);
  console.log("\n## La même génération, réutilisée dans une description de butin\n");
  console.log(
    "Le moteur renvoie deux formes du même tirage : le paragraphe affiché au joueur, et la seule " +
      "phrase d'action, sans majuscule ni ponctuation finale, pour les endroits où l'accomplissement " +
      "doit s'insérer au milieu d'une autre phrase.\n"
  );
  console.log(`- Paragraphe : ${narrative.text}`);
  console.log(`- Description de butin : \`[Obtenue lorsque ${narrative.clause}]\``);
}

seedRandom(20260730);
if (process.argv.includes("--markdown")) runMarkdown();
else runText();
