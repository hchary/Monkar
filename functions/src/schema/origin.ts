// Canonical contract for `worldData/origins/items/{originId}`: the starting package drawn at random
// by createCharacter (functions/src/index.ts) once the player has chosen a region. Everything the
// origin grants is resolved and snapshotted onto the character at that moment - see
// functions/src/schema/character.ts's `origin` field - so editing an origin never changes a
// character already created from it.
//
// Authored through src/components/creator/OriginsManager.jsx, which writes the whole document with
// setDoc. Supersedes the legacy per-region `backgrounds` subcollection (see schema/region.ts).
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/origin.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { OriginDocumentSchema, DEFAULTS } from "../../../shared/schema/origin";
export type { OriginDocument } from "../../../shared/schema/origin";
