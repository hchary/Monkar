// Canonical contract for `worldData/reliefs/items/{reliefId}`: a terrain feature a region can
// carry, referenced by region.reliefIds. Authored through src/components/creator/ReliefsManager.jsx
// (and the inline quick-create inside RegionsManager), which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/relief.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { ReliefDocumentSchema, DEFAULTS } from "../../../shared/schema/relief";
export type { ReliefDocument } from "../../../shared/schema/relief";
