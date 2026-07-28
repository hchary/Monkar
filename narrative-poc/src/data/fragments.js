// Narrative fragments, grouped by "slot" (the role a sentence plays in the final paragraph).
// This is the extension point of the POC: `worldData/verbPhrases` today holds ONE flat pool
// used for a single sentence. Here each slot is its own tagged pool, and a paragraph is
// assembled by picking one fragment per slot, filtered/scored against the runtime context's
// tags (character talent tags, enemy tags, quest tags, weapon tags, ...).
//
// `tags: []` fragments are deliberately generic - they are the fallback that keeps the slot
// non-empty when no authored content matches the specific combination of tags in play.
// The report explains why that fallback is doing a lot of the load-bearing work.

const opening = [
  {
    id: "o-protect-village",
    tags: ["protection", "village"],
    template: "{lieuCap} n'a pas perdu une seule planche grâce à vous.",
  },
  {
    id: "o-protect-generic",
    tags: ["protection"],
    template: "Ce que vous deviez protéger est resté intact jusqu'au bout.",
  },
  {
    id: "o-generic",
    tags: [],
    template: "Votre mission touche à sa fin.",
  },
];

const climax = [
  {
    id: "c-feu-mortvivant",
    tags: ["feu", "mort-vivant"],
    template:
      "La magie vous a envahi comme rarement et, d'un geste, d'une incantation, vous avez carbonisé {sujet}.",
  },
  {
    id: "c-feu-generic",
    tags: ["feu"],
    template: "Vos flammes ont eu raison de {sujet}.",
  },
  {
    id: "c-lame-generic",
    tags: ["lame"],
    template: "Votre lame a tranché {sujet} sans relâche jusqu'à la victoire.",
  },
  {
    id: "c-generic",
    tags: [],
    template: "Vous avez triomphé de {sujet} au terme d'un combat acharné.",
  },
];

const talentGrowth = [
  {
    id: "g-feu",
    tags: ["feu"],
    requiresTalentGain: true,
    template: "Depuis, vous sentez que le feu gronde en vous, plus fort que jamais.",
  },
  {
    id: "g-lame",
    tags: ["lame"],
    requiresTalentGain: true,
    template: "Votre maîtrise de la lame n'a jamais été aussi affûtée.",
  },
  {
    id: "g-generic",
    tags: [],
    requiresTalentGain: true,
    template: "Vous sentez {talent} progresser en vous.",
  },
];

module.exports = { opening, climax, talentGrowth };
