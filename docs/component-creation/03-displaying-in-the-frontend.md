# Displaying a new component in the frontend

Prerequisite: the field exists on real character documents — see
[02-persisting-to-firestore.md](02-persisting-to-firestore.md).

## How character data reaches a component

`src/hooks/useOwnCharacter.js` subscribes to the current player's living character via
`onSnapshot` (`characters` where `ownerUid == uid` and `alive == true`) and returns
`{ character, checked }`. `character` is the raw Firestore document, spread with its `id` — there
is no normalization layer, so every field you added in doc 01 is available directly as
`character.statusList`, `character.talents`, etc., the moment it exists on the document.

This hook is called once, in `src/pages/CharacterProfile.jsx`, and `character` is passed down as a
prop through `CharacterBanner`, `CharacterTabs`, and `ActionPanel`. A new display component
receives `character` as a prop the same way — don't re-fetch or re-subscribe.

## Always read defensively

Nothing migrates old documents when you add a field. A character created before `statusList`
existed simply won't have it. Every read must tolerate absence:

```jsx
character.statusList?.length > 0
character.statusList || []
```

This mirrors how `character.talents`, `character.knownProfessions`, etc. are already read
throughout the codebase — never assume a field is present just because doc 01 says it should be.

## Where to render it

`src/components/CharacterTabs.jsx` is the character sheet's tabbed panel. Two options, depending
on complexity:

**Inline tab** (a plain list, no interaction beyond the tab click itself) — follow the existing
`"Talents"` tab as the template: add the tab name to the `TABS` array, then a matching block:

```jsx
const TABS = ["Inventaire", "Talents", "Statuts", "Métier", "Santé"];

// ...

{activeTab === "Statuts" &&
  (character.statusList?.length > 0 ? (
    <div className="status-list">
      {character.statusList.map((s, i) => (
        <div key={i} className="status-badge">{s.name}</div>
      ))}
    </div>
  ) : (
    <EmptyState text="Aucun statut actif." />
  ))}
```

`EmptyState` (`src/components/EmptyState.jsx`) is the shared empty-state atom — reuse it, don't
write a new one. Add the matching CSS (`.status-list`/`.status-badge`) to `src/index.css`, next to
`.talent-list`/`.talent-card` — there's no per-component stylesheet convention, everything lives in
that one file.

**Extracted component** (needs its own state, a form, sub-tabs, or a write action) — give it its
own file in `src/components/` (flat, no subfolder — see `InventoryTab.jsx`, `ProfessionTab.jsx`),
taking `character` as a prop, and mount it from `CharacterTabs.jsx`:

```jsx
import StatusTab from "./StatusTab";
// ...
{activeTab === "Statuts" && <StatusTab character={character} />}
```

Default to the inline form unless you already know you need the extra structure — both
`InventoryTab.jsx` and `ProfessionTab.jsx` earned their own file because of filtering/dialog logic,
not because "every tab gets a component."

## If the display needs to trigger a write

A button that changes the component's data (equip something, dismiss a status, switch a
selection) must call a Cloud Function via `httpsCallable` — never `updateDoc`/`setDoc` against
`characters` (see [02-persisting-to-firestore.md](02-persisting-to-firestore.md); it would fail
with `permission-denied` even if you tried). Follow `ProfessionTab.jsx`'s
`selectKnownProfession`:

```jsx
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

async function clearStatus(statusName) {
  const clearCharacterStatus = httpsCallable(functions, "clearCharacterStatus");
  await clearCharacterStatus({ statusName });
}
```

The `character` prop updates on its own afterward — `useOwnCharacter`'s `onSnapshot` listener picks
up the Cloud Function's write in real time, no manual refetch needed.

## Checklist

- [ ] Field read defensively (`?.`, `|| []`), never assumed present.
- [ ] Rendered from `character` passed down from `CharacterProfile.jsx` — no separate fetch.
- [ ] Placed inline in `CharacterTabs.jsx` or extracted to `src/components/XxxTab.jsx`, matching
      the complexity precedent above.
- [ ] Empty state uses `EmptyState`, styling added to `src/index.css` following the existing
      `.talent-list` naming convention.
- [ ] Any write goes through `httpsCallable`, never a direct Firestore write.
- [ ] Manually verified in the browser: the tab/section renders correctly both with and without
      data present (a fresh character vs. one that already has the field populated).
