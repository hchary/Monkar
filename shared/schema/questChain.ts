import { z } from "zod";

// Structural contract for `worldData/questChains/items/{chainId}` documents. No creator UI yet -
// authored directly in the Firestore console, same convention as quest.trigger and
// tier.talentGain (see docs/TODO.md "Composite quests (spec needed)"). Read by
// functions/src/actions/partirEnQuete.js to offer chain steps beyond the first ahead of the
// normal random region/difficulty draw.

export const QuestChainDocumentSchema = z.object({
  name: z.string().describe("French, for reference/authoring only; not shown to players yet."),
  questIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/quests/items, ordered, step 1 first. Step 1 is discoverable however quests " +
        "normally are; each later step is pushed into the character's triggeredQuestIds once the " +
        "previous step is completed successfully - see character.questChainProgress."
    ),
});

export type QuestChainDocument = z.infer<typeof QuestChainDocumentSchema>;

const DEFAULTED_KEYS = ["questIds"] as const;

export const DEFAULTS = QuestChainDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
