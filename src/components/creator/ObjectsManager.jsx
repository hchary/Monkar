import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  collection,
  doc,
  deleteDoc,
  setDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { RARITIES } from "./TalentsManager";
import { matchesTag } from "./TagsManager";
import MultiSelectModalField from "./MultiSelectModalField";

// Fixed catalog of item types — no creator UI to add new ones for now.
export const OBJECT_TYPES = [
  { value: "arme", label: "Armes" },
  { value: "armure", label: "Armures" },
  { value: "consommable", label: "Consommables" },
  { value: "composant", label: "Composants" },
  { value: "ingredient", label: "Ingrédient" },
  { value: "grimoire", label: "Grimoires" },
  { value: "parchemin", label: "Parchemin" },
  { value: "objet_magique", label: "Objet magique" },
  { value: "titre_propriete", label: "Titres de propriété" },
  { value: "vetement", label: "Vêtement" },
];

// Matches an object's name, description, rarity, or type — for use as MultiSelectModalField's
// matchesFilter (e.g. a future Instance manager picking from this catalog).
export function matchesObject(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    (option.name || "").toLowerCase().includes(q) ||
    (option.description || "").toLowerCase().includes(q) ||
    (option.rarity || "").toLowerCase().includes(q) ||
    (option.type || "").toLowerCase().includes(q)
  );
}

function lowerFirst(str) {
  return str ? str.charAt(0).toLowerCase() + str.slice(1) : str;
}

function buildGeneratedName(baseName, prefix, suffix) {
  const name = prefix ? lowerFirst(baseName) : baseName;
  return `${prefix}${name}${suffix}`;
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

const emptyFilters = { rarities: [], types: [], tagIds: [], text: "" };
const emptyForm = { name: "", description: "", rarity: "commun", type: OBJECT_TYPES[0].value, tagIds: [] };
const emptyGenerateForm = { tagIds: [], prefix: "", suffix: "", rarity: "commun" };

export default function ObjectsManager() {
  const [objects, setObjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [generateForm, setGenerateForm] = useState(emptyGenerateForm);
  const generateDialogRef = useRef(null);

  const tags = useItems("tags");
  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "objects", "items"), (snap) => {
      setObjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Deep link from other managers (e.g. a loot table draw) straight to an object's edit form.
  useEffect(() => {
    const objectId = searchParams.get("objectId");
    if (!objectId) return;
    const target = objects.find((o) => o.id === objectId);
    if (!target) return;
    startEdit(target);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("objectId");
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, searchParams]);

  const filteredObjects = objects.filter((object) => {
    if (filters.rarities.length > 0 && !filters.rarities.includes(object.rarity || "commun")) return false;
    if (filters.types.length > 0 && !filters.types.includes(object.type)) return false;
    if (filters.tagIds.length > 0 && !(object.tagIds || []).some((id) => filters.tagIds.includes(id))) return false;
    if (!matchesObject(object, filters.text)) return false;
    return true;
  });

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

  function openGenerateDialog() {
    setGenerateForm(emptyGenerateForm);
    generateDialogRef.current?.showModal();
  }

  function closeGenerateDialog() {
    generateDialogRef.current?.close();
  }

  function toggleGenerateTag(id) {
    setGenerateForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  async function handleGenerateSubmit(e) {
    e.preventDefault();
    if (!generateForm.prefix.trim() && !generateForm.suffix.trim()) return;

    const batch = writeBatch(db);
    for (const object of filteredObjects) {
      const ref = doc(collection(db, "worldData", "objects", "items"));
      batch.set(ref, {
        name: buildGeneratedName(object.name || "", generateForm.prefix, generateForm.suffix),
        description: "",
        rarity: generateForm.rarity,
        type: object.type,
        tagIds: Array.from(new Set([...(object.tagIds || []), ...generateForm.tagIds])),
      });
    }
    await batch.commit();
    closeGenerateDialog();
  }

  function startEdit(object) {
    setEditingId(object.id);
    setForm({
      name: object.name || "",
      description: object.description || "",
      rarity: object.rarity || "commun",
      type: object.type || OBJECT_TYPES[0].value,
      tagIds: object.tagIds || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleTagId(id) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  async function handleDelete(objectId) {
    const referencingTables = await getDocs(
      query(collection(db, "worldData", "lootTables", "items"), where("itemIds", "array-contains", objectId))
    );
    await Promise.all(
      referencingTables.docs.map((tableDoc) =>
        updateDoc(tableDoc.ref, { itemIds: (tableDoc.data().itemIds || []).filter((id) => id !== objectId) })
      )
    );
    // Ingredients/results are arrays of {objectId, qty} maps, so array-contains can't target
    // them directly — fetch every recette and filter client-side instead.
    const allRecettes = await getDocs(collection(db, "worldData", "recettes", "items"));
    await Promise.all(
      allRecettes.docs
        .filter(
          (recetteDoc) =>
            (recetteDoc.data().ingredients || []).some((e) => e.objectId === objectId) ||
            (recetteDoc.data().results || []).some((e) => e.objectId === objectId)
        )
        .map((recetteDoc) =>
          updateDoc(recetteDoc.ref, {
            ingredients: (recetteDoc.data().ingredients || []).filter((e) => e.objectId !== objectId),
            results: (recetteDoc.data().results || []).filter((e) => e.objectId !== objectId),
          })
        )
    );
    await deleteDoc(doc(db, "worldData", "objects", "items", objectId));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "objects", "items", editingId)
      : doc(collection(db, "worldData", "objects", "items"));

    await setDoc(ref, {
      name: form.name,
      description: form.description,
      rarity: form.rarity,
      type: form.type,
      tagIds: form.tagIds,
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Objets</h2>

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
        <MultiSelectField legend="Tags" options={sortedTags} selectedIds={filters.tagIds} onToggle={toggleFilterTag} />
        <input
          placeholder="Rechercher par nom ou description..."
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        />
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
        <button type="button" onClick={openGenerateDialog}>
          Générer nouveaux objets
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredObjects.length === 0 && <li className="empty-state">Aucun objet.</li>}
        {filteredObjects.map((object) => (
          <li key={object.id}>
            <strong>{object.name}</strong> — {RARITIES.find((r) => r.value === object.rarity)?.label || object.rarity} —{" "}
            {OBJECT_TYPES.find((t) => t.value === object.type)?.label || object.type}
            <div>{object.description}</div>
            <div>
              Tags :{" "}
              {(object.tagIds || []).map((id) => tags.find((t) => t.id === id)?.name || id).join(", ") || "aucun"}
            </div>
            <button type="button" onClick={() => startEdit(object)}>
              Modifier
            </button>
            <button type="button" onClick={() => handleDelete(object.id)}>
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
        <summary>{editingId ? "Modifier l'objet" : "Nouvel objet"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {OBJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <MultiSelectModalField
            legend="Tags"
            options={sortedTags}
            selectedIds={form.tagIds}
            onToggle={toggleTagId}
            createLink={`/creator?section=${encodeURIComponent("Tag")}`}
            matchesFilter={matchesTag}
            filterPlaceholder="Filtrer par nom..."
            buttonLabel="Ajouter tags"
          />

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer l'objet"}</button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Annuler
              </button>
            )}
          </div>
        </form>
      </details>

      <dialog
        ref={generateDialogRef}
        className="generate-objects-dialog"
        onClick={(e) => {
          if (e.target === generateDialogRef.current) closeGenerateDialog();
        }}
      >
        <form className="generate-objects-content" onSubmit={handleGenerateSubmit}>
          <h4>Génération d'objet</h4>
          <p>{filteredObjects.length} objet(s) sélectionné(s) par les filtres.</p>

          <input
            placeholder="Préfixe"
            value={generateForm.prefix}
            onChange={(e) => setGenerateForm({ ...generateForm, prefix: e.target.value })}
          />
          <input
            placeholder="Suffixe"
            value={generateForm.suffix}
            onChange={(e) => setGenerateForm({ ...generateForm, suffix: e.target.value })}
          />

          <label>
            Rareté
            <select
              value={generateForm.rarity}
              onChange={(e) => setGenerateForm({ ...generateForm, rarity: e.target.value })}
            >
              {RARITIES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <MultiSelectField
            legend="Tags à ajouter"
            options={sortedTags}
            selectedIds={generateForm.tagIds}
            onToggle={toggleGenerateTag}
          />

          <div className="generate-objects-actions">
            <button type="submit" disabled={!generateForm.prefix.trim() && !generateForm.suffix.trim()}>
              Confirmer
            </button>
            <button type="button" onClick={closeGenerateDialog}>
              Annuler
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
