// Canonical contract for `worldData/questChains/items/{chainId}`: an ordered sequence of quests
// (functions/src/actions/partirEnQuete.js draws step 1 normally, then offers each later step
// exclusively once the previous one succeeds - see docs/TODO.md "Composite quests (spec
// needed)"). No creator UI - authored directly in the Firestore console.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/questChain.ts so a future client reader and
// this file can never drift; this file re-exports it under the location/name this project's
// schema convention expects, carrying the collection-level documentation above.
export { QuestChainDocumentSchema, DEFAULTS } from "../../../shared/schema/questChain";
export type { QuestChainDocument } from "../../../shared/schema/questChain";
