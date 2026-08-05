import { z } from "zod";

// Structural contract for `worldData/actionTypes/items/{actionTypeId}` documents, shared between
// the client creator (src/components/creator/ActionsManager.jsx, which writes the whole document
// with setDoc({ merge: true })) and the Cloud Functions codebase (functions/src/schema/actionType.ts
// re-exports this alongside the collection-level documentation the project's schema convention
// requires).
//
// Read together with functions/src/lib/actionCatalog.js: EVERY field below defaults at READ time
// rather than through a migration, so a document authored before a field existed stays valid.
// normalizeActionType is the single place those defaults live - the "absent means..." notes on
// each field describe what it does, they are not a second implementation.

const ActionAvailabilityConditionSchema = z
  .object({ type: z.string() })
  .passthrough()
  .describe(
    "One row of availability.conditions. `type` is one of the closed CONDITION_TYPES set " +
      "(hasTalent | hasTalentTag | minReputation | minLegendLevel | profession | region | " +
      "hasInstanceTag | notWounded); the remaining fields vary per type, hence `.passthrough()` " +
      "instead of a per-type discriminated union."
  );

export const ActionTypeDocumentSchema = z.object({
  label: z.string().describe('Action display name, e.g. "Partir en quête".'),
  description: z.string().default("").describe("Free-text copy shown in the action browser."),
  kindId: z
    .string()
    .describe(
      "The kind this action is an instance of, from ACTION_KINDS (functions/src/lib/actionKinds.js): " +
        "aventure | intermede | metier | social | recolte | artisanat. The kind tree is what gives an " +
        "action its inherited behaviour - anything under `metier` is profession-gated, under `recolte` " +
        "draws loot, under `artisanat` resolves a recette. Absent falls back to the legacy categoryId."
    ),
  categoryId: z
    .string()
    .optional()
    .describe(
      "LEGACY. No longer written - the category is derived at read time as the kind's root ancestor. " +
        "Still read as the kindId of documents authored before kinds existed."
    ),
  handlerId: z
    .string()
    .nullable()
    .default(null)
    .describe(
      'Names an entry in ACTION_HANDLERS (functions/src/index.js): "partirEnQuete" | "recolte" | ' +
        '"artisanat". There is no generic resolution path - an action whose handlerId is null or names ' +
        "an unregistered handler is refused before the transaction opens."
    ),
  professionIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/professions/items allowed to run this action. The mirror side of " +
        "profession.actionIds, written together in one batch (src/lib/professionActions.js). Forced to [] " +
        "for any kind outside the Métier branch. Turned into an implicit hasProfession condition by " +
        "resolveConditions - it is never an authored row."
    ),
  order: z.number().default(0).describe("Sort position within its category in the action browser."),
  enabled: z
    .boolean()
    .default(true)
    .describe("Absent means enabled: only an explicit false hides the action and refuses it server-side."),
  durationHours: z
    .number()
    .default(12)
    .describe(
      "How long the action occupies the character. Absent, zero, negative or non-numeric falls back to " +
        'DEFAULT_DURATION_HOURS (12) - this is what makes "one action per Interval" and "an action lasts ' +
        'one Interval" one rule rather than two clocks.'
    ),
  availability: z
    .object({
      conditions: z.array(ActionAvailabilityConditionSchema).default([]),
      unmetBehaviour: z.string().default("hide").describe('"hide" | "disable" (anything but "disable" reads as "hide").'),
      unmetMessage: z.string().default("").describe("Overrides the evaluator's default refusal text when non-empty."),
    })
    .default({ conditions: [], unmetBehaviour: "hide", unmetMessage: "" })
    .describe("Enforced server-side, not only in the UI."),
  result: z
    .object({
      accentSource: z.string().describe('"category" | "difficulty" - which value colours the result dialog.'),
      showLoot: z.boolean().describe("True only when explicitly true."),
    })
    .default({ accentSource: "category", showLoot: false }),
  lootTagIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/tags/items, matched by overlap against a lootTable's tagIds. Only meaningful " +
        "under the Récolte branch; forced to [] for every other kind."
    ),
  rarity: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "One of the 8 RARITIES, matched exactly against a lootTable's rarity. Only meaningful under the " +
        "Récolte branch; written as null for every other kind."
    ),
  recipeCategoryIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/tags/items - a recette qualifies when its own categoryIds overlaps this list. " +
        "Only meaningful under the Artisanat branch; forced to [] for every other kind."
    ),
  rumorHarvestCount: z
    .number()
    .default(1)
    .describe(
      "How many rare-or-above worldData/regions/items/{regionId}/rumorSightings entries the 'rumeur' " +
        "handler copies into character.rumorJournal per resolution. Only meaningful when handlerId is " +
        "\"rumeur\"; gated by handlerId rather than kindId since intermede hosts several unrelated " +
        "action archetypes, unlike the Récolte/Artisanat branches."
    ),
  missionRollCount: z
    .number()
    .default(3)
    .describe(
      'How many missions the "rumeur" handler generates into character.missionJournal per resolution, ' +
        'replacing whatever was still sitting there unclaimed. Only meaningful when handlerId is "rumeur", ' +
        "same gating convention as rumorHarvestCount."
    ),
  questDifficultyWeights: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Out of scope for the creator form, which preserves it via merge:true. Not read by the current quest handler."),
  tiers: z
    .array(z.unknown())
    .optional()
    .describe(
      "DEAD. The retired weighted-paliers roller's table. The framework no longer understands the field; " +
        "a leftover array on an old document is inert clutter, safe to delete by hand."
    ),
});

export type ActionTypeDocument = z.infer<typeof ActionTypeDocumentSchema>;

// ActionsManager's blank form. Note these are the values a *newly authored* document gets - a
// document that predates a field relies on normalizeActionType's read-time default instead.
const DEFAULTED_KEYS = [
  "description",
  "handlerId",
  "professionIds",
  "order",
  "enabled",
  "durationHours",
  "availability",
  "result",
  "lootTagIds",
  "rarity",
  "recipeCategoryIds",
  "rumorHarvestCount",
  "missionRollCount",
] as const;

export const DEFAULTS = ActionTypeDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
