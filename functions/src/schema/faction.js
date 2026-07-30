// Canonical contract for `worldData/factions/items/{factionId}`: an organisation present in one or
// more regions, referenced by region.factionIds. Authored through
// src/components/creator/FactionsManager.jsx, which writes the whole document with setDoc.
//
// No game mechanic reads factions yet - they are content the world model already carries.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Faction display name." },
  description: { type: "string", description: "Free-text flavour copy." },
};

const DEFAULTS = {
  description: "",
};

module.exports = { FIELDS, DEFAULTS };
