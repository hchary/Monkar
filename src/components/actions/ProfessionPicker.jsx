import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

function useProfessions() {
  const [professions, setProfessions] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "professions", "items"), (snap) => {
      setProfessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);
  return professions;
}

// The player-facing side of an "Apprentissage" action (docs/TODO.md "Profession (métier)
// creation" - initial assignment via trainer): needs a payload (professionId) before it can
// start, same reason TalentPicker.jsx/MissionPicker.jsx exist. Offers only professions taught at
// this specific action's own trainer type (a profession's trainerTypeIds may list several, so more
// than one can qualify at the same trainer).
export default function ProfessionPicker({ activeAction, onStart, submitting, availabilityOk }) {
  const catalogProfessions = useProfessions();
  const [selectedId, setSelectedId] = useState(null);

  const candidates = catalogProfessions.filter((p) =>
    (p.trainerTypeIds || []).includes(activeAction.trainerTypeId || "")
  );

  useEffect(() => {
    if (selectedId && !candidates.some((p) => p.id === selectedId)) setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, selectedId]);

  return (
    <div className="profession-picker">
      <fieldset className="action-loot-box">
        <legend>Métiers enseignés ici</legend>
        {candidates.length === 0 ? (
          <p className="empty-state">Aucun métier enseigné auprès de cet entraîneur pour l'instant.</p>
        ) : (
          <ul className="talent-list">
            {candidates.map((profession) => (
              <li key={profession.id}>
                <button
                  type="button"
                  className={profession.id === selectedId ? "selected" : ""}
                  onClick={() => setSelectedId(profession.id)}
                >
                  {profession.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <button
        type="button"
        disabled={!selectedId || submitting || !availabilityOk}
        onClick={() => onStart({ professionId: selectedId })}
      >
        Commencer
      </button>
    </div>
  );
}
