import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { normalizeActionType } from "../lib/actionCatalog";
import { actionState } from "../lib/actionLifecycle";
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

  async function handleStart(actionTypeId, payload = {}) {
    setSubmitting(true);
    setError("");
    try {
      const performAction = httpsCallable(functions, "performAction");
      await performAction({ actionTypeId, ...payload });
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
  // leave the panel with nothing to show. See functions/src/index.js's debugAdvanceTime for why
  // this is a callable rather than a direct write.
  async function handleDebugAdvanceTime() {
    const debugAdvanceTime = httpsCallable(functions, "debugAdvanceTime");
    await debugAdvanceTime();
  }

  const actionType = actionTypes.find((a) => a.id === lastAction?.actionTypeId);
  const showLoot = !!actionType && normalizeActionType(actionType).result.showLoot;

  const accent = lastAction?.accent;
  const frameClass = accent ? `${accent.kind}-frame ${accent.kind}-${accent.value}` : "";

  return (
    <div className="action-panel">
      {/* TODO: remove this test-only button before the game goes live to real players */}
      <button type="button" className="debug-button" onClick={handleDebugAdvanceTime}>
        [TEST] Avancer le temps d'un Interval
      </button>

      {state === "running" && <ActionCountdown character={character} now={now} />}

      {state === "idle" && (
        <>
          <h2>Action de l'Interval</h2>
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
          <h2>Dernier Interval</h2>
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
