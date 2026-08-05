import { z } from "zod";

// Structural contract for `worldData/rumors/items/{rumorId}` documents, shared between the client
// creator (src/components/creator/RumorsManager.jsx, which writes the whole document with setDoc)
// and the Cloud Functions codebase (functions/src/schema/rumor.ts re-exports this alongside the
// collection-level documentation the project's schema convention requires).

export const RumorDocumentSchema = z.object({
  text: z.string().describe("French flavor text shown in the rumor banner and a character's rumorJournal."),
  rarity: z
    .string()
    .default("commun")
    .describe(
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | " +
        "unique. The rumor's rarity at its origin region(s) - decays by one tier per propagation hop " +
        "away from there (see docs/TODO.md 'Rumor and mission system')."
    ),
  originRegionIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/regions/items where this rumor starts, same shape as quest.regionIds. " +
        "RumorsManager seeds a worldData/regions/items/{regionId}/rumorSightings/{rumorId} entry at " +
        "this rarity for each one on save."
    ),
  linkedQuestId: z
    .string()
    .nullable()
    .default(null)
    .describe("Id in worldData/quests/items this rumor hints at, or null for a rumor with no quest link."),
});

export type RumorDocument = z.infer<typeof RumorDocumentSchema>;

const DEFAULTED_KEYS = ["rarity", "originRegionIds", "linkedQuestId"] as const;

export const DEFAULTS = RumorDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
