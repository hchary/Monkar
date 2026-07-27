import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

const emptyForm = { name: "", description: "" };

export default function ReliefsManager() {
  const [reliefs, setReliefs] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "reliefs", "items"), (snap) => {
      setReliefs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(relief) {
    setEditingId(relief.id);
    setForm({ name: relief.name || "", description: relief.description || "" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "reliefs", "items", editingId)
      : doc(collection(db, "worldData", "reliefs", "items"));

    await setDoc(ref, { name: form.name, description: form.description });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Reliefs</h2>

      <ul className="creator-list">
        {reliefs.map((relief) => (
          <li key={relief.id}>
            <strong>{relief.name}</strong> — {relief.description}
            <button type="button" onClick={() => startEdit(relief)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "reliefs", "items", relief.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier le relief" : "Nouveau relief"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer le relief"}</button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Annuler
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
