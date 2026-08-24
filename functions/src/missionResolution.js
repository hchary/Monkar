// INTERIM. The orchestration layer around every Aventure-branch encounter - "Mission"
// (mission.js) and "Partir explorer"'s per-round encounters (partirExplorer.js): it draws the
// loot, rolls the talent evolutions, applies the wound and hands the handler one outcome object.
// The resolution *math* is no longer here - docs/TODO.md "Resolution engine rebuild" moved it to
// `functions/src/lib/missionResolution.js` (same basename, different directory), which this file
// now calls into.
//
// This whole file, including the "quest"/"objective" vocabulary its parameter names still carry,
// disappears with docs/TODO.md "ActionResult and the single applier": the handlers stop being fed
// an outcome object and start returning an `ActionResult` built on the engine directly. Until then
// it stays as the one place the old shape is adapted to the new engine, so the two handlers keep
// working unchanged - the same interim treatment "Narration removal" gave `assembleMissionName`.
//
// Outcomes are not narrated: the procedural narrative generator and its catalogs were removed by
// docs/TODO.md "Narration removal", so `narrativeText` is always "".

const { RARITY_ORDER } = require("./lib/rolls");
const { pickRandom: pickRandomLoot, drawLootTableItemId, LOOT_COUNT_BY_DIFFICULTY } = require("./lib/loot");
const { rollTalentEvolutions } = require("./lib/talentEvolution");
const { applyWound } = require("./lib/wounds");
const { resolveMission } = require("./lib/missionResolution");

// INTERIM, and the last survivor of the old engine's tables: the 1→300 random reputation scale.
// docs/TODO.md "Per-region reputation" replaces it with the signed `1 + difficultyIndex` /
// `-(4 - difficultyIndex)` pair credited to a named region, which is a different feature from this
// row's engine rebuild - so rather than leave successful missions paying nothing in the meantime,
// the scale moved here to die with the rest of this file.
const REPUTATION_REWARDS = {
  facile: { base: 1, diceMax: 2 },
  moyen: { base: 5, diceMax: 4 },
  difficile: { base: 10, diceMax: 6 },
  tres_difficile: { base: 20, diceMax: 10 },
  epique: { base: 80, diceMax: 20 },
  mythique: { base: 200, diceMax: 100 },
};

function rollReputationReward(difficulty) {
  const cfg = REPUTATION_REWARDS[difficulty];
  if (!cfg) return 0;
  return cfg.base + Math.floor(Math.random() * (cfg.diceMax + 1));
}

const DEFAULT_QUEST_DIFFICULTY_WEIGHTS = [
  { difficulty: "facile", weight: 55 },
  { difficulty: "moyen", weight: 30 },
  { difficulty: "difficile", weight: 10 },
  { difficulty: "tres_difficile", weight: 4 },
  { difficulty: "epique", weight: 1 },
];

// Draws the resolution's loot: one loot table per item, picked among those sharing at least one
// tag with the quest or the (randomly chosen, per item) objective and matching that objective's
// rarity - then a uniform item draw within that table. Items with no matching table/objective are
// silently skipped rather than failing the whole resolution (content gap). The default `drawLoot`
// resolveQuestOutcome falls back to when a caller doesn't override it.
//
// `rarityOffset` (default 0) shifts the target rarity down that many ranks on the shared 8-tier
// scale, floored at "commun" - used to draw the degraded-rarity consolation loot a failed
// resolution grants (docs/TODO.md "Mission and quest resolution algorithm"), instead of matching
// the drawn objective's rarity exactly the way a success does.
function drawQuestLoot({ quest, difficulty, questObjectives, lootTables, objects, rarityOffset = 0 }) {
  const count = LOOT_COUNT_BY_DIFFICULTY[difficulty] || 0;
  const loot = [];
  for (let i = 0; i < count; i++) {
    const objective = pickRandomLoot(questObjectives);
    if (!objective) continue;

    const targetRarityIndex = Math.max(RARITY_ORDER.indexOf(objective.rarity) - rarityOffset, 0);
    const targetRarity = RARITY_ORDER[targetRarityIndex] ?? objective.rarity;

    const relevantTagIds = new Set([...(quest.tagIds || []), ...(objective.tagIds || [])]);
    const candidateTables = lootTables.filter(
      (table) => table.rarity === targetRarity && (table.tagIds || []).some((id) => relevantTagIds.has(id))
    );
    const table = pickRandomLoot(candidateTables);
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
      // The catalog description, unmodified: the "[Obtenue lorsque ...]" provenance clause was
      // dropped with the narrative generator that used to write it (docs/TODO.md "Narration
      // removal"). Documents written before that keep the sentences they already carry.
      description: object.description || "",
    });
  }
  return loot;
}

function resolveQuestOutcome({
  character,
  quest,
  questObjectives,
  lootTables,
  objects,
  talents,
  locationName,
  today,
  circumstance,
  // Overridable so mission.js can draw loot through missionLoot.js's drawMissionLoot instead - a
  // mission's loot pool is resolved once per occurrence from its own tagIds/rarity rather than
  // re-rolled per item against a curated questObjectives list (docs/TODO.md "Mission loot and
  // rarity mapping"). Same call signature as drawQuestLoot above, so either can be dropped in.
  drawLoot = drawQuestLoot,
}) {
  // Reused for the threshold/wound adjustments below and for talent evolution - the same single
  // draw already made for that mechanism, not a second roll. Independent of loot's own per-item
  // objective draw inside drawQuestLoot.
  const objective = pickRandomLoot(questObjectives);

  // The engine matches talents against one tag list, the way a monster's resolved tags will be
  // passed once docs/TODO.md "Mission generation from the bestiary" lands. Both current callers
  // build their synthetic objective from the very tagIds they also put on the quest, so the
  // objective's list is the mission's list.
  const outcome = resolveMission({
    character,
    tagIds: objective?.tagIds || quest.tagIds || [],
    difficulty: quest.difficulty,
  });

  // `score` is the *raised* roll - the number actually compared against the threshold, and the one
  // the result pop-up's "Jet : X (seuil de réussite : Y)" line has to show for the comparison to
  // read true. The raw 0..99 roll and the talent bonus that raised it stay on the outcome for
  // docs/TODO.md "Result pop-up rework" to display separately if it wants them.
  const { roll, relevantSum, updatedRoll: score, threshold, success, wound } = outcome;
  const woundResult = wound ? applyWound(character, wound) : null;

  // Talent evolution was never gated by the retired tiers roll, only by "the quest succeeds" - it
  // now reads that flag off this score-based success instead.
  let nextTalents = character.talents || [];
  let talentEvolutions = [];
  if (success) {
    ({ talents: nextTalents, evolutions: talentEvolutions } = rollTalentEvolutions({
      characterTalents: character.talents || [],
      catalogTalents: talents,
      quest,
      objective,
      difficulty: quest.difficulty,
      today,
      circumstance,
    }));
  }

  const reputationGained = success ? rollReputationReward(quest.difficulty) : 0;

  const loot = drawLoot({
    quest,
    difficulty: quest.difficulty,
    questObjectives,
    lootTables,
    objects,
    // New rewards on failure (docs/TODO.md): loot drawn the same way, just two rarity ranks below
    // each per-item objective's own rarity, floored at "commun" - no reputation, no talent evolution.
    rarityOffset: success ? 0 : 2,
  });

  return {
    roll,
    relevantSum,
    score,
    threshold,
    success,
    wound,
    woundResult,
    reputationGained,
    loot,
    talentEvolutions,
    nextTalents,
    // Always "" since docs/TODO.md "Narration removal" retired the generator - kept on the returned
    // shape (and therefore on lastAction/actionsLog) so historical documents stay readable against
    // the same field, rather than the key disappearing mid-history.
    narrativeText: "",
    // The single objective this resolution rolled against (threshold/wound adjustments and talent
    // evolution) - exposed so a multi-round caller (partirExplorer.js) can record which objective
    // each of its rounds drew, without a second, wasteful pickRandomLoot call.
    objective,
  };
}

module.exports = {
  drawQuestLoot,
  resolveQuestOutcome,
  DEFAULT_QUEST_DIFFICULTY_WEIGHTS,
};
