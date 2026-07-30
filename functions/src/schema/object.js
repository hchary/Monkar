// Canonical contract for `worldData/objects/items/{objectId}`: the catalog entry for an item type -
// the "what it is", as opposed to the `instances` collection's "the one this character owns" (see
// schema/instance.js). Referenced by objectId from instances, recette ingredients/results,
// lootTable.itemIds and origin.startingItemIds.
//
// Authored through src/components/creator/ObjectsManager.jsx (single form, plus a bulk
// prefix/suffix generator), which writes the whole document with setDoc and, on delete, prunes the
// object's id out of every lootTable and recette referencing it.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Object display name." },
  description: {
    type: "string",
    description:
      "Free-text copy. Copied onto each Instance at acquisition, where handlers may append the clause " +
      "that describes how it was obtained.",
  },
  rarity: {
    type: "string",
    description:
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | " +
      "unique. Also what a lootTable's own rarity is matched against when drawing.",
  },
  type: {
    type: "string",
    description:
      "One of OBJECT_TYPES (src/components/creator/ObjectsManager.jsx): arme | armure | consommable | " +
      "composant | ingredient | grimoire | parchemin | objet_magique | titre_propriete | vetement. " +
      "A fixed catalog in JS - there is no creator UI to add types.",
  },
  tagIds: {
    type: "array",
    description:
      "[string] ids in worldData/tags/items. Drive the inventory filters and the hasInstanceTag action " +
      "condition (functions/src/lib/actionConditions.js).",
  },
};

const DEFAULTS = {
  description: "",
  rarity: "commun",
  type: "arme",
  tagIds: [],
};

module.exports = { FIELDS, DEFAULTS };
