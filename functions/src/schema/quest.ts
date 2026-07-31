// Canonical contract for `worldData/quests/items/{questId}`: a quest the partirEnQuete handler
// (functions/src/actions/partirEnQuete.js) can draw for a character. Authored through
// src/components/creator/QuestsManager.jsx, which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/quest.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { QuestDocumentSchema, DEFAULTS } from "../../../shared/schema/quest";
export type { QuestDocument } from "../../../shared/schema/quest";
