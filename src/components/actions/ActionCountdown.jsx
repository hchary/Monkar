import { actionCompletesAtMillis } from "../../lib/actionLifecycle";

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Replaces the action panel's contents while an action is running (R10): a ticking HH:MM:SS
// countdown framed in the accent the server decided at resolution time - the drawn quest's
// difficulty, or the action's category as a fallback (D9). `now` is owned by ActionPanel so a
// single interval drives both this countdown and the idle/running/completed transition itself.
export default function ActionCountdown({ character, now }) {
  const lastAction = character.lastAction;
  const completesAt = actionCompletesAtMillis(character);
  const accent = lastAction?.accent;
  const frameClass = accent ? `${accent.kind}-frame ${accent.kind}-${accent.value}` : "";

  return (
    <div className={`action-countdown ${frameClass}`.trim()}>
      <p className="action-countdown-label">{lastAction?.label}</p>
      <p className="action-countdown-timer">{formatRemaining((completesAt ?? now) - now)}</p>
    </div>
  );
}
