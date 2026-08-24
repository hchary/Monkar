import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { matchesArea } from "./AreasManager";
import { areaTypeLabel } from "../../../shared/lib/areaTypes";
import SoloSelectModalField from "./SoloSelectModalField";

const DIRECTIONS = [
  { value: "nord", label: "Nord" },
  { value: "sud", label: "Sud" },
  { value: "est", label: "Est" },
  { value: "ouest", label: "Ouest" },
];

// Matches a region's name or description — for use as MultiSelectModalField's matchesFilter.
export function matchesRegion(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (option.name || "").toLowerCase().includes(q) || (option.description || "").toLowerCase().includes(q);
}

const emptyRegionForm = {
  name: "",
  nameSuggestions: "",
  description: "",
  neighbors: [],
  areaId: null,
  climatId: "",
  climateIds: [],
  reliefIds: [],
  factionIds: [],
  adventureZoneIds: [],
  originIds: [],
};

const emptyBackgroundForm = {
  name: "",
  profession: "",
  weight: 10,
  reputationStart: 0,
  startingGold: 0,
  startingItems: "",
};

function useItems(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", collectionName, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [collectionName]);
  return items;
}

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

function NeighborsField({ regions, currentId, neighbors, onChange }) {
  const others = regions.filter((r) => r.id !== currentId);

  function toggle(regionId) {
    const exists = neighbors.some((n) => n.regionId === regionId);
    onChange(
      exists
        ? neighbors.filter((n) => n.regionId !== regionId)
        : [...neighbors, { regionId, direction: "nord" }]
    );
  }

  function setDirection(regionId, direction) {
    onChange(neighbors.map((n) => (n.regionId === regionId ? { ...n, direction } : n)));
  }

  return (
    <fieldset>
      <legend>Régions voisines</legend>
      {others.length === 0 && <p>Aucune autre région créée pour l'instant.</p>}
      {others.map((region) => {
        const neighbor = neighbors.find((n) => n.regionId === region.id);
        return (
          <label key={region.id}>
            <input type="checkbox" checked={!!neighbor} onChange={() => toggle(region.id)} />
            {region.name}
            {neighbor && (
              <select value={neighbor.direction} onChange={(e) => setDirection(region.id, e.target.value)}>
                {DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

function MultiSelectField({ legend, options, selectedIds, onToggle, createLink, getTooltip }) {
  return (
    <fieldset>
      <legend>
        {legend}
        {createLink && (
          <Link to={createLink} target="_blank" rel="noopener noreferrer">
            {" "}
            Créer
          </Link>
        )}
      </legend>
      {options.length === 0 && <p>Aucun élément créé pour l'instant.</p>}
      {options.map((option) => (
        <label key={option.id} data-tooltip={getTooltip ? getTooltip(option) : undefined}>
          <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onToggle(option.id)} />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
}

function ReliefQuickCreate() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleAdd() {
    if (!name) return;
    await setDoc(doc(collection(db, "worldData", "reliefs", "items")), { name, description });
    setName("");
    setDescription("");
  }

  return (
    <div className="inline-create">
      <input placeholder="Nouveau relief" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <button type="button" onClick={handleAdd}>
        Ajouter un relief
      </button>
    </div>
  );
}

export default function RegionsManager() {
  const [regions, setRegions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyRegionForm);
  const [expandedId, setExpandedId] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const areas = useItems("areas");
  const climats = useItems("climats");
  const reliefs = useItems("reliefs");
  const factions = useItems("factions");
  const adventureZones = useItems("adventureZones");
  const origins = useItems("origins");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "regions", "items"), (snap) => {
      setRegions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredRegions = regions.filter((region) => matchesRegion(region, filterText));

  function startEdit(region) {
    setEditingId(region.id);
    setForm({
      name: region.name || "",
      nameSuggestions: (region.nameSuggestions || []).join(", "),
      description: region.description || "",
      neighbors: region.neighbors || [],
      areaId: region.areaId ?? null,
      climatId: region.climatId || "",
      climateIds: region.climateIds || [],
      reliefIds: region.reliefIds || [],
      factionIds: region.factionIds || [],
      adventureZoneIds: region.adventureZoneIds || [],
      originIds: region.originIds || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyRegionForm);
  }

  function toggleIn(field, id) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
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

    await setDoc(ref, {
      name: form.name,
      nameSuggestions,
      description: form.description,
      neighbors: form.neighbors,
      areaId: form.areaId || null,
      climatId: form.climatId,
      climateIds: form.climateIds,
      reliefIds: form.reliefIds,
      factionIds: form.factionIds,
      adventureZoneIds: form.adventureZoneIds,
      originIds: form.originIds,
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Régions</h2>

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
        {filteredRegions.map((region) => (
          <li key={region.id}>
            <div>
              <strong>{region.name}</strong> — zone :{" "}
              {region.areaId ? areas.find((a) => a.id === region.areaId)?.name || region.areaId : "aucune"}
              {" — "}noms suggérés : {(region.nameSuggestions || []).join(", ") || "aucun"}
              <button type="button" onClick={() => startEdit(region)}>
                Modifier
              </button>
              <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "regions", "items", region.id))}>
                Supprimer
              </button>
              <button type="button" onClick={() => setExpandedId(expandedId === region.id ? null : region.id)}>
                {expandedId === region.id ? "Masquer les origines" : "Editer les origines"}
              </button>
            </div>
            {expandedId === region.id && <BackgroundsEditor regionId={region.id} />}
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
        <summary>{editingId ? "Modifier la région" : "Nouvelle région"}</summary>
        <form onSubmit={handleSubmit}>
        <input placeholder="Nom de la région" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input
          placeholder="Suggestions de noms (séparés par des virgules)"
          value={form.nameSuggestions}
          onChange={(e) => setForm({ ...form, nameSuggestions: e.target.value })}
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <NeighborsField
          regions={regions}
          currentId={editingId}
          neighbors={form.neighbors}
          onChange={(neighbors) => setForm({ ...form, neighbors })}
        />

        <SoloSelectModalField
          legend="Zone (génération de missions)"
          options={areas}
          selectedId={form.areaId}
          onSelect={(id) => setForm({ ...form, areaId: id })}
          onClear={() => setForm({ ...form, areaId: null })}
          createLink={`/creator?section=${encodeURIComponent("Zones")}`}
          matchesFilter={matchesArea}
          getTooltip={(area) => areaTypeLabel(area.type)}
          filterPlaceholder="Filtrer par nom ou type..."
          buttonLabel="Choisir une zone"
        />

        <fieldset>
          <legend>
            Climat
            <Link to={`/creator?section=${encodeURIComponent("Climat")}`} target="_blank" rel="noopener noreferrer">
              {" "}
              Créer
            </Link>
          </legend>
          <select value={form.climatId} onChange={(e) => setForm({ ...form, climatId: e.target.value })}>
            <option value="">Aucun</option>
            {climats.map((climat) => (
              <option key={climat.id} value={climat.id} title={climat.description}>
                {climat.name}
              </option>
            ))}
          </select>
        </fieldset>

        <MultiSelectField
          legend="Climats (affichage et origines)"
          options={climats}
          selectedIds={form.climateIds}
          onToggle={(id) => toggleIn("climateIds", id)}
          createLink={`/creator?section=${encodeURIComponent("Climat")}`}
          getTooltip={(climat) => climat.description}
        />

        <MultiSelectField
          legend="Reliefs"
          options={reliefs}
          selectedIds={form.reliefIds}
          onToggle={(id) => toggleIn("reliefIds", id)}
          createLink={`/creator?section=${encodeURIComponent("Reliefs")}`}
          getTooltip={(relief) => relief.description}
        />
        <ReliefQuickCreate />

        <MultiSelectField
          legend="Factions"
          options={factions}
          selectedIds={form.factionIds}
          onToggle={(id) => toggleIn("factionIds", id)}
          createLink={`/creator?section=${encodeURIComponent("Factions")}`}
        />

        <MultiSelectField
          legend="Lieux de quête"
          options={adventureZones}
          selectedIds={form.adventureZoneIds}
          onToggle={(id) => toggleIn("adventureZoneIds", id)}
          createLink={`/creator?section=${encodeURIComponent("Lieux de quête")}`}
        />

        <MultiSelectField
          legend="Origines"
          options={origins}
          selectedIds={form.originIds}
          onToggle={(id) => toggleIn("originIds", id)}
          createLink={`/creator?section=${encodeURIComponent("Origines")}`}
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
      </details>
    </div>
  );
}
