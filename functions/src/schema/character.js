// Canonical contract for the `characters` collection: every field a character document may
// hold, its shape, and its default at creation (if static). firestore.rules locks characters
// `create`/`update` to isCreator() only, so Cloud Functions (Admin SDK) are the sole writer for
// every field below - a new attribute is added here first, then wired into whichever Cloud
// Function or action handler is responsible for setting it, instead of being inferred by reading
// createCharacter's object literal.

const FIELDS = {
  ownerUid: { type: "string", description: "Auth uid of the owning player. Set once at creation, never changes." },
  name: { type: "string", description: "Player-chosen character name." },
  age: { type: "number", description: "Character age in years." },
  region: { type: "map", description: "{ id, name } of the starting region." },
  origin: {
    type: "map",
    description:
      "{ id, name, description, profession, reputationStart, talents, items } snapshot of the origin drawn at creation.",
  },
  originIntroSeen: { type: "boolean", description: "Whether the player has dismissed the origin intro dialog." },
  title: { type: "string", description: "Character's earned title, if any." },
  profession: { type: "string", description: "Display copy of the starting profession name (see origin.profession)." },
  professionId: {
    type: "string",
    optional: true,
    description: "Id of the currently active profession. Absent until the player picks one via switchKnownProfession.",
  },
  professionLevel: {
    type: "number",
    optional: true,
    description: "Mastery level in the active profession. Absent alongside professionId.",
  },
  knownProfessions: {
    type: "array",
    optional: true,
    description: "[{ professionId, level }] every profession ever held. Absent until the first switch.",
  },
  reputation: { type: "number", description: "Reputation score, starts at origin.reputationStart." },
  legendLevel: { type: "number", nullable: true, description: "Legendary tier, null until the first legendary roll." },
  alive: { type: "boolean", description: "False once the character has died." },
  gold: { type: "number" },
  inventory: {
    type: "array",
    description: "Reserved; item ownership is currently tracked via the separate `instances` collection instead.",
  },
  talents: {
    type: "array",
    description:
      "[{ id, name, quality, trainable, rarity, effect, tagIds, lastChangeDate, lastChangeCircumstance }].",
  },
  blessings: { type: "array", description: "Reserved, not yet populated by any handler." },
  curses: { type: "array", description: "Reserved, not yet populated by any handler." },
  woundsLight: { type: "number" },
  woundsSevere: { type: "number" },
  woundsPermanent: { type: "number" },
  lastActionDate: { type: "string", nullable: true, description: "YYYY-MM-DD of the last performed action." },
  lastActionAt: { type: "timestamp", nullable: true },
  lastAction: {
    type: "map",
    nullable: true,
    description:
      "Shape varies per handler (see functions/src/actions/*.js); always carries the lifecycle envelope stamped by actionEffects.js's stampLifecycle.",
  },
  createdAt: { type: "timestamp" },
};

// Static values every new character starts with - anything computed from the region/origin draw
// (name, region, origin, profession, reputation, talents, ownerUid, createdAt) is set explicitly
// by createCharacter instead of living here.
const DEFAULTS = {
  age: 18,
  originIntroSeen: false,
  title: "",
  legendLevel: null,
  alive: true,
  gold: 0,
  inventory: [],
  blessings: [],
  curses: [],
  woundsLight: 0,
  woundsSevere: 0,
  woundsPermanent: 0,
  lastActionDate: null,
  lastActionAt: null,
  lastAction: null,
};

module.exports = { FIELDS, DEFAULTS };
