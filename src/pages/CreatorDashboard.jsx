import { useSearchParams } from "react-router-dom";
import RegionsManager from "../components/creator/RegionsManager";
import ClimatsManager from "../components/creator/ClimatsManager";
import ReliefsManager from "../components/creator/ReliefsManager";
import FactionsManager from "../components/creator/FactionsManager";
import AdventureZonesManager from "../components/creator/AdventureZonesManager";
import QuestSubjectsManager from "../components/creator/QuestSubjectsManager";
import OriginsManager from "../components/creator/OriginsManager";
import TalentsManager from "../components/creator/TalentsManager";
import ActionTypesManager from "../components/creator/ActionTypesManager";
import TrainerTypesManager from "../components/creator/TrainerTypesManager";
import TextGenerationManager from "../components/creator/TextGenerationManager";
import CharactersOverview from "../components/creator/CharactersOverview";

const DEFAULT_SECTION = "Régions";

const SECTIONS = {
  Régions: RegionsManager,
  Climat: ClimatsManager,
  Reliefs: ReliefsManager,
  Factions: FactionsManager,
  "Zones d'aventures": AdventureZonesManager,
  "Sujets de quête": QuestSubjectsManager,
  Origines: OriginsManager,
  Talents: TalentsManager,
  "Types d'action": ActionTypesManager,
  "Types d'entraîneur": TrainerTypesManager,
  "Génération de texte": TextGenerationManager,
  Personnages: CharactersOverview,
};

export default function CreatorDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("section");
  const section = SECTIONS[requested] ? requested : DEFAULT_SECTION;
  const Section = SECTIONS[section];

  function selectSection(name) {
    setSearchParams(name === DEFAULT_SECTION ? {} : { section: name });
  }

  return (
    <div className="creator-dashboard">
      <h1>Espace créateur</h1>
      <div className="creator-nav">
        {Object.keys(SECTIONS).map((name) => (
          <button key={name} className={name === section ? "selected" : ""} onClick={() => selectSection(name)}>
            {name}
          </button>
        ))}
      </div>
      <Section />
    </div>
  );
}
