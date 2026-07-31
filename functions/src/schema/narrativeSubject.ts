// Canonical contract for `worldData/narrativeSubjects/items/{subjectId}`: the "who/what" a
// generated sentence is about - the noun phrase substituted for {sujet} by
// functions/src/textGeneration.js. A subject tagged with the literal string "objectif de quête"
// (QuestObjectivesManager's OBJECTIVE_TAG) doubles as a quest objective and is what quest.objectiveIds
// point at; there is no separate collection for objectives.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/narrativeSubject.ts so the two client creators
// and this file can never drift; this file re-exports it under the location/name this project's
// schema convention expects, carrying the collection-level documentation above.
export { NarrativeSubjectDocumentSchema, DEFAULTS } from "../../../shared/schema/narrativeSubject";
export type { NarrativeSubjectDocument } from "../../../shared/schema/narrativeSubject";
