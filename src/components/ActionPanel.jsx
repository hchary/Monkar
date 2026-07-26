import { useEffect, useState } from "react";
import { collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";

const REVEAL_DELAY_HOURS = 24;

function hoursSince(timestamp) {
  if (!timestamp) return Infinity;
  const actedAt = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return (Date.now() - actedAt.getTime()) / (1000 * 60 * 60);
}

export default function ActionPanel({ character }) {
  const [actionTypes, setActionTypes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "actionTypes", "items"), (snap) => {
      setActionTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const canActToday = character.lastActionDate !== today;
  const lastAction = character.lastAction;
  const revealed = lastAction && hoursSince(character.lastActionAt) >= REVEAL_DELAY_HOURS;

  async function handleAction(actionTypeId) {
    setSubmitting(true);
    setError("");
    try {
      const performAction = httpsCallable(functions, "performAction");
      await performAction({ actionTypeId });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDebugAdvanceTime() {
    await updateDoc(doc(db, "characters", character.id), { lastActionDate: null, lastActionAt: null });
  }

  return (
    <div className="action-panel">
      {/* TODO: remove this test-only button before the game goes live to real players */}
      <button type="button" className="debug-button" onClick={handleDebugAdvanceTime}>
        [TEST] Avancer le temps d'un jour
      </button>

      {canActToday && (
        <>
          <h2>Action du jour</h2>
          <div className="action-list">
            {actionTypes.map((action) => (
              <button key={action.id} disabled={submitting} onClick={() => handleAction(action.id)}>
                {action.label}
              </button>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
        </>
      )}

      {lastAction && (
        <div className="last-action">
          <h2>Action de la veille</h2>
          <p className="action-type-label">{actionTypes.find((a) => a.id === lastAction.actionTypeId)?.label || lastAction.actionTypeId}</p>

          {!revealed ? (
            <p className="status pending">En cours...</p>
          ) : (
            <>
              <button className="status-toggle" onClick={() => setExpanded((v) => !v)}>
                {lastAction.success ? "Succès" : "Échec"} {expanded ? "▲" : "▼"}
              </button>

              {expanded && (
                <div className="action-detail">
                  <p>{lastAction.narrativeText}</p>
                  {!lastAction.success && lastAction.consequence && (
                    <ul>
                      <li>Cause : {lastAction.consequence.description}</li>
                      {lastAction.consequence.type === "death" && <li className="fatal">Ton personnage est mort.</li>}
                      {lastAction.consequence.type === "wound" && <li>Blessure : {lastAction.consequence.name}</li>}
                    </ul>
                  )}
                  {lastAction.success && (
                    <ul>
                      {(lastAction.goldGain > 0 || lastAction.itemGain) && (
                        <li>
                          Gain : {lastAction.goldGain > 0 && `${lastAction.goldGain} or`}
                          {lastAction.itemGain && ` ${lastAction.itemGain.name}`}
                        </li>
                      )}
                      {lastAction.talentGain && <li>Nouveau talent : {lastAction.talentGain.name} {lastAction.talentGain.quality}</li>}
                      {lastAction.reputationGain > 0 && <li>Réputation : +{lastAction.reputationGain}</li>}
                      {lastAction.legendary && <li className="legendary">Exploit légendaire !</li>}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!canActToday && !lastAction && <p className="empty-state">Aucune action encore.</p>}
    </div>
  );
}
