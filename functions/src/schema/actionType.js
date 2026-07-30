// Canonical contract for `worldData/actionTypes/items/{actionTypeId}`: an action a character can
// perform. Read by functions/src/lib/actionPipeline.js on every performAction call, and by the
// player's action browser.
//
// Read it together with functions/src/lib/actionCatalog.js: EVERY field below defaults at READ
// time rather than through a migration, so a document authored before a field existed stays valid.
// normalizeActionType is the single place those defaults live - the "absent means..." notes here
// describe what it does, they are not a second implementation.
//
// Authored through src/components/creator/ActionsManager.jsx, which writes with setDoc({ merge: true })
// inside a batch that also maintains the actionType <-> profession link on both ends. merge:true is
// deliberate: it leaves fields this form does not own (questDifficultyWeights) untouched.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  label: { type: "string", description: "Action display name, e.g. \"Partir en quête\"." },
  description: { type: "string", description: "Free-text copy shown in the action browser." },
  kindId: {
    type: "string",
    description:
      "The kind this action is an instance of, from ACTION_KINDS (functions/src/lib/actionKinds.js): " +
      "aventure | intermede | metier | social | recolte | artisanat. The kind tree is what gives an " +
      "action its inherited behaviour - anything under `metier` is profession-gated, under `recolte` " +
      "draws loot, under `artisanat` resolves a recette. Absent falls back to the legacy categoryId.",
  },
  categoryId: {
    type: "string",
    optional: true,
    description:
      "LEGACY. No longer written - the category is derived at read time as the kind's root ancestor. " +
      "Still read as the kindId of documents authored before kinds existed.",
  },
  handlerId: {
    type: "string",
    nullable: true,
    description:
      "Names an entry in ACTION_HANDLERS (functions/src/index.js): \"partirEnQuete\" | \"recolte\" | " +
      "\"artisanat\". There is no generic resolution path - an action whose handlerId is null or names " +
      "an unregistered handler is refused before the transaction opens.",
  },
  professionIds: {
    type: "array",
    description:
      "[string] ids in worldData/professions/items allowed to run this action. The mirror side of " +
      "profession.actionIds, written together in one batch (src/lib/professionActions.js). Forced to [] " +
      "for any kind outside the Métier branch. Turned into an implicit hasProfession condition by " +
      "resolveConditions - it is never an authored row.",
  },
  order: { type: "number", description: "Sort position within its category in the action browser." },
  enabled: {
    type: "boolean",
    description: "Absent means enabled: only an explicit false hides the action and refuses it server-side.",
  },
  durationHours: {
    type: "number",
    description:
      "How long the action occupies the character. Absent, zero, negative or non-numeric falls back to " +
      "DEFAULT_DURATION_HOURS (24) - this is what makes \"one action per day\" and \"an action lasts 24h\" " +
      "one rule rather than two clocks.",
  },
  availability: {
    type: "map",
    description:
      "{ conditions, unmetBehaviour, unmetMessage }. conditions is [{ type, ...typed params }] over the " +
      "closed CONDITION_TYPES set (hasTalent | hasTalentTag | minReputation | minLegendLevel | profession | " +
      "region | hasInstanceTag | notWounded), each row's extra fields depending on its type. " +
      "unmetBehaviour is \"hide\" | \"disable\" (anything but \"disable\" reads as \"hide\"); unmetMessage " +
      "overrides the evaluator's default refusal text. Enforced server-side, not only in the UI.",
  },
  result: {
    type: "map",
    description:
      "{ accentSource, showLoot }. accentSource is \"category\" | \"difficulty\" - which value colours the " +
      "result dialog. showLoot is true only when explicitly true.",
  },
  lootTagIds: {
    type: "array",
    description:
      "[string] ids in worldData/tags/items, matched by overlap against a lootTable's tagIds. Only " +
      "meaningful under the Récolte branch; forced to [] for every other kind.",
  },
  rarity: {
    type: "string",
    nullable: true,
    description:
      "One of the 8 RARITIES, matched exactly against a lootTable's rarity. Only meaningful under the " +
      "Récolte branch; written as null for every other kind.",
  },
  recipeCategoryIds: {
    type: "array",
    description:
      "[string] ids in worldData/tags/items - a recette qualifies when its own categoryIds overlaps this " +
      "list. Only meaningful under the Artisanat branch; forced to [] for every other kind.",
  },
  questDifficultyWeights: {
    type: "map",
    optional: true,
    description:
      "Out of scope for the creator form, which preserves it via merge:true. Not read by the current " +
      "quest handler.",
  },
  tiers: {
    type: "array",
    optional: true,
    description:
      "DEAD. The retired weighted-paliers roller's table. The framework no longer understands the field; " +
      "a leftover array on an old document is inert clutter, safe to delete by hand.",
  },
};

// ActionsManager's blank form. Note these are the values a *newly authored* document gets - a
// document that predates a field relies on normalizeActionType's read-time default instead.
const DEFAULTS = {
  description: "",
  professionIds: [],
  order: 0,
  enabled: true,
  handlerId: null,
  durationHours: 24,
  availability: { conditions: [], unmetBehaviour: "hide", unmetMessage: "" },
  result: { accentSource: "category", showLoot: false },
  lootTagIds: [],
  rarity: null,
  recipeCategoryIds: [],
};

module.exports = { FIELDS, DEFAULTS };
