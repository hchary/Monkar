import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { RARITIES } from "./TalentsManager";
import { OBJECTIVE_TAG, matchesQuestObjective } from "./QuestObjectivesManager";
import { matchesVerbPhrase } from "./TextGenerationManager";
import { matchesRegion } from "./RegionsManager";
import { capitalizeSubject } from "./NarrativeSubjectList";
import MultiSelectModalField from "./MultiSelectModalField";

// Matches a quest's name — for use as MultiSelectModalField's matchesFilter (e.g. TalentsManager's favoredQuestIds).
export function matchesQuest(option, query) {
  const q = query.toLowerCase();
  return !q || (option.name || "").toLowerCase().includes(q);
}

const emptyFilters = { objectiveIds: [], rarities: [], regionIds: [], locationId: "" };

const emptyForm = {
  name: "",
  objectiveIds: [],
  rarities: [],
  successPhraseIds: [],
  failurePhraseIds: [],
  regionIds: [],
  locationId: "",
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

function subjectLabel(subject) {
  return `${capitalizeSubject(subject.article)} ${subject.nom}`;
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
        <label key={option.id} title={getTooltip ? getTooltip(option) : undefined}>
          <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => onToggle(option.id)} />
          {option.name}
        </label>
      ))}
    </fieldset>
  );
}

export default function QuestsManager() {
  const [quests, setQuests] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [panelOpen, setPanelOpen] = useState(false);

  const subjects = useItems("narrativeSubjects");
  const objectives = subjects.filter((subject) => (subject.tags || []).includes(OBJECTIVE_TAG));
  const regions = useItems("regions");
  const locations = useItems("adventureZones");
  const verbPhrases = useItems("verbPhrases");
  const successPhrases = verbPhrases.filter((vp) => vp.resultat === "victoire");
  const failurePhrases = verbPhrases.filter((vp) => vp.resultat === "echec");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "quests", "items"), (snap) => {
      setQuests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // The filters selected on the list above are applied as default values to the matching fields below.
  useEffect(() => {
    if (editingId) return;
    setForm((prev) => ({
      ...prev,
      objectiveIds: filters.objectiveIds,
      rarities: filters.rarities,
      regionIds: filters.regionIds,
      locationId: filters.locationId,
    }));
  }, [filters, editingId]);

  const filteredQuests = quests.filter((quest) => {
    if (filters.objectiveIds.length > 0 && !(quest.objectiveIds || []).some((id) => filters.objectiveIds.includes(id))) {
      return false;
    }
    if (filters.rarities.length > 0 && !(quest.rarities || []).some((r) => filters.rarities.includes(r))) {
      return false;
    }
    if (filters.regionIds.length > 0 && !(quest.regionIds || []).some((id) => filters.regionIds.includes(id))) {
      return false;
    }
    if (filters.locationId && quest.locationId !== filters.locationId) {
      return false;
    }
    return true;
  });

  function toggleFilter(field, id) {
    setFilters((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
  }

  function startEdit(quest) {
    setEditingId(quest.id);
    setForm({
      name: quest.name || "",
      objectiveIds: quest.objectiveIds || [],
      rarities: quest.rarities || [],
      successPhraseIds: quest.successPhraseIds || [],
      failurePhraseIds: quest.failurePhraseIds || [],
      regionIds: quest.regionIds || [],
      locationId: quest.locationId || "",
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      objectiveIds: filters.objectiveIds,
      rarities: filters.rarities,
      regionIds: filters.regionIds,
      locationId: filters.locationId,
    });
  }

  function toggleIn(field, id) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "quests", "items", editingId)
      : doc(collection(db, "worldData", "quests", "items"));

    await setDoc(ref, {
      name: form.name,
      objectiveIds: form.objectiveIds,
      rarities: form.rarities,
      successPhraseIds: form.successPhraseIds,
      failurePhraseIds: form.failurePhraseIds,
      regionIds: form.regionIds,
      locationId: form.locationId,
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Quêtes</h2>

      <fieldset>
        <legend>Filtres</legend>
        <MultiSelectField
          legend="Objectifs de quête"
          options={objectives.map((o) => ({ id: o.id, name: subjectLabel(o) }))}
          selectedIds={filters.objectiveIds}
          onToggle={(id) => toggleFilter("objectiveIds", id)}
        />
        <MultiSelectField
          legend="Raretés"
          options={RARITIES.map((r) => ({ id: r.value, name: r.label }))}
          selectedIds={filters.rarities}
          onToggle={(id) => toggleFilter("rarities", id)}
        />
        <MultiSelectField
          legend="Régions possibles"
          options={regions}
          selectedIds={filters.regionIds}
          onToggle={(id) => toggleFilter("regionIds", id)}
        />
        <label>
          Lieu de quête
          <select value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })}>
            <option value="">Tous</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setFilters(emptyFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredQuests.map((quest) => (
          <li key={quest.id}>
            <strong>{quest.name}</strong>
            <div>
              Objectifs :{" "}
              {(quest.objectiveIds || [])
                .map((id) => {
                  const subject = objectives.find((o) => o.id === id);
                  return subject ? subjectLabel(subject) : id;
                })
                .join(", ") || "aucun"}
            </div>
            <div>
              Raretés :{" "}
              {(quest.rarities || [])
                .map((value) => RARITIES.find((r) => r.value === value)?.label || value)
                .join(", ") || "aucune"}
            </div>
            <div>
              Régions possibles :{" "}
              {(quest.regionIds || []).map((id) => regions.find((r) => r.id === id)?.name || id).join(", ") || "aucune"}
            </div>
            <div>Lieu de quête : {locations.find((l) => l.id === quest.locationId)?.name || "aucun"}</div>
            <div>
              Phrases de réussite : {(quest.successPhraseIds || []).length} — Phrases d'échec :{" "}
              {(quest.failurePhraseIds || []).length}
            </div>
            <button type="button" onClick={() => startEdit(quest)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "quests", "items", quest.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <details className="collapsible-group" open={panelOpen} onToggle={(e) => setPanelOpen(e.target.open)}>
        <summary>{editingId ? "Modifier la quête" : "Nouvelle quête"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

          <MultiSelectModalField
            legend="Objectifs de quête"
            options={objectives.map((o) => ({ ...o, name: subjectLabel(o) }))}
            selectedIds={form.objectiveIds}
            onToggle={(id) => toggleIn("objectiveIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Objectifs de quête")}`}
            matchesFilter={matchesQuestObjective}
            filterPlaceholder="Filtrer par nom ou tag..."
          />

          <MultiSelectField
            legend="Raretés possibles"
            options={RARITIES.map((r) => ({ id: r.value, name: r.label }))}
            selectedIds={form.rarities}
            onToggle={(id) => toggleIn("rarities", id)}
          />

          <MultiSelectModalField
            legend="Phrases de réussite"
            options={successPhrases.map((vp) => ({ ...vp, name: vp.template }))}
            selectedIds={form.successPhraseIds}
            onToggle={(id) => toggleIn("successPhraseIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Génération de texte")}`}
            matchesFilter={matchesVerbPhrase}
            filterPlaceholder="Filtrer par texte, cible ou tag..."
          />

          <MultiSelectModalField
            legend="Phrases d'échec"
            options={failurePhrases.map((vp) => ({ ...vp, name: vp.template }))}
            selectedIds={form.failurePhraseIds}
            onToggle={(id) => toggleIn("failurePhraseIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Génération de texte")}`}
            matchesFilter={matchesVerbPhrase}
            filterPlaceholder="Filtrer par texte, cible ou tag..."
          />

          <MultiSelectModalField
            legend="Régions possibles"
            options={regions}
            selectedIds={form.regionIds}
            onToggle={(id) => toggleIn("regionIds", id)}
            createLink={`/creator?section=${encodeURIComponent("Régions")}`}
            matchesFilter={matchesRegion}
            filterPlaceholder="Filtrer par nom ou description..."
          />

          <fieldset>
            <legend>
              Lieu de quête
              <Link to={`/creator?section=${encodeURIComponent("Lieux de quête")}`} target="_blank" rel="noopener noreferrer">
                {" "}
                Créer
              </Link>
            </legend>
            <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">Aucun</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </fieldset>

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer la quête"}</button>
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
