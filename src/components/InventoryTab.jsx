import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RARITIES } from "./creator/TalentsManager";
import { OBJECT_TYPES } from "./creator/ObjectsManager";
import MultiSelectModalField from "./creator/MultiSelectModalField";
import { matchesTag } from "./creator/TagsManager";
import InstanceTile, { CONDITIONS, formatDate } from "./Instance";

function useItems(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", collectionName, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [collectionName]);
  return items;
}

const emptyFilters = { rarities: [], types: [], tagIds: [] };

export default function InventoryTab({ character }) {
  const [instances, setInstances] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [detail, setDetail] = useState(null);
  const dialogRef = useRef(null);
  const objects = useItems("objects");
  const tags = useItems("tags");

  useEffect(() => {
    // firestore.rules authorizes instances reads on ownerUid, not characterId - a query filtered
    // on characterId alone can't prove to Firestore that every possible match satisfies that
    // rule, so the whole query is denied regardless of what the data actually contains. Both
    // filters are required.
    const q = query(
      collection(db, "instances"),
      where("ownerUid", "==", character.ownerUid),
      where("characterId", "==", character.id)
    );
    return onSnapshot(q, (snap) => {
      setInstances(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [character.id, character.ownerUid]);

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

  function openDetail(payload) {
    setDetail(payload);
    dialogRef.current?.showModal();
  }

  function closeDetail() {
    dialogRef.current?.close();
    setDetail(null);
  }

  // The objects actually held by the character, deduplicated by objectId — used to restrict
  // filter options to values that could plausibly match something in the inventory, instead of
  // showing every rarity/type/tag that exists in the whole game.
  const ownedObjects = Object.values(
    instances.reduce((acc, instance) => {
      const object = objects.find((o) => o.id === instance.objectId);
      if (object) acc[object.id] = object;
      return acc;
    }, {})
  );

  const availableRarities = RARITIES.filter((r) => ownedObjects.some((o) => (o.rarity || "commun") === r.value)).map(
    (r) => ({ id: r.value, name: r.label })
  );
  const availableTypes = OBJECT_TYPES.filter((t) => ownedObjects.some((o) => o.type === t.value)).map((t) => ({
    id: t.value,
    name: t.label,
  }));
  const ownedTagIds = new Set(ownedObjects.flatMap((o) => o.tagIds || []));
  const availableTags = tags.filter((tag) => ownedTagIds.has(tag.id));

  const filteredInstances = instances
    .map((instance) => ({ instance, object: objects.find((o) => o.id === instance.objectId) }))
    .filter(({ object }) => {
      if (!object) return false;
      if (filters.rarities.length > 0 && !filters.rarities.includes(object.rarity || "commun")) return false;
      if (filters.types.length > 0 && !filters.types.includes(object.type)) return false;
      if (filters.tagIds.length > 0 && !(object.tagIds || []).some((id) => filters.tagIds.includes(id))) return false;
      return true;
    });

  // Identical objects (same objectId) are stacked into a single tile showing a count badge;
  // the first instance encountered represents the stack when its detail pop-up is opened.
  const stacks = Object.values(
    filteredInstances.reduce((acc, { instance, object }) => {
      const stack = acc[instance.objectId] || { instance, object, count: 0 };
      stack.count += 1;
      acc[instance.objectId] = stack;
      return acc;
    }, {})
  );

  return (
    <div className="inventory-tab">
      <p>Or : {character.gold}</p>

      <fieldset>
        <legend>Filtres</legend>
        <MultiSelectModalField
          legend="Raretés"
          options={availableRarities}
          selectedIds={filters.rarities}
          onToggle={toggleFilterRarity}
          buttonLabel="Raretés"
        />
        <MultiSelectModalField
          legend="Types"
          options={availableTypes}
          selectedIds={filters.types}
          onToggle={toggleFilterType}
          buttonLabel="Types"
        />
        <MultiSelectModalField
          legend="Tags"
          options={availableTags}
          selectedIds={filters.tagIds}
          onToggle={toggleFilterTag}
          matchesFilter={matchesTag}
          filterPlaceholder="Filtrer par nom..."
          buttonLabel="Tags"
        />
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      {stacks.length > 0 ? (
        <ul className="inventory-grid">
          {stacks.map(({ instance, object, count }) => (
            <InstanceTile key={instance.objectId} instance={instance} object={object} count={count} onSelect={openDetail} />
          ))}
        </ul>
      ) : (
        <p className="empty-state">Ton inventaire est vide.</p>
      )}

      <dialog
        ref={dialogRef}
        className="instance-detail-dialog"
        onClick={(e) => {
          if (e.target === dialogRef.current) closeDetail();
        }}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className={`instance-detail-content rarity-${detail.object.rarity}`}>
            <h4>{detail.object.name}</h4>
            <p>
              {RARITIES.find((r) => r.value === detail.object.rarity)?.label || detail.object.rarity} —{" "}
              {OBJECT_TYPES.find((t) => t.value === detail.object.type)?.label || detail.object.type}
            </p>
            <p>État : {CONDITIONS.find((c) => c.value === detail.instance.condition)?.label || detail.instance.condition}</p>
            <p>Obtenu le {formatDate(detail.instance.acquisitionDate)}</p>
            {(detail.instance.description || detail.object.description) && (
              <p>{detail.instance.description || detail.object.description}</p>
            )}
            <p>
              Tags :{" "}
              {(detail.object.tagIds || []).map((id) => tags.find((t) => t.id === id)?.name || id).join(", ") ||
                "aucun"}
            </p>
            <button type="button" onClick={closeDetail}>
              Fermer
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
