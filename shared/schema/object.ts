import { z } from "zod";

// Structural contract for `worldData/objects/items/{objectId}` documents, shared between the
// client creator (src/components/creator/ObjectsManager.jsx, which writes the whole document with
// setDoc) and the Cloud Functions codebase (functions/src/schema/object.ts re-exports this
// alongside the collection-level documentation the project's schema convention requires).

export const ObjectDocumentSchema = z.object({
  name: z.string().describe("Object display name."),
  description: z
    .string()
    .default("")
    .describe(
      "Free-text copy. Copied onto each Instance at acquisition, where handlers may append the clause " +
        "that describes how it was obtained."
    ),
  rarity: z
    .string()
    .default("commun")
    .describe(
      "One of the 8 RARITIES: commun | peu_commun | rare | tres_rare | legendaire | mythique | divin | " +
        "unique. Also what a lootTable's own rarity is matched against when drawing."
    ),
  type: z
    .string()
    .default("arme")
    .describe(
      "One of OBJECT_TYPES (src/components/creator/ObjectsManager.jsx): arme | armure | consommable | " +
        "composant | ingredient | grimoire | parchemin | objet_magique | titre_propriete | vetement. " +
        "A fixed catalog in JS - there is no creator UI to add types."
    ),
  tagIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/tags/items. Drive the inventory filters and the hasInstanceTag action condition " +
        "(functions/src/lib/actionConditions.js)."
    ),
});

export type ObjectDocument = z.infer<typeof ObjectDocumentSchema>;

const DEFAULTED_KEYS = ["description", "rarity", "type", "tagIds"] as const;

export const DEFAULTS = ObjectDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
