import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

const emptyForm = { name: "", description: "" };

export default function QuestSubjectsManager() {
  const [subjects, setSubjects] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "questSubjects", "items"), (snap) => {
      setSubjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(subject) {
    setEditingId(subject.id);
    setForm({ name: subject.name || "", description: subject.description || "" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "questSubjects", "items", editingId)
      : doc(collection(db, "worldData", "questSubjects", "items"));

    await setDoc(ref, { name: form.name, description: form.description });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Sujets de quête</h2>

      <ul className="creator-list">
        {subjects.map((subject) => (
          <li key={subject.id}>
            <strong>{subject.name}</strong> — {subject.description}
            <button type="button" onClick={() => startEdit(subject)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "questSubjects", "items", subject.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier le sujet de quête" : "Nouveau sujet de quête"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer le sujet de quête"}</button>
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
