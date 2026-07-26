import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

const STATS = ["force", "agilite", "intelligence", "charisme"];

const emptyForm = {
  name: "",
  description: "",
  weight: 10,
  bonuses: { force: 0, agilite: 0, intelligence: 0, charisme: 0 },
};

export default function TraitsManager() {
  const [traits, setTraits] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "traits", "items"), (snap) => {
      setTraits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(trait) {
    setEditingId(trait.id);
    setForm({
      name: trait.name || "",
      description: trait.description || "",
      weight: trait.weight || 10,
      bonuses: { force: 0, agilite: 0, intelligence: 0, charisme: 0, ...(trait.bonuses || {}) },
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const bonuses = Object.fromEntries(Object.entries(form.bonuses).filter(([, v]) => Number(v) !== 0).map(([k, v]) => [k, Number(v)]));

    const ref = editingId ? doc(db, "worldData", "traits", "items", editingId) : doc(collection(db, "worldData", "traits", "items"));

    await setDoc(ref, { name: form.name, description: form.description, weight: Number(form.weight), bonuses });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Traits</h2>

      <ul className="creator-list">
        {traits.map((trait) => (
          <li key={trait.id}>
            <strong>{trait.name}</strong> (poids {trait.weight}) — {trait.description}
            <button type="button" onClick={() => startEdit(trait)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "traits", "items", trait.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier le trait" : "Nouveau trait"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <label>
          Poids (tirage)
          <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} required />
        </label>

        <fieldset>
          <legend>Bonus de stats</legend>
          {STATS.map((stat) => (
            <label key={stat}>
              {stat}
              <input
                type="number"
                value={form.bonuses[stat]}
                onChange={(e) => setForm({ ...form, bonuses: { ...form.bonuses, [stat]: e.target.value } })}
              />
            </label>
          ))}
        </fieldset>

        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer le trait"}</button>
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
