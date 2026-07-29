import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import useOwnCharacter from "../hooks/useOwnCharacter";
import CharacterCreation from "../components/CharacterCreation";
import CharacterBanner from "../components/CharacterBanner";
import CharacterTabs from "../components/CharacterTabs";
import ActionPanel from "../components/ActionPanel";
import ClimateBanner from "../components/ClimateBanner";
import OriginIntroDialog from "../components/OriginIntroDialog";

export default function CharacterProfile() {
  const { character, checked } = useOwnCharacter();
  const [regions, setRegions] = useState([]);
  const [climats, setClimats] = useState([]);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "regions", "items"), (snap) => {
      setRegions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "worldData", "climats", "items"), (snap) => {
      setClimats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  if (!checked) return <p>Chargement du personnage...</p>;
  if (!character) return <CharacterCreation />;

  const region = regions.find((r) => r.id === character.region?.id);
  const climat = climats.find((c) => c.id === region?.climatId);

  return (
    <div className="character-page">
      <OriginIntroDialog character={character} />
      <CharacterBanner character={character} />
      <div className="character-layout">
        <CharacterTabs character={character} />
        <ActionPanel character={character} />
      </div>
      <ClimateBanner bannerKey={climat?.bannerKey} />
    </div>
  );
}
