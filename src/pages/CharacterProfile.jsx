import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import CharacterCreation from "../components/CharacterCreation";
import CharacterBanner from "../components/CharacterBanner";
import CharacterTabs from "../components/CharacterTabs";
import ActionPanel from "../components/ActionPanel";
import ClimateBanner from "../components/ClimateBanner";

export default function CharacterProfile() {
  const { user } = useAuth();
  const [character, setCharacter] = useState(null);
  const [checked, setChecked] = useState(false);
  const [regions, setRegions] = useState([]);
  const [climats, setClimats] = useState([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "characters"), where("ownerUid", "==", user.uid), where("alive", "==", true));
    return onSnapshot(q, (snap) => {
      setCharacter(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      setChecked(true);
    });
  }, [user]);

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
      <CharacterBanner character={character} />
      <div className="character-layout">
        <CharacterTabs character={character} />
        <ActionPanel character={character} />
      </div>
      <ClimateBanner bannerKey={climat?.bannerKey} />
    </div>
  );
}
