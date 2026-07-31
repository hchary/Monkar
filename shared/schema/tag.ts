import { z } from "zod";

// Structural contract for `worldData/tags/items/{tagId}` documents, shared between the client
// creator (src/components/creator/TagsManager.jsx, which writes the whole document with setDoc)
// and the Cloud Functions codebase (functions/src/schema/tag.ts re-exports this alongside the
// collection-level documentation the project's schema convention requires).

export const TagDocumentSchema = z.object({
  name: z.string().describe("Tag display name. The only field a tag has."),
});

export type TagDocument = z.infer<typeof TagDocumentSchema>;
