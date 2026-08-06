import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { matchesTag } from "./TagsManager";
import MultiSelectModalField from "./MultiSelectModalField";

const emptyForm = { name: "", description: "", tagIds: [] };

export default function QuestLocationsManager() {
  const [locations, setLocations] = useState([]);
  const [tags, setTags] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "adventureZones", "items"), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "tags", "items"), (snap) => {
      setTags(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  function toggleTagId(id) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  const filteredLocations = locations.filter((location) => {
    const q = filterText.toLowerCase();
    return !q || (location.name || "").toLowerCase().includes(q) || (location.description || "").toLowerCase().includes(q);
  });

  function startEdit(location) {
    setEditingId(location.id);
    setForm({ name: location.name || "", description: location.description || "", tagIds: location.tagIds || [] });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "adventureZones", "items", editingId)
      : doc(collection(db, "worldData", "adventureZones", "items"));

    await setDoc(ref, { name: form.name, description: form.description, tagIds: form.tagIds });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Lieux de quête</h2>

      <fieldset>
        <legend>Filtres</legend>
        <input
          placeholder="Rechercher par nom ou description..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredLocations.map((location) => (
          <li key={location.id}>
            <strong>{location.name}</strong> — {location.description}
            <div>
              Tags :{" "}
              {(location.tagIds || []).map((id) => tags.find((t) => t.id === id)?.name || id).join(", ") || "aucun"}
            </div>
            <button type="button" onClick={() => startEdit(location)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "adventureZones", "items", location.id))}>
              Supprimer
            </button>
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
        <summary>{editingId ? "Modifier le lieu de quête" : "Nouveau lieu de quête"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
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
            <button type="submit">{editingId ? "Enregistrer" : "Créer le lieu de quête"}</button>
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
