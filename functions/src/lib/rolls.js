// Nothing to draw from yields null rather than the `items[-1]` undefined the fallback used to
// produce: callers then decide what an empty pool means, instead of dereferencing a value that
// only looks like an item until they touch it. Each handler that calls this with its own weight
// table (e.g. partirEnQuete.js's quest-difficulty draw) is expected to hand it a table it knows is
// non-empty - there is no shared "empty pool" handling above this any more since the framework-wide
// tiers mechanism that used to need one was retired (see "Abandoning the paliers system" in
// docs/ISSUE-02-ACTION-FRAMEWORK.md).
function rollWeighted(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
  const roll = Math.random() * totalWeight;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight || 0;
    if (roll <= cumulative) return item;
  }
  return items[items.length - 1];
}

const RARITY_ORDER = ["commun", "peu_commun", "rare", "tres_rare", "legendaire", "mythique", "divin", "unique"];

// Quests' own 6-tier difficulty scale (see QuestsManager.jsx's DIFFICULTIES) - positionally
// equivalent to the first six rarity tiers (docs/TODO.md "Quest difficulty") but kept as its
// own array since quests have no "divin"/"unique" tier.
const DIFFICULTY_ORDER = ["facile", "moyen", "difficile", "tres_difficile", "epique", "mythique"];

function rarityFloor(rarity, quality) {
  let floor = "commun";
  if (quality >= 5) floor = "legendaire";
  else if (quality >= 4) floor = "tres_rare";
  else if (quality >= 3) floor = "rare";
  const idx = Math.max(RARITY_ORDER.indexOf(rarity), RARITY_ORDER.indexOf(floor));
  return RARITY_ORDER[idx];
}

module.exports = { rollWeighted, RARITY_ORDER, DIFFICULTY_ORDER, rarityFloor };
