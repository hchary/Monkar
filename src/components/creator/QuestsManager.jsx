import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function QuestsManager() {
  const [quests, setQuests] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "quests", "items"), (snap) => {
      setQuests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(quest) {
    setEditingId(quest.id);
    setName(quest.name || "");
  }

  function resetForm() {
    setEditingId(null);
    setName("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "quests", "items", editingId)
      : doc(collection(db, "worldData", "quests", "items"));

    await setDoc(ref, { name });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Quêtes</h2>
      <p>
        Stub minimal : voir la TODO "Quest creation and editing" pour la version complète (objectif, région, récompenses...).
      </p>

      <ul className="creator-list">
        {quests.map((quest) => (
          <li key={quest.id}>
            <strong>{quest.name}</strong>
            <button type="button" onClick={() => startEdit(quest)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "quests", "items", quest.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier la quête" : "Nouvelle quête"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />

        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer la quête"}</button>
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
