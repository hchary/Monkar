// Computes the character patch for switching to a given profession/level, upserting the
// character's previous profession into knownProfessions first so its mastery level survives
// the switch (docs/TODO.md "Profession (métier) creation" — character link). Ported from the
// frontend's src/lib/professions.js now that switchKnownProfession (functions/src/index.js) is
// the sole writer of these fields.
// The level a character actually holds in a profession it already knows (active or past) -
// null if it has never held that profession. switchKnownProfession derives `level` from this
// rather than trusting a client-supplied value, since a switch can only move between
// professions the character already has, never invent progress in one it doesn't.
function knownLevel(character, professionId) {
  if (character.professionId === professionId) return character.professionLevel;
  const known = (character.knownProfessions || []).find((k) => k.professionId === professionId);
  return known ? known.level : null;
}

function withProfessionChange(character, professionId, level) {
  const known = character.knownProfessions || [];

  const knownWithPrevious =
    character.professionId && character.professionId !== professionId
      ? known.some((k) => k.professionId === character.professionId)
        ? known.map((k) =>
            k.professionId === character.professionId ? { ...k, level: character.professionLevel } : k
          )
        : [...known, { professionId: character.professionId, level: character.professionLevel }]
      : known;

  const nextKnown = knownWithPrevious.some((k) => k.professionId === professionId)
    ? knownWithPrevious.map((k) => (k.professionId === professionId ? { ...k, level } : k))
    : [...knownWithPrevious, { professionId, level }];

  return { professionId, professionLevel: level, knownProfessions: nextKnown };
}

module.exports = { withProfessionChange, knownLevel };
