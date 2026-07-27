import { useEffect, useRef, useState } from "react";
import { collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { RARITIES } from "./creator/TalentsManager";

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
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const questDialogRef = useRef(null);

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

  // Auto-opens once a quest result is revealed and hasn't been closed yet - reappears on
  // reload if the player left before clicking "Fermer", since that's what grants the loot.
  const showQuestPopup = !!(revealed && lastAction?.quest && !lastAction?.lootClaimed);

  useEffect(() => {
    if (showQuestPopup) questDialogRef.current?.showModal();
    else questDialogRef.current?.close();
  }, [showQuestPopup]);

  async function handleCloseQuestPopup() {
    setClaiming(true);
    setClaimError("");
    try {
      const claimQuestLoot = httpsCallable(functions, "claimQuestLoot");
      await claimQuestLoot();
    } catch (err) {
      setClaimError(err.message);
    } finally {
      setClaiming(false);
    }
  }

  const sortedLoot = [...(lastAction?.loot || [])].sort(
    (a, b) => RARITIES.findIndex((r) => r.value === b.rarity) - RARITIES.findIndex((r) => r.value === a.rarity)
  );

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
        <div className={`last-action${lastAction.quest?.difficulty ? ` difficulty-${lastAction.quest.difficulty}` : ""}`}>
          <h2>Action de la veille</h2>
          <p className="action-type-label">{actionTypes.find((a) => a.id === lastAction.actionTypeId)?.label || lastAction.actionTypeId}</p>

          {!revealed ? (
            <p className="status pending">En cours...</p>
          ) : (
            <>
              <button className="status-toggle" onClick={() => setExpanded((v) => !v)}>
                {lastAction.success ? (
                  <span className={lastAction.quest?.difficulty ? `difficulty-text-${lastAction.quest.difficulty}` : undefined}>
                    Succès
                  </span>
                ) : (
                  "Échec"
                )}{" "}
                {expanded ? "▲" : "▼"}
              </button>

              {expanded && (
                <div className="action-detail">
                  <p>{lastAction.narrativeText}</p>
                  {lastAction.quest && (
                    <p className="quest-info">
                      Quête : {lastAction.quest.name}
                      {lastAction.quest.locationName && ` — ${lastAction.quest.locationName}`}
                    </p>
                  )}
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
                      {lastAction.loot?.length > 0 && <li>Butin : {lastAction.loot.map((item) => item.name).join(", ")}</li>}
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

      {lastAction?.quest && (
        <dialog
          ref={questDialogRef}
          className="quest-result-dialog"
          onCancel={(e) => e.preventDefault()}
        >
          <div className="quest-result-content">
            <h3>
              {lastAction.quest.name} — {lastAction.success ? "Succès" : "Échec"}
            </h3>
            <p>{lastAction.narrativeText}</p>

            {lastAction.success && sortedLoot.length > 0 && (
              <fieldset className="quest-loot-box">
                <legend>Butin obtenu</legend>
                <ul className="instance-list">
                  {sortedLoot.map((item, index) => (
                    <li key={index} className={`instance-card rarity-${item.rarity}`}>
                      {item.name}
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}

            {claimError && <p className="error">{claimError}</p>}

            <button type="button" onClick={handleCloseQuestPopup} disabled={claiming}>
              Fermer
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
