// results/GatherResult.jsx
export default function GatherResult({ lastAction, error, onClose, closing }) {
  return (
    <>
      <h3>{lastAction.label}</h3>

      <p className="craft-result-label">Récolté :</p>
      {lastAction.loot?.length > 0 ? (
        <ul className="instance-list">
          {lastAction.loot.map((item, index) => (
            <li key={index} className={`instance-card rarity-${item.rarity}`}>
              {item.name}
            </li>
          ))}
        </ul>
      ) : (
        <p>Rien de récolté cette fois.</p>
      )}

      {error && <p className="error">{error}</p>}

      <button type="button" onClick={onClose} disabled={closing}>
        Terminer
      </button>
    </>
  );
}