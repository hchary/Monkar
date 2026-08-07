# Manual test scenarios — done roadmap items

One scenario per roadmap item currently marked `done` in [docs/TODO.md](TODO.md)'s Roadmap table,
to enact by hand in the deployed app. Roadmap items that share one underlying feature (e.g. a
"spec" row and its paired "implementation" row) are covered by a single scenario — the roadmap `#`
each scenario verifies is noted in its heading.

Unless stated otherwise, steps are performed as a signed-in **player**, on your own character.
Steps under "Setup" that touch `worldData/*` catalogs need the **creator** dashboard; a few need
direct Firestore console edits, called out explicitly (no creator UI exists for those fields yet).

The `[TEST] Avancer le temps d'un Interval` button at the top of the action panel backdates the
running action so it completes immediately and frees the character to act again — nearly every
scenario below leans on it to avoid actually waiting 12h.

## 1 — Mission and quest resolution algorithm (score & wound) — roadmap #1

**Setup**: none beyond an existing character with a mission in their journal (see scenario 5) or an
exploration location available. "Partir en quête" is retired (docs/TODO.md "Retiring quests and
quest objectives for the subject-action system") — use "Mission" or "Partir explorer" instead.

**Steps**:
1. Start "Mission" (from your journal — see scenario 5) or "Partir explorer".
2. Click `[TEST] Avancer le temps d'un Interval`.
3. Open the result pop-up.
4. Repeat a handful of times.

**Expected**:
- Outcomes vary — you see both "Succès" and "Échec", not an always-success result.
- A failed mission still lists a "Butin obtenu" fieldset (loot, at visibly lower rarity than a
  success would give for the same objective).
- Occasionally a wound is inflicted (visible in the "Résolution" fieldset — see scenario 2) and,
  on a severe enough hit, `woundsLight`/`woundsSevere`/`woundsPermanent` on the character sheet
  increases.
- Reputation increases only on success.

## 2 — Mission resolution result pop-up — roadmap #2

**Setup**: none.

**Steps**:
1. Run a "Mission" or "Partir explorer" action to completion (as in scenario 1).
2. Open the result pop-up.

**Expected**: a "Résolution" fieldset is present, separate from "Butin obtenu", showing:
- The rolled score and the success threshold it was compared against.
- Any wound inflicted, plus your character's current wound counters.
- Reputation gained (shown only when positive).

## 3 — Aventure mission launch UX polish — roadmap #3

**Setup**: perform a "Rumeur" action first (scenario 5) so `character.missionJournal` has at
least one entry.

**Steps**: open the Aventure tab.

**Expected**: your pending missions appear inside a titled `<fieldset>` labelled
"Missions en cours" — visually distinct from "Partir explorer" and "Rumeur", not a bare list.

## 4 — Interval (12h action cycle) — roadmap #4

**Setup**: none.

**Steps**:
1. Look at the action panel headings.
2. Start any action and check its countdown.

**Expected**:
- Headings read "Action de l'Interval" and "Dernier Interval" (not "…du jour"/"…de la veille").
- The debug button reads `[TEST] Avancer le temps d'un Interval`.
- A freshly started action with no custom `durationHours` counts down from **12h**, not 24h.

## 5 — Rumor and mission system — roadmap #5, #6

**Setup**: none, beyond at least one authored `worldData/rumors/items` entry whose
`originRegionIds` includes your character's region (creator → "Rumeurs" tab).

**Steps**:
1. Start the "Rumeur" action (Aventure tab) and advance time.
2. Open the result pop-up, then check the character's "Rumeurs" tab and the Aventure tab's
   mission list.

**Expected**:
- `character.missionJournal` now holds up to 3 new missions (overwriting any unclaimed ones from
  before).
- Any region rumor sighting at "rare" rarity or above was harvested into `character.rumorJournal`
  (visible in the "Rumeurs" character tab).
- The rumor banner at the bottom of the screen shows sightings rare-or-above for your current
  region.
- Running a "Mission" from the journal resolves through the same score/wound/loot pipeline as a
  quest (scenario 1), then disappears from the journal.

## 6 — Quest triggers and end-of-action pop-up pages — roadmap #7, #8

**Setup**: in the Firestore console, add a `trigger` field to a mission Subject your character
hasn't already triggered (`worldData/missionSubjects/items/{id}.trigger.conditions`) matching
something your character satisfies (e.g. a minimum reputation you already have). No creator UI for
this field — console only. (Renamed from `worldData/quests/items/{id}.trigger` by docs/TODO.md
"Retiring quests and quest objectives for the subject-action system".)

**Steps**:
1. Wait for (or manually invoke) the scheduled `sweepQuestTriggers` function — it runs at 00:00
   and 12:00 UTC.
2. Perform any action and open its result pop-up.
3. Page through the dialog (numbered pages).

**Expected**:
- Page 2 ("Sujets débloqués") appears and lists the newly triggered mission Subject — only shown
  once per browser (tracked in `localStorage`), and only when there's something new.
- Page 3 exists (a "received messages" placeholder) even though nothing populates it yet.
- "Fermer" closes the dialog from any page.

## 7 — Trainers, and training-driven talent quality-up ("s'entraîner") — roadmap #9, #10

**Setup**:
- Creator: a `worldData/trainerTypes/items` entry with a `locationId` inside your character's
  current region's `adventureZoneIds`.
- Creator: a talent your character owns, marked "Entraînable" with that trainer type selected
  (`trainerTypeId`).

**Steps**:
1. Go to the Intermède tab → "Entraînement" — it should be available (reachability gate met).
2. Pick the trainable talent via the talent picker and start the action.

**Expected**:
- The action is unavailable if your character can't reach the trainer's location (test by
  temporarily changing your character's region).
- On success: no roll, it always succeeds if reachable/owned/affordable; the talent's `quality`
  increases by exactly 1, `character.gold` decreases by `50 × talent.quality` (pre-training
  quality), and rarity auto-upgrades if the new quality crosses a threshold (e.g. reaching quality
  3 bumps a "commun"/"peu commun" talent's rarity floor to "rare").
- If gold is insufficient, the action is blocked with a precondition error.

## 8 — Profession initial assignment via quest/trainer — roadmap #11

**Setup**: a professionless character (`professionId` unset — easiest via a fresh character
whose origin has no linked profession), and a trainer type whose linked profession's
`trainerTypeIds` includes it, reachable from your region.

**Steps**: go to the Intermède/Entraînement tab, find the "Apprentissage" action, pick a
profession from the picker, start it.

**Expected**:
- Only professionless characters see this action (the implicit `professionless` condition gates
  it).
- Only professions actually taught at that trainer type appear in the picker.
- On success: `professionId` is set, `professionLevel` is 1, `knownProfessions` gains an entry,
  and the legacy `character.profession` string is updated too. The "Métier" tab now shows the new
  profession's name/description/actions.

## 9 — Trainer type creation page — description field — roadmap #12

**Setup**: none.

**Steps**: creator → "Types d'entraîneur" tab → create or edit a trainer type, fill in the
"Description" textarea (e.g. "Maître d'armes").

**Expected**: the description is saved and shown under the trainer type's name in the list.

## 10 — Tag system unification (tagIds vs free-text tags) — roadmap #13

**Setup**: none.

**Steps**: creator → "Objectifs de quête" (narrative subjects) and "Phrases-verbes" sections —
open the tag picker on each.

**Expected**:
- Both use the same `worldData/tags/items`-backed multi-select (`MultiSelectModalField`) as
  quests/objects/loot tables/talents — no free-text tags field remains on either form.
- The reserved "objectif de quête" tag is force-injected on every quest objective and does **not**
  appear as a togglable option in that form's own tags picker.

## 11 — Location tags — roadmap #14

**Setup**: none.

**Steps**: creator → "Lieux de quête" → edit a location, open its tags picker, pick a couple of
tags, save.

**Expected**: the tags are saved and shown as chips on the location's list row. (They aren't
consumed by narration yet, but they do gate encounter content for "Partir explorer" — see
scenario 13.)

## 12 — Aventure exploration mechanics ("Partir explorer") — roadmap #15, #16

**Setup**: creator → an action type with `kindId: aventure`, `handlerId: partirExplorer`, and
`encounterCount` set to something greater than 1 (e.g. 3). Your character's region needs at least
one location in `adventureZoneIds`.

**Steps**:
1. Start "Partir explorer" from the Aventure tab, advance time.
2. Open the result pop-up.

**Expected**:
- A "Rencontres" fieldset lists one row per round (up to `encounterCount`), each with its own
  difficulty, score/threshold, and wound outcome.
- "Butin obtenu" and "Amélioration de talent" (if any) are flattened across all rounds into the
  same fieldsets used elsewhere.
- If a round's wound would kill the character, the run stops early — fewer rounds are listed than
  `encounterCount`.
- If the location has `tagIds` (scenario 11), encounters are filtered to matching objectives; with
  none, the pool is unfiltered.

## 13 — Intermède actions ("Faire du commerce") — roadmap #17, #18

**Setup**: own at least one `instances/{id}` document (an inventory item — e.g. quest loot from
an earlier run).

**Steps**:
1. Go to the Intermède tab → "Faire du commerce", available even while your main action is still
   counting down.
2. Pick an owned instance, sell it.
3. Repeat 3 times in the same Interval.

**Expected**:
- The instance disappears from your inventory and `character.gold` increases by the fixed
  per-rarity price (commun 10 … unique 4000).
- The "X/3 restantes cet Interval" indicator decrements each time and the action becomes
  unavailable after the 3rd sale, without touching your main action's own lock/countdown.
- Selling an object of rarity "mythique" or higher creates a new rumor sighting at your current
  region only (visible in the rumor banner), skipping normal hop-by-hop propagation.
