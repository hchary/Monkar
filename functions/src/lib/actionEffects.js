const { FieldValue } = require("firebase-admin/firestore");

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

module.exports = { applyTierEffects, isSuccess };
