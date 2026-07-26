import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <nav className="navbar">
      <Link to="/">Mon personnage</Link>
      {user.role === "creator" && <Link to="/creator">Espace créateur</Link>}
      <button type="button" onClick={() => signOut(auth)}>
        Déconnexion
      </button>
    </nav>
  );
}
