import { z } from "zod";

// Structural contract for a `worldData/professions/items/{professionId}` document, shared
// between the client creator (src/components/creator/ProfessionsManager.tsx, which writes the
// whole document) and the Cloud Functions codebase (functions/src/schema/profession.ts
// re-exports this alongside the collection-level documentation the project's schema convention
// requires). This file carries no package.json: each side's own bundler (Vite for the client,
// esbuild for functions) inlines it from this relative path at build time, so there is exactly
// one copy of the field contract instead of two hand-synced object literals.
//
// Field-level docs live on each field via Zod's `.describe()` (queryable at runtime, not just a
// comment) instead of a separate FIELDS map; `optional`/`nullable` are expressed directly via
// `.optional()`/`.nullable()`.

export const ProfessionDocumentSchema = z.object({
  name: z.string().min(1).describe('Profession display name, e.g. "Bûcheron".'),
  description: z.string().default("").describe("Free-text copy shown on the character's profession tab."),
  talentIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/talents/items associated with the profession. Authored but not yet read by any mechanic."
    ),
  minReputation: z
    .number()
    .default(0)
    .describe(
      "Reputation required to take the profession. Authored but not yet enforced anywhere - no gate reads it today."
    ),
  trainerTypeIds: z
    .array(z.string())
    .default([])
    .describe("Ids in worldData/trainerTypes/items who can teach this profession."),
  evolutionId: z
    .string()
    .default("")
    .describe(
      'Id in this same collection - the profession this one advances into - or "" for none. Authored but ' +
        "not yet read by any mechanic."
    ),
  actionIds: z
    .array(z.string())
    .default([])
    .describe(
      "Ids in worldData/actionTypes/items runnable by a character practising this profession. Mirror side " +
        "of actionType.professionIds; both ends are written in one batch by src/lib/professionActions.js."
    ),
});

export type ProfessionDocument = z.infer<typeof ProfessionDocumentSchema>;

// DEFAULTS is *derived*, not hand-duplicated: `.pick()` references the same field definitions
// (including their `.default()`), so parsing `{}` against just those fields can never drift from
// the schema above.
const DEFAULTED_KEYS = [
  "description",
  "talentIds",
  "minReputation",
  "trainerTypeIds",
  "evolutionId",
  "actionIds",
] as const;

export const DEFAULTS = ProfessionDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
