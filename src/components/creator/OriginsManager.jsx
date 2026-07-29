import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { matchesRegion } from "./RegionsManager";
import { matchesTalent } from "./TalentsManager";
import { matchesObject } from "./ObjectsManager";
import MultiSelectModalField from "./MultiSelectModalField";

const emptyForm = {
  name: "",
  description: "",
  regionIds: [],
  talentIds: [],
  profession: "",
  reputationStart: 0,
  startingItemIds: [],
};

// Matches an origin's name or description — for use as MultiSelectModalField's matchesFilter.
export function matchesOrigin(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (option.name || "").toLowerCase().includes(q) || (option.description || "").toLowerCase().includes(q);
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

export default function OriginsManager() {
  const [origins, setOrigins] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const regions = useItems("regions");
  const talents = useItems("talents");
  const objects = useItems("objects");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "origins", "items"), (snap) => {
      setOrigins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredOrigins = origins.filter((origin) => matchesOrigin(origin, filterText));

  function startEdit(origin) {
    setEditingId(origin.id);
    setForm({
      name: origin.name || "",
      description: origin.description || "",
      regionIds: origin.regionIds || [],
      talentIds: origin.talentIds || [],
      profession: origin.profession || "",
      reputationStart: origin.reputationStart ?? 0,
      startingItemIds: origin.startingItemIds || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleIn(field, id) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "origins", "items", editingId)
      : doc(collection(db, "worldData", "origins", "items"));

    await setDoc(ref, {
      name: form.name,
      description: form.description,
      regionIds: form.regionIds,
      talentIds: form.talentIds,
      profession: form.profession,
      reputationStart: Number(form.reputationStart),
      startingItemIds: form.startingItemIds,
    });
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
        {filteredOrigins.length === 0 && <li className="empty-state">Aucune origine.</li>}
        {filteredOrigins.map((origin) => (
          <li key={origin.id}>
            <strong>{origin.name}</strong> — {origin.description}
            <div>
              Régions :{" "}
              {(origin.regionIds || []).length > 0
                ? origin.regionIds.map((id) => regions.find((r) => r.id === id)?.name || id).join(", ")
                : "aucune restriction"}
            </div>
            <div>
              Talents :{" "}
              {(origin.talentIds || []).length > 0
                ? origin.talentIds.map((id) => talents.find((t) => t.id === id)?.name || id).join(", ")
                : "aucun"}
            </div>
            <div>Métier : {origin.profession || "aucun"}</div>
            <div>Réputation de départ : {origin.reputationStart ?? 0}</div>
            <div>
              Équipement de départ :{" "}
              {(origin.startingItemIds || []).length > 0
                ? origin.startingItemIds.map((id) => objects.find((o) => o.id === id)?.name || id).join(", ")
                : "aucun"}
            </div>
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
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <MultiSelectModalField
            legend="Restriction de région"
            options={regions}
            selectedIds={form.regionIds}
            onToggle={(id) => toggleIn("regionIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Régions")}`}
            matchesFilter={matchesRegion}
            filterPlaceholder="Filtrer par nom ou description..."
            buttonLabel="Choisir des régions"
          />
          {form.regionIds.length === 0 && <p>Aucune région sélectionnée : l'origine n'a aucune restriction.</p>}

          <MultiSelectModalField
            legend="Talents associés"
            options={talents}
            selectedIds={form.talentIds}
            onToggle={(id) => toggleIn("talentIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Talents")}`}
            matchesFilter={matchesTalent}
            filterPlaceholder="Filtrer par nom, effet ou rareté..."
            buttonLabel="Choisir des talents"
          />

          <label>
            Métier associé
            <input
              placeholder="Métier (optionnel)"
              value={form.profession}
              onChange={(e) => setForm({ ...form, profession: e.target.value })}
            />
          </label>

          <label>
            Réputation de départ
            <input
              type="number"
              value={form.reputationStart}
              onChange={(e) => setForm({ ...form, reputationStart: e.target.value })}
            />
          </label>

          <MultiSelectModalField
            legend="Équipement de départ"
            options={objects}
            selectedIds={form.startingItemIds}
            onToggle={(id) => toggleIn("startingItemIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Objets")}`}
            matchesFilter={matchesObject}
            filterPlaceholder="Filtrer par nom, description, rareté ou type..."
            buttonLabel="Choisir des objets"
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
