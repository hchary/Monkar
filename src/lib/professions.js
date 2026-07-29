// Computes the character patch for switching to a given profession/level, upserting the
// character's previous profession into knownProfessions first so its mastery level survives
// the switch (docs/TODO.md "Profession (métier) creation" — character link).
export function withProfessionChange(character, professionId, level) {
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
