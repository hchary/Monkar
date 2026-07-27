import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import InventoryTab from "./InventoryTab";

const TABS = [
  "Inventaire",
  "Talents",
  "Bénédictions",
  "Malédictions",
  "Blessures",
  "Journal des quêtes",
  "Historique du personnage",
  "Savoir du monde",
  "Messagerie",
];

function EmptyState({ text }) {
  return <p className="empty-state">{text}</p>;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function talentTooltip(talent) {
  return `[${talent.name}${talent.trainable ? "*" : ""} ${talent.quality}][${talent.effect}][Obtenu le ${formatShortDate(
    talent.lastChangeDate
  )} ${talent.lastChangeCircumstance}]`;
}

export default function CharacterTabs({ character }) {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "actionsLog"),
      where("ownerUid", "==", character.ownerUid),
      where("characterId", "==", character.id)
    );
    return onSnapshot(q, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      entries.sort((a, b) => (a.date < b.date ? 1 : -1));
      setHistory(entries);
    });
  }, [character.id]);

  return (
    <div className="character-tabs">
      <div className="tab-list">
        {TABS.map((tab) => (
          <button key={tab} className={tab === activeTab ? "selected" : ""} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === "Inventaire" && <InventoryTab character={character} />}

        {activeTab === "Talents" &&
          (character.talents?.length > 0 ? (
            <div className="talent-list">
              {character.talents.map((t, i) => (
                <div key={i} className={`talent-card rarity-${t.rarity}`} title={talentTooltip(t)}>
                  {t.name}
                  {t.trainable && "*"} {t.quality}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Aucun talent acquis pour l'instant." />
          ))}

        {activeTab === "Bénédictions" &&
          (character.blessings?.length > 0 ? (
            <ul>
              {character.blessings.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Aucune bénédiction pour l'instant." />
          ))}

        {activeTab === "Malédictions" &&
          (character.curses?.length > 0 ? (
            <ul>
              {character.curses.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Aucune malédiction pour l'instant." />
          ))}

        {activeTab === "Blessures" &&
          (character.wounds?.length > 0 ? (
            <ul>
              {character.wounds.map((w, i) => (
                <li key={i}>
                  <strong>{w.name}</strong> ({w.date}) — {w.description}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Aucune blessure, tant mieux." />
          ))}

        {activeTab === "Journal des quêtes" && <EmptyState text="Section à venir." />}

        {activeTab === "Historique du personnage" &&
          (history.length > 0 ? (
            <ul>
              {history.map((entry) => (
                <li key={entry.id}>
                  {entry.date} — {entry.tierName} {entry.success ? "(succès)" : "(échec)"}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Aucune action enregistrée pour l'instant." />
          ))}

        {activeTab === "Savoir du monde" && <EmptyState text="Section à venir — le créateur enrichira le savoir du monde ici." />}

        {activeTab === "Messagerie" && <EmptyState text="Messagerie à venir." />}
      </div>
    </div>
  );
}
