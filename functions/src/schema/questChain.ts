// Canonical contract for `worldData/questChains/items/{chainId}`: an ordered sequence of
// { subjectId, difficulty } mission steps (functions/src/lib/questChains.js resolves step 1
// normally through the regular mission draw, then offers each later step exclusively once the
// previous one succeeds - see docs/TODO.md "Composite quests" and "Retiring quests and quest
// objectives for the subject-action system"). No creator UI - authored directly in the Firestore
// console.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/questChain.ts so a future client reader and
// this file can never drift; this file re-exports it under the location/name this project's
// schema convention expects, carrying the collection-level documentation above.
export { QuestChainDocumentSchema, DEFAULTS } from "../../../shared/schema/questChain";
export type { QuestChainDocument } from "../../../shared/schema/questChain";
