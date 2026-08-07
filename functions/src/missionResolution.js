// The shared score-roll resolution engine behind every Aventure-branch encounter - "Mission"
// (mission.js) and "Partir explorer"'s per-round encounters (partirExplorer.js) - originally built
// inside the now-retired "Partir en quête" handler (docs/TODO.md "Retiring quests and quest
// objectives for the subject-action system") and moved here once that handler was deleted, since
// this engine had to keep serving its siblings. The "quest"/"objective" vocabulary in this file's
// parameter names is a leftover, generic shape - callers pass in whatever quest- or mission-shaped
// stand-in fits (see mission.js's missionAsQuest/missionObjective, partirExplorer.js's per-round
// synthetic quest/objective) - not a dependency on the retired worldData/quests/items catalog.
//
// Draws one objective, rolls one score, compares it against the two independent difficulty-derived
// scales, and only then narrates/rewards accordingly (docs/TODO.md "Mission and quest resolution
// algorithm" - carried over unchanged by the retirement migration).

const { RARITY_ORDER } = require("./lib/rolls");
const { pickRandom: pickRandomLoot, drawLootTableItemId, LOOT_COUNT_BY_DIFFICULTY } = require("./lib/loot");
const { rollTalentEvolutions } = require("./lib/talentEvolution");
const { applyWound } = require("./lib/wounds");
const {
  rollScore,
  rollReputationReward,
  computeSuccessThreshold,
  computeWoundThresholds,
  determineWoundSeverity,
} = require("./lib/questResolution");
const { generateNarrative, slotOf, SLOT_ORDER } = require("./textGeneration");

const DEFAULT_QUEST_DIFFICULTY_WEIGHTS = [
  { difficulty: "facile", weight: 55 },
  { difficulty: "moyen", weight: 30 },
  { difficulty: "difficile", weight: 10 },
  { difficulty: "tres_difficile", weight: 4 },
  { difficulty: "epique", weight: 1 },
];

const NARRATION_CIBLES = ["individuel", "groupe"];

// The talent flourish names a single talent, so the most notable change wins - the rarest one, the
// same ordering the result popup already uses for its "Amélioration de talent" list.
function pickNarratedEvolution(evolutions) {
  return (
    [...evolutions].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0] || null
  );
}

// A quest's successPhraseIds are the sentences its author judged to fit it; the global catalog is
// the fallback. Resolved per slot rather than over the whole pool, so linking one climax phrase to a
// quest doesn't also deprive that quest of every opening line and talent flourish.
function preferQuestPhrasesPerSlot({ questVerbPhrases, verbPhrases }) {
  return SLOT_ORDER.flatMap((slot) => {
    const own = questVerbPhrases.filter((v) => slotOf(v) === slot);
    return own.length > 0 ? own : verbPhrases.filter((v) => slotOf(v) === slot);
  });
}

// Everything the generator needs to know about this resolution, gathered in one pure function so
// the narrative-poc demo harness and the unit tests build the exact same context the live action
// does. Only the talent that actually progressed feeds `talentTags`, not the character's whole
// sheet: matching against every talent they own would let a swordsman's quest borrow the fire
// imagery of a Pyromancie they never used, which is the wrong-flavor failure the subset rule exists
// to prevent.
function buildNarrativeContext({ quest, locationName, talents, nextTalents, talentEvolutions }) {
  const narratedEvolution = pickNarratedEvolution(talentEvolutions || []);
  const narratedTalent = narratedEvolution
    ? (nextTalents || []).find((t) => t.id === narratedEvolution.talentId) ||
      (talents || []).find((t) => t.id === narratedEvolution.talentId)
    : null;

  return {
    talentTags: narratedTalent?.tagIds || [],
    questTags: quest.tagIds || [],
    talentChange: narratedEvolution?.kind || null,
    talentName: narratedEvolution?.name || null,
    locationName,
    questName: quest.name,
  };
}

// Tries a randomly-ordered target shape (a lone foe vs a group) against the quest's own objectives
// first, then the global subject pool, before trying the other shape - the same two-level fallback
// the old per-tier `cible` used to drive, just no longer needing a tier to pick a target from.
// Returns null if nothing in the catalog matches either shape (a content gap, not an error).
function narrateQuestSuccess({ quest, questObjectives, narrativeSubjects, verbPhrases, context }) {
  const cibles = Math.random() < 0.5 ? NARRATION_CIBLES : [...NARRATION_CIBLES].reverse();
  const questVerbPhrases = verbPhrases.filter((v) => (quest.successPhraseIds || []).includes(v.id));
  const pool = preferQuestPhrasesPerSlot({ questVerbPhrases, verbPhrases });

  for (const cible of cibles) {
    for (const subjects of [questObjectives, narrativeSubjects]) {
      const narrative = generateNarrative({ resultat: "victoire", cible, subjects, verbPhrases: pool, context });
      if (narrative) return narrative;
    }
  }

  return null;
}

// Mirrors narrateQuestSuccess exactly, just against the failure side: quest.failurePhraseIds
// instead of successPhraseIds, resultat: "echec" instead of "victoire".
function narrateQuestFailure({ quest, questObjectives, narrativeSubjects, verbPhrases, context }) {
  const cibles = Math.random() < 0.5 ? NARRATION_CIBLES : [...NARRATION_CIBLES].reverse();
  const questVerbPhrases = verbPhrases.filter((v) => (quest.failurePhraseIds || []).includes(v.id));
  const pool = preferQuestPhrasesPerSlot({ questVerbPhrases, verbPhrases });

  for (const cible of cibles) {
    for (const subjects of [questObjectives, narrativeSubjects]) {
      const narrative = generateNarrative({ resultat: "echec", cible, subjects, verbPhrases: pool, context });
      if (narrative) return narrative;
    }
  }

  return null;
}

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
function drawQuestLoot({ quest, difficulty, questObjectives, lootTables, objects, accomplishmentMessage, rarityOffset = 0 }) {
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
      description: `${object.description || ""} [Obtenue lorsque ${accomplishmentMessage}]`.trim(),
    });
  }
  return loot;
}

function resolveQuestOutcome({
  character,
  quest,
  questObjectives,
  narrativeSubjects,
  verbPhrases,
  lootTables,
  objects,
  talents,
  locationName,
  today,
  circumstance,
  defaultSuccessText,
  defaultSuccessClause,
  defaultFailureText,
  defaultFailureClause,
  // False for a caller whose outcome shouldn't be narrated via the verb-phrase generator at all
  // (docs/TODO.md "Retiring quests..." - a mission's success/failure paragraph is retired along
  // with quest.successPhraseIds/failurePhraseIds; the result pop-up shows only "Succès"/"Échec" for
  // a mission, same as other non-narrated actions). narrativeSubjects/verbPhrases become unused and
  // may be omitted when this is false.
  narrate = true,
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

  const score = rollScore();
  const threshold = computeSuccessThreshold({ character, objective, difficulty: quest.difficulty });
  const success = score >= threshold;

  const woundThresholds = computeWoundThresholds({ character, objective, difficulty: quest.difficulty });
  const wound = determineWoundSeverity({ score, thresholds: woundThresholds });
  const woundResult = wound ? applyWound(character, wound) : null;

  // Talent evolution was never gated by the retired tiers roll, only by "the quest succeeds" - it
  // now reads that flag off this score-based success instead. Rolled *before* the narration: the
  // narration's closing sentence names the talent that progressed, so it can't be written until
  // the roll has decided which one - if any - changed.
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

  let narrative = null;
  if (narrate) {
    const narrativeContext = buildNarrativeContext({ quest, locationName, talents, nextTalents, talentEvolutions });
    narrative = success
      ? narrateQuestSuccess({ quest, questObjectives, narrativeSubjects, verbPhrases, context: narrativeContext })
      : narrateQuestFailure({ quest, questObjectives, narrativeSubjects, verbPhrases, context: narrativeContext });
  }

  const narrativeText = narrative?.text || (success ? defaultSuccessText : defaultFailureText);
  const reputationGained = success ? rollReputationReward(quest.difficulty) : 0;

  const loot = drawLoot({
    quest,
    difficulty: quest.difficulty,
    questObjectives,
    lootTables,
    objects,
    // The climax clause, not the whole paragraph: this is embedded mid-sentence in each item's
    // description ("[Obtenue lorsque ...]"), which a three-sentence narrative would read badly in.
    accomplishmentMessage: narrative?.clause || (success ? defaultSuccessClause : defaultFailureClause),
    // New rewards on failure (docs/TODO.md): loot drawn the same way, just two rarity ranks below
    // each per-item objective's own rarity, floored at "commun" - no reputation, no talent evolution.
    rarityOffset: success ? 0 : 2,
  });

  return {
    score,
    threshold,
    success,
    wound,
    woundResult,
    reputationGained,
    loot,
    talentEvolutions,
    nextTalents,
    narrativeText,
    // The single objective this resolution rolled against (threshold/wound adjustments and talent
    // evolution) - exposed so a multi-round caller (partirExplorer.js) can record which objective
    // each of its rounds drew, without a second, wasteful pickRandomLoot call.
    objective,
  };
}

module.exports = {
  buildNarrativeContext,
  narrateQuestSuccess,
  narrateQuestFailure,
  preferQuestPhrasesPerSlot,
  drawQuestLoot,
  resolveQuestOutcome,
  pickNarratedEvolution,
  DEFAULT_QUEST_DIFFICULTY_WEIGHTS,
};
