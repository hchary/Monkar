import { z } from "zod";

// Structural contract for `worldData/missionActions/items/{missionActionId}` documents, shared
// between the client creator (src/components/creator/MissionActionsManager.jsx, which writes the
// whole document with setDoc) and the Cloud Functions codebase
// (functions/src/schema/missionAction.ts re-exports this alongside the collection-level
// documentation the project's schema convention requires).
//
// One half of the mission-name title-building pair described in docs/TODO.md "Mission subject and
// action catalog" - paired at generation time with a worldData/missionSubjects/items entry sharing
// the same `type`, and concatenated by functions/src/missionNaming.js into a mission title, e.g.
// "Vaincre" + "dragon noir" -> "Vaincre dragon noir". Deliberately separate from the gameplay
// worldData/actionTypes/items catalog - nothing about starting a mission ties to which phrase named
// it.

export const MissionActionDocumentSchema = z.object({
  phrase: z
    .string()
    .describe(
      'French phrase, authored as a complete bare prefix including any trailing preposition it ' +
        'needs (e.g. "Protéger", "Vaincre", "Enquêter sur") - the whole fragment is hand-authored, ' +
        "no placeholder grammar."
    ),
  type: z
    .string()
    .describe(
      "Free text, matched against a worldData/missionSubjects/items entry's own `type` for pairing " +
        "at generation time - not a hardcoded enum, a content author extends it simply by giving an " +
        "entry an unseen value. Seeded with: ennemis | livraison | tresor | protection."
    ),
});

export type MissionActionDocument = z.infer<typeof MissionActionDocumentSchema>;

// Neither field has a default - both are required at creation, so there is nothing to pick.
const DEFAULTED_KEYS = [] as const;

export const DEFAULTS = MissionActionDocumentSchema.pick(
  Object.fromEntries(DEFAULTED_KEYS.map((key) => [key, true])) as Record<(typeof DEFAULTED_KEYS)[number], true>
).parse({});
