import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requireCreator = false }) {
  const { user, loading } = useAuth();

  if (loading) return <p>Chargement...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireCreator && user.role !== "creator") return <Navigate to="/" replace />;

  return children;
}
