// Canonical contract for the `characters` collection: every field a character document may
// hold, its shape, and its default at creation (if static). firestore.rules locks characters
// `create`/`update` to isCreator() only, so Cloud Functions (Admin SDK) are the sole writer for
// every field below - a new attribute is added here first, then wired into whichever Cloud
// Function or action handler is responsible for setting it, instead of being inferred by reading
// createCharacter's object literal.
//
// Every field except `createdAt`/`lastActionAt` lives in shared/schema/character.ts, so this
// collection's structural contract can be reused by client code the moment it needs to
// read/validate a character (see that file's header comment for why). Those two fields hold a
// Firestore Timestamp or a FieldValue.serverTimestamp() sentinel - both server-only types from
// firebase-admin/firestore - so they're declared here instead, refining the shared `z.unknown()`
// placeholders to the real, validated type.
import { z } from "zod";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { CharacterDocumentSchema as SharedCharacterDocumentSchema, DEFAULTS } from "../../../shared/schema/character";

type FirestoreTimestampLike = Timestamp | FieldValue;

function isFirestoreTimestampLike(value: unknown): value is FirestoreTimestampLike {
  return value instanceof Timestamp || value instanceof FieldValue;
}

const FirestoreTimestampOrSentinel = z
  .custom<FirestoreTimestampLike>(isFirestoreTimestampLike, {
    message: "must be a Firestore Timestamp or a serverTimestamp() sentinel",
  })
  .describe(
    "Firestore server timestamp; may be FieldValue.serverTimestamp() at write time, a Timestamp once read back."
  );

export const CharacterDocumentSchema = SharedCharacterDocumentSchema.extend({
  lastActionAt: FirestoreTimestampOrSentinel.nullable().default(null),
  createdAt: FirestoreTimestampOrSentinel,
});

export type CharacterDocument = z.infer<typeof CharacterDocumentSchema>;

export { DEFAULTS };
