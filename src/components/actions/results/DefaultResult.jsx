// results/DefaultResult.jsx
export default function DefaultResult({ lastAction, showLoot, error, onClose, closing }) {
  const accent = lastAction.accent;
  const outcomeClass = accent?.kind === "difficulty" ? `difficulty-text-${accent.value}` : "";

  return (
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
  );
}