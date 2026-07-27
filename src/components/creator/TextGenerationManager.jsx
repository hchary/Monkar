import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import NarrativeSubjectList from "./NarrativeSubjectList";

const emptySubjectForm = { type: "groupe", article: "les", nom: "", genre: "m", nombre: "pluriel", tags: "" };
const emptyVerbPhraseForm = { resultat: "victoire", cible: "groupe", template: "", tags: "" };

function parseTags(tags) {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Matches a verb phrase's template text, cible, or tags — for use as MultiSelectModalField's matchesFilter.
export function matchesVerbPhrase(option, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  return (
    (option.name || "").toLowerCase().includes(q) ||
    (option.cible || "").toLowerCase().includes(q) ||
    (option.tags || []).some((tag) => tag.toLowerCase().includes(q))
  );
}

function SubjectsManager() {
  const [subjects, setSubjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptySubjectForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "narrativeSubjects", "items"), (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

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

      <NarrativeSubjectList
        subjects={subjects}
        onEdit={startEdit}
        onDelete={(subject) => deleteDoc(doc(db, "worldData", "narrativeSubjects", "items", subject.id))}
      />

      {editingId && (
        <>
          <h4>Modifier le sujet</h4>
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
        </>
      )}
    </div>
  );
}

function VerbPhrasesManager() {
  const [verbPhrases, setVerbPhrases] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyVerbPhraseForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "verbPhrases", "items"), (snap) => {
      setVerbPhrases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(verbPhrase) {
    setEditingId(verbPhrase.id);
    setForm({
      resultat: verbPhrase.resultat || "victoire",
      cible: verbPhrase.cible || "groupe",
      template: verbPhrase.template || "",
      tags: (verbPhrase.tags || []).join(", "),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyVerbPhraseForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "verbPhrases", "items", editingId)
      : doc(collection(db, "worldData", "verbPhrases", "items"));

    const tags = parseTags(form.tags);
    await setDoc(ref, {
      resultat: form.resultat,
      cible: form.cible,
      template: form.template,
      ...(tags.length > 0 ? { tags } : {}),
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h3>Phrases-verbes</h3>

      <ul className="creator-list">
        {verbPhrases.map((verbPhrase) => (
          <li key={verbPhrase.id}>
            <strong>{verbPhrase.template}</strong> ({verbPhrase.resultat}, {verbPhrase.cible})
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

      <h4>{editingId ? "Modifier la phrase-verbe" : "Nouvelle phrase-verbe"}</h4>
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
          Cible
          <select value={form.cible} onChange={(e) => setForm({ ...form, cible: e.target.value })}>
            <option value="groupe">Groupe</option>
            <option value="individuel">Individuel</option>
            <option value="les_deux">Les deux</option>
          </select>
        </label>
        <input
          placeholder='Modèle (ex: "avez triomphé de {sujet}")'
          value={form.template}
          onChange={(e) => setForm({ ...form, template: e.target.value })}
          required
        />
        <input
          placeholder="Tags requis chez le sujet (optionnel, séparés par des virgules)"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
        />
        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer la phrase-verbe"}</button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Annuler
            </button>
          )}
        </div>
      </form>
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
