const DE_CONTRACTIONS = { le: "du", les: "des", la: "de la", "l'": "de l'" };

// The subject's noun phrase as it reads right after the preposition "de"
// (de + le -> du, de + les -> des; de + la / de + l' don't contract further).
function contractDe(subject) {
  const contraction = DE_CONTRACTIONS[subject.article];
  if (!contraction) throw new Error(`Unknown subject article: ${subject.article}`);
  return `${contraction} ${subject.nom}`;
}

const DE_SUJET_PLACEHOLDER = /\bde \{sujet\}/i;

// Templates write "de {sujet}" literally when the subject is introduced by "de" (per the
// docs/TODO.md examples), so only that case needs contraction; templates that put {sujet}
// straight after the verb (no "de") get the subject's own article, untouched.
function fillSubjectPlaceholder(template, subject) {
  if (DE_SUJET_PLACEHOLDER.test(template)) {
    return template.replace(DE_SUJET_PLACEHOLDER, contractDe(subject));
  }
  return template.replace("{sujet}", `${subject.article} ${subject.nom}`);
}

function pickRandom(items) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function matchesCible(entryCible, targetCible) {
  return entryCible === "les_deux" || entryCible === targetCible;
}

// Picks a verb phrase matching the outcome/target, then a compatible subject (matched by
// type, and by tag overlap when the verb phrase restricts to specific subject tags), and
// fills the {sujet} placeholder. Returns null if no compatible pair exists so callers can
// fall back to a hand-authored narrativeText instead.
function generateResultText({ resultat, cible, subjects, verbPhrases }) {
  const candidateVerbPhrases = verbPhrases.filter((v) => v.resultat === resultat && matchesCible(v.cible, cible));
  const verbPhrase = pickRandom(candidateVerbPhrases);
  if (!verbPhrase) return null;

  const candidateSubjects = subjects.filter((s) => {
    if (s.type !== cible) return false;
    if (!verbPhrase.tags || verbPhrase.tags.length === 0) return true;
    return verbPhrase.tags.some((tag) => (s.tags || []).includes(tag));
  });
  const subject = pickRandom(candidateSubjects);
  if (!subject) return null;

  return fillSubjectPlaceholder(verbPhrase.template, subject);
}

module.exports = { contractDe, fillSubjectPlaceholder, generateResultText };
