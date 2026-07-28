import { useEffect, useState } from "react";
import { Timestamp, collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { normalizeActionType } from "../lib/actionCatalog";
import { HOUR_MS, actionCompletesAtMillis, actionState, toMillis } from "../lib/actionLifecycle";
import ActionBrowser from "./actions/ActionBrowser";
import ActionCountdown from "./actions/ActionCountdown";
import ActionResultDialog from "./actions/ActionResultDialog";
import ActionOutcome from "./actions/ActionOutcome";

// The state machine of docs/ISSUE-02-ACTION-FRAMEWORK.md §3.6, driven by one `now` that ticks
// every second: idle -> ActionBrowser, running -> ActionCountdown (replaces the panel's contents,
// R10), completed -> ActionResultDialog (modal, R3). The tick is what makes "completed" arrive
// live for a connected player instead of only after a reload (fixes F6) - actionState() derives
// the same three states the Cloud Function's lock uses, from the same completesAt instant.
export default function ActionPanel({ character }) {
  const [actionTypes, setActionTypes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [ackError, setAckError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "actionTypes", "items"), (snap) => {
      setActionTypes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const lastAction = character.lastAction;
  const state = actionState(character, now);

  async function handleStart(actionTypeId) {
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

  async function handleAcknowledge() {
    setAcknowledging(true);
    setAckError("");
    try {
      const acknowledgeAction = httpsCallable(functions, "acknowledgeAction");
      await acknowledgeAction();
    } catch (err) {
      setAckError(err.message);
    } finally {
      setAcknowledging(false);
    }
  }

  // Backdates the running action by 24h so it completes immediately, rather than clearing the
  // lock outright - the countdown and the dialog both read completesAt now, so wiping it would
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

  const actionType = actionTypes.find((a) => a.id === lastAction?.actionTypeId);
  const showLoot = !!actionType && normalizeActionType(actionType).result.showLoot;

  const accent = lastAction?.accent;
  const frameClass = accent ? `${accent.kind}-frame ${accent.kind}-${accent.value}` : "";

  return (
    <div className="action-panel">
      {/* TODO: remove this test-only button before the game goes live to real players */}
      <button type="button" className="debug-button" onClick={handleDebugAdvanceTime}>
        [TEST] Avancer le temps d'un jour
      </button>

      {state === "running" && <ActionCountdown character={character} now={now} />}

      {state === "idle" && (
        <>
          <h2>Action du jour</h2>
          <ActionBrowser
            character={character}
            actionTypes={actionTypes}
            onStart={handleStart}
            submitting={submitting}
            error={error}
          />
        </>
      )}

      {state === "idle" && lastAction && (
        <div className={`last-action ${frameClass}`.trim()}>
          <h2>Action de la veille</h2>
          <p className="action-type-label">{lastAction.label}</p>

          <button type="button" className="status-toggle" onClick={() => setExpanded((v) => !v)}>
            {lastAction.success ? "Succès" : "Échec"} {expanded ? "▲" : "▼"}
          </button>

          {expanded && <ActionOutcome lastAction={lastAction} showLoot={showLoot} />}
        </div>
      )}

      {state === "completed" && (
        <ActionResultDialog
          lastAction={lastAction}
          showLoot={showLoot}
          onClose={handleAcknowledge}
          closing={acknowledging}
          error={ackError}
        />
      )}
    </div>
  );
}
