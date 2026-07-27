import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

const emptyForm = { name: "", description: "" };

export default function ClimatsManager() {
  const [climats, setClimats] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "climats", "items"), (snap) => {
      setClimats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredClimats = climats.filter((climat) => {
    const q = filterText.toLowerCase();
    return !q || (climat.name || "").toLowerCase().includes(q) || (climat.description || "").toLowerCase().includes(q);
  });

  function startEdit(climat) {
    setEditingId(climat.id);
    setForm({ name: climat.name || "", description: climat.description || "" });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "climats", "items", editingId)
      : doc(collection(db, "worldData", "climats", "items"));

    await setDoc(ref, { name: form.name, description: form.description });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Climats</h2>

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
        {filteredClimats.map((climat) => (
          <li key={climat.id}>
            <strong>{climat.name}</strong> — {climat.description}
            <button type="button" onClick={() => startEdit(climat)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "climats", "items", climat.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <details className="collapsible-group" open={panelOpen} onToggle={(e) => setPanelOpen(e.target.open)}>
        <summary>{editingId ? "Modifier le climat" : "Nouveau climat"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer le climat"}</button>
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
