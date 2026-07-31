import { z } from "zod";

// Structural contract for `worldData/recettes/items/{recetteId}` documents, shared between the
// client creator (src/components/creator/RecettesManager.jsx, which writes the whole document with
// setDoc) and the Cloud Functions codebase (functions/src/schema/recette.ts re-exports this
// alongside the collection-level documentation the project's schema convention requires).

const RecetteLineSchema = z.object({
  objectId: z.string().describe("Id in worldData/objects/items."),
  qty: z.number().describe("Positive integer; the character must own that many Instances of objectId."),
});

export const RecetteDocumentSchema = z.object({
  name: z.string().describe("Recipe display name."),
  rarity: z
    .string()
    .default("commun")
    .describe(
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | unique."
    ),
  categoryIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/tags/items, used as categories rather than free tags: a crafting actionType's " +
        "recipeCategoryIds selects which recipes it can make."
    ),
  tagIds: z.array(z.string()).default([]).describe("Ids in worldData/tags/items - descriptive tags."),
  ingredients: z
    .array(RecetteLineSchema)
    .default([])
    .describe("Consumed on craft."),
  results: z
    .array(RecetteLineSchema)
    .default([])
    .describe("Produced on craft, same shape as ingredients."),
});

export type RecetteDocument = z.infer<typeof RecetteDocumentSchema>;

const DEFAULTED_KEYS = ["rarity", "categoryIds", "tagIds", "ingredients", "results"] as const;

export const DEFAULTS = RecetteDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
