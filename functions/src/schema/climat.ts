// Canonical contract for `worldData/climats/items/{climatId}`: the weather/biome a region is set
// in, referenced by region.climatId. Authored through src/components/creator/ClimatsManager.jsx,
// which writes the whole document with setDoc.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/climat.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { ClimatDocumentSchema, DEFAULTS } from "../../../shared/schema/climat";
export type { ClimatDocument } from "../../../shared/schema/climat";
