import { z } from "zod";

// Structural contract for `worldData/talents/items/{talentId}` documents, shared between the
// client creator (src/components/creator/TalentsManager.jsx, which writes the whole document with
// setDoc inside a batch that also maintains the bidirectional ancestor/descendant links) and the
// Cloud Functions codebase (functions/src/schema/talent.ts re-exports this alongside the
// collection-level documentation the project's schema convention requires).
//
// Granted at creation by an origin (createCharacter snapshots id/name/quality/trainable/rarity/
// effect/tagIds onto character.talents - see shared/schema/character.ts) and progressed by quests
// through functions/src/lib/talentEvolution.js.

export const TalentDocumentSchema = z.object({
  name: z.string().describe("Talent display name."),
  effect: z
    .string()
    .default("")
    .describe("Free-text description of what the talent does, shown in its tooltip."),
  rarity: z
    .string()
    .default("commun")
    .describe(
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | unique."
    ),
  trainable: z
    .boolean()
    .default(false)
    .describe('Whether a trainer can improve it. When false, trainerTypeId is forced back to "" on save.'),
  trainerTypeId: z
    .string()
    .default("")
    .describe(
      'Id in worldData/trainerTypes/items, or "" when none / not trainable. Only meaningful while ' +
        "trainable is true."
    ),
  tagIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/tags/items. They decide which quests and missions can progress the talent - " +
        "functions/src/lib/talentEvolution.js matches them against the resolution's own tagIds."
    ),
  ancestorIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in this same collection - the talents this one grows out of. Kept in sync with the other " +
        "talent's descendantIds by TalentsManager's write batch; the link is stored on both ends."
    ),
  descendantIds: z
    .array(z.string())
    .default([])
    .describe("Ids in this same collection - the mirror side of ancestorIds."),
});

export type TalentDocument = z.infer<typeof TalentDocumentSchema>;

const DEFAULTED_KEYS = [
  "trainable",
  "rarity",
  "effect",
  "trainerTypeId",
  "tagIds",
  "ancestorIds",
  "descendantIds",
] as const;

export const DEFAULTS = TalentDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
