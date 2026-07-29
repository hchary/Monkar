import { useRef, useState } from "react";
import { Link } from "react-router-dom";

export function defaultMatchesFilter(option, query) {
  return option.name.toLowerCase().includes(query.toLowerCase());
}

export default function MultiSelectModalField({
  legend,
  options,
  selectedIds,
  onToggle,
  createLink,
  getTooltip,
  filterPlaceholder = "Filtrer...",
  matchesFilter = defaultMatchesFilter,
  buttonLabel = "Choisir",
}) {
  const dialogRef = useRef(null);
  const searchRef = useRef(null);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter((option) => matchesFilter(option, search));
  const selectedOptions = selectedIds.map((id) => options.find((option) => option.id === id) || { id, name: id });

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
          {buttonLabel} ({selectedIds.length})
        </button>
        {createLink && (
          <Link to={createLink} target="_blank" rel="noopener noreferrer">
            Créer
          </Link>
        )}
      </div>
      <div className="modal-select-chips">
        {selectedOptions.length === 0 && <span className="empty-state">Aucun sélectionné</span>}
        {selectedOptions.map((option) => (
          <span key={option.id} className="modal-select-chip">
            {option.name}
          </span>
        ))}
      </div>

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
              <li key={option.id} data-tooltip={getTooltip ? getTooltip(option) : undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(option.id)}
                    onChange={() => onToggle(option.id)}
                  />
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
