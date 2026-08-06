// Gold received when selling an owned Instance via the "Faire du commerce" action (docs/TODO.md
// "Intermède actions": "the exact price formula is left to the implementation entry"). Mirrored
// between functions/src/lib/salePrice.js and src/lib/salePrice.js, same convention as
// trainingCost.js - the functions/ copy credits the gold (authority), the src/ copy only displays
// the price before "Vendre" (UX).
//
// A fixed per-rarity table rather than a formula, same style as loot.js's LOOT_COUNT_BY_DIFFICULTY
// - starting balance values, not derived from anything else an object carries (unlike
// trainingCost, an object has no "quality" of its own to scale against).
const SALE_PRICE_BY_RARITY = {
  commun: 10,
  peu_commun: 25,
  rare: 50,
  tres_rare: 100,
  legendaire: 250,
  mythique: 600,
  divin: 1500,
  unique: 4000,
};

function salePrice(object) {
  return SALE_PRICE_BY_RARITY[object?.rarity] || SALE_PRICE_BY_RARITY.commun;
}

module.exports = { SALE_PRICE_BY_RARITY, salePrice };
