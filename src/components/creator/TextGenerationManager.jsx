import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import NarrativeSubjectList from "./NarrativeSubjectList";

const emptySubjectForm = { type: "groupe", article: "les", nom: "", genre: "m", nombre: "pluriel", tags: "" };
const emptyVerbPhraseForm = {
  resultat: "victoire",
  cible: "groupe",
  slot: "climax",
  talentChange: "les_deux",
  template: "",
  tags: "",
};

// The role a phrase plays in the generated paragraph — see docs/NARRATIVE-GENERATION.md. "climax" is
// the default both here and when reading Firestore, so every phrase authored before slots existed
// stays valid action content without a migration.
export const NARRATIVE_SLOTS = [
  { value: "opening", label: "Ouverture (mise en place)" },
  { value: "climax", label: "Action (obligatoire)" },
  { value: "talentGrowth", label: "Progression de talent" },
];

const TALENT_CHANGES = [
  { value: "les_deux", label: "Les deux" },
  { value: "evolution", label: "Amélioration d'un talent connu" },
  { value: "unlock", label: "Déblocage d'un nouveau talent" },
];

export function slotLabel(slot) {
  return NARRATIVE_SLOTS.find((s) => s.value === (slot || "climax"))?.label || slot;
}

function parseTags(tags) {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Matches a verb phrase's template text, slot, cible, or tags — for use as MultiSelectModalField's matchesFilter.
export function matchesVerbPhrase(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    (option.name || "").toLowerCase().includes(q) ||
    (option.cible || "").toLowerCase().includes(q) ||
    slotLabel(option.slot).toLowerCase().includes(q) ||
    (option.tags || []).some((tag) => tag.toLowerCase().includes(q))
  );
}

function SubjectsManager() {
  const [subjects, setSubjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptySubjectForm);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "narrativeSubjects", "items"), (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredSubjects = subjects.filter((subject) => {
    const q = filterText.toLowerCase();
    return (
      !q ||
      (subject.nom || "").toLowerCase().includes(q) ||
      (subject.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  });

  function startEdit(subject) {
    setEditingId(subject.id);
    setForm({
      type: subject.type || "groupe",
      article: subject.article || "les",
      nom: subject.nom || "",
      genre: subject.genre || "m",
      nombre: subject.nombre || "pluriel",
      tags: (subject.tags || []).join(", "),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptySubjectForm);
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
      tags: parseTags(form.tags),
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h3>Sujets narratifs (cibles de résultat)</h3>
      <p>
        La création d'un sujet se fait depuis l'onglet du type de sujet concerné (ex : "Objectifs de quête"). Cette
        section permet de consulter et modifier les sujets existants, tous types confondus.
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
        subjects={filteredSubjects}
        onEdit={startEdit}
        onDelete={(subject) => deleteDoc(doc(db, "worldData", "narrativeSubjects", "items", subject.id))}
      />

      {editingId && (
        <details className="collapsible-group" open>
          <summary>Modifier le sujet</summary>
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
            <input
              placeholder="Tags (séparés par des virgules, ex: hostile, humanoïde)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
            <div>
              <button type="submit">Enregistrer</button>
              <button type="button" onClick={resetForm}>
                Annuler
              </button>
            </div>
          </form>
        </details>
      )}
    </div>
  );
}

const emptyVerbPhraseFilters = { resultat: "", slot: "", text: "" };

function VerbPhrasesManager() {
  const [verbPhrases, setVerbPhrases] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyVerbPhraseForm);
  const [filters, setFilters] = useState(emptyVerbPhraseFilters);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "verbPhrases", "items"), (snap) => {
      setVerbPhrases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredVerbPhrases = verbPhrases.filter((verbPhrase) => {
    if (filters.resultat && verbPhrase.resultat !== filters.resultat) return false;
    if (filters.slot && (verbPhrase.slot || "climax") !== filters.slot) return false;
    return matchesVerbPhrase(
      { name: verbPhrase.template, cible: verbPhrase.cible, slot: verbPhrase.slot, tags: verbPhrase.tags },
      filters.text
    );
  });

  function startEdit(verbPhrase) {
    setEditingId(verbPhrase.id);
    setForm({
      resultat: verbPhrase.resultat || "victoire",
      cible: verbPhrase.cible || "groupe",
      slot: verbPhrase.slot || "climax",
      talentChange: verbPhrase.talentChange || "les_deux",
      template: verbPhrase.template || "",
      tags: (verbPhrase.tags || []).join(", "),
    });
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyVerbPhraseForm);
  }

  // A cible restricts which target shape a phrase can be drawn for. The action sentence nearly
  // always needs one, since it substitutes {sujet}; the other slots usually don't, and leaving them
  // on a single shape would silently hide them half the time — so switching slot moves the default,
  // which the author can still narrow when their sentence agrees with the enemy's number.
  function changeSlot(slot) {
    setForm((prev) => ({ ...prev, slot, cible: slot === "climax" ? "groupe" : "les_deux" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "verbPhrases", "items", editingId)
      : doc(collection(db, "worldData", "verbPhrases", "items"));

    const tags = parseTags(form.tags);
    await setDoc(ref, {
      resultat: form.resultat,
      slot: form.slot,
      cible: form.cible,
      template: form.template,
      ...(form.slot === "talentGrowth" ? { talentChange: form.talentChange } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h3>Phrases-verbes</h3>
      <p>
        Chaque récit de quête assemble une phrase par emplacement, toujours dans l'ordre ouverture → action →
        progression de talent. Seule l'action est obligatoire. Écrivez les phrases sans majuscule initiale et
        sans point final : le jeu s'en charge, et réutilise la phrase d'action au milieu des descriptions de
        butin. Placeholders disponibles : <code>{"{sujet}"}</code> (la cible), <code>{"{lieu}"}</code>,{" "}
        <code>{"{quete}"}</code>, <code>{"{talent}"}</code> (progression de talent uniquement).
      </p>

      <fieldset>
        <legend>Filtres</legend>
        <label>
          Résultat
          <select value={filters.resultat} onChange={(e) => setFilters({ ...filters, resultat: e.target.value })}>
            <option value="">Tous</option>
            <option value="victoire">Victoire</option>
            <option value="echec">Échec</option>
            <option value="partielle">Partielle</option>
          </select>
        </label>
        <label>
          Emplacement
          <select value={filters.slot} onChange={(e) => setFilters({ ...filters, slot: e.target.value })}>
            <option value="">Tous</option>
            {NARRATIVE_SLOTS.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>
        <input
          placeholder="Rechercher par texte, emplacement, cible ou tag..."
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        />
        <button type="button" onClick={() => setFilters(emptyVerbPhraseFilters)}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredVerbPhrases.map((verbPhrase) => (
          <li key={verbPhrase.id}>
            <strong>{verbPhrase.template}</strong> ({verbPhrase.resultat}, {slotLabel(verbPhrase.slot)},{" "}
            {verbPhrase.cible})
            {verbPhrase.tags?.length > 0 && ` — tags : ${verbPhrase.tags.join(", ")}`}
            <button type="button" onClick={() => startEdit(verbPhrase)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "verbPhrases", "items", verbPhrase.id))}>
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
        <summary>{editingId ? "Modifier la phrase-verbe" : "Nouvelle phrase-verbe"}</summary>
        <form onSubmit={handleSubmit}>
          <label>
            Résultat
            <select value={form.resultat} onChange={(e) => setForm({ ...form, resultat: e.target.value })}>
              <option value="victoire">Victoire</option>
              <option value="echec">Échec</option>
              <option value="partielle">Partielle</option>
            </select>
          </label>
          <label>
            Emplacement
            <select value={form.slot} onChange={(e) => changeSlot(e.target.value)}>
              {NARRATIVE_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cible
            <select value={form.cible} onChange={(e) => setForm({ ...form, cible: e.target.value })}>
              <option value="groupe">Groupe</option>
              <option value="individuel">Individuel</option>
              <option value="les_deux">Les deux</option>
            </select>
          </label>
          {form.slot === "talentGrowth" && (
            <label>
              Type de progression
              <select value={form.talentChange} onChange={(e) => setForm({ ...form, talentChange: e.target.value })}>
                {TALENT_CHANGES.map((change) => (
                  <option key={change.value} value={change.value}>
                    {change.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input
            placeholder='Modèle (ex: "vous avez triomphé de {sujet}")'
            value={form.template}
            onChange={(e) => setForm({ ...form, template: e.target.value })}
            required
          />
          <input
            placeholder="Tags requis (optionnel, séparés par des virgules)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
          <p>
            La phrase n'est retenue que si <em>tous</em> ses tags sont présents dans le contexte de la quête
            (tags de la cible, tags de la quête, tags du talent qui a progressé) ; sans tag, elle sert de
            secours générique. Les tags saisis ici sont du texte libre : ils doivent être orthographiés
            exactement comme les tags du catalogue « Tags » utilisés par les quêtes et les talents.
          </p>
          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer la phrase-verbe"}</button>
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

export default function TextGenerationManager() {
  return (
    <div className="creator-section">
      <h2>Génération de texte de résultat</h2>
      <SubjectsManager />
      <VerbPhrasesManager />
    </div>
  );
}
