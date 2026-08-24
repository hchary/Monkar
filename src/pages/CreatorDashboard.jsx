import { useSearchParams } from "react-router-dom";
import RegionsManager from "../components/creator/RegionsManager";
import ClimatsManager from "../components/creator/ClimatsManager";
import ReliefsManager from "../components/creator/ReliefsManager";
import FactionsManager from "../components/creator/FactionsManager";
import QuestLocationsManager from "../components/creator/QuestLocationsManager";
import OriginsManager from "../components/creator/OriginsManager";
import TalentsManager from "../components/creator/TalentsManager";
import TrainerTypesManager from "../components/creator/TrainerTypesManager";
import TagsManager from "../components/creator/TagsManager";
import CharactersOverview from "../components/creator/CharactersOverview";
import ObjectsManager from "../components/creator/ObjectsManager";
import ProfessionsManager from "../components/creator/ProfessionsManager";
import TablesDeTirageManager from "../components/creator/TablesDeTirageManager";
import ActionsManager from "../components/creator/ActionsManager";
import RecettesManager from "../components/creator/RecettesManager";
import MissionActionsManager from "../components/creator/MissionActionsManager";
import MissionSubjectsManager from "../components/creator/MissionSubjectsManager";

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
      "Lieux de quête": QuestLocationsManager,
    },
  },
  {
    name: "Missions",
    tabs: {
      "Actions de mission": MissionActionsManager,
      "Sujets de mission": MissionSubjectsManager,
    },
  },
  {
    name: "Actions",
    tabs: {
      Actions: ActionsManager,
      Recettes: RecettesManager,
    },
  },
  {
    name: "Système",
    tabs: {
      Tag: TagsManager,
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
      Métiers: ProfessionsManager,
      Objets: ObjectsManager,
      "Tables de tirage": TablesDeTirageManager,
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
