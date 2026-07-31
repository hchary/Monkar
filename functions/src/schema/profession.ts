// Canonical contract for `worldData/professions/items/{professionId}`: a "métier" a character can
// practise. The document id is what character.professionId, character.knownProfessions[].professionId
// and origin.profession all store - the name below is display copy only.
//
// Authored through src/components/creator/ProfessionsManager.tsx, which writes the whole document
// with setDoc inside a batch that also maintains the profession <-> actionType link on both ends.
// Cloud Functions only read this collection (createCharacter resolves origin.profession to
// { id, name } here - functions/src/index.ts).
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/profession.ts so the client creator and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { ProfessionDocumentSchema, DEFAULTS } from "../../../shared/schema/profession";
export type { ProfessionDocument } from "../../../shared/schema/profession";
