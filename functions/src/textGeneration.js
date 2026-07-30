const DE_CONTRACTIONS = { le: "du", les: "des", la: "de la", "l'": "de l'" };

// An elided article is glued to the noun it introduces - "l'ours", "de l'ours" - where every other
// article takes a space. Without this, subjects declared with the "l'" article rendered as
// "l' ours des cavernes" in every generated sentence.
function joinArticle(article, nom) {
  return article.endsWith("'") ? `${article}${nom}` : `${article} ${nom}`;
}

// The subject's noun phrase as it reads right after the preposition "de"
// (de + le -> du, de + les -> des; de + la / de + l' don't contract further).
function contractDe(subject) {
  const contraction = DE_CONTRACTIONS[subject.article];
  if (!contraction) throw new Error(`Unknown subject article: ${subject.article}`);
  return joinArticle(contraction, subject.nom);
}

const DE_SUJET_PLACEHOLDER = /\bde \{sujet\}/gi;

// Templates write "de {sujet}" literally when the subject is introduced by "de" (per the
// docs/TODO.md examples), so only that case needs contraction; templates that put {sujet}
// straight after the verb (no "de") get the subject's own article, untouched. Both forms are
// replaced everywhere they occur, so a template may mention the subject more than once.
function fillSubjectPlaceholder(template, subject) {
  return template
    .replace(DE_SUJET_PLACEHOLDER, contractDe(subject))
    .replaceAll("{sujet}", joinArticle(subject.article, subject.nom));
}

function pickRandom(items) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function matchesCible(entryCible, targetCible) {
  return entryCible === "les_deux" || entryCible === targetCible;
}

// A narrative is assembled one sentence per slot, always in this order (stakes -> action ->
// consequence), mirroring the structure of the motivating example in docs/TODO.md's "Procedural
// narrative generation". Only "climax" is mandatory: it is the slot every pre-existing
// verbPhrases document falls into, so a catalog authored before slots existed still generates
// exactly the single sentence it did before.
const SLOT_ORDER = ["opening", "climax", "talentGrowth"];
const DEFAULT_SLOT = "climax";

const TALENT_CHANGE_ANY = "les_deux";

function slotOf(fragment) {
  return fragment.slot || DEFAULT_SLOT;
}

function tagsOf(taggable) {
  return taggable.tags || [];
}

// A fragment qualifies only if EVERY one of its tags is in the context - tags narrow a fragment,
// they don't merely weight it. Matching on partial overlap instead (the rule the single-sentence
// generator used) silently produces confidently-wrong flavor text as soon as the context draws
// tags from several sources: a caravan-escort quest tagged "protection" would match an opening
// authored for "protection" + "village" and announce a village that isn't in the quest. See
// narrative-poc/report.md § 2.1 and docs/NARRATIVE-GENERATION.md.
function isSubset(tags, contextTags) {
  return tags.every((tag) => contextTags.has(tag));
}

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

// {sujet} is filled by fillSubjectPlaceholder (which owns the French agreement rules) rather than
// from the plain value map, but a subject is always chosen before any slot is picked, so it counts
// as available for every slot's eligibility check.
const SUBJECT_PLACEHOLDER = "sujet";

// A fragment asking for a value the current action can't supply (a {lieu} on a quest with no
// location) is dropped rather than rendered with the raw placeholder showing - the player must
// never see "{lieu}".
function hasEveryPlaceholderValue(template, values) {
  return [...template.matchAll(PLACEHOLDER_PATTERN)].every(
    ([, name]) => name === SUBJECT_PLACEHOLDER || values[name] !== undefined
  );
}

function fillTemplate(template, values) {
  return template.replace(PLACEHOLDER_PATTERN, (match, name) =>
    values[name] === undefined ? match : values[name]
  );
}

// Among fragments whose tags are all satisfied, keep only the most specific ones (the most tags
// matched) and pick at random among those ties, so an authored "feu" x "mort-vivant" sentence
// always beats the generic one it was written to replace. A fragment with no tags is a subset of
// every context, which is what keeps a slot from coming up empty.
function pickFragment(pool, contextTags, values) {
  let best = [];
  let bestScore = -1;

  for (const fragment of pool) {
    const tags = tagsOf(fragment);
    if (!isSubset(tags, contextTags)) continue;
    if (!hasEveryPlaceholderValue(fragment.template, values)) continue;

    if (tags.length > bestScore) {
      bestScore = tags.length;
      best = [];
    }
    if (tags.length === bestScore) best.push(fragment);
  }

  return pickRandom(best);
}

// The climax and its subject are chosen as a *pair*, and the pair's tags are what the other slots
// then match against. Choosing them independently is what breaks a multi-sentence narrative:
// picking one subject per slot lets a paragraph open on bandits and climax on undead, and picking
// the subject first throws away the "this sentence needs an undead enemy" information that
// authored tags carry. Scoring every (subject, climax) combination keeps both properties: the most
// specific authored sentence wins, and it drags in a subject it actually fits.
function pickClimaxWithSubject({ pool, subjects, cible, baseTags, values }) {
  const candidateSubjects = subjects.filter((subject) => subject.type === cible);
  let best = [];
  let bestScore = -1;

  for (const subject of candidateSubjects) {
    const contextTags = new Set([...baseTags, ...tagsOf(subject)]);

    for (const fragment of pool) {
      const tags = tagsOf(fragment);
      if (!isSubset(tags, contextTags)) continue;
      if (!hasEveryPlaceholderValue(fragment.template, values)) continue;

      if (tags.length > bestScore) {
        bestScore = tags.length;
        best = [];
      }
      if (tags.length === bestScore) best.push({ subject, fragment });
    }
  }

  return pickRandom(best);
}

const TERMINAL_PUNCTUATION = /[.!?…]$/;

// Fragments are authored as clauses without a leading capital ("vous avez triomphé de {sujet}"),
// because the same climax text is also embedded mid-sentence in a loot item's description
// ("[Obtenue lorsque vous avez triomphé des bandits]", see partirEnQuete.js's drawQuestLoot).
// Presenting them as a paragraph is therefore the engine's job, not the author's.
function toSentence(text) {
  const trimmed = text.trim();
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return TERMINAL_PUNCTUATION.test(capitalized) ? capitalized : `${capitalized}.`;
}

// Trailing whitespace has to go with the punctuation, not just before it: French typography puts a
// space in front of "!" and "?", so stripping the mark alone would leave "... du col " and read as
// a double space once embedded.
const TRAILING_PUNCTUATION = /[\s.!?…]+$/;

function toClause(text) {
  return text.trim().replace(TRAILING_PUNCTUATION, "");
}

function slotPool({ verbPhrases, slot, resultat, cible, talentChange }) {
  return verbPhrases.filter((verbPhrase) => {
    if (slotOf(verbPhrase) !== slot) return false;
    if (verbPhrase.resultat !== resultat) return false;
    // Every slot honors `cible`, because any slot may mention {sujet} and therefore have to agree
    // with the enemy's number ("les bandits avançaient" vs "la liche avançait"). What differs is the
    // default the creator form offers: the action sentence almost always needs a shape, the other
    // slots usually don't and default to "les_deux" so they can't be silently hidden half the time.
    if (!matchesCible(verbPhrase.cible, cible)) return false;
    if (slot === "talentGrowth") {
      const required = verbPhrase.talentChange || TALENT_CHANGE_ANY;
      if (required !== TALENT_CHANGE_ANY && required !== talentChange) return false;
    }
    return true;
  });
}

// Assembles a short paragraph from one fragment per slot, each matched against the full context of
// the action (the talent that progressed, the quest, and the enemy) rather than the enemy's tags
// alone. Returns null when no climax matches at all - including down to the untagged fallback -
// so callers keep their own hand-authored fallback sentence, exactly as before slots existed.
//
// context: { talentTags, questTags, talentChange, talentName, locationName, questName }
function generateNarrative({ resultat, cible, subjects, verbPhrases, context = {} }) {
  const baseTags = [...(context.talentTags || []), ...(context.questTags || [])];
  const values = {};
  if (context.talentName) values.talent = context.talentName;
  if (context.locationName) values.lieu = context.locationName;
  if (context.questName) values.quete = context.questName;

  const climax = pickClimaxWithSubject({
    pool: slotPool({ verbPhrases, slot: "climax", resultat, cible }),
    subjects,
    cible,
    baseTags,
    values,
  });
  if (!climax) return null;

  const contextTags = new Set([...baseTags, ...tagsOf(climax.subject)]);
  const chosen = { climax: climax.fragment };

  chosen.opening = pickFragment(
    slotPool({ verbPhrases, slot: "opening", resultat, cible }),
    contextTags,
    values
  );

  // The consequence slot only exists when something actually changed - it is gated on the action
  // having granted or improved a talent, not on a fragment opting in.
  if (context.talentChange) {
    chosen.talentGrowth = pickFragment(
      slotPool({ verbPhrases, slot: "talentGrowth", resultat, cible, talentChange: context.talentChange }),
      contextTags,
      values
    );
  }

  const rendered = SLOT_ORDER.map((slot) => chosen[slot])
    .filter(Boolean)
    .map((fragment) => fillTemplate(fillSubjectPlaceholder(fragment.template, climax.subject), values));

  return {
    text: rendered.map(toSentence).join(" "),
    // The climax alone, left as authored, for callers that need to embed the accomplishment inside
    // a longer sentence - a three-sentence paragraph can't do that job.
    clause: toClause(fillTemplate(fillSubjectPlaceholder(climax.fragment.template, climax.subject), values)),
  };
}

module.exports = {
  contractDe,
  fillSubjectPlaceholder,
  generateNarrative,
  slotOf,
  SLOT_ORDER,
  DEFAULT_SLOT,
  TALENT_CHANGE_ANY,
};
