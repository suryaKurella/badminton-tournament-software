import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import UsernameModal from '../common/UsernameModal';

const UsernameCheck = ({ children }) => {
  const { isAuthenticated, dbUser, loading } = useAuth();
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!loading && !hasChecked) {
      // Only check once after loading is complete
      if (isAuthenticated && dbUser && !dbUser.username) {
        setShowUsernameModal(true);
      }
      setHasChecked(true);
    }
  }, [loading, isAuthenticated, dbUser, hasChecked]);

  const handleUsernameComplete = (username) => {
    setShowUsernameModal(false);
    // Reload the page to fetch updated user data
    window.location.reload();
  };

  return (
    <>
      {children}
      <UsernameModal
        isOpen={showUsernameModal}
        onComplete={handleUsernameComplete}
      />
    </>
  );
};

export default UsernameCheck;
