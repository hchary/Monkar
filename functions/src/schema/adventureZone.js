// Canonical contract for `worldData/adventureZones/items/{zoneId}`: a quest location ("lieu de
// quête"), referenced by quest.locationId and region.adventureZoneIds. Read by the partirEnQuete
// handler (functions/src/actions/partirEnQuete.js) to fill the {lieu} placeholder in the generated
// quest narration. Authored through src/components/creator/QuestLocationsManager.jsx, which writes
// the whole document with setDoc.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Location display name, substituted for {lieu} in verb-phrase templates." },
  description: { type: "string", description: "Free-text flavour copy." },
};

const DEFAULTS = {
  description: "",
};

module.exports = { FIELDS, DEFAULTS };
