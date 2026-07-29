import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { defaultMatchesFilter } from "./MultiSelectModalField";

// Like MultiSelectModalField, but each selected option carries a quantity
// (entries: [{ objectId, qty }]) instead of being a plain id array.
export default function QuantitySelectField({
  legend,
  options,
  entries,
  onToggle,
  onQtyChange,
  createLink,
  filterPlaceholder = "Filtrer...",
  matchesFilter = defaultMatchesFilter,
  buttonLabel = "Choisir",
}) {
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const [search, setSearch] = useState("");

  const selectedIds = entries.map((entry) => entry.objectId);
  const filteredOptions = options.filter((option) => matchesFilter(option, search));

  function open() {
    setSearch("");
    dialogRef.current?.showModal();
    searchRef.current?.focus();
  }

  return (
    <div className="modal-select-field">
      <div className="modal-select-header">
        <span>{legend}</span>
        <button type="button" onClick={open}>
          {buttonLabel} ({entries.length})
        </button>
        {createLink && (
          <Link to={createLink} target="_blank" rel="noopener noreferrer">
            Créer
          </Link>
        )}
      </div>
      <ul className="quantity-select-chips">
        {entries.length === 0 && <li className="empty-state">Aucun sélectionné</li>}
        {entries.map((entry) => {
          const option = options.find((o) => o.id === entry.objectId);
          const optionName = option?.name || entry.objectId;
          return (
            <li key={entry.objectId} className="quantity-select-chip">
              <span>{optionName}</span>
              <input
                type="number"
                min="1"
                value={entry.qty}
                onChange={(e) => onQtyChange(entry.objectId, Math.max(1, Number(e.target.value) || 1))}
              />
              <button type="button" onClick={() => onToggle(entry.objectId)} aria-label={`Retirer ${optionName}`}>
                ×
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        className="modal-select-dialog"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="modal-select-content">
          <h4>{legend}</h4>
          <input
            ref={searchRef}
            type="text"
            placeholder={filterPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="modal-select-list">
            {filteredOptions.length === 0 && <li className="empty-state">Aucun élément.</li>}
            {filteredOptions.map((option) => (
              <li key={option.id}>
                <label>
                  <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onToggle(option.id)} />
                  {option.name}
                </label>
              </li>
            ))}
          </ul>
          <div className="modal-select-actions">
            {createLink && (
              <Link to={createLink} target="_blank" rel="noopener noreferrer">
                Créer un nouvel élément
              </Link>
            )}
            <button type="button" onClick={() => dialogRef.current?.close()}>
              Fermer
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
