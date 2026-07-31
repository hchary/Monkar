import { z } from "zod";

// Structural contract for a top-level `actionsLog/{logId}` document, shared between the Cloud
// Functions codebase (functions/src/schema/actionLog.ts extends this with the server-only
// Firestore timestamp type - see FirestoreTimestampOrSentinel there) and any client code that
// needs to read/validate a logged action.
//
// `createdAt` is declared as `z.unknown()` here - it holds either a Firestore `Timestamp` or a
// `FieldValue.serverTimestamp()` sentinel, both of which come from `firebase-admin/firestore` and
// cannot be imported into a browser bundle. The functions-side schema refines it to the real,
// validated type.
//
// Everything past the fields below is the handler's own payload, spread onto the document by
// performAction's transaction (functions/src/lib/actionPipeline.js) - there is no shared shape to
// document here: each handler decides what its `logFields` carry, see `resolve()` in
// functions/src/actions/*.js. `.passthrough()` reflects that this schema deliberately does not
// enumerate (or reject) those extra fields.

export const ActionLogDocumentSchema = z
  .object({
    characterId: z.string().describe("Id in `characters` - who acted."),
    ownerUid: z
      .string()
      .describe("Auth uid of the owning player. Denormalized from the character because the read rule needs it."),
    actionTypeId: z.string().describe("Id in worldData/actionTypes/items - what was performed."),
    date: z.string().describe("YYYY-MM-DD (UTC) the action was started."),
    createdAt: z
      .unknown()
      .describe(
        "Firestore Timestamp or serverTimestamp() sentinel; refined server-side (see functions/src/schema/actionLog.ts)."
      ),
  })
  .passthrough();

export type ActionLogDocument = z.infer<typeof ActionLogDocumentSchema>;
