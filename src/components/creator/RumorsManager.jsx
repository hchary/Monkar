import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, writeBatch, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { RARITIES } from "./TalentsManager";
import { matchesRegion } from "./RegionsManager";
import MultiSelectModalField from "./MultiSelectModalField";

// Matches a rumor's text - for use as this manager's own free-text search.
export function matchesRumor(option, query) {
  const q = query.toLowerCase();
  return !q || (option.text || "").toLowerCase().includes(q);
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

const emptyForm = { text: "", rarity: RARITIES[0].value, originRegionIds: [] };

// Rumors, worldData/rumors/items (docs/TODO.md "Rumor and mission system"): hand-authored flavor
// text with a rarity. Saving one also seeds a
// worldData/regions/items/{regionId}/rumorSightings/{rumorId} entry - at the rumor's own authored
// rarity - for every region in originRegionIds, since that's the only thing that makes the rumor
// visible anywhere in play (the "Rumeur" action and the rumor banner both read sightings, never
// the catalog directly). A region later removed from originRegionIds keeps its already-seeded
// sighting rather than having it deleted - same "never downgrade/remove a sighting" spirit as
// propagation's own dedup rule.
export default function RumorsManager() {
  const rumors = useItems("rumors");
  const regions = useItems("regions");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const sortedRegions = [...regions].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  const filteredRumors = rumors.filter((rumor) => matchesRumor(rumor, filterText));

  function startEdit(rumor) {
    setEditingId(rumor.id);
    setForm({
      text: rumor.text || "",
      rarity: rumor.rarity || RARITIES[0].value,
      originRegionIds: rumor.originRegionIds || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleOriginRegionId(id) {
    setForm((prev) => ({
      ...prev,
      originRegionIds: prev.originRegionIds.includes(id)
        ? prev.originRegionIds.filter((x) => x !== id)
        : [...prev.originRegionIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId ? doc(db, "worldData", "rumors", "items", editingId) : doc(collection(db, "worldData", "rumors", "items"));

    const batch = writeBatch(db);
    batch.set(ref, {
      text: form.text,
      rarity: form.rarity,
      originRegionIds: form.originRegionIds,
    });
    for (const regionId of form.originRegionIds) {
      const sightingRef = doc(db, "worldData", "regions", "items", regionId, "rumorSightings", ref.id);
      batch.set(sightingRef, { rarity: form.rarity, arrivedAt: serverTimestamp() });
    }
    await batch.commit();
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Rumeurs</h2>

      <fieldset>
        <legend>Filtres</legend>
        <input placeholder="Rechercher par texte..." value={filterText} onChange={(e) => setFilterText(e.target.value)} />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredRumors.length === 0 && <li className="empty-state">Aucune rumeur.</li>}
        {filteredRumors.map((rumor) => (
          <li key={rumor.id}>
            <span className={`talent-card rarity-${rumor.rarity}`}>{rumor.text}</span>
            <div>
              Régions d'origine :{" "}
              {(rumor.originRegionIds || []).map((id) => regions.find((r) => r.id === id)?.name || id).join(", ") || "aucune"}
            </div>
            <button type="button" onClick={() => startEdit(rumor)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "rumors", "items", rumor.id))}>
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
        <summary>{editingId ? "Modifier la rumeur" : "Nouvelle rumeur"}</summary>
        <form onSubmit={handleSubmit}>
          <textarea
            placeholder="Texte de la rumeur"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            required
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
            legend="Régions d'origine"
            options={sortedRegions}
            selectedIds={form.originRegionIds}
            onToggle={toggleOriginRegionId}
            createLink={`/creator?section=${encodeURIComponent("Régions")}`}
            matchesFilter={matchesRegion}
            filterPlaceholder="Filtrer par nom ou description..."
            buttonLabel="Ajouter des régions d'origine"
          />
          {form.originRegionIds.length === 0 && (
            <p className="error">Sans région d'origine, cette rumeur n'apparaîtra nulle part en jeu.</p>
          )}

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer la rumeur"}</button>
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
