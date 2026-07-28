import { useEffect, useRef } from "react";
import ActionOutcome from "./ActionOutcome";

// The result pop-up (R3), generalised from the quest-only dialog it replaces (F4). Not closable
// by Escape or backdrop click - "Fermer" is the only way out, since acknowledging is what commits
// the handler's deferred side effect (loot becoming Instance documents, for quests - see
// acknowledgeAction / partirEnQuete.commit).
export default function ActionResultDialog({ lastAction, showLoot, onClose, closing, error }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const accent = lastAction.accent;
  const outcomeClass = accent?.kind === "difficulty" ? `difficulty-text-${accent.value}` : "";

  return (
    <dialog ref={dialogRef} className="action-result-dialog" onCancel={(e) => e.preventDefault()}>
      <div className="action-result-content">
        <h3>
          {lastAction.label}
          {lastAction.quest && ` — ${lastAction.quest.name}`}
        </h3>
        <p className={`outcome ${outcomeClass}`.trim()}>{lastAction.success ? "Succès" : "Échec"}</p>

        <ActionOutcome lastAction={lastAction} showLoot={showLoot} />

        {error && <p className="error">{error}</p>}

        <button type="button" onClick={onClose} disabled={closing}>
          Fermer
        </button>
      </div>
    </dialog>
  );
}
