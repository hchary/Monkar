// Canonical contract for `worldData/reliefs/items/{reliefId}`: a terrain feature a region can
// carry, referenced by region.reliefIds. Authored through src/components/creator/ReliefsManager.jsx
// (and the inline quick-create inside RegionsManager), which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Relief display name, e.g. \"Falaises\"." },
  description: { type: "string", description: "Free-text flavour copy, shown as a tooltip in the region form." },
};

const DEFAULTS = {
  description: "",
};

module.exports = { FIELDS, DEFAULTS };
