const { RARITY_ORDER, DIFFICULTY_ORDER, rarityFloor } = require("./rolls");

// 5% base, +10% per quest difficulty level (facile=1..mythique=6), -5% per talent rank level
// (commun=1..unique=8) - see docs/TODO.md "Amélioration de talent". A "difficile" (level 3) quest
// evolves a "commun" (level 1) talent at 5 + 10*3 - 5*1 = 30%, matching the design's example.
function evolutionChance({ difficulty, talentRarity }) {
  const difficultyLevel = DIFFICULTY_ORDER.indexOf(difficulty) + 1;
  const rankLevel = RARITY_ORDER.indexOf(talentRarity) + 1;
  if (difficultyLevel <= 0 || rankLevel <= 0) return 0;
  // Computed in whole percentage points first (not 0.05/0.1 floats) so common cases land on
  // exact values like 0.3 rather than a binary-float near-miss.
  const percent = 5 + 10 * difficultyLevel - 5 * rankLevel;
  return Math.min(100, Math.max(0, percent)) / 100;
}

// Applies a single quality-up step: +1 capped at 5, with rarityFloor re-applied so rarity only
// ever rises alongside it, never drops. Called from one place now - functions/src/lib/actionResult.js's
// applier, for both the resolution-luck path (rollTalentEvolutionIds below) and the trainer path
// (functions/src/actions/sEntrainer.js) - see docs/TODO.md "Trainers"'s note that s'entraîner reuses
// this exact mechanism rather than a second RNG system.
function bumpTalentQuality(talent, { today, circumstance }) {
  const quality = Math.min(5, (talent.quality || 1) + 1);
  return {
    ...talent,
    quality,
    rarity: rarityFloor(talent.rarity, quality),
    lastChangeDate: today,
    lastChangeCircumstance: circumstance,
  };
}

// Which talents a successful resolution moves - selection only, no application: the bump and the
// grant are `functions/src/lib/actionResult.js`'s applier's job now, so an effect is written in one
// place (docs/TODO.md "ActionResult and the single applier"). For every owned talent sharing a tag
// with the resolution and ranking at or below `objectiveRarity`, rolls a chance to train it; for
// every catalog talent the character does not own, sharing a tag and ranking strictly below that
// rarity, rolls the same chance to grant it.
//
// `tagIds` is the resolution's single tag list - a monster's resolved tags once docs/TODO.md
// "Mission generation from the bestiary" lands, and until then the mission's or location's own.
function rollTalentEvolutionIds({ characterTalents, catalogTalents, tagIds, objectiveRarity, difficulty }) {
  const objectiveRankIndex = RARITY_ORDER.indexOf(objectiveRarity);
  if (objectiveRankIndex < 0) return { trainedIds: [], gainedIds: [] };

  const relevantTagIds = new Set(tagIds || []);
  const sharesTag = (ids) => (ids || []).some((id) => relevantTagIds.has(id));

  const trainedIds = [];
  const gainedIds = [];

  for (const talent of characterTalents || []) {
    if (!sharesTag(talent.tagIds)) continue;
    const rankIndex = RARITY_ORDER.indexOf(talent.rarity);
    if (rankIndex < 0 || rankIndex > objectiveRankIndex) continue;
    if (Math.random() >= evolutionChance({ difficulty, talentRarity: talent.rarity })) continue;
    trainedIds.push(talent.id);
  }

  const ownedIds = new Set((characterTalents || []).map((t) => t.id));
  for (const talent of catalogTalents || []) {
    if (ownedIds.has(talent.id)) continue;
    if (!sharesTag(talent.tagIds)) continue;
    const rankIndex = RARITY_ORDER.indexOf(talent.rarity);
    if (rankIndex < 0 || rankIndex >= objectiveRankIndex) continue;
    if (Math.random() >= evolutionChance({ difficulty, talentRarity: talent.rarity })) continue;
    gainedIds.push(talent.id);
  }

  return { trainedIds, gainedIds };
}

module.exports = { evolutionChance, bumpTalentQuality, rollTalentEvolutionIds };
