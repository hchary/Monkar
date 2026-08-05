import { z } from "zod";

// Structural contract for `worldData/regions/items/{regionId}/rumorSightings/{rumorId}` documents:
// one per rumor currently present in that region, holding its *effective* rarity there (decayed
// one tier per hop from wherever it propagated from - see docs/TODO.md "Rumor and mission
// system"). Shared between the client creator (RumorsManager.jsx seeds one of these per
// originRegionId at the rumor's own authored rarity) and the Cloud Functions codebase
// (functions/src/schema/regionRumorSighting.ts re-exports this alongside the collection-level
// documentation the project's schema convention requires). `arrivedAt` is declared as
// `z.unknown()` here for the same reason character.createdAt is - it holds a Firestore Timestamp
// or serverTimestamp() sentinel, refined server-side.

export const RegionRumorSightingDocumentSchema = z.object({
  rarity: z
    .string()
    .describe(
      "One of the 8 RARITIES - this rumor's effective rarity at this region, not necessarily its " +
        "catalog rarity (worldData/rumors/items/{rumorId}.rarity), which only applies at the origin."
    ),
  arrivedAt: z.unknown().describe("Firestore Timestamp or serverTimestamp() sentinel; refined server-side."),
});

export type RegionRumorSightingDocument = z.infer<typeof RegionRumorSightingDocumentSchema>;
