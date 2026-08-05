// Canonical contract for `worldData/regions/items/{regionId}/rumorSightings/{rumorId}`: one per
// rumor currently present in that region, holding its effective (possibly decayed) rarity there.
// Seeded at a rumor's originRegionIds by RumorsManager.jsx on save; read by the "rumeur" handler
// (functions/src/actions/rumeur.js) to harvest a character's current region, and by the client
// rumor banner. Periodic propagation to neighboring regions is not implemented yet - see
// docs/TODO.md "Rumor and mission system", "Still open".
//
// The rumor id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/regionRumorSighting.ts so the client and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, refining `arrivedAt` to the real, validated server-only type (see
// functions/src/schema/character.ts for why - same FirestoreTimestampOrSentinel reason).
import type { z } from "zod";
import { RegionRumorSightingDocumentSchema as SharedRegionRumorSightingDocumentSchema } from "../../../shared/schema/regionRumorSighting";
import { FirestoreTimestampOrSentinel } from "./_firestoreTypes";

export const RegionRumorSightingDocumentSchema = SharedRegionRumorSightingDocumentSchema.extend({
  arrivedAt: FirestoreTimestampOrSentinel,
});

export type RegionRumorSightingDocument = z.infer<typeof RegionRumorSightingDocumentSchema>;
