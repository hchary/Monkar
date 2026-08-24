// Resolves what a monster inherits along its `parentId` chain.
//
// Client twin of the resolution the Cloud Functions run at draw time
// (functions/src/lib/monsters.js, landed with docs/TODO.md "ActionResult and the single applier"):
// here it only feeds the creator's read-only "hérité du parent" panel, so an author can
// see what a monster actually carries without opening its ancestors. Duplicating a pure module is
// the established answer in this repo - functions/ is CommonJS with no build step shared with the
// Vite app (same convention as actionConditions.js / lootTables.js / salePrice.js). Keep both in
// step; the server one is the one covered by tests. The two helpers below resolveMonster are
// creator-only and have no server counterpart.
//
// Per-field rules come from shared/schema/monster.ts: array fields concatenate down the chain
// (deduplicated), scalars take the first non-null starting at the monster itself, `name` and
// `trigger` are never inherited.

// Longest chain walked, monster included: a deeper one is truncated rather than followed, matching
// the depth cap the schema documents. Authored bestiaries are two or three levels deep in practice.
export const MAX_INHERITANCE_DEPTH = 8;

// { [id]: monster } over a raw monster list, for the chain walk below.
export function indexMonstersById(monsters) {
  return Object.fromEntries(monsters.map((monster) => [monster.id, monster]));
}

// [monster, parent, grandparent, ...], stopping at a root, at a missing parent, at an id already
// seen (cycle guard - the creator forbids authoring one, the resolution still survives it) or at
// MAX_INHERITANCE_DEPTH entries.
export function monsterChain(monster, monstersById) {
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

// Every id the chain contributes, ancestors first, without duplicates - so the panel reads
// inherited-then-own.
function concatDeduped(chain, field) {
  const ids = [];
  for (const monster of [...chain].reverse()) {
    for (const id of monster[field] || []) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

// A monster as generation will see it: own values completed by the parent chain's.
export function resolveMonster(monster, monstersById) {
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

// What the parent chain alone carries, i.e. what a monster gets for free before its own fields are
// applied. `name` and `trigger` are left out: neither is inherited.
export function resolveInheritedFrom(parentId, monstersById) {
  const parent = parentId ? monstersById[parentId] : null;
  if (!parent) return { difficulty: null, areaType: null, tagIds: [], lootItemIds: [], talentRewardId: null };
  const { difficulty, areaType, tagIds, lootItemIds, talentRewardId } = resolveMonster(parent, monstersById);
  return { difficulty, areaType, tagIds, lootItemIds, talentRewardId };
}

// The ids a monster must not be allowed to pick as its parent: itself and everything that already
// descends from it. Client-side cycle prevention - the picker simply never offers them.
export function selfAndDescendantIds(monsterId, monsters) {
  if (!monsterId) return new Set();
  const excluded = new Set([monsterId]);
  // Repeat until nothing new is excluded: children can appear in any order in the list.
  let grew = true;
  while (grew) {
    grew = false;
    for (const monster of monsters) {
      if (!excluded.has(monster.id) && monster.parentId && excluded.has(monster.parentId)) {
        excluded.add(monster.id);
        grew = true;
      }
    }
  }
  return excluded;
}
