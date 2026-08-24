import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { matchesTag } from "./TagsManager";
import { matchesLootTable } from "./TablesDeTirageManager";
import { AREA_TYPES, areaTypeLabel } from "../../../shared/lib/areaTypes";
import { DEFAULTS } from "../../../shared/schema/area";
import MultiSelectModalField from "./MultiSelectModalField";

const emptyForm = { name: "", type: AREA_TYPES[0].value, ...DEFAULTS };

// Matches an area's name or type — for use as SoloSelectModalField's matchesFilter (RegionsManager's
// areaId picker), and as this manager's own free-text search.
export function matchesArea(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    (option.name || "").toLowerCase().includes(q) ||
    (option.type || "").toLowerCase().includes(q) ||
    areaTypeLabel(option.type || "").toLowerCase().includes(q)
  );
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

export default function AreasManager() {
  const [areas, setAreas] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const tags = useItems("tags");
  const lootTables = useItems("lootTables");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "areas", "items"), (snap) => {
      setAreas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filtered = areas.filter((area) => matchesArea(area, filterText));

  function startEdit(area) {
    setEditingId(area.id);
    setForm({
      name: area.name || "",
      type: area.type || AREA_TYPES[0].value,
      tagIds: area.tagIds || [],
      lootTableIds: area.lootTableIds || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "areas", "items", editingId)
      : doc(collection(db, "worldData", "areas", "items"));

    await setDoc(ref, {
      name: form.name,
      type: form.type,
      tagIds: form.tagIds,
      lootTableIds: form.lootTableIds,
    });
    resetForm();
  }

  function toggleIn(field, id) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
  }

  return (
    <div className="creator-section">
      <h2>Zones</h2>
      <p>
        Le terrain dans lequel une région se situe. Le type de zone est ce sur quoi la génération de
        missions filtre le bestiaire : les monstres disponibles dans une région sont ceux dont le type
        de zone correspond à celui de sa zone. Plusieurs régions peuvent partager la même zone.
      </p>

      <fieldset>
        <legend>Filtres</legend>
        <input
          placeholder="Rechercher par nom ou type..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filtered.map((area) => (
          <li key={area.id}>
            <strong>{area.name}</strong> — {areaTypeLabel(area.type)}
            {(area.lootTableIds || []).length > 0 ? ` · ${area.lootTableIds.length} table(s) de récolte` : ""}
            <button type="button" onClick={() => startEdit(area)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "areas", "items", area.id))}>
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
        <summary>{editingId ? "Modifier la zone" : "Nouvelle zone"}</summary>
        <form onSubmit={handleSubmit}>
          <input
            placeholder='Nom (ex: "Marais de Ravenholm")'
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <label>
            Type de zone
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {AREA_TYPES.map((areaType) => (
                <option key={areaType.value} value={areaType.value}>
                  {areaType.label}
                </option>
              ))}
            </select>
          </label>

          <MultiSelectModalField
            legend="Tags"
            options={tags}
            selectedIds={form.tagIds}
            onToggle={(id) => toggleIn("tagIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Tag")}`}
            matchesFilter={matchesTag}
            filterPlaceholder="Filtrer par nom..."
            buttonLabel="Ajouter tags"
          />

          <MultiSelectModalField
            legend="Tables de récolte"
            options={lootTables}
            selectedIds={form.lootTableIds}
            onToggle={(id) => toggleIn("lootTableIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Tables de tirage")}`}
            matchesFilter={matchesLootTable}
            filterPlaceholder="Filtrer par nom ou rareté..."
            buttonLabel="Ajouter des tables"
          />

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer la zone"}</button>
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
