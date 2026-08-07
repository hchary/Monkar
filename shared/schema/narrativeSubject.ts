import { z } from "zod";
import { ActionAvailabilityConditionSchema } from "./actionType";

// Structural contract for `worldData/narrativeSubjects/items/{subjectId}` documents, shared
// between the client creator that writes this collection and the Cloud Functions codebase
// (functions/src/schema/narrativeSubject.ts re-exports this alongside the collection-level
// documentation the project's schema convention requires).
//
// Authored through src/components/creator/TextGenerationManager.jsx (writes tagIds only). LEGACY:
// `rarity` and `condition` below were written by src/components/creator/QuestObjectivesManager.jsx
// when a subject doubled as an "objectif de quête" - that manager and the whole quest-objective
// mechanic were retired by "Retiring quests and quest objectives for the subject-action system"
// (docs/TODO.md), so nothing writes these two fields any more. Existing documents may still carry
// stale values; nothing reads them either. Kept in the schema, not deleted, per this project's
// dead-field convention.

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
  tagIds: z
    .array(z.string())
    .optional()
    .default([])
    .describe(
      "Ids in worldData/tags/items. Forms the narrative context a verb phrase's own `tagIds` must be " +
        "a subset of (functions/src/textGeneration.js's tagsOf/isSubset)."
    ),
  rarity: z
    .string()
    .optional()
    .default("commun")
    .describe(
      "LEGACY, dead: one of the 8 RARITIES. Written only by the now-retired " +
        "QuestObjectivesManager.jsx when this subject doubled as a quest objective; nothing writes " +
        "or reads it any more (see the header comment above)."
    ),
  condition: z
    .object({ conditions: z.array(ActionAvailabilityConditionSchema).default([]) })
    .nullable()
    .optional()
    .default(null)
    .describe(
      "LEGACY, dead: optional strict gate (same row shape as an action's availability.conditions - " +
        "see shared/schema/actionType.ts). Written only by the now-retired QuestObjectivesManager.jsx " +
        "when this subject doubled as a quest objective; nothing writes or reads it any more (see the " +
        "header comment above)."
    ),
});

export type NarrativeSubjectDocument = z.infer<typeof NarrativeSubjectDocumentSchema>;

// QuestObjectivesManager's blank form. TextGenerationManager shares the first six values (including
// tagIds) but has no rarity/condition of its own.
const DEFAULTED_KEYS = ["type", "article", "genre", "nombre", "tagIds", "rarity", "condition"] as const;

export const DEFAULTS = NarrativeSubjectDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
