import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

const emptyRegionForm = { name: "", nameSuggestions: "" };
const emptyBackgroundForm = {
  name: "",
  profession: "",
  weight: 10,
  reputationStart: 0,
  startingGold: 0,
  startingItems: "",
};

function BackgroundsEditor({ regionId }) {
  const [backgrounds, setBackgrounds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyBackgroundForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "regions", "items", regionId, "backgrounds"), (snap) => {
      setBackgrounds(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [regionId]);

  function startEdit(bg) {
    setEditingId(bg.id);
    setForm({
      name: bg.name || "",
      profession: bg.profession || "",
      weight: bg.weight || 10,
      reputationStart: bg.reputationStart || 0,
      startingGold: bg.startingGold || 0,
      startingItems: (bg.startingItems || []).map((i) => `${i.name} x${i.qty}`).join(", "),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyBackgroundForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const startingItems = form.startingItems
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const match = s.match(/^(.*?)\s*x(\d+)$/i);
        return match ? { name: match[1].trim(), qty: Number(match[2]) } : { name: s, qty: 1 };
      });

    const ref = editingId
      ? doc(db, "worldData", "regions", "items", regionId, "backgrounds", editingId)
      : doc(collection(db, "worldData", "regions", "items", regionId, "backgrounds"));

    await setDoc(ref, {
      name: form.name,
      profession: form.profession,
      weight: Number(form.weight),
      reputationStart: Number(form.reputationStart),
      startingGold: Number(form.startingGold),
      startingItems,
    });
    resetForm();
  }

  return (
    <div className="backgrounds-editor">
      <h4>Backgrounds de cette région</h4>
      <ul>
        {backgrounds.map((bg) => (
          <li key={bg.id}>
            {bg.name} ({bg.profession}, poids {bg.weight})
            <button type="button" onClick={() => startEdit(bg)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "regions", "items", regionId, "backgrounds", bg.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Métier" value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} required />
        <label>
          Poids (tirage)
          <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} required />
        </label>
        <label>
          Réputation de départ
          <input type="number" value={form.reputationStart} onChange={(e) => setForm({ ...form, reputationStart: e.target.value })} />
        </label>
        <label>
          Or de départ
          <input type="number" value={form.startingGold} onChange={(e) => setForm({ ...form, startingGold: e.target.value })} />
        </label>
        <input
          placeholder="Objets de départ (ex: Dague x1, Corde x2)"
          value={form.startingItems}
          onChange={(e) => setForm({ ...form, startingItems: e.target.value })}
        />
        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Ajouter un background"}</button>
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

export default function RegionsManager() {
  const [regions, setRegions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyRegionForm);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "regions", "items"), (snap) => {
      setRegions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(region) {
    setEditingId(region.id);
    setForm({ name: region.name || "", nameSuggestions: (region.nameSuggestions || []).join(", ") });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyRegionForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const nameSuggestions = form.nameSuggestions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const ref = editingId
      ? doc(db, "worldData", "regions", "items", editingId)
      : doc(collection(db, "worldData", "regions", "items"));

    await setDoc(ref, { name: form.name, nameSuggestions });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Régions</h2>

      <ul className="creator-list">
        {regions.map((region) => (
          <li key={region.id}>
            <div>
              <strong>{region.name}</strong> — noms suggérés : {(region.nameSuggestions || []).join(", ") || "aucun"}
              <button type="button" onClick={() => startEdit(region)}>
                Modifier
              </button>
              <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "regions", "items", region.id))}>
                Supprimer
              </button>
              <button type="button" onClick={() => setExpandedId(expandedId === region.id ? null : region.id)}>
                {expandedId === region.id ? "Masquer les backgrounds" : "Gérer les backgrounds"}
              </button>
            </div>
            {expandedId === region.id && <BackgroundsEditor regionId={region.id} />}
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier la région" : "Nouvelle région"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom de la région" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input
          placeholder="Suggestions de noms (séparés par des virgules)"
          value={form.nameSuggestions}
          onChange={(e) => setForm({ ...form, nameSuggestions: e.target.value })}
        />
        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer la région"}</button>
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
