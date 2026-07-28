# Procedural narrative generation — feasibility analysis

Status of the underlying TODO entry (`docs/TODO.md` § "Procedural narrative generation"):
**analysed, not implemented** — this report is the analysis. Companion code: `narrative-poc/` in
this repository (see `README.md` to run it). The implementation plan derived from recommendation
1 below lives in `docs/ISSUE-01-GRAMMAR-ENGINE.md`.

## 0. Starting point: this isn't greenfield

Before answering the three questions, one fact changes the framing of all of them: **a
procedural text generator already exists and is live in production**, at
`functions/src/textGeneration.js`, wired into the quest-resolution flow in
`functions/src/actions/partirEnQuete.js`. Today it does exactly one thing: given an outcome
(`victoire`/`echec`) and a target shape (`groupe`/`individuel`), it picks a random
`worldData/verbPhrases` template and a random matching `worldData/narrativeSubjects` entry
(matched by free-text `tags`, e.g. `hostile`, `humanoïde`), fills the `{sujet}` placeholder
with correct French agreement (`le`/`la`/`les`/`l'` and their `de`-contractions:
`du`/`des`/`de la`/`de l'`), and falls back to a hand-authored `narrativeText` string if no
compatible pair exists.

So the question this task actually poses is not "can we build procedural narration from
scratch," it's **"can the existing tag-matching-and-templating approach be extended to cover
richer scenarios — pulling in the character's talents, the enemy, the location, the quest —
and how far can that extension go before it needs an LLM."** `narrative-poc/` answers that by
building the extension and running it.

## 1. Is it possible to generate a text like the example?

**Partially, and it depends which property of the example you need.** The example given in
the task is:

> "Les hordes de morts n'ont pas touché à une seule planche du village grâce à vous. La magie
> vous a envahie comme rarement et d'un geste, d'une incantation, vous avez carbonisé l'armée
> morbide. Depuis, vous sentez que le feu gronde en vous, plus fort que jamais."

Break it into what it's actually doing, because each piece has a different difficulty:

1. **Selecting content relevant to the situation** (a fire-talent character, an undead
   enemy, a village-protection quest, a talent rank-up) — **solved today** by the existing
   tag-matching primitive, just applied to more axes than it currently is. `narrative-poc`'s
   `generateVictoryNarrative()` reproduces this: given a context
   (`talentTags: ["feu","magie"]`, enemy tagged `["mort-vivant","hostile","groupe"]`, quest
   tagged `["protection","village"]`, `talentGained: true`), it deterministically narrows down
   to fragments authored specifically for "feu × mort-vivant" and "feu × talent growth," and
   produces, verbatim, on every run of the demo:

   > "Le village n'a pas perdu une seule planche grâce à vous. La magie vous a envahi comme
   > rarement et, d'un geste, d'une incantation, vous avez carbonisé les hordes de
   > morts-vivants. Depuis, vous sentez que le feu gronde en vous, plus fort que jamais."

   That's the target example almost word for word. But notice what made that possible: **I
   wrote that exact sentence as a hand-authored template tagged `["feu", "mort-vivant"]`.**
   The "generation" here is selection and slot-filling, not composition — the system picked
   the right pre-written sentence out of a pool and stitched it to two other pre-written
   sentences. It didn't invent "carbonisé l'armée morbide" from the concepts "fire" and
   "undead"; a human did, in advance, for this exact combination.

2. **Grammatical correctness and variety at the slot-filling level** (agreement, elision,
   varying which enemy/location noun phrase appears) — **solved and demonstrated**. This is
   genuinely generative in the useful sense: `{sujet}` is not hand-picked per output, the
   engine substitutes whichever enemy or location the actual quest instance provides, with
   correct French grammar, exactly like the shipped `contractDe`/`fillSubjectPlaceholder` do
   today for the flat one-sentence case.

3. **Producing an equally vivid, on-theme sentence for a combination nobody thought to write
   in advance** — **not solved by templating, by construction.** `narrative-poc`'s second
   scenario demonstrates this directly: the same fire-talent character fighting a lone giant
   wolf (tagged `bete`, not `mort-vivant`) instead of the undead horde. There is no
   `["feu","bete"]` climax fragment in the sample data, so the engine correctly falls back to
   the generic `["feu"]` fragment and produces:

   > "Votre mission touche à sa fin. Vos flammes ont eu raison du loup géant. Depuis, vous
   > sentez que le feu gronde en vous, plus fort que jamais."

   Perfectly serviceable, grammatically fine, thematically consistent — but it's visibly
   plainer than the carbonized-undead-army sentence, precisely because nobody wrote a
   fire-vs-beast equivalent of "carbonisé l'armée morbide" yet. That gap is structural, not a
   bug: **a pure template/tag system's output quality is a direct, close-to-linear function of
   how many tag *combinations* were hand-authored**, and the number of combinations grows
   multiplicatively with the number of tag dimensions (talent family × enemy family × quest
   theme × location × ...). Full coverage at the example's quality bar, across the game's
   real content matrix (dozens of talents × dozens of enemy subjects × several quest themes),
   means authoring on the order of hundreds to low thousands of short template sentences over
   time — which is real, ongoing writing work, just writing *reusable* fragments instead of
   *per-quest* fixed strings.

**Bottom line on Q1:** yes, a system that produces good, contextually-correct narration is
achievable, and it composes cleanly with the game's existing data model (tags are already a
first-class, shared concept across quests/talents/objects/subjects — see the codebase survey
below). What's *not* achievable without either heavy up-front authoring or a generative model
is the specific-every-time literary quality of the motivating example for combinations that
weren't anticipated by an author.

## 2. Can it be done without an LLM?

**Yes, and it should be the default for most cases** — with the coverage caveat from §1 built
in as a known, accepted limitation rather than a surprise. `narrative-poc` demonstrates the
recommended non-LLM approach (a multi-slot, tag-scored template grammar) and, for contrast,
a second non-LLM approach that does *not* work well for this use case (an n-gram/Markov
statistical model), so the "without LLM" question isn't answered abstractly — both concrete
alternatives were built and run.

### 2.1 The approach that works: multi-slot tag-scored grammar (this POC's `grammarEngine.js`)

This is a direct generalization of the shipped `textGeneration.js`: instead of one flat pool
of interchangeable sentences, split the output into **slots** that play a fixed narrative role
(opening/stakes, climax/action, talent-growth flourish, ...), give each slot its own tagged
pool, and pick per slot by scoring fragments against the current context's tag set (character
talent tags, enemy tags, quest tags, ...), keeping only the *most specific* eligible fragment
(most of its tags satisfied) rather than any fragment with partial overlap. Multiple sentences
compose into one paragraph, matching the register (`vous`) and structure of the target
example.

That "most specific, not just any overlap" rule is not a hypothetical detail — building the
POC surfaced a genuine bug from the naive version (score by *raw* tag overlap count, ignoring
whether all of a fragment's tags are actually satisfied): a caravan-escort quest (tagged only
`protection`) could draw the *village-specific* opening line ("Le village n'a pas perdu une
seule planche") purely because it shares the `protection` tag with the caravan quest's
context, even though the fragment is explicitly about a village. Requiring a fragment's full
tag set to be a *subset* of the context (implemented in `grammarEngine.js`'s `isSubset`) fixes
this. This is worth calling out because it generalizes: **any tag-matching narrative system is
one relaxed filter away from silently producing confidently-wrong flavor text**, and that
failure mode is invisible in testing unless you specifically construct a case (like the
caravan one) where tag sets partially but not fully overlap. A real implementation needs this
guarded by tests, not just review.

Properties of this approach, all confirmed by the running POC:
- **Deterministic cost and latency** — no network call, runs synchronously inside the existing
  Cloud Function, no added infrastructure.
- **No external dependency, no data leaves Firebase** — relevant since quest/character data
  is otherwise entirely first-party.
- **Fits the existing data model with moderate, incremental changes** — it needs richer tags
  on talents (already added — commit `7d9f360`, though currently unused for gameplay; this is
  exactly the kind of consumer that would use it), and a slot dimension added to
  `worldData/verbPhrases` (or a new sibling collection), not a schema rewrite.
- **Predictable degradation** — falls back to generic-but-correct text instead of failing,
  same philosophy the shipped code already uses (`generateResultText` returning `null` →
  caller falls back to `tier.narrativeText`).
- **Bounded, honest ceiling** — reproduces the target example when authored for, degrades
  gracefully otherwise (§1). This should be stated as a design constraint, not discovered late.

### 2.2 The approach that doesn't fit: statistical text generation without an LLM (`markovDemo.js`)

To make sure "without an LLM" wasn't answered by only trying the approach expected to work, the
POC also includes a small order-2 word-level Markov chain trained on a handful of the game's
own sentences (the seed `narrativeText` strings plus the target example). Sample output from an
actual run:

> "Vos flammes ont eu raison des bandits du col." (coherent, by luck — it reproduced most of one
> training sentence)
> "La magie vous a envahi comme rarement et d'un geste vous avez carbonisé l'armée morbide."
> (same)

With only 9 short training sentences, a low-order chain mostly regurgitates near-complete
training sentences (as seen above) rather than blending them — and that's the *good* outcome.
The failure mode of this class of model is well known and doesn't need re-demonstrating at
length: with a corpus large enough to actually blend sentences (which this project's authored
content will never realistically reach — we're talking dozens to low hundreds of sentences,
not the tens of thousands a Markov/n-gram model needs to stay coherent), it produces
grammatically-plausible but semantically broken output, with **no mechanism at all to condition
on tags/context** — a Markov chain has no notion of "this sentence must be about fire and
undead," it only knows "which word tends to follow which word(s)." It would need a from-scratch
conditioning layer bolted on to even attempt what the tag-scored grammar already does natively,
at which point it's strictly worse than §2.1 for this use case. **Conclusion: not a viable
avenue for this project regardless of LLM availability** — it's included here mainly to show
that "non-LLM" doesn't mean "any non-LLM approach"; the tag-scored grammar is doing something
qualitatively different (structured selection) from the Markov chain (unstructured statistical
generation), and only the former composes with the game's own tag-based content model.

## 3. If not, what are the alternatives?

Since §2 shows a workable non-LLM path exists for *most* narration, this becomes: **what
handles the residual gap** — the specific, high-stakes, low-frequency moments (legendary/epic
tier outcomes, the exact kind the motivating example describes) where the generic fallback from
§1's scenario 2 is noticeably flatter than hand-written prose, and authoring every combination
by hand doesn't scale.

- **Hosted LLM API call from the Cloud Function** (e.g. via the Anthropic API — see the
  `claude-api` reference material available in this environment for current models/pricing).
  Given the character sheet, quest, talent, and enemy data as structured context, this
  reliably produces exactly the kind of open-ended, always-on-theme prose in the example,
  for *any* combination, with no authoring backlog. Tradeoffs: real per-call cost and latency
  (acceptable if reserved for rare tiers, not every roll), an external dependency and the
  operational surface that comes with it (API key as a Cloud Functions secret, error handling
  when the call fails or times out, likely wanting a fallback to the template grammar rather
  than blocking the action), and non-determinism (fine for flavor text, but means outputs
  aren't reproducible/testable the way template output is — needs light guardrails, e.g. a
  system prompt constraining length/register and basic output validation before it's shown to
  a player). French output quality from current-generation models is strong, so language isn't
  a real risk here.
- **Small local/self-hosted model** (a quantized open-weight model run via something like
  llama.cpp or ONNX Runtime, either server-side on a Cloud Run instance/VM or client-side via
  transformers.js/WebLLM in the browser) as a way to get LLM-style generative flexibility
  without a per-call API cost. This is a real category, but for this project's scale it trades
  a small, predictable per-call cost for a larger, less predictable one: hosting infrastructure
  (GPU or slow CPU inference, cold starts if serverless), meaningfully more operational
  complexity than either §2.1 or the hosted-API option, and small open models are noticeably
  weaker at French creative prose than the current top-tier hosted models. Worth reconsidering
  later if call volume grows enough that hosted API cost becomes the binding constraint — not
  a good starting point.
- **Hybrid (recommended if the residual gap in §1 turns out to matter in practice):** keep the
  tag-scored grammar from §2.1 as the default path for ordinary outcomes (the large majority of
  quest resolutions, where template quality is already good and cost/latency need to stay at
  zero), and reserve a hosted LLM call for the rare, dramatic tiers — legendary/epic outcomes,
  talent rank-ups — where a player is most likely to actually read and remember the text, and
  where call volume is naturally low because those tiers are rare by design
  (`DIFFICULTIES`/tier weighting already makes epic/mythique outcomes infrequent). This bounds
  LLM cost to the moments where the quality gap in §1 is most visible, without taking on
  full-time LLM latency/cost/dependency risk for every quest roll.

## Recommendation

1. Ship the multi-slot tag-scored grammar from §2.1 as a direct evolution of
   `functions/src/textGeneration.js` — it's a natural fit for the existing data model, adds no
   infrastructure, and the POC shows it reproduces the motivating example when authored for.
   Specified against the real data model in `docs/ISSUE-01-GRAMMAR-ENGINE.md` (data model
   changes, engine/integration changes, creator UI, content rollout, testing requirements).
2. Accept and design around the coverage-gap limitation from §1 explicitly (generic fallback
   text is fine, not a bug) rather than trying to author every tag combination up front.
3. Treat an LLM call as a targeted enhancement for rare, high-stakes outcomes only, not a
   default, if and when the flatness of fallback text on those moments turns out to matter to
   players in practice — this is a "wait and see, keep the door open" recommendation, not an
   immediate follow-up task.
4. Whatever is implemented, apply the subset-matching rule from §2.1 (not raw tag overlap) and
   add regression tests for at least one "partial tag overlap should NOT match" case per slot
   type — the caravan/village bug found while building this POC is exactly the kind of thing
   that looks fine by inspection and wrong in production content review.
