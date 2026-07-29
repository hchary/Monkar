// results/GatherResult.jsx
export default function GatherResult({ lastAction, error, onClose, closing }) {
  return (
    <>
      <h3>{lastAction.label}</h3>

      <p className="craft-result-label">Récolté :</p>
      <ul className="instance-list">
        {(lastAction.gatherResults || []).map((item, index) => (
          <li key={index} className={`instance-card rarity-${item.rarity}`}>
            {item.name}
            {item.quantity > 1 && ` ×${item.quantity}`}
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