// Canonical contract for `worldData/talents/items/{talentId}`: a skill a character can hold.
// Granted at creation by an origin (createCharacter snapshots id/name/quality/trainable/rarity/
// effect/tagIds onto character.talents - see functions/src/schema/character.ts) and progressed by
// quests through functions/src/lib/talentEvolution.js.
//
// Authored through src/components/creator/TalentsManager.jsx, which writes the whole document with
// setDoc inside a batch that also maintains the bidirectional ancestor/descendant links.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/talent.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { TalentDocumentSchema, DEFAULTS } from "../../../shared/schema/talent";
export type { TalentDocument } from "../../../shared/schema/talent";
