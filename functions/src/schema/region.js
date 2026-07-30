// Canonical contract for `worldData/regions/items/{regionId}`: the map's top-level area, picked by
// the player at character creation (see createCharacter in functions/src/index.js). Authored
// exclusively through the creator UI (src/components/creator/RegionsManager.jsx), which writes the
// whole document with setDoc - every field below is always present on a document saved by that
// form, so a new attribute is added here first, then wired into the form.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Region display name, e.g. \"Côte des Brumes\"." },
  nameSuggestions: {
    type: "array",
    description: "[string] character-name ideas offered by the creation form for this region.",
  },
  description: { type: "string", description: "Free-text flavour copy." },
  neighbors: {
    type: "array",
    description:
      "[{ regionId, direction }] adjacent regions. direction is one of nord | sud | est | ouest. " +
      "Stored on one side only - the form does not mirror the edge onto the neighbour.",
  },
  climatId: {
    type: "string",
    description: "Id in worldData/climats/items, or \"\" when the region has no climate.",
  },
  reliefIds: { type: "array", description: "[string] ids in worldData/reliefs/items." },
  factionIds: { type: "array", description: "[string] ids in worldData/factions/items." },
  adventureZoneIds: {
    type: "array",
    description: "[string] ids in worldData/adventureZones/items - the quest locations reachable here.",
  },
  originIds: {
    type: "array",
    description:
      "[string] ids in worldData/origins/items. Advisory only: createCharacter draws from the " +
      "origin's own regionIds, not from this list.",
  },
};

// Legacy `worldData/regions/items/{regionId}/backgrounds/{backgroundId}` subcollection: the
// per-region starting package that predates worldData/origins/items. Still editable through
// RegionsManager's "Editer les origines" panel and still seeded by functions/scripts/
// seedWorldData.js, but nothing reads it any more - createCharacter draws an Origin instead.
// Documented here so the shape is not lost; do not add fields to it.
const BACKGROUND_FIELDS = {
  name: { type: "string" },
  profession: { type: "string", description: "Display copy of a profession name, not a professions/items id." },
  weight: { type: "number", description: "Relative draw weight among this region's backgrounds." },
  reputationStart: { type: "number" },
  startingGold: { type: "number" },
  startingItems: { type: "array", description: "[{ name, qty }] - free-text names, not objects/items ids." },
};

// What RegionsManager's blank form writes when the creator saves without touching a field.
const DEFAULTS = {
  nameSuggestions: [],
  description: "",
  neighbors: [],
  climatId: "",
  reliefIds: [],
  factionIds: [],
  adventureZoneIds: [],
  originIds: [],
};

module.exports = { FIELDS, BACKGROUND_FIELDS, DEFAULTS };
