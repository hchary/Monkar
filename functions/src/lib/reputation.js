// INTERIM. The reputation a resolved mission pays, and the last survivor of the pre-rework
// engine's tables: the 1→300 random scale.
//
// docs/TODO.md "Per-region reputation" replaces it with the signed `1 + difficultyIndex` /
// `-(4 - difficultyIndex)` pair and the zero-sum invariant that goes with it. Until that row lands,
// this scale stays so a successful mission keeps paying something - it travelled here from the
// deleted `functions/src/missionResolution.js` when docs/TODO.md "ActionResult and the single
// applier" took that file apart, rather than being deleted with it.
//
// The *crediting* is not here: a handler puts this number on its ActionResult's `reputationGained`
// and `functions/src/lib/actionResult.js`'s applier decides which region's entry it lands in.

const REPUTATION_REWARDS = {
  facile: { base: 1, diceMax: 2 },
  moyen: { base: 5, diceMax: 4 },
  difficile: { base: 10, diceMax: 6 },
  tres_difficile: { base: 20, diceMax: 10 },
  epique: { base: 80, diceMax: 20 },
  mythique: { base: 200, diceMax: 100 },
};

// An unknown difficulty pays nothing - a content gap costs the reward, not the resolution.
function rollReputationReward(difficulty) {
  const cfg = REPUTATION_REWARDS[difficulty];
  if (!cfg) return 0;
  return cfg.base + Math.floor(Math.random() * (cfg.diceMax + 1));
}

module.exports = { REPUTATION_REWARDS, rollReputationReward };
