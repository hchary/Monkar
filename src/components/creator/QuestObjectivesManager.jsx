import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import NarrativeSubjectList from "./NarrativeSubjectList";
import MultiSelectModalField from "./MultiSelectModalField";
import { matchesTag } from "./TagsManager";
import { RARITIES } from "./TalentsManager";

export const OBJECTIVE_TAG = "objectif de quête";

const emptyForm = { type: "groupe", article: "les", nom: "", genre: "m", nombre: "pluriel", tagIds: [], rarity: "commun" };

// Matches a quest objective's display name or tags — for use as MultiSelectModalField's matchesFilter.
export function matchesQuestObjective(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    (option.name || "").toLowerCase().includes(q) || (option.tags || []).some((tag) => tag.toLowerCase().includes(q))
  );
}

export default function QuestObjectivesManager() {
  const [subjects, setSubjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [otherTags, setOtherTags] = useState([]);
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "narrativeSubjects", "items"), (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "tags", "items"), (snap) => {
      setTags(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const sortedTags = [...tags].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));

  const objectives = subjects.filter((subject) => (subject.tags || []).includes(OBJECTIVE_TAG));
  const filteredObjectives = objectives.filter((subject) =>
    matchesQuestObjective({ name: subject.nom, tags: subject.tags }, filterText)
  );

  function startEdit(subject) {
    setEditingId(subject.id);
    setForm({
      type: subject.type || "groupe",
      article: subject.article || "les",
      nom: subject.nom || "",
      genre: subject.genre || "m",
      nombre: subject.nombre || "pluriel",
      tagIds: subject.tagIds || [],
      rarity: subject.rarity || "commun",
    });
    setOtherTags((subject.tags || []).filter((t) => t !== OBJECTIVE_TAG));
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setOtherTags([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "narrativeSubjects", "items", editingId)
      : doc(collection(db, "worldData", "narrativeSubjects", "items"));

    await setDoc(ref, {
      type: form.type,
      article: form.article,
      nom: form.nom,
      genre: form.genre,
      nombre: form.nombre,
      tags: [...otherTags, OBJECTIVE_TAG],
      tagIds: form.tagIds,
      rarity: form.rarity,
    });
    resetForm();
  }

  function toggleTagId(id) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id) ? prev.tagIds.filter((x) => x !== id) : [...prev.tagIds, id],
    }));
  }

  return (
    <div className="creator-section">
      <h2>Objectifs de quête</h2>
      <p>
        Un objectif de quête est un sujet narratif (voir "Génération de texte") taggé "{OBJECTIVE_TAG}".
      </p>

      <fieldset>
        <legend>Filtres</legend>
        <input
          placeholder="Rechercher par nom ou tag..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <NarrativeSubjectList
        subjects={filteredObjectives}
        onEdit={startEdit}
        onDelete={(subject) => deleteDoc(doc(db, "worldData", "narrativeSubjects", "items", subject.id))}
        tagsCatalog={tags}
      />

      <details className="collapsible-group" open={panelOpen} onToggle={(e) => setPanelOpen(e.target.open)}>
        <summary>{editingId ? "Modifier l'objectif de quête" : "Nouvel objectif de quête"}</summary>
        <form onSubmit={handleSubmit}>
          <label>
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="groupe">Groupe</option>
              <option value="individuel">Individuel</option>
            </select>
          </label>
          <label>
            Article (avant "de")
            <select value={form.article} onChange={(e) => setForm({ ...form, article: e.target.value })}>
              <option value="le">le</option>
              <option value="la">la</option>
              <option value="les">les</option>
              <option value="l'">l'</option>
            </select>
          </label>
          <input
            placeholder='Nom (ex: "bandits", "chef des bandits")'
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            required
          />
          <label>
            Genre
            <select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
              <option value="m">masculin</option>
              <option value="f">féminin</option>
            </select>
          </label>
          <label>
            Nombre
            <select value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}>
              <option value="singulier">singulier</option>
              <option value="pluriel">pluriel</option>
            </select>
          </label>
          <label title="Utilisée pour choisir la table de tirage lors du butin de quête (voir Tables de tirage).">
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
            <button type="submit">{editingId ? "Enregistrer" : "Créer l'objectif de quête"}</button>
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
