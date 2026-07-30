// Canonical contract for `worldData/quests/items/{questId}`: a quest the partirEnQuete handler
// (functions/src/actions/partirEnQuete.js) can draw for a character. Authored through
// src/components/creator/QuestsManager.jsx, which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Quest display name, substituted for {quete} in verb-phrase templates." },
  objectiveIds: {
    type: "array",
    description:
      "[string] ids in worldData/narrativeSubjects/items, restricted to subjects tagged " +
      "\"objectif de quête\". These are the possible targets the narration and the loot draw use.",
  },
  difficulties: {
    type: "array",
    description:
      "[string] the difficulty tiers this quest can be rolled at, from DIFFICULTIES: facile | moyen | " +
      "difficile | tres_difficile | epique | mythique. A 6-tier scale of its own, deliberately not the " +
      "8-tier rarity enum.",
  },
  successPhraseIds: {
    type: "array",
    description: "[string] ids in worldData/verbPhrases/items offered to the narrator on success.",
  },
  failurePhraseIds: {
    type: "array",
    description: "[string] ids in worldData/verbPhrases/items offered to the narrator on failure.",
  },
  regionIds: {
    type: "array",
    description: "[string] ids in worldData/regions/items where the quest can be drawn. Empty means unrestricted.",
  },
  locationId: {
    type: "string",
    description:
      "Id in worldData/adventureZones/items, or \"\" for none. Supplies {lieu}; a phrase using {lieu} " +
      "is dropped when this is empty.",
  },
  tagIds: {
    type: "array",
    description:
      "[string] ids in worldData/tags/items. Their NAMES enter the narrative context that a verb " +
      "phrase's free-text tags must be a subset of, and they gate which talents the quest can progress.",
  },
};

const DEFAULTS = {
  objectiveIds: [],
  difficulties: [],
  successPhraseIds: [],
  failurePhraseIds: [],
  regionIds: [],
  locationId: "",
  tagIds: [],
};

module.exports = { FIELDS, DEFAULTS };
