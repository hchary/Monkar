import { z } from "zod";

// Structural contract for `worldData/lootTables/items/{tableId}` documents, shared between the
// client creator (src/components/creator/TablesDeTirageManager.jsx, which writes the whole
// document with setDoc) and the Cloud Functions codebase (functions/src/schema/lootTable.ts
// re-exports this alongside the collection-level documentation the project's schema convention
// requires).

export const LootTableDocumentSchema = z.object({
  name: z.string().describe("Table display name. Snapshotted as `tableName` on each loot entry."),
  rarity: z
    .string()
    .default("commun")
    .describe(
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | " +
        "unique. Matched EXACTLY against the drawing action's rarity - there is no fallback to a nearby tier."
    ),
  tagIds: z
    .array(z.string())
    .default([])
    .describe("Ids in worldData/tags/items. Matched by OVERLAP (not subset) against the action's loot tags."),
  itemIds: z.array(z.string()).default([]).describe("Ids in worldData/objects/items - the pool drawn from."),
  weightMode: z
    .string()
    .default("uniforme")
    .describe(
      '"uniforme" (every item equally likely, itemWeights ignored) | "manuelle" (draw weighted by itemWeights).'
    ),
  itemWeights: z
    .record(z.string(), z.number())
    .default({})
    .describe(
      '{ [objectId]: number } used only when weightMode is "manuelle"; written as {} otherwise, and its ' +
        "keys are kept in step with itemIds by the creator form. The form requires each weight in [1,100] " +
        "and the set to sum to 100, but that is client-side only - the server draw defensively falls back " +
        "to a uniform pick when the weights don't total above zero."
    ),
});

export type LootTableDocument = z.infer<typeof LootTableDocumentSchema>;

const DEFAULTED_KEYS = ["rarity", "tagIds", "itemIds", "weightMode", "itemWeights"] as const;

export const DEFAULTS = LootTableDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
