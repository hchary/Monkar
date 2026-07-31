import { z } from "zod";

// Structural contract for `worldData/quests/items/{questId}` documents, shared between the client
// creator (src/components/creator/QuestsManager.jsx, which writes the whole document with setDoc)
// and the Cloud Functions codebase (functions/src/schema/quest.ts re-exports this alongside the
// collection-level documentation the project's schema convention requires).

export const QuestDocumentSchema = z.object({
  name: z.string().describe("Quest display name, substituted for {quete} in verb-phrase templates."),
  objectiveIds: z
    .array(z.string())
    .default([])
    .describe(
      'Ids in worldData/narrativeSubjects/items, restricted to subjects tagged "objectif de quête". ' +
        "These are the possible targets the narration and the loot draw use."
    ),
  difficulties: z
    .array(z.string())
    .default([])
    .describe(
      "The difficulty tiers this quest can be rolled at, from DIFFICULTIES: facile | moyen | difficile | " +
        "tres_difficile | epique | mythique. A 6-tier scale of its own, deliberately not the 8-tier " +
        "rarity enum."
    ),
  successPhraseIds: z
    .array(z.string())
    .default([])
    .describe("Ids in worldData/verbPhrases/items offered to the narrator on success."),
  failurePhraseIds: z
    .array(z.string())
    .default([])
    .describe("Ids in worldData/verbPhrases/items offered to the narrator on failure."),
  regionIds: z
    .array(z.string())
    .default([])
    .describe("Ids in worldData/regions/items where the quest can be drawn. Empty means unrestricted."),
  locationId: z
    .string()
    .default("")
    .describe(
      'Id in worldData/adventureZones/items, or "" for none. Supplies {lieu}; a phrase using {lieu} is ' +
        "dropped when this is empty."
    ),
  tagIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/tags/items. Their NAMES enter the narrative context that a verb phrase's free-text " +
        "tags must be a subset of, and they gate which talents the quest can progress."
    ),
});

export type QuestDocument = z.infer<typeof QuestDocumentSchema>;

const DEFAULTED_KEYS = [
  "objectiveIds",
  "difficulties",
  "successPhraseIds",
  "failurePhraseIds",
  "regionIds",
  "locationId",
  "tagIds",
] as const;

export const DEFAULTS = QuestDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
