// Canonical contract for `worldData/rumors/items/{rumorId}`: a hand-authored piece of flavor text
// with a rarity and an optional quest link. Read by the "rumeur" handler
// (functions/src/actions/rumeur.js) to harvest a character's current region's rumorSightings, and
// by RumorsManager.jsx to seed those sightings at its originRegionIds on save. Authored through
// src/components/creator/RumorsManager.jsx, which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/rumor.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { RumorDocumentSchema, DEFAULTS } from "../../../shared/schema/rumor";
export type { RumorDocument } from "../../../shared/schema/rumor";
