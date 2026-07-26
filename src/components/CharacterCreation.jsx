import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

export default function CharacterCreation() {
  const [regions, setRegions] = useState([]);
  const [regionId, setRegionId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "regions", "items"), (snap) => {
      setRegions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const selectedRegion = regions.find((r) => r.id === regionId);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const createCharacter = httpsCallable(functions, "createCharacter");
      await createCharacter({ regionId, name });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (regions.length === 0) {
    return <p>Chargement des régions du monde...</p>;
  }

  return (
    <div className="character-creation">
      <h1>Nouveau personnage</h1>

      <h2>1. Choisis ta région d'origine</h2>
      <div className="region-list">
        {regions.map((region) => (
          <button
            key={region.id}
            type="button"
            className={region.id === regionId ? "selected" : ""}
            onClick={() => {
              setRegionId(region.id);
              setName("");
            }}
          >
            {region.name}
          </button>
        ))}
      </div>

      {regionId && (
        <form onSubmit={handleSubmit}>
          <h2>2. Choisis ton nom</h2>
          {selectedRegion?.nameSuggestions?.length > 0 && (
            <div className="name-suggestions">
              {selectedRegion.nameSuggestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => setName(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <input type="text" placeholder="Nom du personnage" value={name} onChange={(e) => setName(e.target.value)} required />

          <button type="submit" disabled={submitting}>
            {submitting ? "Le destin se scelle..." : "Sceller mon destin"}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
