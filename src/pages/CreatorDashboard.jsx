import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import RegionsManager from "../components/creator/RegionsManager";
import TraitsManager from "../components/creator/TraitsManager";
import TalentsManager from "../components/creator/TalentsManager";
import ActionTypesManager from "../components/creator/ActionTypesManager";
import QuestTypesManager from "../components/creator/QuestTypesManager";
import TrainerTypesManager from "../components/creator/TrainerTypesManager";
import CharactersOverview from "../components/creator/CharactersOverview";

const SECTIONS = {
  Régions: RegionsManager,
  Traits: TraitsManager,
  Talents: TalentsManager,
  "Types d'action": ActionTypesManager,
  "Types de quête": QuestTypesManager,
  "Types d'entraîneur": TrainerTypesManager,
  Personnages: CharactersOverview,
};

export default function CreatorDashboard() {
  const [searchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  const [section, setSection] = useState(SECTIONS[requestedSection] ? requestedSection : "Régions");
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
