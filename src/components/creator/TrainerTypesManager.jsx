import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function TrainerTypesManager() {
  const [trainerTypes, setTrainerTypes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "trainerTypes", "items"), (snap) => {
      setTrainerTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  function startEdit(trainerType) {
    setEditingId(trainerType.id);
    setName(trainerType.name || "");
  }

  function resetForm() {
    setEditingId(null);
    setName("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "trainerTypes", "items", editingId)
      : doc(collection(db, "worldData", "trainerTypes", "items"));

    await setDoc(ref, { name });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Types d'entraîneur</h2>
      <p>
        Stub minimal : voir la TODO "Entraîneurs" pour la version complète (description, région, disponibilité...).
      </p>

      <ul className="creator-list">
        {trainerTypes.map((trainerType) => (
          <li key={trainerType.id}>
            <strong>{trainerType.name}</strong>
            <button type="button" onClick={() => startEdit(trainerType)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "trainerTypes", "items", trainerType.id))}>
              Supprimer
            </button>
          </li>
        ))}
      </ul>

      <h3>{editingId ? "Modifier le type d'entraîneur" : "Nouveau type d'entraîneur"}</h3>
      <form onSubmit={handleSubmit}>
        <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />

        <div>
          <button type="submit">{editingId ? "Enregistrer" : "Créer le type d'entraîneur"}</button>
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
