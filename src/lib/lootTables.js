// Central loot-table draw mechanic, shared by the creator dashboard's "Tirer" button
// and any future consumer (e.g. quest resolution) — draw is uniform over table.itemIds,
// unless the table opts into per-item weighting via weightMode: "manuelle" + itemWeights.
export function drawLootTableItemId(table) {
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

  const index = Math.floor(Math.random() * itemIds.length);
  return itemIds[index];
}
