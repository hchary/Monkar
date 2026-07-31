// Canonical contract for `worldData/regions/items/{regionId}`: the map's top-level area, picked by
// the player at character creation (see createCharacter in functions/src/index.ts). Authored
// exclusively through the creator UI (src/components/creator/RegionsManager.jsx), which writes the
// whole document with setDoc - every field below is always present on a document saved by that
// form, so a new attribute is added here first, then wired into the form.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself (including the legacy `backgrounds` subcollection's shape) lives in
// shared/schema/region.ts so the client creator and this file can never drift; this file re-exports
// it under the location/name this project's schema convention expects, carrying the
// collection-level documentation above.
export {
  RegionDocumentSchema,
  DEFAULTS,
  RegionBackgroundDocumentSchema,
} from "../../../shared/schema/region";
export type { RegionDocument, RegionBackgroundDocument } from "../../../shared/schema/region";
