# Planned features / backlog

Design notes for features that aren't implemented yet. Not a task tracker for in-progress work — see the session's task list for that. Add new entries here when a feature is decided but not yet built.

## Expanded talent system

Currently `character.talents` is a flat array of strings (just the talent name), granted via `tier.talentGain` in `performAction`. This needs to become an array of richer objects to support:

- **Quality**: a value from 1 to 5 (e.g. "Résistance au feu 3").
- **Trainable flag**: a talent can be marked trainable (shown with an asterisk in the name, e.g. "Résistance au feu*"). Only trainable talents can improve through training; others only improve via a lucky roll on a quest that specifically showcases that talent.
- **Quality progression**: trainable talents increase in quality through the "s'entraîner" action (deterministically or via a training-specific roll — not yet decided); any talent can also increase in quality via a random roll on quests relevant to it (e.g. a fire-themed quest rolling well could bump "Résistance au feu").
- **Rarity**: each talent has a rarity tier, shown as a colored border around a rectangle (background stays the same color as the rest of the UI — only the border changes):
  - Commun → white
  - Peu commun → green
  - Rare → blue
  - Très rare → purple
  - Légendaire → orange
  - Mythique → red
  - Divin → black
  - Unique → multicolor (gradient border)
- **Hover interaction**: highlight the talent rectangle on hover, with a tooltip made of three bracketed segments — name+quality, effect, then the date and circumstance of the *most recent* change (initial grant, or last quality-up — the circumstance is overwritten each time the talent evolves, it's not a history log). Example at grant:
  `[Résistance au feu 1][Augmente vos chances de succès lors de quêtes vous confrontant aux flammes][Obtenu le 12/03 en bravant le souffle ardent du terrible Syrphax]`
  Example after a later quality-up (the whole third segment is replaced, not appended to):
  `[Résistance au feu 2][Augmente vos chances de succès lors de quêtes vous confrontant aux flammes][Obtenu le 19/03 en travaillant 7 jours et 7 nuits dans les forges de la déesse des volcans]`
  All bracketed text is in-game content, written in French.
- **Rarity auto-upgrade from quality**: rarity isn't purely fixed at grant time — reaching a quality threshold bumps it up if it's currently lower (never downgrades it): quality 3 → at least "rare", quality 4 → at least "très rare", quality 5 → at least "légendaire". A talent can still be granted at a higher rarity than its quality would imply (e.g. a "mythique" talent starting at quality 1) — these thresholds only guarantee a floor, they don't cap it.

**Data model implications**: `character.talents` needs to move from `[string]` to something like:
```
talents: [{
  name: string,          -- e.g. "Résistance au feu", French
  quality: number,       -- 1-5
  trainable: boolean,
  rarity: "commun" | "peu_commun" | "rare" | "tres_rare" | "legendaire" | "mythique" | "divin" | "unique",
  effect: string,        -- French, shown in the tooltip's 2nd bracket
  lastChangeDate: string,        -- date of the most recent grant or quality-up
  lastChangeCircumstance: string, -- French, narrative reason for that change; overwritten on each change, not accumulated
}]
```
`tier.talentGain` in `worldData/actionTypes/items/{id}` and the creator dashboard's `ActionTypesManager.jsx` tier editor would need to gain fields for rarity/trainable/effect when granting a talent, and the rarity-floor bump above needs to be applied wherever quality increases. Still open: the exact training mechanic (deterministic vs. a training-specific roll) and how a quest determines it's "relevant" to a given talent for the random quality-up roll on quests.

Not implemented yet — `CharacterTabs.jsx`'s Talents tab currently just lists plain strings.
