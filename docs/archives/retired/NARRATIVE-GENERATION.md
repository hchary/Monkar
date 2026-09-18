# Narrative generation — how it works, and how to author for it

Audience: the game creator, writing content in the creator dashboard. This document explains what the
generator does with what you write, and how to get the text you want out of it.

Implementation: `functions/src/textGeneration.js` (the engine) and
`functions/src/actions/partirEnQuete.js` (the quest integration). Feasibility analysis and quality
review: [`narrative-poc/report.md`](../narrative-poc/report.md). A page of real generated output:
[`narrative-poc/DEMO.md`](../narrative-poc/DEMO.md).

## The short version

When a quest resolves, the game builds a short paragraph by picking **one sentence per slot** out of
the phrases you authored, always in this order:

| Slot | French label in the UI | Role | Required? |
| --- | --- | --- | --- |
| `opening` | Ouverture (mise en place) | The stakes, the setting, what you were up against | No |
| `climax` | Action (obligatoire) | What the character actually did — this is the only slot that must produce something | Yes |
| `talentGrowth` | Progression de talent | What it changed in them — only when a talent progressed | No |

Which sentence it picks is decided by **tags**. That is the whole mechanism: no statistics, no model,
no invention. The generator only ever selects and assembles sentences you wrote, and fills in the
names of the enemy, the place, the quest and the talent with correct French agreement.

The consequence is worth stating plainly: **output quality is a function of how much you write, not
of the engine.** A combination nobody authored for still produces correct, grammatical text — just
plainer text. That's by design, not a defect.

## Writing a phrase

Creator dashboard → **Génération de texte** → *Phrases-verbes*.

Write phrases as **clauses, with no leading capital and no final period**:

```
vous avez triomphé de {sujet}
```

Not `Vous avez triomphé de {sujet}.` — the game adds the capital and the period when it displays the
paragraph. It also reuses your *action* phrase in the middle of another sentence, in every loot item's
description, where a capital and a period would read wrong:

```
[Obtenue lorsque vous avez triomphé des bandits du col]
```

If you end a phrase with `!`, `?` or `…`, that is kept as written — the engine only adds punctuation
when there is none.

### Placeholders

| Placeholder | Becomes | Available in |
| --- | --- | --- |
| `{sujet}` | The enemy or objective, with its article: `les bandits du col`, `l'ours des cavernes` | Any slot |
| `{lieu}` | The quest's location name | Any slot, if the quest has a location |
| `{quete}` | The quest's name | Any slot |
| `{talent}` | The name of the talent that progressed, e.g. `Pyromancie` | `talentGrowth` only |

`{sujet}` handles French contraction for you. Write the preposition literally and it agrees:

- `vous avez triomphé de {sujet}` → "vous avez triomphé **des** bandits", "**du** chef des bandits",
  "**de la** liche du tumulus", "**de l'**ours des cavernes"
- `vous avez carbonisé {sujet}` → "vous avez carbonisé **les** bandits", "**l'**ours des cavernes"

`{talent}` gives the bare talent name, so **you supply the determiner**: write `votre {talent}` or
`la {talent}`, whichever your sentence needs.

**A phrase using a placeholder the quest can't fill is skipped, not shown broken.** A phrase with
`{lieu}` simply never appears on quests without a location — so always keep a variant that doesn't
need it, or the slot may come up empty.

## How tags decide what gets picked

Every resolution assembles a **context**: a set of tag names drawn from three places.

1. **The enemy** (`narrativeSubjects` → its free-text `tags` field), e.g. `mort-vivant`, `hostile`
2. **The quest** (`quests` → its `tagIds`, resolved to tag names), e.g. `protection`, `village`
3. **The talent that progressed this quest** (`talents` → its `tagIds`), e.g. `feu`, `magie` — and
   *only* that talent, not everything the character owns

Then, for each slot:

> A phrase qualifies only if **every one of its tags** is in the context. Among those that qualify,
> the one with the **most tags** wins — ties are broken at random.

This is the single rule that matters most, so it's worth an example.

| Phrase tags | Context `{feu, magie, mort-vivant, hostile, protection, village}` | Why |
| --- | --- | --- |
| *(none)* | ✅ qualifies | No requirements — the generic fallback |
| `["feu"]` | ✅ qualifies | Score 1 |
| `["feu", "mort-vivant"]` | ✅ **wins** | Score 2, the most specific |
| `["feu", "bête"]` | ❌ rejected | `bête` isn't in the context, so *all* its tags aren't satisfied |

**Tags narrow a phrase; they don't merely favor it.** A phrase tagged `["protection", "village"]` is
about a village, and adding `village` to it means "never use this unless a village is genuinely
involved" — it will not be drawn for a caravan-escort quest that only shares `protection`. This is
deliberate: the looser rule silently produces confidently-wrong flavor text (announcing a village
that isn't in the quest), which is much worse than plainer text.

Practical guidance:

- **Always author one untagged phrase per slot.** It's the safety net that keeps a slot from coming up
  empty. Without an untagged action phrase, a quest with no matching content falls all the way back to
  the fixed sentence *"Vous revenez de votre quête."*
- **Add tags to make a phrase more specific, not to make it more likely.** Every tag you add is one
  more condition that must hold.
- Two tags is usually the sweet spot for a vivid line (a talent family × an enemy family, e.g.
  `feu` + `mort-vivant`). Three or more will rarely fire.

### Tag names must match exactly

This is the one sharp edge in the system.

Quests and talents reference the shared **Tags** catalog by id. Verb phrases and narrative subjects
store their tags as **free text**. The generator bridges them by name, so a talent tagged `feu` only
ever meets a verb phrase whose tag field says `feu` — spelled identically, accents included. `Feu`,
`feux`, or `feu ` (trailing space) do not match.

Two consequences:

- When you tag a verb phrase, copy the name from the Tags catalog rather than retyping it.
- Deleting a tag from the catalog strips it from quests and talents automatically, but **cannot** touch
  the free-text tags on verb phrases. Those phrases keep a tag nothing can satisfy any more, and quietly
  stop being drawn. If you delete a tag, search the phrase list for its name.

## Cible (target shape)

Each resolution draws either a group enemy or an individual one, and a phrase's **Cible** says which
it can be used for.

- On the **action** slot this matters most: the sentence names `{sujet}`, so it has to agree.
- On the other slots the form defaults to **Les deux**, because most openings and flourishes don't
  mention the enemy at all — leaving them on a single shape would hide them half the time. Narrow it
  yourself when your sentence does agree with the enemy's number ("`{sujet}` approchaient en nombre"
  needs *Groupe*).

## Talent progression phrases

The `talentGrowth` slot is only used when the quest actually improved or unlocked a talent. It never
fires otherwise, so you never have to guard against announcing progress that didn't happen.

The **Type de progression** field distinguishes the two cases, which need different wording:

- **Amélioration d'un talent connu** (`evolution`) — the character already had it:
  *"depuis, vous sentez que le feu gronde en vous, plus fort que jamais"*
- **Déblocage d'un nouveau talent** (`unlock`) — it just appeared:
  *"et dans les braises, quelque chose vous a répondu : la {talent} venait de s'éveiller"*
- **Les deux** — wording that works either way.

If several talents progressed at once, the paragraph talks about the **rarest** one, the same one the
result popup lists first.

## Linking phrases to a specific quest

A quest's *Phrases de réussite* field restricts which phrases that quest may use — but **per slot**.
If you link one action phrase to a quest, that quest uses your phrase for the action and still draws
its opening and flourish from the global catalog. So linking a single sentence never impoverishes the
rest of the paragraph. The phrase picker shows each phrase's slot next to its text.

## When nothing matches

The generator degrades in steps rather than failing:

1. No `opening` matches → the paragraph starts at the action sentence.
2. No `talentGrowth` matches (or nothing progressed) → the paragraph ends at the action sentence.
3. No `climax` matches at all — including no untagged fallback, or no subject of the drawn shape — →
   the generator returns nothing and the quest falls back to *"Vous revenez de votre quête."*

Seeing that fixed sentence in game is the signal that your action-phrase catalog has a hole.

## Seeing what your content produces

There is no preview in the dashboard yet (it's the top follow-up in
[`narrative-poc/report.md`](../narrative-poc/report.md) § 4.10). Until there is, the demo harness is
the fastest feedback loop: edit `narrative-poc/src/data/catalog.js` to mirror your content, then

```bash
node narrative-poc/demo.js
```

It runs the real engine and prints every distinct paragraph each scenario can produce — including,
usefully, the scenarios where it can only produce two.

## Backward compatibility

Phrases authored before slots existed are treated as **action** content, and behave exactly as they
did. No migration or backfill was needed. The one behavior change to existing content: tag matching
went from "shares at least one tag" to "all tags satisfied", so a phrase carrying several tags is now
harder to draw than it used to be. If a phrase has stopped appearing, check whether it is asking for a
tag combination that never actually occurs together.
