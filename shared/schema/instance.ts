import { z } from "zod";

// Structural contract for a top-level `instances/{instanceId}` document, shared between the Cloud
// Functions codebase (functions/src/schema/instance.ts re-exports this alongside the
// collection-level documentation the project's schema convention requires) and any client code
// that needs to read/validate an owned item instance.

export const InstanceDocumentSchema = z.object({
  objectId: z.string().describe("Id in worldData/objects/items - the item type this is an instance of."),
  characterId: z.string().describe("Id in `characters` - who holds it."),
  ownerUid: z
    .string()
    .describe("Auth uid of the owning player. Denormalized from the character because the read rule needs it."),
  acquisitionDate: z.string().describe("YYYY-MM-DD (UTC) the instance was obtained."),
  condition: z
    .string()
    .default("neuf")
    .describe('Wear state. Always "neuf" today - nothing degrades an instance yet.'),
  description: z
    .string()
    .describe(
      "Snapshot of the object's description at acquisition, so later catalog edits don't rewrite an " +
        "item the player already holds. Quest loot appends the clause describing how it was obtained " +
        "(see drawQuestLoot in functions/src/actions/partirEnQuete.js)."
    ),
});

export type InstanceDocument = z.infer<typeof InstanceDocumentSchema>;

const DEFAULTED_KEYS = ["condition"] as const;

export const DEFAULTS = InstanceDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
