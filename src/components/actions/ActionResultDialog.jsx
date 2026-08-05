import { useEffect, useRef } from "react";
import ActionOutcome from "./ActionOutcome";
import CraftResult from "./results/CraftResult";
import GatherResult from "./results/GatherResult";
import DefaultResult from "./results/DefaultResult";

const RESULT_COMPONENTS = {
  artisanat: CraftResult,
  recolte: GatherResult,
};

// The result pop-up (R3), generalised from the quest-only dialog it replaces (F4). Not closable
// by Escape or backdrop click - "Fermer" is the only way out, since acknowledging is what commits
// the handler's deferred side effect (loot becoming Instance documents, for quests - see
// acknowledgeAction / partirEnQuete.commit).
export default function ActionResultDialog({ lastAction, showLoot, character, onClose, closing, error }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const ResultComponent = RESULT_COMPONENTS[lastAction.handlerId] ?? DefaultResult;

  return (
    <dialog ref={dialogRef} className="action-result-dialog" onCancel={(e) => e.preventDefault()}>
      <div className="action-result-content">
        <ResultComponent
          lastAction={lastAction}
          showLoot={showLoot}
          character={character}
          error={error}
          onClose={onClose}
          closing={closing}
        />
      </div>
    </dialog>
  );
}
