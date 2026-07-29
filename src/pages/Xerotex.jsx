import { useState } from "react";
import { Navigate } from "react-router-dom";
import useOwnCharacter from "../hooks/useOwnCharacter";
import CharacterBanner from "../components/CharacterBanner";
import CharacterHistoryTab from "../components/CharacterHistoryTab";
import EmptyState from "../components/EmptyState";

const TABS = ["Savoir du monde", "Historique du personnage", "Journal des quêtes"];

export default function Xerotex() {
  const { character, checked } = useOwnCharacter();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  if (!checked) return <p>Chargement du personnage...</p>;
  if (!character) return <Navigate to="/" replace />;

  return (
    <div className="character-page">
      <CharacterBanner character={character} />
      <div className="character-tabs">
        <div className="tab-list">
          {TABS.map((tab) => (
            <button key={tab} className={tab === activeTab ? "selected" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === "Savoir du monde" && (
            <EmptyState text="Section à venir — le créateur enrichira le savoir du monde ici." />
          )}
          {activeTab === "Historique du personnage" && <CharacterHistoryTab character={character} />}
          {activeTab === "Journal des quêtes" && <EmptyState text="Section à venir." />}
        </div>
      </div>
    </div>
  );
}
