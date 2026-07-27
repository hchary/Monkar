import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import NarrativeSubjectList from "./NarrativeSubjectList";

const OBJECTIVE_TAG = "objectif de quête";

const emptyForm = { type: "groupe", article: "les", nom: "", genre: "m", nombre: "pluriel" };

export default function QuestObjectivesManager() {
  const [subjects, setSubjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [otherTags, setOtherTags] = useState([]);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "narrativeSubjects", "items"), (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const objectives = subjects.filter((subject) => (subject.tags || []).includes(OBJECTIVE_TAG));

  function startEdit(subject) {
    setEditingId(subject.id);
    setForm({
      type: subject.type || "groupe",
      article: subject.article || "les",
      nom: subject.nom || "",
      genre: subject.genre || "m",
      nombre: subject.nombre || "pluriel",
    });
    setOtherTags((subject.tags || []).filter((t) => t !== OBJECTIVE_TAG));
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
    });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Objectifs de quête</h2>
      <p>
        Un objectif de quête est un sujet narratif (voir "Génération de texte") taggé "{OBJECTIVE_TAG}".
      </p>

      <NarrativeSubjectList
        subjects={objectives}
        onEdit={startEdit}
        onDelete={(subject) => deleteDoc(doc(db, "worldData", "narrativeSubjects", "items", subject.id))}
      />

      <h3>{editingId ? "Modifier l'objectif de quête" : "Nouvel objectif de quête"}</h3>
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
        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer l'objectif de quête"}</button>
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
