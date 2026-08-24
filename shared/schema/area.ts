import { z } from "zod";

// Structural contract for `worldData/areas/items/{areaId}` documents, shared between the client
// creator (src/components/creator/AreasManager.jsx, which writes the whole document with setDoc)
// and the Cloud Functions codebase (functions/src/schema/area.ts re-exports this alongside the
// collection-level documentation the project's schema convention requires).
//
// An Area is the terrain a region sits in (see shared/schema/region.ts's `areaId`). It is what
// mission generation filters the bestiary on: the monsters eligible in a region are the ones whose
// resolved `areaType` equals this document's `type` (see shared/schema/monster.ts). Several regions
// can share one Area.

export const AreaDocumentSchema = z.object({
  name: z.string().describe('French display name, e.g. "Marais de Ravenholm".'),
  type: z
    .string()
    .describe(
      "One of AREA_TYPES (shared/lib/areaTypes.ts): ville | marais | grotte | plaine | montagne | " +
        "desert | ruines_anciennes | volcan. The key mission generation matches a monster's resolved " +
        "areaType against - two Areas with the same type draw from the same monsters."
    ),
  tagIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/tags/items - the Area's own flavour tags. Descriptive only: the mission tag " +
        "pool comes from the target monster's resolved tagIds, not from here."
    ),
  lootTableIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/lootTables/items - the harvest pool for jobs run in this Area (docs/TODO.md " +
        "'Métier rework'). Loot tables survive for harvest only; mission loot draws from the target " +
        "monster's own lootItemIds instead."
    ),
});

export type AreaDocument = z.infer<typeof AreaDocumentSchema>;

// What a blank Area form writes when the creator saves without touching a field.
const DEFAULTED_KEYS = ["tagIds", "lootTableIds"] as const;

export const DEFAULTS = AreaDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
