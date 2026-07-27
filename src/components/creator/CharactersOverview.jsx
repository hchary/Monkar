import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

function CharacterDetail({ character, onBack }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "actionsLog"), where("characterId", "==", character.id));
    return onSnapshot(q, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      entries.sort((a, b) => (a.date < b.date ? 1 : -1));
      setHistory(entries);
    });
  }, [character.id]);

  return (
    <div className="character-detail">
      <button type="button" onClick={onBack}>
        ← Retour à la liste
      </button>
      <h3>
        {character.name} {!character.alive && "(mort)"}
      </h3>
      <ul>
        <li>Propriétaire (uid) : {character.ownerUid}</li>
        <li>Région : {character.region?.name}</li>
        <li>Background : {character.background?.name}</li>
        <li>Métier : {character.profession}</li>
        <li>Titre : {character.title || "(aucun)"}</li>
        <li>Réputation : {character.reputation}</li>
        <li>Niveau de légende : {character.legendLevel ?? "(aucun)"}</li>
        <li>Or : {character.gold}</li>
      </ul>

      <h4>Historique complet</h4>
      {history.length > 0 ? (
        <ul>
          {history.map((entry) => (
            <li key={entry.id}>
              {entry.date} — {entry.tierName} {entry.success ? "(succès)" : "(échec)"}
              {entry.narrativeText && ` — ${entry.narrativeText}`}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">Aucune action enregistrée.</p>
      )}
    </div>
  );
}

export default function CharactersOverview() {
  const [characters, setCharacters] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    return onSnapshot(collection(db, "characters"), (snap) => {
      setCharacters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  if (selected) {
    const current = characters.find((c) => c.id === selected.id) || selected;
    return <CharacterDetail character={current} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="creator-section">
      <h2>Personnages</h2>
      <ul className="creator-list">
        {characters.map((character) => (
          <li key={character.id}>
            <button type="button" onClick={() => setSelected(character)}>
              {character.name} {!character.alive && "(mort)"} — {character.region?.name || "?"}, {character.background?.name || "?"}
            </button>
          </li>
        ))}
      </ul>
      {characters.length === 0 && <p className="empty-state">Aucun personnage créé pour l'instant.</p>}
    </div>
  );
}
