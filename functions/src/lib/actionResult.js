// The closed effect vocabulary every action handler resolves into, and the single applier that
// turns it into a character patch (docs/TODO.md "ActionResult and the single applier").
//
// Before this file, each handler hand-rolled its own `updates` object: eight copies of "bump the
// talents array", "add to reputation", "route a wound through applyWound and remember to set
// alive: false". `createActionResult` names the effects instead, and `applyActionResult` is the one
// place any of them is written - so an effect is applied exactly once, the same way, from every
// action.
//
// Pure: no Firestore, no catalog reads. Everything the applier cannot know from the character
// document alone (the talent catalog behind an id, the display name behind a region id, today's
// date, the circumstance sentence stamped on a talent) arrives through the options bag, the same
// way `today` and `circumstance` already did.
//
// What this vocabulary deliberately does *not* cover: gold, professions, the mission journal, quest
// chain progress, crafting recipes, the Intermède counter. Those are handler-specific state, and
// the handler keeps writing them into its own `updates` alongside this applier's output. The eight
// fields below are the effects that were duplicated across handlers, not every effect that exists.
//
// Two fields the source model has are not ported: `idleTime` (the web has a lifecycle envelope -
// `stampLifecycle` - and nothing reads a duration off the outcome) and `talentsLost` (nothing on
// the web can take a talent away). One field is added: `reputationRegionId`, so an action spanning
// several regions can name the one it credits instead of always crediting wherever the character
// happens to stand.

const { rarityFloor } = require("./rolls");
const { bumpTalentQuality } = require("./talentEvolution");
const { applyWound } = require("./wounds");
const { woundFromInjury } = require("./missionResolution");

// Builds the outcome a handler's resolve() hands to applyActionResult. Every field is optional and
// defaults to "this action did not do that".
//
// - `itemsGained` / `itemsLost`: loot entries (`{ objectId, name, rarity, ... }`) or bare object
//   ids, which are normalized to `{ objectId }`. Neither touches the `instances` collection here:
//   gains are frozen onto `lastAction.loot` and become documents in the handler's own `commit()`
//   once the player acknowledges the result - that acknowledgement step is the web's
//   anti-duplication guarantee - and losses are recorded for display while the deletion stays in
//   the handler's transaction, where the reads-before-writes ordering it needs is available.
// - `talentsGained`: catalog talent ids, granted at quality 1. Ids the character already owns, and
//   ids missing from the catalog passed to the applier, are skipped.
// - `talentTrained`: owned talent ids, each bumped one quality step via `bumpTalentQuality`.
// - `reputationGained`: signed. Credited to `reputationRegionId`, or to the region the character
//   stands in once `newRegionId` has been applied.
// - `newRegionId`: where the character ends the action (docs/TODO.md "Travel action (Voyager)").
// - `injury`: the engine's `{ light, severe, permanent }` triple, routed through `applyWound`.
function createActionResult({
  itemsGained = [],
  itemsLost = [],
  talentsGained = [],
  talentTrained = [],
  reputationGained = 0,
  reputationRegionId = null,
  newRegionId = null,
  injury = null,
} = {}) {
  return {
    itemsGained,
    itemsLost,
    talentsGained,
    talentTrained,
    reputationGained,
    reputationRegionId,
    newRegionId,
    injury,
  };
}

function toLootEntry(item) {
  return typeof item === "string" ? { objectId: item } : item;
}

// Ids listed twice in one result are applied once: an action either trains a talent or it doesn't,
// and a handler that accumulates several rounds into one result (partirExplorer.js) must not stack
// two bumps onto the same talent in a single write.
function uniqueIds(ids) {
  return [...new Set((ids || []).filter(Boolean))];
}

// Applies one ActionResult to a character, returning the patch to merge into the handler's own
// `updates` and whether the character died doing it.
//
// The patch only carries the fields the result actually moved: an action that gained nothing
// returns `{}`, not a page of empty arrays. `updates.lastAction` holds the player-visible summary
// of the same effects (loot, talent changes, reputation, wound), which the handler spreads into its
// own `lastAction` alongside the fields only it knows about (`success`, `score`, `mission`, ...).
// Intermède-budget handlers, which never write a `lastAction` at all, simply ignore that key.
//
// Options:
// - `today` / `circumstance`: stamped onto every talent this result changes, exactly as
//   `bumpTalentQuality` already did from `sEntrainer.js`.
// - `talentCatalog`: the `worldData/talents/items` entries a `talentsGained` id is resolved
//   against. A handler granting no talent can leave it out.
// - `regionName`: the display name for `newRegionId`, since `character.region` stores `{ id, name }`
//   and the applier cannot read the region document itself.
function applyActionResult(character, result, { today, circumstance, talentCatalog = [], regionName = null } = {}) {
  const updates = {};
  const lastAction = {};

  // --- Talents: trained (bump) then gained (grant at quality 1) ------------------------------
  const trainedIds = new Set(uniqueIds(result.talentTrained));
  const ownedIds = new Set((character.talents || []).map((talent) => talent.id));
  const talentEvolutions = [];

  const nextTalents = (character.talents || []).map((talent) => {
    if (!trainedIds.has(talent.id)) return talent;
    const evolved = bumpTalentQuality(talent, { today, circumstance });
    talentEvolutions.push({
      talentId: evolved.id,
      name: evolved.name,
      kind: "evolution",
      quality: evolved.quality,
      rarity: evolved.rarity,
    });
    return evolved;
  });

  for (const talentId of uniqueIds(result.talentsGained)) {
    // Granting a talent the character already has would overwrite its quality back down to 1 -
    // the training path (`talentTrained`) is how an owned talent moves.
    if (ownedIds.has(talentId)) continue;
    const catalogTalent = (talentCatalog || []).find((talent) => talent.id === talentId);
    if (!catalogTalent) continue; // content gap - skipped, the same way loot skips a missing object

    const granted = {
      id: catalogTalent.id,
      name: catalogTalent.name,
      quality: 1,
      trainable: !!catalogTalent.trainable,
      rarity: rarityFloor(catalogTalent.rarity, 1),
      effect: catalogTalent.effect || "",
      tagIds: catalogTalent.tagIds || [],
      lastChangeDate: today,
      lastChangeCircumstance: circumstance,
    };
    nextTalents.push(granted);
    ownedIds.add(talentId);
    talentEvolutions.push({
      talentId: granted.id,
      name: granted.name,
      kind: "unlock",
      quality: granted.quality,
      rarity: granted.rarity,
    });
  }

  if (talentEvolutions.length > 0) {
    updates.talents = nextTalents;
    lastAction.talentEvolutions = talentEvolutions;
  }

  // --- Region: applied before reputation, so a move that also pays credits the destination -----
  let currentRegionId = character.region?.id || null;
  let reputations = character.reputations || {};

  if (result.newRegionId && result.newRegionId !== currentRegionId) {
    currentRegionId = result.newRegionId;
    updates.region = { id: result.newRegionId, name: regionName ?? "" };
    lastAction.newRegionId = result.newRegionId;
    // Arriving somewhere for the first time seeds the relationship at 1 rather than at 0 - a
    // traveller is a known face before they have done anything (docs/TODO.md "Per-region
    // reputation").
    if (reputations[result.newRegionId] == null) {
      reputations = { ...reputations, [result.newRegionId]: 1 };
      updates.reputations = reputations;
    }
  }

  // --- Reputation --------------------------------------------------------------------------
  if (result.reputationGained) {
    const regionId = result.reputationRegionId || currentRegionId;
    // A gain with nowhere to land is dropped rather than written under an empty key: a character
    // with no region is a data problem, not a reason to corrupt the map.
    if (regionId) {
      // A missing entry defaults to 0, not to the origin's starting score: gaining reputation in a
      // region never *raises* an unvisited one, it starts the count.
      const current = reputations[regionId] ?? 0;
      updates.reputations = { ...reputations, [regionId]: current + result.reputationGained };
      // INTERIM: the legacy scalar is kept in step until docs/TODO.md "Per-region reputation"
      // moves `minReputation` and the banner onto the map. Without this, reputation would appear
      // frozen everywhere it is currently read.
      updates.reputation = (character.reputation || 0) + result.reputationGained;
      lastAction.reputationGained = result.reputationGained;
      lastAction.reputationRegionId = regionId;
    }
  }

  // --- Injury ------------------------------------------------------------------------------
  let died = false;
  const wound = result.injury ? woundFromInjury(result.injury) : null;
  if (wound) {
    const woundResult = applyWound(character, wound);
    updates.woundsLight = woundResult.woundsLight;
    updates.woundsSevere = woundResult.woundsSevere;
    updates.woundsPermanent = woundResult.woundsPermanent;
    lastAction.wound = wound;
    died = woundResult.died;
    if (died) updates.alive = false;
  }

  // --- Items: recorded now, materialized (or deleted) by the handler --------------------------
  const loot = (result.itemsGained || []).map(toLootEntry);
  if (loot.length > 0) lastAction.loot = loot;

  const itemsLost = (result.itemsLost || []).map(toLootEntry);
  if (itemsLost.length > 0) lastAction.itemsLost = itemsLost;

  if (Object.keys(lastAction).length > 0) updates.lastAction = lastAction;

  return { updates, died };
}

module.exports = { createActionResult, applyActionResult };
