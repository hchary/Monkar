const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { rollWeighted } = require("./rolls");
const { HOUR_MS } = require("./actionLifecycle");
const { resolveDurationHours } = require("./actionCatalog");
const { applyWound } = require("./wounds");

// A tier is a success unless it explicitly says otherwise - the same rule every action
// applies, kept in one place so the generic path and per-action handlers can't drift apart.
function isSuccess(tier) {
  return tier.success !== false;
}

// Every path that resolves an action rolls its tier through here, so an action type with no
// usable `tiers` fails the same way everywhere.
//
// A tier-less action is a content-authoring mistake, not a server fault: the creator UI
// deliberately does not own the tiers editor (docs/ISSUE-02-ACTION-FRAMEWORK.md D14), so an action
// created there has none until they are authored in Firestore by hand. Rolling one anyway used to
// dereference rollWeighted's empty-pool result and reach the player as an opaque INTERNAL error;
// a failed-precondition says what is actually wrong, in the game's own language. The throw happens
// inside the pipeline's transaction, so a misconfigured action costs the player nothing - no
// character patch, no log entry, no day consumed.
function rollTier(actionType) {
  const tier = rollWeighted(actionType?.tiers);
  if (!tier) {
    throw new HttpsError("failed-precondition", "Cette action n'a pas de paliers de résultat configurés.");
  }
  return tier;
}

// Builds the `characters/{id}` patch a rolled tier implies: the `lastAction` record, plus the
// stat mutations that follow from it (gold/inventory/talents/reputation/legendLevel on success,
// alive/wound counters on failure). Handler-specific `lastAction` fields - a quest summary, drawn
// loot... - are merged in through `lastActionExtra` rather than being special-cased here, so an
// action with no handler of its own can reuse this untouched (see
// docs/ISSUE-02-ACTION-FRAMEWORK.md).
//
// `character` is the fresh in-transaction read: a wound consequence needs the character's current
// wound counters to decide whether it escalates to a worse severity or kills them outright (see
// wounds.js), which a plain FieldValue.increment can't express.
function applyTierEffects({
  tier,
  today,
  actionTypeId,
  character,
  narrativeText = "",
  talentGained = null,
  lastActionExtra,
}) {
  const success = isSuccess(tier);
  let consequence = tier.consequence || null;

  const updates = {
    lastActionDate: today,
    lastActionAt: FieldValue.serverTimestamp(),
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
    const severity = tier.consequence.severity || "light";
    const result = applyWound(character, severity);
    updates.woundsLight = result.woundsLight;
    updates.woundsSevere = result.woundsSevere;
    updates.woundsPermanent = result.woundsPermanent;
    if (result.died) {
      updates.alive = false;
      consequence = { ...tier.consequence, fatal: true };
    }
  }

  updates.lastAction = {
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
    consequence,
    ...lastActionExtra,
  };

  return updates;
}

// The default resolution path for an action type with no handler (or one naming a handler that
// isn't registered): roll a weighted tier and apply exactly the gains it declares, its own
// narrativeText used verbatim. This is what makes "add an action" mostly a content-authoring
// task (docs/ISSUE-02-ACTION-FRAMEWORK.md Phase 3) - a handler exists only for mechanics this
// can't express, such as drawing a quest or generating narrative text from a pool.
function genericResolve({ actionType, actionTypeId, today, character }) {
  const tier = rollTier(actionType);
  const narrativeText = tier.narrativeText || "";

  const updates = applyTierEffects({ tier, today, actionTypeId, character, narrativeText });

  return {
    updates,
    logFields: {
      tierName: tier.name,
      success: isSuccess(tier),
      narrativeText,
      consequence: updates.lastAction.consequence,
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

module.exports = { applyTierEffects, isSuccess, rollTier, genericResolve, stampLifecycle };
