import { useEffect, useState } from "react";
import { collection, doc, writeBatch, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  ACTION_KINDS,
  PROFESSION_ACTION_KIND_ID,
  HARVEST_ACTION_KIND_ID,
  CRAFTING_ACTION_KIND_ID,
  TRAINING_ACTION_KIND_ID,
  actionKindInheritsFrom,
  actionKindLabel,
  actionKindsInTreeOrder,
} from "../../lib/actionKinds";
import { CONDITION_TYPES } from "../../lib/actionConditions";
import { resolveKindId } from "../../lib/actionCatalog";
import { DEFAULT_DURATION_HOURS } from "../../lib/actionLifecycle";
import { actionTypeRef, syncActionProfessions, unlinkDeletedAction } from "../../lib/professionActions";
import { matchesTalent, RARITIES } from "./TalentsManager";
import { matchesTag } from "./TagsManager";
import { matchesRegion } from "./RegionsManager";
// ProfessionsManager imports matchesActionType back from here. The cycle is safe and stays safe as
// long as both sides only export hoisted function declarations called at render time, never
// values read while the module is evaluating.
import { matchesProfession } from "./ProfessionsManager";
import MultiSelectModalField from "./MultiSelectModalField";

// Every action must resolve through one of these - functions/src/lib/actionPipeline.js refuses to
// start an action whose handlerId names nothing in functions/src/index.js's ACTION_HANDLERS (see
// "Abandoning the paliers system" in docs/ISSUE-02-ACTION-FRAMEWORK.md). Kept in step with that
// registry by hand, since the creator UI can't see the server's registry - the closest thing to
// compile-time safety a Firestore-authored catalog can have (F2).
const KNOWN_HANDLER_IDS = [
  "partirEnQuete",
  "recolte",
  "artisanat",
  "rumeur",
  "mission",
  "sEntrainer",
  "apprentissage",
  "partirExplorer",
  "faireDuCommerce",
];

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

const emptyFilters = { kindIds: [], enabledFilter: "all", text: "" };

const emptyForm = {
  label: "",
  kindId: ACTION_KINDS[0].value,
  description: "",
  professionIds: [],
  order: 0,
  enabled: true,
  handlerId: "",
  durationHours: DEFAULT_DURATION_HOURS,
  conditions: [],
  unmetBehaviour: "hide",
  unmetMessage: "",
  accentSource: "category",
  showLoot: false,
  lootTagIds: [],
  rarity: RARITIES[0].value,
  recipeCategoryIds: [],
  trainerTypeId: "",
  rumorHarvestCount: 1,
  missionRollCount: 3,
  encounterCount: 1,
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
  const professions = useItems("professions");
  const sortedProfessions = [...professions].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const trainerTypes = useItems("trainerTypes");
  const sortedTrainerTypes = [...trainerTypes].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "actionTypes", "items"), (snap) => {
      setActionTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Filtering by a kind includes everything beneath it, so picking "Métier" also lists Récolte
  // actions (and any future Artisanat/Transport ones) rather than only the ones typed as Métier
  // itself.
  const filteredActionTypes = actionTypes.filter((actionType) => {
    const kindId = resolveKindId(actionType);
    if (filters.kindIds.length > 0 && !filters.kindIds.some((id) => actionKindInheritsFrom(kindId, id))) return false;
    if (filters.enabledFilter === "enabled" && actionType.enabled === false) return false;
    if (filters.enabledFilter === "disabled" && actionType.enabled !== false) return false;
    if (!matchesActionType(actionType, filters.text)) return false;
    return true;
  });

  function toggleFilterKind(value) {
    setFilters((prev) => ({
      ...prev,
      kindIds: prev.kindIds.includes(value) ? prev.kindIds.filter((k) => k !== value) : [...prev.kindIds, value],
    }));
  }

  function startEdit(actionType) {
    setEditingId(actionType.id);
    const availability = actionType.availability || {};
    const result = actionType.result || {};
    setForm({
      label: actionType.label || "",
      // A document authored before kinds existed reads its categoryId as its kind, exactly as
      // normalizeActionType does - editing it then saves the kindId it always implied.
      kindId: resolveKindId(actionType) || ACTION_KINDS[0].value,
      description: actionType.description || "",
      professionIds: actionType.professionIds || [],
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
      lootTagIds: actionType.lootTagIds || [],
      rarity: actionType.rarity || RARITIES[0].value,
      recipeCategoryIds: actionType.recipeCategoryIds || [],
      trainerTypeId: actionType.trainerTypeId || "",
      rumorHarvestCount: Number.isFinite(Number(actionType.rumorHarvestCount)) ? Number(actionType.rumorHarvestCount) : 1,
      missionRollCount: Number.isFinite(Number(actionType.missionRollCount)) ? Number(actionType.missionRollCount) : 3,
      encounterCount: Number.isFinite(Number(actionType.encounterCount)) ? Number(actionType.encounterCount) : 1,
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
  // Only the Métier branch of the tree carries a profession link; every other kind hides the
  // picker and saves an empty list, so switching an action out of Métier drops its links.
  const isProfessionAction = actionKindInheritsFrom(form.kindId, PROFESSION_ACTION_KIND_ID);
  // Only the Récolte branch carries loot tags/rarity - same convention as isProfessionAction:
  // switching an action out of Récolte drops them rather than leaving stale, unused fields.
  const isHarvestAction = actionKindInheritsFrom(form.kindId, HARVEST_ACTION_KIND_ID);
  // Only the Artisanat branch carries recipe categories - same convention as isHarvestAction.
  const isCraftingAction = actionKindInheritsFrom(form.kindId, CRAFTING_ACTION_KIND_ID);
  // Only the Entraînement branch carries a trainer type link - same convention as isHarvestAction.
  const isTrainingAction = actionKindInheritsFrom(form.kindId, TRAINING_ACTION_KIND_ID);
  // Gated by handlerId rather than kindId, unlike the three fields above: intermede/aventure each
  // host several unrelated action archetypes (docs/TODO.md "Intermède actions", "Aventure
  // exploration mechanics"), so kindId alone can't tell a Rumeur action apart from a sibling one.
  const isRumeurAction = form.handlerId === "rumeur";
  // Same gating convention as isRumeurAction - only meaningful for the "partirExplorer" handler.
  const isPartirExplorerAction = form.handlerId === "partirExplorer";

  function toggleProfessionId(id) {
    setForm((prev) => ({
      ...prev,
      professionIds: prev.professionIds.includes(id)
        ? prev.professionIds.filter((x) => x !== id)
        : [...prev.professionIds, id],
    }));
  }

  function toggleLootTagId(id) {
    setForm((prev) => ({
      ...prev,
      lootTagIds: prev.lootTagIds.includes(id) ? prev.lootTagIds.filter((x) => x !== id) : [...prev.lootTagIds, id],
    }));
  }

  function toggleRecipeCategoryId(id) {
    setForm((prev) => ({
      ...prev,
      recipeCategoryIds: prev.recipeCategoryIds.includes(id)
        ? prev.recipeCategoryIds.filter((x) => x !== id)
        : [...prev.recipeCategoryIds, id],
    }));
  }

  function setTrainerTypeId(id) {
    setForm((prev) => ({ ...prev, trainerTypeId: id }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId ? actionTypeRef(editingId) : doc(collection(db, "worldData", "actionTypes", "items"));
    const professionIds = isProfessionAction ? form.professionIds : [];
    const previousProfessionIds = editingId
      ? actionTypes.find((a) => a.id === editingId)?.professionIds || []
      : [];

    // The action and the professions it points at are written together: the link is stored on
    // both ends (see src/lib/professionActions.js), so a half-committed save would leave the two
    // disagreeing about which métiers may run this action.
    const batch = writeBatch(db);

    // questDifficultyWeights is out of scope here (§3.8) and left exactly as it is in Firestore -
    // merge:true only touches the fields this form actually owns. tiers is no longer a field the
    // framework understands at all (paliers were retired - see "Abandoning the paliers system" in
    // docs/ISSUE-02-ACTION-FRAMEWORK.md); a leftover tiers array on an old document is inert
    // clutter, safe to delete by hand.
    // categoryId is no longer written at all: it is derived from kindId at read time.
    batch.set(
      ref,
      {
        label: form.label,
        kindId: form.kindId,
        description: form.description,
        professionIds,
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
        lootTagIds: isHarvestAction ? form.lootTagIds : [],
        rarity: isHarvestAction ? form.rarity : null,
        recipeCategoryIds: isCraftingAction ? form.recipeCategoryIds : [],
        trainerTypeId: isTrainingAction ? form.trainerTypeId || null : null,
        rumorHarvestCount: isRumeurAction ? Number(form.rumorHarvestCount) || 1 : 1,
        missionRollCount: isRumeurAction ? Number(form.missionRollCount) || 3 : 3,
        encounterCount: isPartirExplorerAction ? Number(form.encounterCount) || 1 : 1,
      },
      { merge: true }
    );
    syncActionProfessions(batch, ref.id, previousProfessionIds, professionIds);

    await batch.commit();
    resetForm();
  }

  async function handleDelete(actionType) {
    const batch = writeBatch(db);
    batch.delete(actionTypeRef(actionType.id));
    unlinkDeletedAction(batch, actionType.id, professions);
    await batch.commit();
    if (editingId === actionType.id) resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Actions</h2>

      <fieldset>
        <legend>Filtres</legend>
        <MultiSelectField
          legend="Types d'action"
          options={actionKindsInTreeOrder().map((k) => ({ id: k.value, name: `${"— ".repeat(k.depth)}${k.label}` }))}
          selectedIds={filters.kindIds}
          onToggle={toggleFilterKind}
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
          const missingHandler = !actionType.handlerId;
          const kindId = resolveKindId(actionType);
          const isMetier = actionKindInheritsFrom(kindId, PROFESSION_ACTION_KIND_ID);
          const isHarvest = actionKindInheritsFrom(kindId, HARVEST_ACTION_KIND_ID);
          const isCrafting = actionKindInheritsFrom(kindId, CRAFTING_ACTION_KIND_ID);
          const isTraining = actionKindInheritsFrom(kindId, TRAINING_ACTION_KIND_ID);
          return (
            <li key={actionType.id}>
              <strong>{actionType.label}</strong>
              {actionType.enabled === false && " (désactivée)"} — {actionKindLabel(kindId) || "sans type"}
              <div>{actionType.description}</div>
              {isMetier && (
                <div>
                  Métiers associés :{" "}
                  {(actionType.professionIds || [])
                    .map((id) => professions.find((p) => p.id === id)?.name || id)
                    .join(", ") || <span className="error">aucun — l'action n'est accessible à personne</span>}
                </div>
              )}
              {isHarvest && (
                <div>
                  Tags de butin :{" "}
                  {(actionType.lootTagIds || []).map((id) => tags.find((t) => t.id === id)?.name || id).join(", ") ||
                    "aucun"}
                  {" — "}Rareté : {RARITIES.find((r) => r.value === actionType.rarity)?.label || "non définie"}
                </div>
              )}
              {isCrafting && (
                <div>
                  Catégories de recettes :{" "}
                  {(actionType.recipeCategoryIds || []).map((id) => tags.find((t) => t.id === id)?.name || id).join(", ") ||
                    <span className="error">aucune — l'action ne pourra fabriquer aucune recette</span>}
                </div>
              )}
              {isTraining && (
                <div>
                  Type d'entraîneur :{" "}
                  {trainerTypes.find((t) => t.id === actionType.trainerTypeId)?.name || (
                    <span className="error">aucun</span>
                  )}
                </div>
              )}
              {actionType.handlerId === "rumeur" && (
                <div>
                  Rumeurs récoltées : {actionType.rumorHarvestCount ?? 1} — Missions générées :{" "}
                  {actionType.missionRollCount ?? 3}
                </div>
              )}
              {actionType.handlerId === "partirExplorer" && (
                <div>Rencontres par exploration : {actionType.encounterCount ?? 1}</div>
              )}
              <div>
                Gestionnaire : {actionType.handlerId || "aucun"}
                {unknownHandler && <span className="error"> — gestionnaire inconnu</span>}
                {missingHandler && <span className="error"> — action inutilisable, aucun gestionnaire configuré</span>}
              </div>
              <div>Durée : {actionType.durationHours || DEFAULT_DURATION_HOURS} h</div>
              <div>Conditions : {(actionType.availability?.conditions || []).length}</div>
              <button type="button" onClick={() => startEdit(actionType)}>
                Modifier
              </button>
              <button type="button" onClick={() => handleDelete(actionType)}>
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
            Type d'action
            <select value={form.kindId} onChange={(e) => setForm({ ...form, kindId: e.target.value })} required>
              {actionKindsInTreeOrder().map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {"— ".repeat(kind.depth)}
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            L'action hérite de ce type : sa catégorie dans le panneau de jeu en découle, ainsi que les champs
            ci-dessous.
          </p>

          <textarea
            placeholder="Description (affichée sur l'onglet de l'action)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          {isProfessionAction && (
            <>
              <MultiSelectModalField
                legend="Métiers associés"
                options={sortedProfessions}
                selectedIds={form.professionIds}
                onToggle={toggleProfessionId}
                createLink={`/creator?section=${encodeURIComponent("Métiers")}`}
                matchesFilter={matchesProfession}
                filterPlaceholder="Filtrer par nom ou description..."
                buttonLabel="Ajouter des métiers"
              />
              <p>
                Seuls les personnages exerçant l'un de ces métiers verront cette action. L'enregistrer l'ajoute aussi
                aux actions associées de chacun d'eux.
              </p>
              {form.professionIds.length === 0 && (
                <p className="error">
                  Sans métier associé, cette action ne sera accessible à aucun personnage.
                </p>
              )}
            </>
          )}

          {isHarvestAction && (
            <>
              <MultiSelectModalField
                legend="Tags de butin"
                options={sortedTags}
                selectedIds={form.lootTagIds}
                onToggle={toggleLootTagId}
                createLink={`/creator?section=${encodeURIComponent("Tag")}`}
                matchesFilter={matchesTag}
                filterPlaceholder="Filtrer par nom..."
                buttonLabel="Ajouter des tags de butin"
              />
              <label>
                Rareté du butin
                <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>
                  {RARITIES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Une table de tirage sera choisie au hasard parmi celles portant l'un de ces tags et cette rareté ; la
                quantité de base récoltée est la somme des niveaux de maîtrise des métiers associés que le personnage
                connaît.
              </p>
            </>
          )}

          {isCraftingAction && (
            <>
              <MultiSelectModalField
                legend="Catégories de recettes"
                options={sortedTags}
                selectedIds={form.recipeCategoryIds}
                onToggle={toggleRecipeCategoryId}
                createLink={`/creator?section=${encodeURIComponent("Tag")}`}
                matchesFilter={matchesTag}
                filterPlaceholder="Filtrer par nom..."
                buttonLabel="Ajouter des catégories de recettes"
              />
              <p>
                Sur la fiche de personnage, cette action affiche les recettes connues dont l'une des catégories
                figure ici, filtrables et sélectionnables pour être fabriquées.
              </p>
              {form.recipeCategoryIds.length === 0 && (
                <p className="error">
                  Sans catégorie de recettes, cette action ne pourra fabriquer aucune recette.
                </p>
              )}
            </>
          )}

          {isTrainingAction && (
            <>
              <label>
                Type d'entraîneur
                <select value={form.trainerTypeId} onChange={(e) => setTrainerTypeId(e.target.value)}>
                  <option value="">Aucun</option>
                  {sortedTrainerTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              {!form.trainerTypeId && (
                <p className="error">
                  Sans type d'entraîneur, cette action ne sera accessible depuis aucune région.
                </p>
              )}
            </>
          )}

          {isRumeurAction && (
            <>
              <label>
                Nombre de rumeurs récoltées
                <input
                  type="number"
                  min="0"
                  value={form.rumorHarvestCount}
                  onChange={(e) => setForm({ ...form, rumorHarvestCount: e.target.value })}
                />
              </label>
              <label>
                Nombre de missions générées
                <input
                  type="number"
                  min="0"
                  value={form.missionRollCount}
                  onChange={(e) => setForm({ ...form, missionRollCount: e.target.value })}
                />
              </label>
              <p>
                À chaque résolution : récolte jusqu'à ce nombre de rumeurs rares ou plus de la région actuelle, et
                génère ce nombre de missions (remplaçant celles non réclamées).
              </p>
            </>
          )}

          {isPartirExplorerAction && (
            <>
              <label>
                Nombre de rencontres
                <input
                  type="number"
                  min="1"
                  value={form.encounterCount}
                  onChange={(e) => setForm({ ...form, encounterCount: e.target.value })}
                />
              </label>
              <p>
                À chaque résolution : tire un lieu au hasard dans la région actuelle, puis résout ce nombre de
                rencontres à la suite (chacune un jet complet façon "Partir en quête"), en s'arrêtant plus tôt si une
                blessure tue le personnage.
              </p>
            </>
          )}

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
            <select
              value={form.handlerId}
              onChange={(e) => setForm({ ...form, handlerId: e.target.value })}
              required
            >
              <option value="" disabled>
                Choisir un gestionnaire...
              </option>
              {KNOWN_HANDLER_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
              {handlerIsUnknown && <option value={form.handlerId}>{form.handlerId} (inconnu)</option>}
            </select>
          </label>
          <p>
            Une action sans gestionnaire ne peut pas être lancée par un joueur - le serveur la refuse.
          </p>
          {handlerIsUnknown && (
            <p className="error">
              Ce gestionnaire n'est pas enregistré côté serveur (functions/src/index.js) — l'action sera refusée
              tant qu'il n'y est pas ajouté.
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
