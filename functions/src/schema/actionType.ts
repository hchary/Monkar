// Canonical contract for `worldData/actionTypes/items/{actionTypeId}`: an action a character can
// perform. Read by functions/src/lib/actionPipeline.js on every performAction call, and by the
// player's action browser.
//
// Authored through src/components/creator/ActionsManager.jsx, which writes with setDoc({ merge: true })
// inside a batch that also maintains the actionType <-> profession link on both ends. merge:true is
// deliberate: it leaves fields this form does not own (questDifficultyWeights) untouched.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/actionType.ts so the client creator and this
// file can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { ActionTypeDocumentSchema, DEFAULTS } from "../../../shared/schema/actionType";
export type { ActionTypeDocument } from "../../../shared/schema/actionType";
