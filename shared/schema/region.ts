import { z } from "zod";

// Structural contract for `worldData/regions/items/{regionId}` documents, shared between the
// client creator (src/components/creator/RegionsManager.jsx, which writes the whole document with
// setDoc - every field below is always present on a document saved by that form) and the Cloud
// Functions codebase (functions/src/schema/region.ts re-exports this alongside the collection-level
// documentation the project's schema convention requires).

export const RegionDocumentSchema = z.object({
  name: z.string().describe('Region display name, e.g. "Côte des Brumes".'),
  nameSuggestions: z
    .array(z.string())
    .default([])
    .describe("Character-name ideas offered by the creation form for this region."),
  description: z.string().default("").describe("Free-text flavour copy."),
  neighbors: z
    .array(z.object({ regionId: z.string(), direction: z.string() }))
    .default([])
    .describe(
      "Adjacent regions. direction is one of nord | sud | est | ouest. Stored on one side only - the " +
        "form does not mirror the edge onto the neighbour."
    ),
  climatId: z.string().default("").describe('Id in worldData/climats/items, or "" when the region has no climate.'),
  climateIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/climats/items this region draws mission Subjects from (docs/TODO.md 'Regional " +
        "mission generation and journal') - a region bordering several biomes can list more than one. " +
        "Distinct from the single climatId above (which only drives the character page's banner " +
        "illustration); the two are not kept in sync automatically."
    ),
  reliefIds: z.array(z.string()).default([]).describe("Ids in worldData/reliefs/items."),
  factionIds: z.array(z.string()).default([]).describe("Ids in worldData/factions/items."),
  adventureZoneIds: z
    .array(z.string())
    .default([])
    .describe("Ids in worldData/adventureZones/items - the quest locations reachable here."),
  originIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/origins/items. Advisory only: createCharacter draws from the origin's own " +
        "regionIds, not from this list."
    ),
});

export type RegionDocument = z.infer<typeof RegionDocumentSchema>;

// What RegionsManager's blank form writes when the creator saves without touching a field.
const DEFAULTED_KEYS = [
  "nameSuggestions",
  "description",
  "neighbors",
  "climatId",
  "climateIds",
  "reliefIds",
  "factionIds",
  "adventureZoneIds",
  "originIds",
] as const;

export const DEFAULTS = RegionDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});

// LEGACY. Structural contract for the retired `worldData/regions/items/{regionId}/backgrounds/{backgroundId}`
// subcollection: the per-region starting package that predates worldData/origins/items. Still
// editable through RegionsManager's "Editer les origines" panel and still seeded by
// functions/scripts/seedWorldData.js, but nothing reads it any more - createCharacter draws an
// Origin instead (see shared/schema/origin.ts). Documented here so the shape is not lost; do not
// add fields to it.
export const RegionBackgroundDocumentSchema = z.object({
  name: z.string(),
  profession: z.string().describe("Display copy of a profession name, not a professions/items id."),
  weight: z.number().describe("Relative draw weight among this region's backgrounds."),
  reputationStart: z.number(),
  startingGold: z.number(),
  startingItems: z.array(z.object({ name: z.string(), qty: z.number() })).describe("Free-text names, not objects/items ids."),
});

export type RegionBackgroundDocument = z.infer<typeof RegionBackgroundDocumentSchema>;
