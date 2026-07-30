// Canonical contract for `worldData/climats/items/{climatId}`: the weather/biome a region is set
// in, referenced by region.climatId. Authored through src/components/creator/ClimatsManager.jsx,
// which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  name: { type: "string", description: "Climate display name, e.g. \"Tempéré humide\"." },
  description: { type: "string", description: "Free-text flavour copy, shown as a tooltip in the region form." },
  bannerKey: {
    type: "string",
    description:
      "Which banner illustration the character page shows (src/components/ClimateBanner.jsx). One of " +
      "foret | glace | pleine_mer | bord_mer | desert | volcan | ville | grotte, or \"\" for no banner.",
  },
};

const DEFAULTS = {
  description: "",
  bannerKey: "",
};

module.exports = { FIELDS, DEFAULTS };
