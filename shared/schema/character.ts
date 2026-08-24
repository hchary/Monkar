import { z } from "zod";

// Structural contract for a `characters/{characterId}` document, shared between the Cloud
// Functions codebase (functions/src/schema/character.ts extends this with server-only Firestore
// timestamp types - see FirestoreTimestampOrSentinel there) and, in the future, any client code
// that needs to read/validate a character shape. Kept in `shared/` even though no client code
// writes a character document today: character is the component new features keep attaching to
// (professions, talents, wounds, actions, ...), so it follows the shared-first pattern from the
// start rather than needing a later migration the moment a client feature needs it.
//
// `createdAt`/`lastActionAt` are declared as `z.unknown()` here - they hold either a Firestore
// `Timestamp` or a `FieldValue.serverTimestamp()` sentinel, both of which come from
// `firebase-admin/firestore` and cannot be imported into a browser bundle. The functions-side
// schema refines them to the real, validated type.

export const CharacterDocumentSchema = z.object({
  ownerUid: z.string().describe("Auth uid of the owning player. Set once at creation, never changes."),
  name: z.string().describe("Player-chosen character name."),
  age: z.number().default(18).describe("Character age in years."),
  region: z.object({ id: z.string(), name: z.string() }).describe("{ id, name } of the starting region."),
  origin: z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      profession: z.object({ id: z.string(), name: z.string() }).nullable(),
      reputationStart: z.number(),
      talents: z.array(z.object({ id: z.string(), name: z.string() })),
      items: z.array(z.object({ id: z.string(), name: z.string() })),
    })
    .describe(
      "Snapshot of the origin drawn at creation. profession is resolved from worldData/professions/items, " +
        "not the raw professionId stored on the origin document."
    ),
  originIntroSeen: z.boolean().default(false).describe("Whether the player has dismissed the origin intro dialog."),
  title: z.string().default("").describe("Character's earned title, if any."),
  profession: z.string().describe("Display copy of the starting profession name (see origin.profession)."),
  professionId: z
    .string()
    .optional()
    .describe("Id of the currently active profession. Absent until the player picks one via switchKnownProfession."),
  professionLevel: z
    .number()
    .optional()
    .describe("Mastery level in the active profession. Absent alongside professionId."),
  knownProfessions: z
    .array(z.object({ professionId: z.string(), level: z.number() }))
    .optional()
    .describe("Every profession ever held. Absent until the first switch."),
  reputation: z
    .number()
    .describe(
      "LEGACY. The single global reputation score, starting at origin.reputationStart. Superseded by " +
        "`reputations` below, which is per-region (docs/TODO.md 'Per-region reputation'); kept as a " +
        "field so documents written before the migration stay schema-valid, and so " +
        "functions/scripts/migrateReputationToPerRegion.js has something to read. Written by createCharacter " +
        "(functions/src/index.ts) and kept in step with `reputations` by functions/src/lib/actionResult.js's " +
        "applier, so the readers that have not moved to the map yet (CharacterBanner.jsx, the minReputation " +
        "condition) do not see a frozen score; both writes go away with docs/TODO.md 'Per-region reputation'."
    ),
  reputations: z
    .record(z.string(), z.number())
    .default({})
    .describe(
      "{ [regionId]: score } - reputation held in each worldData/regions/items entry, replacing the " +
        "single `reputation` above. Seeded at creation with the origin's reputationStart under the " +
        "starting region's id, and seeded to 1 for a region the character travels to for the first " +
        "time (docs/TODO.md 'Travel action (Voyager)'). Gains and losses are zero-sum across regions " +
        "and always name the region they apply to; the `minReputation` condition and every UI reading " +
        "reputation use the entry for the region the character currently stands in. Written by " +
        "functions/src/lib/actionResult.js's applier, the single place any action's reputation lands."
    ),
  legendLevel: z.number().nullable().default(null).describe("Legendary tier, null until the first legendary roll."),
  alive: z.boolean().default(true).describe("False once the character has died."),
  gold: z.number().default(0),
  inventory: z
    .array(z.unknown())
    .default([])
    .describe("Reserved; item ownership is currently tracked via the separate `instances` collection instead."),
  talents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      quality: z.number(),
      trainable: z.boolean(),
      rarity: z.string(),
      effect: z.string(),
      tagIds: z.array(z.string()),
      lastChangeDate: z.string(),
      lastChangeCircumstance: z.string(),
    })
  ),
  rumorJournal: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        rarity: z.string(),
        receivedAt: z.string(),
      })
    )
    .default([])
    .describe(
      "LEGACY/dead: rumors personally harvested via the former 'rumeur' handler, before its rumor-" +
        "harvesting half was removed and it was renamed 'recherche' (functions/src/actions/recherche.js). " +
        "No longer read or written by any code, and worldData/rumors/items and " +
        "worldData/regions/items/{regionId}/rumorSightings (the catalog/journal it copied from) no longer " +
        "exist either; kept here only so existing documents carrying the field stay schema-valid."
    ),
  missionJournal: z
    .array(
      z.object({
        id: z.string(),
        targetMonsterId: z.string(),
        subjectId: z.string().optional(),
        actionId: z.string().optional(),
        name: z.string(),
        difficulty: z.string(),
        tagIds: z.array(z.string()),
        locationId: z.string(),
        regionId: z.string(),
        generatedAt: z.string(),
      })
    )
    .default([])
    .describe(
      "Missions procedurally generated by the 'recherche' handler, resolved by the 'mission' handler " +
        "(functions/src/actions/mission.js). A rolling offer, not a history: entirely replaced every time " +
        "the 'recherche' handler resolves again, and an entry is removed once the 'mission' handler " +
        "resolves it. targetMonsterId is the worldData/monsters/items entry the mission hunts " +
        "(docs/TODO.md 'Mission generation from the bestiary'); name is the already-assembled title so " +
        "resolution never needs to re-fetch the catalog entry, and tagIds is that monster's resolved tag " +
        "list (its own tagIds concatenated with its parent chain's). LEGACY: subjectId/actionId held the " +
        "worldData/missionSubjects/items and worldData/missionActions/items ids drawn by the retired " +
        "subject-action generation, and older entries still carried objectiveId (an id in the retired " +
        "worldData/narrativeSubjects/items collection); both are stale rolling-offer data that get " +
        "overwritten by the next 'recherche' resolution, not migrated - hence targetMonsterId is required " +
        "and the two legacy ids are optional."
    ),
  triggeredMonsterIds: z
    .array(z.string())
    .default([])
    .describe(
      "worldData/monsters/items ids already granted by the scheduled trigger sweep " +
        "(functions/src/lib/questTriggers.js), which runs once per Interval tick. A monster id lands " +
        "here the moment its trigger.conditions first match this character, whether or not the player " +
        "has seen the notification yet, so a later re-evaluation never re-triggers or re-notifies the " +
        "same monster. Which of these are still unseen (for the result pop-up's notification page) is " +
        "tracked client-side, not here - see src/components/actions/ActionResultDialog.jsx. Also gains " +
        "a monster id whenever a worldData/questChains/items step beyond the first is granted by " +
        "functions/src/actions/mission.js's resolve() (see questChainProgress above) - same arrayUnion " +
        "write, same notification pipeline, no separate field. REPLACES triggeredSubjectIds below."
    ),
  triggeredSubjectIds: z
    .array(z.string())
    .default([])
    .describe(
      "LEGACY. The same list keyed on the retired worldData/missionSubjects/items collection, before " +
        "the bestiary replaced it; itself renamed from triggeredQuestIds (worldData/quests/items ids) " +
        "one migration earlier. Migrated into triggeredMonsterIds above by " +
        "functions/scripts/migrateTriggeredSubjectsToMonsters.js, then no longer read or written; kept " +
        "here so documents carrying the field stay schema-valid."
    ),
  questChainProgress: z
    .record(z.string(), z.number())
    .default({})
    .describe(
      "{ [chainId]: number }, worldData/questChains/items ids to the number of that chain's steps " +
        "completed so far (0 = not started; an index into the chain's steps this character has " +
        "cleared). Bumped by functions/src/actions/mission.js's resolve() whenever a mission whose " +
        "{ monsterId, difficulty } belongs to a chain succeeds and isn't that chain's last step, in " +
        "the same write that pushes the next step's monster id into triggeredMonsterIds below."
    ),
  blessings: z.array(z.unknown()).default([]).describe("Reserved, not yet populated by any handler."),
  curses: z.array(z.unknown()).default([]).describe("Reserved, not yet populated by any handler."),
  woundsLight: z.number().default(0),
  woundsSevere: z.number().default(0),
  woundsPermanent: z.number().default(0),
  fatigue: z
    .number()
    .default(0)
    .describe(
      "Accumulates +1 per encounter round resolved by the 'partirExplorer' handler " +
        "(functions/src/actions/partirExplorer.js), regardless of that round's success/failure. Nothing " +
        "reads or recovers it yet - see docs/TODO.md 'Aventure exploration mechanics'."
    ),
  intermedeActionsThisInterval: z
    .number()
    .default(0)
    .describe(
      "Bonus Intermède actions performed so far this Interval (docs/TODO.md 'Intermède actions'), " +
        "capped at 3 and shared across both Intermède windows. Incremented by handlers whose kind " +
        "draws from this budget (functions/src/lib/actionKinds.js's actionUsesIntermedeBudget, e.g. " +
        "'faireDuCommerce'), gated by the implicit 'hasIntermedeBudget' condition " +
        "(actionConditions.js). Reset to 0 by the scheduled sweepQuestTriggers tick " +
        "(functions/src/lib/questTriggers.js), as a sibling pass to quest triggers rather than a " +
        "second cron schedule. Fully decoupled from lastAction/lastActionDate: actions drawing from " +
        "this budget never touch the main action lock (functions/src/lib/actionPipeline.js)."
    ),
  missionsSinceRenseignement: z
    .number()
    .default(0)
    .describe(
      "Legacy/dead (docs/TODO.md 'Se renseigner intermède action'): used to count missions " +
        "resolved since 'Se renseigner' last resolved, gating an implicit 'renseignementAvailable' " +
        "condition. 'Se renseigner' must always be available with no condition, so the gate and " +
        "this counter's writers (functions/src/actions/mission.js's resolve(), " +
        "functions/src/actions/recherche.js's resolve()) were removed. No longer read or written by " +
        "any code; kept here only so existing documents carrying the field stay schema-valid."
    ),
  lastActionDate: z.string().nullable().default(null).describe("YYYY-MM-DD of the last performed action."),
  lastActionAt: z
    .unknown()
    .nullable()
    .default(null)
    .describe("Firestore Timestamp or serverTimestamp() sentinel; refined server-side (see functions/src/schema/character.ts)."),
  lastAction: z
    .unknown()
    .nullable()
    .default(null)
    .describe(
      "Shape varies per handler (see functions/src/actions/*.js); always carries the lifecycle envelope " +
        "stamped by actionEffects.js's stampLifecycle."
    ),
  createdAt: z
    .unknown()
    .describe("Firestore Timestamp or serverTimestamp() sentinel; refined server-side (see functions/src/schema/character.ts)."),
});

export type CharacterDocument = z.infer<typeof CharacterDocumentSchema>;

// Static values every new character starts with - anything computed from the region/origin draw
// (name, region, origin, profession, reputation, talents, ownerUid, createdAt) is set explicitly
// by createCharacter instead of living here. DEFAULTS is *derived*, not hand-duplicated: `.pick()`
// references the same field definitions (including their `.default()`), so it can never drift
// from the schema above.
const DEFAULTED_KEYS = [
  "age",
  "originIntroSeen",
  "title",
  "legendLevel",
  "alive",
  "gold",
  "inventory",
  "rumorJournal",
  "missionJournal",
  "reputations",
  "triggeredMonsterIds",
  "triggeredSubjectIds",
  "questChainProgress",
  "blessings",
  "curses",
  "woundsLight",
  "woundsSevere",
  "woundsPermanent",
  "fatigue",
  "intermedeActionsThisInterval",
  "missionsSinceRenseignement",
  "lastActionDate",
  "lastActionAt",
  "lastAction",
] as const;

export const DEFAULTS = CharacterDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
