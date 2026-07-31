// Canonical contract for the top-level `actionsLog` collection: one document per action a character
// performed, written inside performAction's transaction (functions/src/lib/actionPipeline.js).
// Append-only history - nothing updates or deletes a log entry.
//
// firestore.rules allows read on ownerUid (or any creator) and refuses every client write, so Cloud
// Functions (Admin SDK) are the sole writer.
//
// The document id is the Firestore key, never a field.
//
// Every field except `createdAt` lives in shared/schema/actionLog.ts, so this collection's
// structural contract can be reused by client code the moment it needs to read/validate a logged
// action. `createdAt` holds a Firestore Timestamp or a FieldValue.serverTimestamp() sentinel - a
// server-only type from firebase-admin/firestore - so it's declared here instead, refining the
// shared `z.unknown()` placeholder to the real, validated type.
import { z } from "zod";
import { ActionLogDocumentSchema as SharedActionLogDocumentSchema } from "../../../shared/schema/actionLog";
import { FirestoreTimestampOrSentinel } from "./_firestoreTypes";

export const ActionLogDocumentSchema = SharedActionLogDocumentSchema.extend({
  createdAt: FirestoreTimestampOrSentinel,
});

export type ActionLogDocument = z.infer<typeof ActionLogDocumentSchema>;
