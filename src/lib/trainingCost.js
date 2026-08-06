// Gold cost to train a talent up one quality rank via the "S'entraîner" action (docs/TODO.md
// "Trainers": "a gold cost that scales with the trained talent's current quality/rarity").
// Mirrored between functions/src/lib/trainingCost.js and src/lib/trainingCost.js, same convention
// as actionConditions.js/actionKinds.js - the functions/ copy charges the gold (authority), the
// src/ copy only displays the price before "Commencer" (UX).
//
// Quality is the only input, not rarity separately: for a character-owned talent, rarity is never
// authored independently of quality - rarityFloor re-derives it on every quality bump (see
// talentEvolution.js's bumpTalentQuality) - so quality alone already carries the "current
// quality/rarity" scaling the spec asks for.
export const TRAINING_COST_BASE = 50;

export function trainingCost(talent) {
  const quality = Number(talent?.quality) || 1;
  return TRAINING_COST_BASE * quality;
}
