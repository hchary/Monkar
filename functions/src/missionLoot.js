// Selects loot for a generated mission occurrence - see docs/TODO.md "Mission loot and rarity
// mapping". Reuses the exact rarity + tag matching mechanism functions/src/actions/partirEnQuete.js
// built for quests (drawQuestLoot), but resolves the target rarity and tag pool once per mission
// occurrence instead of re-rolling them per item: a mission's difficulty, Subject, difficulty-tier
// and variation are all already fixed at generation time, so there is no second candidate to draw
// from the way a quest's several possible objectives allow. Only the loot table pick and the
// drawLootTableItemId draw within it vary per item.
//
// Wiring this into an actual mission-generation/resolution flow is out of scope here - see
// docs/TODO.md "Regional mission generation and journal" for that consumer.

const { RARITY_ORDER, DIFFICULTY_ORDER } = require("./lib/rolls");
const { pickRandom, drawLootTableItemId, LOOT_COUNT_BY_DIFFICULTY } = require("./lib/loot");

// Positional equivalence between the 6-tier DIFFICULTIES scale and the shared 8-tier rarity scale
// (docs/TODO.md "Quest difficulty"), the same mapping functions/src/lib/talentEvolution.js's
// evolutionChance already relies on for its own difficulty/rarity alignment - reused, not redefined.
function difficultyToRarity(difficulty) {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  return index === -1 ? null : RARITY_ORDER[index];
}

// `tagIds`: the union of the difficulty-tier tagIds and variation tagIds drawn for the mission's
// Subject at generation time (docs/TODO.md "Mission subject and action catalog"). Tables with no
// matching rarity/tag, or an empty draw within a matching table, are silently skipped rather than
// failing the mission itself - the same content-gap precedent drawQuestLoot already set.
function drawMissionLoot({ difficulty, tagIds, lootTables, objects, accomplishmentMessage }) {
  const targetRarity = difficultyToRarity(difficulty);
  if (!targetRarity) return [];

  const relevantTagIds = new Set(tagIds || []);
  const candidateTables = lootTables.filter(
    (table) => table.rarity === targetRarity && (table.tagIds || []).some((id) => relevantTagIds.has(id))
  );

  const count = LOOT_COUNT_BY_DIFFICULTY[difficulty] || 0;
  const loot = [];
  for (let i = 0; i < count; i++) {
    const table = pickRandom(candidateTables);
    if (!table) continue;

    const objectId = drawLootTableItemId(table);
    const object = objects.find((o) => o.id === objectId);
    if (!object) continue;

    loot.push({
      objectId: object.id,
      name: object.name,
      rarity: object.rarity,
      type: object.type,
      tagIds: object.tagIds || [],
      tableId: table.id,
      tableName: table.name,
      description: `${object.description || ""} [Obtenue lorsque ${accomplishmentMessage}]`.trim(),
    });
  }
  return loot;
}

module.exports = { difficultyToRarity, drawMissionLoot };
