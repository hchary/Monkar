// Central loot-table draw mechanic, shared by the creator dashboard's "Tirer" button
// and any future consumer (e.g. quest resolution) — draw is uniform over table.itemIds.
export function drawLootTableItemId(table) {
  const itemIds = table?.itemIds || [];
  if (itemIds.length === 0) return null;
  const index = Math.floor(Math.random() * itemIds.length);
  return itemIds[index];
}
