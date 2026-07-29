import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

const emptyForm = { name: "", description: "" };

export default function OriginsManager() {
  const [origins, setOrigins] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "origins", "items"), (snap) => {
      setOrigins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredOrigins = origins.filter((origin) => {
    const q = filterText.toLowerCase();
    return !q || (origin.name || "").toLowerCase().includes(q) || (origin.description || "").toLowerCase().includes(q);
  });

  function startEdit(origin) {
    setEditingId(origin.id);
    setForm({ name: origin.name || "", description: origin.description || "" });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "origins", "items", editingId)
      : doc(collection(db, "worldData", "origins", "items"));

    await setDoc(ref, { name: form.name, description: form.description });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Origines</h2>

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
        {filteredOrigins.map((origin) => (
          <li key={origin.id}>
            <strong>{origin.name}</strong> — {origin.description}
            <button type="button" onClick={() => startEdit(origin)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "origins", "items", origin.id))}>
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
        <summary>{editingId ? "Modifier l'origine" : "Nouvelle origine"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer l'origine"}</button>
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
