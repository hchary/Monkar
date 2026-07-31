import { z } from "zod";

// Structural contract for `worldData/reliefs/items/{reliefId}` documents, shared between the
// client creator (src/components/creator/ReliefsManager.jsx, and the inline quick-create inside
// RegionsManager, both of which write the whole document with setDoc) and the Cloud Functions
// codebase (functions/src/schema/relief.ts re-exports this alongside the collection-level
// documentation the project's schema convention requires).

export const ReliefDocumentSchema = z.object({
  name: z.string().describe('Relief display name, e.g. "Falaises".'),
  description: z.string().default("").describe("Free-text flavour copy, shown as a tooltip in the region form."),
});

export type ReliefDocument = z.infer<typeof ReliefDocumentSchema>;

const DEFAULTED_KEYS = ["description"] as const;

export const DEFAULTS = ReliefDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
