import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, dbUser, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="glass-nav sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link
            to="/tournaments"
            className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-900 dark:text-white hover:opacity-80 transition-opacity"
            onClick={closeMobileMenu}
          >
            <span className="text-2xl">🏸</span>
            <span className="hidden sm:inline">Poola Kundi Tournament Software</span>
            <span className="sm:hidden">Poola Kundi</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-4 lg:gap-6 items-center">
            <Link
              to="/tournaments"
              className="text-primary hover:text-brand-green dark:hover:text-green-400 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface"
            >
              Tournaments
            </Link>
            <Link
              to="/leaderboard"
              className="text-primary hover:text-brand-green dark:hover:text-green-400 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface"
            >
              Leaderboard
            </Link>
            <Link
              to="/clubs"
              className="text-primary hover:text-brand-green dark:hover:text-green-400 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface"
            >
              Clubs
            </Link>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="glass-button p-2.5 text-xl"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {isAuthenticated ? (
              <div className="flex gap-3 lg:gap-4 items-center">
                <div className="flex items-center gap-2 px-3 py-1.5 glass-surface">
                  <span className="text-lg">👤</span>
                  <span className="text-sm font-medium text-primary">
                    {dbUser?.fullName || dbUser?.username || user?.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 hover:border-error px-4 lg:px-6 py-2 rounded-lg font-semibold text-sm transition-all"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex gap-3 items-center">
                <Link
                  to="/login"
                  className="text-primary hover:text-brand-green dark:hover:text-green-400 font-medium transition-colors px-4 py-2"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={toggleTheme}
              className="glass-button p-2 text-xl"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-primary"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-light-border dark:border-dark-border animate-slide-down">
            <div className="flex flex-col gap-2">
              <Link
                to="/tournaments"
                className="text-primary hover:text-brand-green dark:hover:text-green-400 font-medium py-2.5 px-3 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface transition-all"
                onClick={closeMobileMenu}
              >
                Tournaments
              </Link>
              <Link
                to="/leaderboard"
                className="text-primary hover:text-brand-green dark:hover:text-green-400 font-medium py-2.5 px-3 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface transition-all"
                onClick={closeMobileMenu}
              >
                Leaderboard
              </Link>
              <Link
                to="/clubs"
                className="text-primary hover:text-brand-green dark:hover:text-green-400 font-medium py-2.5 px-3 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface transition-all"
                onClick={closeMobileMenu}
              >
                Clubs
              </Link>

              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-2 py-2.5 px-3 text-sm font-medium text-primary glass-surface">
                    <span className="text-base">👤</span>
                    {dbUser?.fullName || dbUser?.username || user?.email?.split('@')[0]}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 hover:border-error px-4 py-2.5 rounded-lg font-semibold text-sm transition-all text-left"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-primary hover:text-brand-green dark:hover:text-green-400 font-medium py-2.5 px-3 rounded-lg hover:bg-light-surface dark:hover:bg-dark-surface transition-all"
                    onClick={closeMobileMenu}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="btn-primary text-sm text-center py-2.5"
                    onClick={closeMobileMenu}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
