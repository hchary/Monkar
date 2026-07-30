// Canonical contract for `worldData/talents/items/{talentId}`: a skill a character can hold.
// Granted at creation by an origin (createCharacter snapshots id/name/quality/trainable/rarity/
// effect/tagIds onto character.talents - see functions/src/schema/character.js) and progressed by
// quests through functions/src/lib/talentEvolution.js.
//
// Authored through src/components/creator/TalentsManager.jsx, which writes the whole document with
// setDoc inside a batch that also maintains the bidirectional ancestor/descendant links.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Talent display name." },
  effect: { type: "string", description: "Free-text description of what the talent does, shown in its tooltip." },
  rarity: {
    type: "string",
    description:
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | unique.",
  },
  trainable: {
    type: "boolean",
    description: "Whether a trainer can improve it. When false, trainerTypeId is forced back to \"\" on save.",
  },
  trainerTypeId: {
    type: "string",
    description:
      "Id in worldData/trainerTypes/items, or \"\" when none / not trainable. Only meaningful while " +
      "trainable is true.",
  },
  favoredQuestIds: {
    type: "array",
    description: "[string] ids in worldData/quests/items this talent is especially suited to.",
  },
  tagIds: {
    type: "array",
    description:
      "[string] ids in worldData/tags/items. Their NAMES decide which quests can progress the talent and " +
      "which verb phrases may narrate that progression, so they must be spelled exactly like the free-text " +
      "tags on verbPhrases.",
  },
  ancestorIds: {
    type: "array",
    description:
      "[string] ids in this same collection - the talents this one grows out of. Kept in sync with the " +
      "other talent's descendantIds by TalentsManager's write batch; the link is stored on both ends.",
  },
  descendantIds: {
    type: "array",
    description: "[string] ids in this same collection - the mirror side of ancestorIds.",
  },
};

const DEFAULTS = {
  trainable: false,
  rarity: "commun",
  effect: "",
  favoredQuestIds: [],
  trainerTypeId: "",
  tagIds: [],
  ancestorIds: [],
  descendantIds: [],
};

module.exports = { FIELDS, DEFAULTS };
