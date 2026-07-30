// Canonical contract for `worldData/origins/items/{originId}`: the starting package drawn at random
// by createCharacter (functions/src/index.js) once the player has chosen a region. Everything the
// origin grants is resolved and snapshotted onto the character at that moment - see
// functions/src/schema/character.js's `origin` field - so editing an origin never changes a
// character already created from it.
//
// Authored through src/components/creator/OriginsManager.jsx, which writes the whole document with
// setDoc. Supersedes the legacy per-region `backgrounds` subcollection (see schema/region.js).
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Origin display name." },
  description: { type: "string", description: "Free-text copy, shown once in the origin intro dialog." },
  regionIds: {
    type: "array",
    description:
      "[string] ids in worldData/regions/items the origin can be drawn in. An EMPTY array means " +
      "unrestricted - createCharacter treats \"no regionIds\" as valid everywhere, not as valid nowhere.",
  },
  talentIds: {
    type: "array",
    description:
      "[string] ids in worldData/talents/items granted at creation. Each is expanded into a full talent " +
      "entry on character.talents (quality 1, lastChangeCircumstance \"Origine : <name>\"); an id " +
      "pointing at a deleted talent is silently skipped.",
  },
  profession: {
    type: "string",
    description:
      "A SINGLE id in worldData/professions/items (the field name is singular and holds one id, not a " +
      "display name and not an array), or \"\" for none. createCharacter resolves it to { id, name } and " +
      "makes it the character's active profession at level 1.",
  },
  reputationStart: {
    type: "number",
    description: "The character's starting reputation, copied to character.reputation at creation.",
  },
  startingItemIds: {
    type: "array",
    description:
      "[string] ids in worldData/objects/items granted at creation. Each becomes one document in the " +
      "top-level `instances` collection (see schema/instance.js).",
  },
};

const DEFAULTS = {
  description: "",
  regionIds: [],
  talentIds: [],
  profession: "",
  reputationStart: 0,
  startingItemIds: [],
};

module.exports = { FIELDS, DEFAULTS };
