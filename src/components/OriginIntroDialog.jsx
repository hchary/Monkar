import { useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";

// Welcomes the player on their first visit to a freshly created character's page, recapping the
// origin randomly assigned at creation (functions/src/index.js createCharacter) and what it
// granted. Shown once — dismissing it flips originIntroSeen so it never reappears.
export default function OriginIntroDialog({ character }) {
  const dialogRef = useRef(null);
  const origin = character.origin;
  const shouldShow = !!origin && !character.originIntroSeen;

  useEffect(() => {
    if (shouldShow) dialogRef.current?.showModal();
  }, [character.id, shouldShow]);

  if (!shouldShow) return null;

  async function handleClose() {
    dialogRef.current?.close();
    const acknowledgeOriginIntro = httpsCallable(functions, "acknowledgeOriginIntro");
    await acknowledgeOriginIntro();
  }

  return (
    <dialog ref={dialogRef} className="origin-intro-dialog" onCancel={(e) => e.preventDefault()}>
      <div className="origin-intro-content">
        <h3>Ton origine : {origin.name}</h3>
        {origin.description && <p className="origin-description">{origin.description}</p>}

        {origin.talents?.length > 0 && (
          <div>
            <p className="origin-section-label">Talents :</p>
            <ul>
              {origin.talents.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </div>
        )}

        {origin.profession && <p>Métier : {origin.profession}</p>}

        <p>Réputation de départ : {origin.reputationStart ?? 0}</p>

        {origin.items?.length > 0 && (
          <div>
            <p className="origin-section-label">Équipement de départ :</p>
            <ul>
              {origin.items.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="origin-farewell">Bonne chance, vous en aurez besoin…</p>

        <button type="button" onClick={handleClose}>
          Commencer l'aventure
        </button>
      </div>
    </dialog>
  );
}
