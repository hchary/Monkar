const { generateVictoryNarrative } = require("./src/grammarEngine");
const fragments = require("./src/data/fragments");
const { enemies, lieux } = require("./src/data/subjects");
const markov = require("./src/markovDemo");

function findBy(list, id) {
  return list.find((x) => x.id === id);
}

function run(label, ctx, times = 3) {
  console.log(`\n=== ${label} ===`);
  for (let i = 0; i < times; i++) {
    console.log(`  ${i + 1}. ${generateVictoryNarrative(ctx, fragments)}`);
  }
}

// Scenario 1: the motivating example from the analysis request - a fire talent (Pyromancie),
// an undead army, a village-protection quest, talent rank-up. Fully covered by authored tags.
run("Pyromancer vs undead horde, protecting a village (fully covered by tags)", {
  enemy: findBy(enemies, "morts-vivants"),
  lieu: findBy(lieux, "village"),
  talentTags: ["feu", "magie"],
  questTags: ["protection", "village"],
  talentGained: true,
  talentName: "votre Pyromancie",
});

// Scenario 2: same character archetype (fire talent) but against an enemy/quest combination
// that has no specific authored fragment (no "feu" x "bete" climax template exists) - shows
// the engine gracefully degrading to the generic fallback instead of failing.
run("Same fire talent, but vs a lone giant wolf (no matching specific content - fallback)", {
  enemy: findBy(enemies, "loup-geant"),
  lieu: findBy(lieux, "village"),
  talentTags: ["feu", "magie"],
  questTags: [],
  talentGained: true,
  talentName: "votre Pyromancie",
});

// Scenario 3: a blade-focused character, bandits, no talent gain this time.
run("Swordsman vs bandits, escorting a caravan, no talent rank-up this time", {
  enemy: findBy(enemies, "bandits"),
  lieu: findBy(lieux, "caravane"),
  talentTags: ["lame"],
  questTags: ["protection"],
  talentGained: false,
});

// Contrast: a small Markov chain trained on the project's own narrative sentences, with no
// notion of tags/context at all.
console.log("\n=== Non-LLM statistical alternative (Markov chain), for contrast ===");
markov.demo();
