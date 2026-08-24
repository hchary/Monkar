// Canonical contract for `worldData/areas/items/{areaId}`: the terrain a region sits in, and the
// filter mission generation runs the bestiary through (docs/TODO.md "Area and Monster contracts").
// Authored through src/components/creator/AreasManager.jsx, which writes the whole document with
// setDoc.
//
// The document id is the Firestore key, never a field. A region points at its Area through
// region.areaId; several regions can share one Area.
//
// The field contract itself lives in shared/schema/area.ts so the client creator and this file can
// never drift; this file re-exports it under the location/name this project's schema convention
// expects, carrying the collection-level documentation above.
export { AreaDocumentSchema, DEFAULTS } from "../../../shared/schema/area";
export type { AreaDocument } from "../../../shared/schema/area";
