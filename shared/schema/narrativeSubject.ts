import { z } from "zod";
import { ActionAvailabilityConditionSchema } from "./actionType";

// Structural contract for `worldData/narrativeSubjects/items/{subjectId}` documents, shared
// between the two client creators that write this collection (see the header notes below) and the
// Cloud Functions codebase (functions/src/schema/narrativeSubject.ts re-exports this alongside the
// collection-level documentation the project's schema convention requires).
//
// Authored through two creator screens that write the same document with different field sets:
//   - src/components/creator/QuestObjectivesManager.jsx (creates objectives; writes tagIds + rarity,
//     and always forces OBJECTIVE_TAG into `tags`)
//   - src/components/creator/TextGenerationManager.jsx (edits any subject; writes `tags` only, and
//     drops tagIds/rarity from the document when it saves)
// That asymmetry is the reason tagIds and rarity are marked optional below.

export const NarrativeSubjectDocumentSchema = z.object({
  type: z
    .string()
    .default("groupe")
    .describe(
      '"groupe" | "individuel" - the subject\'s number. Matched against a verb phrase\'s `cible` so the ' +
        "sentence agrees (see slotPool in functions/src/textGeneration.js)."
    ),
  article: z
    .string()
    .default("les")
    .describe(
      '"le" | "la" | "les" | "l\'" - the definite article. textGeneration.js contracts it after the ' +
        'preposition "de" (de + les -> des) and elides "l\'" against the noun.'
    ),
  nom: z.string().describe('The noun itself, without its article, e.g. "bandits".'),
  genre: z.string().default("m").describe('"m" | "f". Authored but not yet read by the generator.'),
  nombre: z
    .string()
    .default("pluriel")
    .describe('"singulier" | "pluriel". Authored but not yet read by the generator - `type` drives agreement.'),
  tags: z
    .array(z.string())
    .describe(
      "Free-text tag NAMES (not worldData/tags ids). They form the narrative context a verb phrase's own " +
        '`tags` must be a subset of, so they must be spelled exactly like the phrase\'s. Contains ' +
        'OBJECTIVE_TAG ("objectif de quête") when the subject is a quest objective.'
    ),
  tagIds: z
    .array(z.string())
    .optional()
    .default([])
    .describe(
      "Ids in worldData/tags/items. Written only by QuestObjectivesManager; TextGenerationManager drops " +
        "the field when it saves. Not read by textGeneration.js - the generator matches on `tags`."
    ),
  rarity: z
    .string()
    .optional()
    .default("commun")
    .describe(
      "One of the 8 RARITIES (commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | " +
        "unique). Picks the loot table drawn from when this objective is defeated. Written only by " +
        "QuestObjectivesManager; TextGenerationManager drops the field when it saves."
    ),
  condition: z
    .object({ conditions: z.array(ActionAvailabilityConditionSchema).default([]) })
    .nullable()
    .optional()
    .default(null)
    .describe(
      "Optional strict gate, only meaningful for entries tagged \"objectif de quête\" (same row shape " +
        "as an action's availability.conditions - see shared/schema/actionType.ts - most naturally a " +
        "single hasTalentTag row here). Used by the quest/mission resolution algorithm's score roll " +
        "(functions/src/lib/questResolution.js): restricts whether a character's talent-tag overlap " +
        "with this objective counts at all toward the success-threshold and wound-threshold " +
        "adjustments (all-or-nothing - the character must own at least one talent matching this " +
        "condition, or none of its tag-sharing talents count). Null/absent (default): every talent " +
        "sharing a tag with this objective counts, as before. Written only by QuestObjectivesManager."
    ),
});

export type NarrativeSubjectDocument = z.infer<typeof NarrativeSubjectDocumentSchema>;

// QuestObjectivesManager's blank form. TextGenerationManager shares the first five values but has
// no tagIds/rarity/condition of its own.
const DEFAULTED_KEYS = ["type", "article", "genre", "nombre", "tagIds", "rarity", "condition"] as const;

export const DEFAULTS = NarrativeSubjectDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
