# Logical differences: `python_daily_game` vs. the current web project

Analysis only — no implementation plan, no proposed changes to this repository.

Sources compared:

- **Web (current)**: `functions/src/**` (game rules), `shared/schema/**` (data contracts). ~5 300 lines of rule + schema code across 24 schema files and 8 action handlers.
- **Python (new)**: `C:\Users\hugoc\Documents\jdr\python_daily_game` — 790 lines of model code across 8 top-level directories. No prose corpus any more (see the revision note).

**Revision note 4 (2026-08-24, snapshot taken 09:19).** A narrow revision. Only two files moved since revision 3's 03:01 snapshot — `actions/Mission.py` and `actions/ActionResult.py` — and between them they clear every blocker revision 3 opened. Four things drive the edits below; everything else in this document stands as revision 3 left it.

1. **The tree compiles again.** ✅ Both missing commas in `Mission.proceed`'s two `ActionResult(...)` calls are back. `python -m compileall` over the whole tree is clean (verified).
2. **`ActionResult` can be constructed.** ✅ `__init__` no longer assigns the deleted `questsUnlocked` / `questsEnded` names, so the `NameError` that broke *every* action's return is gone — `ActionResult()` returns a nine-field object with every field initialised (verified). See §6.
3. **The import cycle is gone outright.** ✅ The dead `from quests.Quest import Quest` line is deleted. `actions.ActionResult`, `actions.Mission`, `actions.Job`, `actions.Move`, `quests.Quest`, `player.Character`, `PNJs.PNJs` and `monsters.Monster` all import cleanly (verified). Only `game` still fails, on the pre-existing `Character.fillMissions` region-`None` defect (§14).
4. **Talent training gains a real ceiling.** `Mission.levelUpTalent`'s candidate filter changed from `level <= difficulty + 1` to `level <= min(difficulty + 1, 4)`, so a level-5 talent is never a training candidate and 5 becomes a cap. Revision 3's over-training penalty is gone. See §4c.

Against that, a defect revision 3 recorded as sitting *behind* the syntax error is now live, and is the model's new headline: `proceed` passes `talentsTrained=` to a parameter named `talentTrained`, so **every successful mission raises**. Given a loot-bearing target the failure branch runs cleanly, so a mission today can only fail. See §4c and §14.

Untouched since revision 3: §1.1–§1.3, §1b, §3, §4–§4.2, §4b, §5 and §7–§13. §14 and §15 are updated for the above.

**Revision note 5 (2026-08-24, snapshot taken 09:37) — reputation only.** `actions/Mission.py` moved again, on one line: the success reward changed from `reputationGained = self.difficulty` to **`reputationGained = 1 + self.difficulty`**. Nothing else in the file or the tree changed. This is small in the diff and large in the rules — it moves the whole reputation economy from clearly negative-sum to almost exactly zero-sum, and it invalidates the −0.55 figure revisions 3 and 4 both carried as their headline reputation finding. The rest of `Mission.py` is byte-identical to revision 4's 09:19 read, so no other section is affected. §1.4, §2 and §15 item 16 are rewritten for it; every figure below is re-derived and re-verified against the current file.

## Reading key

| Marker | Meaning |
|---|---|
| **[not yet]** | Absent from Python but intended — a gap in the port, not a design decision. Now covers rarity *degradation* on failure loot (failure pays loot again, but undegraded — §11), `Merchant.buildInventory`'s item database, and the DB-backed catalogs replacing the hardcoded enums / `BESTIARY` / the empty `MAP` / the entirely absent NPC roster. |
| **[scrapped]** | Deliberately removed — narration generation, and now the authored mission-topic corpus. |
| **[changed]** | A genuine, deliberate difference in the rules. |
| **[unclassified]** | Present and working on the web, absent from Python, and not covered by any of the above. These are the ones that need a call. |

Everything the Python model reimplements identically is omitted.

**On Python-side bugs.** Several rules below are *declared correctly but wired wrongly* — a missing attribute, an int where a dict is expected, a method that is named but never called. Where the intent is unambiguous, the section states **the intended rule first** (that is what should be ported) and flags the wiring defect inline as *(broken in Python: …)*. §14 collects every one of them, and marks with ✅ the ones fixed since revision 1.

---

## 0. What kind of artefact each one is

| | Web | Python |
|---|---|---|
| Rules live in | Handler functions over Firestore documents | Classes with methods |
| Content lives in | Firestore collections, authored through a React creator dashboard, contract-checked by Zod | Enums + module-level lists **[not yet]** — `RARITIES`, `DIFFICULTIES`, `AreaType`, `ItemCategory`, `BESTIARY`, `MAP`, and no NPC catalog at all |
| Effects are applied by | Each handler writing its own `updates` object straight to the character document | One `ActionResult` value object consumed by one `Character.update()` **[changed]** |
| Execution model | Server-authoritative, transactional, one action per 12 h Interval | In-process, synchronous, no time model **[unclassified]** |
| Maturity | Shipped, 18 unit-test files | Skeleton — `game.py` says so; mid-edit. ✅ The tree byte-compiles and every rule module imports again, but no successful mission can complete (§14) |

The catalogs being Python enums and literals today is **[not yet]** and carries no design weight — with two exceptions worth flagging. First, the *values* of those enums are themselves a design change: `AreaType` has no web counterpart at all (§4), and the rarity/difficulty scales change labels (§3). Second, `BESTIARY` and `MAP` are both effectively empty (one monster, zero regions) and the new NPC classes (§10b) have no catalog whatsoever — not even an empty one — so the model is not runnable end to end even once it compiles again.

---

## 1. Resolution algorithm **[changed]**

Both models roll one d100 and read it twice — once for success, once for harm. That much of the web's structure survives. **Everything about how the two readings are computed changes.**

### 1.0 Side-by-side

**Web** (`functions/src/lib/questResolution.js`, consumed by `missionResolution.js`):

```
score          = 1..100                                   (rollScore)
threshold      = SUCCESS_TABLE[difficulty].threshold
                 − Σ over talents sharing a tag with the objective of
                     ( 1 + max(0, talent.quality − tier.requiredTalentLevel) )
success        = score >= threshold

woundTier      = dropDifficultyTier(difficulty, count of quality-5 talents)   # spends dropCost per step
woundThreshold = WOUND_TABLE[woundTier].{permanent,severe,light}
                 − (count of tag-sharing talents), floored at 1 / 2 / 3
wound severity = the threshold the score EXACTLY EQUALS, most severe first; else none
```

`SUCCESS_TABLE` thresholds: facile 30, moyen 50, difficile 80, tres_difficile 90, epique 98, mythique 100 — with `requiredTalentLevel` 1/1/2/3/4/5.

**Python** (`actions/Mission.py`). Note that `resolveD100` is now a **module-level function**, not a method — the class keeps only the talent-matching half:

```
nb_relevant, nb_perfect = self.checkAgainstTalent(characterTalents)
    relevant talents = those sharing a tag with self.tags        # = target.getTags(), §4b
                       AND whose level >= self.difficulty        (confirmed)
    nb_relevant       = SUM of those talents' levels
    nb_perfect        = COUNT of those talents at level exactly 5

roll            = randrange(100)                                 # 0..99, not 1..100
updated_roll    = roll + nb_relevant
updated_diff    = updateDifficulty(self.difficulty, nb_perfect)
injury          = Injury.fromRollAndDiff(updated_roll, updated_diff)
success         = updated_roll >= SUCCESS_THRESHOLD[updated_diff]
```

`SUCCESS_THRESHOLD = [10, 40, 70, 90, 95, 100]` — a module-level list indexed by difficulty 0..5, not a per-tier object.

```
def updateDifficulty(difficulty, nb_perfect):
    new_difficulty = difficulty
    perfect_left   = nb_perfect
    while perfect_left > difficulty and new_difficulty >= 1:      # floor 0 (confirmed)
        perfect_left   -= difficulty                              # cost = the ORIGINAL difficulty
        new_difficulty -= 1
    return new_difficulty
```

`Injury.fromRollAndDiff(roll, difficulty)` is a named classmethod with the confirmed argument order. ✅ The missing-comma syntax error in `proceed`'s two `ActionResult(...)` calls, which revision 3 recorded as a regression, is fixed again — the tree byte-compiles (§14).

### 1.1 Six mechanical differences to carry into the port

| # | Web | Python |
|---|---|---|
| 1 | Talents **lower the bar** | Talents **raise the roll** (`roll + Σ levels`) |
| 2 | Per-talent bonus is `1 + (quality − requiredTalentLevel)` | Per-talent bonus is the **raw level** (1–5), no tier-relative baseline |
| 3 | Every tag-sharing talent counts | Only talents whose **level >= the mission's difficulty** count (confirmed) |
| 4 | Quality-5 talents affect **wounds only** (`dropDifficultyTier`) | Level-5 talents lower `updated_difficulty`, which drives **both success and injury** |
| 5 | Tier-drop cost = `WOUND_TABLE[tier].dropCost` (1/2/3/4/5, ascending per tier) | Tier-drop cost = **the mission's original difficulty**, re-charged for every step, and the loop requires *strictly more* than the cost (`perfect_left > difficulty`) |
| 6 | Score domain 1..100 | Score domain 0..99 |

Difference 3 is a real gate that has no web equivalent: a level-2 talent contributes nothing at all to a difficulty-3 mission. On the web the same talent still shaves the threshold.

Difference 5 makes the tier drop cheap at low difficulty and dear at high difficulty. Worked examples of `updateDifficulty`:

| difficulty | nb_perfect needed for 1st step | result with 2 perfect | with 5 perfect | with 11 perfect |
|---|---|---|---|---|
| 0 | — (loop never runs) | 0 | 0 | 0 |
| 1 | 2 | 0 | 0 | 0 |
| 2 | 3 | 2 | 1 | 0 |
| 3 | 4 | 3 | 2 | 1 |
| 4 | 5 | 4 | 4 | 2 |
| 5 | 6 | 5 | 5 | 3 |

Note the consequence: **a single level-5 talent never reduces difficulty** at any tier (`nb_perfect > difficulty` fails for difficulty ≥ 1, and the `new_difficulty >= 1` guard means difficulty 0 has nowhere to go). It only contributes its 5 points to the roll.

### 1.2 Success probabilities

Because the roll is uniform over 0..99, success chance = `100 − SUCCESS_THRESHOLD[d] + nb_relevant`, clamped to [0, 100].

| Difficulty | Web, no talents | Web, one quality-5 tag-matching talent | Python, no talents | Python, one level-5 tag-matching talent (+5 roll, no tier drop) |
|---|---|---|---|---|
| 0 / facile | 71 % | 73 % | 90 % | 95 % |
| 1 / normal (web: moyen) | 51 % | 53 % | 60 % | 65 % |
| 2 / difficile | 21 % | 24 % | 30 % | 35 % |
| 3 / très difficile | 11 % | 13 % | 10 % | 15 % |
| 4 / extrême (web: epique) | 3 % | 4 % | 5 % | 10 % |
| 5 / impossible (web: mythique) | 1 % | 2 % | **0 %** | 5 % |

Two things to note for the port:

- **Difficulty 5 is literally impossible without talents.** `SUCCESS_THRESHOLD[5] = 100` and the roll maxes at 99. The web's mythique tier is winnable on a natural 100 (1 %); Python's `impossible` requires at least one point of talent bonus to be winnable at all. This reads as a deliberate take on the tier's name, but it means a talentless character *cannot* clear the top tier — worth encoding as an explicit rule rather than leaving it as an accident of the roll's domain.
- **The unmodified curve is flatter and more generous than the web's** at every tier except 3 and 5, and the talent contribution is a clean linear `+level` rather than the web's tier-relative formula.

Since revision 1 the difficulty *distribution* also changed (§4.2), so these per-tier numbers now sit behind a weighted draw that puts 70 % of missions at difficulty 0–1.

### 1.3 The talent-domination question is resolved

The original dice-pool draft made a single maxed talent worth a ~250× multiplier at the top tier. The d100 model does not: a level-5 talent is worth exactly **+5 percentage points** of success chance, plus a share of a tier drop once enough of them stack. That is materially stronger than the web's ~2 points but no longer a different order of magnitude. **Talents scale linearly and predictably, and content authors can reason about them.**

The remaining super-linearity is `updateDifficulty`, which is a step function: crossing `nb_perfect > difficulty` drops a whole tier at once, worth 20–30 points of success chance and a full row of injury thresholds.

### 1.4 Failure costs something **[changed]**

Web failure is neutral-to-mildly-positive: no reputation gained, but consolation loot at rarity − 2. Python's failure branch does three things at once, and two of them changed since revision 2:

```python
return ActionResult(
    itemsGained      = self.loot_table.loot(1),    # revision 2: nothing
    reputationGained = -(4 - self.difficulty),     # revision 2: reputationLost = {region: 1}
    injury           = injury,
)
```

- **Consolation loot is back.** ✅ Failure pays 1 item against success's 3, drawn from the same monster pool with no rarity degradation. So the two models soften failure on opposite axes: the web degrades the *rarity* of a full-size haul, Python shrinks the *count* of an undegraded one (§11).
- **The reputation penalty is inverse to difficulty**, and it is now signed rather than a separate field (§2). Since revision 5 the *success* side is `1 + difficulty` rather than `difficulty`, which shifts every expectation up by exactly `P(success)`:

| difficulty | 0 facile | 1 normal | 2 difficile | 3 très difficile | 4 extrême | 5 impossible |
|---|---|---|---|---|---|---|
| reputation on success `1 + d` | **+1** | **+2** | **+3** | **+4** | **+5** | **+6** |
| reputation on failure `-(4 − d)` | −4 | −3 | −2 | −1 | **0** | **+1** |
| P(success), no talents | 90 % | 60 % | 30 % | 10 % | 5 % | 0 % |
| **expected reputation** | **+0.50** | **0.00** | **−0.50** | **−0.50** | **+0.25** | **+1.00** |
| generation weight (§4.2) | 25 % | 45 % | 20 % | 6 % | 3 % | 1 % |

*(Verified against the current file: analytic **+0.0125** per mission weighted, Monte-Carlo **+0.0131** over 400 000 draws through the real `resolveD100`.)*

Failing something easy still costs you standing; failing something extreme costs nothing, and failing an `impossible` mission *pays* +1. But the one-point success floor changes what that adds up to, and three consequences are worth a deliberate decision before the port:

- **The economy is now almost exactly zero-sum, and that looks like an accident rather than a target.** Weighted by the generation distribution (§4.2), a random mission is worth **+0.0125 reputation** to a character with no relevant talents. Revision 4 recorded this same figure as **−0.55**; the `1 +` moved it 0.56 points and landed it within 0.013 of zero — about one point of reputation per 80 missions. A talentless character now treads water instead of drifting down — which is a far more defensible baseline — but nothing in the code expresses "should net to zero", so the balance is the product of two independently-chosen formulas meeting near the origin. If zero-sum is the intent, it deserves to be stated; if it is coincidence, it will break the next time either formula is touched.
- **The curve is now non-monotonic in difficulty.** Expectation runs +0.50, 0.00, −0.50, −0.50, +0.25, +1.00 — down across the three tiers players actually see, then back up across the two they cannot win. `facile` is the best *reachable* tier for reputation and it is also the easiest, so nothing pushes a talentless character up the ladder: the rational play is to farm difficulty 0 forever. Under revision 4's formula every reachable tier was negative, so the pressure was at least uniform. This is the sharper design question the change opens.
- **The only tiers with positive expectation besides `facile` are the two nobody can win.** `extrême` (+0.25) and `impossible` (+1.00) clear zero precisely because their failure penalty has run off the end of the scale, and `impossible` is unwinnable without talents (§1.2). The failure formula is still not clamped, so `-(4 - difficulty)` crossing zero at difficulty 4 remains load-bearing — `min(0, ...)` or re-basing on `-(5 - difficulty)` are still one-token changes, and they now interact with the `1 +` rather than standing alone.

`Character.loseReputation` still correctly uses `-=` (it read `+=` in revision 1) ✅, but nothing calls it any more: the single signed `gainReputation` channel now carries both directions.

---

## 1b. Harm: the wound system **[changed]**

Implemented in `player/Health.py` (`Injury`, `Health`), threaded through `ActionResult.injury` and `Character.health`. The *concept* matches the web's three-counter escalating wound model closely; the *derivation of a wound from a roll* is completely different — and different again from revision 1.

### 1b.1 Deriving the wound — severities are now exclusive

**Web** (`questResolution.js::determineWoundSeverity`): the score is compared for **exact equality** against three thresholds, most severe first, and **at most one wound** is produced per resolution.

```
if (score === thresholds.permanent) return "permanent";
if (score === thresholds.severe)    return "severe";
if (score === thresholds.light)     return "light";
return null;
```

`WOUND_TABLE` (permanent / severe / light), before reductions:

| tier | permanent | severe | light | dropCost |
|---|---|---|---|---|
| facile | 1 | 5 | 20 | — |
| moyen | 2 | 10 | 50 | 1 |
| difficile | 5 | 30 | 60 | 2 |
| tres_difficile | 10 | 50 | 80 | 3 |
| epique | 30 | 80 | 95 | 4 |
| mythique | 50 | 95 | 100 | 5 |

Each threshold is then reduced by 1 per tag-sharing talent and floored at `permanent 1 / severe 2 / light 3`.

**Python** (`Injury.fromRollAndDiff(roll, difficulty)`): the three thresholds are read as **half-open bands**, so exactly one of the three flags can be set:

```python
light     = int(roll <= thresholds[difficulty]["light"]  and roll >  thresholds[difficulty]["severe"])
severe    = int(roll <= thresholds[difficulty]["severe"] and roll >  thresholds[difficulty]["permanent"])
permanent = int(roll <  thresholds[difficulty]["permanent"])
```

`Injury.thresholds`, indexed by the **post-`updateDifficulty`** difficulty (unchanged since revision 1):

| difficulty | light | severe | permanent |
|---|---|---|---|
| 0 | 5 | 1 | 0 |
| 1 | 10 | 5 | 1 |
| 2 | 30 | 10 | 5 |
| 3 | 70 | 30 | 10 |
| 4 | 90 | 70 | 30 |
| 5 | 99 | 90 | 70 |

**This reverses revision 1's headline finding.** The values are still nested, but the comparisons now carve them into bands: `permanent` for the bottom slice, `severe` for the next, `light` for the next, nothing above. A permanent-wound roll attributes **one** permanent wound, not one of each.

Consequences for the port:

- **Exact-match → banded range.** The web's signature idea — "a near-miss and a catastrophe are the same number read two ways" — is still gone. Injury is *how badly you failed*: the lower the roll, the worse the band. Much more legible to a player, and much more frequent than the web's exact-match.
- **Back to one wound per resolution**, matching the web. `Injury` is still a `{light, severe, permanent}` triple of 0/1 counts rather than one of four enum values, so the Firestore-side effect payload still needs three numbers where the web needed one string — but the triple is now guaranteed to hold at most a single 1. Whether to keep the triple or collapse it to a severity string is now a free choice, not a forced one.
- **Talents no longer reduce wound thresholds directly.** The web subtracts one point per tag-sharing talent from all three thresholds; Python has no counterpart. Talents affect injury only twice: indirectly through `updated_roll` (a higher roll is further from every threshold) and through `updateDifficulty` (a whole cheaper row).
- **`updated_roll` is what's compared**, not the raw roll — so talent levels shield against injury point-for-point, exactly as they help success. There is no separate wound-side talent term to port.
- **The double `__init__` is gone.** ✅ `Injury.__init__(light, severe, permanent)` is now the only constructor and `fromRollAndDiff` is an explicit classmethod alongside it — so fixed, non-rolled harm is expressible, which it wasn't in revision 1.
- *(Broken in Python: the `permanent` comparison is `<` while `severe`'s lower bound is `> permanent`, so **a roll exactly equal to the permanent threshold falls through all three bands and produces no wound at all**. One value per difficulty — roll 0/1/5/10/30/70 for difficulties 0–5. At difficulty 5 that is the *only* unwounded roll in the whole domain. Almost certainly meant to be `<=` on permanent, matching the other two.)*

### 1b.2 Injury never happens on success

At every difficulty the light-wound band's upper bound sits strictly below the success threshold:

| difficulty | success if roll >= | wounded if roll <= | failure with no wound (roll range) |
|---|---|---|---|
| 0 | 10 | 5 | 0, 6–9 |
| 1 | 40 | 10 | 1, 11–39 |
| 2 | 70 | 30 | 5, 31–69 |
| 3 | 90 | 70 | 10, 71–89 |
| 4 | 95 | 90 | 30, 91–94 |
| 5 | 100 | 99 | 70 only |

(The isolated single values are the fall-through bug above.)

So although `Mission.proceed` passes `injury` on **both** branches, a successful mission mathematically always yields an all-zero `Injury`. The port can keep the unconditional pass-through (harmless, and robust if the two tables are ever retuned independently) or short-circuit it on success — but it must not hardcode "success ⇒ no wound" as an invariant, because it is a property of the two tables rather than of the algorithm.

Wound probabilities (no talents, roll uniform 0..99) — **these are now mutually exclusive**, where in revision 1 they stacked:

| difficulty | P(light) | P(severe) | P(permanent) | P(any wound) | P(failure) |
|---|---|---|---|---|---|
| 0 | 4 % | 1 % | 0 % | 5 % | 10 % |
| 1 | 5 % | 4 % | 1 % | 10 % | 40 % |
| 2 | 20 % | 5 % | 5 % | 30 % | 70 % |
| 3 | 40 % | 20 % | 10 % | 70 % | 90 % |
| 4 | 20 % | 40 % | 30 % | 90 % | 95 % |
| 5 | 9 % | 20 % | 70 % | 99 % | 100 % |

Read against revision 1: the *permanent* column is unchanged, but a hard failure no longer moves three counters at once. Compare the web, where the chance of *any* wound is roughly 3 % at every tier. **Injury is still an order of magnitude more common than on the web**, so the missing healing path (§1b.3) is still the open question — but the wound ladder now fills at roughly a third of the rate revision 1 described, which makes the difference survivable rather than terminal.

Weighted by the new difficulty distribution (§4.2), a random mission carries a 19.6 % chance of some wound and a 3.6 % chance of a permanent one.

### 1b.3 Accumulating and dying

The escalation ladder is near-identical to the web's, which is good news for the port.

**Web** (`functions/src/lib/wounds.js::applyWound`) — attributes exactly one wound, reading the current counters first:

- light below 3 light → `woundsLight += 1`; at 3 light → attribute a **severe** instead (light stays at 3).
- severe below 3 severe → `woundsSevere += 1`; at 3 severe → attribute a **permanent** instead.
- severe or permanent while already at 3 permanent → **`died: true`**, no counter moves.
- Counters live on the character document as `woundsLight` / `woundsSevere` / `woundsPermanent`, alongside `alive`.

**Python** (`Health`):

- `gainLight(n)`: if `light + n − 3 > 0` → set `light = 3` and `gainSevere(1)`; else `light += n`.
- `gainSevere(n)`: same shape, escalating to `gainPermanent(1)`. ✅ The `self.severet` typo and the `self.light = 3` mis-assignment reported in revision 1 are both fixed.
- `gainPermanent(n)`: `permanent += n`, uncapped.
- `isDead()` → `permanent >= 3`.

Differences that matter:

- **Death trigger is off by one.** Web dies on the *next* severe/permanent attributed while already holding 3 permanent — 3 permanent wounds is survivable, the 4th hit kills. Python dies **the moment `permanent` reaches 3**. Pick one deliberately.
- **Overflow is discarded in both, but differently.** Web escalates one step per attributed wound; Python computes `overhand` and then throws it away (`self.light = 3` regardless of how far over), escalating exactly one step no matter the amount. Since `Injury` only ever produces a single 1, the two coincide in practice — but the port should state the rule rather than inherit the accident.
- **Both now attribute at most one wound per resolution.** This was the biggest divergence in revision 1 and it is gone.
- **Death handling.** Web sets `alive: false` on the character, and the `notWounded` condition (`light + severe + permanent === 0`) gates actions. Python only `print("GAME OVER")` inside `Character.update` — no `alive` flag, no gate, and no counterpart to `notWounded`, since the whole condition vocabulary is gone (§5).
- **No healing exists in either model.** Web has no wound-recovery path; Python has no `heal`. This still needs an explicit decision during the port.

### 1b.4 The harm chain is still not connected

The intended chain is `Mission.proceed → ActionResult.injury → Character.update → Character.sufferInjury → Health.sufferInjury → Health.isDead`. Two of the three broken links are repaired: ✅ `ActionResult.__init__` now assigns `self.injury`, and ✅ `Character.sufferInjury` now passes its `injury` argument instead of the `Injury` class.

**The middle link is still missing.** `Character.update` never reads `action_result.injury` and never calls `self.sufferInjury` — it only checks `isDead()` on a `health` that nothing has touched. Read `player/Health.py` as the specification of the rule; it remains unreachable at runtime.

---

## 2. Reputation: one global score → a per-region relationship **[changed]**

**Web**: `character.reputation`, a single integer. Set from `origin.reputationStart`, incremented on mission/exploration success, read by the `minReputation` availability condition and by subject triggers.

**Python**: `reputations: Dict[Region, int]`, seeded `{starting_region: 1}`. Gained/lost against `self.region` unless a region is named.

Consequences:

- Reputation becomes **a relationship with a place**, not a career score. Nothing in the web model expresses that, and every consumer of the scalar (`minReputation`, trigger conditions, the character sheet) would need a "which region?" answer it currently doesn't have.
- **The reward scale collapses, and runs in both directions.** Web spans 1 → 300 per success with a random component; Python awards `1 + difficulty` (1–6) on success with none, and subtracts `4 - difficulty` on failure (§1.4). ✅ Revision 5's `1 +` removes the case revision 4 flagged as worst — a difficulty-0 success awarding **zero** against a failure costing **four**, on the second-most-common tier (§4.2). Every success now moves the number. Reputation is still not a monotonically accumulating career score: it is a signed balance, but one that a talentless character now holds roughly level (**+0.0125 per mission**) rather than drifting down.
- `Character.update` now seeds `reputations[region] = 1` when the character arrives somewhere unknown. ✅ That closes the `KeyError` on movement, but `gainReputation(value, region)` against an *arbitrary* named region still indexes without a default and still raises.
- The `Move` action means a character can now *choose* which region's reputation to farm. There is no travel action on the web at all, so the trade-off is new.
- ✅ **Fixed since revision 2:** `Mission.proceed` no longer credits `{self.newRegion: ...}` against an attribute that does not exist, and `Character.update` no longer iterates `reputationGained` as a dict. Both branches pass a plain signed `int`, which `update` applies to `self.region`. So "reputation belongs to where you are" is now the rule — but it is enforced by the *consumer*, not stated by the producer: an `ActionResult` cannot say which region it was earned in. The `characterRegion` parameter that `proceed` used to receive and ignore has been deleted outright (§12), so a mission no longer has any way to name one.

---

## 3. Scales: rarity and difficulty **[changed]**

| | Web | Python |
|---|---|---|
| Rarity | 8 tiers: `commun, peu_commun, rare, tres_rare, legendaire, mythique, divin, unique` | 6 tiers: `RARITIES[0..5]` = `commun, peu commun, rare, Très rare, Légendaire, Mythique` |
| Difficulty | 6 tiers: `facile, moyen, difficile, tres_difficile, epique, mythique` | 6 tiers: `DIFFICULTIES[0..5]` = `facile, normal, difficile, très difficile, extrême, impossible` |
| Alignment | Positional: difficulty *n* ↔ rarity *n*, used by `difficultyToRarity` and `evolutionChance` | Positional and intact for 0..5, but **no longer used** — nothing maps difficulty to rarity any more (§11) |

What this means for the port:

- **Python's rarity scale is exactly the web's first six tiers**, in the same order. `divin` and `unique` — the two web-only top tiers — are dropped. Since nothing in the web's *mission* pipeline can reach them (`difficultyToRarity` tops out at index 5), losing them costs only the top of the item catalog and `salePrice`'s two highest rows.
- **Rarity is now compared numerically, not by label.** ✅ `HarvestJob.work` used to pass `RARITIES[proficiency]` as a selection *tag*; it now passes the raw `proficiency` int into `LootTable.loot(…, rarity_max=…)`, which filters `item.rarity <= rarity_max`. This is both a bug fix and a genuine improvement — rarity is an ordered scale again rather than a string match, and the label casing inconsistency (`commun` vs `Très rare`) no longer has mechanical weight. `RARITIES` is now display-only.
- ✅ `variables.py` spells the constant `DIFFICULTIES`, matching every import site. The revision-1 `DIFFICULTES` mismatch is gone.
- **Difficulty labels are renamed, not renumbered.** `moyen → normal`, `epique → extrême`, `mythique → impossible`. Only `facile` and `difficile` survive verbatim. Any migration touching stored difficulty strings needs an explicit mapping table; the indices are stable, the strings are not. Note that Python indexes difficulty by **int** everywhere in the rules (`SUCCESS_THRESHOLD[d]`, `Injury.thresholds[d]`, `DIFFICULTIES_WEIGHTS`) and uses the label only in the generated mission title — the web uses the string as the key throughout.

Talent quality still loses its rarity coupling: on the web `rarityFloor` raises a talent's rarity as its quality rises (quality ≥3 → rare, ≥4 → très rare, ≥5 → légendaire), which is what makes a talent's *rank* mean something beyond its level. Python talents are `Dict[Talent, int]` — level only, and level 5 is the only rank the rules read (`nb_perfect_talents`, §1).

---

## 4. Mission generation **[changed]**

**Web** (`recherche.js` + `missionNaming.js`): draw a difficulty → pick a `missionSubject` whose `climateIds` overlap the region's `climateIds` **and** which has a tier for that difficulty → pick a `missionAction` matching that subject's `type` → draw a variation → assemble the title from five slots (`tierPrefix, variationPrefix, name, variationSuffix, tierSuffix`, behind the action's `phrase`). `tagIds` = tier tags ∪ variation tags. The batch replaces the journal wholesale; a pending quest-chain step claims one slot outright.

**Python** (`Mission.generateMission(mission_area)`) is now four lines:

```python
difficulty = choice(DIFFICULTIES_WEIGHTS)
target     = choice([m for m in BESTIARY if m.area_type == mission_area])
Mission(f"[{DIFFICULTIES[difficulty]} Chasse {target.name}]", difficulty, target, mission_area)
```

### 4.1 The double tag system is gone — one list again, sourced from the monster

Revision 1 documented `MissionTopic.missionTags` / `.lootTags` as "the structural difference to port". **That system has been deleted.** `Mission` now holds:

```python
self.loot_table = LootTable(target.getLoot())   # a concrete pool, not a tag query
self.tags       = target.getTags()              # one list, talent matching only
```

So the two axes are still separate, but they are separated **by type rather than by tag list**: talent relevance is matched against `Mission.tags`, while loot is a pool the monster *owns* outright (§11). No tag matching happens on the loot side at all for missions.

| Axis | Web | Python (rev. 1) | Python (now) |
|---|---|---|---|
| Talent relevance | `mission.tagIds` ∩ `talent.tagIds` | `mission_tags` ∩ `talent.tags` | `target.getTags()` ∩ `talent.tags` |
| Loot pool | `mission.tagIds` ∩ `lootTable.tagIds`, plus exact rarity match | `loot_tags` ∩ `lootTable.tags` | `target.getLoot()` — no query |

**What this means for the port.** The Firestore-side conclusion from revision 1 — two tag arrays on the mission document, two authoring fields, two tag pickers — no longer applies. What replaces it is smaller and more conventional: the mission document carries one `tagIds` array (as today) plus a `targetMonsterId`, and the *monster* document owns both the tag list and the loot pool. The web's `lootTables` collection becomes reachable only through harvest (§11), not through missions.

The expressiveness that revision 1 credited to the split — "a *stealth* job paying out in *alchemy* reagents" — is retained, but only at monster granularity: one monster is one (tags, loot) pairing, and you cannot give two missions against the same monster different loot.

### 4.2 Other generation differences

- **`MissionType` is deleted.** The five-type axis (escort / deliver / hunt / delve / clean) and its promised per-type consequences are gone. **All missions are hunts** — `Mission`'s own docstring says so. `Mission.newRegion`, `items_consumed`, `items_lost` and `rewards`, all declared-but-unread in revision 1, went with it. Everything §4.2 of revision 1 listed as "declared but not implemented" is now simply absent, which is a cleaner state to port from.
- **The matching key is area, not climate.** Web regions carry a *list* of `climateIds` and subjects declare which climates they fit; Python regions carry exactly one `Area`, which carries one `AreaType`. A region can no longer straddle two biomes for generation purposes. `AreaType` now has 8 members (`ville, marais, grotte, plaine, montagne, désert, ruines anciennes, volcan`) — `MOUTAIN` is a typo for `MOUNTAIN` in the member name, though its value is correct.
- **Difficulty is now weighted.** ✅ `DIFFICULTIES_WEIGHTS = [0]*25 + [1]*45 + [2]*20 + [3]*6 + [4]*3 + [5]` — a 100-entry bag giving 25 / 45 / 20 / 6 / 3 / 1 %. Revision 1's uniform `randrange(0, 6)` is gone, and the shape now resembles the web's weighted draw. **The region's own difficulty is still ignored**: `Region.difficulty` (0..5, validated at construction) is never read, so a `facile` region and an `impossible` one generate the same distribution.
- **The monster's own difficulty is ignored too.** `Monster.difficulty` exists, and `generateMission` filters `BESTIARY` on `area_type` alone — so the level-4 dragon can be drawn as a `facile` mission. Whether the monster should constrain the difficulty draw (or be drawn *from* it) is an open call.
- **Titles return to combinatorial assembly.** `f"[{DIFFICULTIES[difficulty]} Chasse {target.name}]"` — 6 difficulties × |BESTIARY| titles, in a fixed template. This reverses revision 1's "curated prose" direction entirely, and is a far thinner naming system than the web's five-slot assembly. See §9.
- **"Se renseigner" stops being an action.** Web mission generation costs the player their Interval (it's the `recherche` handler, one of eight actions). `game.py` calls `player.fillMissions()` automatically at the start of each day. The whole trade-off "spend today looking for work, or take the work you already have" disappears **[unclassified]**.
- Batch size 5 (Python default) vs. 6 (hardcoded in `recherche.js`, schema default 3) — cosmetic.
- ✅ `generateMissionBatch` is now a real `@classmethod` iterating `range(batch_size)`, and `Character.fillMissions` passes `self.region.area.type` — the revision-1 bug where the area bound to `cls` is fixed.

---

## 4b. Monsters: a new content axis **[changed]**

`monsters/` is new since revision 1 and is the replacement for the deleted topic corpus.

```python
Monster(name, difficulty, parent: Monster = None, tags = [], loots = [],
        talent_reward: Talent = None, area_type: AreaType = None)
```

`BESTIARY` is the flat catalog — currently a single dragon — and is explicitly annotated as "will be translated to a firebase database" **[not yet]**.

Three things here have no web counterpart:

- **Prototypal inheritance between content items.** `getLoot()` and `getTags()` walk `parent` and **concatenate**, so a "dragon ancien" can be declared as a child of "dragon" and inherit its tags and loot without restating them. The web's content model has exactly one analogue — `talent.ancestorIds` / `descendantIds` — and it is a *display* relationship, not an inheritance one; no web catalog composes its own fields from a parent document. Firestore has no native inheritance either, so a port has to resolve the chain at read time (or denormalise it at write time in the creator). It is a genuine authoring win and a genuine persistence cost.
- **Loot belongs to the target, not to a query.** `Monster.loots` is a concrete `List[Item]`. This is what displaces the whole loot-table matching pass for missions (§11).
- **`talent_reward`, with `hasTalentReward()` / `getTalentReward()`.** Killing a specific monster teaches a specific talent — still **declared and never read**, and as of revision 3 it is bypassed as well as ignored: `Mission.proceed` now *does* award talent progress (§4c), but through a random roll over talents the character already holds, filling `ActionResult.talentTrained` and never touching `talent_reward` or `talentsGained`. The model therefore holds three unreconciled talent-acquisition designs — the monster's deterministic grant of a *new* talent, the mission's random *levelling* of an existing one, and `Talent.unlockChild`'s tree-driven unlock (§7) — of which only the second is wired. They are not mutually exclusive: granting from the target and levelling from the roll is the split the web already makes inside `rollTalentEvolutions` (unlock vs. evolution), and is the obvious place to land.

Structurally `Monster` is the successor of `worldData/missionSubjects` (whose schema's own example name is, in fact, `"dragon"`), narrowed from "anything a mission can be about" to "a thing you hunt", and widened with a loot pool, a talent reward and parent inheritance. What it drops from `missionSubject` is the per-difficulty tier structure: a subject could carry different prefixes/suffixes/tags per difficulty tier and simply not exist at some tiers; a monster is one flat row.

---

## 4c. Talent progression on success **[changed]**

New since revision 2, and the first mechanic in the Python model that gives a mission a lasting effect beyond loot and reputation.

```python
def levelUpTalent(self, talentDict) -> List[Talent]:
    if talentDict == {}: return []
    if randrange(2) == 1:                                   # flat 50 %, once per resolution
        candidates = [t for t in talentDict
                      if any(tag in t.tags for tag in self.tags)
                      and talentDict[t] <= min(self.difficulty + 1, 4)]   # capped in rev. 4
        return [choice(candidates)]                         # exactly one
    return []
```

Called from `proceed`'s **success branch only**, returned as `ActionResult.talentTrained`, and applied by `Character.update` via `Character.levelUpTalent` (a bare `+= 1`).

**Web** (`lib/talentEvolution.js::rollTalentEvolutions`, called by `missionResolution.js` on success): every talent sharing a tag with the quest or its objective, and ranked at or below the objective's rarity, gets **its own** roll at

```
evolutionChance = clamp(5 + 10 × difficultyLevel − 5 × rankLevel, 0, 100) %
```

On a hit, `bumpTalentQuality` raises quality by 1 **capped at 5** and re-applies `rarityFloor` so rarity rises with it. Separately, catalog talents the character does *not* own, ranked strictly below the objective, roll the same chance to be **unlocked** at quality 1.

| | Web | Python |
|---|---|---|
| Roll granularity | One roll **per candidate talent** | One roll **per resolution** |
| Chance | `5 + 10×difficulty − 5×rank` — scales *up* with difficulty, *down* with the talent's rank | Flat **50 %**, independent of difficulty and of the talent's level |
| Candidate filter | shares a tag; rank ≤ objective's rarity | shares a tag; **level ≤ min(difficulty + 1, 4)** |
| How many progress | 0..n — every talent that passes its own roll | Exactly **1**, drawn uniformly |
| Unlocking new talents | Yes, at rank < objective's rarity | **No** — only talents already held |
| Ceiling | quality capped at 5, rarity re-floored | **5**, but enforced by the candidate filter alone — see below |
| Trigger | success only | success only (same) |

Three things to carry into the port:

- **Difficulty stops being the driver of progression and becomes a *gate* on it.** The web makes a hard mission more likely to teach you something; Python makes it *eligible* to teach you something and then flips a fair coin. Combined with the weighted draw (§4.2), 70 % of missions are difficulty 0–1, so the candidate window `level <= min(difficulty + 1, 4)` is usually just `level <= 1` or `<= 2` — easy missions can only train beginners, which is a coherent rule, but it arrives via a filter rather than via a curve.
- **The training window and the usefulness window barely overlap — and at the top tier they stop overlapping at all.** `checkAgainstTalent` counts a talent only when `level >= difficulty` (§1.1, difference 3); `levelUpTalent` admits it only when `level <= min(difficulty + 1, 4)`. The two comparisons are written independently, and their intersection is the whole rule:

  | difficulty | helps the roll at level | trainable at level | both |
  |---|---|---|---|
  | 0 | ≥ 0 (any) | ≤ 1 | 0, 1 |
  | 1 | ≥ 1 | ≤ 2 | 1, 2 |
  | 2 | ≥ 2 | ≤ 3 | 2, 3 |
  | 3 | ≥ 3 | ≤ 4 | 3, 4 |
  | 4 | ≥ 4 | ≤ 4 | **4 only** |
  | 5 | ≥ 5 | ≤ 4 | **none** |

  Below the window a talent trains but contributes nothing to the roll; above it, it contributes and can never be trained again at that tier. That is a genuinely interesting pressure — you must take on harder work to keep improving. But revision 4's cap makes the top of the ladder degenerate: at `impossible` the only talents that help are exactly the ones that can no longer be trained, so the tier can teach nothing at all. This is still an emergent consequence of two independently-written comparisons rather than a stated rule, and it is worth deciding whether it is the intended one.
- **The level cap is now real, but it lives in exactly one place.** ✅ `min(self.difficulty + 1, 4)` means a level-5 talent is never a candidate, so mission training tops out at exactly 5 — the cap every other rule already assumes, including `nb_perfect_talents`, which tests `== 5` exactly. Revision 3's over-training penalty (a talent pushed past 5 silently stops counting as perfect, making the character *weaker* at the top tiers) is gone. But the ceiling is enforced *solely* by this filter: `Character.levelUpTalent` is still a bare `self.talents[talent] += 1` with no guard, and `Character.canTrainTalent` (the `< 5` check) is still defined and never called — so the cap is a property of the one call site rather than of the character, and any second training path reopens the hole (§14).

*(Broken in Python — and as of revision 4 this is the model's headline defect, because the two faults below cover the success branch **between them**. `proceed` calls `levelUpTalent` first and constructs the `ActionResult` second, so one or the other always fires:*

1. *`choice(candidates)` is unguarded. The `talentDict == {}` early return covers only a character with no talents at all, so one who holds talents but none sharing a tag with the mission — or none inside the level window, which now includes anyone whose only relevant talent already sits at 5 — raises `IndexError` on roughly half of all successful missions.*
2. *On the other half the call returns, and `proceed` passes the result as `talentsTrained=` while `ActionResult`'s parameter is `talentTrained` — `TypeError: unexpected keyword argument`. With the syntax error cleared, this is no longer hypothetical.*

*Measured over 60 seeded resolutions of a difficulty-1 mission against one tag-matching level-1 talent: **all 35 successes raised, all 25 failures returned normally** (verified). The failure branch is now clean. `Mission.levelUpTalent` and `Character.levelUpTalent` also still share a name while doing different jobs — one selects, one applies.)*

---

## 5. Actions: catalog documents → classes **[changed]**

**Web**: 7 files / ~860 lines of dispatch before any rule runs — `actionCatalog`, `actionConditions`, `actionContext`, `actionKinds`, `actionLifecycle`, `actionPipeline`, `callableHandler`. An action is a Firestore document carrying `kindId` (a position in a 10-node inheritance tree) and `handlerId` (which code runs it), plus authored `availability.conditions` rows. The kind tree *injects* conditions nobody authors: `hasProfession` under Métier, `trainerReachable` under Entraînement, `professionless` under Apprentissage, `hasIntermedeBudget` under the budget kinds.

**Python**: `Action(runFunc)` with `run()` and `isVisible()`; `Mission`, `Job`, `Move` subclass it.

Consequences:

- **The condition vocabulary disappears entirely.** Eight authored predicates (`hasTalent`, `hasTalentTag`, `minReputation`, `minLegendLevel`, `profession`, `region`, `hasInstanceTag`, `notWounded`) and five injected ones collapse into a single `isVisible()` method that returns `False` by default and is overridden only by `Move`. Availability stops being data and becomes code **[unclassified]** — worth an explicit decision, since gating actions on player state is a design surface, not plumbing.
- **`kindId` vs. `handlerId` collapses into the class**, which is the intended simplification: a `HarvestJob` *is* what a Récolte action's kind used to declare it to be.
- **Inherited behaviour survives as inheritance** (`Job → ProductionJob → HarvestJob/CraftJob`), but the *implicit gates* the kind tree injected have no counterpart — nothing enforces "only a character practising this métier may run this action".
- The client/server duplication genuinely goes away. Web maintains verbatim twin copies of `actionConditions`, `actionKinds`, `actionLifecycle`, `actionCatalog`, `loot`, `trainingCost` and `salePrice` because `functions/` (CommonJS) shares no build with the Vite app. One process, one copy.

---

## 6. `ActionResult`: a uniform effect contract **[changed]**

Genuinely new, and the clearest structural improvement over the web model.

Web handlers each build their own `updates` object and write it straight to the character document — eight handlers, eight ad-hoc shapes, each restating how to add loot, bump reputation, apply talents, apply a wound. Python funnels every action through one value object:

```
itemsGained, itemsLost, talentsGained, talentsLost, talentTrained,
reputationGained, newRegion, injury, idleTime
```

…consumed by one `Character.update(action_result)`. Effects become a closed vocabulary. **Three fields left the signature since revision 2**: `reputationLost`, folded into a signed `reputationGained` (§1.4), and `questsUnlocked` / `questsEnded`, removed outright (§8). Nine fields remain, of which `update` consumes seven — everything except `injury` and `idleTime`. Four deserve attention:

- **`injury`** is an `Injury` triple rather than a severity string (§1b). It is the channel through which every action, not just missions, can hurt the character. Note that it is the *only* effect field that is not a list or a dict: it is a single optional object. ✅ It is now actually assigned in `__init__`; `Character.update` still ignores it (§1b.4).
- **`idleTime`** relocates the clock. On the web an action's duration is authored on the action type (`durationHours`, default 12) and stamped by `stampLifecycle` before the handler's output is even read. Here the *outcome* reports how long it took — so duration can depend on what happened, which the web cannot express. Nothing consumes it yet.
- **`talentTrained`** is newly *live*. `Mission.proceed` fills it and `Character.update` iterates it into `Character.levelUpTalent` (§4c) — making it the first effect field in the model whose producer and consumer are both wired. Note it is distinct from `talentsGained` (acquiring a talent) in a way the web does not separate: `rollTalentEvolutions` returns unlocks and evolutions through one list.
- **`talentsLost`** has no web counterpart. Nothing on the web can take a talent away.

*(✅ Fixed in revision 4. Revision 3 found `questsUnlocked` and `questsEnded` deleted from the parameter list but left in the body, so `__init__` assigned two names that no longer existed and **every `ActionResult(...)` call raised `NameError`** — the widest-reaching defect in the model at the time. Both assignments are gone. `ActionResult()` now returns a nine-field object with every field initialised, and the calls in `Job`, `Move` and `Quest.finish` construct cleanly (verified). `Dict` is still imported and unused — §14.)*

✅ The file was also the origin of the import cycle: `ActionResult` imported `Quest`, `Quest` imports `ActionResult` **and** `Mission`, and `Mission` imports `ActionResult`. Revision 2 called this the model's one blocking defect and proposed a `TYPE_CHECKING` guard; revision 3 found the import had gone dead once the two quest fields left the signature. **Revision 4 deletes the line.** No guard was needed, and the cycle is gone: `actions.ActionResult`, `actions.Mission`, `actions.Job`, `actions.Move`, `quests.Quest`, `player.Character`, `PNJs.PNJs` and `monsters.Monster` now all import cleanly (verified). `game` is the only module that still fails to import, and it fails on `Character.fillMissions` dereferencing a `None` region, not on anything in this file (§14).

---

## 7. Character state

**Web** (`shared/schema/character.ts`, ~35 fields) vs. **Python** (`Character`, 11 fields):

| Web | Python | Verdict |
|---|---|---|
| `reputation` (scalar) | `reputations` (per-region) | **[changed]** — §2 |
| `talents[]` (objects: quality, 8-tier rarity, `trainable`, `effect`, `tagIds`, `ancestorIds`/`descendantIds`) | `talents` (`Talent → level`), and `Talent` carries `parents` / `childrens` + `unlockChild` | **[changed]** — level and the ancestry links survive; rarity, `trainable`, `effect` and provenance do not. ✅ The tree is no longer inert on the Python side: `Talent.unlockChild(level)` returns a random child whose required level the character has reached — the web's `descendantIds` is display-only and has no such rule. It is still never *called*, and it makes a **third** unreconciled talent-acquisition path alongside `Monster.talent_reward` (§4b) and `Mission.levelUpTalent` (§4c). Note `Talent` has no `name` or id field at all, yet is used as a dict key throughout. |
| `professionId` + `professionLevel` + `knownProfessions[]` | `jobs` (`Job → level`) | **[changed]** — §10 |
| `instances` collection (per-item documents with `condition`, `acquisitionDate`, provenance text) | `inventory` (`Item → quantity`) | **[changed]** — §11 |
| `woundsLight` / `woundsSevere` / `woundsPermanent` (three flat number fields) | `health: Health` (an object with the same three counters) | **[changed]** — §1b. Same three counters, different container, different death edge case |
| `alive` (boolean field, gates every action) | — (`Health.isDead()` is derived, and only `print`s) | **[changed]** — §1b.3. Derived-vs-stored is a real Firestore decision: a stored `alive` is queryable and is what `sweepQuestTriggers` filters on |
| `missionJournal[]` | `missionJournal` | same concept |
| `knownRecipes[]` | `knownRecipes` + `learnRecipe` + `choseRecipe(tag, proficiency)` | same, **plus** a new `recipe.rarity <= proficiency` cap |
| — | `questJournal` (`Quest → step index`) | **[changed]** — §8; the web's equivalent is `questChainProgress` |
| `gold` | — | **[unclassified]** — §10 |
| `fatigue` | — | **[unclassified]** (web writes it but nothing reads it) |
| `intermedeActionsThisInterval` | — | **[unclassified]** — §10 |
| `lastActionDate` / `lastActionAt` / `lastAction` | — | **[unclassified]** — §13 |
| `triggeredSubjectIds` | — | **[unclassified]** — §8 |
| `origin` (full snapshot), `age`, `title`, `legendLevel` | — | **[unclassified]** |
| `rumorJournal`, `missionsSinceRenseignement`, `blessings`, `curses`, `inventory` | — | already dead/reserved on the web — correctly absent |

The wound rows remain the interesting ones: the shapes are close enough that the port is mostly a container decision — keep three flat number fields on the character document (queryable, matches `notWounded`'s current implementation) or nest them under a `health` map (matches Python, groups the concern). Note the web's `notWounded` condition reads all three flat fields directly, so nesting them is not free.

**Character creation is unmodelled.** `createCharacter` draws a region, an origin (which carries a starting profession, reputation, talents and items), materialises the starting instances, and validates the whole document against the Zod schema. `Character.__init__` takes an optional name, region and inventory, and seeds `reputations = {region: 1}` and `health = Health()`. Whether origins survive is **[unclassified]**. ✅ `region` now defaults to `None` so `game.py`'s bare `Character()` constructs — but `fillMissions()` immediately dereferences `self.region.area`, so the skeleton still cannot run.

---

## 8. Quests: a progression cursor → a container **[changed]**

**Web**: `worldData/questChains/items/{id}.steps = [{subjectId, difficulty}]`, plus two character fields — `questChainProgress: {chainId: stepIndex}` and `triggeredSubjectIds[]`. A successful mission matching a step bumps the cursor and pushes the next step's subject id into `triggeredSubjectIds`; a "pending" step then claims a **guaranteed slot** in the next generated batch. Separately, a scheduled sweep (`sweepQuestTriggers`, cron `0 0,12 * * *`) re-evaluates every living character against every subject carrying `trigger.conditions` and grants matches once, ever.

**Python** (`quests/Quest.py`): `Quest(missions: List[Mission], tags, itemRewards, talentReward, reputationReward: int)`, plus `getnextStep(current_step)`, `isFinished(current_step)` and `finish()` (which returns an `ActionResult` carrying the rewards). The cursor lives on the character: `Character.questJournal: Dict[Quest, int]`, driven by `getNextStepQuest` / `isQuestFinished` / `continueQuest`.

Consequences:

- A quest becomes **a bag of concrete missions with its own reward**, rather than a cursor over subject/difficulty pairs. Quests gain first-class rewards — web chains reward only through their constituent missions. ✅ `finish()` now returns `talentsGained=self.talentRewards`; revision 1's items-in-the-talents-slot bug is fixed.
- **The cursor moves from the chain to the character, and from an id map to an object map.** Web stores `questChainProgress: {chainId: stepIndex}`; Python stores `questJournal: {Quest: stepIndex}` keyed by the quest object itself. Firestore needs an id key, so the port keeps the web's shape here.
- **Steps are concrete missions, not (subjectId, difficulty) pairs.** `getnextStep` returns a fully-formed `Mission` to run directly, so a quest's missions are authored once rather than regenerated per attempt — and they bypass `generateMission`, so they can target a monster the region's `AreaType` would never draw.
- **A failed step does not advance the cursor, and nothing advances it either.** `Character.continueQuest` runs the step's mission and applies the result, then asks `isQuestFinished`, but never increments `questJournal[quest]`. Whether a failed step should retry, advance, or end the quest is undecided **[unclassified]**.
- **`questsUnlocked` / `questsEnded` have been removed from `ActionResult` entirely.** They were never filled — `continueQuest` calls `Quest.finish()` directly rather than routing through them — so the model now has **no channel at all** for "this action started or ended a quest". The web's counterpart, a subject trigger writing `triggeredSubjectIds`, is likewise absent, which leaves quest lifecycle events unmodelled on the producer *and* the consumer side. *(Their assignments were left behind in `__init__`, which is what breaks every `ActionResult` construction — §6.)*
- **Triggers disappear** **[unclassified]**: no condition-matched automatic granting, therefore no `triggeredSubjectIds`, no notification pipeline, no scheduled sweep — and, since the whole condition vocabulary is gone (§5), nothing to express a trigger *in*.
- **The forced-slot mechanic disappears** — nothing guarantees a chain's next step appears in the next batch.
- ✅ **Fixed since revision 2:** `reputationReward` is an `int` and `Character.update` now applies `reputationGained` as an `int` against the character's current region, so a quest reward no longer raises `TypeError`. The design question outlives the fix, though: a quest spanning several regions credits whichever one the character happens to be standing in when the last step resolves, because neither the quest nor the `ActionResult` can name a region (§2).

---

## 9. Narration **[scrapped]**

Web: `textGeneration.js` (241 lines) — a slot-ordered grammar over `narrativeSubjects` and `verbPhrases`, with subset-tag matching, per-slot phrase preference and French article contraction; wrapped by `missionResolution.js` with a two-level fallback over target shape (`individuel` / `groupe`) and subject pool.

What scrapping it takes with it, beyond the generator:

- Two content catalogs (`worldData/narrativeSubjects`, `worldData/verbPhrases`) and their creator screens.
- `successPhraseIds` / `failurePhraseIds` links on content.
- The `buildNarrativeContext` → `narratedEvolution` chain, which exists only so the closing sentence can name the talent that progressed — and which is why `rollTalentEvolutions` runs *before* narration in `resolveQuestOutcome`. Without narration that ordering constraint dissolves.
- The **loot provenance sentence**: every drawn item's description embeds `[Obtenue lorsque <climax clause>]`. Losing the generator means either dropping per-item provenance or sourcing the clause elsewhere. Python's `Item` has a static `description` and no per-instance record to attach provenance to anyway (§11).
- `resolveQuestOutcome`'s `narrate` flag, `defaultSuccessText` / `defaultFailureText` / `defaultSuccessClause` / `defaultFailureClause` parameters — four of its arguments exist purely for this.

Note the web had already half-retired it: `mission.js` calls the engine with `narrate: false`, so only `partirExplorer` still narrates.

**Revision 2 changes the conclusion here.** Revision 1 said flavour "moves from outcome to premise" — the authored `MissionTopic.topic` sentence would describe what the job *is*. That corpus is now deleted (§4), and the replacement is `f"[{DIFFICULTIES[d]} Chasse {monster.name}]"`. So flavour does not move; **it is currently absent from both ends**. A mission has a difficulty label, the verb "Chasse", and a monster name. Whether prose comes back as authored premise, as generated outcome, or not at all is an open call — and it is the one place where the Python model is unambiguously poorer than the web rather than differently shaped.

---

## 10. Professions → Jobs, and the economy **[changed]** / **[unclassified]**

**Web**: an *active* profession (`professionId` + `professionLevel`) distinct from historical `knownProfessions[]`, moved between by `switchKnownProfession`. Profession gates access (`hasProfession`), and `recolte.js` derives harvest quantity from `masteryLevelSum` — the sum of mastery across the action's associated professions, counting only ones the character knows. A first profession is granted by the origin at creation or by the `apprentissage` handler at a reachable trainer.

**Python**: `jobs: Dict[Job, int]`. `learnJob` grants level 1, `trainJob` caps at 5. Jobs *are* actions (`Job(Action)`).

`Job` was substantially simplified since revision 1 — the `selectionTags` machinery, and the argument-slot mess it caused, is gone:

```python
HarvestJob(name, area).work(proficiency, nb_items_harvested = 3)
    → lootTable.loot(nb_items_harvested, tag = self.name, rarity_max = proficiency)
```

Consequences:

- **The active/known split collapses** — everything known is held simultaneously. That retires `switchKnownProfession`, the `professionless` gate, and the entire `apprentissage` handler's reason to exist.
- **Proficiency changes meaning: from "how much" to "how good".** Web mastery sets `baseQuantity` (how many items a harvest yields). Python passes proficiency as a **rarity ceiling** (`item.rarity <= rarity_max`), so proficiency decides how good an item you can reach; quantity is a caller argument defaulting to a flat 3. Same for crafting via `choseRecipe`'s `recipe.rarity <= proficiency` cap. This is a real design change, not a simplification — and ✅ it is now expressed as an ordered numeric comparison rather than revision 1's rarity-label-as-tag hack.
- **The job's own name is its loot tag.** `loot(…, tag=self.name, …)` filters `tag in item.tags`, so a "Bûcheron" job draws items tagged `Bûcheron`. Simple, but it couples the job's display name to the item taxonomy — the web keeps those apart via `tagIds`.
- **Harvest loot is per-`Area`, not per-region or per-table.** `HarvestJob` snapshots `LootTable(area.getLoot())` **at construction**, so a job instance is bound to the area it was created for; moving region does not change what it harvests. Almost certainly not the intent.
- **Crafting loses its ingredient check.** `Recipe.craft()` returns `(ingredients, products)` unconditionally; there is no `hasIngredients` equivalent, so ownership is never verified. The web's deliberate consume-at-`resolve` / produce-at-`commit` split goes with the transaction that motivated it.
- **Crafting also loses its quantities.** `Recipe.ingredients` / `.products` are `Dict[Item, int]`, but they land in `ActionResult.itemsLost` / `.itemsGained`, which `Character.update` iterates as *lists* — so it walks the dict's keys and applies quantity 1 to each. A recipe consuming 3 planks consumes 1.
- **Recipe tag matching inverts.** Web filters recettes by `categoryIds` *overlap* with the action's `recipeCategoryIds` (any). `Recipe.testAgainstTags` uses `all(tag in self.tags for tag in tags)` — the recipe must carry *every* queried tag. `testAgainstTags` is currently unused; `choseRecipe` is a TODO stub returning `None`.
- **Training keeps its trainer and loses its cost** — see the new §10b. `JobTrainer` reintroduces a reachable trainer and adds a per-trainer level ceiling the web has no equivalent for; the `50 × quality` gold price and the `trainable` flag have no counterpart. In practice nothing is gated yet: `JobTrainer.canTrain` is never called, so `Character.trainJob` / `levelUpTalent` still bump a level with no prerequisites at all.
- **The whole gold economy is still absent** **[unclassified]**: `gold`, `salePrice` (fixed 8-tier table, commun 10 → unique 4 000), `trainingCost`, and the `faireDuCommerce` handler that sells an owned instance. With no gold, training has no sink and loot has no floor value. `Merchant` (§10b) is the first piece of the system to land and it is the *buy* side, where the web models only selling — but it carries a stock and no prices, so the currency question is untouched.
- **The Intermède parallel action budget is absent** **[unclassified]**: `intermedeActionsThisInterval`, capped at 3, gated by an injected `hasIntermedeBudget` condition, reset by the scheduled sweep, and — the point of it — **bypassing the main action lock entirely** (`actionPipeline.js` skips both the once-per-Interval check and the `stampLifecycle` envelope for those kinds). This is a second, parallel action economy; Python has neither it nor the primary lock it runs beside.

---

## 10b. NPCs: a new actor layer **[changed]**

`PNJs/` is new since revision 2. It is the first thing in the Python model that is neither the player, a place, nor a piece of content the player consumes — it is a *person the player deals with*, and the web has no document type for one.

```python
class PNJs:                                   # note: plural class name, single NPC
    def __init__(self, name, region: Region, type: str)

class JobTrainer(PNJs):
    def __init__(self, name, region, type, job: Job, level: int)
    def canTrain(self, job_level: int): return job_level < self.level

class Merchant(PNJs):
    def __init__(self, name, region, type, category: ItemCategory, rarity: int, inventory_size: int)
    def buildInventory(self)   # TODO: query all items where rarity <= self.rarity and
                               #       category == self.category, take inventory_size at random
    def buy(self, item: Item): self.inventory.pop(item)
```

### Against the web's trainer model

The web has **`worldData/trainerTypes`**, and the difference is exactly that word: it models the *kind* of trainer, never an individual. Reachability is a two-hop catalog join in `actionContext.js::buildReachableTrainerTypeIds` — a trainer type is reachable when its `locationId` appears in the character's region's `adventureZoneIds` — and `sEntrainer` then requires an owned, `trainable`, sub-quality-5 talent whose catalog entry's `trainerTypeId` matches the action's, plus `50 × quality` gold.

| | Web | Python |
|---|---|---|
| Granularity | A **type** of trainer (`trainerTypes` catalog) | A **named individual** (`name` field) |
| Siting | `region.adventureZoneIds` ∋ `trainerType.locationId` — two hops | `PNJs.region`, a direct reference (§12) |
| Trains | **Talents**, selected by `talent.trainerTypeId` | **Jobs** — `JobTrainer.job` is a `Job` |
| Ceiling | Flat quality 5, identical for every trainer | **Per trainer**: `job_level < self.level` |
| Cost | `50 × quality` gold | None |
| Eligibility flag | `talent.trainable` | None |
| Classification | Data (`trainerTypeId`) | `type: str`, free text |

Three of those rows are real design decisions rather than porting gaps:

- **A per-trainer level ceiling has no web counterpart at all**, and it is the most interesting thing in the package. `canTrain(job_level)` means a level-3 trainer can carry you to level 3 and no further, so advancing a job becomes a search for a better teacher rather than a purchase. Combined with per-region siting and the `Move` action (§12), "travel to where the master is" becomes a live loop — which the web, with its fixed-region characters and its flat quality-5 cap, cannot express in any form.
- **Training moved from talents to jobs.** The web trains *talents* at trainers and has no training path for professions at all; Python trains *jobs* at trainers and leaves talents to be levelled by mission luck (§4c) with no trainer, no cost and no gate. The two models have swapped which axis is taught and which is earned. Note this leaves `Character.trainJob`'s own `< 5` cap and `JobTrainer.canTrain`'s per-trainer cap as two competing ceilings, neither of which consults the other.
- **Merchants are the buy side, and the web only models the sell side.** `faireDuCommerce` sells an owned instance at a `salePrice` derived from rarity; `Merchant` holds a stock the character presumably takes from. Neither end has a price: there is still no `gold` anywhere in the Python model (§10), so nothing is exchanged for anything. `Merchant.rarity` and `.category` as *stock bounds* — this shop deals in rare weapons, that one in common ingredients — is a shape the web's flat object catalog has no equivalent for, and it is the same "ceiling, not target" rarity rule that `LootTable.loot` uses (§11).

### Wiring status

Nothing in the package is reachable. `canTrain`, `buildInventory` and `buy` are never called; neither subclass is ever instantiated; there is no `PNJS` catalog list the way `BESTIARY` and `MAP` at least exist as empty literals; `Character` has no field holding the NPCs in its region and no `trainJobWith(trainer)` — `Character.trainJob(job)` still bumps a level with no trainer, no cost and no prerequisite. `PNJs/` is also the only top-level directory without an `__init__.py` (it resolves as a namespace package on Python 3, so nothing breaks today).

*(Broken in Python: `Merchant.buy` calls `self.inventory.pop(item)`, but `inventory` is a `list` and `list.pop` takes an **index**, so passing an `Item` raises `TypeError` on every purchase. The method also only removes the item from the merchant — nothing gives it to the character, and `ActionResult` has no channel for a transaction, since it can express `itemsGained`/`itemsLost` but no counterparty and no price.)*

---

## 11. Items and loot **[changed]**

### Ownership

Web tracks ownership as one `instances` document per physical item, carrying `condition`, `acquisitionDate` and a generated provenance sentence; `character.inventory` is explicitly reserved and unused. Python is `Dict[Item, int]`.

Losing per-instance identity means two swords of the same type stop being distinguishable, so condition, provenance and per-instance sale become unrepresentable. `faireDuCommerce` sells *an instance*; there is nothing to sell in a quantity map. Note the new `Merchant.inventory` (§10b) is a third shape again — a plain `List[Item]`, neither instances nor quantities — so the model now holds two incompatible representations of "a pile of items".

`items/item_generator.py` is new and unimplemented **[not yet]**: `ItemTemplate(itemList, category, tags, recipe, alterations)` with a stub `createItems()`, plus an empty `Alteration` class. The comment states the intent — generate items *and* their recipes from one declaration, with `Alteration` presumably producing variants (a "rusty"/"fine" axis). There is no web counterpart; the web authors every object and every recette as its own document. If this lands, the port needs to decide whether templates are an authoring-time expansion (materialise the documents in the creator) or a read-time one.

### Drawing

**Web**: item count from difficulty (`facile`/`moyen` 1, `difficile`/`tres_difficile` 2, `epique`/`mythique` 3). A candidate table must match **both** a target rarity exactly (`difficultyToRarity(difficulty)`, shifted down by `rarityOffset` on failure) **and** share at least one tag with the mission's `tagIds`. One table picked per item, then an item drawn within it — uniformly, or by `itemWeights` when the table sets `weightMode: "manuelle"`. Content gaps are silently skipped.

**Python** — `LootTableSelector` is deleted; `LootTable` moved from `actions/` to `items/` and lost its `tags`:

```python
LootTable(items).loot(nb_item_looted, tag = None, rarity_max = 5)
    sample = [i for i in items if tag in i.tags and i.rarity <= rarity_max]  if tag
    sample = items                                                          otherwise
    return [choice(sample) for _ in range(nb_item_looted)]
```

Consequences:

- **Table *selection* is gone entirely.** There is no catalog of tables to match against any more — a `LootTable` is just a wrapper around a concrete item list that someone already owns (`Monster.loots` for missions, `Area.loots` for harvest). The web's `worldData/lootTables` collection, its `rarity` field, its `tagIds` overlap rule and its `weightMode` all lose their consumer on the mission path. Revision 1's **[not yet]** "database query" TODO is resolved by deletion rather than by implementation.
- **Missions apply no filtering at all.** `Mission.proceed` calls `loot(3)` on success and `loot(1)` on failure — neither passes a tag or a rarity ceiling, so the `if tag` branch never runs and the full monster pool is sampled uniformly on both branches. Only harvest uses the filter.
- **Difficulty still influences loot in no way; *outcome* now does.** Web: 1/1/2/2/3/3 items scaling with difficulty, at a rarity derived from it. Python: **3 items on success, 1 on failure**, always, from the monster's pool at any rarity. So the success/failure axis moves the count while the difficulty axis moves neither count nor quality — a `facile` mission and an `impossible` one against the same monster pay identically on identical outcomes. **This remains the clearest place where a rule was removed without a replacement, and it still needs a decision** — the natural hooks are unchanged: the monster (harder monsters own better pools, which the difficulty draw would then have to respect, §4.2) or reinstating a rarity ceiling derived from difficulty. Note `LootTable.loot` already accepts `rarity_max`, so the second hook is a one-argument change that the mission path simply does not use.
- **Rarity survives as a *ceiling*, not a target.** Where the web matched a table's rarity *exactly*, `LootTable.loot` filters `item.rarity <= rarity_max`. That is a meaningfully different rule: a maxed harvester still mostly draws common items, since the pool is unweighted and commons outnumber rarities. Exact-match guaranteed the tier; a ceiling only permits it.
- **Per-item weighting is dropped** — `weightMode` / `itemWeights` have no counterpart; every draw is uniform.
- **Failure loot is back, undegraded** ✅ **[partly not yet]** — failure yields 1 item where revision 2 recorded none, so failure is no longer pure downside (§1.4). `rarityOffset: 2` still has no counterpart: the web degrades the *rarity* of a full-size haul, Python shrinks the *count* of an undegraded one. Which lever to keep is an open call, and keeping both is coherent.
- **Mission-side item consumption is gone** — `items_consumed` / `items_lost`, declared-and-unread in revision 1, were deleted with `MissionType`. Web missions never consumed anything either, so this is a return to parity.
- `ItemCategory` (43 members) is new — web `object.type` is free text. **[not yet]** as data, but the taxonomy itself is a decision.
- *(Broken in Python: `choice(sample)` raises `IndexError` on an empty pool, and `BESTIARY`'s single monster has `loots=[]`, so every successful mission currently raises. The rarity ceiling is also unreachable without a tag, since both filters live in the same branch — `loot(3, rarity_max=2)` silently ignores the ceiling.)*

---

## 12. Movement and the world **[changed]**

**Web**: `Region` documents referencing `climatId`, `climateIds[]`, `reliefIds[]`, `factionIds[]`, `adventureZoneIds[]`, `originIds[]`, `neighbors[{regionId, direction}]` — six sibling catalogs, all id-referenced. A character's region is set at creation and **never changes**; `neighbors` is authored but nothing traverses it.

**Python**: a two-level structure, new since revision 1 —

```python
Area(name, type: AreaType, tags = [], loots: List[Item] = [])   # getLoot()
Region(name, area: Area, difficulty: int)                        # 0..5, validated; getLoot() delegates
MAP: List[Region] = []                                           # [not yet]
```

plus a first-class `Move` action returning `ActionResult(newRegion=…)`.

Consequences:

- **Travel becomes a real mechanic.** `game.py` says "The player can move to all regions for now" — so adjacency is not yet a constraint, and `Region.neighbors` has no counterpart. With per-region reputation (§2) and area-keyed mission generation (§4), *where you are* now drives both what work exists and whose regard you're building. That is a substantially different game loop from the web's fixed-region character.
- **`Area` is a new intermediate layer**, and it is where the content actually lives: tags and the harvest loot pool moved off `Region` and onto it. A region is now little more than `(name, area, difficulty)`. Whether `Area` is a shared catalog (many regions referencing one "marais" area) or a per-region document is unresolved and matters for the port — `Region.__init__` takes an `Area` instance, which reads as shared.
- **`Region.difficulty`** (renamed from `danger_level`) is validated 0..5 at construction and then never read — the same unread-input status it had in revision 1, except that generation now has a weighted distribution it could plausibly shift (§4.2).
- **The sibling catalogs collapse into `Area.tags`.** Climate, relief, faction, adventure-zone and origin references all become an untyped `List[str]` — which nothing currently reads. That loses the climate-based subject matching that drove web generation (§4), and `adventureZoneIds` — the per-region locations a mission or exploration is sited at — has no counterpart, so missions lose their `locationId`.
- **Region-locking disappears, and is now harder to restore.** Web missions carry `regionId` and refuse to resolve outside it. Python missions carry `area_type` (a terrain kind, not a place), so a mission generated in one plain is resolvable in any plain. Revision 2 noted that `proceed` at least *received* a `characterRegion` it ignored — **that parameter has since been deleted**, so a mission now has no way to learn where it is being run. Region-locking would need a new argument, not a use of an existing one. The same deletion is why reputation can only be credited to wherever the character happens to stand (§2).
- **`partirExplorer` has no counterpart** **[unclassified]** — the multi-round action that resolves `encounterCount` independent encounters against one drawn location, threading the evolving character (talents, wound state) forward between rounds and stopping on death.
- **NPCs are sited by region, not by location.** `PNJs.region` is a direct `Region` reference (§10b), where the web reaches a trainer through `region.adventureZoneIds` ∋ `trainerType.locationId` — two hops through a catalog Python does not have. With `adventureZoneIds` gone, the region is the finest granularity available to put a person at, so "the smith in the lower quarter" is not expressible; only "the smith in Ravenholm" is.
- ✅ `world/map.py` and `actions/Move.py` now use package-qualified imports and `Move` correctly subclasses `Action`. `MAP` is still empty, and there is still no NPC catalog to site anything in.

---

## 13. Persistence, authority and timing **[unclassified]**

Deliberately out of scope for a local model, but each is a *rule* on the web, not just plumbing:

- **The Interval lock.** `lastAction.completesAt` is the single source of truth for both "one action per Interval" and the countdown — one clock, not two that drift at the day boundary. `idleTime` on `ActionResult` (§6) is the seed of a replacement but nothing consumes it.
- **The acknowledgement step.** Loot is decided at `resolve()` but only becomes owned at `commit()`, once the player has seen the result pop-up — and idempotently, so closing the dialog twice can't duplicate it. Python applies everything immediately in `Character.update`.
- **`prepare` / `resolve` / `commit`**, the transaction boundary, re-reading player-mutable state inside the transaction to defeat races, and the `HttpsError` precondition vocabulary that turns every rule violation into a French player-facing message.
- **The `actionsLog` dual write** — every resolution also appends an audit document.
- **Server-authoritative rolls.** The public-repo constraint that put dice server-side in the first place has no equivalent in an in-process model.

Revision 2 recorded that the model no longer assumed a database anywhere in code, `LootTableSelector`'s query TODO having been the last such hook. **That has reversed.** `Merchant.buildInventory` (§10b) carries an explicit `## TODO have an database of all game items` and spells out a real query — filter to `rarity <= self.rarity` and `category == self.category`, then take `inventory_size` at random. It is the same shape as the deleted `LootTableSelector` TODO and the same shape as the web's `lootTables` query, which argues for solving retrieval once for all three rather than per consumer. The other **[not yet]** catalogs (`BESTIARY`, `MAP`, the enums, and the entirely absent NPC roster) remain plain in-memory literals with no retrieval story attached.

---

## 14. Consistency gaps in the Python model

Not a review request, but these decide whether the logic described above actually holds as written. **Every rule described in this document is the *intended* rule; this section is the list of places where the code does not currently express it.** Items marked ✅ were present in revision 1 and have since been fixed.

**Blocking — no successful mission can complete**

Revision 3's two blockers are both fixed, and a defect it recorded as latent has taken their place:

1. ✅ **The tree byte-compiles again.** Both missing commas in `Mission.proceed`'s `ActionResult(...)` calls are back; `python -m compileall` over `actions player quests world items monsters talents PNJs` is clean (verified).
2. ✅ **`ActionResult(...)` no longer raises `NameError`.** `__init__` stopped assigning the deleted `questsUnlocked` / `questsEnded` names; construction works and all nine fields initialise (verified).
3. ✅ **The import cycle is gone.** The dead `from quests.Quest import Quest` line is deleted from `ActionResult.py`. Every rule module imports cleanly; `game` is the only failure, and it fails on the region-`None` defect listed below (verified).
4. **Every successful `Mission.proceed` raises — the model's remaining blocker.** `levelUpTalent` runs before the `ActionResult` is built, so the two live defects in the next list cover the whole success branch between them: `IndexError` when the candidate list comes out empty, `TypeError` otherwise. Measured against a monster given a non-empty loot pool, across 60 seeded resolutions **all 35 successes raised and all 25 failures returned normally** (verified) — the success branch is unreachable, the failure branch is sound. Against the *actual* `BESTIARY`, whose single monster has `loots=[]`, both branches raise earlier still, inside `LootTable.loot` (next list). So the loot, reputation and talent-training rules of §1.4 and §4c cannot be exercised end to end today: the success path for a code reason, the failure path for a content one.

**Would raise at call time**

- `Mission.proceed` passes `talentsTrained=`, but `ActionResult`'s parameter is `talentTrained` — `TypeError: unexpected keyword argument`. Revision 3 recorded this as sitting behind the syntax error on the same line; with that cleared it is **live on every successful mission** (§4c).
- `Mission.levelUpTalent` calls `choice(candidates)` unguarded. The `talentDict == {}` early return covers only a character with *no* talents; one who holds talents but none sharing a tag with the mission — or none inside the `level <= min(difficulty + 1, 4)` window, which since revision 4 also excludes any talent already at level 5 — raises `IndexError` on roughly half of all successful missions (§4c).
- `Talent.unlockChild` has the same unguarded `choice`, over a candidate list that is empty whenever no child's required level has been reached (§7).
- `Merchant.buy` calls `self.inventory.pop(item)`; `inventory` is a `list` and `list.pop` takes an index, so every purchase raises `TypeError` (§10b).
- `LootTable.loot` calls `choice(sample)` without an empty check; `BESTIARY`'s only monster has `loots=[]`, so both mission branches raise — success at `loot(3)` and failure at `loot(1)`. This is now the *first* thing a failed mission hits, since the failure branch is otherwise clean.
- `Mission.generateMission` does `choice([m for m in BESTIARY if m.area_type == mission_area])` — `IndexError` for any of the 7 `AreaType`s the bestiary doesn't cover.
- `Character.fillMissions` dereferences `self.region.area` with `region` defaulting to `None`, so `game.py`'s `Character()` + `fillMissions()` raises. With the import cycle gone this is now the *only* thing stopping `game` from importing (verified).
- `Character.gainReputation` / `loseReputation` index `self.reputations[targetRegion]` without a default, so crediting an explicitly-named region the character has never visited raises `KeyError`. (Movement itself is safe — `update` seeds the entry. ✅)
- `world/Region.py`, `monsters/Monster.py` and `talents/Talent.py` import `Self` from `typing`, requiring Python ≥ 3.11. `Region.py` doesn't use it.

✅ Fixed since revision 3: `Mission.py`'s two missing commas (the tree byte-compiles); `ActionResult.__init__` assigning the removed `questsUnlocked` / `questsEnded` names (every construction raised `NameError`); the dead `from quests.Quest import Quest` import, and with it the whole import cycle; and talent levels running past 5, now capped by `levelUpTalent`'s `min(difficulty + 1, 4)` filter.

✅ Fixed since revision 2: the `Mission.newRegion` `AttributeError` on every resolution; `Quest.finish`'s int-in-a-dict `TypeError`; `reputationLost` existing as a second, separate reputation channel; `ActionResult.talentTrained` having no producer.

✅ Fixed since revision 1: the `DIFFICULTES`/`DIFFICULTIES` mismatch; the `RARITIES` key range; the unqualified `from Region import` / `from map import` / `from ActionResult import` imports; `Move` not subclassing `Action`; the `ProductionJob` argument-slot chain (the whole `selectionTags` mechanism is gone); `generateMissionBatch` missing `@classmethod` and iterating an int; `LootTableSelector` iterating an int (deleted); `Character()` requiring a region.

**Would raise at call time**

- `Mission.proceed` passes `talentsTrained=`, but `ActionResult`'s parameter is `talentTrained` — a `TypeError: unexpected keyword argument` sitting directly behind the syntax error on the same line (§4c).
- `Mission.levelUpTalent` calls `choice(candidates)` unguarded. The `talentDict == {}` early return covers only a character with *no* talents; one who holds talents but none sharing a tag with the mission — or none inside the `level <= difficulty + 1` window — raises `IndexError` on roughly half of all successful missions (§4c).
- `Talent.unlockChild` has the same unguarded `choice`, over a candidate list that is empty whenever no child's required level has been reached (§7).
- `Merchant.buy` calls `self.inventory.pop(item)`; `inventory` is a `list` and `list.pop` takes an index, so every purchase raises `TypeError` (§10b).
- `LootTable.loot` calls `choice(sample)` without an empty check; `BESTIARY`'s only monster has `loots=[]`, so both mission branches now raise — success at `loot(3)` and failure at `loot(1)`.
- `Mission.generateMission` does `choice([m for m in BESTIARY if m.area_type == mission_area])` — `IndexError` for any of the 7 `AreaType`s the bestiary doesn't cover.
- `Character.fillMissions` dereferences `self.region.area` with `region` defaulting to `None`, so `game.py`'s `Character()` + `fillMissions()` raises.
- `Character.gainReputation` / `loseReputation` index `self.reputations[targetRegion]` without a default, so crediting an explicitly-named region the character has never visited raises `KeyError`. (Movement itself is safe — `update` seeds the entry. ✅)
- `world/Region.py`, `monsters/Monster.py` and `talents/Talent.py` import `Self` from `typing`, requiring Python ≥ 3.11. `Region.py` doesn't use it.

**Would silently produce the wrong rule**

- `Injury.fromRollAndDiff` uses `roll < permanent` while `severe` requires `roll > permanent`, so a roll exactly equal to the permanent threshold produces **no wound at all** (§1b.1).
- `Character.update` never reads `action_result.injury` and never calls `sufferInjury`, so `self.health` is never modified and `isDead()` is always false (§1b.4). This is the only broken link left in the harm chain.
- **Talent levels are capped in one place only.** ✅ `Mission.levelUpTalent`'s filter is now `level <= min(difficulty + 1, 4)`, so it can no longer push a talent past 5 and revision 3's over-training penalty is gone. But `Character.levelUpTalent` is still a bare `+= 1` with no ceiling and `Character.canTrainTalent` (the `< 5` check) is still never called, so the cap belongs to that one call site rather than to the character (§4c, §1.1). A side effect of the new cap: at difficulty 5 the training window (`≤ 4`) and the usefulness gate (`≥ 5`) are disjoint, so the top tier can never train anything (§4c).
- `Mission.levelUpTalent` (selects a talent) and `Character.levelUpTalent` (applies the level) share a name while doing different jobs.
- `Character.update` iterates `itemsGained` / `itemsLost` as lists and applies quantity 1 per entry; `Recipe` supplies them as `Dict[Item, int]`, so crafting quantities are silently discarded (§10).
- `Monster.talent_reward` and its two accessors are never called — nothing awards a talent for a kill, and §4c's roll now covers adjacent ground by a different rule (§4b).
- `Mission.proceed`'s `characterRegion` parameter has been **deleted**, so nothing region-locks a mission and nothing currently can (§12).
- `Region.difficulty` is validated and never read; `Monster.difficulty` is set and never read (§4.2).
- `Area.tags` and `Quest.tags` are stored and never read.
- `Character.gainTalent` returns early when the talent is already held, so re-granting never levels up — `levelUpTalent` is the only path.
- **Defined and never called**: `Character.canTrainTalent`, `Character.filterTalentsAgainstTagList`, `Character.sufferInjury`, `Recipe.testAgainstTags`, `Action.isVisible`, `Monster.hasTalentReward` / `getTalentReward`, `Talent.unlockChild`, `JobTrainer.canTrain`, `Merchant.buildInventory`, `Merchant.buy`. `isVisible` returns `False` by default and only `Move` overrides it, so every other action is currently hidden.
- `HarvestJob` snapshots its `LootTable` from the `Area` passed at construction, so the job never follows the character (§10).
- `Mission.generateMission` lacks `@staticmethod`; it works via `cls.generateMission(...)` and `Mission.generateMission(...)` under Python 3 but breaks the moment it is called on an instance.
- `BASE_DICEPOOL = 4` and `BAR = 4` are dead constants left from the pre-d100 dice-pool draft.
- Mutable default arguments throughout (`Character(inventory={})`, the whole `ActionResult` signature, `Talent(tags=[], parents={}, childrens={})`, `Area(tags=[], loots=[])`, `Monster(tags=[], loots=[])`, `Quest(...)`, and both `Mission.checkAgainstTalent` / `levelUpTalent`) are shared across instances. `Monster`'s matter most: `getLoot`/`getTags` concatenate, so a mutated default would leak between every monster declared without the argument.
- `Item.id`, `Recipe.id`, `RecipeSelector.id`, `Quest.id`, `Job.id`, `Talent.nb` and `Alteration.id` are class counters that are never incremented (only `Character.id` is). `Item`, `Monster` and the three `PNJs` classes have no identity field at all, yet `Item` and `Talent` are used as dict keys and compared by tag content.
- `PNJs/` is the only top-level directory without an `__init__.py`. It resolves as a namespace package on Python 3, so nothing breaks today.
- Unused imports: `Dict` in `ActionResult.py` (✅ `Quest`, which was the entire import cycle, is gone), `randrange` and `List` in `Job.py`, `choice` in `Recipe.py`, `Enum` / `Area` / `Region` in `Mission.py`, `RARITIES` in `Item.py`, `Action` in `Character.py`, `List` in `PNJs.py`, `Self` in `Region.py`. *(Correcting revision 2, which listed `Enum` in `Item.py` and `Item`/`Talent` in `Quest.py` as unused — all three are in fact used.)*
- ✅ Also fixed since revision 1: the crossed `mission_tags`/`loot_table_tags` argument pair and the `MissionTopic`-as-`name` bug (both removed with the corpus); `Talent.talent_tags` vs `talent.tags`; the duplicate `Injury.__init__`; `ActionResult` not assigning `self.injury`; `Character.sufferInjury` passing the class; `Health.gainSevere`'s `severet` typo and its `self.light = 3`; `Mission.proceed`'s `action_resultitemsGained=`; `filterTalentsAgainstTagList`'s `tag in talent`; `loseReputation` using `+=`; `update` wiping the region unconditionally and calling `gainItem` without a quantity; `doCraftJob` calling a differently-spelled `choseRecipe`; `Quest.finish` returning items in the talents slot; `HarvestJob`'s once-evaluated `randrange` default.

---

## 15. Net direction

**Deliberately changed** — resolution keeps the web's "one d100 read twice" shape but rebuilds both readings: talents now *raise the roll* instead of *lowering the bar*, only talents at or above the mission's difficulty count, and level-5 talents buy whole difficulty-tier drops that apply to success *and* harm. Injury moves from an exact-number match to a banded range read — still one wound per resolution, as on the web, but roughly an order of magnitude more frequent. Missions become **monster hunts**: a `Monster` catalog supplies both the tag list that decides talent relevance and the concrete loot pool, replacing the web's tag-matched loot-table query. Reputation becomes a **signed** per-region relationship rather than a global career score, paying `1 + difficulty` on success and `-(4 - difficulty)` on failure — a pairing that nets to almost exactly zero across the generation distribution. Talent progression moves from a per-talent chance curve to a single 50 % coin flip gated by a level window that, since revision 4, also caps the talent at 5. Movement between regions becomes a real action, `Area` becomes the layer that owns tags and harvest loot, and **NPCs appear** as a new actor layer — a named trainer with a per-trainer level ceiling, and a merchant with a rarity- and category-bounded stock. Professions become simultaneously-held jobs whose level gates loot *rarity* rather than *quantity*. Effects move from eight ad-hoc handler payloads to one nine-field `ActionResult` vocabulary including an `injury` triple; item ownership moves from per-instance documents to a quantity map; action duration moves from catalog data to resolution output.

**Deliberately dropped** — narration generation, and with it two content catalogs, the phrase-link fields, the talent-evolution/narration ordering constraint, and per-item loot provenance. **The authored mission-topic corpus** (3 364 lines) and its interactive generator, along with the `MissionType` axis and every mechanic it was going to carry. The web's two top rarity tiers (`divin`, `unique`). Loot-table *selection* as a concept — rarity and tags no longer pick a pool, they only filter within one that a monster or an area already owns. And, new in revision 3, `questsUnlocked` / `questsEnded`: with the web's subject triggers also absent, quest lifecycle events are now unmodelled at both ends.

**Declared as not yet ported** — rarity degradation on failure loot (the count now drops, the rarity does not); the catalogs living as Python enums and literals, with `BESTIARY` holding one monster, `MAP` holding none and the NPC roster having no catalog at all; `ItemTemplate` / `Alteration` as an item-and-recipe generation scheme; and `Merchant.buildInventory`'s item database, which reinstates the retrieval hook revision 2 recorded as deleted (§13).

**Absent and unclassified — the list that needs a call**:

1. The gold economy (`gold`, `salePrice`, `trainingCost`, `faireDuCommerce`) — and therefore any cost on training. `Merchant` (§10b) now gives the *buy* side a shape, with stock bounds but no prices; the currency itself is still missing from both sides.
2. The Intermède parallel action budget, and the Interval action lock it runs beside.
3. The action lifecycle: `completesAt`, the acknowledgement step, deferred loot commit.
4. The authored condition vocabulary and, through it, subject triggers, the scheduled sweep, and the `notWounded` gate that death and injury used to feed.
5. "Se renseigner" as an action — mission generation is now free and automatic (§4).
6. `partirExplorer`: multi-round exploration with state threaded between rounds — which was also the only place wounds accumulated *within* a single action.
7. Character creation: origins, starting packages, `age`, `title`, `legendLevel`.
8. Adventure zones — missions lose their `locationId`, region adjacency (`neighbors`) is not modelled, and NPCs can therefore be sited no finer than a whole region (§12).
9. **Which of three talent-acquisition designs wins.** The model now holds `Monster.talent_reward` (deterministic grant per kill, unread), `Mission.levelUpTalent` (50 % roll levelling an owned talent, wired — §4c) and `Talent.unlockChild` (tree-driven unlock, unread). The web does the first and third inside one function, `rollTalentEvolutions`, on a difficulty- and rank-scaled curve. Only the middle one runs.
10. Region-locking of missions — and this got *harder* since revision 2: `proceed` no longer even receives the character's region (§12).
11. **Healing.** Neither model has a wound-recovery path, `permanent` is uncapped and unhealable, and at ~20 % wounds per mission Python's ladder fills far faster than the web's ~3 %. A stored `alive` flag and a death end-state are equally unmodelled — `print("GAME OVER")` is the whole of it, and `Character.update` never applies the wound anyway (§1b.4).
12. **Whether anything should still connect mission difficulty to reward.** Loot is 3 items on success and 1 on failure from the target's pool, at any rarity, regardless of difficulty — outcome moves the count, difficulty moves nothing. Reputation is now the only difficulty-linked reward, and it is signed (below).
13. **Whether the monster should constrain the difficulty draw.** `Monster.difficulty` and `Region.difficulty` both exist and are both ignored; generation draws difficulty from a global weighted bag and the target from an area filter, independently.
14. **Whether monster parent-inheritance survives the move to Firestore**, and if so whether the chain resolves at read time or is flattened by the creator (§4b).
15. **Whether a trainer should gate job training at all, and which ceiling wins.** `JobTrainer.canTrain` encodes a per-trainer level ceiling with no web equivalent, `Character.trainJob` encodes a flat `< 5` cap, neither consults the other, and nothing calls the first (§10b).
16. **Whether the reputation curve should be zero-sum, and whether it should reward climbing.** Revision 5's `1 + difficulty` success reward moved the weighted expectation from **−0.55** to **+0.0125** per mission for a talentless character — from clearly negative-sum to within 0.013 of break-even, or roughly one point per 80 missions (§1.4). Two calls follow. First, whether break-even is the *target* or a coincidence of two formulas meeting near the origin; nothing in the code states it, so it will not survive either formula being retuned. Second, the curve is now non-monotonic — +0.50 at `facile`, 0.00 at `normal`, −0.50 at `difficile` and `très difficile`, then positive again only on the two unwinnable tiers — so farming the easiest tier is the reputation-optimal play and nothing pushes a character up the ladder. Clamping the failure side with `min(0, ...)`, or re-basing it on `-(5 - difficulty)`, remain one-token changes, but they now have to be chosen against the `1 +` rather than in isolation.
17. **Where the talent ceiling should live.** ✅ Revision 4 caps mission training at 5 via `levelUpTalent`'s `min(difficulty + 1, 4)` filter, so over-training is no longer a penalty. But the cap is a property of that one call site: `Character.levelUpTalent` has no guard and `Character.canTrainTalent` is still never called, so the character object does not enforce its own invariant. The new cap also makes difficulty 5 unable to train anything at all, since its training window (`≤ 4`) and its usefulness gate (`≥ 5`) no longer intersect (§4c, §14).

The Python model is best read as **a restatement of the object model with the resolution and harm layers deliberately rebuilt, and the content layer collapsed to its smallest runnable shape**: it keeps the vocabulary (missions, tags, loot, talents, jobs, regions) and the flow (`fill journal → pick action → run → apply result`), keeps the web's single-roll/two-readings skeleton while replacing both readings, moves mission content from an authored prose corpus to a bestiary of hunt targets that own their own tags and loot, and promotes place from a backdrop to a resource. Revision 3's direction of travel was **outward into the systems earlier revisions listed as absent**: failure now pays, success now teaches, and the world now contains people to train with and buy from. **Revision 4 is the first revision that moves the wiring instead of the design.** The tree compiles, the import cycle is deleted, `ActionResult` — the contract every rule in this document flows through — can finally be constructed, and talent training acquires the ceiling the rest of the model already assumed. The runtime is closing the gap, but has not closed it: the success branch of the only implemented action still raises on every path, so a mission today can only fail — and only against a monster that has loot, which the sole entry in `BESTIARY` does not; the harm chain the document specifies so carefully is still never invoked; and every one of the new NPC methods is still unreachable.
