// Canonical contract for `worldData/verbPhrases/items/{verbPhraseId}`: one authored sentence
// template the narrative engine can draw for a slot. functions/src/textGeneration.js assembles a
// quest narration from at most one phrase per slot, in the order opening -> climax -> talentGrowth;
// only climax is mandatory. Authored through src/components/creator/TextGenerationManager.jsx.
//
// Phrases are written lowercase and without a final period: the engine capitalizes and punctuates
// them, and reuses the climax verbatim as a clause inside loot descriptions.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  resultat: {
    type: "string",
    description:
      "\"victoire\" | \"echec\" | \"partielle\" - which outcome the phrase narrates. Must match the " +
      "action's result exactly; there is no fallback across outcomes.",
  },
  slot: {
    type: "string",
    description:
      "\"opening\" | \"climax\" | \"talentGrowth\" - the phrase's role in the paragraph (NARRATIVE_SLOTS). " +
      "Absent means \"climax\", so phrases authored before slots existed stay valid without migration.",
  },
  cible: {
    type: "string",
    description:
      "\"groupe\" | \"individuel\" | \"les_deux\" - which subject number the phrase agrees with. " +
      "\"les_deux\" matches either.",
  },
  template: {
    type: "string",
    description:
      "The sentence itself. Placeholders: {sujet} (the subject, article included and contracted after " +
      "\"de\"), {lieu}, {quete}, and {talent} on talentGrowth only. A phrase whose placeholder has no " +
      "value in the current action is dropped rather than rendered raw.",
  },
  talentChange: {
    type: "string",
    optional: true,
    description:
      "\"les_deux\" | \"evolution\" | \"unlock\" - which kind of talent progression the phrase narrates. " +
      "Written only when slot is \"talentGrowth\"; absent is read as \"les_deux\".",
  },
  tags: {
    type: "array",
    optional: true,
    description:
      "[string] free-text tag NAMES (not worldData/tags ids), spelled exactly like the tag names used " +
      "by subjects, quests and talents. ALL of them must be present in the action's context for the " +
      "phrase to qualify, and the qualifying phrase with the most tags wins. Omitted entirely when " +
      "empty, which makes the phrase a generic fallback.",
  },
};

// TextGenerationManager's blank form. talentChange and tags are omitted from the written document
// unless they apply, so they have no default here.
const DEFAULTS = {
  resultat: "victoire",
  cible: "groupe",
  slot: "climax",
};

module.exports = { FIELDS, DEFAULTS };
