// Read-time defaults and availability resolution for worldData/actionTypes/items entries.
//
// Mirrored between functions/src/lib/actionCatalog.js and src/lib/actionCatalog.js: bodies
// identical, only the export syntax differs. Both sides must agree on what an absent field
// means, or the client and the Cloud Function would disagree about the same catalog document.
// The functions/ copy is the one covered by tests (actionCatalog.test.js); keep both in step.
//
// Every field below defaults at read time rather than through a migration, so a document
// authored before the action framework existed stays valid - see
// docs/ISSUE-02-ACTION-FRAMEWORK.md §3.2.

const { DEFAULT_DURATION_HOURS } = require("./actionLifecycle");
const { evaluateConditions } = require("./actionConditions");
const {
  PROFESSION_ACTION_KIND_ID,
  TRAINING_ACTION_KIND_ID,
  PROFESSION_LEARNING_ACTION_KIND_ID,
  actionKindCategoryId,
  actionKindInheritsFrom,
} = require("./actionKinds");

// Every action runs for 24h unless its catalog entry says otherwise. Nonsense values (absent,
// zero, negative, non-numeric) fall back to the default rather than producing an action that
// completes in the past or never - the field is authored by hand today.
function resolveDurationHours(actionType) {
  const hours = Number(actionType?.durationHours);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_DURATION_HOURS;
}

// An action authored before kinds existed carries only a categoryId, and the four categories are
// exactly the four root kinds - so the old field reads as the kind it always implied. No
// migration, same read-time-defaults convention as every other field here.
function resolveKindId(actionType) {
  return actionType?.kindId || actionType?.categoryId || null;
}

// The category is derived from the kind's root, never authored. The fallback keeps a document
// naming a kind this build doesn't know (authored against a newer registry) in whatever category
// it was already filed under, instead of dropping it out of every tab.
function resolveCategoryId(actionType) {
  return actionKindCategoryId(resolveKindId(actionType)) || actionType?.categoryId || null;
}

function resolveProfessionIds(actionType) {
  return Array.isArray(actionType?.professionIds) ? actionType.professionIds.filter((id) => typeof id === "string") : [];
}

// worldData/tags/items ids restricting which recettes this Artisanat action can craft (a recette
// qualifies when its own categoryIds overlaps this list) - only meaningful for kinds inheriting
// CRAFTING_ACTION_KIND_ID, same convention as resolveProfessionIds/lootTagIds.
function resolveRecipeCategoryIds(actionType) {
  return Array.isArray(actionType?.recipeCategoryIds)
    ? actionType.recipeCategoryIds.filter((id) => typeof id === "string")
    : [];
}

// worldData/trainerTypes/items id this action trains at - only meaningful for kinds inheriting
// TRAINING_ACTION_KIND_ID, same convention as resolveRecipeCategoryIds/resolveProfessionIds for
// their own branches.
function resolveTrainerTypeId(actionType) {
  return typeof actionType?.trainerTypeId === "string" && actionType.trainerTypeId !== ""
    ? actionType.trainerTypeId
    : null;
}

// The conditions actually evaluated for an action: the authored ones, plus whatever a kind
// implies. Anything inheriting from Métier gets the profession gate implied by its "Métiers
// associés" field; anything inheriting from Entraînement gets the trainer-reachability gate
// implied by its own trainerTypeId; anything inheriting from Apprentissage (itself under
// Entraînement) additionally gets the professionless gate, reserving it to characters who don't
// yet practise a profession. Neither gate is an authored row: each is what belonging to that kind
// *means*, so it can't be forgotten or contradicted by the condition editor, and a subtype
// inherits it without restating it.
//
// Each injection is individually guarded so normalizing an already-normalized document is
// idempotent; nothing else can produce a hasProfession/trainerReachable/professionless row, since
// none of them is offered by CONDITION_TYPES.
function resolveConditions(actionType) {
  const authored = Array.isArray(actionType?.availability?.conditions) ? actionType.availability.conditions : [];
  const kindId = resolveKindId(actionType);
  let conditions = authored;

  if (actionKindInheritsFrom(kindId, PROFESSION_ACTION_KIND_ID) && !authored.some((c) => c?.type === "hasProfession")) {
    conditions = [...conditions, { type: "hasProfession", professionIds: resolveProfessionIds(actionType) }];
  }

  if (
    actionKindInheritsFrom(kindId, TRAINING_ACTION_KIND_ID) &&
    !authored.some((c) => c?.type === "trainerReachable")
  ) {
    conditions = [...conditions, { type: "trainerReachable", trainerTypeId: resolveTrainerTypeId(actionType) }];
  }

  if (
    actionKindInheritsFrom(kindId, PROFESSION_LEARNING_ACTION_KIND_ID) &&
    !authored.some((c) => c?.type === "professionless")
  ) {
    conditions = [...conditions, { type: "professionless" }];
  }

  return conditions;
}

function normalizeActionType(actionType) {
  const availability = actionType?.availability || {};
  const result = actionType?.result || {};

  return {
    ...actionType,
    label: actionType?.label || "",
    kindId: resolveKindId(actionType),
    categoryId: resolveCategoryId(actionType),
    professionIds: resolveProfessionIds(actionType),
    recipeCategoryIds: resolveRecipeCategoryIds(actionType),
    trainerTypeId: resolveTrainerTypeId(actionType),
    description: actionType?.description || "",
    order: Number.isFinite(Number(actionType?.order)) ? Number(actionType.order) : 0,
    // Absent means enabled: an action authored before this field existed must keep working.
    enabled: actionType?.enabled !== false,
    // No fallback here any more: an action with no handlerId (or one naming an unregistered
    // handler) is refused at runtime by functions/src/lib/actionPipeline.js - see "Abandoning the
    // paliers system" in docs/ISSUE-02-ACTION-FRAMEWORK.md.
    handlerId: actionType?.handlerId || null,
    durationHours: resolveDurationHours(actionType),
    availability: {
      conditions: resolveConditions(actionType),
      unmetBehaviour: availability.unmetBehaviour === "disable" ? "disable" : "hide",
      unmetMessage: availability.unmetMessage || "",
    },
    result: {
      accentSource: result.accentSource === "difficulty" ? "difficulty" : "category",
      showLoot: result.showLoot === true,
    },
  };
}

// Whether this character may start this action, and what to say if not. The action's own
// unmetMessage wins over the evaluator's per-type default whenever the author wrote one, so a
// creator can explain the requirement in the game's own words.
//
// Accepts a raw or a normalized action type - it re-derives the defaults it needs, including the
// implicit profession gate, so a caller that skipped normalizeActionType can't accidentally
// evaluate a Métier action as if it were open to everyone.
function evaluateAvailability(actionType, ctx) {
  const availability = actionType?.availability || {};
  const behaviour = availability.unmetBehaviour === "disable" ? "disable" : "hide";
  const result = evaluateConditions(resolveConditions(actionType), ctx);

  if (result.ok) return { ok: true, reason: null, behaviour };
  return { ok: false, reason: availability.unmetMessage || result.reason, behaviour };
}

module.exports = {
  resolveDurationHours,
  resolveKindId,
  resolveCategoryId,
  resolveProfessionIds,
  resolveRecipeCategoryIds,
  resolveTrainerTypeId,
  resolveConditions,
  normalizeActionType,
  evaluateAvailability,
};
