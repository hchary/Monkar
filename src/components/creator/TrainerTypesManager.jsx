import { useEffect, useState } from "react";
import { collection, doc, deleteDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

function useItems(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", collectionName, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [collectionName]);
  return items;
}

export default function TrainerTypesManager() {
  const [trainerTypes, setTrainerTypes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [filterText, setFilterText] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const locations = useItems("adventureZones");

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "trainerTypes", "items"), (snap) => {
      setTrainerTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const filteredTrainerTypes = trainerTypes.filter((trainerType) => {
    const q = filterText.toLowerCase();
    return !q || (trainerType.name || "").toLowerCase().includes(q);
  });

  function startEdit(trainerType) {
    setEditingId(trainerType.id);
    setName(trainerType.name || "");
    setLocationId(trainerType.locationId || "");
    setPanelOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setLocationId("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ref = editingId
      ? doc(db, "worldData", "trainerTypes", "items", editingId)
      : doc(collection(db, "worldData", "trainerTypes", "items"));

    await setDoc(ref, { name, locationId });
    resetForm();
  }

  return (
    <div className="creator-section">
      <h2>Types d'entraîneur</h2>
      <p>
        Stub minimal : voir la TODO "Entraîneurs" pour la version complète (description...).
      </p>

      <fieldset>
        <legend>Filtres</legend>
        <input placeholder="Rechercher par nom..." value={filterText} onChange={(e) => setFilterText(e.target.value)} />
        <button type="button" onClick={() => setFilterText("")}>
          Réinitialiser les filtres
        </button>
      </fieldset>

      <ul className="creator-list">
        {filteredTrainerTypes.map((trainerType) => (
          <li key={trainerType.id}>
            <strong>{trainerType.name}</strong>
            <div>Lieu : {locations.find((l) => l.id === trainerType.locationId)?.name || "aucun"}</div>
            <button type="button" onClick={() => startEdit(trainerType)}>
              Modifier
            </button>
            <button type="button" onClick={() => deleteDoc(doc(db, "worldData", "trainerTypes", "items", trainerType.id))}>
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
        <summary>{editingId ? "Modifier le type d'entraîneur" : "Nouveau type d'entraîneur"}</summary>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} required />

          <fieldset>
            <legend>Lieu</legend>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Aucun</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </fieldset>

          <div>
            <button type="submit">{editingId ? "Enregistrer" : "Créer le type d'entraîneur"}</button>
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
