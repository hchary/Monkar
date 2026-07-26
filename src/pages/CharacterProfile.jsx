import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function CharacterProfile() {
  const { user } = useAuth();
  const [character, setCharacter] = useState(null);
  const [actionTypes, setActionTypes] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "characters"), where("ownerUid", "==", user.uid));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) setCharacter({ id: snap.docs[0].id, ...snap.docs[0].data() });
    });
  }, [user]);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "actionTypes", "items"), (snap) => {
      setActionTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const alreadyActedToday = character?.lastActionDate === today;

  async function handleAction(actionTypeId) {
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const performAction = httpsCallable(functions, "performAction");
      const { data } = await performAction({ actionTypeId });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!character) return <p>Chargement du personnage...</p>;

  return (
    <div className="character-profile">
      <h1>{character.name}</h1>
      <ul className="stats">
        {Object.entries(character.stats || {}).map(([stat, value]) => (
          <li key={stat}>
            {stat}: {value}
          </li>
        ))}
      </ul>

      <h2>Action du jour</h2>
      {alreadyActedToday ? (
        <p>Tu as déjà agi aujourd'hui. Reviens demain !</p>
      ) : (
        <div className="action-list">
          {actionTypes.map((action) => (
            <button key={action.id} disabled={submitting} onClick={() => handleAction(action.id)}>
              {action.label}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="result">
          <p>
            <strong>{result.tierName}</strong>
          </p>
          <p>{result.narrativeText}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
