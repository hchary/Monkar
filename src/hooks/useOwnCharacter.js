import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function useOwnCharacter() {
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

  return { character, checked };
}
