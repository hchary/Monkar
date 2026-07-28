// Multi-slot, tag-scored template grammar - a direct extension of the shipped
// functions/src/textGeneration.js (reused below, not reimplemented) from "one sentence built
// from one subject + one verb phrase" to "a short paragraph built from several tag-scored
// slots (opening / climax / talent growth / ...)".
//
// This is a context-free "grammar" in the Tracery/case-grammar sense: no statistical model,
// no learning, purely deterministic filtering + weighted-random selection over hand-authored
// template pools, plus the same French agreement helpers already used in production.

const path = require("path");
const { fillSubjectPlaceholder } = require(path.join(
  "..", "..", "functions", "src", "textGeneration.js"
));

function pickRandom(items) {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// A fragment only qualifies if EVERY one of its tags is present in the current context - a
// partial-overlap match was tried first during this POC's development and immediately produced
// a real bug (a caravan-escort quest picking the village-specific "not a single plank lost"
// line, because both share the "protection" tag). Requiring the full subset avoids that class
// of mismatched-flavor output; see report.md's "silent semantic leakage" pitfall.
function isSubset(fragmentTags, contextTags) {
  return fragmentTags.every((t) => contextTags.has(t));
}

// Among fragments whose hard requirements are met, keep only the most specific ones (most
// fragment tags satisfied) and pick randomly among ties. A fragment tagged [] is trivially a
// subset of any context, so it always qualifies as the score-0 fallback - this is what keeps a
// slot from ever being empty, at the cost of genericity.
function pickFragment(pool, contextTags, { requiresTalentGain = false } = {}) {
  const eligible = pool.filter(
    (f) => (!f.requiresTalentGain || requiresTalentGain) && isSubset(f.tags, contextTags)
  );
  if (eligible.length === 0) return null;

  const maxScore = Math.max(...eligible.map((f) => f.tags.length));
  const top = eligible.filter((f) => f.tags.length === maxScore);
  return pickRandom(top);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Resolves the small placeholder set this POC's templates use. {sujet} reuses the production
// contraction logic (du/des/de la/de l') so "carbonisé {sujet}" and "triomphé de {sujet}"
// both agree correctly - exactly like worldData/verbPhrases templates do today.
function fillTemplate(template, ctx) {
  let text = template;
  if (text.includes("{sujet}")) {
    text = fillSubjectPlaceholder(text, ctx.enemy);
  }
  if (text.includes("{lieuCap}")) {
    text = text.replace("{lieuCap}", capitalize(`${ctx.lieu.article} ${ctx.lieu.nom}`));
  }
  if (text.includes("{lieu}")) {
    text = text.replace("{lieu}", `${ctx.lieu.article} ${ctx.lieu.nom}`);
  }
  if (text.includes("{talent}")) {
    text = text.replace("{talent}", ctx.talentName || "votre talent");
  }
  return text;
}

// ctx shape:
// { enemy, lieu, talentTags: string[], questTags: string[], talentGained: boolean, talentName }
function generateVictoryNarrative(ctx, fragments) {
  const contextTags = new Set([
    ...(ctx.talentTags || []),
    ...(ctx.enemy.tags || []),
    ...(ctx.questTags || []),
  ]);

  const opening = pickFragment(fragments.opening, contextTags);
  const climax = pickFragment(fragments.climax, contextTags);
  const growth = ctx.talentGained
    ? pickFragment(fragments.talentGrowth, contextTags, { requiresTalentGain: true })
    : null;

  return [opening, climax, growth]
    .filter(Boolean)
    .map((f) => fillTemplate(f.template, ctx))
    .join(" ");
}

module.exports = { generateVictoryNarrative, pickFragment, fillTemplate };
