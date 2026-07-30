# Manual test scenario — narrative generation

To run in the deployed app, as a signed-in **creator**, after deploying the branch
`feat/narrative-grammar-engine`. Covers the multi-slot narrative generator
(`functions/src/textGeneration.js`), its quest integration, and the creator UI added for it.

Estimated time: 45–60 minutes, most of it the one-time content setup in part B.

## What makes this testable

Two things you need to know before starting, or several steps below look impossible:

- **The daily lock is not a calendar lock.** The `[TEST] Avancer le temps d'un jour` button at the top
  of the action panel backdates the running action so it completes immediately *and* frees the
  character to act again. So the loop **Partir en quête → [TEST] Avancer le temps → read result →
  Fermer** can be repeated as many times as you like in one sitting. Nearly every test case below is
  one turn of that loop.
- **The creator dashboard is a second read path.** *Personnages* → pick your character shows the full
  `actionsLog`, each entry with its generated `narrativeText`. Useful for comparing a run of ten
  resolutions at a glance instead of reading them one popup at a time.

## Part A — Deploy and smoke check

| # | Step | Expected |
| --- | --- | --- |
| A1 | Deploy functions (`cd functions && npm run deploy`) and the front end | No deploy errors |
| A2 | `cd functions && npm test` locally before deploying | 181 tests pass, 0 fail |
| A3 | Sign in as creator, open the creator dashboard → *Génération de texte* | The *Phrases-verbes* section shows a new explanatory paragraph, and a new **Emplacement** filter |
| A4 | **Before touching any content**, run one quest as your character | A result text appears as it did before this change. This is the backward-compatibility check: your existing phrases must still generate. Note the exact sentence — you'll compare in D1 |

> If A4 produces *"Vous revenez de votre quête."* and it did **not** before, stop and report: that
> means existing content stopped matching. Everything else assumes A4 looked normal.

## Part B — Content setup

All in the creator dashboard. This builds the minimum content the later cases need. Names are
deliberately distinctive so you can tell generated text apart from anything pre-existing.

### B1 — Tags (*Tag* section)

Create these if absent, spelled exactly like this: `feu`, `magie`, `lame`, `protection`, `village`,
`test-narration`.

### B2 — Quest objectives (*Objectifs de quête* section)

Create two, and give **both** the `test-narration` tag id:

| Nom | Type | Article | Genre | Nombre | Tags (free text) | Rareté |
| --- | --- | --- | --- | --- | --- | --- |
| `spectres de Vaubourg` | groupe | les | m | pluriel | `mort-vivant, hostile, test-narration` | rare |
| `liche du tumulus` | individuel | la | f | singulier | `mort-vivant, hostile, magie, test-narration` | rare |

> The free-text `tags` column is what the generator matches; the `test-narration` **tag id** is what
> lets a talent progress from this objective. Both are needed.

### B3 — A talent (*Talents* section)

Create `Pyromancie de test`, rarity **commun**, and give it the tag ids `feu` + `magie`. Note the new
help text under the Tags field.

Then check the character sheet: your character must actually **own** it for case C4 to fire an
`evolution` rather than an `unlock`. If they don't own it, C4 tests the unlock path instead — note
which one you got, both are valid, they're just different cases.

### B4 — Verb phrases (*Phrases-verbes* section)

Create these nine. For each: *Résultat* = **Victoire**. Write them **exactly** as shown — no leading
capital, no final period.

| # | Emplacement | Cible | Type de progression | Tags | Modèle |
| --- | --- | --- | --- | --- | --- |
| P1 | Ouverture | Les deux | — | `protection, village` | `{lieu} n'a pas perdu une seule planche grâce à vous` |
| P2 | Ouverture | Les deux | — | `protection` | `ce que vous étiez venu défendre a tenu bon jusqu'au bout` |
| P3 | Ouverture | Les deux | — | *(empty)* | `« {quete} » : voilà ce qu'on vous avait promis` |
| P4 | Ouverture | Groupe | — | *(empty)* | `{sujet} étaient plus nombreux que prévu` |
| P5 | Action | Les deux | — | `feu, mort-vivant` | `la magie vous a envahi comme rarement et, d'un geste, vous avez carbonisé {sujet}` |
| P6 | Action | Les deux | — | `feu` | `vos flammes ont eu raison de {sujet}` |
| P7 | Action | Les deux | — | *(empty)* | `vous avez triomphé de {sujet} au terme d'un combat acharné` |
| P8 | Progression de talent | Les deux | Amélioration d'un talent connu | `feu` | `depuis, vous sentez que le feu gronde en vous, plus fort que jamais` |
| P9 | Progression de talent | Les deux | Déblocage d'un nouveau talent | `feu` | `et dans les braises, la {talent} venait de s'éveiller` |

**While creating these, verify the form behaves:**

| # | Step | Expected |
| --- | --- | --- |
| B4a | Set *Emplacement* to **Ouverture** | *Cible* switches by itself to **Les deux** |
| B4b | Set *Emplacement* back to **Action** | *Cible* switches back to **Groupe** |
| B4c | Set *Emplacement* to **Progression de talent** | A **Type de progression** select appears; it is absent for the other two slots |
| B4d | Save P8, then reopen it with *Modifier* | Slot, cible and *Type de progression* all come back as saved — not reset to defaults |
| B4e | Look at the saved phrases in the list | Each row reads `(victoire, <slot label>, <cible>)` |
| B4f | Type `ouverture` in the search box | Only the opening phrases remain |
| B4g | Use the **Emplacement** filter → *Action (obligatoire)* | Only action phrases remain, including your pre-existing ones (they count as action content) |

### B5 — A quest (*Quêtes* section)

Create `Le siège de Vaubourg`:

- **Objectifs** : both from B2
- **Difficultés** : `facile` and `moyen`
- **Régions** : your character's region
- **Lieu de quête** : any; note its name, it's what `{lieu}` renders
- **Tags** : `protection`, `village`, `test-narration`
- **Phrases de réussite** : leave empty for now (used in C7)

> Optionally delete or unlink other quests in your region first, so the draw lands on this one every
> time. Otherwise just repeat the loop until you get it — the popup title shows which quest ran.

## Part C — Generation test cases

One turn of the loop per case: **Partir en quête → [TEST] Avancer le temps d'un jour → read the
result → Fermer**. Repeat a case until the quest drawn is `Le siège de Vaubourg`.

| # | What it checks | Expected |
| --- | --- | --- |
| C1 | **Three-slot paragraph** | The text is **2 or 3 sentences**, in the order *opening → action → talent*. Each starts with a capital and ends with a period, even though you authored them without either |
| C2 | **The most specific opening wins** | The opening is **P1** (`<lieu> n'a pas perdu une seule planche…`) with the real location name substituted — never P2 or P3. All of P1's tags (`protection`, `village`) are on the quest |
| C3 | **`{sujet}` agreement** | With `spectres de Vaubourg`: "carbonisé **les** spectres de Vaubourg" / "raison **des** spectres de Vaubourg". With `liche du tumulus`: "carbonisé **la** liche" / "raison **de la** liche". Never a bare `{sujet}`, never `de les` |
| C4 | **Talent flourish fires and matches the kind** | Repeat until the popup shows an **Amélioration de talent** box for `Pyromancie de test`. The paragraph must then end with **P8** if the box says an improvement, or **P9** if it says `Nouveau :`. P9's `{talent}` must render as `Pyromancie de test` |
| C5 | **No flourish without progression** | On a resolution with **no** *Amélioration de talent* box, the paragraph has **no** third sentence, and never mentions a talent |
| C6 | **Talent tags reach the action sentence** | On a resolution where `Pyromancie de test` progressed, the action sentence is **P5** (the specific `feu`+`mort-vivant` one) — not P6 or P7. When no talent progressed, P5/P6 are impossible (no `feu` in context) and you get **P7** |
| C7 | **Per-slot quest phrase preference** | Edit the quest, set *Phrases de réussite* to **P7 only**, save. Run again: the action sentence must now always be P7, **and the opening must still be P1** — linking one action phrase must not strip the opening. Also check the picker showed each phrase's slot next to its text. Then clear the field again |
| C8 | **Subject consistency across sentences** | Run until you get an opening that names the enemy (**P4**, group draws only). Both sentences must name **the same** enemy — never "spectres" in one and "liche" in the other |
| C9 | **Loot clause** | Open the inventory, click an item obtained from this quest. Its description ends with `[Obtenue lorsque <action sentence>]` — the **action sentence only**, lowercase, no period, not the whole paragraph |
| C10 | **Variety** | Over ~10 runs, collect the paragraphs from the creator dashboard (*Personnages* → your character → history). You should see several distinct combinations, not the same one every time |

### C11 — The subset guard (the important negative case)

This is the one case that verifies the rule the whole design rests on: **partially matching tags must
not select a specific fragment.**

1. Create a second quest `L'escorte de la caravane` — same region, same objectives, difficulties
   `facile`/`moyen`, tags `protection` + `test-narration` **but not `village`**.
2. Run quests until this one is drawn.

**Expected:** the opening is **P2** (`ce que vous étiez venu défendre…`) or **P3**, **never P1**. P1
requires `village`, which this quest does not have — even though it shares `protection`.

Seeing "…n'a pas perdu une seule planche" on the caravan quest is a **failure**: report it.

### C12 — Placeholder safety

1. Edit `L'escorte de la caravane` and clear its *Lieu de quête*.
2. Run it until drawn.

**Expected:** the paragraph never contains the literal text `{lieu}`. A phrase needing a location is
skipped rather than rendered broken. (P1 is already excluded by C11; this checks the mechanism, so also
skim every text you produced in part C for any stray `{` character.)

## Part D — Regression checks

| # | What it checks | Expected |
| --- | --- | --- |
| D1 | **Pre-existing phrases still work** | Compare against A4. Run a quest that uses only your old content: it still generates a sentence, now capitalized and ending with a period. Its slot shows as *Action (obligatoire)* in the list |
| D2 | **Elision fix** | If any narrative subject uses the article `l'`, its sentences must read `l'ours des cavernes` / `de l'ours des cavernes` — **not** `l' ours` with a space |
| D3 | **Empty-catalog fallback** | Temporarily filter to *Action* and delete (or retag so nothing matches) every action phrase, then run a quest. Expect exactly *"Vous revenez de votre quête."* and no crash. **Restore your phrases afterwards** |
| D4 | **Other actions untouched** | Run *Récolte* and *Artisanat* once each. Their result texts are unchanged — neither uses the generator |
| D5 | **Quest history** | Creator dashboard → *Personnages* → your character. Every quest entry shows its generated `narrativeText` |
| D6 | **Loot still lands** | After closing a result popup with loot, the items are in the inventory (the reordering of talent/narration/loot inside `resolve()` must not have broken the loot draw) |
| D7 | **Talent progression still applies** | A talent shown in the *Amélioration de talent* box is actually improved/added on the character sheet |

## Part E — Reporting

For each failure, note: the case number, the **exact** text produced, the quest drawn, the enemy
named, whether a talent progressed (and which kind), and the phrases involved. The generator is
deterministic given its inputs, so an exact text plus the quest and objective tags is enough to
reproduce it in `narrative-poc/demo.js`.

Cases worth escalating over the others, because they mean a rule is broken rather than content being
thin: **C11** (subset guard), **C8** (subject consistency), **C12** (raw placeholder), **D3** (crash
instead of fallback).
