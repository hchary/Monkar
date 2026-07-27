function rollWeighted(items) {
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

function rarityFloor(rarity, quality) {
  let floor = "commun";
  if (quality >= 5) floor = "legendaire";
  else if (quality >= 4) floor = "tres_rare";
  else if (quality >= 3) floor = "rare";
  const idx = Math.max(RARITY_ORDER.indexOf(rarity), RARITY_ORDER.indexOf(floor));
  return RARITY_ORDER[idx];
}

module.exports = { rollWeighted, RARITY_ORDER, rarityFloor };
