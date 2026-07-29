function pickRandom(items) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// Mirrors src/lib/lootTables.js's drawLootTableItemId (client-side, used by the creator
// dashboard's "Tirer" button) — kept as a separate copy since functions/ is CommonJS and
// has no build step shared with the Vite app. Draw is uniform over itemIds, unless the
// table opts into per-item weighting via weightMode: "manuelle" + itemWeights.
function drawLootTableItemId(table) {
  const itemIds = table?.itemIds || [];
  if (itemIds.length === 0) return null;

  if (table?.weightMode === "manuelle") {
    const weights = table.itemWeights || {};
    const totalWeight = itemIds.reduce((sum, id) => sum + (Number(weights[id]) || 0), 0);
    if (totalWeight > 0) {
      let roll = Math.random() * totalWeight;
      for (const id of itemIds) {
        roll -= Number(weights[id]) || 0;
        if (roll < 0) return id;
      }
      return itemIds[itemIds.length - 1];
    }
  }

  return pickRandom(itemIds);
}

// A quest's difficulty (not the objective's rarity) sets how many loot items are rolled.
const LOOT_COUNT_BY_DIFFICULTY = {
  facile: 1,
  moyen: 1,
  difficile: 2,
  tres_difficile: 2,
  epique: 3,
  mythique: 3,
};

module.exports = { pickRandom, drawLootTableItemId, LOOT_COUNT_BY_DIFFICULTY };
