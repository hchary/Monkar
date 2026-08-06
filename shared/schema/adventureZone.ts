import { z } from "zod";

// Structural contract for `worldData/adventureZones/items/{zoneId}` documents, shared between the
// client creator (src/components/creator/QuestLocationsManager.jsx, which writes the whole
// document with setDoc) and the Cloud Functions codebase (functions/src/schema/adventureZone.ts
// re-exports this alongside the collection-level documentation the project's schema convention
// requires).

export const AdventureZoneDocumentSchema = z.object({
  name: z.string().describe("Location display name, substituted for {lieu} in verb-phrase templates."),
  description: z.string().default("").describe("Free-text flavour copy."),
  tagIds: z
    .array(z.string())
    .default([])
    .describe(
      "worldData/tags/items ids describing this location's flavour (e.g. forest, coastal village, ruins). " +
        "Read by functions/src/textGeneration.js once the narrative grammar's opening slot is flavoured by " +
        "location, alongside quest and talent tags."
    ),
});

export type AdventureZoneDocument = z.infer<typeof AdventureZoneDocumentSchema>;

const DEFAULTED_KEYS = ["description", "tagIds"] as const;

export const DEFAULTS = AdventureZoneDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
