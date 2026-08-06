import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { trainingCost } from "../../lib/trainingCost";

function useItems(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", collectionName, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [collectionName]);
  return items;
}

// The player-facing side of the "S'entraîner" action (docs/TODO.md "Trainers"): needs a payload
// (talentId) before it can start, same reason MissionPicker.jsx exists. Offers only talents the
// character owns that are trainable, not already at the quality cap, and whose catalog entry's
// trainerTypeId matches this specific training action's own - cross-referenced against the talent
// catalog since character.talents entries don't carry trainerTypeId themselves.
export default function TalentPicker({ character, activeAction, onStart, submitting, availabilityOk }) {
  const catalogTalents = useItems("talents");
  const [selectedId, setSelectedId] = useState(null);

  const trainerTypeIdByTalentId = new Map(catalogTalents.map((t) => [t.id, t.trainerTypeId || ""]));
  const candidates = (character.talents || []).filter(
    (t) =>
      t.trainable &&
      (t.quality || 1) < 5 &&
      trainerTypeIdByTalentId.get(t.id) === (activeAction.trainerTypeId || "")
  );

  useEffect(() => {
    if (selectedId && !candidates.some((t) => t.id === selectedId)) setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, selectedId]);

  return (
    <div className="talent-picker">
      <fieldset className="action-loot-box">
        <legend>Talents entraînables ici</legend>
        {candidates.length === 0 ? (
          <p className="empty-state">Aucun talent entraînable auprès de cet entraîneur pour l'instant.</p>
        ) : (
          <ul className="talent-list">
            {candidates.map((talent) => (
              <li key={talent.id}>
                <button
                  type="button"
                  className={talent.id === selectedId ? "selected" : ""}
                  onClick={() => setSelectedId(talent.id)}
                >
                  {talent.name} — qualité {talent.quality} → {Math.min(5, (talent.quality || 1) + 1)} (
                  {trainingCost(talent)} or)
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <button
        type="button"
        disabled={!selectedId || submitting || !availabilityOk}
        onClick={() => onStart({ talentId: selectedId })}
      >
        Commencer
      </button>
    </div>
  );
}
