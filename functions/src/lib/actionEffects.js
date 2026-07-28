const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { DEFAULT_DURATION_HOURS, HOUR_MS } = require("./actionLifecycle");

// A tier is a success unless it explicitly says otherwise - the same rule every action
// applies, kept in one place so the generic path and per-action handlers can't drift apart.
function isSuccess(tier) {
  return tier.success !== false;
}

// Builds the `characters/{id}` patch a rolled tier implies: the `lastAction` record, plus the
// stat mutations that follow from it (gold/inventory/talents/reputation/legendLevel on success,
// alive/wounds on failure). Handler-specific `lastAction` fields - a quest summary, drawn
// loot... - are merged in through `lastActionExtra` rather than being special-cased here, so an
// action with no handler of its own can reuse this untouched (see
// docs/ISSUE-02-ACTION-FRAMEWORK.md).
function applyTierEffects({
  tier,
  today,
  actionTypeId,
  narrativeText = "",
  talentGained = null,
  lastActionExtra,
}) {
  const success = isSuccess(tier);

  const updates = {
    lastActionDate: today,
    lastActionAt: FieldValue.serverTimestamp(),
    lastAction: {
      actionTypeId,
      date: today,
      tierName: tier.name,
      success,
      narrativeText,
      goldGain: tier.goldGain || 0,
      itemGain: tier.itemGain || null,
      talentGain: talentGained,
      reputationGain: tier.reputationGain || 0,
      legendary: !!tier.legendary,
      consequence: tier.consequence || null,
      ...lastActionExtra,
    },
  };

  if (success) {
    if (tier.goldGain) updates.gold = FieldValue.increment(tier.goldGain);
    if (tier.itemGain) updates.inventory = FieldValue.arrayUnion(tier.itemGain);
    if (talentGained) updates.talents = FieldValue.arrayUnion(talentGained);
    if (tier.reputationGain) updates.reputation = FieldValue.increment(tier.reputationGain);
    if (tier.legendary) updates.legendLevel = FieldValue.increment(1);
  } else if (tier.consequence?.type === "death") {
    updates.alive = false;
  } else if (tier.consequence?.type === "wound") {
    updates.wounds = FieldValue.arrayUnion({
      name: tier.consequence.name || tier.name,
      description: tier.consequence.description || "",
      date: today,
    });
  }

  return updates;
}

// Every action runs for 24h unless its catalog entry says otherwise. Nonsense values (absent,
// zero, negative, non-numeric) fall back to the default rather than producing an action that
// completes in the past or never - the field is authored by hand today (no creator UI yet).
function resolveDurationHours(actionType) {
  const hours = Number(actionType?.durationHours);
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_DURATION_HOURS;
}

// Stamps onto a handler's character patch the lifecycle fields every action shares: when it
// started, when it completes, how the frame should be colored, and whether the player has seen
// the result yet. The dispatcher owns this rather than the handlers, so an action with no
// handler of its own is timed identically to one that has.
//
// `completesAt` cannot be derived from FieldValue.serverTimestamp(): that is a write sentinel
// with no readable value, so it cannot be offset by a duration. Both instants therefore come
// from the function's own clock. Sub-second drift against Firestore's clock is irrelevant at a
// 24h granularity, and `lastActionAt` keeps using the sentinel exactly as before.
function stampLifecycle(updates, { actionType, now = Timestamp.now(), durationHours } = {}) {
  const hours = durationHours ?? resolveDurationHours(actionType);
  const categoryId = actionType?.categoryId || null;

  return {
    ...updates,
    lastAction: {
      ...updates.lastAction,
      label: actionType?.label || "",
      categoryId,
      startedAt: now,
      completesAt: Timestamp.fromMillis(now.toMillis() + hours * HOUR_MS),
      // A handler that knows better (a quest exposes its difficulty) sets its own accent;
      // everything else is colored by its category.
      accent: updates.lastAction?.accent || { kind: "category", value: categoryId },
      acknowledged: false,
    },
  };
}

module.exports = { applyTierEffects, isSuccess, resolveDurationHours, stampLifecycle };
