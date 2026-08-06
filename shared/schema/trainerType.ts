import { z } from "zod";

// Structural contract for `worldData/trainerTypes/items/{trainerTypeId}` documents, shared between
// the client creator (src/components/creator/TrainerTypesManager.jsx, which writes the whole
// document with setDoc) and the Cloud Functions codebase (functions/src/schema/trainerType.ts
// re-exports this alongside the collection-level documentation the project's schema convention
// requires).
//
// Still missing a description field - see "Trainer type creation page" in docs/TODO.md, not
// implemented yet. locationId landed with the "S'entraîner" action (docs/TODO.md "Trainers").

export const TrainerTypeDocumentSchema = z.object({
  name: z.string().describe('Trainer type display name, e.g. "Maître d\'armes".'),
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
