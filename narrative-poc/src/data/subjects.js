// Sample "narrativeSubjects"-style data, same shape as worldData/narrativeSubjects/items.
// Extended here only with the `tags` the grammar engine matches against context.

const enemies = [
  {
    id: "morts-vivants",
    type: "groupe",
    article: "les",
    nom: "hordes de morts-vivants",
    genre: "f",
    nombre: "pluriel",
    tags: ["mort-vivant", "hostile", "groupe"],
  },
  {
    id: "bandits",
    type: "groupe",
    article: "les",
    nom: "bandits du col",
    genre: "m",
    nombre: "pluriel",
    tags: ["humanoide", "hostile", "groupe"],
  },
  {
    id: "loup-geant",
    type: "individuel",
    article: "le",
    nom: "loup géant",
    genre: "m",
    nombre: "singulier",
    tags: ["bete", "hostile", "individuel"],
  },
];

const lieux = [
  { id: "village", article: "le", nom: "village", genre: "m", tags: ["village", "protection"] },
  { id: "caravane", article: "la", nom: "caravane marchande", genre: "f", tags: ["protection"] },
];

module.exports = { enemies, lieux };
