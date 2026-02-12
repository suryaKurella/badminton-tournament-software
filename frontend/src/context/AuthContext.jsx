import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabase';
import api, { setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [dbUser, setDbUser] = useState(null); // User profile from database
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user profile from database
  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setDbUser(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setDbUser(null);
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Set auth token for API requests
      setAuthToken(session?.access_token);

      // Fetch database user profile if session exists
      if (session?.user) {
        await fetchUserProfile();
      }

      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip token refresh events to prevent unnecessary re-renders
      // Token refresh doesn't change the user, just refreshes the access token
      if (event === 'TOKEN_REFRESHED') {
        // Only update the auth token silently, no state changes needed
        setAuthToken(session?.access_token);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      // Set auth token for API requests
      setAuthToken(session?.access_token);

      // Fetch database user profile if session exists
      if (session?.user) {
        await fetchUserProfile();
      } else {
        setDbUser(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (credentials) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;

      return { success: true, user: data.user };
    } catch (error) {
      const message = error.message || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            username: userData.username,
            full_name: userData.fullName,
            phone_number: userData.phoneNumber,
            role: userData.role || 'PLAYER',
          },
          // For development: auto-confirm users without email verification
          // In production, remove this and enable email confirmation in Supabase
          emailRedirectTo: `${window.location.origin}/tournaments`,
        },
      });

      if (error) throw error;

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return {
          success: true,
          user: data.user,
          requiresEmailConfirmation: true,
          message: 'Please check your email to confirm your account before logging in.'
        };
      }

      return { success: true, user: data.user };
    } catch (error) {
      const message = error.message || 'Registration failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const loginWithGoogle = async () => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/tournaments`,
        },
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      const message = error.message || 'Google login failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
      setDbUser(null);
      setAuthToken(null); // Clear auth token
    } catch (error) {
      console.error('Logout error:', error);
      setError(error.message);
    }
  };

  // Helper to get the access token
  const getAccessToken = () => session?.access_token;

  const value = {
    user,
    session,
    dbUser, // Database user profile with role
    loading,
    error,
    login,
    register,
    logout,
    loginWithGoogle,
    getAccessToken,
    isAuthenticated: !!user,
    isRoot: dbUser?.role === 'ROOT',
    isAdmin: dbUser?.role === 'ADMIN' || dbUser?.role === 'ROOT',
    isOrganizer: dbUser?.role === 'ORGANIZER' || dbUser?.role === 'ADMIN' || dbUser?.role === 'ROOT',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
