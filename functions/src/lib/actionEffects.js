const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { rollWeighted } = require("./rolls");
const { HOUR_MS } = require("./actionLifecycle");
const { resolveDurationHours } = require("./actionCatalog");

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

// The default resolution path for an action type with no handler (or one naming a handler that
// isn't registered): roll a weighted tier and apply exactly the gains it declares, its own
// narrativeText used verbatim. This is what makes "add an action" mostly a content-authoring
// task (docs/ISSUE-02-ACTION-FRAMEWORK.md Phase 3) - a handler exists only for mechanics this
// can't express, such as drawing a quest or generating narrative text from a pool.
function genericResolve({ actionType, actionTypeId, today }) {
  const tier = rollWeighted(actionType.tiers);
  const narrativeText = tier.narrativeText || "";

  const updates = applyTierEffects({ tier, today, actionTypeId, narrativeText });

  return {
    updates,
    logFields: {
      tierName: tier.name,
      success: isSuccess(tier),
      narrativeText,
      consequence: tier.consequence || null,
    },
  };
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
      // Denormalized so acknowledgeAction can find the right handler's commit() by the same
      // key ACTION_HANDLERS is registered under, without a second actionType read - see D13.
      handlerId: actionType?.handlerId || null,
      startedAt: now,
      completesAt: Timestamp.fromMillis(now.toMillis() + hours * HOUR_MS),
      // A handler that knows better (a quest exposes its difficulty) sets its own accent;
      // everything else is colored by its category.
      accent: updates.lastAction?.accent || { kind: "category", value: categoryId },
      acknowledged: false,
    },
  };
}

module.exports = { applyTierEffects, isSuccess, genericResolve, stampLifecycle };
