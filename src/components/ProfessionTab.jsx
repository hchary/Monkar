import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { withProfessionChange } from "../lib/professions";

function useItems(collectionName) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    return onSnapshot(collection(db, "worldData", collectionName, "items"), (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [collectionName]);
  return items;
}

export default function ProfessionTab({ character }) {
  const professions = useItems("professions");
  const actionTypes = useItems("actionTypes");
  const dialogRef = useRef(null);

  const profession = professions.find((p) => p.id === character.professionId);
  const knownProfessions = character.knownProfessions || [];
  const income = (profession?.baseIncome || 0) * (character.professionLevel || 0);

  async function selectKnownProfession(professionId, level) {
    if (professionId === character.professionId) {
      dialogRef.current?.close();
      return;
    }
    await updateDoc(doc(db, "characters", character.id), withProfessionChange(character, professionId, level));
    dialogRef.current?.close();
  }

  return (
    <div className="profession-tab">
      {profession ? (
        <>
          <h3>
            {profession.name} Niv {character.professionLevel}
          </h3>
          <p>
            Revenu : {income} pièce{income > 1 ? "s" : ""} de cuivre
          </p>
          <p>{profession.description}</p>
          <div>
            <strong>Actions associées</strong>
            {(profession.actionIds || []).length > 0 ? (
              <ul>
                {profession.actionIds.map((id) => (
                  <li key={id}>{actionTypes.find((a) => a.id === id)?.label || id}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">Aucune action associée.</p>
            )}
          </div>
        </>
      ) : (
        <p className="empty-state">Aucun métier pour l'instant.</p>
      )}

      <button type="button" className="link-button" onClick={() => dialogRef.current?.showModal()}>
        Métiers connus
      </button>

      <dialog
        ref={dialogRef}
        className="known-professions-dialog"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="known-professions-content">
          <h4>Métiers connus</h4>
          {knownProfessions.length === 0 ? (
            <p className="empty-state">Aucun métier connu.</p>
          ) : (
            <ul>
              {knownProfessions.map((k) => (
                <li key={k.professionId}>
                  <button
                    type="button"
                    className={k.professionId === character.professionId ? "selected" : ""}
                    onClick={() => selectKnownProfession(k.professionId, k.level)}
                  >
                    {professions.find((p) => p.id === k.professionId)?.name || k.professionId} — Niv {k.level}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => dialogRef.current?.close()}>
            Fermer
          </button>
        </div>
      </dialog>
    </div>
  );
}
