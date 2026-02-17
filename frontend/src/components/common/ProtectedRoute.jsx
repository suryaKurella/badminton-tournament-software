import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children, requireOrganizer = false, requireAdmin = false }) => {
  const { isAuthenticated, isOrganizer, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="text-center py-12 text-muted">
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  if (requireOrganizer && !isOrganizer) {
    return (
      <div className="text-center py-12 text-muted">
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
