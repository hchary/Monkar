import { z } from "zod";
import { ActionAvailabilityConditionSchema } from "./actionType";

// Structural contract for `worldData/monsters/items/{monsterId}` documents, shared between the
// client creator (src/components/creator/MonstersManager.jsx, which writes the whole document with
// setDoc) and the Cloud Functions codebase (functions/src/schema/monster.ts re-exports this
// alongside the collection-level documentation the project's schema convention requires).
//
// The bestiary: the single catalog mission generation draws its target from, replacing the
// missionSubject/missionAction pair. A mission is "hunt this monster in this region", so a monster
// carries everything the mission needs - where it can be met (areaType), how rich its loot can get
// (difficulty), what talents it matches (tagIds), what it drops (lootItemIds) and what it teaches
// (talentRewardId).
//
// Monsters inherit prototypally through `parentId` ("dragon ancien" is a child of "dragon").
// Inheritance is resolved at READ time, in the Cloud Function (functions/src/lib/monsters.js's
// resolveMonster), with a cycle guard and a depth cap of 8 - never flattened at write time, which
// would force the creator to re-flatten every descendant on each parent edit. Per-field rules are
// on each field below: array fields concatenate down the chain, scalars take the first non-null.

export const MonsterDocumentSchema = z.object({
  name: z.string().describe('French base name, e.g. "dragon", "dragon ancien". Never inherited.'),
  difficulty: z
    .string()
    .describe(
      "One of the 6-tier DIFFICULTIES scale (facile..mythique - src/lib/difficulties.js). NOT a gate " +
        "on generation: the difficulty of a generated mission is drawn independently from the weighted " +
        "bag, and any monster of the region's area type can be the target at any tier. This value only " +
        "raises the loot rarity ceiling (docs/TODO.md 'Monster-pool loot': rarityMax = max(mission " +
        "difficulty index, this index)). First non-null wins along the parent chain."
    ),
  areaType: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "One of AREA_TYPES (shared/lib/areaTypes.ts). The area type this monster can be met in: " +
        "generation keeps the monsters whose resolved areaType equals the region's Area type (see " +
        "shared/schema/area.ts). Null means inherited from the parent chain; a monster whose whole " +
        "chain resolves to null can never be generated."
    ),
  parentId: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "Id in worldData/monsters/items this monster inherits from, or null for a root. The creator " +
        "page excludes self and every descendant from the picker, so cycles cannot be authored; the " +
        "server still guards against them when resolving."
    ),
  tagIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/tags/items - the talent-matching tags a mission against this monster carries " +
        "(they land on missionJournal[].tagIds and drive talent matching and loot). CONCATENATED with " +
        "the parent chain's, deduplicated: a child adds tags to its parent's, it does not replace them."
    ),
  lootItemIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/objects/items - the concrete pool a successful (or failed) hunt draws from, " +
        "replacing loot-table selection for missions (loot tables survive for harvest only, see " +
        "shared/schema/area.ts's lootTableIds). CONCATENATED with the parent chain's, deduplicated."
    ),
  talentRewardId: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "Id in worldData/talents/items granted at quality 1 on a successful hunt, if the character does " +
        "not already own it (docs/TODO.md 'Talent training roll and monster talent reward'). Null for " +
        "a monster that teaches nothing. First non-null wins along the parent chain."
    ),
  trigger: z
    .object({ conditions: z.array(ActionAvailabilityConditionSchema).default([]) })
    .nullable()
    .optional()
    .default(null)
    .describe(
      "Optional gate for automatic granting by the scheduled trigger sweep (same row shape as an " +
        "action's availability.conditions - see shared/schema/actionType.ts). Evaluated per character " +
        "every Interval tick (functions/src/lib/questTriggers.js); a character whose owned talents/" +
        "reputation/profession/region/etc. satisfy every condition has this monster's id added to " +
        "character.triggeredMonsterIds. Null/absent (default): this monster is never auto-granted - it " +
        "stays reachable only through the normal generation draw. Not inherited: a trigger is authored " +
        "on the exact monster it should grant. MOVED VERBATIM from the retired missionSubject.trigger."
    ),
});

export type MonsterDocument = z.infer<typeof MonsterDocumentSchema>;

// What a blank Monster form writes when the creator saves without touching a field - `name` and
// `difficulty` are always supplied by the form itself.
const DEFAULTED_KEYS = ["areaType", "parentId", "tagIds", "lootItemIds", "talentRewardId", "trigger"] as const;

export const DEFAULTS = MonsterDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
