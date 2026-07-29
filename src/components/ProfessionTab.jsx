import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { normalizeActionType } from "../lib/actionCatalog";
import { CRAFTING_ACTION_KIND_ID, actionKindInheritsFrom } from "../lib/actionKinds";
import CraftingTab from "./CraftingTab";

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
  const [activeSubTab, setActiveSubTab] = useState("description");

  const profession = professions.find((p) => p.id === character.professionId);
  const knownProfessions = character.knownProfessions || [];

  // Every enabled Artisanat action tied to the active profession gets its own sub-tab, right
  // beside the profession's own description - see CraftingTab.jsx for what it shows.
  const craftActions = (profession?.actionIds || [])
    .map((id) => actionTypes.find((a) => a.id === id))
    .filter(Boolean)
    .map((a) => normalizeActionType(a))
    .filter((a) => a.enabled && actionKindInheritsFrom(a.kindId, CRAFTING_ACTION_KIND_ID));

  useEffect(() => {
    if (activeSubTab === "description") return;
    if (!craftActions.some((a) => a.id === activeSubTab)) setActiveSubTab("description");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [craftActions]);

  async function selectKnownProfession(professionId) {
    if (professionId !== character.professionId) {
      const switchKnownProfession = httpsCallable(functions, "switchKnownProfession");
      await switchKnownProfession({ professionId });
    }
    dialogRef.current?.close();
  }

  return (
    <div className="profession-tab">
      {craftActions.length > 0 && (
        <div className="tab-list">
          <button
            type="button"
            className={activeSubTab === "description" ? "selected" : ""}
            onClick={() => setActiveSubTab("description")}
          >
            Description
          </button>
          {craftActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={activeSubTab === action.id ? "selected" : ""}
              onClick={() => setActiveSubTab(action.id)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {activeSubTab !== "description" && (
        <CraftingTab character={character} actionType={craftActions.find((a) => a.id === activeSubTab)} />
      )}

      {activeSubTab === "description" && (
        <>
          {profession ? (
            <>
              <h3>
                {profession.name} Niv {character.professionLevel}
              </h3>
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
        </>
      )}

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
                    onClick={() => selectKnownProfession(k.professionId)}
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
