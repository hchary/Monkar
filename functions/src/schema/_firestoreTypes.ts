// Shared functions-only helper for fields that hold a Firestore server timestamp: either a real
// `Timestamp` (once read back) or a `FieldValue.serverTimestamp()` sentinel (at write time). Both
// types come from `firebase-admin/firestore` and cannot be imported into a browser bundle, which
// is why the corresponding `shared/schema/*.ts` field is declared as `z.unknown()` and refined to
// this real type only in the functions-side wrapper - see `functions/src/schema/character.ts` for
// the original pattern this was factored out of.
import { z } from "zod";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

type FirestoreTimestampLike = Timestamp | FieldValue;

function isFirestoreTimestampLike(value: unknown): value is FirestoreTimestampLike {
  return value instanceof Timestamp || value instanceof FieldValue;
}

export const FirestoreTimestampOrSentinel = z
  .custom<FirestoreTimestampLike>(isFirestoreTimestampLike, {
    message: "must be a Firestore Timestamp or a serverTimestamp() sentinel",
  })
  .describe(
    "Firestore server timestamp; may be FieldValue.serverTimestamp() at write time, a Timestamp once read back."
  );
