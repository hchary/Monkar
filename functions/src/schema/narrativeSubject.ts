// Canonical contract for `worldData/narrativeSubjects/items/{subjectId}`: the "who/what" a
// generated sentence is about - the noun phrase substituted for {sujet} by
// functions/src/textGeneration.js. LEGACY: a subject carrying the reserved "objectif de quête" tag
// id used to double as a quest objective (`rarity`/`condition` below); that mechanic was retired by
// "Retiring quests and quest objectives for the subject-action system" (docs/TODO.md) - see
// shared/schema/narrativeSubject.ts for the field-level detail.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/narrativeSubject.ts so the two client creators
// and this file can never drift; this file re-exports it under the location/name this project's
// schema convention expects, carrying the collection-level documentation above.
export { NarrativeSubjectDocumentSchema, DEFAULTS } from "../../../shared/schema/narrativeSubject";
export type { NarrativeSubjectDocument } from "../../../shared/schema/narrativeSubject";
