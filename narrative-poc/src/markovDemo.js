// Contrast demo: a tiny order-2 word Markov chain, trained on a handful of hand-written
// narrative sentences (the game's own kind of content). This stands in for "a statistical
// model, but not an LLM, trained on our own small corpus" - the other non-LLM avenue besides
// the tag-scored grammar in grammarEngine.js.
//
// It is included specifically to demonstrate the failure mode discussed in the report: with
// a corpus this small (a few dozen to a few hundred authored sentences is realistic for this
// project), a Markov chain has no notion of the game's tag/context model at all and produces
// grammatically-plausible but semantically incoherent or self-contradictory text.

const corpus = [
  "Les hordes de morts-vivants n'ont pas touché à une seule planche du village grâce à vous.",
  "La magie vous a envahi comme rarement et d'un geste vous avez carbonisé l'armée morbide.",
  "Depuis, vous sentez que le feu gronde en vous, plus fort que jamais.",
  "Une embuscade te laisse pour mort au bord du chemin.",
  "La quête tourne court, tu rentres blessé.",
  "Votre réputation et vos compétences grandissent, vous avez bien mérité de vous reposer.",
  "Un exploit dont on parlera dans toutes les tavernes de la région !",
  "Vos flammes ont eu raison des bandits du col.",
  "Votre lame a tranché le loup géant sans relâche jusqu'à la victoire.",
];

function tokenize(sentence) {
  return sentence.split(/\s+/);
}

function buildChain(sentences, order = 2) {
  const chain = new Map();
  for (const sentence of sentences) {
    const tokens = ["<START>", ...tokenize(sentence), "<END>"];
    for (let i = 0; i + order < tokens.length; i++) {
      const key = tokens.slice(i, i + order).join(" ");
      const next = tokens[i + order];
      if (!chain.has(key)) chain.set(key, []);
      chain.get(key).push(next);
    }
  }
  return chain;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function generate(chain, order = 2, maxWords = 30) {
  let key = "<START> " + pickRandom([...chain.keys()].filter((k) => k.startsWith("<START>"))).split(" ")[1];
  const words = key.split(" ").slice(1);
  for (let i = 0; i < maxWords; i++) {
    const options = chain.get(key);
    if (!options) break;
    const next = pickRandom(options);
    if (next === "<END>") break;
    words.push(next);
    key = key.split(" ").slice(1).concat(next).join(" ");
  }
  return words.join(" ");
}

function demo() {
  const chain = buildChain(corpus, 2);
  console.log("Markov chain (order 2) trained on", corpus.length, "sentences from this project's own style:\n");
  for (let i = 0; i < 5; i++) {
    console.log(`  - ${generate(chain, 2)}`);
  }
}

module.exports = { demo, buildChain, generate };

if (require.main === module) demo();
