// Canonical contract for `worldData/missionSubjects/items/{missionSubjectId}`: the other half of
// the mission-name title-building pair (docs/TODO.md "Mission subject and action catalog").
// Authored through src/components/creator/MissionSubjectsManager.jsx, which writes the whole
// document with setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/missionSubject.ts so the client creator and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { MissionSubjectDocumentSchema, DEFAULTS } from "../../../shared/schema/missionSubject";
export type { MissionSubjectDocument } from "../../../shared/schema/missionSubject";
