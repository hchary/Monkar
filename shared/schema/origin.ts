import { z } from "zod";

// Structural contract for `worldData/origins/items/{originId}` documents, shared between the
// client creator (src/components/creator/OriginsManager.jsx, which writes the whole document with
// setDoc) and the Cloud Functions codebase (functions/src/schema/origin.ts re-exports this
// alongside the collection-level documentation the project's schema convention requires).
//
// Supersedes the legacy per-region `backgrounds` subcollection (see shared/schema/region.ts).

export const OriginDocumentSchema = z.object({
  name: z.string().describe("Origin display name."),
  description: z.string().default("").describe("Free-text copy, shown once in the origin intro dialog."),
  regionIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/regions/items the origin can be drawn in. An EMPTY array means unrestricted - " +
        'createCharacter treats "no regionIds" as valid everywhere, not as valid nowhere.'
    ),
  talentIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/talents/items granted at creation. Each is expanded into a full talent entry on " +
        'character.talents (quality 1, lastChangeCircumstance "Origine : <name>"); an id pointing at a ' +
        "deleted talent is silently skipped."
    ),
  profession: z
    .string()
    .default("")
    .describe(
      "A SINGLE id in worldData/professions/items (the field name is singular and holds one id, not a " +
        'display name and not an array), or "" for none. createCharacter resolves it to { id, name } and ' +
        "makes it the character's active profession at level 1."
    ),
  reputationStart: z
    .number()
    .default(0)
    .describe("The character's starting reputation, copied to character.reputation at creation."),
  startingItemIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/objects/items granted at creation. Each becomes one document in the top-level " +
        "`instances` collection (see shared/schema/instance.ts)."
    ),
});

export type OriginDocument = z.infer<typeof OriginDocumentSchema>;

const DEFAULTED_KEYS = [
  "description",
  "regionIds",
  "talentIds",
  "profession",
  "reputationStart",
  "startingItemIds",
] as const;

export const DEFAULTS = OriginDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
