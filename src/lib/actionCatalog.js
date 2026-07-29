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

import { DEFAULT_DURATION_HOURS } from "./actionLifecycle";
import { evaluateConditions } from "./actionConditions";
import { PROFESSION_ACTION_KIND_ID, actionKindCategoryId, actionKindInheritsFrom } from "./actionKinds";

// Every action runs for 24h unless its catalog entry says otherwise. Nonsense values (absent,
// zero, negative, non-numeric) fall back to the default rather than producing an action that
// completes in the past or never - the field is authored by hand today.
export function resolveDurationHours(actionType) {
  const hours = Number(actionType?.durationHours);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_DURATION_HOURS;
}

// An action authored before kinds existed carries only a categoryId, and the four categories are
// exactly the four root kinds - so the old field reads as the kind it always implied. No
// migration, same read-time-defaults convention as every other field here.
export function resolveKindId(actionType) {
  return actionType?.kindId || actionType?.categoryId || null;
}

// The category is derived from the kind's root, never authored. The fallback keeps a document
// naming a kind this build doesn't know (authored against a newer registry) in whatever category
// it was already filed under, instead of dropping it out of every tab.
export function resolveCategoryId(actionType) {
  return actionKindCategoryId(resolveKindId(actionType)) || actionType?.categoryId || null;
}

export function resolveProfessionIds(actionType) {
  return Array.isArray(actionType?.professionIds) ? actionType.professionIds.filter((id) => typeof id === "string") : [];
}

// The conditions actually evaluated for an action: the authored ones, plus - for anything
// inheriting from Métier - the profession gate implied by its "Métiers associés" field. That gate
// is not an authored row: it is what being a Métier action *means* ("disponible uniquement pour
// les personnages possédant le métier associé"), so it can't be forgotten or contradicted by the
// condition editor, and a subtype (Artisanat, Récolte…) inherits it without restating it.
//
// Re-injection is guarded so normalizing an already-normalized document is idempotent; nothing
// else can produce a hasProfession row, since it isn't offered by CONDITION_TYPES.
export function resolveConditions(actionType) {
  const authored = Array.isArray(actionType?.availability?.conditions) ? actionType.availability.conditions : [];
  if (!actionKindInheritsFrom(resolveKindId(actionType), PROFESSION_ACTION_KIND_ID)) return authored;
  if (authored.some((condition) => condition?.type === "hasProfession")) return authored;
  return [...authored, { type: "hasProfession", professionIds: resolveProfessionIds(actionType) }];
}

export function normalizeActionType(actionType) {
  const availability = actionType?.availability || {};
  const result = actionType?.result || {};

  return {
    ...actionType,
    label: actionType?.label || "",
    kindId: resolveKindId(actionType),
    categoryId: resolveCategoryId(actionType),
    professionIds: resolveProfessionIds(actionType),
    description: actionType?.description || "",
    order: Number.isFinite(Number(actionType?.order)) ? Number(actionType.order) : 0,
    // Absent means enabled: an action authored before this field existed must keep working.
    enabled: actionType?.enabled !== false,
    // No handler means the generic tier roller resolves it (Phase 3).
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
    tiers: Array.isArray(actionType?.tiers) ? actionType.tiers : [],
  };
}

// Whether this character may start this action, and what to say if not. The action's own
// unmetMessage wins over the evaluator's per-type default whenever the author wrote one, so a
// creator can explain the requirement in the game's own words.
//
// Accepts a raw or a normalized action type - it re-derives the defaults it needs, including the
// implicit profession gate, so a caller that skipped normalizeActionType can't accidentally
// evaluate a Métier action as if it were open to everyone.
export function evaluateAvailability(actionType, ctx) {
  const availability = actionType?.availability || {};
  const behaviour = availability.unmetBehaviour === "disable" ? "disable" : "hide";
  const result = evaluateConditions(resolveConditions(actionType), ctx);

  if (result.ok) return { ok: true, reason: null, behaviour };
  return { ok: false, reason: availability.unmetMessage || result.reason, behaviour };
}
