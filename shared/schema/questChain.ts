import { z } from "zod";

// Structural contract for `worldData/questChains/items/{chainId}` documents. No creator UI yet -
// authored directly in the Firestore console, same convention as monster.trigger and
// tier.talentGain (see docs/TODO.md "Quest chains on monsters"). Read by
// functions/src/lib/questChains.js, called from functions/src/actions/recherche.js (to offer a
// pending step ahead of the normal mission-generation draw) and functions/src/actions/mission.js
// (to advance a chain on a matching mission's success, and to pay the chain's rewards out on its
// last step).

const QuestChainStepSchema = z.object({
  monsterId: z.string().describe("Id in worldData/monsters/items this step's mission is generated against."),
  difficulty: z
    .string()
    .describe("The DIFFICULTIES tier (facile..mythique) this step is generated and resolved at."),
});

export const QuestChainDocumentSchema = z.object({
  name: z.string().describe("French, for reference/authoring only; not shown to players yet."),
  steps: z
    .array(QuestChainStepSchema)
    .default([])
    .describe(
      "Ordered, step 1 first. Step 1 is discoverable however missions normally are; each later " +
        "step is pushed into the character's triggeredMonsterIds once the previous step is " +
        "completed successfully - see character.questChainProgress. LEGACY: chains authored before " +
        "the bestiary migration stored subjectId (worldData/missionSubjects/items) here, and older " +
        "ones still questId (worldData/quests/items); both are stale and need re-authoring against " +
        "worldData/monsters/items by hand, not migrated."
    ),
  rewardItemIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/objects/items granted on completing the last step, on top of that mission's " +
        "own loot. One instance per id."
    ),
  rewardTalentIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/talents/items granted at quality 1 on completing the last step, skipping any " +
        "the character already owns (same rule as monster.talentRewardId)."
    ),
  rewardReputation: z
    .number()
    .default(0)
    .describe(
      "Reputation credited on completing the last step, to the region named by rewardRegionId below. " +
        "0 for a chain that pays no reputation."
    ),
  rewardRegionId: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "Id in worldData/regions/items rewardReputation lands in, or null to credit whichever region " +
        "the character stands in when the chain completes. Authored explicitly so a chain spanning " +
        "several regions credits the one it is actually about, rather than wherever the last step " +
        "happened to be resolved."
    ),
});

export type QuestChainDocument = z.infer<typeof QuestChainDocumentSchema>;

const DEFAULTED_KEYS = ["steps", "rewardItemIds", "rewardTalentIds", "rewardReputation", "rewardRegionId"] as const;

export const DEFAULTS = QuestChainDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
