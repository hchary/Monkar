// Canonical contract for `worldData/recettes/items/{recetteId}`: a crafting recipe resolved by the
// "artisanat" action handler (functions/src/actions/artisanat.js), which consumes one Instance per
// unit of each ingredient and creates one Instance per unit of each result. Authored through
// src/components/creator/RecettesManager.jsx, which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Recipe display name." },
  rarity: {
    type: "string",
    description:
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | unique.",
  },
  categoryIds: {
    type: "array",
    description:
      "[string] ids in worldData/tags/items, used as categories rather than free tags: a crafting " +
      "actionType's recipeCategoryIds selects which recipes it can make.",
  },
  tagIds: { type: "array", description: "[string] ids in worldData/tags/items - descriptive tags." },
  ingredients: {
    type: "array",
    description:
      "[{ objectId, qty }] consumed on craft. objectId is an id in worldData/objects/items; qty is a " +
      "positive integer, and the character must own that many Instances of it.",
  },
  results: {
    type: "array",
    description: "[{ objectId, qty }] produced on craft, same shape as ingredients.",
  },
};

const DEFAULTS = {
  rarity: "commun",
  categoryIds: [],
  tagIds: [],
  ingredients: [],
  results: [],
};

module.exports = { FIELDS, DEFAULTS };
