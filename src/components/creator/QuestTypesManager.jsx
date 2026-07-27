import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function QuestTypesManager() {
  const [questTypes, setQuestTypes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "questTypes", "items"), (snap) => {
      setQuestTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(questType) {
    setEditingId(questType.id);
    setName(questType.name || "");
  }

  function resetForm() {
    setEditingId(null);
    setName("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "questTypes", "items", editingId)
      : doc(collection(db, "worldData", "questTypes", "items"));

    await setDoc(ref, { name });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Types de quête</h2>
      <p>
        Stub minimal : voir la TODO "Types de quête" pour la version complète (description, thématiques, zones associées...).
      </p>

      <ul className="creator-list">
        {questTypes.map((questType) => (
          <li key={questType.id}>
            <strong>{questType.name}</strong>
            <button type="button" onClick={() => startEdit(questType)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "questTypes", "items", questType.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier le type de quête" : "Nouveau type de quête"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />

        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer le type de quête"}</button>
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
