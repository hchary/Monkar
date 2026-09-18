// What a resolved mission pays in reputation (docs/TODO.md "Per-region reputation"): one signed
// number per outcome, read off the difficulty index alone.
//
//   success -> +(1 + difficultyIndex)      facile +1 ... mythique +6
//   failure -> -(4 - difficultyIndex)      facile -4 ... epique 0, mythique +1
//
// Unclamped on purpose: the failure penalty shrinks as the tier rises, so `epique` costs nothing to
// fail and `mythique` pays a point even when it is lost. Attempting something that could not
// reasonably be done is not what damages a reputation - failing something easy is.
//
// This replaced the pre-rework 1->300 random scale (`REPUTATION_REWARDS` / `rollReputationReward`,
// which travelled through here as an interim while the engine was rebuilt): reputation is no longer
// a career score that only ever grows, it is a relationship with a place, so it has to be able to
// go down and its numbers have to stay small enough to read.
//
// The *crediting* is not here: a handler puts this number on its ActionResult's `reputationGained`
// (naming a region through `reputationRegionId` when the action is not simply where the character
// stands) and `functions/src/lib/actionResult.js`'s applier decides which entry of
// `character.reputations` it lands in.
//
// Two invariants the pair of formulas holds, both pinned by reputation.test.js because neither
// survives a retune of one formula alone:
//
// 1. **The talentless curve is flat.** Weighted by the generation difficulty distribution
//    (DIFFICULTY_WEIGHTS, 25/45/20/6/3/1) and each tier's own success rate, a character with no
//    relevant talent expects +0.0125 reputation per mission - zero, to within a rounding error.
//    Missions alone do not build a reputation.
// 2. **A point of talent is worth the same everywhere.** The success/failure spread is
//    `(1 + d) + (4 - d) = 5` at every tier, so one point of talent bonus (one percentage point of
//    success chance) is worth exactly +0.05 expected reputation whatever the difficulty, and one
//    tag-matching quality-5 talent is worth exactly +0.25. Talents are what make missions pay; the
//    tier chosen is not.

const { DIFFICULTY_ORDER } = require("./rolls");

// The reward for a success and the penalty for a failure at a given difficulty index. Kept as two
// one-line helpers rather than a table so the "they sum to a constant 5" property above is visible
// in the arithmetic instead of having to be read off six pairs of numbers.
function successReputation(difficultyIndex) {
  return 1 + difficultyIndex;
}

function failureReputation(difficultyIndex) {
  // The same number as the `-(4 - d)` the design states, written as a subtraction so that failing
  // an `epique` mission yields 0 rather than JavaScript's -0, which every strict comparison and
  // every stored value downstream would otherwise have to tolerate.
  return difficultyIndex - 4;
}

// The signed reputation one mission outcome pays. An unknown difficulty pays nothing in either
// direction - a content gap costs the reward, not the resolution, the same convention
// `resolveMission` and `drawMissionLoot` take for a difficulty they cannot place on the scale.
function reputationForOutcome({ success, difficulty }) {
  const difficultyIndex = DIFFICULTY_ORDER.indexOf(difficulty);
  if (difficultyIndex < 0) return 0;
  return success ? successReputation(difficultyIndex) : failureReputation(difficultyIndex);
}

module.exports = { successReputation, failureReputation, reputationForOutcome };
