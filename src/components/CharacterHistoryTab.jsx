import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import EmptyState from "./EmptyState";

export default function CharacterHistoryTab({ character }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "actionsLog"),
      where("ownerUid", "==", character.ownerUid),
      where("characterId", "==", character.id)
    );
    return onSnapshot(q, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      entries.sort((a, b) => (a.date < b.date ? 1 : -1));
      setHistory(entries);
    });
  }, [character.id, character.ownerUid]);

  if (history.length === 0) return <EmptyState text="Aucune action enregistrée pour l'instant." />;

  return (
    <ul>
      {history.map((entry) => (
        <li key={entry.id}>
          {entry.date} — {entry.tierName} {entry.success ? "(succès)" : "(échec)"}
        </li>
      ))}
    </ul>
  );
}
