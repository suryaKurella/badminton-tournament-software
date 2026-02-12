import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Pencil, LayoutGrid, List, MapPin, Calendar, Users, Building2 } from 'lucide-react';
import { tournamentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmationModal, StatusBadge, LoadingSpinner, Button, IconButton, TournamentTimer } from '../../components/common';

const TournamentList = () => {
  const { isOrganizer, isRoot, loading: authLoading } = useAuth();
  const toast = useToast();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    // Persist view preference in localStorage
    return localStorage.getItem('tournamentViewMode') || 'card';
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    tournamentId: null,
  });

  useEffect(() => {
    // Wait for auth to finish loading before fetching tournaments
    if (!authLoading) {
      fetchTournaments();
    }
  }, [filter, authLoading]);

  const fetchTournaments = async () => {
    try {
      const params = filter ? { status: filter } : {};
      const response = await tournamentAPI.getAll(params);
      setTournaments(response.data.data);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e, tournamentId, tournamentName) => {
    e.preventDefault(); // Prevent navigation to tournament details
    e.stopPropagation();

    setConfirmModal({
      isOpen: true,
      title: 'Delete Tournament',
      message: `Are you sure you want to delete "${tournamentName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'danger',
      tournamentId,
      onConfirm: () => confirmDelete(tournamentId),
    });
  };

  const confirmDelete = async (tournamentId) => {
    try {
      // First, close the modal immediately
      setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {}, tournamentId: null });

      // Optimistically remove from UI
      setTournaments(prev => prev.filter(t => t.id !== tournamentId));

      // Call delete API
      await tournamentAPI.delete(tournamentId);
      toast.success('Tournament deleted successfully');

      // Refresh the list to ensure consistency with server
      await fetchTournaments();
    } catch (error) {
      console.error('Error deleting tournament:', error);

      // If delete failed, refresh the list to restore correct state
      await fetchTournaments();

      if (error.response?.status === 404) {
        toast.info('Tournament was already deleted');
      } else {
        toast.error(error.response?.data?.message || 'Failed to delete tournament');
      }
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading tournaments..." />;
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 pb-4 border-b-2 border-gray-200 dark:border-slate-700">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Tournaments</h1>
        {isOrganizer && (
          <Link to="/tournaments/create">
            <Button variant="outline" size="md">
              Create Tournament
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-6 sm:mb-8 flex flex-wrap gap-4 items-center justify-between">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="glass-surface w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm text-gray-900 dark:text-white cursor-pointer font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
        >
          <option value="">All Tournaments</option>
          {isOrganizer && <option value="DRAFT">Draft</option>}
          <option value="OPEN">Open for Registration</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
        </select>

        {/* View Toggle */}
        <div className="flex gap-1 glass-surface p-1">
          <button
            onClick={() => {
              setViewMode('card');
              localStorage.setItem('tournamentViewMode', 'card');
            }}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'card'
                ? 'bg-brand-blue text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            title="Card view"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => {
              setViewMode('list');
              localStorage.setItem('tournamentViewMode', 'list');
            }}
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-brand-blue text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
            title="List view"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Split tournaments into active and completed */}
      {(() => {
        const activeTournaments = tournaments.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
        const completedTournaments = tournaments.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED');

        // Card View
        const renderTournamentCard = (tournament) => (
          <Link
            to={`/tournaments/${tournament.id}`}
            key={tournament.id}
            className="glass-card p-5 sm:p-6 lg:p-7 block hover:-translate-y-1 relative"
          >
            <div className="flex justify-between items-start mb-3 sm:mb-4 gap-3 sm:gap-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight flex-1">
                {tournament.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={tournament.status} />
                {tournament.status === 'OPEN' && tournament.registrationClosed && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    🔒 Closed
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3 mb-4 flex-wrap">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold bg-gray-50 dark:bg-slate-700 px-3 py-1.5 rounded-md">
                {tournament.tournamentType}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold bg-gray-50 dark:bg-slate-700 px-3 py-1.5 rounded-md">
                {tournament.format.replace('_', ' ')}
              </p>
              {tournament.club && (
                <p className="text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-3 py-1.5 rounded-md flex items-center gap-1.5">
                  <Building2 size={12} />
                  {tournament.club.name}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2.5 mb-4">
              <div className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-white">
                <span className="text-lg">📍</span>
                <span>{tournament.location}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-white">
                <span className="text-lg">📅</span>
                <span>{formatDate(tournament.startDate)}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-900 dark:text-white">
                <span className="text-lg">👥</span>
                <span>
                  {tournament.registrations?.length || 0}/{tournament.maxParticipants}
                </span>
              </div>
            </div>

            {/* Tournament Timer - Countdown for upcoming, elapsed for active */}
            {(tournament.status === 'ACTIVE' || tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
              <div className="mb-4">
                <TournamentTimer
                  startedAt={tournament.startedAt}
                  startDate={tournament.startDate}
                  status={tournament.status}
                  isPaused={tournament.isPaused}
                  pausedAt={tournament.pausedAt}
                  totalPausedTime={tournament.totalPausedTime}
                  compact
                />
              </div>
            )}

            {tournament.description && (
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-2 mt-2">
                {tournament.description}
              </p>
            )}

            {/* Action Buttons - Bottom right */}
            <div className="absolute bottom-4 right-4 flex gap-2 z-10">
              {/* Edit Button - For organizers */}
              {isOrganizer && (
                <Link
                  to={`/tournaments/${tournament.id}/edit`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  title="Edit tournament"
                >
                  <Pencil size={16} />
                </Link>
              )}
              {/* Delete Button - Only for ROOT users */}
              {isRoot && (
                <IconButton
                  variant="error"
                  onClick={(e) => handleDeleteClick(e, tournament.id, tournament.name)}
                  title="Delete tournament"
                >
                  <Trash2 size={16} />
                </IconButton>
              )}
            </div>
          </Link>
        );

        // List View
        const renderTournamentListItem = (tournament) => (
          <Link
            to={`/tournaments/${tournament.id}`}
            key={tournament.id}
            className="glass-card p-4 block hover:scale-[1.01] transition-transform"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              {/* Name and Status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {tournament.name}
                  </h3>
                  <StatusBadge status={tournament.status} />
                  {tournament.status === 'OPEN' && tournament.registrationClosed && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                      🔒
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                    {tournament.tournamentType}
                  </span>
                  <span className="font-medium bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                    {tournament.format.replace('_', ' ')}
                  </span>
                  {tournament.club && (
                    <span className="font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded flex items-center gap-1">
                      <Building2 size={10} />
                      {tournament.club.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Info columns */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <MapPin size={14} className="text-gray-400" />
                  <span className="truncate max-w-[120px]">{tournament.location}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <Calendar size={14} className="text-gray-400" />
                  <span>{formatDate(tournament.startDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <Users size={14} className="text-gray-400" />
                  <span>{tournament.registrations?.length || 0}/{tournament.maxParticipants}</span>
                </div>

                {/* Timer for active tournaments */}
                {(tournament.status === 'ACTIVE' || tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
                  <TournamentTimer
                    startedAt={tournament.startedAt}
                    startDate={tournament.startDate}
                    status={tournament.status}
                    isPaused={tournament.isPaused}
                    pausedAt={tournament.pausedAt}
                    totalPausedTime={tournament.totalPausedTime}
                    compact
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 sm:ml-2">
                {isOrganizer && (
                  <Link
                    to={`/tournaments/${tournament.id}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    title="Edit tournament"
                  >
                    <Pencil size={14} />
                  </Link>
                )}
                {isRoot && (
                  <IconButton
                    variant="error"
                    onClick={(e) => handleDeleteClick(e, tournament.id, tournament.name)}
                    title="Delete tournament"
                    className="!p-1.5"
                  >
                    <Trash2 size={14} />
                  </IconButton>
                )}
              </div>
            </div>
          </Link>
        );

        const renderTournaments = (tournamentList) => {
          if (viewMode === 'list') {
            return (
              <div className="flex flex-col gap-3">
                {tournamentList.map(renderTournamentListItem)}
              </div>
            );
          }
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournamentList.map(renderTournamentCard)}
            </div>
          );
        };

        return (
          <>
            {/* Active Tournaments */}
            {activeTournaments.length === 0 && completedTournaments.length === 0 ? (
              <p className="text-center py-16 text-gray-500 dark:text-gray-400 text-lg font-medium">
                No tournaments found
              </p>
            ) : activeTournaments.length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                No active tournaments
              </p>
            ) : (
              renderTournaments(activeTournaments)
            )}

            {/* Completed Tournaments - Collapsible */}
            {completedTournaments.length > 0 && (
              <div className="mt-8">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="w-full glass-card p-4 flex items-center justify-between hover:scale-[1.01] transition-transform"
                >
                  <h2 className="text-lg sm:text-xl font-bold text-gray-700 dark:text-gray-300 flex items-center gap-3">
                    <span className="text-brand-green">✓</span>
                    Completed Tournaments ({completedTournaments.length})
                  </h2>
                  <svg
                    className={`w-6 h-6 text-gray-400 transition-transform ${showCompleted ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCompleted && (
                  <div className="mt-4">
                    {renderTournaments(completedTournaments)}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText || 'Confirm'}
        type={confirmModal.type || 'primary'}
      />
    </div>
  );
};

export default TournamentList;
