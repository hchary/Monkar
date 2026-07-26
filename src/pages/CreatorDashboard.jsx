import { useState } from "react";
import RegionsManager from "../components/creator/RegionsManager";
import TraitsManager from "../components/creator/TraitsManager";
import ActionTypesManager from "../components/creator/ActionTypesManager";
import CharactersOverview from "../components/creator/CharactersOverview";

const SECTIONS = {
  Régions: RegionsManager,
  Traits: TraitsManager,
  "Types d'action": ActionTypesManager,
  Personnages: CharactersOverview,
};

export default function CreatorDashboard() {
  const [section, setSection] = useState("Régions");
  const Section = SECTIONS[section];

  return (
    <div className="creator-dashboard">
      <h1>Espace créateur</h1>
      <div className="creator-nav">
        {Object.keys(SECTIONS).map((name) => (
          <button key={name} className={name === section ? "selected" : ""} onClick={() => setSection(name)}>
            {name}
          </button>
        ))}
      </div>
      <Section />
    </div>
  );
}
