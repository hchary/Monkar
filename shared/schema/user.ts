import { z } from "zod";

// Structural contract for the top-level `users/{uid}` document, shared between the Cloud Functions
// codebase (functions/src/schema/user.ts re-exports this alongside the collection-level
// documentation the project's schema convention requires) and any client code that needs to
// read/validate the account-level record.

export const UserDocumentSchema = z.object({
  role: z
    .string()
    .default("player")
    .describe(
      'Always "player" today - the only value any writer sets, and the only one firestore.rules lets a ' +
        "client create. Creator access does NOT come from this field: functions/scripts/setCreatorRole.js " +
        "sets an auth custom claim, which is what firestore.rules' isCreator() actually checks, and it " +
        "never touches this document."
    ),
  characterId: z.string().describe("Id in `characters` of the character created most recently for this user."),
});

export type UserDocument = z.infer<typeof UserDocumentSchema>;

const DEFAULTED_KEYS = ["role"] as const;

export const DEFAULTS = UserDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
