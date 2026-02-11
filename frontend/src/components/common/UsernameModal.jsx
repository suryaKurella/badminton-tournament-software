import { useState, useEffect } from 'react';
import { authAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const UsernameModal = ({ isOpen, onComplete }) => {
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!username || username.length < 3) {
      setIsAvailable(null);
      setError('');
      return;
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens');
      setIsAvailable(false);
      return;
    }

    const checkUsername = async () => {
      setIsChecking(true);
      setError('');
      try {
        const response = await authAPI.checkUsername(username);
        setIsAvailable(response.data.available);
        if (!response.data.available) {
          setError('Username is already taken');
        }
      } catch (err) {
        console.error('Error checking username:', err);
        setError(err.response?.data?.message || 'Error checking username');
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    };

    const debounce = setTimeout(checkUsername, 500);
    return () => clearTimeout(debounce);
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    if (!isAvailable) {
      setError('Please choose an available username');
      return;
    }

    setIsSaving(true);
    try {
      await authAPI.updateProfile({ username });
      toast.success('Username set successfully!');
      onComplete(username);
    } catch (err) {
      console.error('Error setting username:', err);
      toast.error(err.response?.data?.message || 'Failed to set username');
      setError(err.response?.data?.message || 'Failed to set username');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-modal w-full max-w-md p-6 sm:p-8">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900 dark:text-white">
          Choose Your Username
        </h2>
        <p className="text-sm sm:text-base text-muted mb-6">
          Pick a unique username to complete your profile. This will be visible to other users.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="username" className="block text-sm font-semibold text-primary mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="Enter username"
              className="glass-input w-full px-4 py-3 text-primary placeholder-gray-400 dark:placeholder-gray-500"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
              autoFocus
            />
            {username.length >= 3 && (
              <div className="mt-2">
                {isChecking ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Checking availability...</p>
                ) : isAvailable === true ? (
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Username is available</p>
                ) : isAvailable === false && error ? (
                  <p className="text-sm text-error font-medium">✗ {error}</p>
                ) : null}
              </div>
            )}
            {error && username.length < 3 && (
              <p className="text-sm text-error mt-2">{error}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!isAvailable || isSaving || isChecking}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-brand-blue to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSaving ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </form>

        <p className="text-xs text-muted mt-4 text-center">
          Username must be 3-30 characters and can only contain letters, numbers, underscores, and hyphens.
        </p>
      </div>
    </div>
  );
};

export default UsernameModal;
