# Issue 01 — Multi-slot narrative grammar engine

Status: **implemented**, with deviations. Shipped in `functions/src/textGeneration.js` and
`functions/src/actions/partirEnQuete.js`.

**Read this document as a historical plan, not as a description of the code.** Two caveats:

1. Parts of it were written against the per-action `tiers` data model, which was retired before this
   was built (`docs/ISSUE-02-ACTION-FRAMEWORK.md`, "Abandoning the paliers system"). Every mention of
   `tier.narrativeText`, `tier.talentGain`, or a per-tier success condition below refers to something
   that no longer exists.
2. Six further gaps surfaced while implementing it, four of which would have shipped visibly wrong
   text (a paragraph naming two different enemies; a fire flourish on a talent the character never
   used; "progress" wording on a freshly unlocked talent; a three-sentence paragraph embedded
   mid-sentence in loot descriptions). Its "Open questions" section is also answered — both of the
   answers it leaned toward turned out to be wrong.

The accurate description of what shipped is
[docs/ARCHITECTURE.md](ARCHITECTURE.md)'s "Procedural quest-result text" section, with authoring
guidance in [docs/NARRATIVE-GENERATION.md](NARRATIVE-GENERATION.md). The plan-versus-reality diff is
[narrative-poc/report.md](../narrative-poc/report.md) § 4. The original spec is kept below unedited,
so the decisions it got right and wrong stay auditable.

Origin: [`narrative-poc/`](../narrative-poc/) (see `narrative-poc/report.md` for the full
feasibility analysis). That analysis concluded a tag-scored, multi-slot template grammar is
achievable without an LLM and is a direct extension of the procedural text generator already
shipped in `functions/src/textGeneration.js` (see [docs/ARCHITECTURE.md](ARCHITECTURE.md)'s
"Procedural quest-result text" section). This issue turns that POC into a concrete
implementation plan against the real data model.

## Goal

Extend `generateResultText` from "one sentence, built from one subject + one verb phrase,
matched only by free-text tag overlap" to "a short paragraph, built from several tagged
**slots** (opening/stakes, climax/action, talent-growth flourish, ...), each matched against
the *full* runtime context of the action — the character's relevant talent, the quest, and the
enemy/objective — not just the enemy's tags alone." Same philosophy as today: procedural text
is an opt-in enhancement per tier, with a hand-authored `narrativeText` fallback always
available, never a hard requirement.

## Scope

**In scope:**
- A new `slot` dimension on procedurally-generated content, replacing "one flat sentence" with
  "one sentence per slot, composed into a paragraph."
- Matching fragments against the character's granted-talent tags, in addition to the enemy
  (narrative subject) tags already used today.
- The subset-matching selection rule (a fragment only qualifies if *all* of its tags are
  present in the context, not merely one) — required to avoid the wrong-flavor-text bug found
  while building the POC (§ "Selection rule" below).
- Backward compatibility with existing `worldData/verbPhrases` content (no data loss, no
  forced re-authoring).

**Out of scope (see "Non-goals" below):** any LLM integration, quest-location tags/slot,
failure-side talent flourishes, and the free-text-`tags`-vs-`tagIds` unification across
`narrativeSubjects`/`verbPhrases` — each is either premature (no demonstrated need yet) or a
separate, independently-decidable migration that shouldn't block this feature.

## Data model changes

### 1. `slot` field on `worldData/verbPhrases/items/{id}`

```
worldData/verbPhrases/items/{id}
  resultat: "victoire" | "echec" | "partielle"   -- unchanged
  cible: "groupe" | "individuel" | "les_deux"     -- unchanged
  template: string                                -- unchanged, {sujet} placeholder
  tags: [string]                                  -- unchanged, free-text
  slot: "opening" | "climax" | "talentGrowth"      -- NEW, default "climax" for existing docs
  requiresTalentGain: boolean                      -- NEW, optional, "talentGrowth" slot only
```

No new collection — reusing `verbPhrases` (rather than introducing a sibling collection like
`narrativeFragments`) keeps the existing creator UI, quest linking
(`quest.successPhraseIds`/`failurePhraseIds`), and tag-deletion cleanup in `TagsManager.jsx`
all working unmodified. `slot` defaults to `"climax"` at read time for any document written
before this field existed, so **no Firestore migration/backfill is required** — today's entire
`verbPhrases` catalog is valid `"climax"` content on day one.

`"opening"` and `"talentGrowth"` are additive: a tier's generated narrative degrades to
today's single-sentence output (climax only) whenever no `"opening"`/`"talentGrowth"` fragment
matches, exactly like a tier without procedural generation degrades to `narrativeText` today.

### 2. Character-talent tags feed the context

`character.talents[].id` already resolves to `worldData/talents/items/{id}`, which already
carries `tagIds` (added in the "Add tags to talents" feature, commit `7d9f360`) — this issue is
the first *consumer* of that field for actual gameplay text, closing the gap called out in that
feature's own scope ("creator-only metadata with no gameplay effect currently wired up").

No schema change needed here — `talents.tagIds` already exists. What's needed is resolving
those ids to tag *names* at generation time (see "Tag vocabulary bridge" below), since
`verbPhrases`/`narrativeSubjects` match on free-text tag strings, not ids.

### 3. Quest tags become functional (not just creator-only)

`worldData/quests/items/{id}.tagIds` already exists (documented in
[docs/ARCHITECTURE.md](ARCHITECTURE.md) as "creator-only, never shown to the player"). This
issue makes it a second source feeding the context tag set (e.g. a quest tagged "protection"
enables an `"opening"` fragment authored for protection-themed stakes) — again, no schema
change, only a new read path.

### Tag vocabulary bridge (talents/quests `tagIds` ↔ verbPhrases/narrativeSubjects free `tags`)

Talents and quests store tags as `tagIds` (references into `worldData/tags/items`);
`narrativeSubjects`/`verbPhrases` — the two collections the generator actually matches against
— store tags as free-text strings, and have since before `worldData/tags` existed (see
[docs/ARCHITECTURE.md](ARCHITECTURE.md)'s dual-tag note). Rather than migrating either side (a
separate, riskier decision — see "Non-goals"), the generator resolves `tagIds` to their
`worldData/tags/items/{id}.name` at read time and treats the resulting strings as ordinary
context tags, in the same set as the enemy's free-text `tags`. Concretely: if a talent has
`tagIds: ["abc123"]` and `worldData/tags/items/abc123.name === "feu"`, the character's context
tag set gains `"feu"`, matchable against a `verbPhrases` fragment tagged `["feu"]` exactly like
today's enemy-tag matching works.

**Content-authoring consequence, to document for the creator:** for this bridge to work, a
`worldData/tags/items` entry named e.g. `"feu"` and a `narrativeSubjects`/`verbPhrases`
free-text tag `"feu"` must be spelled identically — there's no fuzzy matching. This should be
called out in the creator dashboard (a short help text on `TalentsManager.jsx`'s and
`TextGenerationManager.jsx`'s tag fields) rather than left to be discovered as a silent content
gap.

## Selection rule: subset match, not overlap match

`generateResultText`'s current subject-matching rule (`functions/src/textGeneration.js`) keeps
a subject if it shares **at least one** tag with the verb phrase's `tags`. Building the POC
(`narrative-poc/src/grammarEngine.js`) showed this rule produces wrong-flavor output once a
slot draws from more than one tag source: a caravan-escort quest (context tags:
`{"lame", "humanoide", "hostile", "groupe", "protection"}`) matched an `"opening"` fragment
authored specifically for village-protection (`tags: ["protection", "village"]`) — purely
because both share `"protection"` — and produced "Le village n'a pas perdu une seule planche"
for a quest that has nothing to do with a village.

**Required rule for this feature:** a fragment qualifies only if **every** one of its tags is
present in the context (`fragment.tags.every(t => contextTags.has(t))`), i.e. tags on a
fragment narrow it, they don't just weight it. Among qualifying fragments, prefer the one(s)
with the most tags (most specific), picking randomly among ties; a fragment with `tags: []` is
trivially a subset of any context and is what keeps a slot from ever coming up empty.

This is a **behavior change** to `generateResultText`'s existing subject-matching, not just new
code for the new slots — `climax`, which is today's exact code path, should move to the same
rule for consistency and because the "climax" slot is exactly where the caravan/village-style
bug is most likely to recur (it draws from the richest tag set: talent + enemy + quest). This
should be called out explicitly when implementing, since it changes existing generation
behavior, not only additive behavior — worth a quick pass over live `verbPhrases` content to
check nothing currently relies on the looser overlap rule to match.

## Engine changes (`functions/src/textGeneration.js`)

- Add `generateNarrative({ resultat, cible, context, subjects, verbPhrases })`, composing one
  call per slot (`opening`, `climax`, always; `talentGrowth`, only when the action granted a
  talent this resolution) into a paragraph, in that fixed order, joined with spaces — mirrors
  `narrative-poc/src/grammarEngine.js`'s `generateVictoryNarrative`, minus the POC's local
  sample data.
- `climax` remains **mandatory**: if no `climax` fragment (down to the `tags: []` fallback)
  matches, behave exactly like today — return `null` so the caller falls back to
  `tier.narrativeText`. `opening`/`talentGrowth` are optional additions to a successful
  `climax` result, never block it.
- Reuse `fillSubjectPlaceholder`/`contractDe` unchanged — no changes needed to the French
  agreement logic itself, only to which pool of fragments is filtered.
- Apply the subset-match rule (previous section) uniformly across all three slots.

## Integration changes (`functions/src/actions/partirEnQuete.js`)

`resolve()` currently calls `generateResultText({ resultat, cible, subjects, verbPhrases })`
with `subjects`/`verbPhrases` narrowed to the quest's own pools first, falling back to global
pools. Replace with `generateNarrative`, additionally passing:

- `context.talentTags`: resolved tag *names* (see "Tag vocabulary bridge") from
  `tier.talentGain.talentId`'s `worldData/talents/items` doc, when this resolution grants a
  talent. Already loaded in-transaction for `talentGained` — this only adds reading that
  talent's `tagIds` and resolving them.
- `context.questTags`: resolved tag names from `quest.tagIds`.
- `context.talentGained`: boolean, gates the `talentGrowth` slot — reuse the existing
  `success && tier.talentGain?.talentId` condition already computed in `resolve()`.

Resolving `tagIds` → names requires reading `worldData/tags/items` — batch this once in
`prepare()` (alongside the existing `narrativeSubjects`/`verbPhrases`/`lootTables`/`objects`
reads) rather than per-tag-id inside the transaction, same pattern already used for everything
else `prepare()` loads.

The quest's-own-pool-first / global-pool-fallback behavior is unchanged, just applied per slot
instead of to one flat pool.

## Creator UI changes (`TextGenerationManager.jsx` / `VerbPhrasesManager`)

- Add a `slot` select (opening / climax / talent growth) to the verb-phrase create/edit form,
  defaulting to `"climax"` (matches the storage default, and keeps the form workable with zero
  changes for anyone only ever authoring today's kind of content).
- Add a `requiresTalentGain` checkbox, shown only when `slot === "talentGrowth"`.
- Filter the existing verb-phrase list (`TextGenerationManager.jsx`'s `matchesVerbPhrase`,
  used by `MultiSelectModalField`) to include `slot`, so a `QuestsManager.jsx`
  success/failure-phrase picker can be narrowed by slot when useful — not required for MVP,
  worth doing in the same pass since `matchesVerbPhrase` already inspects `template`/`cible`/
  `tags`.
- Short help text near the tag fields on `TalentsManager.jsx` and
  `TextGenerationManager.jsx`, per the "content-authoring consequence" note above (tag names
  must match verbatim across the `tagIds` picker and the free-text `tags` field).

No changes needed to `QuestsManager.jsx`'s `tagIds` field or to `TalentsManager.jsx`'s
`tagIds` field — both already exist and already write in the right shape; this feature is
purely a new *reader* of data that's already there.

## Content authoring / rollout plan

1. Ship the engine + integration changes first, with **zero new content** — every existing
   `verbPhrases` doc defaults to `slot: "climax"`, so `generateNarrative` behaves identically
   to today's `generateResultText` (minus the subset-vs-overlap rule change, which should be
   verified against live content before/at deploy — see "Selection rule").
2. Author one `tags: []` fallback fragment per new slot (`opening`, `talentGrowth`) so neither
   slot is ever silently empty from day one — this is the same role the existing generic
   `verbPhrases` entries already play for `climax`.
3. Progressively author tag-specific `opening`/`talentGrowth`/richer `climax` fragments for the
   game's most common talent/enemy/quest-theme combinations, prioritized by which talents and
   quest themes are actually live, not attempting full combinatorial coverage up front (see
   `narrative-poc/report.md` § 1 on why full coverage doesn't scale and isn't the goal).

## Testing requirements

- Unit test for `generateNarrative`'s slot composition (opening + climax + talentGrowth join
  order and spacing), reusing the existing `functions` test setup for `textGeneration.js`.
- **Required regression test, directly from the POC finding:** a context whose tags partially
  overlap a slot-specific fragment's tags (e.g. context has `"protection"` but not `"village"`)
  must **not** select that fragment — assert the generic fallback is returned instead. This is
  the caravan/village case; it must be a named test, not just covered incidentally, since it
  looks correct by casual inspection and is only wrong once you construct exactly this kind of
  partial-overlap scenario.
- Test that `talentGrowth` fragments are never selected when `context.talentGained` is falsy,
  even if their tags would otherwise match.
- Test that `climax` returning `null` (no match at all, down to the `tags: []` fallback missing
  — e.g. a slot with zero authored content) still yields `generateNarrative` returning `null`
  overall, preserving the `tier.narrativeText` fallback path.

## Non-goals (explicitly deferred, not part of this issue)

- **LLM-based generation.** Covered by `narrative-poc/report.md` §§ 2–3 — recommended only as a
  possible future enhancement for rare/high-stakes tiers, and only if the template grammar's
  fallback quality turns out to matter in practice. Not needed for this issue.
- **Location (`worldData/adventureZones/items`) tags/slot.** Locations have no `tagIds`/`tags`
  field today; adding one and a location-flavored slot is a natural follow-up once this
  feature's core (talent + quest + enemy) is live, not a blocker for it.
- **Unifying `tagIds` vs. free-text `tags`** across `narrativeSubjects`/`verbPhrases` into one
  system. The "tag vocabulary bridge" above sidesteps this by resolving at read time instead of
  migrating storage; a full unification (e.g. moving `narrativeSubjects`/`verbPhrases` onto
  `tagIds` too) is a separate, independently-decidable data migration and shouldn't gate this
  feature.
- **Failure-side (`echec`) talent flourishes.** `talentGrowth` as specified only fires on
  success (talents are only ever granted on success tiers today, per
  [docs/TODO.md](TODO.md)'s "Expanded talent system"). A "consequence flourish" slot for
  failure/wound/death tiers is a plausible future slot but isn't specified here.

## Open questions

- Whether `opening`/`talentGrowth` should also support a `cible: "les_deux"`-style
  group/individual distinction like `climax`/today's `verbPhrases` do, or whether those slots
  are cible-agnostic (a stakes/flourish sentence rarely needs to grammatically agree with the
  enemy's number/gender the way `{sujet}` substitution does). Leaning toward cible-agnostic for
  MVP — revisit if authored content shows a real need.
- Whether the paragraph-join order (opening, climax, talentGrowth) should ever vary, or is
  always fixed. Fixed order is simpler and matches the motivating example's structure
  (stakes → action → consequence); no case for variation has come up yet.
