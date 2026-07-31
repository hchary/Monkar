// Canonical contract for the top-level `instances` collection: one document per physical item a
// character owns - the counterpart of worldData/objects/items, which describes the item TYPE.
// Quantity is not a field: owning three ropes means three Instance documents, which is what lets
// artisanat consume ingredients by deleting one document per unit.
//
// firestore.rules allows read on ownerUid and refuses every client write, so Cloud Functions
// (Admin SDK) are the sole writer. Created by createCharacter (origin starting items) and by the
// recolte / partirEnQuete / artisanat handlers' commit hooks; deleted by artisanat when an
// ingredient is consumed.
//
// Note for readers: a client query must filter on BOTH ownerUid and characterId - filtering on
// characterId alone cannot prove to Firestore that every match satisfies the ownerUid rule, so the
// whole query is denied (see src/components/InventoryTab.jsx).
//
// The document id is the Firestore key, never a field.
//
// The field contract itself lives in shared/schema/instance.ts so this file can never drift from
// it; this file re-exports it under the location/name this project's schema convention expects,
// carrying the collection-level documentation above.
export { InstanceDocumentSchema, DEFAULTS } from "../../../shared/schema/instance";
export type { InstanceDocument } from "../../../shared/schema/instance";
