import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RARITIES } from "./creator/TalentsManager";
import { OBJECT_TYPES } from "./creator/ObjectsManager";
import InstanceCard from "./Instance";

function useItems(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", collectionName, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [collectionName]);
  return items;
}

function MultiSelectField({ legend, options, selectedIds, onToggle }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.length === 0 && <p>Aucun élément créé pour l'instant.</p>}
      {options.map((option) => (
        <label key={option.id}>
          <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onToggle(option.id)} />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
}

const emptyFilters = { rarities: [], types: [], tagIds: [] };

export default function InventoryTab({ character }) {
  const [instances, setInstances] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const objects = useItems("objects");
  const tags = useItems("tags");

  useEffect(() => {
    const q = query(collection(db, "instances"), where("characterId", "==", character.id));
    return onSnapshot(q, (snap) => {
      setInstances(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [character.id]);

  function toggleFilterRarity(value) {
    setFilters((prev) => ({
      ...prev,
      rarities: prev.rarities.includes(value) ? prev.rarities.filter((r) => r !== value) : [...prev.rarities, value],
    }));
  }

  function toggleFilterType(value) {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(value) ? prev.types.filter((t) => t !== value) : [...prev.types, value],
    }));
  }

  function toggleFilterTag(id) {
    setFilters((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  const filteredInstances = instances
    .map((instance) => ({ instance, object: objects.find((o) => o.id === instance.objectId) }))
    .filter(({ object }) => {
      if (!object) return false;
      if (filters.rarities.length > 0 && !filters.rarities.includes(object.rarity || "commun")) return false;
      if (filters.types.length > 0 && !filters.types.includes(object.type)) return false;
      if (filters.tagIds.length > 0 && !(object.tagIds || []).some((id) => filters.tagIds.includes(id))) return false;
      return true;
    });

  return (
    <div className="inventory-tab">
      <p>Or : {character.gold}</p>

      <fieldset>
        <legend>Filtres</legend>
        <MultiSelectField
          legend="Raretés"
          options={RARITIES.map((r) => ({ id: r.value, name: r.label }))}
          selectedIds={filters.rarities}
          onToggle={toggleFilterRarity}
        />
        <MultiSelectField
          legend="Types"
          options={OBJECT_TYPES.map((t) => ({ id: t.value, name: t.label }))}
          selectedIds={filters.types}
          onToggle={toggleFilterType}
        />
        <MultiSelectField legend="Tags" options={tags} selectedIds={filters.tagIds} onToggle={toggleFilterTag} />
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      {filteredInstances.length > 0 ? (
        <ul className="instance-list">
          {filteredInstances.map(({ instance, object }) => (
            <InstanceCard key={instance.id} instance={instance} object={object} tags={tags} />
          ))}
        </ul>
      ) : (
        <p className="empty-state">Ton inventaire est vide.</p>
      )}
    </div>
  );
}
