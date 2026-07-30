// Canonical contract for `worldData/narrativeSubjects/items/{subjectId}`: the "who/what" a
// generated sentence is about - the noun phrase substituted for {sujet} by
// functions/src/textGeneration.js. A subject tagged with the literal string "objectif de quête"
// (QuestObjectivesManager's OBJECTIVE_TAG) doubles as a quest objective and is what quest.objectiveIds
// point at; there is no separate collection for objectives.
//
// Authored through two creator screens that write the same document with different field sets:
//   - src/components/creator/QuestObjectivesManager.jsx (creates objectives; writes tagIds + rarity,
//     and always forces OBJECTIVE_TAG into `tags`)
//   - src/components/creator/TextGenerationManager.jsx (edits any subject; writes `tags` only, and
//     drops tagIds/rarity from the document when it saves)
// That asymmetry is the reason tagIds and rarity are marked optional below.
//
// The document id is the Firestore key, never a field.

const FIELDS = {
  type: {
    type: "string",
    description:
      "\"groupe\" | \"individuel\" - the subject's number. Matched against a verb phrase's `cible` " +
      "so the sentence agrees (see slotPool in functions/src/textGeneration.js).",
  },
  article: {
    type: "string",
    description:
      "\"le\" | \"la\" | \"les\" | \"l'\" - the definite article. textGeneration.js contracts it after " +
      "the preposition \"de\" (de + les -> des) and elides \"l'\" against the noun.",
  },
  nom: { type: "string", description: "The noun itself, without its article, e.g. \"bandits\"." },
  genre: { type: "string", description: "\"m\" | \"f\". Authored but not yet read by the generator." },
  nombre: {
    type: "string",
    description: "\"singulier\" | \"pluriel\". Authored but not yet read by the generator - `type` drives agreement.",
  },
  tags: {
    type: "array",
    description:
      "[string] free-text tag NAMES (not worldData/tags ids). They form the narrative context a verb " +
      "phrase's own `tags` must be a subset of, so they must be spelled exactly like the phrase's. " +
      "Contains OBJECTIVE_TAG (\"objectif de quête\") when the subject is a quest objective.",
  },
  tagIds: {
    type: "array",
    optional: true,
    description:
      "[string] ids in worldData/tags/items. Written only by QuestObjectivesManager; TextGenerationManager " +
      "drops the field when it saves. Not read by textGeneration.js - the generator matches on `tags`.",
  },
  rarity: {
    type: "string",
    optional: true,
    description:
      "One of the 8 RARITIES (commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | " +
      "unique). Picks the loot table drawn from when this objective is defeated. Written only by " +
      "QuestObjectivesManager; TextGenerationManager drops the field when it saves.",
  },
};

// QuestObjectivesManager's blank form. TextGenerationManager shares the first five values but has
// no tagIds/rarity of its own.
const DEFAULTS = {
  type: "groupe",
  article: "les",
  genre: "m",
  nombre: "pluriel",
  tagIds: [],
  rarity: "commun",
};

module.exports = { FIELDS, DEFAULTS };
