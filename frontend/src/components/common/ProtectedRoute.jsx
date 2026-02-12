import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, requireOrganizer = false, requireAdmin = false }) => {
  const { isAuthenticated, isOrganizer, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <div className="error">You don't have permission to access this page.</div>;
  }

  if (requireOrganizer && !isOrganizer) {
    return <div className="error">You don't have permission to access this page.</div>;
  }

  return children;
};

export default ProtectedRoute;
