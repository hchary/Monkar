import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import CraftResult from "./results/CraftResult";
import GatherResult from "./results/GatherResult";
import DefaultResult from "./results/DefaultResult";

const RESULT_COMPONENTS = {
  artisanat: CraftResult,
  recolte: GatherResult,
};

// Which worldData/missionSubjects/items ids this character's result pop-up has already shown on
// its "newly triggered Subjects" page, kept client-side (see character.triggeredSubjectIds's own
// description in shared/schema/character.ts for why: the sweep only ever grows that list, it
// never distinguishes "seen" from "unseen"). Scoped per character so switching characters (e.g.
// after death) doesn't inherit another character's shown set.
function loadShownTriggeredSubjectIds(characterId) {
  try {
    const raw = localStorage.getItem(`shownTriggeredSubjects:${characterId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markTriggeredSubjectsShown(characterId, subjectIds) {
  if (!subjectIds.length) return;
  const shown = loadShownTriggeredSubjectIds(characterId);
  for (const id of subjectIds) shown.add(id);
  try {
    localStorage.setItem(`shownTriggeredSubjects:${characterId}`, JSON.stringify([...shown]));
  } catch {
    // localStorage unavailable (private mode, quota) - the Subject just stays "new" next time.
  }
}

// The result pop-up (R3), generalised from the quest-only dialog it replaces (F4). Not closable
// by Escape or backdrop click - "Fermer" is the only way out, since acknowledging is what commits
// the handler's deferred side effect (loot becoming Instance documents, for quests - see
// acknowledgeAction / mission.commit).
//
// Paginated (docs/TODO.md "Quest triggers and end-of-action pop-up pages"): page 1 is the current
// action's result (unchanged), page 2 lists mission Subjects the scheduled trigger sweep has
// granted since this dialog last showed them (only present when there are any), page 3 is a
// reserved, always-present placeholder for a messaging feature that doesn't exist yet. Paging is
// optional browsing - "Fermer" closes the dialog from any page.
export default function ActionResultDialog({ lastAction, showLoot, character, onClose, closing, error }) {
  const dialogRef = useRef(null);
  const [page, setPage] = useState(1);
  // Frozen at mount so a trigger sweep landing while the dialog is already open doesn't shuffle
  // page 2 out from under the player mid-read.
  const [pendingSubjectIds] = useState(() => {
    const shown = loadShownTriggeredSubjectIds(character.id);
    return (character.triggeredSubjectIds || []).filter((id) => !shown.has(id));
  });
  const [triggeredSubjects, setTriggeredSubjects] = useState([]);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (pendingSubjectIds.length === 0) return;
    let cancelled = false;
    Promise.all(pendingSubjectIds.map((id) => getDoc(doc(db, "worldData", "missionSubjects", "items", id)))).then((snaps) => {
      if (cancelled) return;
      setTriggeredSubjects(snaps.filter((snap) => snap.exists()).map((snap) => ({ id: snap.id, ...snap.data() })));
    });
    return () => {
      cancelled = true;
    };
  }, [pendingSubjectIds]);

  function handleClose() {
    markTriggeredSubjectsShown(character.id, pendingSubjectIds);
    onClose();
  }

  const ResultComponent = RESULT_COMPONENTS[lastAction.handlerId] ?? DefaultResult;
  const hasSubjectsPage = triggeredSubjects.length > 0;

  return (
    <dialog ref={dialogRef} className="action-result-dialog" onCancel={(e) => e.preventDefault()}>
      <div className="action-result-content">
        <nav className="action-result-pages">
          <button type="button" onClick={() => setPage(1)} disabled={page === 1}>
            Résultat
          </button>
          {hasSubjectsPage && (
            <button type="button" onClick={() => setPage(2)} disabled={page === 2}>
              Sujets débloqués
            </button>
          )}
          <button type="button" onClick={() => setPage(3)} disabled={page === 3}>
            Messages
          </button>
        </nav>

        {page === 1 && (
          <ResultComponent
            lastAction={lastAction}
            showLoot={showLoot}
            character={character}
            error={error}
            onClose={handleClose}
            closing={closing}
          />
        )}

        {page === 2 && hasSubjectsPage && (
          <>
            <h3>Nouveaux sujets de mission</h3>
            <ul>
              {triggeredSubjects.map((subject) => (
                <li key={subject.id}>{subject.name}</li>
              ))}
            </ul>
            {error && <p className="error">{error}</p>}
            <button type="button" onClick={handleClose} disabled={closing}>
              Fermer
            </button>
          </>
        )}

        {page === 3 && (
          <>
            <h3>Messages</h3>
            <p>Aucun message pour le moment.</p>
            {error && <p className="error">{error}</p>}
            <button type="button" onClick={handleClose} disabled={closing}>
              Fermer
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
