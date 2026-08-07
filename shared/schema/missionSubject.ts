import { z } from "zod";

// Structural contract for `worldData/missionSubjects/items/{missionSubjectId}` documents, shared
// between the client creator (src/components/creator/MissionSubjectsManager.jsx, which writes the
// whole document with setDoc) and the Cloud Functions codebase
// (functions/src/schema/missionSubject.ts re-exports this alongside the collection-level
// documentation the project's schema convention requires).
//
// The other half of the mission-name title-building pair - see shared/schema/missionAction.ts. A
// row's `tagIds` (per difficulty tier, or per variation) feed the loot-table matching pass
// described in docs/TODO.md "Mission loot and rarity mapping" - not consumed by this entry.

const DifficultyTierSchema = z.object({
  difficulty: z
    .string()
    .describe("One of the 6-tier DIFFICULTIES scale (facile..mythique) - see QuestsManager.jsx."),
  prefix: z
    .string()
    .nullable()
    .default(null)
    .describe("French prefix inserted before the subject's base name when drawn at this difficulty, or null for none."),
  suffix: z
    .string()
    .nullable()
    .default(null)
    .describe("French suffix appended after the subject's base name when drawn at this difficulty, or null for none."),
  tagIds: z
    .array(z.string())
    .default([])
    .describe("Ids in worldData/tags/items this difficulty tier contributes to the drawn mission's tag pool."),
});

const VariationSchema = z.object({
  prefix: z.string().nullable().default(null).describe("French prefix, or null for none."),
  suffix: z.string().nullable().default(null).describe("French suffix, or null for none."),
  tagIds: z
    .array(z.string())
    .default([])
    .describe("Ids in worldData/tags/items this variation contributes to the drawn mission's tag pool."),
});

export const MissionSubjectDocumentSchema = z.object({
  name: z.string().describe('French base name, e.g. "dragon", "caravane marchande".'),
  type: z
    .string()
    .describe(
      "Free text, matched against a worldData/missionActions/items entry's own `type` for pairing " +
        "at generation time."
    ),
  climateIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/climats/items this subject can be generated for - used to match a subject " +
        "to the region it's generated for."
    ),
  difficultyTiers: z
    .array(DifficultyTierSchema)
    .default([])
    .describe(
      "One entry per DIFFICULTIES tier this subject can appear at; a tier absent here means the " +
        "subject can't be drawn at that difficulty."
    ),
  variations: z
    .array(VariationSchema)
    .default([])
    .describe(
      "Difficulty-independent flavor modifiers; one is drawn at random per generation, independent " +
        "of the difficulty draw."
    ),
});

export type MissionSubjectDocument = z.infer<typeof MissionSubjectDocumentSchema>;

const DEFAULTED_KEYS = ["climateIds", "difficultyTiers", "variations"] as const;

export const DEFAULTS = MissionSubjectDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
