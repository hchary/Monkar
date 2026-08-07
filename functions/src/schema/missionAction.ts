// Canonical contract for `worldData/missionActions/items/{missionActionId}`: one half of the
// mission-name title-building pair (docs/TODO.md "Mission subject and action catalog"). Authored
// through src/components/creator/MissionActionsManager.jsx, which writes the whole document with
// setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/missionAction.ts so the client creator and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { MissionActionDocumentSchema, DEFAULTS } from "../../../shared/schema/missionAction";
export type { MissionActionDocument } from "../../../shared/schema/missionAction";
