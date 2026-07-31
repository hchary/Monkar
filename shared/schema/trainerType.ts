import { z } from "zod";

// Structural contract for `worldData/trainerTypes/items/{trainerTypeId}` documents, shared between
// the client creator (src/components/creator/TrainerTypesManager.jsx, which writes the whole
// document with setDoc) and the Cloud Functions codebase (functions/src/schema/trainerType.ts
// re-exports this alongside the collection-level documentation the project's schema convention
// requires).
//
// Deliberately a stub - the full component (description, region, availability) is specified under
// "Entraîneurs" in docs/TODO.md and not implemented yet.

export const TrainerTypeDocumentSchema = z.object({
  name: z.string().describe('Trainer type display name, e.g. "Maître d\'armes".'),
});

export type TrainerTypeDocument = z.infer<typeof TrainerTypeDocumentSchema>;
