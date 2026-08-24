// The mission resolution engine (docs/TODO.md "Resolution engine rebuild"): one d100 roll per
// mission, raised by the character's relevant talents, compared against a single difficulty-indexed
// success threshold, with that same roll read a second time against the tier's injury bands. It
// replaces the old two-scale engine (`questResolution.js`, deleted here) and, once docs/TODO.md
// "ActionResult and the single applier" lands, the whole of `functions/src/missionResolution.js`
// too - which is why the "quest"/"objective" vocabulary is gone: one name, *mission*, everywhere.
//
// Pure math, no Firestore, no catalog reads: everything here is unit-testable against a seeded
// `Math.random`, the property the old engine had and this one keeps. Wound *application* is not
// here - `wounds.js` still owns the escalation ladder, and this file only names a severity.
//
// INTERIM: until that ActionResult row rewires the handlers, `functions/src/missionResolution.js`
// (the outer file, same basename, different directory) stays as a wrapper calling into this one.

const { DIFFICULTY_ORDER } = require("./rolls");

// Success threshold per difficulty, indexed by DIFFICULTY_ORDER position 0..5
// (facile..mythique). A single scale, not a per-tier object: talents no longer lower the bar, they
// raise the roll (see resolveMission).
const SUCCESS_THRESHOLD = [10, 40, 70, 90, 95, 100];

// Injury bands per difficulty, same 0..5 indexing, read against the *post-tier-drop* difficulty.
// Bands are exclusive, and severity rises as the roll goes down: a low roll hurts.
const INJURY_THRESHOLDS = [
  { light: 5, severe: 1, permanent: 0 },
  { light: 10, severe: 5, permanent: 1 },
  { light: 30, severe: 10, permanent: 5 },
  { light: 70, severe: 30, permanent: 10 },
  { light: 90, severe: 70, permanent: 30 },
  { light: 99, severe: 90, permanent: 70 },
];

// 25 / 45 / 20 / 6 / 3 / 1 percent, same 0..5 indexing - the distribution mission generation draws
// a difficulty from (docs/TODO.md "Mission generation from the bestiary", which consumes it).
const DIFFICULTY_WEIGHTS = [25, 45, 20, 6, 3, 1];

// The roll's domain is 0..99 (a deliberate change from the old engine's 1..100), which puts the top
// tier's threshold of 100 out of reach on the roll alone. That is the intended reading of
// "mythique", and isWinnableWithoutTalents below states it rather than leaving it as an accident of
// two numbers happening to sit one apart.
const MAX_ROLL = 99;

function rollD100() {
  return Math.floor(Math.random() * 100);
}

// A tier is winnable by a character with no relevant talent only if its threshold sits inside the
// roll's domain - false for "mythique" alone under the current table.
function isWinnableWithoutTalents(difficultyIndex) {
  const threshold = SUCCESS_THRESHOLD[difficultyIndex];
  return threshold != null && threshold <= MAX_ROLL;
}

// A talent counts for a mission only if it shares a tag with it *and* its quality reaches the
// mission's difficulty index - a usefulness gate the old engine had no equivalent of, where every
// tag-sharing talent shaved the threshold no matter how weak. `relevantSum` is what the roll gets
// raised by; `perfectCount` counts the quality-5 talents *among those relevant ones* (a quality-5
// talent always clears the gate, so tag overlap is the only thing that can leave one out).
function checkAgainstTalents(characterTalents, tagIds, difficultyIndex) {
  const missionTagIds = new Set(tagIds || []);
  let relevantSum = 0;
  let perfectCount = 0;

  for (const talent of characterTalents || []) {
    const quality = talent?.quality || 0;
    if (quality < difficultyIndex) continue;
    if (!(talent?.tagIds || []).some((id) => missionTagIds.has(id))) continue;
    relevantSum += quality;
    if (quality === 5) perfectCount += 1;
  }

  return { relevantSum, perfectCount };
}

// Spends quality-5 talents to drop whole difficulty tiers, one step at a time. Each step costs the
// mission's *original* difficulty index (not the current one), and a step needs strictly more than
// that cost left over - so the drop is cheap at low difficulty and dear at high difficulty. The
// consequence worth keeping in mind: a single quality-5 talent never drops a tier at any difficulty
// (at index 0 the loop cannot run at all, and above it `1 > difficultyIndex` fails).
function updateDifficulty(difficultyIndex, perfectCount) {
  let current = difficultyIndex;
  let perfectLeft = perfectCount || 0;

  // `current >= 1` floors the result at 0 ("facile") and, since the cost is the original index,
  // also keeps a difficulty-0 mission out of the loop entirely rather than spinning on a zero cost.
  while (perfectLeft > difficultyIndex && current >= 1) {
    perfectLeft -= difficultyIndex;
    current -= 1;
  }

  return current;
}

// The three injury flags for a roll, at most one of them set: the bands are exclusive and tested
// most severe first. `permanent` compares with `<=` like the other two - the source model's `<`
// left exactly one roll per tier producing no wound at all, which is a bug in that model, not a
// rule worth porting.
function injuryFromRoll(roll, effectiveDifficultyIndex) {
  const thresholds = INJURY_THRESHOLDS[effectiveDifficultyIndex];
  if (!thresholds) return { light: false, severe: false, permanent: false };

  const permanent = roll <= thresholds.permanent;
  const severe = !permanent && roll <= thresholds.severe;
  const light = !permanent && !severe && roll <= thresholds.light;
  return { light, severe, permanent };
}

// Collapses the injury triple to the severity string wounds.js's applyWound takes - the engine
// boundary where the character document's three flat counters take over.
function woundFromInjury(injury) {
  if (injury.permanent) return "permanent";
  if (injury.severe) return "severe";
  if (injury.light) return "light";
  return null;
}

// One mission resolution: one roll, raised by the relevant talents, against the tier the quality-5
// talents leave standing. The injury is read from the *raised* roll and the *dropped* tier, so
// talents help twice - and, because every tier's light band sits strictly below its own success
// threshold, a success mathematically never wounds under the current tables. The injury is returned
// unconditionally anyway, so the two tables can be retuned apart without this function silently
// swallowing a wound.
//
// An unknown difficulty is a content gap, not an error: it resolves as a wound-free failure, the
// same way the old engine's Infinity threshold did, so a bad catalog value costs a mission rather
// than the whole action.
function resolveMission({ character, tagIds, difficulty }) {
  const difficultyIndex = DIFFICULTY_ORDER.indexOf(difficulty);
  const roll = rollD100();

  if (difficultyIndex < 0) {
    return {
      roll,
      relevantSum: 0,
      updatedRoll: roll,
      difficultyIndex: null,
      effectiveDifficultyIndex: null,
      threshold: Infinity,
      success: false,
      injury: { light: false, severe: false, permanent: false },
      wound: null,
    };
  }

  const { relevantSum, perfectCount } = checkAgainstTalents(character?.talents, tagIds, difficultyIndex);
  const updatedRoll = roll + relevantSum;
  const effectiveDifficultyIndex = updateDifficulty(difficultyIndex, perfectCount);
  const threshold = SUCCESS_THRESHOLD[effectiveDifficultyIndex];
  const success = updatedRoll >= threshold;
  const injury = injuryFromRoll(updatedRoll, effectiveDifficultyIndex);

  return {
    roll,
    relevantSum,
    updatedRoll,
    difficultyIndex,
    effectiveDifficultyIndex,
    threshold,
    success,
    injury,
    wound: woundFromInjury(injury),
  };
}

module.exports = {
  SUCCESS_THRESHOLD,
  INJURY_THRESHOLDS,
  DIFFICULTY_WEIGHTS,
  MAX_ROLL,
  rollD100,
  isWinnableWithoutTalents,
  checkAgainstTalents,
  updateDifficulty,
  injuryFromRoll,
  woundFromInjury,
  resolveMission,
};
