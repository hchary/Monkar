// Canonical contract for `worldData/professions/items/{professionId}`: a "métier" a character can
// practise. The document id is what character.professionId, character.knownProfessions[].professionId
// and origin.profession all store - the name below is display copy only.
//
// Authored through src/components/creator/ProfessionsManager.jsx, which writes the whole document
// with setDoc inside a batch that also maintains the profession <-> actionType link on both ends.
// Cloud Functions only read this collection (createCharacter resolves origin.profession to
// { id, name } here - functions/src/index.js).
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Profession display name, e.g. \"Bûcheron\"." },
  description: { type: "string", description: "Free-text copy shown on the character's profession tab." },
  talentIds: {
    type: "array",
    description:
      "[string] ids in worldData/talents/items associated with the profession. Authored but not yet read " +
      "by any mechanic.",
  },
  minReputation: {
    type: "number",
    description:
      "Reputation required to take the profession. Authored but not yet enforced anywhere - no gate " +
      "reads it today.",
  },
  trainerTypeIds: {
    type: "array",
    description: "[string] ids in worldData/trainerTypes/items who can teach this profession.",
  },
  evolutionId: {
    type: "string",
    description:
      "Id in this same collection - the profession this one advances into - or \"\" for none. Authored " +
      "but not yet read by any mechanic.",
  },
  actionIds: {
    type: "array",
    description:
      "[string] ids in worldData/actionTypes/items runnable by a character practising this profession. " +
      "The mirror side of actionType.professionIds: both ends are written in one batch by " +
      "src/lib/professionActions.js, so they can never disagree about the link.",
  },
};

const DEFAULTS = {
  description: "",
  talentIds: [],
  minReputation: 0,
  trainerTypeIds: [],
  evolutionId: "",
  actionIds: [],
};

module.exports = { FIELDS, DEFAULTS };
