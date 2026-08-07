// How many missions a character must resolve between two "Se renseigner" occurrences (docs/
// TODO.md "Se renseigner intermède action"). Mirrored between
// functions/src/lib/missionsRequiredForRenseignement.js and
// src/lib/missionsRequiredForRenseignement.js, same convention as trainingCost.js - the
// functions/ copy gates the action (authority), the src/ copy only displays the requirement
// before "Commencer" (UX).
//
// Decided formula: 5 missions required at 0 reputation, one fewer every 20 reputation earned,
// floored at 1 (never fully free) - a starting balance value, not playtested, tunable the same
// way rumorHarvestCount/missionRollCount already are (see docs/TODO.md "Rumor and mission
// system").
export const MISSIONS_REQUIRED_BASE = 0;
export const REPUTATION_PER_DISCOUNT = 0;
export const MISSIONS_REQUIRED_MIN = 0;

export function missionsRequiredForRenseignement(reputation) {
  const rep = Number(reputation) || 0;
  const required = MISSIONS_REQUIRED_BASE - Math.floor(rep / REPUTATION_PER_DISCOUNT);
  return Math.min(MISSIONS_REQUIRED_BASE, Math.max(MISSIONS_REQUIRED_MIN, required));
}
