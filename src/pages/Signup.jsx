import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../lib/firebase";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      const characterRef = doc(collection(db, "characters"));
      await setDoc(characterRef, {
        ownerUid: cred.user.uid,
        name: characterName,
        stats: { force: 5, agilite: 5, intelligence: 5, charisme: 5 },
        lastActionDate: null,
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, "users", cred.user.uid), {
        role: "player",
        characterId: characterRef.id,
      });

      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <h1>Inscription</h1>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input type="text" placeholder="Nom du personnage" value={characterName} onChange={(e) => setCharacterName(e.target.value)} required />
        <button type="submit">Créer mon personnage</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p>
        Déjà un compte ? <Link to="/login">Connexion</Link>
      </p>
    </div>
  );
}
