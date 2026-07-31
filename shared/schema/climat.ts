import { z } from "zod";

// Structural contract for `worldData/climats/items/{climatId}` documents, shared between the
// client creator (src/components/creator/ClimatsManager.jsx, which writes the whole document with
// setDoc) and the Cloud Functions codebase (functions/src/schema/climat.ts re-exports this
// alongside the collection-level documentation the project's schema convention requires).

export const ClimatDocumentSchema = z.object({
  name: z.string().describe('Climate display name, e.g. "Tempéré humide".'),
  description: z.string().default("").describe("Free-text flavour copy, shown as a tooltip in the region form."),
  bannerKey: z
    .string()
    .default("")
    .describe(
      "Which banner illustration the character page shows (src/components/ClimateBanner.jsx). One of " +
        'foret | glace | pleine_mer | bord_mer | desert | volcan | ville | grotte, or "" for no banner.'
    ),
});

export type ClimatDocument = z.infer<typeof ClimatDocumentSchema>;

const DEFAULTED_KEYS = ["description", "bannerKey"] as const;

export const DEFAULTS = ClimatDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
