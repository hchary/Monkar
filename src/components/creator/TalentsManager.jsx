import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export const RARITIES = [
  { value: "commun", label: "Commun" },
  { value: "peu_commun", label: "Peu commun" },
  { value: "rare", label: "Rare" },
  { value: "tres_rare", label: "Très rare" },
  { value: "legendaire", label: "Légendaire" },
  { value: "mythique", label: "Mythique" },
  { value: "divin", label: "Divin" },
  { value: "unique", label: "Unique" },
];

const emptyForm = {
  name: "",
  trainable: false,
  rarity: "commun",
  effect: "",
};

export default function TalentsManager() {
  const [talents, setTalents] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "talents", "items"), (snap) => {
      setTalents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(talent) {
    setEditingId(talent.id);
    setForm({
      name: talent.name || "",
      trainable: !!talent.trainable,
      rarity: talent.rarity || "commun",
      effect: talent.effect || "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId ? doc(db, "worldData", "talents", "items", editingId) : doc(collection(db, "worldData", "talents", "items"));

    await setDoc(ref, {
      name: form.name,
      trainable: form.trainable,
      rarity: form.rarity,
      effect: form.effect,
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Talents</h2>

      <ul className="creator-list">
        {talents.map((talent) => (
          <li key={talent.id}>
            <strong>{talent.name}</strong>
            {talent.trainable && "*"} ({RARITIES.find((r) => r.value === talent.rarity)?.label || talent.rarity}) — {talent.effect}
            <button type="button" onClick={() => startEdit(talent)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "talents", "items", talent.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier le talent" : "Nouveau talent"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <textarea
          placeholder="Effet (affiché dans l'infobulle)"
          value={form.effect}
          onChange={(e) => setForm({ ...form, effect: e.target.value })}
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
        <label>
          <input
            type="checkbox"
            checked={form.trainable}
            onChange={(e) => setForm({ ...form, trainable: e.target.checked })}
          />
          Entraînable
        </label>

        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer le talent"}</button>
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
