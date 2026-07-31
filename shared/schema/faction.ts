import { z } from "zod";

// Structural contract for `worldData/factions/items/{factionId}` documents, shared between the
// client creator (src/components/creator/FactionsManager.jsx, which writes the whole document with
// setDoc) and the Cloud Functions codebase (functions/src/schema/faction.ts re-exports this
// alongside the collection-level documentation the project's schema convention requires).
//
// No game mechanic reads factions yet - they are content the world model already carries.

export const FactionDocumentSchema = z.object({
  name: z.string().describe("Faction display name."),
  description: z.string().default("").describe("Free-text flavour copy."),
});

export type FactionDocument = z.infer<typeof FactionDocumentSchema>;

const DEFAULTED_KEYS = ["description"] as const;

export const DEFAULTS = FactionDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
