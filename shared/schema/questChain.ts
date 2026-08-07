import { z } from "zod";

// Structural contract for `worldData/questChains/items/{chainId}` documents. No creator UI yet -
// authored directly in the Firestore console, same convention as missionSubject.trigger and
// tier.talentGain (see docs/TODO.md "Composite quests" and "Retiring quests and quest objectives
// for the subject-action system"). Read by functions/src/lib/questChains.js, called from
// functions/src/actions/rumeur.js (to offer a pending step ahead of the normal mission-generation
// draw) and functions/src/actions/mission.js (to advance a chain on a matching mission's success).

const QuestChainStepSchema = z.object({
  subjectId: z.string().describe("Id in worldData/missionSubjects/items this step is generated from."),
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
        "step is pushed into the character's triggeredSubjectIds once the previous step is " +
        "completed successfully - see character.questChainProgress. LEGACY: chains authored before " +
        "the subject-action migration stored questIds (worldData/quests/items ids) here instead; " +
        "those are stale and need re-authoring against worldData/missionSubjects/items, not migrated."
    ),
});

export type QuestChainDocument = z.infer<typeof QuestChainDocumentSchema>;

const DEFAULTED_KEYS = ["steps"] as const;

export const DEFAULTS = QuestChainDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
