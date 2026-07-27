import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, doc, deleteDoc, setDoc, onSnapshot, getDocs, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { RARITIES } from "./TalentsManager";
import { matchesTag } from "./TagsManager";
import MultiSelectModalField from "./MultiSelectModalField";

// Matches an object's name, description, or rarity — for use as MultiSelectModalField's
// matchesFilter (e.g. a future Instance manager picking from this catalog).
export function matchesObject(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    (option.name || "").toLowerCase().includes(q) ||
    (option.description || "").toLowerCase().includes(q) ||
    (option.rarity || "").toLowerCase().includes(q)
  );
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
const emptyForm = { name: "", description: "", rarity: "commun", tagIds: [] };

export default function ObjectsManager() {
  const [objects, setObjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const tags = useItems("tags");
  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "objects", "items"), (snap) => {
      setObjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Deep link from other managers (e.g. a loot table draw) straight to an object's edit form.
  useEffect(() => {
    const objectId = searchParams.get("objectId");
    if (!objectId) return;
    const target = objects.find((o) => o.id === objectId);
    if (!target) return;
    startEdit(target);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("objectId");
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, searchParams]);

  const filteredObjects = objects.filter((object) => {
    if (filters.rarities.length > 0 && !filters.rarities.includes(object.rarity || "commun")) return false;
    if (filters.tagIds.length > 0 && !(object.tagIds || []).some((id) => filters.tagIds.includes(id))) return false;
    if (!matchesObject(object, filters.text)) return false;
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

  function startEdit(object) {
    setEditingId(object.id);
    setForm({
      name: object.name || "",
      description: object.description || "",
      rarity: object.rarity || "commun",
      tagIds: object.tagIds || [],
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

  async function handleDelete(objectId) {
    const referencingTables = await getDocs(
      query(collection(db, "worldData", "lootTables", "items"), where("itemIds", "array-contains", objectId))
    );
    await Promise.all(
      referencingTables.docs.map((tableDoc) =>
        updateDoc(tableDoc.ref, { itemIds: (tableDoc.data().itemIds || []).filter((id) => id !== objectId) })
      )
    );
    await deleteDoc(doc(db, "worldData", "objects", "items", objectId));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "objects", "items", editingId)
      : doc(collection(db, "worldData", "objects", "items"));

    await setDoc(ref, {
      name: form.name,
      description: form.description,
      rarity: form.rarity,
      tagIds: form.tagIds,
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Objets</h2>

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
          placeholder="Rechercher par nom ou description..."
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        />
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredObjects.length === 0 && <li className="empty-state">Aucun objet.</li>}
        {filteredObjects.map((object) => (
          <li key={object.id}>
            <strong>{object.name}</strong> — {RARITIES.find((r) => r.value === object.rarity)?.label || object.rarity}
            <div>{object.description}</div>
            <div>
              Tags :{" "}
              {(object.tagIds || []).map((id) => tags.find((t) => t.id === id)?.name || id).join(", ") || "aucun"}
            </div>
            <button type="button" onClick={() => startEdit(object)}>
              Modifier
            </button>
            <button type="button" onClick={() => handleDelete(object.id)}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <details className="collapsible-group" open={panelOpen} onToggle={(e) => setPanelOpen(e.target.open)}>
        <summary>{editingId ? "Modifier l'objet" : "Nouvel objet"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
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

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer l'objet"}</button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </details>
    </div>
  );
}
