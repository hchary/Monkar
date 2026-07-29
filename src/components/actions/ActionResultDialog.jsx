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

  // An Artisanat action has its own result layout - no Succès/Échec (crafting always succeeds
  // once it starts), the recette's name in the header, and its results listed under "Résultat"
  // instead of the generic narrative/loot recap (see functions/src/actions/artisanat.js).
  const isCraft = lastAction.handlerId === "artisanat";

  return (
    <dialog ref={dialogRef} className="action-result-dialog" onCancel={(e) => e.preventDefault()}>
      <div className="action-result-content">
        {isCraft ? (
          <>
            <h3>
              {lastAction.label}
              {lastAction.recetteName && `: ${lastAction.recetteName}`}
            </h3>

            <p className="craft-result-label">Résultat :</p>
            <ul className="instance-list">
              {(lastAction.craftResults || []).map((item, index) => (
                <li key={index} className={`instance-card rarity-${item.rarity}`}>
                  {item.name}
                </li>
              ))}
            </ul>

            {error && <p className="error">{error}</p>}

            <button type="button" onClick={onClose} disabled={closing}>
              Terminer
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </dialog>
  );
}
