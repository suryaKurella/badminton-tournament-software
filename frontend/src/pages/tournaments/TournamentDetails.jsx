import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { tournamentAPI, matchAPI, userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmationModal, TournamentTimer, StatusBadge, LoadingSpinner, Button, PartnerSelect } from '../../components/common';
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
  const [processingCompletion, setProcessingCompletion] = useState(false);
  const [selectedAdvancePlayers, setSelectedAdvancePlayers] = useState(4);
  const [roundRobinWinners, setRoundRobinWinners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const [addTeamModal, setAddTeamModal] = useState({ isOpen: false, player1Id: '', player2Id: '', loading: false });
  const [addPlayerModal, setAddPlayerModal] = useState({ isOpen: false, playerId: '', loading: false });
  const [allUsers, setAllUsers] = useState([]);

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

  // Fetch leaderboard for completed Round Robin tournaments
  useEffect(() => {
    if (tournament?.format === 'ROUND_ROBIN' && tournament?.status === 'COMPLETED') {
      fetchRoundRobinWinners();
    }
  }, [tournament?.format, tournament?.status, id]);

  // Auto-select a valid playoff size based on team count
  useEffect(() => {
    const teamCount = tournament?.teams?.length || 0;
    if (teamCount < selectedAdvancePlayers) {
      // Select the highest valid option
      if (teamCount >= 4) setSelectedAdvancePlayers(4);
      else if (teamCount >= 2) setSelectedAdvancePlayers(2);
    }
  }, [tournament?.teams?.length]);

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

  // Fetch leaderboard for Round Robin winners podium
  const fetchRoundRobinWinners = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/statistics/tournament/${id}/leaderboard`
      );
      const data = await response.json();
      if (data.success && data.data) {
        setRoundRobinWinners(data.data.slice(0, 3)); // Top 3
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const handleRegister = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setRegistering(true);
    try {
      const registrationData = {};
      if (selectedPartnerId) {
        registrationData.partnerId = selectedPartnerId;
      }
      await tournamentAPI.register(id, registrationData);
      toast.success('Registration successful! 🎾');
      setSelectedPartnerId(null); // Reset partner selection
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

  const handleApproveTeam = async (reg1Id, reg2Id, player1Name, player2Name) => {
    const teamName = `${player1Name} & ${player2Name}`;
    setConfirmModal({
      isOpen: true,
      title: 'Approve Team?',
      message: `Are you sure you want to approve the team "${teamName}" for this tournament?`,
      confirmText: 'Approve Team',
      type: 'success',
      onConfirm: async () => {
        try {
          // Approve both registrations
          await Promise.all([
            tournamentAPI.approveRegistration(id, reg1Id),
            tournamentAPI.approveRegistration(id, reg2Id),
          ]);
          toast.success(`Team "${teamName}" approved successfully!`);
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to approve team');
        }
      },
    });
  };

  const handleRejectTeam = async (reg1Id, reg2Id, player1Name, player2Name) => {
    const teamName = `${player1Name} & ${player2Name}`;
    setConfirmModal({
      isOpen: true,
      title: 'Reject Team?',
      message: `Are you sure you want to reject the team "${teamName}" from this tournament?`,
      confirmText: 'Reject Team',
      type: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all([
            tournamentAPI.rejectRegistration(id, reg1Id),
            tournamentAPI.rejectRegistration(id, reg2Id),
          ]);
          toast.success(`Team "${teamName}" rejected`);
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to reject team');
        }
      },
    });
  };

  const handleUnregisterTeam = async (reg1Id, reg2Id, player1Name, player2Name) => {
    const teamName = `${player1Name} & ${player2Name}`;
    setConfirmModal({
      isOpen: true,
      title: 'Unregister Team?',
      message: `Are you sure you want to unregister the team "${teamName}" from this tournament?`,
      confirmText: 'Unregister Team',
      type: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all([
            tournamentAPI.unregisterParticipant(id, reg1Id),
            tournamentAPI.unregisterParticipant(id, reg2Id),
          ]);
          toast.success(`Team "${teamName}" has been unregistered`);
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to unregister team');
        }
      },
    });
  };

  const handleApproveTeamWithPendingPartner = async (regId, playerName, partnerName) => {
    const teamName = `${playerName} & ${partnerName}`;
    setConfirmModal({
      isOpen: true,
      title: 'Approve Team?',
      message: `This will register ${partnerName} and approve the team "${teamName}". Continue?`,
      confirmText: 'Approve Team',
      type: 'success',
      onConfirm: async () => {
        try {
          const response = await tournamentAPI.approveTeamWithPendingPartner(id, regId);
          toast.success(response.data.message || `Team "${teamName}" approved successfully!`);
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to approve team');
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

  const handleApproveAll = async () => {
    const unapprovedCount = tournament.registrations?.filter(
      reg => reg.registrationStatus === 'PENDING' || reg.registrationStatus === 'REJECTED'
    ).length || 0;
    if (unapprovedCount === 0) {
      toast.info('No registrations to approve');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Approve All Registrations?',
      message: `Are you sure you want to approve all ${unapprovedCount} registration${unapprovedCount !== 1 ? 's' : ''}?`,
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

  // Round Robin completion handlers - simple direct API calls like GroupStageView
  const handleCreateKnockout = async () => {
    setProcessingCompletion(true);
    try {
      const response = await tournamentAPI.roundRobinToKnockout(id, selectedAdvancePlayers);
      toast.success(response.data.message || 'Knockout bracket created successfully!');
      fetchTournamentDetails();
      fetchMatches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create knockout bracket');
    } finally {
      setProcessingCompletion(false);
    }
  };

  const handleDeclareWinners = async () => {
    setProcessingCompletion(true);
    try {
      const response = await tournamentAPI.declareWinners(id);
      toast.success(response.data.message || 'Winners declared! Tournament completed.');
      fetchTournamentDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to declare winners');
    } finally {
      setProcessingCompletion(false);
    }
  };

  const handleAssignPartner = async (registrationId, partnerRegistrationId) => {
    try {
      const response = await tournamentAPI.assignPartner(id, registrationId, partnerRegistrationId);
      toast.success(response.data.message);
      fetchTournamentDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign partner');
    }
  };

  const openAddTeamModal = async () => {
    try {
      const response = await userAPI.getAll({ limit: 500 });
      setAllUsers(response.data.data || []);
      setAddTeamModal({ isOpen: true, player1Id: '', player2Id: '', loading: false });
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  const handleRegisterTeam = async () => {
    if (!addTeamModal.player1Id || !addTeamModal.player2Id) {
      toast.error('Please select both players');
      return;
    }
    if (addTeamModal.player1Id === addTeamModal.player2Id) {
      toast.error('Please select two different players');
      return;
    }

    setAddTeamModal(prev => ({ ...prev, loading: true }));
    try {
      const response = await tournamentAPI.registerTeam(id, addTeamModal.player1Id, addTeamModal.player2Id);
      toast.success(response.data.message);
      setAddTeamModal({ isOpen: false, player1Id: '', player2Id: '', loading: false });
      fetchTournamentDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to register team');
      setAddTeamModal(prev => ({ ...prev, loading: false }));
    }
  };

  const openAddPlayerModal = async () => {
    try {
      const response = await userAPI.getAll({ limit: 500 });
      setAllUsers(response.data.data || []);
      setAddPlayerModal({ isOpen: true, playerId: '', loading: false });
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  const handleRegisterPlayer = async () => {
    if (!addPlayerModal.playerId) {
      toast.error('Please select a player');
      return;
    }

    setAddPlayerModal(prev => ({ ...prev, loading: true }));
    try {
      const response = await tournamentAPI.registerPlayer(id, addPlayerModal.playerId);
      toast.success(response.data.message);
      setAddPlayerModal({ isOpen: false, playerId: '', loading: false });
      fetchTournamentDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to register player');
      setAddPlayerModal(prev => ({ ...prev, loading: false }));
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

  // Check if someone has already selected the current user as their partner (for doubles)
  // Case 1: Current user is registered and someone selected them via partnerId
  const pendingPartnerInvite = tournament?.registrations?.find(
    (reg) => reg.partnerId === user?.id && reg.userId !== user?.id
  );
  // Case 2: Current user is NOT registered but someone selected them via partnerUser
  const pendingPartnerUserInvite = tournament?.registrations?.find(
    (reg) => reg.partnerUser?.id === user?.id && reg.userId !== user?.id
  );
  const activeInvite = pendingPartnerInvite || pendingPartnerUserInvite;
  const invitingPlayerName = activeInvite?.user?.fullName || activeInvite?.user?.username;

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
                <div className="flex flex-col gap-3">
                  {/* Show partner invite if someone has already selected this user */}
                  {activeInvite && (tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                        <span className="font-semibold">{invitingPlayerName}</span> has already registered and selected you as their partner.
                      </p>
                      <button
                        onClick={async () => {
                          setRegistering(true);
                          try {
                            await tournamentAPI.register(id, { partnerId: activeInvite.userId });
                            toast.success('Registration successful! You are now partnered with ' + invitingPlayerName);
                            fetchTournamentDetails();
                          } catch (error) {
                            toast.error(error.response?.data?.message || 'Registration failed');
                          } finally {
                            setRegistering(false);
                          }
                        }}
                        className="w-full px-4 py-2 bg-brand-green hover:bg-green-600 text-white font-semibold rounded-lg shadow-sm transition-colors"
                        disabled={registering}
                      >
                        {registering ? 'Registering...' : `Register with ${invitingPlayerName}`}
                      </button>
                    </div>
                  )}

                  {/* Partner selection for DOUBLES/MIXED tournaments */}
                  {(tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && (
                    <PartnerSelect
                      tournamentId={id}
                      value={selectedPartnerId}
                      onChange={setSelectedPartnerId}
                      disabled={registering}
                    />
                  )}
                  <button
                    onClick={handleRegister}
                    className="px-6 py-2 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
                    disabled={registering}
                  >
                    {registering ? 'Registering...' : 'Register Now'}
                  </button>
                </div>
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

      {tournament.registrations && (tournament.registrations.length > 0 || canManageStatus) && (
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
            <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {canManageStatus && tournament.tournamentType === 'SINGLES' && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
                <button
                  onClick={openAddPlayerModal}
                  className="px-4 py-2 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white border border-brand-blue/20 hover:border-brand-blue rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <span>+</span>
                  Add Player
                </button>
              )}
              {canManageStatus && (tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
                <button
                  onClick={openAddTeamModal}
                  className="px-4 py-2 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white border border-brand-blue/20 hover:border-brand-blue rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <span>+</span>
                  Add Team
                </button>
              )}
              {canManageStatus && tournament.registrations.filter(reg => reg.registrationStatus === 'PENDING' || reg.registrationStatus === 'REJECTED').length > 0 && (
                <button
                  onClick={handleApproveAll}
                  className="px-4 py-2 bg-success/10 text-success hover:bg-success hover:text-white border border-success/20 hover:border-success rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <span>✓</span>
                  Approve All ({tournament.registrations.filter(reg => reg.registrationStatus === 'PENDING' || reg.registrationStatus === 'REJECTED').length})
                </button>
              )}
            </div>
          </div>
          {participantsExpanded && (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 mt-3 sm:mt-4">
            {tournament.registrations.map((reg) => {
              // For doubles/mixed, find partner's registration
              const isDoublesFormat = tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED';
              let partnerReg = null;
              let partnerName = null;
              let pendingPartnerName = null;
              if (isDoublesFormat && reg.partnerId) {
                partnerReg = tournament.registrations.find(r => r.userId === reg.partnerId);
                if (partnerReg) {
                  partnerName = partnerReg.user?.fullName || partnerReg.user?.username;
                } else if (reg.partnerUser) {
                  // Partner selected but hasn't registered yet
                  pendingPartnerName = reg.partnerUser.fullName || reg.partnerUser.username;
                }
              }
              // Check if this player was selected as someone else's partner
              const selectedByOther = isDoublesFormat ? tournament.registrations.find(
                r => r.partnerId === reg.userId
              ) : null;
              const selectedByName = selectedByOther?.user?.fullName || selectedByOther?.user?.username;

              // Skip if this player was selected by someone else - they'll show in that person's pair
              // For mutual pairs (both selected each other), only show one - the one who registered first
              if (selectedByOther) {
                // If this player doesn't have a partnerId, skip (they'll appear in the selector's row)
                if (!reg.partnerId) {
                  return null;
                }
                // If mutual pair, only show the one with earlier registration (lower index)
                const myIndex = tournament.registrations.findIndex(r => r.id === reg.id);
                const theirIndex = tournament.registrations.findIndex(r => r.id === selectedByOther.id);
                if (myIndex > theirIndex) {
                  return null; // Skip - the other person's row will show this pair
                }
              }

              return (
              <div
                key={reg.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 glass-surface"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Player name and partner info */}
                  <div className="flex-1 min-w-0">
                    {isDoublesFormat && partnerName ? (
                      /* Doubles pair display with divider - both registered */
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                          <span className="font-medium text-gray-900 dark:text-white px-3 py-1.5 bg-gray-50 dark:bg-slate-700">
                            {reg.user.fullName || reg.user.username}
                          </span>
                          <span className="border-l border-gray-300 dark:border-gray-600 h-full"></span>
                          <span className="font-medium text-gray-900 dark:text-white px-3 py-1.5 bg-gray-50 dark:bg-slate-700">
                            {partnerName}
                          </span>
                        </div>
                        {canManageStatus && <StatusBadge status={reg.registrationStatus} />}
                        {/* Admin can change partner */}
                        {canManageStatus && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
                          <select
                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignPartner(reg.id, e.target.value === 'clear' ? null : e.target.value);
                                e.target.value = '';
                              }
                            }}
                          >
                            <option value="">Change...</option>
                            <option value="clear">Remove partner</option>
                            {tournament.registrations
                              .filter(r =>
                                r.id !== reg.id && // Not self
                                r.id !== partnerReg?.id && // Not current partner
                                !r.partnerId && // Doesn't have a partner
                                !tournament.registrations.some(other => other.partnerId === r.userId) // Not selected by anyone
                              )
                              .map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.user.fullName || r.user.username}
                                </option>
                              ))
                            }
                          </select>
                        )}
                      </div>
                    ) : isDoublesFormat && pendingPartnerName ? (
                      /* Doubles pair display - partner selected but not yet registered */
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center border border-amber-300 dark:border-amber-600 rounded-lg overflow-hidden">
                          <span className="font-medium text-gray-900 dark:text-white px-3 py-1.5 bg-gray-50 dark:bg-slate-700">
                            {reg.user.fullName || reg.user.username}
                          </span>
                          <span className="border-l border-amber-300 dark:border-amber-600 h-full"></span>
                          <span className="font-medium text-amber-700 dark:text-amber-300 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30">
                            {pendingPartnerName}
                          </span>
                        </div>
                        {canManageStatus && <StatusBadge status={reg.registrationStatus} />}
                        {reg.partnerUser?.id === user?.id && !isRegistered && tournament.status === 'OPEN' && !tournament.registrationClosed ? (
                          /* Current user is the pending partner - show Accept button */
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setRegistering(true);
                              try {
                                await tournamentAPI.register(id, { partnerId: reg.userId });
                                toast.success(`Registration successful! You are now partnered with ${reg.user.fullName || reg.user.username}`);
                                fetchTournamentDetails();
                              } catch (error) {
                                toast.error(error.response?.data?.message || 'Registration failed');
                              } finally {
                                setRegistering(false);
                              }
                            }}
                            disabled={registering}
                            className="px-3 py-1 bg-brand-green hover:bg-green-600 text-white text-xs font-semibold rounded-full shadow-sm transition-colors disabled:opacity-50"
                          >
                            {registering ? 'Accepting...' : 'Accept'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            Pending acceptance
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Singles or no partner selected */
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {reg.user.fullName || reg.user.username}
                        </span>
                        {canManageStatus && <StatusBadge status={reg.registrationStatus} />}
                        {isDoublesFormat && (
                          selectedByName ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              Partner of {selectedByName}
                            </span>
                          ) : canManageStatus && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') ? (
                            /* Admin can assign partner */
                            <select
                              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignPartner(reg.id, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            >
                              <option value="">Assign partner...</option>
                              {tournament.registrations
                                .filter(r =>
                                  r.id !== reg.id && // Not self
                                  !r.partnerId && // Doesn't have a partner
                                  !tournament.registrations.some(other => other.partnerId === r.userId) // Not selected by anyone
                                )
                                .map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.user.fullName || r.user.username}
                                  </option>
                                ))
                              }
                            </select>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              No partner
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {canManageStatus && (
                    <>
                      {/* TEAM ACTIONS for doubles pairs - both registered */}
                      {isDoublesFormat && partnerReg ? (
                        <>
                          {/* Approve Team - show if either player is PENDING or REJECTED */}
                          {(reg.registrationStatus === 'PENDING' || partnerReg.registrationStatus === 'PENDING' ||
                            reg.registrationStatus === 'REJECTED' || partnerReg.registrationStatus === 'REJECTED') && (
                            <button
                              onClick={() => handleApproveTeam(
                                reg.id,
                                partnerReg.id,
                                reg.user.fullName || reg.user.username,
                                partnerReg.user.fullName || partnerReg.user.username
                              )}
                              className="px-4 py-2 bg-success/10 text-success hover:bg-success hover:text-white border border-success/20 hover:border-success rounded-lg font-semibold text-sm transition-all"
                            >
                              Approve Team
                            </button>
                          )}

                          {/* Reject Team - hide if both are already rejected */}
                          {!(reg.registrationStatus === 'REJECTED' && partnerReg.registrationStatus === 'REJECTED') && (
                            <button
                              onClick={() => handleRejectTeam(
                                reg.id,
                                partnerReg.id,
                                reg.user.fullName || reg.user.username,
                                partnerReg.user.fullName || partnerReg.user.username
                              )}
                              className="px-4 py-2 bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 hover:border-error rounded-lg font-semibold text-sm transition-all"
                            >
                              Reject Team
                            </button>
                          )}

                          {/* Unregister Team */}
                          <button
                            onClick={() => handleUnregisterTeam(
                              reg.id,
                              partnerReg.id,
                              reg.user.fullName || reg.user.username,
                              partnerReg.user.fullName || partnerReg.user.username
                            )}
                            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
                          >
                            Unregister Team
                          </button>
                        </>
                      ) : isDoublesFormat && pendingPartnerName ? (
                        /* TEAM ACTIONS for pending partner - partner not yet registered */
                        <>
                          <button
                            onClick={() => handleApproveTeamWithPendingPartner(
                              reg.id,
                              reg.user.fullName || reg.user.username,
                              pendingPartnerName
                            )}
                            className="px-4 py-2 bg-success/10 text-success hover:bg-success hover:text-white border border-success/20 hover:border-success rounded-lg font-semibold text-sm transition-all"
                          >
                            Approve Team
                          </button>
                          <button
                            onClick={() => handleUnregisterParticipant(reg.id, reg.user.fullName || reg.user.username, reg.userId)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
                          >
                            Unregister
                          </button>
                        </>
                      ) : (
                        <>
                          {/* INDIVIDUAL ACTIONS for singles or unpaired */}
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
            );
            })}
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

      {/* Round Robin Winners Podium - Show when tournament is completed */}
      {tournament.format === 'ROUND_ROBIN' && tournament.status === 'COMPLETED' && roundRobinWinners.length > 0 && (
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
                  {roundRobinWinners[1]?.user?.fullName || roundRobinWinners[1]?.user?.username || 'TBD'}
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
                  {roundRobinWinners[0]?.user?.fullName || roundRobinWinners[0]?.user?.username || 'TBD'}
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
                <p className="text-xs sm:text-sm font-semibold text-orange-900 dark:text-orange-100 truncate px-1">
                  {roundRobinWinners[2]?.user?.fullName || roundRobinWinners[2]?.user?.username || '-'}
                </p>
                <p className="text-[10px] sm:text-xs text-orange-700 dark:text-orange-400">3rd Place</p>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Round Robin Completion Options */}
      {tournament.format === 'ROUND_ROBIN' &&
        tournament.status === 'ACTIVE' &&
        !tournament.groupStageComplete &&
        canManageStatus &&
        matches.length > 0 &&
        matches.every((m) => m.matchStatus === 'COMPLETED') && (
          <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-brand-green/50">
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
              <span>🏆</span> All Matches Completed!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Choose how to complete this Round Robin tournament:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Declare Winners Option */}
              <div className="glass-surface p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Declare Winners
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  End the tournament now. Top 3 players from the leaderboard will be declared as 1st, 2nd, and 3rd place winners.
                </p>
                <Button
                  onClick={handleDeclareWinners}
                  loading={processingCompletion}
                  disabled={processingCompletion}
                  variant="primary"
                  className="w-full"
                >
                  🥇 Declare Winners
                </Button>
              </div>

              {/* Create Knockout Option */}
              <div className="glass-surface p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Create Playoff Rounds
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Top players will advance to knockout rounds (Semi-Finals, Finals).
                </p>
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Players to advance:
                  </label>
                  <select
                    value={selectedAdvancePlayers}
                    onChange={(e) => setSelectedAdvancePlayers(Number(e.target.value))}
                    className="w-full px-3 py-2 glass-surface rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                    disabled={processingCompletion}
                  >
                    <option value={2} disabled={(tournament.teams?.length || 0) < 2}>
                      Top 2 (Final only){(tournament.teams?.length || 0) < 2 ? ' - Need 2+ players' : ''}
                    </option>
                    <option value={4} disabled={(tournament.teams?.length || 0) < 4}>
                      Top 4 (Semi-Finals + Final){(tournament.teams?.length || 0) < 4 ? ` - Need 4+ players (have ${tournament.teams?.length || 0})` : ''}
                    </option>
                    <option value={8} disabled={(tournament.teams?.length || 0) < 8}>
                      Top 8 (Quarter-Finals + Semi-Finals + Final){(tournament.teams?.length || 0) < 8 ? ` - Need 8+ players (have ${tournament.teams?.length || 0})` : ''}
                    </option>
                  </select>
                  {(tournament.teams?.length || 0) < 4 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      You have {tournament.teams?.length || 0} player(s). Some playoff options are unavailable.
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleCreateKnockout}
                  loading={processingCompletion}
                  disabled={processingCompletion}
                  variant="secondary"
                  className="w-full"
                >
                  🎯 Create Playoffs
                </Button>
              </div>
            </div>
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
          // Use teamName for DOUBLES (contains both players), or player1 name for SINGLES
          const team1Name = match.team1?.teamName || match.team1?.player1?.fullName || match.team1?.player1?.username || 'TBD';
          const team2Name = match.team2?.teamName || match.team2?.player1?.fullName || match.team2?.player1?.username || 'TBD';
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
                  </div>
                  <div className="px-2 sm:px-4 py-1 bg-gray-200 dark:bg-slate-600 rounded font-bold text-xs sm:text-sm text-gray-900 dark:text-white">VS</div>
                  <div className={`flex-1 text-left font-medium ${match.matchStatus === 'COMPLETED' && match.winnerId === match.team2Id ? 'text-brand-green' : 'text-gray-900 dark:text-white'}`}>
                    <span className="block sm:inline">{team2Name}</span>
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

        // Helper to render matches grouped by round with borders
        const renderMatchesGroupedByRound = (matchList) => {
          // Group matches by round
          const groupedByRound = matchList.reduce((acc, match) => {
            const round = match.round;
            if (!acc[round]) acc[round] = [];
            acc[round].push(match);
            return acc;
          }, {});

          return Object.entries(groupedByRound).map(([round, roundMatches], idx) => (
            <div key={round} className={`${idx > 0 ? 'mt-6' : ''}`}>
              <div className="border-2 border-brand-green rounded-lg p-4">
                <h3 className="text-lg font-semibold text-brand-green mb-3 pb-2 border-b border-brand-green/30">
                  {round}
                </h3>
                <div className="space-y-3">
                  {roundMatches.map((match) => renderMatchCard(match))}
                </div>
              </div>
            </div>
          ));
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
                  {renderMatchesGroupedByRound(activeMatches)}
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
                      {renderMatchesGroupedByRound(completedMatches)}
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

      {/* Add Player Modal */}
      {addPlayerModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Register Player
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Player
              </label>
              <select
                value={addPlayerModal.playerId}
                onChange={(e) => setAddPlayerModal(prev => ({ ...prev, playerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                disabled={addPlayerModal.loading}
              >
                <option value="">Select player...</option>
                {allUsers
                  .filter(u => !tournament.registrations?.some(r => r.userId === u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.username}
                    </option>
                  ))
                }
              </select>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAddPlayerModal({ isOpen: false, playerId: '', loading: false })}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                disabled={addPlayerModal.loading}
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterPlayer}
                disabled={addPlayerModal.loading || !addPlayerModal.playerId}
                className="flex-1 px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addPlayerModal.loading ? 'Registering...' : 'Register Player'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      {addTeamModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Register Team
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Player 1
                </label>
                <select
                  value={addTeamModal.player1Id}
                  onChange={(e) => setAddTeamModal(prev => ({ ...prev, player1Id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                  disabled={addTeamModal.loading}
                >
                  <option value="">Select player...</option>
                  {allUsers
                    .filter(u => !tournament.registrations?.some(r => r.userId === u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || u.username}
                      </option>
                    ))
                  }
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Player 2
                </label>
                <select
                  value={addTeamModal.player2Id}
                  onChange={(e) => setAddTeamModal(prev => ({ ...prev, player2Id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                  disabled={addTeamModal.loading}
                >
                  <option value="">Select player...</option>
                  {allUsers
                    .filter(u => !tournament.registrations?.some(r => r.userId === u.id) && u.id !== addTeamModal.player1Id)
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || u.username}
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAddTeamModal({ isOpen: false, player1Id: '', player2Id: '', loading: false })}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                disabled={addTeamModal.loading}
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterTeam}
                disabled={addTeamModal.loading || !addTeamModal.player1Id || !addTeamModal.player2Id}
                className="flex-1 px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addTeamModal.loading ? 'Registering...' : 'Register Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetails;
