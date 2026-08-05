const { DIFFICULTY_ORDER } = require("./rolls");
const { evaluateConditions } = require("./actionConditions");

// The score-roll resolution algorithm for "Partir en quête"/"Mission" (docs/TODO.md "Mission and
// quest resolution algorithm"): one random score (1-100) per resolution, compared against two
// independent difficulty-derived scales. Pure math only - no Firestore access - so it can be unit
// tested without mocking anything beyond Math.random. Shared by partirEnQuete.js's
// resolveQuestOutcome (and, through it, mission.js).

// Base success threshold and the talent level a tier "expects", per difficulty tier.
const SUCCESS_TABLE = {
  facile: { threshold: 30, requiredTalentLevel: 1 },
  moyen: { threshold: 50, requiredTalentLevel: 1 },
  difficile: { threshold: 80, requiredTalentLevel: 2 },
  tres_difficile: { threshold: 90, requiredTalentLevel: 3 },
  epique: { threshold: 98, requiredTalentLevel: 4 },
  mythique: { threshold: 100, requiredTalentLevel: 5 },
};

// Base wound thresholds per tier, plus the cost (in owned quality-5 "talents parfaits") of
// stepping down from this tier to the one directly below it - null on "facile" since there is no
// tier below it to step down to.
const WOUND_TABLE = {
  facile: { permanent: 1, severe: 5, light: 20, dropCost: null },
  moyen: { permanent: 2, severe: 10, light: 50, dropCost: 1 },
  difficile: { permanent: 5, severe: 30, light: 60, dropCost: 2 },
  tres_difficile: { permanent: 10, severe: 50, light: 80, dropCost: 3 },
  epique: { permanent: 30, severe: 80, light: 95, dropCost: 4 },
  mythique: { permanent: 50, severe: 95, light: 100, dropCost: 5 },
};

// Wound thresholds never drop below these, even after every applicable reduction.
const WOUND_FLOORS = { permanent: 1, severe: 2, light: 3 };

// Reputation reward on success: base + 1d[diceMax] (a random integer 0..diceMax inclusive).
const REPUTATION_REWARDS = {
  facile: { base: 1, diceMax: 2 },
  moyen: { base: 5, diceMax: 4 },
  difficile: { base: 10, diceMax: 6 },
  tres_difficile: { base: 20, diceMax: 10 },
  epique: { base: 80, diceMax: 20 },
  mythique: { base: 200, diceMax: 100 },
};

function rollScore() {
  return Math.floor(Math.random() * 100) + 1;
}

function rollReputationReward(difficulty) {
  const cfg = REPUTATION_REWARDS[difficulty];
  if (!cfg) return 0;
  return cfg.base + Math.floor(Math.random() * (cfg.diceMax + 1));
}

function sharesTag(tagIds, objectiveTagIds) {
  const relevant = new Set(objectiveTagIds || []);
  return (tagIds || []).some((id) => relevant.has(id));
}

// The drawn objective can carry a strict condition gating whether a character's talent-tag
// overlap counts at all this resolution: when set, the character must own at least one talent
// matching it (all-or-nothing - not a per-talent filter of who counts). When absent/null, every
// talent sharing a tag with the objective counts, as before.
function talentTagAdjustmentAllowed(character, objective) {
  const conditions = objective?.condition?.conditions;
  if (conditions == null) return true;
  return evaluateConditions(conditions, { character }).ok;
}

// Every character talent sharing a tag with the drawn objective reduces the success threshold by
// 1, plus 1 more per talent quality level above the tier's required level - summed over every
// qualifying talent, gated by the strict objective condition above.
function computeSuccessThreshold({ character, objective, difficulty }) {
  const base = SUCCESS_TABLE[difficulty];
  if (!base) return Infinity;
  if (!objective || !talentTagAdjustmentAllowed(character, objective)) return base.threshold;

  const reduction = (character?.talents || [])
    .filter((talent) => sharesTag(talent.tagIds, objective.tagIds))
    .reduce((sum, talent) => sum + 1 + Math.max(0, (talent.quality || 0) - base.requiredTalentLevel), 0);

  return base.threshold - reduction;
}

// Spends the character's total count of owned quality-5 ("talents parfaits") talents, greedily
// and tag-independently, one tier-step at a time from the actual difficulty down toward "facile",
// as long as the running total can afford the next step's dropCost. Any leftover balance is
// wasted, never banked, and the result never drops below "facile".
function dropDifficultyTier(difficulty, perfectTalentCount) {
  let index = DIFFICULTY_ORDER.indexOf(difficulty);
  if (index < 0) return difficulty;

  let remaining = perfectTalentCount || 0;
  while (index > 0) {
    const cost = WOUND_TABLE[DIFFICULTY_ORDER[index]].dropCost;
    if (cost == null || remaining < cost) break;
    remaining -= cost;
    index -= 1;
  }
  return DIFFICULTY_ORDER[index];
}

// Looks up the tier-dropped wound row, then reduces each of its three thresholds by 1 per
// tag-sharing talent (same strict-condition gate as the success threshold), floored individually.
function computeWoundThresholds({ character, objective, difficulty }) {
  const perfectTalentCount = (character?.talents || []).filter((t) => (t.quality || 0) >= 5).length;
  const effectiveDifficulty = dropDifficultyTier(difficulty, perfectTalentCount);
  const base = WOUND_TABLE[effectiveDifficulty];
  if (!base) return { permanent: null, severe: null, light: null };

  const reducible =
    objective && talentTagAdjustmentAllowed(character, objective)
      ? (character?.talents || []).filter((talent) => sharesTag(talent.tagIds, objective.tagIds)).length
      : 0;

  return {
    permanent: Math.max(WOUND_FLOORS.permanent, base.permanent - reducible),
    severe: Math.max(WOUND_FLOORS.severe, base.severe - reducible),
    light: Math.max(WOUND_FLOORS.light, base.light - reducible),
  };
}

// The score is compared against all three wound thresholds for an exact match - not >=. If more
// than one threshold coincides on the same value (possible once floors compress the range), the
// most severe matching wound wins rather than stacking several from one roll.
function determineWoundSeverity({ score, thresholds }) {
  if (score === thresholds.permanent) return "permanent";
  if (score === thresholds.severe) return "severe";
  if (score === thresholds.light) return "light";
  return null;
}

module.exports = {
  SUCCESS_TABLE,
  WOUND_TABLE,
  WOUND_FLOORS,
  REPUTATION_REWARDS,
  rollScore,
  rollReputationReward,
  talentTagAdjustmentAllowed,
  computeSuccessThreshold,
  dropDifficultyTier,
  computeWoundThresholds,
  determineWoundSeverity,
};
