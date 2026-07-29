import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { RARITIES } from "./creator/TalentsManager";
import { matchesRecette, tagNames, objectEntryLabel, SORT_FIELDS, compareRecettes } from "./creator/RecettesManager";
import EmptyState from "./EmptyState";

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

const emptyFilters = { rarities: [], categoryIds: [], tagIds: [], text: "" };
const emptySort = { field: "name", dir: "asc" };

export default function XerotexRecipesTab({ character }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState(emptySort);

  const recettes = useItems("recettes");
  const tags = useItems("tags");
  const objects = useItems("objects");
  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  const knownRecipeIds = character.knownRecipes || [];
  const knownRecettes = recettes.filter((r) => knownRecipeIds.includes(r.id));

  const visibleRecettes = knownRecettes
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

  if (knownRecipeIds.length === 0) return <EmptyState text="Aucune recette connue pour l'instant." />;

  return (
    <div className="recipes-tab">
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
        <button type="button" onClick={() => setSort((prev) => ({ ...prev, dir: prev.dir === "asc" ? "desc" : "asc" }))}>
          {sort.dir === "asc" ? "Croissant" : "Décroissant"}
        </button>
      </fieldset>

      <ul className="creator-list">
        {visibleRecettes.length === 0 && <li className="empty-state">Aucune recette ne correspond aux filtres.</li>}
        {visibleRecettes.map((recette) => (
          <li key={recette.id} className="loot-table-item">
            <div className="loot-table-info">
              <strong>{recette.name}</strong> — {RARITIES.find((r) => r.value === recette.rarity)?.label || recette.rarity}
              <div>Catégories : {tagNames(recette.categoryIds, tags).join(", ") || "aucune"}</div>
              <div>Tags : {tagNames(recette.tagIds, tags).join(", ") || "aucun"}</div>
              <div>Ingrédients : {objectEntryLabel(recette.ingredients, objects).join(", ") || "aucun"}</div>
              <div>Résultats : {objectEntryLabel(recette.results, objects).join(", ") || "aucun"}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
