// Canonical contract for the top-level `users` collection, keyed by the player's auth uid: the
// account-level record, as opposed to `characters` which holds the in-game persona.
//
// Written only by createCharacter (functions/src/index.ts) with merge:true. firestore.rules lets a
// signed-in user read and create their own document but never update or delete it, so `role` cannot
// be self-granted from the client.
//
// The document id IS the auth uid, never a field.
//
// The field contract itself lives in shared/schema/user.ts so this file can never drift from it;
// this file re-exports it under the location/name this project's schema convention expects,
// carrying the collection-level documentation above.
export { UserDocumentSchema, DEFAULTS } from "../../../shared/schema/user";
export type { UserDocument } from "../../../shared/schema/user";
