// Canonical contract for `worldData/verbPhrases/items/{verbPhraseId}`: one authored sentence
// template the narrative engine can draw for a slot. functions/src/textGeneration.js assembles a
// quest narration from at most one phrase per slot, in the order opening -> climax -> talentGrowth;
// only climax is mandatory. Authored through src/components/creator/TextGenerationManager.jsx.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/verbPhrase.ts so the client creator and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { VerbPhraseDocumentSchema, DEFAULTS } from "../../../shared/schema/verbPhrase";
export type { VerbPhraseDocument } from "../../../shared/schema/verbPhrase";
