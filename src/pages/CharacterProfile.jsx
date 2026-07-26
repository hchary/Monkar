import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import CharacterCreation from "../components/CharacterCreation";
import CharacterBanner from "../components/CharacterBanner";
import CharacterTabs from "../components/CharacterTabs";
import ActionPanel from "../components/ActionPanel";

export default function CharacterProfile() {
  const { user } = useAuth();
  const [character, setCharacter] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "characters"), where("ownerUid", "==", user.uid), where("alive", "==", true));
    return onSnapshot(q, (snap) => {
      setCharacter(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      setChecked(true);
    });
  }, [user]);

  if (!checked) return <p>Chargement du personnage...</p>;
  if (!character) return <CharacterCreation />;

  return (
    <div className="character-page">
      <CharacterBanner character={character} />
      <div className="character-layout">
        <CharacterTabs character={character} />
        <ActionPanel character={character} />
      </div>
    </div>
  );
}
