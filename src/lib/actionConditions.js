// Decides whether a character meets an action's display conditions.
//
// Mirrored between functions/src/lib/actionConditions.js and src/lib/actionConditions.js: bodies
// identical, only the export syntax differs. The client evaluates to decide what to show, the
// Cloud Function evaluates to decide what to allow - the client's answer is UX, the server's is
// authority. functions/ is CommonJS with no build step shared with the Vite app, so a duplicated
// pure module is the established answer here (same convention as loot.js / lootTables.js). The
// functions/ copy is the one covered by tests (actionConditions.test.js); keep both in step.
//
// See docs/ISSUE-02-ACTION-FRAMEWORK.md §3.3.

// The closed set of predicates an action can be gated on. Deliberately not an expression
// language: this stays authorable in a form, serialisable, and testable. Labels are French -
// they are creator-facing UI text.
export const CONDITION_TYPES = [
  { value: "hasTalent", label: "Possède un talent" },
  { value: "hasTalentTag", label: "Possède un talent portant un tag" },
  { value: "minReputation", label: "Réputation minimale" },
  { value: "minLegendLevel", label: "Niveau de légende minimal" },
  { value: "profession", label: "Métier" },
  { value: "region", label: "Région" },
  { value: "hasInstanceTag", label: "Possède un objet portant un tag" },
  { value: "notWounded", label: "Non blessé" },
];

export const UNKNOWN_CONDITION_REASON = "Cette action ne vous est pas accessible.";

// A parameter that is present but unusable means the condition is malformed, which fails closed
// rather than being silently ignored - a half-filled row in the creator form must not make an
// action universally available.
function requiredNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNumber(value, fallback) {
  if (value == null || value === "") return fallback;
  return requiredNumber(value);
}

function requiredString(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

function requiredStringList(value) {
  return Array.isArray(value) && value.length > 0 ? value : null;
}

// A character stat that has never been set (legendLevel is null until the first legendary roll)
// reads as zero rather than blocking every threshold condition.
function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// minQuality defaults to 1, the quality every talent is granted at, so the default meaning of a
// talent condition is "owns it at all".
function ownsTalent(character, matches, minQuality) {
  return (character?.talents || []).some(
    (talent) => matches(talent) && numberOrZero(talent?.quality) >= minQuality
  );
}

const PREDICATES = {
  hasTalent: {
    reason: "Vous ne possédez pas le talent requis.",
    test(condition, ctx) {
      const talentId = requiredString(condition.talentId);
      const minQuality = optionalNumber(condition.minQuality, 1);
      if (talentId == null || minQuality == null) return false;
      return ownsTalent(ctx.character, (talent) => talent?.id === talentId, minQuality);
    },
  },

  hasTalentTag: {
    reason: "Vous ne possédez pas le talent requis.",
    test(condition, ctx) {
      const tagId = requiredString(condition.tagId);
      const minQuality = optionalNumber(condition.minQuality, 1);
      if (tagId == null || minQuality == null) return false;
      return ownsTalent(ctx.character, (talent) => (talent?.tagIds || []).includes(tagId), minQuality);
    },
  },

  minReputation: {
    reason: "Votre réputation est insuffisante.",
    test(condition, ctx) {
      const value = requiredNumber(condition.value);
      return value != null && numberOrZero(ctx.character?.reputation) >= value;
    },
  },

  minLegendLevel: {
    reason: "Votre niveau de légende est insuffisant.",
    test(condition, ctx) {
      const value = requiredNumber(condition.value);
      return value != null && numberOrZero(ctx.character?.legendLevel) >= value;
    },
  },

  // Matches character.profession, a plain denormalized string copied from the rolled background.
  // Becomes an id match once a profession catalog exists - see docs/ISSUE-02-ACTION-FRAMEWORK.md
  // §6.
  profession: {
    reason: "Votre métier ne vous permet pas cette action.",
    test(condition, ctx) {
      const values = requiredStringList(condition.values);
      return values != null && values.includes(ctx.character?.profession);
    },
  },

  // Matches character.professionId, the profession the character is actually practising, against
  // the professions an action is reserved to. Deliberately absent from CONDITION_TYPES: nobody
  // authors this row in the condition editor - the catalog injects it from the action's own
  // professionIds whenever its kind inherits from Métier (see actionCatalog.js's
  // resolveConditions), so "which métiers may do this" is edited in exactly one field.
  //
  // Distinct from the older `profession` predicate above, which matches the free-text
  // character.profession copied from the rolled background. Both survive: that one gates on the
  // background's trade, this one on the profession catalog.
  //
  // An empty professionIds fails closed like every other malformed condition: a Métier action
  // reserved to nobody is unavailable, never universal.
  hasProfession: {
    reason: "Vous n'exercez pas le métier requis pour cette action.",
    test(condition, ctx) {
      const professionIds = requiredStringList(condition.professionIds);
      return professionIds != null && professionIds.includes(ctx.character?.professionId);
    },
  },

  region: {
    reason: "Cette action n'est pas disponible dans votre région.",
    test(condition, ctx) {
      const regionIds = requiredStringList(condition.regionIds);
      return regionIds != null && regionIds.includes(ctx.character?.region?.id);
    },
  },

  // An absent instanceTagIds set fails closed rather than throwing: a caller that skipped the
  // extra reads (see conditionsNeedInstances) simply cannot prove the character owns anything.
  hasInstanceTag: {
    reason: "Vous ne possédez pas l'objet requis.",
    test(condition, ctx) {
      const tagId = requiredString(condition.tagId);
      return tagId != null && !!ctx.instanceTagIds?.has(tagId);
    },
  },

  notWounded: {
    reason: "Vous êtes trop blessé pour cela.",
    test(condition, ctx) {
      const character = ctx.character;
      return (
        (character?.woundsLight || 0) + (character?.woundsSevere || 0) + (character?.woundsPermanent || 0) === 0
      );
    },
  },

  // Matches the action's own trainerTypeId against the trainer types reachable from the
  // character's current region. Deliberately absent from CONDITION_TYPES, same reason as
  // hasProfession: nobody authors this row - the catalog injects it from the action's own
  // trainerTypeId whenever its kind inherits from Entraînement (see actionCatalog.js's
  // resolveConditions).
  //
  // An absent reachableTrainerTypeIds set fails closed rather than throwing - same convention as
  // hasInstanceTag's absent instanceTagIds.
  trainerReachable: {
    reason: "Aucun entraîneur de ce type n'est accessible depuis votre région.",
    test(condition, ctx) {
      const trainerTypeId = requiredString(condition.trainerTypeId);
      return trainerTypeId != null && !!ctx.reachableTrainerTypeIds?.has(trainerTypeId);
    },
  },

  // A character already practising a profession can't take up another this way - switching
  // between professions already known stays switchKnownProfession's job (functions/src/index.ts),
  // and learning a further, not-yet-known profession while already practising one is out of scope
  // for this mechanic. Deliberately absent from CONDITION_TYPES, same reason as hasProfession/
  // trainerReachable: nobody authors this row - the catalog injects it from the action's own kind
  // whenever it inherits from Apprentissage (see actionCatalog.js's resolveConditions).
  professionless: {
    reason: "Vous exercez déjà un métier.",
    test(condition, ctx) {
      return !ctx.character?.professionId;
    },
  },
};

// Conditions are ANDed; the first failure decides the message. An unknown type fails closed - a
// catalog authored against a newer schema than the deployed code must hide the action, never
// grant it. Both copies fail identically, so a stale client can never offer an action the server
// would refuse.
//
// ctx is { character, instanceTagIds, reachableTrainerTypeIds }.
export function evaluateConditions(conditions, ctx) {
  if (conditions == null) return { ok: true, reason: null };
  if (!Array.isArray(conditions)) return { ok: false, reason: UNKNOWN_CONDITION_REASON };

  for (const condition of conditions) {
    const predicate = PREDICATES[condition?.type];
    if (!predicate) return { ok: false, reason: UNKNOWN_CONDITION_REASON };
    if (!predicate.test(condition, ctx || {})) return { ok: false, reason: predicate.reason };
  }
  return { ok: true, reason: null };
}

// Loading the character's owned-instance tags costs extra reads on both sides, so callers only
// pay for it when a condition actually asks.
export function conditionsNeedInstances(conditions) {
  return Array.isArray(conditions) && conditions.some((condition) => condition?.type === "hasInstanceTag");
}

// Resolving trainer-location reachability costs extra reads on both sides (a region doc plus the
// trainer type catalog), so callers only pay for it when a condition actually asks - same
// convention as conditionsNeedInstances.
export function conditionsNeedTrainerReachability(conditions) {
  return Array.isArray(conditions) && conditions.some((condition) => condition?.type === "trainerReachable");
}
