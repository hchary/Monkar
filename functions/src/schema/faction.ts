// Canonical contract for `worldData/factions/items/{factionId}`: an organisation present in one or
// more regions, referenced by region.factionIds. Authored through
// src/components/creator/FactionsManager.jsx, which writes the whole document with setDoc.
//
// No game mechanic reads factions yet - they are content the world model already carries.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/faction.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { FactionDocumentSchema, DEFAULTS } from "../../../shared/schema/faction";
export type { FactionDocument } from "../../../shared/schema/faction";
