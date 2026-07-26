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
- **Hover interaction**: highlight the talent rectangle on hover, with a tooltip showing the date obtained, the circumstances (which action/quest granted or last improved it), and its effect description. Example: `[Résistance au feu 1] [Vos chances de succès lors de quêtes vous confrontant aux flammes...]` (bracketed name+quality, then the effect text) — effect text and talent names are in-game content, written in French.

**Data model implications**: `character.talents` needs to move from `[string]` to something like:
```
talents: [{
  name: string,          -- e.g. "Résistance au feu", French
  quality: number,       -- 1-5
  trainable: boolean,
  rarity: "commun" | "peu_commun" | "rare" | "tres_rare" | "legendaire" | "mythique" | "divin" | "unique",
  obtainedAt: string,    -- date
  obtainedFrom: string,  -- narrative circumstance, e.g. which action/quest granted it
  effect: string,        -- French, shown in the tooltip
}]
```
`tier.talentGain` in `worldData/actionTypes/items/{id}` and the creator dashboard's `ActionTypesManager.jsx` tier editor would need to gain fields for rarity/trainable/effect when granting a talent, and a new mechanic for "quality-up" rolls on existing talents (both from training and from talent-relevant quests) needs designing — not yet specified how a quest determines it's "relevant" to a given talent.

Not implemented yet — `CharacterTabs.jsx`'s Talents tab currently just lists plain strings.
