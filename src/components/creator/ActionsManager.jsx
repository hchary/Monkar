import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ACTION_CATEGORIES, actionCategoryLabel } from "../../lib/actionCategories";
import { CONDITION_TYPES } from "../../lib/actionConditions";
import { DEFAULT_DURATION_HOURS } from "../../lib/actionLifecycle";
import { matchesTalent } from "./TalentsManager";
import { matchesTag } from "./TagsManager";
import { matchesRegion } from "./RegionsManager";
import MultiSelectModalField from "./MultiSelectModalField";

// A handler is the escape hatch functions/src/lib/actionPipeline.js falls back from when it's
// null/unregistered - kept in step with functions/src/index.js's ACTION_HANDLERS by hand, since
// the creator UI can't see the server's registry. The closest thing to compile-time safety a
// Firestore-authored catalog can have (F2).
const KNOWN_HANDLER_IDS = ["partirEnQuete"];

// Matches an action's label or description - for use as MultiSelectModalField's matchesFilter,
// and as this manager's own free-text search.
export function matchesActionType(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (option.label || "").toLowerCase().includes(q) || (option.description || "").toLowerCase().includes(q);
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

// A closed set of typed predicates (docs/ISSUE-02-ACTION-FRAMEWORK.md §3.3) - the type select
// swaps in that type's own inputs, mirroring evaluateConditions' PREDICATES
// (src/lib/actionConditions.js) field for field.
function ConditionRow({ condition, index, onTypeChange, onFieldChange, onRemove, talents, tags, regions }) {
  const type = condition.type;

  return (
    <fieldset className="condition-row">
      <legend>
        <select value={type} onChange={(e) => onTypeChange(index, e.target.value)}>
          {CONDITION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => onRemove(index)}>
          Supprimer
        </button>
      </legend>

      {type === "hasTalent" && (
        <MultiSelectModalField
          legend="Talent requis"
          options={talents}
          selectedIds={condition.talentId ? [condition.talentId] : []}
          onToggle={(id) => onFieldChange(index, { talentId: id })}
          matchesFilter={matchesTalent}
          filterPlaceholder="Filtrer par nom, effet ou rareté..."
          buttonLabel="Choisir le talent"
        />
      )}

      {(type === "hasTalentTag" || type === "hasInstanceTag") && (
        <MultiSelectModalField
          legend={type === "hasTalentTag" ? "Tag de talent requis" : "Tag d'objet requis"}
          options={tags}
          selectedIds={condition.tagId ? [condition.tagId] : []}
          onToggle={(id) => onFieldChange(index, { tagId: id })}
          matchesFilter={matchesTag}
          filterPlaceholder="Filtrer par nom..."
          buttonLabel="Choisir le tag"
        />
      )}

      {(type === "hasTalent" || type === "hasTalentTag") && (
        <label>
          Qualité minimale
          <input
            type="number"
            min="1"
            placeholder="1"
            value={condition.minQuality ?? ""}
            onChange={(e) =>
              onFieldChange(index, { minQuality: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </label>
      )}

      {(type === "minReputation" || type === "minLegendLevel") && (
        <label>
          {type === "minReputation" ? "Réputation minimale" : "Niveau de légende minimal"}
          <input
            type="number"
            value={condition.value ?? ""}
            onChange={(e) =>
              onFieldChange(index, { value: e.target.value === "" ? undefined : Number(e.target.value) })
            }
          />
        </label>
      )}

      {type === "profession" && (
        <label>
          Métiers autorisés (séparés par des virgules)
          <input
            type="text"
            value={(condition.values || []).join(", ")}
            onChange={(e) =>
              onFieldChange(index, {
                values: e.target.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      )}

      {type === "region" && (
        <MultiSelectModalField
          legend="Régions autorisées"
          options={regions}
          selectedIds={condition.regionIds || []}
          onToggle={(id) =>
            onFieldChange(index, {
              regionIds: (condition.regionIds || []).includes(id)
                ? condition.regionIds.filter((x) => x !== id)
                : [...(condition.regionIds || []), id],
            })
          }
          matchesFilter={matchesRegion}
          filterPlaceholder="Filtrer par nom ou description..."
        />
      )}

      {type === "notWounded" && <p>Aucun paramètre pour cette condition.</p>}
    </fieldset>
  );
}

const emptyFilters = { categoryIds: [], enabledFilter: "all", text: "" };

const emptyForm = {
  label: "",
  categoryId: ACTION_CATEGORIES[0].value,
  description: "",
  order: 0,
  enabled: true,
  handlerId: "",
  durationHours: DEFAULT_DURATION_HOURS,
  conditions: [],
  unmetBehaviour: "hide",
  unmetMessage: "",
  accentSource: "category",
  showLoot: false,
};

export default function ActionsManager() {
  const [actionTypes, setActionTypes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [panelOpen, setPanelOpen] = useState(false);

  const talents = useItems("talents");
  const sortedTalents = [...talents].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const tags = useItems("tags");
  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const regions = useItems("regions");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "actionTypes", "items"), (snap) => {
      setActionTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredActionTypes = actionTypes.filter((actionType) => {
    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(actionType.categoryId)) return false;
    if (filters.enabledFilter === "enabled" && actionType.enabled === false) return false;
    if (filters.enabledFilter === "disabled" && actionType.enabled !== false) return false;
    if (!matchesActionType(actionType, filters.text)) return false;
    return true;
  });

  function toggleFilterCategory(value) {
    setFilters((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(value)
        ? prev.categoryIds.filter((c) => c !== value)
        : [...prev.categoryIds, value],
    }));
  }

  function startEdit(actionType) {
    setEditingId(actionType.id);
    const availability = actionType.availability || {};
    const result = actionType.result || {};
    setForm({
      label: actionType.label || "",
      categoryId: actionType.categoryId || ACTION_CATEGORIES[0].value,
      description: actionType.description || "",
      order: Number.isFinite(Number(actionType.order)) ? Number(actionType.order) : 0,
      enabled: actionType.enabled !== false,
      handlerId: actionType.handlerId || "",
      durationHours: Number.isFinite(Number(actionType.durationHours))
        ? Number(actionType.durationHours)
        : DEFAULT_DURATION_HOURS,
      conditions: Array.isArray(availability.conditions) ? availability.conditions : [],
      unmetBehaviour: availability.unmetBehaviour === "disable" ? "disable" : "hide",
      unmetMessage: availability.unmetMessage || "",
      accentSource: result.accentSource === "difficulty" ? "difficulty" : "category",
      showLoot: result.showLoot === true,
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function addCondition() {
    setForm((prev) => ({ ...prev, conditions: [...prev.conditions, { type: CONDITION_TYPES[0].value }] }));
  }

  function removeCondition(index) {
    setForm((prev) => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== index) }));
  }

  function replaceConditionType(index, type) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? { type } : c)),
    }));
  }

  function patchCondition(index, patch) {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  const handlerIsUnknown = !!form.handlerId && !KNOWN_HANDLER_IDS.includes(form.handlerId);

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "actionTypes", "items", editingId)
      : doc(collection(db, "worldData", "actionTypes", "items"));

    // tiers and questDifficultyWeights are out of scope here (§3.8, D14) and are left exactly as
    // they are in Firestore - merge:true only touches the fields this form actually owns.
    await setDoc(
      ref,
      {
        label: form.label,
        categoryId: form.categoryId,
        description: form.description,
        order: Number(form.order) || 0,
        enabled: form.enabled,
        handlerId: form.handlerId || null,
        durationHours: Number(form.durationHours) || DEFAULT_DURATION_HOURS,
        availability: {
          conditions: form.conditions,
          unmetBehaviour: form.unmetBehaviour,
          unmetMessage: form.unmetMessage,
        },
        result: {
          accentSource: form.accentSource,
          showLoot: form.showLoot,
        },
      },
      { merge: true }
    );
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Actions</h2>

      <fieldset>
        <legend>Filtres</legend>
        <MultiSelectField
          legend="Catégories"
          options={ACTION_CATEGORIES.map((c) => ({ id: c.value, name: c.label }))}
          selectedIds={filters.categoryIds}
          onToggle={toggleFilterCategory}
        />
        <label>
          État
          <select
            value={filters.enabledFilter}
            onChange={(e) => setFilters({ ...filters, enabledFilter: e.target.value })}
          >
            <option value="all">Toutes</option>
            <option value="enabled">Activées seulement</option>
            <option value="disabled">Désactivées seulement</option>
          </select>
        </label>
        <input
          placeholder="Rechercher par nom ou description..."
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        />
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredActionTypes.length === 0 && <li className="empty-state">Aucune action.</li>}
        {filteredActionTypes.map((actionType) => {
          const unknownHandler = actionType.handlerId && !KNOWN_HANDLER_IDS.includes(actionType.handlerId);
          return (
            <li key={actionType.id}>
              <strong>{actionType.label}</strong>
              {actionType.enabled === false && " (désactivée)"} —{" "}
              {actionCategoryLabel(actionType.categoryId) || "sans catégorie"}
              <div>{actionType.description}</div>
              <div>
                Gestionnaire : {actionType.handlerId || "générique"}
                {unknownHandler && <span className="error"> — gestionnaire inconnu</span>}
              </div>
              <div>Durée : {actionType.durationHours || DEFAULT_DURATION_HOURS} h</div>
              <div>Conditions : {(actionType.availability?.conditions || []).length}</div>
              <button type="button" onClick={() => startEdit(actionType)}>
                Modifier
              </button>
              <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "actionTypes", "items", actionType.id))}>
                Supprimer
              </button>
            </li>
          );
        })}
      </ul>

      <details
        className="collapsible-group"
        open={panelOpen}
        onToggle={(e) => {
          if (e.target === e.currentTarget) setPanelOpen(e.target.open);
        }}
      >
        <summary>{editingId ? "Modifier l'action" : "Nouvelle action"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />

          <label>
            Catégorie
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required>
              {ACTION_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <textarea
            placeholder="Description (affichée sur l'onglet de l'action)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <label>
            Ordre d'affichage
            <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
          </label>

          <label>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Activée
          </label>

          <label>
            Gestionnaire
            <select value={form.handlerId} onChange={(e) => setForm({ ...form, handlerId: e.target.value })}>
              <option value="">Aucun (générique)</option>
              {KNOWN_HANDLER_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
              {handlerIsUnknown && <option value={form.handlerId}>{form.handlerId} (inconnu)</option>}
            </select>
          </label>
          {handlerIsUnknown && (
            <p className="error">
              Ce gestionnaire n'est pas enregistré côté serveur (functions/src/index.js) — l'action résoudra en
              générique tant qu'il n'y est pas ajouté.
            </p>
          )}

          <label>
            Durée (heures)
            <input
              type="number"
              min="1"
              value={form.durationHours}
              onChange={(e) => setForm({ ...form, durationHours: e.target.value })}
            />
          </label>

          <fieldset>
            <legend>Conditions de disponibilité</legend>

            <label>
              Comportement si non remplies
              <select value={form.unmetBehaviour} onChange={(e) => setForm({ ...form, unmetBehaviour: e.target.value })}>
                <option value="hide">Masquer l'action</option>
                <option value="disable">Afficher désactivée</option>
              </select>
            </label>

            {form.unmetBehaviour === "disable" && (
              <input
                placeholder="Message affiché quand la condition n'est pas remplie"
                value={form.unmetMessage}
                onChange={(e) => setForm({ ...form, unmetMessage: e.target.value })}
              />
            )}

            <div className="condition-editor">
              {form.conditions.length === 0 && <p>Aucune condition — l'action est toujours disponible.</p>}
              {form.conditions.map((condition, index) => (
                <ConditionRow
                  key={index}
                  index={index}
                  condition={condition}
                  onTypeChange={replaceConditionType}
                  onFieldChange={patchCondition}
                  onRemove={removeCondition}
                  talents={sortedTalents}
                  tags={sortedTags}
                  regions={regions}
                />
              ))}
              <button type="button" onClick={addCondition}>
                Ajouter une condition
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Résultat</legend>
            <label>
              Couleur d'accentuation
              <select value={form.accentSource} onChange={(e) => setForm({ ...form, accentSource: e.target.value })}>
                <option value="category">Catégorie</option>
                <option value="difficulty">Difficulté (si le gestionnaire en fournit une)</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.showLoot}
                onChange={(e) => setForm({ ...form, showLoot: e.target.checked })}
              />
              Afficher le butin dans le résultat
            </label>
          </fieldset>

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer l'action"}</button>
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
