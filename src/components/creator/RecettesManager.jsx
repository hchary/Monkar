import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { RARITIES } from "./TalentsManager";
import { matchesTag } from "./TagsManager";
import { matchesObject } from "./ObjectsManager";
import MultiSelectModalField from "./MultiSelectModalField";
import QuantitySelectField from "./QuantitySelectField";

// Matches a recette's name or rarity — for use as MultiSelectModalField's matchesFilter
// (e.g. a future crafting action's single-select recetteId field).
export function matchesRecette(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (option.name || "").toLowerCase().includes(q) || (option.rarity || "").toLowerCase().includes(q);
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

function tagNames(ids, tags) {
  return (ids || [])
    .map((id) => tags.find((t) => t.id === id)?.name || id)
    .sort((a, b) => a.localeCompare(b, "fr"));
}

function objectEntryLabel(entries, objects) {
  return (entries || []).map((entry) => {
    const name = objects.find((o) => o.id === entry.objectId)?.name || entry.objectId;
    return `${entry.qty}x ${name}`;
  });
}

const SORT_FIELDS = [
  { value: "name", label: "Nom" },
  { value: "rarity", label: "Rareté" },
  { value: "category", label: "Catégorie" },
  { value: "tags", label: "Tags" },
  { value: "ingredients", label: "Ingrédients" },
  { value: "results", label: "Résultats" },
];

function compareRecettes(a, b, sortBy, tags) {
  switch (sortBy) {
    case "rarity": {
      const ai = RARITIES.findIndex((r) => r.value === (a.rarity || "commun"));
      const bi = RARITIES.findIndex((r) => r.value === (b.rarity || "commun"));
      return ai - bi;
    }
    case "category":
      return tagNames(a.categoryIds, tags).join(", ").localeCompare(tagNames(b.categoryIds, tags).join(", "), "fr");
    case "tags":
      return tagNames(a.tagIds, tags).join(", ").localeCompare(tagNames(b.tagIds, tags).join(", "), "fr");
    case "ingredients":
      return (a.ingredients || []).length - (b.ingredients || []).length;
    case "results":
      return (a.results || []).length - (b.results || []).length;
    default:
      return (a.name || "").localeCompare(b.name || "", "fr");
  }
}

const emptyFilters = { rarities: [], categoryIds: [], tagIds: [], text: "" };
const emptyForm = { name: "", rarity: "commun", categoryIds: [], tagIds: [], ingredients: [], results: [] };
const emptySort = { field: "name", dir: "asc" };

export default function RecettesManager() {
  const [recettes, setRecettes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState(emptySort);
  const [panelOpen, setPanelOpen] = useState(false);

  const tags = useItems("tags");
  const objects = useItems("objects");
  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const sortedObjects = [...objects].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "recettes", "items"), (snap) => {
      setRecettes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const visibleRecettes = recettes
    .filter((recette) => {
      if (filters.rarities.length > 0 && !filters.rarities.includes(recette.rarity || "commun")) return false;
      if (filters.categoryIds.length > 0 && !(recette.categoryIds || []).some((id) => filters.categoryIds.includes(id)))
        return false;
      if (filters.tagIds.length > 0 && !(recette.tagIds || []).some((id) => filters.tagIds.includes(id))) return false;
      if (!matchesRecette(recette, filters.text)) return false;
      return true;
    })
    .sort((a, b) => (sort.dir === "asc" ? 1 : -1) * compareRecettes(a, b, sort.field, tags));

  function toggleFilterRarity(value) {
    setFilters((prev) => ({
      ...prev,
      rarities: prev.rarities.includes(value) ? prev.rarities.filter((r) => r !== value) : [...prev.rarities, value],
    }));
  }

  function toggleFilterCategory(id) {
    setFilters((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id) ? prev.categoryIds.filter((x) => x !== id) : [...prev.categoryIds, id],
    }));
  }

  function toggleFilterTag(id) {
    setFilters((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  function startEdit(recette) {
    setEditingId(recette.id);
    setForm({
      name: recette.name || "",
      rarity: recette.rarity || "commun",
      categoryIds: recette.categoryIds || [],
      tagIds: recette.tagIds || [],
      ingredients: recette.ingredients || [],
      results: recette.results || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleCategoryId(id) {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id) ? prev.categoryIds.filter((x) => x !== id) : [...prev.categoryIds, id],
    }));
  }

  function toggleTagId(id) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  function toggleIngredient(objectId) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.some((e) => e.objectId === objectId)
        ? prev.ingredients.filter((e) => e.objectId !== objectId)
        : [...prev.ingredients, { objectId, qty: 1 }],
    }));
  }

  function setIngredientQty(objectId, qty) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((e) => (e.objectId === objectId ? { ...e, qty } : e)),
    }));
  }

  function toggleResult(objectId) {
    setForm((prev) => ({
      ...prev,
      results: prev.results.some((e) => e.objectId === objectId)
        ? prev.results.filter((e) => e.objectId !== objectId)
        : [...prev.results, { objectId, qty: 1 }],
    }));
  }

  function setResultQty(objectId, qty) {
    setForm((prev) => ({
      ...prev,
      results: prev.results.map((e) => (e.objectId === objectId ? { ...e, qty } : e)),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "recettes", "items", editingId)
      : doc(collection(db, "worldData", "recettes", "items"));

    await setDoc(ref, {
      name: form.name,
      rarity: form.rarity,
      categoryIds: form.categoryIds,
      tagIds: form.tagIds,
      ingredients: form.ingredients,
      results: form.results,
    });
    resetForm();
  }

  async function handleDelete(recetteId) {
    await deleteDoc(doc(db, "worldData", "recettes", "items", recetteId));
    if (editingId === recetteId) resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Recettes</h2>

      <fieldset>
        <legend>Filtres</legend>
        <MultiSelectField
          legend="Raretés"
          options={RARITIES.map((r) => ({ id: r.value, name: r.label }))}
          selectedIds={filters.rarities}
          onToggle={toggleFilterRarity}
        />
        <MultiSelectField legend="Catégories" options={sortedTags} selectedIds={filters.categoryIds} onToggle={toggleFilterCategory} />
        <MultiSelectField legend="Tags" options={sortedTags} selectedIds={filters.tagIds} onToggle={toggleFilterTag} />
        <input
          placeholder="Rechercher par nom..."
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        />
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <fieldset>
        <legend>Tri</legend>
        <label>
          Trier par
          <select value={sort.field} onChange={(e) => setSort((prev) => ({ ...prev, field: e.target.value }))}>
            {SORT_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setSort((prev) => ({ ...prev, dir: prev.dir === "asc" ? "desc" : "asc" }))}
        >
          {sort.dir === "asc" ? "Croissant" : "Décroissant"}
        </button>
      </fieldset>

      <ul className="creator-list">
        {visibleRecettes.length === 0 && <li className="empty-state">Aucune recette.</li>}
        {visibleRecettes.map((recette) => (
          <li key={recette.id} className="loot-table-item">
            <div className="loot-table-info">
              <strong>{recette.name}</strong> — {RARITIES.find((r) => r.value === recette.rarity)?.label || recette.rarity}
              <div>Catégories : {tagNames(recette.categoryIds, tags).join(", ") || "aucune"}</div>
              <div>Tags : {tagNames(recette.tagIds, tags).join(", ") || "aucun"}</div>
              <div>Ingrédients : {objectEntryLabel(recette.ingredients, objects).join(", ") || "aucun"}</div>
              <div>Résultats : {objectEntryLabel(recette.results, objects).join(", ") || "aucun"}</div>
            </div>
            <div className="loot-table-actions">
              <button type="button" onClick={() => startEdit(recette)}>
                Modifier
              </button>
              <button type="button" onClick={() => handleDelete(recette.id)}>
                Supprimer
              </button>
            </div>
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
        <summary>{editingId ? "Modifier la recette" : "Nouvelle recette"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
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
            legend="Catégories"
            options={sortedTags}
            selectedIds={form.categoryIds}
            onToggle={toggleCategoryId}
            createLink={`/creator?section=${encodeURIComponent("Tag")}`}
            matchesFilter={matchesTag}
            filterPlaceholder="Filtrer par nom..."
            buttonLabel="Ajouter catégories"
          />

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

          <QuantitySelectField
            legend="Ingrédients"
            options={sortedObjects}
            entries={form.ingredients}
            onToggle={toggleIngredient}
            onQtyChange={setIngredientQty}
            createLink={`/creator?section=${encodeURIComponent("Objets")}`}
            matchesFilter={matchesObject}
            filterPlaceholder="Filtrer par nom, description ou rareté..."
            buttonLabel="Ajouter ingrédients"
          />

          <QuantitySelectField
            legend="Résultats"
            options={sortedObjects}
            entries={form.results}
            onToggle={toggleResult}
            onQtyChange={setResultQty}
            createLink={`/creator?section=${encodeURIComponent("Objets")}`}
            matchesFilter={matchesObject}
            filterPlaceholder="Filtrer par nom, description ou rareté..."
            buttonLabel="Ajouter résultats"
          />

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer la recette"}</button>
            {editingId && (
              <button type="button" onClick={resetForm}>
                Annuler
              </button>
            )}
            {editingId && (
              <button type="button" onClick={() => handleDelete(editingId)}>
                Supprimer
              </button>
            )}
          </div>
        </form>
      </details>
    </div>
  );
}
