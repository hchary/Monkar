function pickRandom(items) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// Mirrors src/lib/lootTables.js's drawLootTableItemId (client-side, used by the creator
// dashboard's "Tirer" button) — kept as a separate copy since functions/ is CommonJS and
// has no build step shared with the Vite app.
function drawLootTableItemId(table) {
  const itemIds = table?.itemIds || [];
  if (itemIds.length === 0) return null;
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
