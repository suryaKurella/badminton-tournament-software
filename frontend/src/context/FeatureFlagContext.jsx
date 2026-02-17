import { createContext, useState, useEffect, useContext, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const FeatureFlagContext = createContext({});

export const FeatureFlagProvider = ({ children }) => {
  const [flags, setFlags] = useState({});
  const [loaded, setLoaded] = useState(false);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/feature-flags`);
      if (res.ok) {
        const data = await res.json();
        setFlags(data.data || {});
      }
    } catch (err) {
      console.error('Failed to load feature flags:', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return (
    <FeatureFlagContext.Provider value={{ flags, loaded, refetchFlags: fetchFlags }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlag = (flagName) => {
  const { flags, loaded } = useContext(FeatureFlagContext);
  // Default to true while loading so features aren't hidden during load
  if (!loaded) return true;
  return flags[flagName] === true;
};

export const useFeatureFlags = () => {
  return useContext(FeatureFlagContext);
};
