import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { defaultMatchesFilter } from "./MultiSelectModalField";

export default function SoloSelectModalField({
  legend,
  options,
  selectedId,
  onSelect,
  // Optional: a nullable field passes this to get a "Retirer" control, since a radio list alone
  // can never go back to "nothing selected" (MonstersManager's parentId / talentRewardId).
  onClear,
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
  const selectedOption = selectedId
    ? options.find((option) => option.id === selectedId) || { id: selectedId, name: selectedId }
    : null;

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
          {buttonLabel}
        </button>
        {createLink && (
          <Link to={createLink} target="_blank" rel="noopener noreferrer">
            Créer
          </Link>
        )}
      </div>
      <div className="modal-select-chips">
        {!selectedOption && <span className="empty-state">Aucun sélectionné</span>}
        {selectedOption && <span className="modal-select-chip">{selectedOption.name}</span>}
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
                    type="radio"
                    name={`solo-select-${legend}`}
                    checked={selectedId === option.id}
                    onChange={() => onSelect(option.id)}
                  />
                  {option.name}
                </label>
              </li>
            ))}
          </ul>
          <div className="modal-select-actions">
            {onClear && selectedOption && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  dialogRef.current?.close();
                }}
              >
                Retirer
              </button>
            )}
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
