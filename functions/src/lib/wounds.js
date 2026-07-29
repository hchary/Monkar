// The wound-attribution mechanic: how a single new wound of a given severity changes a
// character's three wound counters, and when it escalates to a worse severity or kills the
// character outright instead. Shared by every action's tier resolution (see actionEffects.js).
//
// Rules:
// - Attributing a light wound below 3 light wounds increments the light counter.
// - Attributing a light wound at 3 light wounds instead attributes a severe wound.
// - Attributing a severe wound below 3 severe wounds increments the severe counter.
// - Attributing a severe wound at 3 severe wounds instead attributes a permanent wound.
// - Attributing a severe or permanent wound while already at 3 permanent wounds kills the
//   character instead.

const SEVERITIES = ["light", "severe", "permanent"];

function woundCounts(character) {
  return {
    light: character?.woundsLight || 0,
    severe: character?.woundsSevere || 0,
    permanent: character?.woundsPermanent || 0,
  };
}

// Returns the character's next wound counters and whether this wound killed them, computed from
// the current counts rather than a Firestore increment - escalation and death both depend on
// reading the current value before deciding which counter (if any) actually moves.
function applyWound(character, severity) {
  if (!SEVERITIES.includes(severity)) {
    throw new Error(`Unknown wound severity: ${severity}`);
  }

  const { light, severe, permanent } = woundCounts(character);
  let effective = severity;

  if (effective === "light") {
    if (light < 3) {
      return { woundsLight: light + 1, woundsSevere: severe, woundsPermanent: permanent, died: false };
    }
    effective = "severe";
  }

  if (effective === "severe") {
    if (permanent >= 3) {
      return { woundsLight: light, woundsSevere: severe, woundsPermanent: permanent, died: true };
    }
    if (severe < 3) {
      return { woundsLight: light, woundsSevere: severe + 1, woundsPermanent: permanent, died: false };
    }
    effective = "permanent";
  }

  // effective === "permanent"
  if (permanent >= 3) {
    return { woundsLight: light, woundsSevere: severe, woundsPermanent: permanent, died: true };
  }
  return { woundsLight: light, woundsSevere: severe, woundsPermanent: permanent + 1, died: false };
}

module.exports = { applyWound, woundCounts, SEVERITIES };
