// results/CraftResult.jsx
export default function CraftResult({ lastAction, error, onClose, closing }) {
  return (
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
  );
}