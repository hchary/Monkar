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

// Every action runs for 24h unless its catalog entry says otherwise. Nonsense values (absent,
// zero, negative, non-numeric) fall back to the default rather than producing an action that
// completes in the past or never - the field is authored by hand today.
function resolveDurationHours(actionType) {
  const hours = Number(actionType?.durationHours);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_DURATION_HOURS;
}

function normalizeActionType(actionType) {
  const availability = actionType?.availability || {};
  const result = actionType?.result || {};

  return {
    ...actionType,
    label: actionType?.label || "",
    categoryId: actionType?.categoryId || null,
    description: actionType?.description || "",
    order: Number.isFinite(Number(actionType?.order)) ? Number(actionType.order) : 0,
    // Absent means enabled: an action authored before this field existed must keep working.
    enabled: actionType?.enabled !== false,
    // No handler means the generic tier roller resolves it (Phase 3).
    handlerId: actionType?.handlerId || null,
    durationHours: resolveDurationHours(actionType),
    availability: {
      conditions: Array.isArray(availability.conditions) ? availability.conditions : [],
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
// Accepts a raw or a normalized action type - it re-derives the defaults it needs.
function evaluateAvailability(actionType, ctx) {
  const availability = actionType?.availability || {};
  const behaviour = availability.unmetBehaviour === "disable" ? "disable" : "hide";
  const result = evaluateConditions(availability.conditions, ctx);

  if (result.ok) return { ok: true, reason: null, behaviour };
  return { ok: false, reason: availability.unmetMessage || result.reason, behaviour };
}

module.exports = { resolveDurationHours, normalizeActionType, evaluateAvailability };
