import { z } from "zod";

// Structural contract for `worldData/verbPhrases/items/{verbPhraseId}` documents, shared between
// the client creator (src/components/creator/TextGenerationManager.jsx, which writes the whole
// document) and the Cloud Functions codebase (functions/src/schema/verbPhrase.ts re-exports this
// alongside the collection-level documentation the project's schema convention requires).
//
// Phrases are written lowercase and without a final period: the engine capitalizes and punctuates
// them, and reuses the climax verbatim as a clause inside loot descriptions.

export const VerbPhraseDocumentSchema = z.object({
  resultat: z
    .string()
    .default("victoire")
    .describe(
      '"victoire" | "echec" | "partielle" - which outcome the phrase narrates. Must match the action\'s ' +
        "result exactly; there is no fallback across outcomes."
    ),
  slot: z
    .string()
    .default("climax")
    .describe(
      '"opening" | "climax" | "talentGrowth" - the phrase\'s role in the paragraph (NARRATIVE_SLOTS). ' +
        'Absent means "climax", so phrases authored before slots existed stay valid without migration.'
    ),
  cible: z
    .string()
    .default("groupe")
    .describe(
      '"groupe" | "individuel" | "les_deux" - which subject number the phrase agrees with. "les_deux" ' +
        "matches either."
    ),
  template: z
    .string()
    .describe(
      "The sentence itself. Placeholders: {sujet} (the subject, article included and contracted after " +
        '"de"), {lieu}, {quete}, and {talent} on talentGrowth only. A phrase whose placeholder has no ' +
        "value in the current action is dropped rather than rendered raw."
    ),
  talentChange: z
    .string()
    .optional()
    .describe(
      '"les_deux" | "evolution" | "unlock" - which kind of talent progression the phrase narrates. ' +
        'Written only when slot is "talentGrowth"; absent is read as "les_deux".'
    ),
  tagIds: z
    .array(z.string())
    .optional()
    .describe(
      "Ids in worldData/tags/items, the same catalog subjects/quests/talents reference. ALL of them must " +
        "be present in the action's context tagIds (enemy tags, quest tags, progressed-talent tags) for " +
        "the phrase to qualify, and the qualifying phrase with the most tags wins. Omitted entirely when " +
        "empty, which makes the phrase a generic fallback."
    ),
});

export type VerbPhraseDocument = z.infer<typeof VerbPhraseDocumentSchema>;

// TextGenerationManager's blank form. talentChange and tags are omitted from the written document
// unless they apply, so they have no default here.
const DEFAULTED_KEYS = ["resultat", "cible", "slot"] as const;

export const DEFAULTS = VerbPhraseDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
