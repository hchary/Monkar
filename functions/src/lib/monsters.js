// Resolves what a monster inherits along its `parentId` chain - the server copy, and the one
// covered by tests.
//
// The resolution half is mirrored (bodies identical, only the import/export syntax differs) in
// src/lib/monsters.js, which adds the creator-only helpers behind its read-only "hérité du parent"
// panel and its parent picker, and which nothing on the server needs. functions/ is
// CommonJS with no build step shared with the Vite app, so a duplicated pure module is the
// established answer here - same convention as actionConditions.js / lootTables.js / salePrice.js.
// Keep the other in step when editing.
//
// Landed with docs/TODO.md "ActionResult and the single applier", whose rewiring of
// partirExplorer.js is the first consumer; "Mission generation from the bestiary" is the second.
//
// Per-field rules come from shared/schema/monster.ts: array fields concatenate down the chain
// (deduplicated), scalars take the first non-null starting at the monster itself, `name` and
// `trigger` are never inherited.

// Longest chain walked, monster included: a deeper one is truncated rather than followed, matching
// the depth cap the schema documents. Authored bestiaries are two or three levels deep in practice.
const MAX_INHERITANCE_DEPTH = 8;

// { [id]: monster } over a raw monster list, for the chain walk below.
function indexMonstersById(monsters) {
  return Object.fromEntries((monsters || []).map((monster) => [monster.id, monster]));
}

// [monster, parent, grandparent, ...], stopping at a root, at a missing parent, at an id already
// seen (cycle guard - the creator forbids authoring one, the resolution still survives it) or at
// MAX_INHERITANCE_DEPTH entries.
function monsterChain(monster, monstersById) {
  const chain = [];
  const seen = new Set();
  let current = monster;
  while (current && !seen.has(current.id) && chain.length < MAX_INHERITANCE_DEPTH) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId ? monstersById[current.parentId] : null;
  }
  return chain;
}

// First value the chain actually carries, child first - null when nobody sets it.
function firstSet(chain, field) {
  for (const monster of chain) {
    const value = monster[field];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

// Every id the chain contributes, ancestors first, without duplicates.
function concatDeduped(chain, field) {
  const ids = [];
  for (const monster of [...chain].reverse()) {
    for (const id of monster[field] || []) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

// A monster as generation sees it: own values completed by the parent chain's.
function resolveMonster(monster, monstersById) {
  const chain = monsterChain(monster, monstersById);
  return {
    id: monster?.id || null,
    name: monster?.name || "",
    difficulty: firstSet(chain, "difficulty"),
    areaType: firstSet(chain, "areaType"),
    tagIds: concatDeduped(chain, "tagIds"),
    lootItemIds: concatDeduped(chain, "lootItemIds"),
    talentRewardId: firstSet(chain, "talentRewardId"),
    trigger: monster?.trigger ?? null,
  };
}

// Every monster whose *resolved* area type matches, so a variant inheriting its area from a parent
// is drawn in that area even though its own field is null. An area type of null matches nothing:
// a bestiary entry nobody placed is a content gap, not a wildcard.
function monstersForAreaType(monsters, areaType) {
  if (!areaType) return [];
  const monstersById = indexMonstersById(monsters);
  return (monsters || [])
    .map((monster) => resolveMonster(monster, monstersById))
    .filter((resolved) => resolved.areaType === areaType);
}

module.exports = {
  MAX_INHERITANCE_DEPTH,
  indexMonstersById,
  monsterChain,
  resolveMonster,
  monstersForAreaType,
};
