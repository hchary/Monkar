import { useState } from "react";
import InventoryTab from "./InventoryTab";
import ProfessionTab from "./ProfessionTab";
import EmptyState from "./EmptyState";

const TABS = ["Inventaire", "Talents", "Métier", "Santé"];

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
                <div key={i} className={`talent-card rarity-${t.rarity}`} data-tooltip={talentTooltip(t)}>
                  {t.name}
                  {t.trainable && "*"} {t.quality}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Aucun talent acquis pour l'instant." />
          ))}

        {activeTab === "Métier" && <ProfessionTab character={character} />}

        {activeTab === "Santé" && (
          <ul className="wound-counters">
            <li>Blessures légères : {character.woundsLight || 0}</li>
            <li>Blessures graves : {character.woundsSevere || 0}</li>
            <li>Blessures permanentes : {character.woundsPermanent || 0}</li>
          </ul>
        )}
      </div>
    </div>
  );
}
