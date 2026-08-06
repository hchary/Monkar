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
// ever rises alongside it, never drops. Shared by the quest-luck path (rollTalentEvolutions below)
// and the training-driven path (functions/src/actions/sEntrainer.js) - see docs/TODO.md
// "Trainers"'s note that s'entraîner reuses this exact mechanism rather than a second RNG system.
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

// On a successful quest, for every talent sharing a tag with the quest or its (randomly chosen)
// objective, rolls a chance to bump it (already-owned talents, rank <= objective's rarity) or to
// unlock it (catalog talents the character doesn't have yet, rank strictly below the objective's
// rarity). Returns the character's talents array with any changes applied (the same reference if
// nothing changed) plus the list of changes to show in the end-of-quest popup.
function rollTalentEvolutions({ characterTalents, catalogTalents, quest, objective, difficulty, today, circumstance }) {
  if (!objective) return { talents: characterTalents, evolutions: [] };

  const objectiveRankIndex = RARITY_ORDER.indexOf(objective.rarity);
  if (objectiveRankIndex < 0) return { talents: characterTalents, evolutions: [] };

  const relevantTagIds = new Set([...(quest.tagIds || []), ...(objective.tagIds || [])]);
  const sharesTag = (tagIds) => (tagIds || []).some((id) => relevantTagIds.has(id));

  const evolutions = [];
  let changed = false;

  const nextTalents = characterTalents.map((talent) => {
    if (!sharesTag(talent.tagIds)) return talent;
    const rankIndex = RARITY_ORDER.indexOf(talent.rarity);
    if (rankIndex < 0 || rankIndex > objectiveRankIndex) return talent;
    if (Math.random() >= evolutionChance({ difficulty, talentRarity: talent.rarity })) return talent;

    changed = true;
    const evolved = bumpTalentQuality(talent, { today, circumstance });
    evolutions.push({ talentId: evolved.id, name: evolved.name, kind: "evolution", quality: evolved.quality, rarity: evolved.rarity });
    return evolved;
  });

  const ownedIds = new Set(characterTalents.map((t) => t.id));
  for (const talent of catalogTalents) {
    if (ownedIds.has(talent.id)) continue;
    if (!sharesTag(talent.tagIds)) continue;
    const rankIndex = RARITY_ORDER.indexOf(talent.rarity);
    if (rankIndex < 0 || rankIndex >= objectiveRankIndex) continue;
    if (Math.random() >= evolutionChance({ difficulty, talentRarity: talent.rarity })) continue;

    changed = true;
    const granted = {
      id: talent.id,
      name: talent.name,
      quality: 1,
      trainable: !!talent.trainable,
      rarity: rarityFloor(talent.rarity, 1),
      effect: talent.effect || "",
      tagIds: talent.tagIds || [],
      lastChangeDate: today,
      lastChangeCircumstance: circumstance,
    };
    nextTalents.push(granted);
    evolutions.push({ talentId: granted.id, name: granted.name, kind: "unlock", quality: granted.quality, rarity: granted.rarity });
  }

  return { talents: changed ? nextTalents : characterTalents, evolutions };
}

module.exports = { evolutionChance, bumpTalentQuality, rollTalentEvolutions };
