import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { tournamentAPI, matchAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmationModal, TournamentTimer, StatusBadge, LoadingSpinner, Button } from '../../components/common';
import BracketView from '../../components/bracket/BracketView';
import GroupStageView from '../../components/bracket/GroupStageView';
import ManualGroupAssignment from '../../components/bracket/ManualGroupAssignment';
import TournamentLeaderboard from '../../components/tournament/TournamentLeaderboard';
import socketService from '../../services/socket';

const TournamentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isOrganizer, isRoot, loading: authLoading } = useAuth();
  const toast = useToast();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [showCompletedMatches, setShowCompletedMatches] = useState(false);

  useEffect(() => {
    console.log('=== TournamentDetails useEffect ===');
    console.log('authLoading:', authLoading);
    console.log('user:', user);
    console.log('isAuthenticated:', isAuthenticated);

    // Wait for auth to finish loading before fetching tournament
    if (!authLoading) {
      console.log('Auth loaded, fetching tournament...');
      fetchTournamentDetails();
      fetchMatches();
    } else {
      console.log('Still loading auth, waiting...');
    }

    // Connect socket and join tournament room
    socketService.connect();
    socketService.joinTournament(id);

    // Listen for match updates
    socketService.onMatchCreated((match) => {
      setMatches((prev) => [...prev, match]);
    });

    socketService.onMatchUpdated((match) => {
      setMatches((prev) => prev.map((m) => (m.id === match.id ? match : m)));
    });

    socketService.onMatchScoreUpdate((match) => {
      setMatches((prev) => prev.map((m) => (m.id === match.id ? match : m)));
    });

    // Listen for tournament updates (including reset)
    socketService.onTournamentReset(() => {
      console.log('Tournament reset event received, refetching...');
      fetchTournamentDetails();
      fetchMatches();
    });

    socketService.onTournamentUpdated(() => {
      console.log('Tournament updated event received, refetching...');
      fetchTournamentDetails();
    });

    socketService.onBracketGenerated(() => {
      console.log('Bracket generated event received, refetching...');
      fetchTournamentDetails();
      fetchMatches();
    });

    return () => {
      socketService.leaveTournament(id);
      socketService.off('tournament:reset');
      socketService.off('tournament:updated');
      socketService.off('tournament:bracketGenerated');
    };
  }, [id, authLoading]);

  const fetchTournamentDetails = async () => {
    try {
      console.log('=== Fetching tournament ===');
      console.log('Tournament ID:', id);
      console.log('Auth state - user:', user);
      console.log('Auth state - isAuthenticated:', isAuthenticated);

      const response = await tournamentAPI.getById(id);
      console.log('Tournament fetched successfully:', response.data.data);
      setTournament(response.data.data);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      console.error('Error response:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const response = await matchAPI.getByTournament(id);
      setMatches(response.data.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const handleRegister = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setRegistering(true);
    try {
      await tournamentAPI.register(id, {});
      toast.success('Registration successful! 🎾');
      fetchTournamentDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleDeregister = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setRegistering(true);
    try {
      await tournamentAPI.deregister(id);
      toast.success('Successfully deregistered from tournament');
      fetchTournamentDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Deregistration failed');
    } finally {
      setRegistering(false);
    }
  };

  const performStatusUpdate = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await tournamentAPI.update(id, { status: newStatus });
      setTournament({ ...tournament, status: newStatus });
      toast.success(`Tournament status updated to ${newStatus}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    // Show confirmation modal for starting tournament
    if (newStatus === 'ACTIVE' && (tournament.status === 'OPEN' || tournament.status === 'DRAFT')) {
      const approvedRegistrations = tournament.registrations?.filter(reg => reg.registrationStatus === 'APPROVED') || [];
      const registrationCount = approvedRegistrations.length;
      const confirmMessage = registrationCount > 0
        ? `${registrationCount} player${registrationCount !== 1 ? 's have' : ' has'} registered. Starting the tournament will close registration and begin match scheduling.`
        : 'No players have registered yet. Are you sure you want to start the tournament anyway?';

      setConfirmModal({
        isOpen: true,
        title: 'Start Tournament?',
        message: confirmMessage,
        confirmText: 'Start Tournament',
        type: 'primary',
        onConfirm: () => performStatusUpdate(newStatus),
      });
      return;
    }

    // For other status changes, update directly
    performStatusUpdate(newStatus);
  };

  const handleApproveRegistration = async (registrationId, userName, isReapproval = false) => {
    const title = isReapproval ? 'Re-approve Registration?' : 'Approve Registration?';
    const message = isReapproval
      ? `Are you sure you want to re-approve ${userName}'s registration for this tournament?`
      : `Are you sure you want to approve ${userName}'s registration for this tournament?`;
    const confirmText = isReapproval ? 'Re-approve' : 'Approve';
    const successMessage = isReapproval
      ? `${userName}'s registration re-approved successfully!`
      : `${userName}'s registration approved successfully!`;

    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      type: 'success',
      onConfirm: async () => {
        try {
          await tournamentAPI.approveRegistration(id, registrationId);
          toast.success(successMessage);
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to approve registration');
        }
      },
    });
  };

  const handleRejectRegistration = async (registrationId, userName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reject Registration?',
      message: `Are you sure you want to reject ${userName}'s registration for this tournament? This action cannot be undone.`,
      confirmText: 'Reject',
      type: 'danger',
      onConfirm: async () => {
        try {
          await tournamentAPI.rejectRegistration(id, registrationId);
          toast.success(`${userName}'s registration rejected`);
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to reject registration');
        }
      },
    });
  };

  const handleUnregisterParticipant = async (registrationId, userName, userId) => {
    const isSelf = userId === user?.id;
    const message = isSelf
      ? 'Are you sure you want to unregister from this tournament?'
      : `Are you sure you want to unregister ${userName} from this tournament?`;
    const successMessage = isSelf
      ? 'You have been unregistered from the tournament'
      : `${userName} has been unregistered from the tournament`;

    setConfirmModal({
      isOpen: true,
      title: 'Unregister Participant?',
      message,
      confirmText: 'Unregister',
      type: 'danger',
      onConfirm: async () => {
        try {
          await tournamentAPI.unregisterParticipant(id, registrationId);
          toast.success(successMessage);
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to unregister participant');
        }
      },
    });
  };

  const handleApproveAllPending = async () => {
    const pendingCount = tournament.registrations?.filter(reg => reg.registrationStatus === 'PENDING').length || 0;
    if (pendingCount === 0) {
      toast.info('No pending registrations to approve');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Approve All Pending Registrations?',
      message: `Are you sure you want to approve all ${pendingCount} pending registration${pendingCount !== 1 ? 's' : ''}?`,
      confirmText: 'Approve All',
      type: 'success',
      onConfirm: async () => {
        try {
          const response = await tournamentAPI.approveAllPendingRegistrations(id);
          toast.success(response.data.message);
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to approve registrations');
        }
      },
    });
  };

  const handleTogglePause = async () => {
    setUpdatingStatus(true);
    try {
      const response = await tournamentAPI.togglePause(id);
      setTournament(response.data.data);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to toggle pause state');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleToggleRegistration = async () => {
    setUpdatingStatus(true);
    try {
      const response = await tournamentAPI.toggleRegistration(id);
      setTournament(response.data.data);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to toggle registration');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteTournament = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Tournament',
      message: `Are you sure you want to permanently delete "${tournament.name}"? This action cannot be undone and will delete all associated matches, registrations, and teams.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await tournamentAPI.delete(id);
          toast.success('Tournament deleted successfully');
          navigate('/tournaments');
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to delete tournament');
        }
      },
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isRegistered = tournament?.registrations?.some(
    (reg) => reg.userId === user?.id
  );

  const isCreator = tournament?.createdById === user?.id;
  const canManageStatus = isCreator || isOrganizer;

  if (authLoading || loading) {
    return <LoadingSpinner fullScreen message="Loading tournament..." />;
  }

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl text-red-600 dark:text-red-400">Tournament not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold mb-3 text-gray-900 dark:text-white">
              {tournament.name}
            </h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <StatusBadge status={tournament.status} />
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                {tournament.tournamentType}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                {tournament.format.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Tournament Timer - countdown for upcoming, elapsed for active */}
            <TournamentTimer
              startedAt={tournament.startedAt}
              startDate={tournament.startDate}
              status={tournament.status}
              isPaused={tournament.isPaused}
              pausedAt={tournament.pausedAt}
              totalPausedTime={tournament.totalPausedTime}
            />
          </div>
          <div className="flex flex-col gap-3">
            {canManageStatus && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
              <button
                onClick={() => handleStatusChange('ACTIVE')}
                disabled={updatingStatus}
                className="px-6 py-3 bg-gradient-to-r from-brand-green to-green-600 hover:from-brand-green hover:to-green-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {updatingStatus ? (
                  '🔄 Starting...'
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🚀 Start Tournament</span>
                    {tournament.registrations && tournament.registrations.filter(reg => reg.registrationStatus === 'APPROVED').length > 0 && (
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">
                        {tournament.registrations.filter(reg => reg.registrationStatus === 'APPROVED').length} player{tournament.registrations.filter(reg => reg.registrationStatus === 'APPROVED').length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                )}
              </button>
            )}
            {canManageStatus && tournament.status === 'ACTIVE' && (
              <button
                onClick={handleTogglePause}
                disabled={updatingStatus}
                className={`px-6 py-3 ${
                  tournament.isPaused
                    ? 'bg-gradient-to-r from-brand-green to-green-600 hover:from-brand-green hover:to-green-700'
                    : 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700'
                } text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {updatingStatus ? (
                  '🔄 Processing...'
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {tournament.isPaused ? (
                      <>
                        <span>▶️</span>
                        <span>Resume Tournament</span>
                      </>
                    ) : (
                      <>
                        <span>⏸️</span>
                        <span>Pause Tournament</span>
                      </>
                    )}
                  </span>
                )}
              </button>
            )}
            {canManageStatus && (
              <div className="flex flex-col gap-2">
                <label htmlFor="status" className="text-sm font-medium text-primary">
                  Change Status:
                </label>
                <select
                  id="status"
                  value={tournament.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className="glass-surface px-4 py-2.5 text-primary font-medium focus:ring-2 focus:ring-brand-blue/25 focus:border-white/40 disabled:opacity-50"
                >
                  <option value="DRAFT">Draft (Private)</option>
                  <option value="OPEN">Open for Registration</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            )}
            {canManageStatus && (
              <Link to={`/tournaments/${id}/edit`}>
                <Button variant="outline" size="md" className="w-full">
                  <Pencil size={16} />
                  Edit Tournament
                </Button>
              </Link>
            )}
            {isRoot && (
              <button
                onClick={handleDeleteTournament}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="flex items-center justify-center gap-2">
                  <span>🗑️</span>
                  <span>Delete Tournament</span>
                </span>
              </button>
            )}
            {/* Toggle Registration Button for Admins */}
            {canManageStatus && tournament.status === 'OPEN' && (
              <button
                onClick={handleToggleRegistration}
                disabled={updatingStatus}
                className={`px-6 py-3 ${
                  tournament.registrationClosed
                    ? 'bg-gradient-to-r from-brand-green to-green-600 hover:from-brand-green hover:to-green-700'
                    : 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700'
                } text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {updatingStatus ? (
                  '🔄 Processing...'
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {tournament.registrationClosed ? (
                      <>
                        <span>🔓</span>
                        <span>Open Registration</span>
                      </>
                    ) : (
                      <>
                        <span>🔒</span>
                        <span>Close Registration</span>
                      </>
                    )}
                  </span>
                )}
              </button>
            )}
            {tournament.status === 'OPEN' && !isRegistered && (
              tournament.registrationClosed ? (
                <div className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-semibold rounded-lg text-center">
                  🔒 Registration Closed
                </div>
              ) : (
                <button
                  onClick={handleRegister}
                  className="px-6 py-2 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
                  disabled={registering}
                >
                  {registering ? 'Registering...' : 'Register Now'}
                </button>
              )
            )}
            {isRegistered && (
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 bg-brand-green/10 dark:bg-brand-green/20 text-brand-green dark:text-green-400 rounded-lg font-semibold border border-brand-green/30">
                  ✓ Registered
                </span>
                {(tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
                  <button
                    onClick={handleDeregister}
                    className="px-4 py-2 bg-error/10 dark:bg-error/20 hover:bg-error/20 dark:hover:bg-error/30 text-error dark:text-red-400 font-semibold rounded-lg border border-error/30 transition-colors"
                    disabled={registering}
                  >
                    {registering ? 'Processing...' : 'Deregister'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white">Details</h3>
          <div className="space-y-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Location:</span>
              <span className="text-gray-900 dark:text-white">{tournament.location}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Start Date:</span>
              <span className="text-gray-900 dark:text-white">{formatDate(tournament.startDate)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">End Date:</span>
              <span className="text-gray-900 dark:text-white">{formatDate(tournament.endDate)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Participants:</span>
              <span className="text-gray-900 dark:text-white">
                {tournament.registrations?.filter(reg => reg.registrationStatus === 'APPROVED').length ?? 0} / {tournament.maxParticipants}
              </span>
            </div>
            {tournament.description && (
              <div className="flex flex-col pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Description:</span>
                <p className="text-gray-900 dark:text-white">{tournament.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white">Organizer</h3>
          <div className="space-y-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Name:</span>
              <span className="text-gray-900 dark:text-white">
                {tournament.createdBy.fullName || tournament.createdBy.username}
              </span>
            </div>
            {canManageStatus && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Email:</span>
                <span className="text-gray-900 dark:text-white">{tournament.createdBy.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {tournament.registrations && tournament.registrations.length > 0 && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
            onClick={() => setParticipantsExpanded(!participantsExpanded)}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Registered Participants ({tournament.registrations.length})
              </h2>
              {participantsExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
            {canManageStatus && tournament.registrations.filter(reg => reg.registrationStatus === 'PENDING').length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); handleApproveAllPending(); }}
                className="px-4 py-2 bg-success/10 text-success hover:bg-success hover:text-white border border-success/20 hover:border-success rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
              >
                <span>✓</span>
                Approve All Pending ({tournament.registrations.filter(reg => reg.registrationStatus === 'PENDING').length})
              </button>
            )}
          </div>
          {participantsExpanded && (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 mt-3 sm:mt-4">
            {tournament.registrations.map((reg) => (
              <div
                key={reg.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-surface"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {reg.user.fullName || reg.user.username}
                  </div>
                  <StatusBadge status={reg.registrationStatus} />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {canManageStatus && (
                    <>
                      {/* For PENDING: Show Approve and Reject */}
                      {reg.registrationStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApproveRegistration(reg.id, reg.user.fullName || reg.user.username)}
                            className="px-4 py-2 bg-success/10 text-success hover:bg-success hover:text-white border border-success/20 hover:border-success rounded-lg font-semibold text-sm transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectRegistration(reg.id, reg.user.fullName || reg.user.username)}
                            className="px-4 py-2 bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 hover:border-error rounded-lg font-semibold text-sm transition-all"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* For APPROVED: Show Reject and Unregister */}
                      {reg.registrationStatus === 'APPROVED' && (
                        <>
                          <button
                            onClick={() => handleRejectRegistration(reg.id, reg.user.fullName || reg.user.username)}
                            className="px-4 py-2 bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 hover:border-error rounded-lg font-semibold text-sm transition-all"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleUnregisterParticipant(reg.id, reg.user.fullName || reg.user.username, reg.userId)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
                          >
                            Unregister
                          </button>
                        </>
                      )}

                      {/* For REJECTED: Show Re-approve and Unregister */}
                      {reg.registrationStatus === 'REJECTED' && (
                        <>
                          <button
                            onClick={() => handleApproveRegistration(reg.id, reg.user.fullName || reg.user.username, true)}
                            className="px-4 py-2 bg-success/10 text-success hover:bg-success hover:text-white border border-success/20 hover:border-success rounded-lg font-semibold text-sm transition-all"
                          >
                            Re-approve
                          </button>
                          <button
                            onClick={() => handleUnregisterParticipant(reg.id, reg.user.fullName || reg.user.username, reg.userId)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
                          >
                            Unregister
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* User's own registration: Show Unregister only if APPROVED or PENDING */}
                  {!canManageStatus && reg.userId === user?.id && (reg.registrationStatus === 'APPROVED' || reg.registrationStatus === 'PENDING') && (
                    <button
                      onClick={() => handleUnregisterParticipant(reg.id, reg.user.fullName || reg.user.username, reg.userId)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
                    >
                      Unregister
                    </button>
                  )}
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      )}

      {/* Winners Podium - Show when final match is completed */}
      {(() => {
        // Find the final match
        const finalMatch = matches.find((m) => m.round === 'Final' || m.round === 'Finals');
        if (!finalMatch || finalMatch.matchStatus !== 'COMPLETED' || !finalMatch.winnerId) {
          return null;
        }

        // Get winner and runner-up from final
        const getPlayerName = (team) => {
          if (!team) return 'TBD';
          const name = team.player1?.fullName || team.player1?.username || 'Unknown';
          if (team.player2 && team.player2.id !== team.player1?.id) {
            return `${name} & ${team.player2.fullName || team.player2.username}`;
          }
          return name;
        };

        const winner = finalMatch.winnerId === finalMatch.team1Id ? finalMatch.team1 : finalMatch.team2;
        const runnerUp = finalMatch.winnerId === finalMatch.team1Id ? finalMatch.team2 : finalMatch.team1;

        // Check for 3rd place match first
        const thirdPlaceMatch = matches.find((m) => m.round === '3rd Place');
        let thirdPlaceWinner = null;
        let thirdPlaceStatus = 'pending'; // 'completed', 'upcoming', 'pending'

        if (thirdPlaceMatch) {
          if (thirdPlaceMatch.matchStatus === 'COMPLETED' && thirdPlaceMatch.winnerId) {
            thirdPlaceWinner = thirdPlaceMatch.winnerId === thirdPlaceMatch.team1Id
              ? thirdPlaceMatch.team1
              : thirdPlaceMatch.team2;
            thirdPlaceStatus = 'completed';
          } else {
            thirdPlaceStatus = 'upcoming';
          }
        }

        return (
          <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-900 dark:text-white text-center">
              Tournament Winners
            </h2>

            {/* Podium Display */}
            <div className="flex items-end justify-center gap-2 sm:gap-4 mb-6">
              {/* 2nd Place */}
              <div className="flex flex-col items-center">
                <div className="w-16 sm:w-24 h-20 sm:h-28 bg-gradient-to-t from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-500 rounded-t-lg flex items-end justify-center pb-2">
                  <span className="text-2xl sm:text-4xl font-bold text-gray-600 dark:text-gray-300">2</span>
                </div>
                <div className="bg-gray-200 dark:bg-gray-600 w-20 sm:w-28 py-2 sm:py-3 text-center rounded-b-lg">
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 truncate px-1">
                    {getPlayerName(runnerUp)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Runner-up</p>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center -mt-4">
                <div className="text-3xl sm:text-4xl mb-1">👑</div>
                <div className="w-20 sm:w-28 h-28 sm:h-36 bg-gradient-to-t from-yellow-500 to-yellow-400 dark:from-yellow-600 dark:to-yellow-500 rounded-t-lg flex items-end justify-center pb-2">
                  <span className="text-3xl sm:text-5xl font-bold text-yellow-800 dark:text-yellow-200">1</span>
                </div>
                <div className="bg-yellow-400 dark:bg-yellow-600 w-24 sm:w-32 py-2 sm:py-3 text-center rounded-b-lg">
                  <p className="text-xs sm:text-sm font-bold text-yellow-900 dark:text-yellow-100 truncate px-1">
                    {getPlayerName(winner)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300">Champion</p>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center">
                <div className="w-16 sm:w-24 h-16 sm:h-24 bg-gradient-to-t from-orange-400 to-orange-300 dark:from-orange-700 dark:to-orange-600 rounded-t-lg flex items-end justify-center pb-2">
                  <span className="text-2xl sm:text-4xl font-bold text-orange-800 dark:text-orange-200">3</span>
                </div>
                <div className="bg-orange-300 dark:bg-orange-700 w-20 sm:w-28 py-2 sm:py-3 text-center rounded-b-lg">
                  {thirdPlaceStatus === 'completed' && thirdPlaceWinner ? (
                    <p className="text-xs sm:text-sm font-semibold text-orange-900 dark:text-orange-100 truncate px-1">
                      {getPlayerName(thirdPlaceWinner)}
                    </p>
                  ) : thirdPlaceStatus === 'upcoming' ? (
                    <p className="text-xs sm:text-sm font-semibold text-orange-900 dark:text-orange-100 px-1">
                      TBD
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm font-semibold text-orange-900 dark:text-orange-100">-</p>
                  )}
                  <p className="text-[10px] sm:text-xs text-orange-700 dark:text-orange-400">3rd Place</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manual Group Assignment for GROUP_KNOCKOUT tournaments before bracket generation */}
      {tournament.format === 'GROUP_KNOCKOUT' &&
       (tournament.status === 'OPEN' || tournament.status === 'DRAFT') &&
       !tournament.bracketGenerated &&
       canManageStatus &&
       tournament.registrations?.filter(reg => reg.registrationStatus === 'APPROVED').length > 0 && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <ManualGroupAssignment
            tournament={tournament}
            onAssignmentChange={fetchTournamentDetails}
          />
        </div>
      )}

      {/* Tournament Bracket - Disabled, using Matches list instead */}
      {false && tournament.status === 'ACTIVE' && tournament.bracketGenerated && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Tournament Bracket
          </h2>
          <BracketView
            tournament={tournament}
            onMatchClick={(match) => navigate(`/matches/${match.id}`)}
            showSeeds={true}
          />
        </div>
      )}

      {/* Group Stage View for GROUP_KNOCKOUT tournaments */}
      {tournament.format === 'GROUP_KNOCKOUT' && tournament.status === 'ACTIVE' && tournament.bracketGenerated && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <GroupStageView
            tournament={tournament}
            matches={matches}
            isOrganizer={canManageStatus}
            onGroupStageComplete={() => {
              fetchTournamentDetails();
              fetchMatches();
            }}
          />
        </div>
      )}

      {/* Tournament Leaderboard */}
      {(tournament.status === 'ACTIVE' || tournament.status === 'COMPLETED') && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Tournament Leaderboard
          </h2>
          <TournamentLeaderboard tournamentId={id} />
        </div>
      )}

      {matches.length > 0 && (() => {
        // Split matches into active/upcoming and completed
        const activeMatches = matches.filter((m) => m.matchStatus !== 'COMPLETED');
        const completedMatches = matches.filter((m) => m.matchStatus === 'COMPLETED');

        // Helper to parse scores
        const parseScore = (score) => {
          if (!score) return [];
          if (typeof score === 'string') return score.split(',').map(Number);
          if (score.games) return score.games;
          return [];
        };

        // Render a match card
        const renderMatchCard = (match) => {
          const isExpanded = expandedMatchId === match.id;
          const team1Name = match.team1.player1.fullName || match.team1.player1.username;
          const team2Name = match.team2.player1.fullName || match.team2.player1.username;
          const winnerName = match.winnerId === match.team1Id ? team1Name : team2Name;
          const team1Games = parseScore(match.team1Score);
          const team2Games = parseScore(match.team2Score);

          return (
            <div key={match.id} className="glass-surface overflow-hidden">
              <div
                onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 rounded-full text-sm font-semibold">
                      {match.round}
                    </span>
                    <StatusBadge status={match.matchStatus} />
                  </div>
                  <div className="flex items-center gap-2">
                    {match.scheduledTime && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(match.scheduledTime)}
                      </div>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 sm:gap-4 text-sm sm:text-base">
                  <div className={`flex-1 text-right font-medium ${match.matchStatus === 'COMPLETED' && match.winnerId === match.team1Id ? 'text-brand-green' : 'text-gray-900 dark:text-white'}`}>
                    <span className="block sm:inline">{team1Name}</span>
                    {match.team1.player2 && match.team1.player2.id !== match.team1.player1.id && (
                      <span className="block sm:inline"> & {match.team1.player2.fullName || match.team1.player2.username}</span>
                    )}
                  </div>
                  <div className="px-2 sm:px-4 py-1 bg-gray-200 dark:bg-slate-600 rounded font-bold text-xs sm:text-sm text-gray-900 dark:text-white">VS</div>
                  <div className={`flex-1 text-left font-medium ${match.matchStatus === 'COMPLETED' && match.winnerId === match.team2Id ? 'text-brand-green' : 'text-gray-900 dark:text-white'}`}>
                    <span className="block sm:inline">{team2Name}</span>
                    {match.team2.player2 && match.team2.player2.id !== match.team2.player1.id && (
                      <span className="block sm:inline"> & {match.team2.player2.fullName || match.team2.player2.username}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Match Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Winner Section */}
                    {match.matchStatus === 'COMPLETED' && match.winnerId && (
                      <div className="text-center sm:col-span-3 pb-3 border-b border-gray-200 dark:border-slate-600">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Winner</span>
                        <p className="text-lg font-bold text-brand-green mt-1">{winnerName}</p>
                      </div>
                    )}

                    {/* Game Scores */}
                    {match.matchStatus === 'COMPLETED' && (team1Games.length > 0 || team2Games.length > 0) ? (
                      <div className="sm:col-span-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Game Scores</span>
                        <div className="mt-2 flex justify-center gap-4">
                          {team1Games.map((score, idx) => (
                            <div key={idx} className="text-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Game {idx + 1}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`font-mono font-bold ${score > (team2Games[idx] || 0) ? 'text-brand-green' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {score}
                                </span>
                                <span className="text-gray-400">-</span>
                                <span className={`font-mono font-bold ${(team2Games[idx] || 0) > score ? 'text-brand-green' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {team2Games[idx] || 0}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : match.matchStatus === 'COMPLETED' && (
                      <div className="sm:col-span-3 text-center text-gray-500 dark:text-gray-400 text-sm">
                        No detailed scores recorded
                      </div>
                    )}

                    {/* Match Info */}
                    <div className="text-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{team1Name}</span>
                      <p className="font-mono font-bold text-lg text-gray-900 dark:text-white mt-1">
                        {team1Games.reduce((a, b) => a + b, 0) || 0}
                      </p>
                      <span className="text-xs text-gray-400">points</span>
                    </div>

                    <div className="text-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</span>
                      <p className="font-medium text-gray-900 dark:text-white mt-1">{match.matchStatus}</p>
                    </div>

                    <div className="text-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{team2Name}</span>
                      <p className="font-mono font-bold text-lg text-gray-900 dark:text-white mt-1">
                        {team2Games.reduce((a, b) => a + b, 0) || 0}
                      </p>
                      <span className="text-xs text-gray-400">points</span>
                    </div>
                  </div>

                  {/* View Full Details Link */}
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-600 text-center">
                    <Link
                      to={`/matches/${match.id}`}
                      className="text-brand-green hover:text-green-600 text-sm font-medium"
                    >
                      View Full Match Details →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Active/Upcoming Matches */}
            {activeMatches.length > 0 && (
              <div className="glass-card p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white">
                  Matches ({activeMatches.length})
                </h2>
                <div className="space-y-4">
                  {activeMatches.map(renderMatchCard)}
                </div>
              </div>
            )}

            {/* Completed Matches - Collapsible */}
            {completedMatches.length > 0 && (
              <div className="glass-card overflow-hidden">
                <button
                  onClick={() => setShowCompletedMatches(!showCompletedMatches)}
                  className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <span className="text-brand-green">✓</span>
                    Completed Matches ({completedMatches.length})
                  </h2>
                  <svg
                    className={`w-6 h-6 text-gray-400 transition-transform ${showCompletedMatches ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCompletedMatches && (
                  <div className="px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-200 dark:border-slate-600">
                    <div className="space-y-4 mt-4">
                      {completedMatches.map(renderMatchCard)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* If no active matches but completed exist, show a message */}
            {activeMatches.length === 0 && completedMatches.length > 0 && !showCompletedMatches && (
              <div className="glass-card p-4 sm:p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  All matches have been completed. Click "Completed Matches" above to view results.
                </p>
              </div>
            )}
          </div>
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
        cancelText={confirmModal.cancelText}
        type={confirmModal.type || 'primary'}
      />
    </div>
  );
};

export default TournamentDetails;
