// Canonical contract for `worldData/lootTables/items/{tableId}`: a weighted pool of objects an
// action can draw from. Selected by matching the table's rarity and tagIds against the action's
// (recolte: actionType.rarity + actionType.lootTagIds; partirEnQuete: the objective's rarity plus
// the quest/objective tagIds), then drawn from by functions/src/lib/loot.js's drawLootTableItemId -
// mirrored client-side in src/lib/lootTables.js.
//
// Authored through src/components/creator/TablesDeTirageManager.jsx, which writes the whole
// document with setDoc.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Table display name. Snapshotted as `tableName` on each loot entry." },
  rarity: {
    type: "string",
    description:
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | " +
      "unique. Matched EXACTLY against the drawing action's rarity - there is no fallback to a nearby tier.",
  },
  tagIds: {
    type: "array",
    description:
      "[string] ids in worldData/tags/items. Matched by OVERLAP (not subset) against the action's loot tags.",
  },
  itemIds: {
    type: "array",
    description: "[string] ids in worldData/objects/items - the pool drawn from.",
  },
  weightMode: {
    type: "string",
    description:
      "\"uniforme\" (every item equally likely, itemWeights ignored) | \"manuelle\" (draw weighted by " +
      "itemWeights).",
  },
  itemWeights: {
    type: "map",
    description:
      "{ [objectId]: number } used only when weightMode is \"manuelle\"; written as {} otherwise, and its " +
      "keys are kept in step with itemIds by the creator form. The form requires each weight in [1,100] " +
      "and the set to sum to 100, but that is client-side only - the server draw defensively falls back " +
      "to a uniform pick when the weights don't total above zero.",
  },
};

const DEFAULTS = {
  rarity: "commun",
  tagIds: [],
  itemIds: [],
  weightMode: "uniforme",
  itemWeights: {},
};

module.exports = { FIELDS, DEFAULTS };
