import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { actionState } from "../lib/actionLifecycle";
import { matchesRecette, objectEntryLabel } from "./creator/RecettesManager";
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

// The player-facing side of an Artisanat action (see ProfessionTab.jsx, which renders one of
// these per crafting action associated with the active profession): a searchable, alphabetically
// sorted list of the character's known recettes restricted to this action's recipeCategoryIds,
// a detail panel for whichever one is selected, and the "Commencer" button that actually starts
// the action - passing the recette id through so the server's "artisanat" handler
// (functions/src/actions/artisanat.js) knows what to craft.
export default function CraftingTab({ character, actionType }) {
  const recettes = useItems("recettes");
  const objects = useItems("objects");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const knownRecipeIds = character.knownRecipes || [];
  const recipeCategoryIds = actionType.recipeCategoryIds || [];

  const craftableRecettes = useMemo(() => {
    return recettes
      .filter((r) => knownRecipeIds.includes(r.id))
      .filter((r) => (r.categoryIds || []).some((id) => recipeCategoryIds.includes(id)))
      .filter((r) => matchesRecette(r, search))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recettes, character.knownRecipes, recipeCategoryIds, search]);

  // A recette that scrolls out of the filtered list (a search term, a recipe forgotten) can't
  // stay selected - the detail panel and the "Commencer" button both key off this id.
  useEffect(() => {
    if (selectedId && !craftableRecettes.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [craftableRecettes, selectedId]);

  const selected = craftableRecettes.find((r) => r.id === selectedId) || null;
  const running = actionState(character, now) !== "idle";

  function recetteTooltip(recette) {
    const ingredients = objectEntryLabel(recette.ingredients, objects).join(", ") || "aucun";
    const results = objectEntryLabel(recette.results, objects).join(", ") || "aucun";
    return `[Ingrédients : ${ingredients}][Résultats : ${results}]`;
  }

  async function handleStart() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const performAction = httpsCallable(functions, "performAction");
      await performAction({ actionTypeId: actionType.id, recetteId: selected.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="crafting-tab">
      <input
        type="text"
        placeholder="Rechercher une recette..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {craftableRecettes.length === 0 ? (
        <EmptyState text="Aucune recette connue pour cette action." />
      ) : (
        <ul className="recipe-list">
          {craftableRecettes.map((recette) => (
            <li key={recette.id}>
              <button
                type="button"
                className={recette.id === selectedId ? "selected" : ""}
                data-tooltip={recetteTooltip(recette)}
                onClick={() => setSelectedId(recette.id)}
              >
                {recette.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="recipe-detail">
        {selected ? (
          <>
            <h4>{selected.name}</h4>
            <div>Ingrédients : {objectEntryLabel(selected.ingredients, objects).join(", ") || "aucun"}</div>
            <div>Résultats : {objectEntryLabel(selected.results, objects).join(", ") || "aucun"}</div>
          </>
        ) : (
          <p className="empty-state">Sélectionnez une recette.</p>
        )}

        {running && <p className="error">Une action est déjà en cours.</p>}
        {error && <p className="error">{error}</p>}

        <button type="button" disabled={!selected || submitting || running} onClick={handleStart}>
          Commencer
        </button>
      </div>
    </div>
  );
}
