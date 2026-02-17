import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import Layout from './components/layout/Layout';
import Navbar from './components/layout/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import UsernameCheck from './components/auth/UsernameCheck';

// Lazy load pages for code splitting
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const TournamentList = lazy(() => import('./pages/tournaments/TournamentList'));
const TournamentDetails = lazy(() => import('./pages/tournaments/TournamentDetails'));
const TournamentCreate = lazy(() => import('./pages/tournaments/TournamentCreate'));
const TournamentEdit = lazy(() => import('./pages/tournaments/TournamentEdit'));
const MatchDetails = lazy(() => import('./pages/matches/MatchDetails'));
const LiveScoring = lazy(() => import('./pages/matches/LiveScoring'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));

// Club pages
const ClubList = lazy(() => import('./pages/clubs/ClubList'));
const ClubDetails = lazy(() => import('./pages/clubs/ClubDetails'));
const ClubCreate = lazy(() => import('./pages/clubs/ClubCreate'));
const ClubEdit = lazy(() => import('./pages/clubs/ClubEdit'));

// Admin pages
const FeatureFlags = lazy(() => import('./pages/admin/FeatureFlags'));

import { LoadingSpinner } from './components/common';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FeatureFlagProvider>
        <ToastProvider>
          <UsernameCheck>
            <Router>
              <Suspense fallback={<LoadingSpinner fullScreen message="Loading..." />}>
                <Routes>
                  {/* Auth routes - full width, with navbar only */}
                  <Route path="/login" element={
                    <div className="min-h-screen flex flex-col">
                      <Navbar />
                      <Login />
                    </div>
                  } />
                  <Route path="/register" element={
                    <div className="min-h-screen flex flex-col">
                      <Navbar />
                      <Register />
                    </div>
                  } />

                  {/* App routes - with Layout (centered, max-width) */}
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/tournaments" replace />} />

                    {/* Tournament routes */}
                    <Route path="/tournaments" element={<TournamentList />} />
                    <Route
                      path="/tournaments/create"
                      element={
                        <ProtectedRoute requireOrganizer>
                          <TournamentCreate />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/tournaments/:id/edit"
                      element={
                        <ProtectedRoute requireOrganizer>
                          <TournamentEdit />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/tournaments/:id" element={<TournamentDetails />} />

                    {/* Match routes */}
                    <Route path="/matches/:id" element={<MatchDetails />} />
                    <Route
                      path="/matches/:id/live-score"
                      element={
                        <ProtectedRoute>
                          <LiveScoring />
                        </ProtectedRoute>
                      }
                    />

                    {/* Leaderboard route */}
                    <Route path="/leaderboard" element={<Leaderboard />} />

                    {/* Club routes */}
                    <Route path="/clubs" element={<ClubList />} />
                    <Route
                      path="/clubs/create"
                      element={
                        <ProtectedRoute requireAdmin>
                          <ClubCreate />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/clubs/:id" element={<ClubDetails />} />
                    <Route
                      path="/clubs/:id/edit"
                      element={
                        <ProtectedRoute>
                          <ClubEdit />
                        </ProtectedRoute>
                      }
                    />

                    {/* Admin routes */}
                    <Route
                      path="/admin/feature-flags"
                      element={
                        <ProtectedRoute requireAdmin>
                          <FeatureFlags />
                        </ProtectedRoute>
                      }
                    />

                    {/* 404 */}
                    <Route path="*" element={<div className="error">Page not found</div>} />
                  </Route>
                </Routes>
              </Suspense>
            </Router>
          </UsernameCheck>
        </ToastProvider>
        </FeatureFlagProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
