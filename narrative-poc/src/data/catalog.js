// A sample content catalog in the exact shapes the live game stores, so the demo exercises the
// production engine with nothing bespoke about it:
//   - `tags`      -> worldData/tags/items          (id-keyed label catalog)
//   - `subjects`  -> worldData/narrativeSubjects/items (free-text `tags`)
//   - `verbPhrases` -> worldData/verbPhrases/items    (slot / resultat / cible / tags / talentChange)
//   - `quests`    -> worldData/quests/items         (tagIds)
//   - `talents`   -> worldData/talents/items        (tagIds)
//
// It is deliberately small - a few dozen fragments - because that is the honest scale of what a
// creator authors in a first pass. See report.md § 1 on why coverage, not machinery, is the
// limiting factor on output quality.

const tags = [
  { id: "tag-feu", name: "feu" },
  { id: "tag-magie", name: "magie" },
  { id: "tag-lame", name: "lame" },
  { id: "tag-furtivite", name: "furtivité" },
  { id: "tag-protection", name: "protection" },
  { id: "tag-village", name: "village" },
  { id: "tag-foret", name: "forêt" },
];

const subjects = [
  {
    id: "sub-morts-vivants",
    type: "groupe",
    article: "les",
    nom: "hordes de morts-vivants",
    genre: "f",
    nombre: "pluriel",
    tags: ["mort-vivant", "hostile"],
  },
  {
    id: "sub-bandits",
    type: "groupe",
    article: "les",
    nom: "bandits du col",
    genre: "m",
    nombre: "pluriel",
    tags: ["humanoïde", "hostile"],
  },
  {
    id: "sub-loups",
    type: "groupe",
    article: "les",
    nom: "loups affamés",
    genre: "m",
    nombre: "pluriel",
    tags: ["bête", "hostile", "forêt"],
  },
  {
    id: "sub-liche",
    type: "individuel",
    article: "la",
    nom: "liche du tumulus",
    genre: "f",
    nombre: "singulier",
    tags: ["mort-vivant", "hostile", "magie"],
  },
  {
    id: "sub-chef-bandits",
    type: "individuel",
    article: "le",
    nom: "chef des bandits",
    genre: "m",
    nombre: "singulier",
    tags: ["humanoïde", "hostile"],
  },
  {
    id: "sub-ours",
    type: "individuel",
    article: "l'",
    nom: "ours des cavernes",
    genre: "m",
    nombre: "singulier",
    tags: ["bête", "hostile", "forêt"],
  },
];

// Authored without a leading capital and without a final period: the engine presents them as
// sentences, and reuses the action clause mid-sentence in loot descriptions.
const verbPhrases = [
  // --- Ouverture (mise en place) -------------------------------------------------------------
  {
    id: "op-village",
    slot: "opening",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["protection", "village"],
    template: "{lieu} n'a pas perdu une seule planche grâce à vous",
  },
  {
    id: "op-protection",
    slot: "opening",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["protection"],
    template: "ce que vous étiez venu défendre a tenu bon jusqu'au bout",
  },
  {
    id: "op-foret",
    slot: "opening",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["forêt"],
    template: "la forêt s'est refermée derrière vous dès les premiers pas",
  },
  {
    id: "op-mort-vivant",
    slot: "opening",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["mort-vivant"],
    template: "on murmurait depuis des jours que les morts de {lieu} ne dormaient plus",
  },
  {
    id: "op-groupe",
    slot: "opening",
    resultat: "victoire",
    cible: "groupe",
    tags: [],
    template: "{sujet} étaient plus nombreux que vous ne l'aviez craint",
  },
  {
    id: "op-generic",
    slot: "opening",
    resultat: "victoire",
    cible: "les_deux",
    tags: [],
    template: "« {quete} » : voilà ce qu'on vous avait promis, et voilà ce que vous avez trouvé",
  },

  // --- Action (climax) -----------------------------------------------------------------------
  {
    id: "cl-feu-mortvivant",
    slot: "climax",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["feu", "mort-vivant"],
    template:
      "la magie vous a envahi comme rarement et, d'un geste, d'une incantation, vous avez carbonisé {sujet}",
  },
  {
    id: "cl-feu",
    slot: "climax",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["feu"],
    template: "vos flammes ont eu raison de {sujet}",
  },
  {
    id: "cl-magie-mortvivant",
    slot: "climax",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["magie", "mort-vivant"],
    template: "vous avez brisé le lien qui retenait {sujet} de ce côté-ci du monde",
  },
  {
    id: "cl-lame-groupe",
    slot: "climax",
    resultat: "victoire",
    cible: "groupe",
    tags: ["lame", "humanoïde"],
    template: "votre lame a trouvé chaque défaut d'armure, et {sujet} ont rompu avant vous",
  },
  {
    id: "cl-lame-individuel",
    slot: "climax",
    resultat: "victoire",
    cible: "individuel",
    tags: ["lame"],
    template: "votre lame a fait le reste : {sujet} n'a plus tenu debout très longtemps",
  },
  {
    id: "cl-furtivite",
    slot: "climax",
    resultat: "victoire",
    cible: "individuel",
    tags: ["furtivité"],
    template: "vous n'avez pas eu besoin de vous battre : {sujet} ne vous a jamais vu venir",
  },
  {
    id: "cl-bete",
    slot: "climax",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["bête"],
    template: "vous avez épuisé {sujet} avant de porter le coup décisif",
  },
  {
    id: "cl-generic-groupe",
    slot: "climax",
    resultat: "victoire",
    cible: "groupe",
    tags: [],
    template: "vous avez dispersé {sujet} jusqu'au dernier",
  },
  {
    id: "cl-generic",
    slot: "climax",
    resultat: "victoire",
    cible: "les_deux",
    tags: [],
    template: "vous avez triomphé de {sujet} au terme d'un combat acharné",
  },

  // --- Progression de talent -----------------------------------------------------------------
  {
    id: "gr-feu-evolution",
    slot: "talentGrowth",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["feu"],
    talentChange: "evolution",
    template: "depuis, vous sentez que le feu gronde en vous, plus fort que jamais",
  },
  {
    id: "gr-feu-unlock",
    slot: "talentGrowth",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["feu"],
    talentChange: "unlock",
    template: "et dans les braises, quelque chose vous a répondu : la {talent} venait de s'éveiller",
  },
  {
    id: "gr-lame",
    slot: "talentGrowth",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["lame"],
    talentChange: "les_deux",
    template: "votre {talent} n'a jamais été aussi affûtée",
  },
  {
    id: "gr-magie",
    slot: "talentGrowth",
    resultat: "victoire",
    cible: "les_deux",
    tags: ["magie"],
    talentChange: "les_deux",
    template: "quelque chose s'est déplacé en vous, et votre {talent} en garde la trace",
  },
  {
    id: "gr-generic-evolution",
    slot: "talentGrowth",
    resultat: "victoire",
    cible: "les_deux",
    tags: [],
    talentChange: "evolution",
    template: "vous sentez votre {talent} progresser en vous",
  },
  {
    id: "gr-generic-unlock",
    slot: "talentGrowth",
    resultat: "victoire",
    cible: "les_deux",
    tags: [],
    talentChange: "unlock",
    template: "vous vous découvrez un don que vous ne soupçonniez pas : {talent}",
  },
];

const quests = [
  { id: "q-vaubourg", name: "Le siège de Vaubourg", tagIds: ["tag-protection", "tag-village"], locationName: "Vaubourg" },
  { id: "q-caravane", name: "L'escorte de la caravane", tagIds: ["tag-protection"], locationName: "la route du Sel" },
  { id: "q-tumulus", name: "Les tumulus de la lande", tagIds: [], locationName: "la lande grise" },
  { id: "q-sylve", name: "La battue en Sylve noire", tagIds: ["tag-foret"], locationName: "la Sylve noire" },
];

const talents = [
  { id: "tal-pyromancie", name: "Pyromancie", rarity: "rare", tagIds: ["tag-feu", "tag-magie"] },
  { id: "tal-escrime", name: "Escrime", rarity: "commun", tagIds: ["tag-lame"] },
  { id: "tal-marche-silencieuse", name: "Marche silencieuse", rarity: "peu_commun", tagIds: ["tag-furtivite"] },
];

module.exports = { tags, subjects, verbPhrases, quests, talents };
