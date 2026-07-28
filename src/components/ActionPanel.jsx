import { useEffect, useRef, useState } from "react";
import { Timestamp, collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { RARITIES } from "./creator/TalentsManager";
import {
  HOUR_MS,
  actionCompletesAtMillis,
  isActionAcknowledged,
  isActionRunning,
  toMillis,
} from "../lib/actionLifecycle";

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

  // An action occupies its character until it completes: the same rule the Cloud Function
  // enforces, read through the same module (src/lib/actionLifecycle.js). It gates both what the
  // player can start and what they are allowed to see, which used to be two separate clocks.
  const lastAction = character.lastAction;
  const running = isActionRunning(character);
  const canActToday = !running;
  const revealed = !!lastAction && !running;

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

  // Backdates the running action by 24h so it completes immediately, rather than clearing the
  // lock outright - the countdown and the reveal both read completesAt now, so wiping it would
  // leave the panel with nothing to show.
  async function handleDebugAdvanceTime() {
    const completesAt = actionCompletesAtMillis(character);
    if (completesAt == null) return;

    const shift = 24 * HOUR_MS;
    const startedAt = toMillis(lastAction?.startedAt ?? character.lastActionAt);
    const patch = { "lastAction.completesAt": Timestamp.fromMillis(completesAt - shift) };
    if (startedAt != null) patch["lastAction.startedAt"] = Timestamp.fromMillis(startedAt - shift);

    await updateDoc(doc(db, "characters", character.id), patch);
  }

  // Auto-opens once a quest result is revealed and hasn't been acknowledged yet - reappears on
  // reload if the player left before clicking "Fermer", since that's what grants the loot.
  const showQuestPopup = !!(revealed && lastAction?.quest && !isActionAcknowledged(character));

  useEffect(() => {
    if (showQuestPopup) questDialogRef.current?.showModal();
    else questDialogRef.current?.close();
  }, [showQuestPopup]);

  async function handleCloseQuestPopup() {
    setClaiming(true);
    setClaimError("");
    try {
      const acknowledgeAction = httpsCallable(functions, "acknowledgeAction");
      await acknowledgeAction();
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
