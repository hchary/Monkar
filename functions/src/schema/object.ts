// Canonical contract for `worldData/objects/items/{objectId}`: the catalog entry for an item type -
// the "what it is", as opposed to the `instances` collection's "the one this character owns" (see
// schema/instance.ts). Referenced by objectId from instances, recette ingredients/results,
// lootTable.itemIds and origin.startingItemIds.
//
// Authored through src/components/creator/ObjectsManager.jsx (single form, plus a bulk
// prefix/suffix generator), which writes the whole document with setDoc and, on delete, prunes the
// object's id out of every lootTable and recette referencing it.
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/object.ts so the client creator and this file
// can never drift; this file re-exports it under the location/name this project's schema
// convention expects, carrying the collection-level documentation above.
export { ObjectDocumentSchema, DEFAULTS } from "../../../shared/schema/object";
export type { ObjectDocument } from "../../../shared/schema/object";
