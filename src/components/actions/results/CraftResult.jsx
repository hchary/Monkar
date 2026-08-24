// results/CraftResult.jsx
//
// Produced items arrive on `lastAction.loot`, the one channel every action granting an item now
// writes through (docs/TODO.md "ActionResult and the single applier"). `craftResults` is the
// pre-change name, read as a fallback so a craft still running when that deployed still shows what
// it made.
export default function CraftResult({ lastAction, error, onClose, closing }) {
  return (
    <>
      <h3>
        {lastAction.label}
        {lastAction.recetteName && `: ${lastAction.recetteName}`}
      </h3>

      <p className="craft-result-label">Résultat :</p>
      <ul className="instance-list">
        {(lastAction.loot || lastAction.craftResults || []).map((item, index) => (
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