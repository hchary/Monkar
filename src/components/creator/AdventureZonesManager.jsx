import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

const emptyForm = { name: "", description: "" };

export default function AdventureZonesManager() {
  const [zones, setZones] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "adventureZones", "items"), (snap) => {
      setZones(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(zone) {
    setEditingId(zone.id);
    setForm({ name: zone.name || "", description: zone.description || "" });
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

    await setDoc(ref, { name: form.name, description: form.description });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Zones d'aventures</h2>

      <ul className="creator-list">
        {zones.map((zone) => (
          <li key={zone.id}>
            <strong>{zone.name}</strong> — {zone.description}
            <button type="button" onClick={() => startEdit(zone)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "adventureZones", "items", zone.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier la zone d'aventure" : "Nouvelle zone d'aventure"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer la zone d'aventure"}</button>
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
