import { z } from "zod";

// Structural contract for `worldData/trainerTypes/items/{trainerTypeId}` documents, shared between
// the client creator (src/components/creator/TrainerTypesManager.jsx, which writes the whole
// document with setDoc) and the Cloud Functions codebase (functions/src/schema/trainerType.ts
// re-exports this alongside the collection-level documentation the project's schema convention
// requires).
//
// locationId landed with the "S'entraîner" action (docs/TODO.md "Trainers").

export const TrainerTypeDocumentSchema = z.object({
  name: z.string().describe('Trainer type display name, e.g. "Maître d\'armes".'),
  description: z
    .string()
    .default("")
    .describe(
      'Free-text French description of what kind of trainer this represents, e.g. "Maître ' +
        'd\'armes" or "Sage ermite". Shown in the trainer type list in TrainerTypesManager.jsx.'
    ),
  locationId: z
    .string()
    .default("")
    .describe(
      "worldData/adventureZones/items id, where a character must be able to reach (via their " +
        "region's adventureZoneIds) to train with this trainer type. \"\" means unset - such a " +
        "trainer type is unreachable from anywhere, same empty-string-means-unset convention as " +
        "talent.trainerTypeId."
    ),
});

export type TrainerTypeDocument = z.infer<typeof TrainerTypeDocumentSchema>;
