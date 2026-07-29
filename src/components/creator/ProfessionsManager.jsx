import { useEffect, useState } from "react";
import { collection, doc, writeBatch, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { PROFESSION_ACTION_KIND_ID, actionKindInheritsFrom } from "../../lib/actionKinds";
import { resolveKindId } from "../../lib/actionCatalog";
import { professionRef, syncProfessionActions, unlinkDeletedProfession } from "../../lib/professionActions";
import { matchesTalent } from "./TalentsManager";
import { matchesActionType } from "./ActionsManager";
import MultiSelectModalField from "./MultiSelectModalField";

// Matches a profession's name or description — for use as MultiSelectModalField's matchesFilter.
export function matchesProfession(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (option.name || "").toLowerCase().includes(q) || (option.description || "").toLowerCase().includes(q);
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

const emptyForm = {
  name: "",
  description: "",
  talentIds: [],
  minReputation: "",
  trainerTypeIds: [],
  evolutionId: "",
  actionIds: [],
};

const emptyFilters = { text: "" };

export default function ProfessionsManager() {
  const [professions, setProfessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [panelOpen, setPanelOpen] = useState(false);

  const talents = useItems("talents");
  const sortedTalents = [...talents].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const trainerTypes = useItems("trainerTypes");
  const actionTypes = useItems("actionTypes");
  // Only Métier actions can be attached to a profession: the link is what gates them, and an
  // Aventure action carrying professionIds would be a link nothing reads.
  const sortedActionTypes = actionTypes
    .filter((a) => actionKindInheritsFrom(resolveKindId(a), PROFESSION_ACTION_KIND_ID))
    .map((a) => ({ ...a, name: a.label }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
  const selectableProfessions = professions
    .filter((profession) => profession.id !== editingId)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "professions", "items"), (snap) => {
      setProfessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredProfessions = professions.filter((profession) => matchesProfession(profession, filters.text));

  function startEdit(profession) {
    setEditingId(profession.id);
    setForm({
      name: profession.name || "",
      description: profession.description || "",
      talentIds: profession.talentIds || [],
      minReputation: profession.minReputation ?? "",
      trainerTypeIds: profession.trainerTypeIds || [],
      evolutionId: profession.evolutionId || "",
      actionIds: profession.actionIds || [],
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function toggleTalentId(id) {
    setForm((prev) => ({
      ...prev,
      talentIds: prev.talentIds.includes(id) ? prev.talentIds.filter((x) => x !== id) : [...prev.talentIds, id],
    }));
  }

  function toggleTrainerTypeId(id) {
    setForm((prev) => ({
      ...prev,
      trainerTypeIds: prev.trainerTypeIds.includes(id)
        ? prev.trainerTypeIds.filter((x) => x !== id)
        : [...prev.trainerTypeIds, id],
    }));
  }

  function toggleActionId(id) {
    setForm((prev) => ({
      ...prev,
      actionIds: prev.actionIds.includes(id) ? prev.actionIds.filter((x) => x !== id) : [...prev.actionIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId ? professionRef(editingId) : doc(collection(db, "worldData", "professions", "items"));
    const previousActionIds = editingId ? professions.find((p) => p.id === editingId)?.actionIds || [] : [];

    // Attaching an action here writes the profession onto that action too, so the pair can't
    // disagree about which métiers may run it - see src/lib/professionActions.js.
    const batch = writeBatch(db);
    batch.set(ref, {
      name: form.name,
      description: form.description,
      talentIds: form.talentIds,
      minReputation: Number(form.minReputation) || 0,
      trainerTypeIds: form.trainerTypeIds,
      evolutionId: form.evolutionId,
      actionIds: form.actionIds,
    });
    syncProfessionActions(batch, ref.id, previousActionIds, form.actionIds);

    await batch.commit();
    resetForm();
  }

  async function handleDelete(profession) {
    const batch = writeBatch(db);
    batch.delete(professionRef(profession.id));
    unlinkDeletedProfession(batch, profession.id, actionTypes);
    await batch.commit();
    if (editingId === profession.id) resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Métiers</h2>

      <fieldset>
        <legend>Filtres</legend>
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
        {filteredProfessions.length === 0 && <li className="empty-state">Aucun métier.</li>}
        {filteredProfessions.map((profession) => (
          <li key={profession.id}>
            <strong>{profession.name}</strong>
            <div>{profession.description}</div>
            <div>Réputation minimale : {profession.minReputation || 0}</div>
            <div>
              Talents :{" "}
              {(profession.talentIds || []).map((id) => talents.find((t) => t.id === id)?.name || id).join(", ") ||
                "aucun"}
            </div>
            <div>
              Entraîneurs :{" "}
              {(profession.trainerTypeIds || [])
                .map((id) => trainerTypes.find((t) => t.id === id)?.name || id)
                .join(", ") || "aucun"}
            </div>
            <div>
              Actions associées :{" "}
              {(profession.actionIds || [])
                .map((id) => actionTypes.find((a) => a.id === id)?.label || id)
                .join(", ") || "aucune"}
            </div>
            {profession.evolutionId && (
              <div>
                Évolution : {professions.find((p) => p.id === profession.evolutionId)?.name || profession.evolutionId}
              </div>
            )}
            <button type="button" onClick={() => startEdit(profession)}>
              Modifier
            </button>
            <button type="button" onClick={() => handleDelete(profession)}>
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
        <summary>{editingId ? "Modifier le métier" : "Nouveau métier"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <MultiSelectModalField
            legend="Talents"
            options={sortedTalents}
            selectedIds={form.talentIds}
            onToggle={toggleTalentId}
            createLink={`/creator?section=${encodeURIComponent("Talents")}`}
            matchesFilter={matchesTalent}
            filterPlaceholder="Filtrer par nom, effet ou rareté..."
            buttonLabel="Ajouter talents"
          />

          <label>
            Réputation minimale
            <input
              type="number"
              step="1"
              value={form.minReputation}
              onChange={(e) => setForm({ ...form, minReputation: e.target.value })}
            />
          </label>

          <MultiSelectField
            legend="Entraîneurs"
            options={trainerTypes}
            selectedIds={form.trainerTypeIds}
            onToggle={toggleTrainerTypeId}
          />

          <MultiSelectModalField
            legend="Actions associées"
            options={sortedActionTypes}
            selectedIds={form.actionIds}
            onToggle={toggleActionId}
            createLink={`/creator?section=${encodeURIComponent("Actions")}`}
            matchesFilter={matchesActionType}
            filterPlaceholder="Filtrer par nom ou description..."
            buttonLabel="Ajouter des actions"
          />
          <p>
            Seules les actions de type Métier peuvent être associées. Les ajouter ici associe aussi ce métier à
            chacune d'elles.
          </p>

          <label>
            Évolution
            <select value={form.evolutionId} onChange={(e) => setForm({ ...form, evolutionId: e.target.value })}>
              <option value="">(aucune)</option>
              {selectableProfessions.map((profession) => (
                <option key={profession.id} value={profession.id}>
                  {profession.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer le métier"}</button>
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
