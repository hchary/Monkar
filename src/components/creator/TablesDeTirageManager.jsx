import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { RARITIES } from "./TalentsManager";
import { matchesTag } from "./TagsManager";
import { matchesObject } from "./ObjectsManager";
import { drawLootTableItemId } from "../../lib/lootTables";
import MultiSelectModalField from "./MultiSelectModalField";

// Matches a loot table's name or rarity — for use as MultiSelectModalField's matchesFilter
// (e.g. a future quest's single-select lootTableId field).
export function matchesLootTable(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (option.name || "").toLowerCase().includes(q) || (option.rarity || "").toLowerCase().includes(q);
}

function useItems(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", collectionName, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [collectionName]);
  return items;
}

function MultiSelectField({ legend, options, selectedIds, onToggle }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.length === 0 && <p>Aucun élément créé pour l'instant.</p>}
      {options.map((option) => (
        <label key={option.id}>
          <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onToggle(option.id)} />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
}

const emptyFilters = { rarities: [], tagIds: [], text: "" };
const emptyForm = { name: "", rarity: "commun", tagIds: [], itemIds: [] };

export default function TablesDeTirageManager() {
  const [tables, setTables] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [drawnTable, setDrawnTable] = useState(null);
  const [drawnItemId, setDrawnItemId] = useState(null);
  const drawDialogRef = useRef(null);

  const tags = useItems("tags");
  const objects = useItems("objects");
  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const sortedObjects = [...objects].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "lootTables", "items"), (snap) => {
      setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredTables = tables.filter((table) => {
    if (filters.rarities.length > 0 && !filters.rarities.includes(table.rarity || "commun")) return false;
    if (filters.tagIds.length > 0 && !(table.tagIds || []).some((id) => filters.tagIds.includes(id))) return false;
    if (!matchesLootTable(table, filters.text)) return false;
    return true;
  });

  function toggleFilterRarity(value) {
    setFilters((prev) => ({
      ...prev,
      rarities: prev.rarities.includes(value) ? prev.rarities.filter((r) => r !== value) : [...prev.rarities, value],
    }));
  }

  function toggleFilterTag(id) {
    setFilters((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  function startEdit(table) {
    setEditingId(table.id);
    setForm({
      name: table.name || "",
      rarity: table.rarity || "commun",
      tagIds: table.tagIds || [],
      itemIds: table.itemIds || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleTagId(id) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  function toggleItemId(id) {
    setForm((prev) => ({
      ...prev,
      itemIds: prev.itemIds.includes(id) ? prev.itemIds.filter((x) => x !== id) : [...prev.itemIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "lootTables", "items", editingId)
      : doc(collection(db, "worldData", "lootTables", "items"));

    await setDoc(ref, {
      name: form.name,
      rarity: form.rarity,
      tagIds: form.tagIds,
      itemIds: form.itemIds,
    });
    resetForm();
  }

  function drawFrom(table) {
    setDrawnTable(table);
    setDrawnItemId(drawLootTableItemId(table));
    drawDialogRef.current?.showModal();
  }

  function closeDrawDialog() {
    drawDialogRef.current?.close();
    setDrawnTable(null);
    setDrawnItemId(null);
  }

  const drawnItem = drawnItemId ? objects.find((o) => o.id === drawnItemId) : null;

  return (
    <div className="creator-section">
      <h2>Tables de tirage</h2>

      <fieldset>
        <legend>Filtres</legend>
        <MultiSelectField
          legend="Raretés"
          options={RARITIES.map((r) => ({ id: r.value, name: r.label }))}
          selectedIds={filters.rarities}
          onToggle={toggleFilterRarity}
        />
        <MultiSelectField legend="Tags" options={sortedTags} selectedIds={filters.tagIds} onToggle={toggleFilterTag} />
        <input
          placeholder="Rechercher par nom..."
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        />
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredTables.length === 0 && <li className="empty-state">Aucune table de tirage.</li>}
        {filteredTables.map((table) => (
          <li key={table.id} className="loot-table-item">
            <div className="loot-table-info">
              <strong>{table.name}</strong> — {RARITIES.find((r) => r.value === table.rarity)?.label || table.rarity}
              <div>
                Tags :{" "}
                {(table.tagIds || []).map((id) => tags.find((t) => t.id === id)?.name || id).join(", ") || "aucun"}
              </div>
              <div>{(table.itemIds || []).length} objet(s)</div>
            </div>
            <div className="loot-table-actions">
              <button type="button" onClick={() => startEdit(table)}>
                Modifier
              </button>
              <button type="button" onClick={() => drawFrom(table)}>
                Tirer
              </button>
            </div>
          </li>
        ))}
      </ul>

      <details
        className="collapsible-group"
        open={panelOpen}
        onToggle={(e) => {
          if (e.target === e.currentTarget) setPanelOpen(e.target.open);
        }}
      >
        <summary>{editingId ? "Modifier la table de tirage" : "Nouvelle table de tirage"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label>
            Rareté
            <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>
              {RARITIES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <MultiSelectModalField
            legend="Tags"
            options={sortedTags}
            selectedIds={form.tagIds}
            onToggle={toggleTagId}
            createLink={`/creator?section=${encodeURIComponent("Tag")}`}
            matchesFilter={matchesTag}
            filterPlaceholder="Filtrer par nom..."
            buttonLabel="Ajouter tags"
          />

          <MultiSelectModalField
            legend="Objets"
            options={sortedObjects}
            selectedIds={form.itemIds}
            onToggle={toggleItemId}
            createLink={`/creator?section=${encodeURIComponent("Objets")}`}
            matchesFilter={matchesObject}
            filterPlaceholder="Filtrer par nom, description ou rareté..."
            buttonLabel="Ajouter objets"
          />

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer la table"}</button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Annuler
              </button>
            )}
            {editingId && (
              <button
                type="button"
                onClick={async () => {
                  await deleteDoc(doc(db, "worldData", "lootTables", "items", editingId));
                  resetForm();
                }}
              >
                Supprimer
              </button>
            )}
          </div>
        </form>
      </details>

      <dialog
        ref={drawDialogRef}
        className="loot-draw-dialog"
        onClick={(e) => {
          if (e.target === drawDialogRef.current) closeDrawDialog();
        }}
        onClose={() => {
          setDrawnTable(null);
          setDrawnItemId(null);
        }}
      >
        <div className="loot-draw-content">
          <h4>Tirage — {drawnTable?.name}</h4>
          {drawnItem ? (
            <p>
              <Link to={`/creator?section=${encodeURIComponent("Objets")}&objectId=${drawnItem.id}`} onClick={closeDrawDialog}>
                {drawnItem.name}
              </Link>
            </p>
          ) : (
            <p className="empty-state">Cette table de tirage ne contient aucun objet.</p>
          )}
          <button type="button" onClick={closeDrawDialog}>
            Fermer
          </button>
        </div>
      </dialog>
    </div>
  );
}
