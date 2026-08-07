// results/DefaultResult.jsx
import ActionOutcome from "../ActionOutcome";

export default function DefaultResult({ lastAction, showLoot, character, error, onClose, closing }) {
  const accent = lastAction.accent;
  const outcomeClass = accent?.kind === "difficulty" ? `difficulty-text-${accent.value}` : "";

  return (
    <>
      <h3>{lastAction.label}</h3>
      <p className={`outcome ${outcomeClass}`.trim()}>{lastAction.success ? "Succès" : "Échec"}</p>

      <ActionOutcome lastAction={lastAction} showLoot={showLoot} character={character} />

      {error && <p className="error">{error}</p>}

      <button type="button" onClick={onClose} disabled={closing}>
        Fermer
      </button>
    </>
  );
}