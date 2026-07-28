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

// Subset-match rule (see docs/ISSUE-01-GRAMMAR-ENGINE.md "Selection rule"): a tagged item only
// qualifies if EVERY one of its own tags is present in the available tag pool - an empty/missing
// `tags` array is trivially a subset of anything, which is what keeps a slot/pairing from ever
// being unable to fall back to a generic entry. `availableTags` is a Set for O(1) lookups.
function isTagSubset(tags, availableTags) {
  if (!tags || tags.length === 0) return true;
  return tags.every((tag) => availableTags.has(tag));
}

// BEHAVIOR CHANGE from the previous release: subject matching used to keep a subject that shared
// AT LEAST ONE tag with the verb phrase (`.some(...)`), which let a multi-tag verb phrase attach
// to a subject that only weakly resembled it; it now requires the subject to carry ALL of the
// verb phrase's tags (`isTagSubset`), fixing the wrong-flavor-text bug described in the issue.
//
// Picks, among the given verb phrases, the one(s) paired with a compatible subject whose own tags
// (plus any extra context tags the caller supplies - talent/quest tags for the "climax" slot, none
// for plain `generateResultText`) cover every one of the verb phrase's tags. Among qualifying
// pairs, the most tag-specific verb phrase(s) win (most tags declared), picked randomly among
// ties, so a richly-tagged match is preferred over a generic `tags: []` one whenever both qualify.
// Returns null when no pairing exists at all.
function pickVerbPhraseSubjectPair(verbPhrasePool, subjectPool, extraContextTags = []) {
  const pairs = [];
  for (const verbPhrase of verbPhrasePool) {
    for (const subject of subjectPool) {
      const availableTags = new Set([...extraContextTags, ...(subject.tags || [])]);
      if (isTagSubset(verbPhrase.tags, availableTags)) {
        pairs.push({ verbPhrase, subject });
      }
    }
  }
  if (pairs.length === 0) return null;

  const maxScore = Math.max(...pairs.map((p) => (p.verbPhrase.tags || []).length));
  const topPairs = pairs.filter((p) => (p.verbPhrase.tags || []).length === maxScore);
  return pickRandom(topPairs);
}

// Picks a verb phrase matching the outcome/target, then a compatible subject (matched by type and
// by the subset-match rule above), and fills the {sujet} placeholder. Returns null if no
// compatible pair exists so callers can fall back to a hand-authored narrativeText instead.
function generateResultText({ resultat, cible, subjects, verbPhrases }) {
  const candidateVerbPhrases = verbPhrases.filter((v) => v.resultat === resultat && matchesCible(v.cible, cible));
  const candidateSubjects = subjects.filter((s) => s.type === cible);

  const pair = pickVerbPhraseSubjectPair(candidateVerbPhrases, candidateSubjects);
  if (!pair) return null;

  return fillSubjectPlaceholder(pair.verbPhrase.template, pair.subject);
}

// `slot` defaults to "climax" for every verb phrase written before this field existed - see
// docs/ISSUE-01-GRAMMAR-ENGINE.md's "slot field" section for why that needs no data migration.
function verbPhraseSlot(verbPhrase) {
  return verbPhrase.slot || "climax";
}

function fillTalentPlaceholder(template, talentName) {
  return template.includes("{talent}") ? template.replace("{talent}", talentName || "votre talent") : template;
}

// Picks the most tag-specific fragment (no {sujet} substitution, only the optional {talent} one)
// from a slot's pool against the given context tags, using the same subset-match rule. Returns
// null when the pool is empty or nothing qualifies - callers decide whether that's fatal.
function pickFragment(pool, contextTags) {
  const eligible = pool.filter((f) => isTagSubset(f.tags, contextTags));
  if (eligible.length === 0) return null;

  const maxScore = Math.max(...eligible.map((f) => (f.tags || []).length));
  const top = eligible.filter((f) => (f.tags || []).length === maxScore);
  return pickRandom(top);
}

function generateOpeningText(verbPhrases, contextTags, talentName) {
  const pool = verbPhrases.filter((v) => verbPhraseSlot(v) === "opening");
  if (pool.length === 0) return null; // no opening content authored at all - not an error, just skip

  const fragment = pickFragment(pool, contextTags);
  return fragment ? fillTalentPlaceholder(fragment.template, talentName) : null;
}

function generateTalentGrowthText(verbPhrases, contextTags, context) {
  if (!context.talentGained) return null;

  const pool = verbPhrases.filter((v) => verbPhraseSlot(v) === "talentGrowth" && v.requiresTalentGain);
  if (pool.length === 0) return null;

  const fragment = pickFragment(pool, contextTags);
  return fragment ? fillTalentPlaceholder(fragment.template, context.talentName) : null;
}

// climax is the mandatory slot: same subject+verbPhrase pairing generateResultText performs
// (reusing pickVerbPhraseSubjectPair/fillSubjectPlaceholder, not a parallel implementation),
// restricted to slot "climax" and enriched with talent/quest context tags so a verb phrase can be
// satisfied by the character's talent or the quest's theme, not only by the enemy's own tags.
function generateClimaxText({ resultat, cible, subjects, verbPhrases, contextTags }) {
  const candidateVerbPhrases = verbPhrases.filter(
    (v) => verbPhraseSlot(v) === "climax" && v.resultat === resultat && matchesCible(v.cible, cible)
  );
  const candidateSubjects = subjects.filter((s) => s.type === cible);

  const pair = pickVerbPhraseSubjectPair(candidateVerbPhrases, candidateSubjects, [...contextTags]);
  if (!pair) return null;

  return fillSubjectPlaceholder(pair.verbPhrase.template, pair.subject);
}

// Composes a short paragraph from up to three slots (opening, climax, talentGrowth), each matched
// against the full runtime context (character talent tags + quest tags +, for climax, the picked
// enemy's own tags) instead of the enemy's tags alone. `climax` is mandatory: if it can't be
// resolved (down to a missing `tags: []` fallback), the whole call returns null so the caller
// falls back to the tier's hand-authored narrativeText, exactly like generateResultText does
// today. `opening`/`talentGrowth` are optional flourishes that never block a successful climax.
//
// context: { talentTags: string[], questTags: string[], talentGained: boolean, talentName? }
function generateNarrative({ resultat, cible, context = {}, subjects, verbPhrases }) {
  const baseContextTags = new Set([...(context.talentTags || []), ...(context.questTags || [])]);

  const climaxText = generateClimaxText({ resultat, cible, subjects, verbPhrases, contextTags: baseContextTags });
  if (!climaxText) return null;

  const openingText = generateOpeningText(verbPhrases, baseContextTags, context.talentName);
  const talentGrowthText = generateTalentGrowthText(verbPhrases, baseContextTags, context);

  return [openingText, climaxText, talentGrowthText].filter(Boolean).join(" ");
}

module.exports = { contractDe, fillSubjectPlaceholder, generateResultText, generateNarrative };
