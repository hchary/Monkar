// Selects loot for a resolved mission or exploration round - see docs/TODO.md "Monster-pool loot".
// The draw is over the *target monster's own* lootItemIds (its parent chain's included, resolved by
// lib/monsters.js), not over the loot tables it used to match by rarity + tag: a monster carries
// what it drops, so a hunt's reward is a property of what was hunted rather than of a separate
// catalog that happened to share a tag with it.
//
// Called straight from functions/src/actions/mission.js's and functions/src/actions/
// partirExplorer.js's resolve(), which put what it returns on their ActionResult's `itemsGained`
// (docs/TODO.md "ActionResult and the single applier").
//
// `worldData/lootTables/items` keeps no mission consumer after this: it survives for harvest
// (recolte.js), so its creator page, schema and collection all stay, but weightMode / itemWeights
// no longer touch mission loot, whose draw is uniform.

const { RARITY_ORDER, DIFFICULTY_ORDER } = require("./lib/rolls");
const { pickRandom } = require("./lib/loot");

// Positional equivalence between the 6-tier DIFFICULTIES scale and the shared 8-tier rarity scale
// (docs/TODO.md "Quest difficulty"), the same mapping functions/src/lib/talentEvolution.js's
// evolutionChance already relies on for its own difficulty/rarity alignment - reused, not redefined.
function difficultyToRarity(difficulty) {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  return index === -1 ? null : RARITY_ORDER[index];
}

// How rich this draw is allowed to get, as an index into RARITY_ORDER: the higher of the mission's
// own difficulty and the target monster's. An unknown difficulty on either side contributes nothing
// (index -1) rather than a "commun" ceiling, so a monster authored without a difficulty doesn't
// silently cap a mythique hunt at commons; two unknowns leave the ceiling below the scale, which
// the empty-pool fallback below then turns into an unfiltered draw.
//
// This is a ceiling, not an exact match: a mythique mission against a common-loot monster still
// draws commons. The retired table match guaranteed the tier, this only permits it.
function rarityCeilingIndex({ difficulty, monsterDifficulty }) {
  return Math.max(DIFFICULTY_ORDER.indexOf(difficulty), DIFFICULTY_ORDER.indexOf(monsterDifficulty));
}

function toLootEntry(object) {
  return {
    objectId: object.id,
    name: object.name,
    rarity: object.rarity,
    type: object.type,
    tagIds: object.tagIds || [],
    // The catalog description, unmodified: the "[Obtenue lorsque ...]" provenance clause went
    // with the narrative generator (docs/TODO.md "Narration removal").
    description: object.description || "",
  };
}

// `success` drives the count (3 on a success, 1 on a failure) - the outcome moves how *much* is
// paid, not how rare it is, so a failure now pays undegraded loot at a smaller haul where the web
// previously degraded rarity on a full-size one. The old `rarityOffset` lever is gone rather than
// left dangling.
//
// `lootItemIds` is the monster's *resolved* pool (lib/monsters.js's resolveMonster), and
// `monsterDifficulty` its *resolved* difficulty. A pool with nothing under the ceiling degrades to
// the unfiltered pool rather than paying nothing - a content gap costs the rarity guarantee, not
// the reward - and a monster with no loot authored at all yields []. Nothing here throws.
function drawMissionLoot({ success, difficulty, monsterDifficulty, lootItemIds, objects }) {
  const resolvedPool = (lootItemIds || [])
    .map((objectId) => (objects || []).find((o) => o.id === objectId))
    .filter(Boolean);
  if (resolvedPool.length === 0) return [];

  const ceilingIndex = rarityCeilingIndex({ difficulty, monsterDifficulty });
  const filteredPool = resolvedPool.filter((object) => RARITY_ORDER.indexOf(object.rarity) <= ceilingIndex);
  const pool = filteredPool.length > 0 ? filteredPool : resolvedPool;

  // With replacement: the pool is what the monster carries, not a stack of distinct trophies, so
  // the same drop twice is two Instance documents on commit - exactly like recolte.js's repeated ids.
  const count = success ? 3 : 1;
  const loot = [];
  for (let i = 0; i < count; i++) {
    const object = pickRandom(pool);
    if (object) loot.push(toLootEntry(object));
  }
  return loot;
}

module.exports = { difficultyToRarity, rarityCeilingIndex, drawMissionLoot };
