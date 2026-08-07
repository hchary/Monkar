// Canonical contract for `worldData/adventureZones/items/{zoneId}`: a quest/mission location
// ("lieu de quête"), referenced by mission.locationId, worldData/trainerTypes/items.locationId, and
// region.adventureZoneIds. Read by the mission/partirExplorer handlers
// (functions/src/actions/mission.js, functions/src/actions/partirExplorer.js) to fill the {lieu}
// placeholder in generated narration. Authored through
// src/components/creator/QuestLocationsManager.jsx, which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/adventureZone.ts so the client creator and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { AdventureZoneDocumentSchema, DEFAULTS } from "../../../shared/schema/adventureZone";
export type { AdventureZoneDocument } from "../../../shared/schema/adventureZone";
