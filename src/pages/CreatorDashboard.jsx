import { useSearchParams } from "react-router-dom";
import RegionsManager from "../components/creator/RegionsManager";
import ClimatsManager from "../components/creator/ClimatsManager";
import ReliefsManager from "../components/creator/ReliefsManager";
import FactionsManager from "../components/creator/FactionsManager";
import QuestLocationsManager from "../components/creator/QuestLocationsManager";
import QuestObjectivesManager from "../components/creator/QuestObjectivesManager";
import OriginsManager from "../components/creator/OriginsManager";
import TalentsManager from "../components/creator/TalentsManager";
import TrainerTypesManager from "../components/creator/TrainerTypesManager";
import QuestsManager from "../components/creator/QuestsManager";
import TextGenerationManager from "../components/creator/TextGenerationManager";
import CharactersOverview from "../components/creator/CharactersOverview";

const DEFAULT_SECTION = "Régions";

const GROUPS = [
  {
    name: "Carte",
    tabs: {
      Régions: RegionsManager,
      Climat: ClimatsManager,
      Reliefs: ReliefsManager,
    },
  },
  {
    name: "Quêtes",
    tabs: {
      Quêtes: QuestsManager,
      "Objectifs de quête": QuestObjectivesManager,
      "Lieux de quête": QuestLocationsManager,
    },
  },
  {
    name: "Narration",
    tabs: {
      "Génération de texte": TextGenerationManager,
    },
  },
  {
    name: "PNJs",
    tabs: {
      Factions: FactionsManager,
      "Types d'entraîneur": TrainerTypesManager,
    },
  },
  {
    name: "Personnages",
    tabs: {
      Personnages: CharactersOverview,
      Origines: OriginsManager,
      Talents: TalentsManager,
    },
  },
];

const SECTIONS = Object.fromEntries(GROUPS.flatMap((group) => Object.entries(group.tabs)));

const GROUP_OF_SECTION = Object.fromEntries(
  GROUPS.flatMap((group) => Object.keys(group.tabs).map((name) => [name, group.name]))
);

export default function CreatorDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("section");
  const section = SECTIONS[requested] ? requested : DEFAULT_SECTION;
  const Section = SECTIONS[section];
  const activeGroup = GROUP_OF_SECTION[section];

  function selectSection(name) {
    setSearchParams(name === DEFAULT_SECTION ? {} : { section: name });
  }

  function selectGroup(group) {
    selectSection(Object.keys(group.tabs)[0]);
  }

  return (
    <div className="creator-dashboard">
      <h1>Espace créateur</h1>
      <div className="creator-groups">
        {GROUPS.map((group) => {
          const isActive = group.name === activeGroup;
          return (
            <div key={group.name} className={`creator-group ${isActive ? "expanded" : "collapsed"}`}>
              <button type="button" className="creator-group-header" onClick={() => selectGroup(group)}>
                {group.name}
              </button>
              {isActive && (
                <div className="creator-group-tabs">
                  {Object.keys(group.tabs).map((name) => (
                    <button
                      key={name}
                      className={name === section ? "selected" : ""}
                      onClick={() => selectSection(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Section />
    </div>
  );
}
