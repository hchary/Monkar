// Assembles a mission's display name from a mission-name Action + Subject pair - see docs/TODO.md
// "Mission subject and action catalog". Mirrors functions/src/textGeneration.js's own slot-assembly
// style: a fixed slot order, any absent slot simply skipped, then joined.
//
// Picking which Action, Subject, difficulty and variation to pair up is out of scope here - see
// docs/TODO.md "Regional mission generation and journal" for that consumer.

// difficulty-tier prefix, then variation prefix, then the subject's base name, then variation
// suffix, then difficulty-tier suffix - per docs/TODO.md's own worked example ("Vaincre" + "dragon"
// at épique with tier suffix "liche" and variation suffix "rouge" -> "Vaincre dragon rouge liche").
const SUBJECT_SLOT_ORDER = ["tierPrefix", "variationPrefix", "name", "variationSuffix", "tierSuffix"];

// The subject's own difficultyTiers row matching `difficulty`, or null when the subject has none
// authored for it - a content gap, not an error; callers are expected to only pair a subject with a
// difficulty it actually has a tier for.
function findDifficultyTier(subject, difficulty) {
  return (subject.difficultyTiers || []).find((tier) => tier.difficulty === difficulty) || null;
}

// Assembles the final mission title. `variation` is one entry drawn from subject.variations, or
// null when the subject has none to draw from.
function assembleMissionName({ action, subject, difficulty, variation }) {
  const tier = findDifficultyTier(subject, difficulty);
  const slots = {
    tierPrefix: tier?.prefix || null,
    variationPrefix: variation?.prefix || null,
    name: subject.name,
    variationSuffix: variation?.suffix || null,
    tierSuffix: tier?.suffix || null,
  };

  const subjectString = SUBJECT_SLOT_ORDER.map((slot) => slots[slot])
    .filter(Boolean)
    .join(" ");

  return `${action.phrase} ${subjectString}`;
}

module.exports = { assembleMissionName };
