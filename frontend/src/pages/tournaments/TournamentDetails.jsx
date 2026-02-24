import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, ChevronDown, ChevronUp, X, Eye, EyeOff } from 'lucide-react';
import { tournamentAPI, matchAPI, userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFeatureFlag } from '../../context/FeatureFlagContext';
import { ConfirmationModal, TournamentTimer, StatusBadge, LoadingSpinner, Button, PartnerSelect } from '../../components/common';
import BracketView from '../../components/bracket/BracketView';
import GroupStageView from '../../components/bracket/GroupStageView';
import ManualGroupAssignment from '../../components/bracket/ManualGroupAssignment';
import TournamentLeaderboard from '../../components/tournament/TournamentLeaderboard';
import TournamentStructurePreview from '../../components/tournament/TournamentStructurePreview';
import socketService from '../../services/socket';

const TournamentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isOrganizer, isRoot, loading: authLoading } = useAuth();
  const toast = useToast();
  const structurePreviewEnabled = useFeatureFlag('tournament_structure_preview');
  const adminRegistrationEnabled = useFeatureFlag('admin_player_registration');
  const matchDeletionEnabled = useFeatureFlag('match_deletion');
  const autoScoreEnabled = useFeatureFlag('dev_auto_score');
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
  const [createMatchData, setCreateMatchData] = useState({ team1Id: '', team2Id: '', round: '' });
  const [customMatchType, setCustomMatchType] = useState('singles');
  const [customMatchPlayers, setCustomMatchPlayers] = useState({ side1: [''], side2: [''], round: '' });
  const [autoScoringMatchId, setAutoScoringMatchId] = useState(null);
  const [autoScoringRound, setAutoScoringRound] = useState(null);
  const [editTeamModal, setEditTeamModal] = useState({ isOpen: false, teamId: '', matchId: '', player1Id: '', player2Id: '', loading: false });
  const [collapsedRounds, setCollapsedRounds] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [winnersModal, setWinnersModal] = useState({
    isOpen: false, mode: 'leaderboard', loading: false, submitting: false,
    isTeam: false,
    winners: [
      { place: 1, name: '', player1Name: '', player2Name: '', teamId: '' },
      { place: 2, name: '', player1Name: '', player2Name: '', teamId: '' },
      { place: 3, name: '', player1Name: '', player2Name: '', teamId: '' },
    ],
  });

  useEffect(() => {
    // Wait for auth to finish loading before fetching tournament
    if (!authLoading) {
      fetchTournamentDetails();
      fetchMatches();
    }

    // Connect socket and join tournament room
    socketService.connect();
    socketService.joinTournament(id);

    // Listen for match updates — use socket payloads directly where possible
    socketService.onMatchCreated((match) => {
      setMatches((prev) => {
        if (prev.some((m) => m.id === match.id)) return prev;
        return [...prev, match];
      });
    });

    socketService.onMatchUpdated((match) => {
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...match } : m)));
    });

    socketService.onMatchScoreUpdate((match) => {
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...match } : m)));
    });

    socketService.onMatchStarted((match) => {
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...match } : m)));
    });

    socketService.onMatchCompleted((match) => {
      // Immediately update the completed match from socket payload
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...match } : m)));
      // Background refetch to pick up bracket advancement (advanceWinner doesn't emit socket events)
      fetchMatches();
    });

    socketService.onMatchDeleted((data) => {
      const deletedId = data.matchId || data.id;
      setMatches((prev) => prev.filter((m) => m.id !== deletedId));
    });

    socketService.onMatchWalkover((match) => {
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...match } : m)));
      // Background refetch for bracket advancement
      fetchMatches();
    });

    // Listen for tournament updates (including reset)
    socketService.onTournamentReset(() => {
      fetchTournamentDetails();
      fetchMatches();
    });

    socketService.onTournamentUpdated(() => {
      fetchTournamentDetails();
    });

    socketService.onBracketGenerated(() => {
      fetchTournamentDetails();
      fetchMatches();
    });

    socketService.onGroupStageComplete(() => {
      fetchTournamentDetails();
      fetchMatches();
    });

    socketService.onKnockoutCreated(() => {
      fetchTournamentDetails();
      fetchMatches();
    });

    socketService.onTournamentCompleted((data) => {
      // Update tournament status and winners from socket payload
      setTournament((prev) => prev ? { ...prev, status: 'COMPLETED', winners: data.winners || prev.winners } : prev);
      fetchMatches();
    });

    return () => {
      socketService.leaveTournament(id);
      socketService.off('match:created');
      socketService.off('match:updated');
      socketService.off('match:scoreUpdate');
      socketService.off('match:started');
      socketService.off('match:completed');
      socketService.off('match:deleted');
      socketService.off('match:walkover');
      socketService.off('tournament:reset');
      socketService.off('tournament:updated');
      socketService.off('tournament:bracketGenerated');
      socketService.off('tournament:groupStageComplete');
      socketService.off('tournament:knockoutCreated');
      socketService.off('tournament:completed');
    };
  }, [id, authLoading]);

  // Load persisted winners for completed Round Robin tournaments
  useEffect(() => {
    if ((tournament?.format === 'ROUND_ROBIN' || tournament?.format === 'CUSTOM') && tournament?.status === 'COMPLETED') {
      if (tournament.winners && Array.isArray(tournament.winners) && tournament.winners.length > 0) {
        setRoundRobinWinners(tournament.winners);
      } else {
        fetchRoundRobinWinners();
      }
    }
  }, [tournament?.format, tournament?.status, tournament?.winners, id]);

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
      const response = await tournamentAPI.getById(id);
      setTournament(response.data.data);
    } catch (error) {
      // Silently fail - tournament may not exist
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const response = await matchAPI.getByTournament(id);
      setMatches(response.data.data);
    } catch (error) {
      // Silently fail
    }
  };

  // Fetch leaderboard for Round Robin winners podium
  const fetchRoundRobinWinners = async () => {
    try {
      const response = await tournamentAPI.getLeaderboard(id);
      if (response.data.success && response.data.data) {
        setRoundRobinWinners(response.data.data.slice(0, 3)); // Top 3
      }
    } catch (error) {
      // Silently fail
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
      toast.success(`Tournament status updated to ${newStatus}`);
      await Promise.all([fetchTournamentDetails(), fetchMatches()]);
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

  const handleUpdatePlayoffTeam = async () => {
    setEditTeamModal(prev => ({ ...prev, loading: true }));
    try {
      await tournamentAPI.updatePlayoffTeam(id, editTeamModal.teamId, {
        player1Id: editTeamModal.player1Id,
        player2Id: editTeamModal.player2Id,
      });
      toast.success('Team updated successfully');
      setEditTeamModal({ isOpen: false, teamId: '', matchId: '', player1Id: '', player2Id: '', loading: false });
      fetchTournamentDetails();
      fetchMatches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update team');
    } finally {
      setEditTeamModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeclareWinners = async () => {
    const isTeam = tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED';
    const isRotating = tournament.partnerMode === 'ROTATING';
    const emptyWinners = [
      { place: 1, name: '', player1Name: '', player2Name: '', teamId: '' },
      { place: 2, name: '', player1Name: '', player2Name: '', teamId: '' },
      { place: 3, name: '', player1Name: '', player2Name: '', teamId: '' },
    ];

    setWinnersModal({
      isOpen: true, mode: 'leaderboard', loading: true, submitting: false,
      isTeam, winners: emptyWinners,
    });

    try {
      const response = await tournamentAPI.getLeaderboard(id);
      if (response.data.success && response.data.data) {
        const top = response.data.data;
        let prefilled;
        if (isTeam && isRotating) {
          // ROTATING mode: leaderboard has individual players, pair them 1st+2nd, 3rd+4th, 5th+6th
          prefilled = [1, 2, 3].map((place, idx) => {
            const p1 = top[idx * 2];
            const p2 = top[idx * 2 + 1];
            return {
              place,
              name: '',
              player1Name: p1 ? (p1.user?.fullName || p1.user?.username || '') : '',
              player2Name: p2 ? (p2.user?.fullName || p2.user?.username || '') : '',
            };
          });
        } else if (isTeam) {
          prefilled = [1, 2, 3].map((place, idx) => {
            const entry = top[idx];
            if (!entry) return { place, name: '', player1Name: '', player2Name: '' };
            return {
              place,
              name: '',
              player1Name: entry.player1?.fullName || entry.player1?.username || '',
              player2Name: entry.player2?.fullName || entry.player2?.username || '',
            };
          });
        } else {
          prefilled = [1, 2, 3].map((place, idx) => {
            const entry = top[idx];
            if (!entry) return { place, name: '', player1Name: '', player2Name: '' };
            return {
              place,
              name: entry.user?.fullName || entry.user?.username || '',
              player1Name: '', player2Name: '',
            };
          });
        }
        setWinnersModal(prev => ({ ...prev, loading: false, winners: prefilled }));
      } else {
        setWinnersModal(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setWinnersModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleWinnersModalModeSwitch = (newMode) => {
    if (newMode === winnersModal.mode) return;
    if (newMode === 'custom') {
      setWinnersModal(prev => ({
        ...prev, mode: 'custom',
        winners: [
          { place: 1, name: '', player1Name: '', player2Name: '', teamId: '' },
          { place: 2, name: '', player1Name: '', player2Name: '', teamId: '' },
          { place: 3, name: '', player1Name: '', player2Name: '', teamId: '' },
        ],
      }));
    } else {
      handleDeclareWinners();
    }
  };

  const handleWinnerTeamSelect = (idx, teamId) => {
    const team = tournament.teams?.find(t => t.id === teamId);
    const isTeam = winnersModal.isTeam;
    const updated = [...winnersModal.winners];
    if (!teamId) {
      updated[idx] = { ...updated[idx], teamId: '', name: '', player1Name: '', player2Name: '' };
    } else {
      const p1 = team?.player1?.fullName || team?.player1?.username || '';
      const p2 = team?.player2 ? (team.player2.fullName || team.player2.username || '') : '';
      updated[idx] = {
        ...updated[idx],
        teamId,
        name: isTeam ? '' : p1,
        player1Name: isTeam ? p1 : '',
        player2Name: isTeam ? p2 : '',
      };
    }
    setWinnersModal(prev => ({ ...prev, winners: updated }));
  };

  const handleConfirmWinners = async () => {
    const { winners, isTeam } = winnersModal;
    const winnersPayload = winners.map(w => ({
      place: w.place,
      ...(isTeam
        ? { player1Name: w.player1Name.trim(), player2Name: w.player2Name.trim() }
        : { name: w.name.trim() }),
    }));

    const first = winnersPayload[0];
    if (isTeam ? (!first.player1Name || !first.player2Name) : !first.name) {
      toast.error('At least 1st place must be filled');
      return;
    }

    setWinnersModal(prev => ({ ...prev, submitting: true }));
    try {
      const response = await tournamentAPI.declareWinners(id, winnersPayload);
      toast.success(response.data.message || 'Winners declared! Tournament completed.');
      setWinnersModal(prev => ({ ...prev, isOpen: false, submitting: false }));
      fetchTournamentDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to declare winners');
      setWinnersModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleAutoScore = async (matchId) => {
    setAutoScoringMatchId(matchId);
    try {
      const response = await matchAPI.autoScore(matchId);
      toast.success(response.data.message || 'Match auto-scored');
      fetchTournamentDetails();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to auto-score match');
    } finally {
      setAutoScoringMatchId(null);
    }
  };

  const handleAutoScoreAll = async () => {
    const scorable = matches.filter(m => m.matchStatus !== 'COMPLETED' && m.team1Id && m.team2Id);
    if (scorable.length === 0) {
      toast.info('No matches to auto-score');
      return;
    }
    setAutoScoringRound('all');
    let scored = 0;
    for (const match of scorable) {
      try {
        setAutoScoringMatchId(match.id);
        await matchAPI.autoScore(match.id);
        scored++;
      } catch (error) {
        toast.error(`Failed to score ${match.round}: ${error.response?.data?.message || 'Unknown error'}`);
      }
    }
    setAutoScoringMatchId(null);
    setAutoScoringRound(null);
    toast.success(`Auto-scored ${scored}/${scorable.length} matches`);
    fetchTournamentDetails();
  };

  const handleReopenTournament = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reopen Tournament?',
      message: 'This will set the tournament back to Active so you can create playoffs or make changes.',
      confirmText: 'Reopen',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: async () => {
        setProcessingCompletion(true);
        try {
          await tournamentAPI.reopenTournament(id);
          toast.success('Tournament reopened');
          fetchTournamentDetails();
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to reopen tournament');
        } finally {
          setProcessingCompletion(false);
        }
      },
    });
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

  const handleGenerateDraws = () => {
    const approvedCount = tournament.registrations?.filter(r => r.registrationStatus === 'APPROVED').length || 0;
    const isRegenerate = tournament.bracketGenerated;
    setConfirmModal({
      isOpen: true,
      title: isRegenerate ? 'Regenerate Draws?' : 'Generate Draws?',
      message: isRegenerate
        ? `This will delete all current matches and generate new draws for ${approvedCount} player${approvedCount !== 1 ? 's' : ''}. This cannot be undone.`
        : `This will generate the match draws for ${approvedCount} registered player${approvedCount !== 1 ? 's' : ''}. You can regenerate the draws later if needed.`,
      confirmText: isRegenerate ? 'Regenerate' : 'Generate Draws',
      cancelText: 'Cancel',
      type: isRegenerate ? 'danger' : 'primary',
      onConfirm: async () => {
        try {
          await tournamentAPI.generateDraws(id);
          toast.success(isRegenerate ? 'Draws regenerated successfully' : 'Draws generated successfully');
          await Promise.all([fetchTournamentDetails(), fetchMatches()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to generate draws');
        }
      },
    });
  };

  const handleRegenerateDraws = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Regenerate Draws?',
      message: 'This will delete all current matches and generate new draws. This cannot be undone.',
      confirmText: 'Regenerate',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await tournamentAPI.regenerateBracket(id);
          toast.success('Draws regenerated successfully');
          await Promise.all([fetchTournamentDetails(), fetchMatches()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to regenerate draws');
        }
      },
    });
  };

  const handleRevertPlayoffs = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Revert Playoffs?',
      message: 'This will delete all playoff matches and return to the tournament options view where you can declare winners or create new playoffs.',
      confirmText: 'Revert',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await tournamentAPI.revertPlayoffs(id);
          toast.success('Playoffs reverted successfully');
          await Promise.all([fetchTournamentDetails(), fetchMatches()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to revert playoffs');
        }
      },
    });
  };

  const handleRegeneratePlayoffDraws = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Regenerate Playoff Draws?',
      message: 'This will reshuffle the playoff matchups based on the current round robin standings.',
      confirmText: 'Regenerate',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await tournamentAPI.revertPlayoffs(id);
          // Re-create playoffs with the same number of advance players
          await tournamentAPI.roundRobinToKnockout(id, selectedAdvancePlayers);
          toast.success('Playoff draws regenerated successfully');
          await Promise.all([fetchTournamentDetails(), fetchMatches()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to regenerate playoff draws');
        }
      },
    });
  };

  const handleRevertKnockouts = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Revert Knockouts?',
      message: 'This will delete all knockout matches and return to the group stage view where you can choose how many players advance.',
      confirmText: 'Revert',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await tournamentAPI.revertPlayoffs(id);
          toast.success('Knockouts reverted successfully');
          await Promise.all([fetchTournamentDetails(), fetchMatches()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to revert knockouts');
        }
      },
    });
  };

  const handleRegenerateKnockoutDraws = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Regenerate Knockout Draws?',
      message: 'This will reshuffle the knockout matchups based on the current group standings.',
      confirmText: 'Regenerate',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        try {
          await tournamentAPI.revertPlayoffs(id);
          await tournamentAPI.completeGroupStage(id, { advancingPerGroup: tournament.advancingPerGroup || 2 });
          toast.success('Knockout draws regenerated successfully');
          await Promise.all([fetchTournamentDetails(), fetchMatches()]);
        } catch (error) {
          toast.error(error.response?.data?.message || 'Failed to regenerate knockout draws');
        }
      },
    });
  };

  const handleGenerateRoundRobin = async () => {
    try {
      setProcessingCompletion(true);
      const { data } = await tournamentAPI.generateRoundRobin(id);
      toast.success(data.message || 'Round robin matches generated');
      fetchMatches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate round robin matches');
    } finally {
      setProcessingCompletion(false);
    }
  };

  const handleCreateCustomMatch = async () => {
    const side1 = customMatchPlayers.side1.filter(Boolean);
    const side2 = customMatchPlayers.side2.filter(Boolean);
    const expectedCount = customMatchType === 'singles' ? 1 : 2;
    if (side1.length !== expectedCount || side2.length !== expectedCount) {
      toast.error(`Please select ${expectedCount} player(s) per side`);
      return;
    }
    const allIds = [...side1, ...side2];
    if (new Set(allIds).size !== allIds.length) {
      toast.error('All players must be different');
      return;
    }
    try {
      await tournamentAPI.createCustomMatch(id, {
        matchType: customMatchType,
        side1Players: side1,
        side2Players: side2,
        round: customMatchPlayers.round || (customMatchType === 'singles' ? 'Singles Match' : 'Doubles Match'),
      });
      toast.success('Match created successfully');
      setCustomMatchPlayers({
        side1: customMatchType === 'singles' ? [''] : ['', ''],
        side2: customMatchType === 'singles' ? [''] : ['', ''],
        round: '',
      });
      fetchMatches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create match');
    }
  };

  const handleCreateManualMatch = async () => {
    if (!createMatchData.team1Id || !createMatchData.team2Id) {
      toast.error('Please select both teams');
      return;
    }
    if (createMatchData.team1Id === createMatchData.team2Id) {
      toast.error('Please select two different teams');
      return;
    }
    try {
      await matchAPI.create({
        tournamentId: id,
        team1Id: createMatchData.team1Id,
        team2Id: createMatchData.team2Id,
        round: createMatchData.round || 'Custom Match',
      });
      toast.success('Match created successfully');
      setCreateMatchData({ team1Id: '', team2Id: '', round: '' });
      fetchMatches();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create match');
    }
  };

  const getTeamDisplayName = (team) => {
    if (!team) return 'Unknown';
    const p1 = team.player1?.fullName || team.player1?.username || 'Unknown';
    if (team.player2) {
      const p2 = team.player2.fullName || team.player2.username || 'Unknown';
      return `${p1} & ${p2}`;
    }
    return p1;
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
            <button
              onClick={() => navigate('/tournaments')}
              className="flex items-center gap-1.5 text-sm text-light-text-muted dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tournaments
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold mb-3 text-light-text-primary dark:text-white">
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
            {canManageStatus && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') && tournament.format !== 'CUSTOM' && (
              <button
                onClick={handleGenerateDraws}
                disabled={updatingStatus}
                className={`px-6 py-3 bg-gradient-to-r ${tournament.bracketGenerated ? 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700' : 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'} text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span>{tournament.bracketGenerated ? '🔄 Regenerate Draws' : '🎯 Generate Draws'}</span>
                  {tournament.registrations && tournament.registrations.filter(reg => reg.registrationStatus === 'APPROVED').length > 0 && (
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">
                      {tournament.registrations.filter(reg => reg.registrationStatus === 'APPROVED').length} player{tournament.registrations.filter(reg => reg.registrationStatus === 'APPROVED').length !== 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              </button>
            )}
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
                <div className="px-6 py-2 bg-light-border dark:bg-gray-700 text-light-text-muted dark:text-gray-400 font-semibold rounded-lg text-center">
                  🔒 Registration Closed
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Show partner invite if someone has already selected this user */}
                  {activeInvite && (tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && tournament.partnerMode !== 'ROTATING' && (
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

                  {/* Partner selection for DOUBLES/MIXED tournaments (not for rotating partners) */}
                  {(tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && tournament.partnerMode !== 'ROTATING' && (
                    <PartnerSelect
                      tournamentId={id}
                      value={selectedPartnerId}
                      onChange={setSelectedPartnerId}
                      disabled={registering}
                    />
                  )}
                  {(tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && tournament.partnerMode === 'ROTATING' && (
                    <p className="text-sm text-light-text-muted dark:text-gray-400 italic">
                      Partners will be assigned automatically each round — just register individually.
                    </p>
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
          <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-light-text-primary dark:text-white">Details</h3>
          <div className="space-y-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-light-text-muted dark:text-gray-400">Location:</span>
              <span className="text-light-text-primary dark:text-white">{tournament.location}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-light-text-muted dark:text-gray-400">Start Date:</span>
              <span className="text-light-text-primary dark:text-white">{formatDate(tournament.startDate)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-light-text-muted dark:text-gray-400">End Date:</span>
              <span className="text-light-text-primary dark:text-white">{formatDate(tournament.endDate)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-light-text-muted dark:text-gray-400">Participants:</span>
              <span className="text-light-text-primary dark:text-white">
                {tournament.registrations?.filter(reg => reg.registrationStatus === 'APPROVED').length ?? 0} / {tournament.maxParticipants}
              </span>
            </div>
            {tournament.description && (
              <div className="flex flex-col pt-2 border-t border-light-border dark:border-gray-700">
                <span className="text-sm font-semibold text-light-text-muted dark:text-gray-400 mb-1">Description:</span>
                <p className="text-light-text-primary dark:text-white">{tournament.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-light-text-primary dark:text-white">Organizer</h3>
          <div className="space-y-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-light-text-muted dark:text-gray-400">Name:</span>
              <span className="text-light-text-primary dark:text-white">
                {tournament.createdBy.fullName || tournament.createdBy.username}
              </span>
            </div>
            {canManageStatus && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-light-text-muted dark:text-gray-400">Email:</span>
                <span className="text-light-text-primary dark:text-white">{tournament.createdBy.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tournament Structure Preview */}
      {structurePreviewEnabled && (
        <TournamentStructurePreview
          format={tournament.format}
          tournamentType={tournament.tournamentType}
          participantCount={
            (tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED')
              ? (tournament.teams?.length || Math.floor((tournament.registrations?.filter(reg => reg.registrationStatus === 'APPROVED').length || 0) / 2))
              : (tournament.registrations?.filter(reg => reg.registrationStatus === 'APPROVED').length || 0)
          }
          maxParticipants={tournament.maxParticipants}
          numberOfGroups={tournament.numberOfGroups}
          advancingPerGroup={tournament.advancingPerGroup}
        />
      )}

      {tournament.registrations && (tournament.registrations.length > 0 || canManageStatus) && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer"
            onClick={() => setParticipantsExpanded(!participantsExpanded)}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-light-text-primary dark:text-white">
                Registered Participants ({tournament.registrations.length})
              </h2>
              {participantsExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {adminRegistrationEnabled && canManageStatus && tournament.tournamentType === 'SINGLES' && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
                <button
                  onClick={openAddPlayerModal}
                  className="px-4 py-2 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white border border-brand-blue/20 hover:border-brand-blue rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <span>+</span>
                  Add Player
                </button>
              )}
              {adminRegistrationEnabled && canManageStatus && (tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
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
              const isDoublesFormat = (tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') && tournament.partnerMode !== 'ROTATING';
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
                          <span className="font-medium text-light-text-primary dark:text-white px-3 py-1.5 bg-light-surface dark:bg-slate-700">
                            {reg.user.fullName || reg.user.username}
                          </span>
                          <span className="border-l border-gray-300 dark:border-gray-600 h-full"></span>
                          <span className="font-medium text-light-text-primary dark:text-white px-3 py-1.5 bg-light-surface dark:bg-slate-700">
                            {partnerName}
                          </span>
                        </div>
                        {canManageStatus && <StatusBadge status={reg.registrationStatus} />}
                        {/* Admin can change partner */}
                        {canManageStatus && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') && (
                          <select
                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-light-text-primary dark:text-white"
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
                          <span className="font-medium text-light-text-primary dark:text-white px-3 py-1.5 bg-light-surface dark:bg-slate-700">
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
                        <span className="font-medium text-light-text-primary dark:text-white truncate">
                          {reg.user.fullName || reg.user.username}
                        </span>
                        {canManageStatus && <StatusBadge status={reg.registrationStatus} />}
                        {isDoublesFormat && (
                          selectedByName ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-teal-100 dark:bg-blue-900/30 text-teal-700 dark:text-blue-300">
                              Partner of {selectedByName}
                            </span>
                          ) : canManageStatus && (tournament.status === 'OPEN' || tournament.status === 'DRAFT') ? (
                            /* Admin can assign partner */
                            <select
                              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-slate-700 text-light-text-primary dark:text-white"
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
                            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-light-border dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
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
                            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-light-border dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
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
                                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-light-border dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
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
                                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-light-border dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
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
                      className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-light-border dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-sm transition-all"
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
        const isDoubles = tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED';
        const getPlayerDisplay = (team) => {
          if (!team) return <span>TBD</span>;
          const p1 = team.player1?.fullName || team.player1?.username || 'Unknown';
          if (isDoubles && team.player2 && team.player2.id !== team.player1?.id) {
            const p2 = team.player2.fullName || team.player2.username;
            return <><span className="block">{p1}</span><span className="block">{p2}</span></>;
          }
          return <span>{p1}</span>;
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
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-light-text-primary dark:text-white text-center">
              Tournament Winners
            </h2>

            {/* Podium Display */}
            <div className="flex items-end justify-center gap-2 sm:gap-4 mb-6">
              {/* 2nd Place */}
              <div className="flex flex-col items-center">
                <div className={`${isDoubles ? 'w-24 sm:w-32' : 'w-16 sm:w-24'} h-20 sm:h-28 bg-gradient-to-t from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-500 rounded-t-lg flex items-end justify-center pb-2`}>
                  <span className="text-2xl sm:text-4xl font-bold text-light-text-muted dark:text-gray-300">2</span>
                </div>
                <div className={`bg-light-border dark:bg-gray-600 ${isDoubles ? 'w-28 sm:w-36' : 'w-20 sm:w-28'} py-2 sm:py-3 text-center rounded-b-lg`}>
                  <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 px-1">
                    {getPlayerDisplay(runnerUp)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-light-text-muted dark:text-gray-400">Runner-up</p>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center -mt-4">
                <div className="text-3xl sm:text-4xl mb-1">👑</div>
                <div className={`${isDoubles ? 'w-28 sm:w-36' : 'w-20 sm:w-28'} h-28 sm:h-36 bg-gradient-to-t from-yellow-500 to-yellow-400 dark:from-yellow-600 dark:to-yellow-500 rounded-t-lg flex items-end justify-center pb-2`}>
                  <span className="text-3xl sm:text-5xl font-bold text-yellow-800 dark:text-yellow-200">1</span>
                </div>
                <div className={`bg-yellow-400 dark:bg-yellow-600 ${isDoubles ? 'w-32 sm:w-40' : 'w-24 sm:w-32'} py-2 sm:py-3 text-center rounded-b-lg`}>
                  <div className="text-xs sm:text-sm font-bold text-yellow-900 dark:text-yellow-100 px-1">
                    {getPlayerDisplay(winner)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300">Champion</p>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center">
                <div className={`${isDoubles ? 'w-24 sm:w-32' : 'w-16 sm:w-24'} h-16 sm:h-24 bg-gradient-to-t from-orange-400 to-orange-300 dark:from-orange-700 dark:to-orange-600 rounded-t-lg flex items-end justify-center pb-2`}>
                  <span className="text-2xl sm:text-4xl font-bold text-orange-800 dark:text-orange-200">3</span>
                </div>
                <div className={`bg-orange-300 dark:bg-orange-700 ${isDoubles ? 'w-28 sm:w-36' : 'w-20 sm:w-28'} py-2 sm:py-3 text-center rounded-b-lg`}>
                  {thirdPlaceStatus === 'completed' && thirdPlaceWinner ? (
                    <div className="text-xs sm:text-sm font-semibold text-orange-900 dark:text-orange-100 px-1">
                      {getPlayerDisplay(thirdPlaceWinner)}
                    </div>
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
      {(tournament.format === 'ROUND_ROBIN' || tournament.format === 'CUSTOM') && tournament.status === 'COMPLETED' && roundRobinWinners.length > 0 && (() => {
        const isDoubles = tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED';
        const getWinnerDisplay = (entry, fallback = 'TBD') => {
          if (!entry) return <span>{fallback}</span>;
          // Persisted winners format (from declare winners)
          if (entry.place) {
            if (isDoubles && entry.player1Name) {
              return <><span className="block">{entry.player1Name}</span>{entry.player2Name && <span className="block">{entry.player2Name}</span>}</>;
            }
            if (entry.name) return <span>{entry.name}</span>;
            if (entry.teamName) return <span>{entry.teamName}</span>;
          }
          // Leaderboard format (legacy fallback)
          if (entry.isTeam || entry.player1) {
            const p1 = entry.player1?.fullName || entry.player1?.username || '';
            const p2 = entry.player2?.fullName || entry.player2?.username || '';
            if (p1 && p2) return <><span className="block">{p1}</span><span className="block">{p2}</span></>;
            return <span>{p1 || p2 || fallback}</span>;
          }
          // Singles leaderboard format
          return <span>{entry.user?.fullName || entry.user?.username || fallback}</span>;
        };
        return (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-6 text-light-text-primary dark:text-white text-center">
            Tournament Winners
          </h2>

          {/* Podium Display */}
          <div className="flex items-end justify-center gap-2 sm:gap-4 mb-6">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              <div className={`${isDoubles ? 'w-24 sm:w-32' : 'w-16 sm:w-24'} h-20 sm:h-28 bg-gradient-to-t from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-500 rounded-t-lg flex items-end justify-center pb-2`}>
                <span className="text-2xl sm:text-4xl font-bold text-light-text-muted dark:text-gray-300">2</span>
              </div>
              <div className={`bg-light-border dark:bg-gray-600 ${isDoubles ? 'w-28 sm:w-36' : 'w-20 sm:w-28'} py-2 sm:py-3 text-center rounded-b-lg`}>
                <div className="text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-gray-200 px-1 leading-tight">
                  {getWinnerDisplay(roundRobinWinners[1])}
                </div>
                <p className="text-[10px] sm:text-xs text-light-text-muted dark:text-gray-400 mt-1">Runner-up</p>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center -mt-4">
              <div className="text-3xl sm:text-4xl mb-1">👑</div>
              <div className={`${isDoubles ? 'w-28 sm:w-36' : 'w-20 sm:w-28'} h-28 sm:h-36 bg-gradient-to-t from-yellow-500 to-yellow-400 dark:from-yellow-600 dark:to-yellow-500 rounded-t-lg flex items-end justify-center pb-2`}>
                <span className="text-3xl sm:text-5xl font-bold text-yellow-800 dark:text-yellow-200">1</span>
              </div>
              <div className={`bg-yellow-400 dark:bg-yellow-600 ${isDoubles ? 'w-32 sm:w-40' : 'w-24 sm:w-32'} py-2 sm:py-3 text-center rounded-b-lg`}>
                <div className="text-xs sm:text-sm font-bold text-yellow-900 dark:text-yellow-100 px-1 leading-tight">
                  {getWinnerDisplay(roundRobinWinners[0])}
                </div>
                <p className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300 mt-1">Champion</p>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              <div className={`${isDoubles ? 'w-24 sm:w-32' : 'w-16 sm:w-24'} h-16 sm:h-24 bg-gradient-to-t from-orange-400 to-orange-300 dark:from-orange-700 dark:to-orange-600 rounded-t-lg flex items-end justify-center pb-2`}>
                <span className="text-2xl sm:text-4xl font-bold text-orange-800 dark:text-orange-200">3</span>
              </div>
              <div className={`bg-orange-300 dark:bg-orange-700 ${isDoubles ? 'w-28 sm:w-36' : 'w-20 sm:w-28'} py-2 sm:py-3 text-center rounded-b-lg`}>
                <div className="text-[10px] sm:text-xs font-semibold text-orange-900 dark:text-orange-100 px-1 leading-tight">
                  {getWinnerDisplay(roundRobinWinners[2], '-')}
                </div>
                <p className="text-[10px] sm:text-xs text-orange-700 dark:text-orange-400 mt-1">3rd Place</p>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Reopen Tournament - for completed round robin tournaments */}
      {(tournament.format === 'ROUND_ROBIN' || tournament.format === 'CUSTOM') && tournament.status === 'COMPLETED' && canManageStatus && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6 border border-amber-500/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-light-text-primary dark:text-white">Tournament Completed</h3>
              <p className="text-sm text-light-text-muted dark:text-gray-400">
                Reopen the tournament to create playoffs or make changes.
              </p>
            </div>
            <Button
              onClick={handleReopenTournament}
              loading={processingCompletion}
              disabled={processingCompletion}
              variant="secondary"
              className="shrink-0"
            >
              Reopen Tournament
            </Button>
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

      {/* Tournament Bracket / Playoffs View - only for elimination formats */}
      {(tournament.status === 'ACTIVE' || tournament.bracketGenerated) && (tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-light-text-primary dark:text-white">
              Playoffs
            </h2>
            {canManageStatus && matches.some(m => m.matchStatus === 'UPCOMING') && (
              <button
                onClick={handleRegenerateDraws}
                className="px-4 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white border border-amber-500/20 hover:border-amber-500 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
              >
                🔄 Regenerate Draws
              </button>
            )}
          </div>
          <BracketView
            tournament={tournament}
            onMatchClick={(match) => navigate(`/matches/${match.id}`)}
            showSeeds={true}
          />
        </div>
      )}

      {/* Group Stage View for GROUP_KNOCKOUT tournaments */}
      {tournament.format === 'GROUP_KNOCKOUT' && (tournament.status === 'ACTIVE' || tournament.bracketGenerated) && (
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
      {(tournament.status === 'ACTIVE' || tournament.status === 'COMPLETED' || (tournament.bracketGenerated && matches.length > 0)) && (
        <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-light-text-primary dark:text-white">
            Tournament Leaderboard
          </h2>
          <TournamentLeaderboard tournamentId={id} matches={matches} />
        </div>
      )}

      {/* Round Robin / Custom Completion Options */}
      {(tournament.format === 'ROUND_ROBIN' || tournament.format === 'CUSTOM') &&
        (tournament.status === 'ACTIVE' || (tournament.bracketGenerated && matches.length > 0)) &&
        !tournament.groupStageComplete &&
        canManageStatus &&
        (tournament.format === 'CUSTOM' || (matches.length > 0 && matches.some((m) => m.matchStatus === 'COMPLETED'))) && (
          <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-brand-green/50">
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-light-text-primary dark:text-white flex items-center gap-2">
              <span>🏆</span> Tournament Options
            </h2>
            <p className="text-light-text-muted dark:text-gray-400 mb-4">
              {matches.length > 0
                ? `${matches.filter(m => m.matchStatus === 'COMPLETED').length} of ${matches.length} matches completed. Choose an option:`
                : 'No matches yet. Generate round robin matches or create matches manually.'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Generate Round Robin Option - only for CUSTOM with no matches */}
              {tournament.format === 'CUSTOM' && matches.length === 0 && (
                <div className="glass-surface p-4 rounded-lg">
                  <h3 className="font-semibold text-light-text-primary dark:text-white mb-2">
                    Generate Round Robin
                  </h3>
                  <p className="text-sm text-light-text-muted dark:text-gray-400 mb-4">
                    Auto-generate all round robin matches so every team plays each other once.
                  </p>
                  <Button
                    onClick={handleGenerateRoundRobin}
                    loading={processingCompletion}
                    disabled={processingCompletion}
                    variant="secondary"
                    className="w-full"
                  >
                    🔄 Generate Round Robin
                  </Button>
                </div>
              )}
              {/* Declare Winners Option */}
              <div className="glass-surface p-4 rounded-lg">
                <h3 className="font-semibold text-light-text-primary dark:text-white mb-2">
                  Declare Winners
                </h3>
                <p className="text-sm text-light-text-muted dark:text-gray-400 mb-4">
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
                <h3 className="font-semibold text-light-text-primary dark:text-white mb-2">
                  Create Playoff Rounds
                </h3>
                <p className="text-sm text-light-text-muted dark:text-gray-400 mb-3">
                  Top players will advance to knockout rounds (Semi-Finals, Finals).
                </p>
                <div className="mb-4">
                  <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                    Players to advance:
                  </label>
                  <select
                    value={selectedAdvancePlayers}
                    onChange={(e) => setSelectedAdvancePlayers(Number(e.target.value))}
                    className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
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

              {/* Create Manual Match Option */}
              {tournament.format === 'CUSTOM' ? (
                <div className="glass-surface p-4 rounded-lg">
                  <h3 className="font-semibold text-light-text-primary dark:text-white mb-2">
                    Create Match
                  </h3>
                  <p className="text-sm text-light-text-muted dark:text-gray-400 mb-3">
                    Create a singles or doubles match between registered players.
                  </p>
                  <div className="space-y-3 mb-4">
                    {/* Match Type Toggle */}
                    <div className="flex rounded-lg overflow-hidden border border-border">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomMatchType('singles');
                          setCustomMatchPlayers({ side1: [''], side2: [''], round: customMatchPlayers.round });
                        }}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${customMatchType === 'singles' ? 'bg-brand-blue text-white' : 'glass-surface text-light-text-muted dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      >
                        Singles (1v1)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomMatchType('doubles');
                          setCustomMatchPlayers({ side1: ['', ''], side2: ['', ''], round: customMatchPlayers.round });
                        }}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${customMatchType === 'doubles' ? 'bg-brand-blue text-white' : 'glass-surface text-light-text-muted dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      >
                        Doubles (2v2)
                      </button>
                    </div>

                    {/* Side 1 */}
                    <div>
                      <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                        {customMatchType === 'singles' ? 'Player 1:' : 'Side 1:'}
                      </label>
                      {customMatchPlayers.side1.map((playerId, idx) => {
                        const selectedIds = [...customMatchPlayers.side1, ...customMatchPlayers.side2].filter(Boolean);
                        return (
                          <select
                            key={`s1-${idx}`}
                            value={playerId}
                            onChange={(e) => {
                              const updated = [...customMatchPlayers.side1];
                              updated[idx] = e.target.value;
                              setCustomMatchPlayers(prev => ({ ...prev, side1: updated }));
                            }}
                            className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 mb-1"
                          >
                            <option value="">Select player...</option>
                            {tournament.registrations?.filter(r => r.registrationStatus === 'APPROVED').map(reg => (
                              <option key={reg.user.id} value={reg.user.id} disabled={selectedIds.includes(reg.user.id) && reg.user.id !== playerId}>
                                {reg.user.fullName || reg.user.username}
                              </option>
                            ))}
                          </select>
                        );
                      })}
                    </div>

                    {/* Side 2 */}
                    <div>
                      <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                        {customMatchType === 'singles' ? 'Player 2:' : 'Side 2:'}
                      </label>
                      {customMatchPlayers.side2.map((playerId, idx) => {
                        const selectedIds = [...customMatchPlayers.side1, ...customMatchPlayers.side2].filter(Boolean);
                        return (
                          <select
                            key={`s2-${idx}`}
                            value={playerId}
                            onChange={(e) => {
                              const updated = [...customMatchPlayers.side2];
                              updated[idx] = e.target.value;
                              setCustomMatchPlayers(prev => ({ ...prev, side2: updated }));
                            }}
                            className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 mb-1"
                          >
                            <option value="">Select player...</option>
                            {tournament.registrations?.filter(r => r.registrationStatus === 'APPROVED').map(reg => (
                              <option key={reg.user.id} value={reg.user.id} disabled={selectedIds.includes(reg.user.id) && reg.user.id !== playerId}>
                                {reg.user.fullName || reg.user.username}
                              </option>
                            ))}
                          </select>
                        );
                      })}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                        Round name:
                      </label>
                      <input
                        type="text"
                        value={customMatchPlayers.round}
                        onChange={(e) => setCustomMatchPlayers(prev => ({ ...prev, round: e.target.value }))}
                        placeholder={customMatchType === 'singles' ? 'e.g. Singles Match' : 'e.g. Doubles Match'}
                        className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateCustomMatch}
                    disabled={customMatchPlayers.side1.some(p => !p) || customMatchPlayers.side2.some(p => !p)}
                    variant="secondary"
                    className="w-full"
                  >
                    ➕ Create Match
                  </Button>
                </div>
              ) : (
              <div className="glass-surface p-4 rounded-lg">
                <h3 className="font-semibold text-light-text-primary dark:text-white mb-2">
                  Create Match
                </h3>
                <p className="text-sm text-light-text-muted dark:text-gray-400 mb-3">
                  Manually create a match between any two registered teams.
                </p>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Team 1:
                    </label>
                    <select
                      value={createMatchData.team1Id}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, team1Id: e.target.value }))}
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                    >
                      <option value="">Select team...</option>
                      {tournament.teams?.map(team => (
                        <option key={team.id} value={team.id} disabled={team.id === createMatchData.team2Id}>
                          {getTeamDisplayName(team)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Team 2:
                    </label>
                    <select
                      value={createMatchData.team2Id}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, team2Id: e.target.value }))}
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                    >
                      <option value="">Select team...</option>
                      {tournament.teams?.map(team => (
                        <option key={team.id} value={team.id} disabled={team.id === createMatchData.team1Id}>
                          {getTeamDisplayName(team)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Round name:
                    </label>
                    <input
                      type="text"
                      value={createMatchData.round}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, round: e.target.value }))}
                      placeholder="e.g. Semi-Final, Final"
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateManualMatch}
                  disabled={!createMatchData.team1Id || !createMatchData.team2Id}
                  variant="secondary"
                  className="w-full"
                >
                  ➕ Create Match
                </Button>
              </div>
              )}
            </div>
          </div>
        )}

      {/* Playoff Admin Options - shown after Create Playoffs */}
      {(tournament.format === 'ROUND_ROBIN' || tournament.format === 'CUSTOM') &&
        (tournament.status === 'ACTIVE' || (tournament.bracketGenerated && matches.length > 0)) &&
        tournament.groupStageComplete &&
        canManageStatus &&
        matches.some(m => !m.round?.includes('Group')) && (
          <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-amber-500/50">
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-light-text-primary dark:text-white flex items-center gap-2">
              <span>⚙️</span> Playoff Options
            </h2>
            <p className="text-light-text-muted dark:text-gray-400 mb-4">
              Regenerate draws or go back to tournament options.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleDeclareWinners}
                  loading={processingCompletion}
                  disabled={processingCompletion}
                  variant="primary"
                  className="w-full"
                >
                  🏆 Declare Winners
                </Button>
                <button
                  onClick={handleRegeneratePlayoffDraws}
                  className="px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/30 hover:border-amber-500 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                >
                  🔄 Regenerate Draws
                </button>
                <button
                  onClick={handleRevertPlayoffs}
                  className="px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/30 hover:border-blue-500 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                >
                  ↩️ Back to Tournament Options
                </button>
              </div>
              <div className="glass-surface p-4 rounded-lg">
                <h3 className="font-semibold text-light-text-primary dark:text-white mb-2">
                  Create Match
                </h3>
                <p className="text-sm text-light-text-muted dark:text-gray-400 mb-3">
                  Manually create a match between any two registered teams.
                </p>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Team 1:
                    </label>
                    <select
                      value={createMatchData.team1Id}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, team1Id: e.target.value }))}
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                    >
                      <option value="">Select team...</option>
                      {tournament.teams?.map(team => (
                        <option key={team.id} value={team.id} disabled={team.id === createMatchData.team2Id}>
                          {getTeamDisplayName(team)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Team 2:
                    </label>
                    <select
                      value={createMatchData.team2Id}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, team2Id: e.target.value }))}
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                    >
                      <option value="">Select team...</option>
                      {tournament.teams?.map(team => (
                        <option key={team.id} value={team.id} disabled={team.id === createMatchData.team1Id}>
                          {getTeamDisplayName(team)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Round name:
                    </label>
                    <input
                      type="text"
                      value={createMatchData.round}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, round: e.target.value }))}
                      placeholder="e.g. Semi-Final, Final, 3rd Place"
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateManualMatch}
                  disabled={!createMatchData.team1Id || !createMatchData.team2Id}
                  variant="secondary"
                  className="w-full"
                >
                  ➕ Create Match
                </Button>
              </div>
            </div>
          </div>
        )}

      {/* GROUP_KNOCKOUT Knockout Options - shown when there are non-group UPCOMING matches, before any are played */}
      {tournament.format === 'GROUP_KNOCKOUT' &&
        tournament.status === 'ACTIVE' &&
        canManageStatus &&
        matches.some(m => !m.round?.includes('Group')) && (
          <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-amber-500/50">
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-light-text-primary dark:text-white flex items-center gap-2">
              <span>⚙️</span> Knockout Options
            </h2>
            <p className="text-light-text-muted dark:text-gray-400 mb-4">
              Regenerate draws or go back to group stage.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                {tournament.groupStageComplete && (
                  <>
                    <button
                      onClick={handleRegenerateKnockoutDraws}
                      className="px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/30 hover:border-amber-500 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                    >
                      🔄 Regenerate Draws
                    </button>
                    <button
                      onClick={handleRevertKnockouts}
                      className="px-4 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/30 hover:border-blue-500 rounded-lg font-semibold text-sm transition-all flex items-center gap-2"
                    >
                      ↩️ Back to Group Stage
                    </button>
                  </>
                )}
              </div>
              <div className="glass-surface p-4 rounded-lg">
                <h3 className="font-semibold text-light-text-primary dark:text-white mb-2">
                  Create Match
                </h3>
                <p className="text-sm text-light-text-muted dark:text-gray-400 mb-3">
                  Manually create a knockout match between any two registered teams.
                </p>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Team 1:
                    </label>
                    <select
                      value={createMatchData.team1Id}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, team1Id: e.target.value }))}
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                    >
                      <option value="">Select team...</option>
                      {tournament.teams?.map(team => (
                        <option key={team.id} value={team.id} disabled={team.id === createMatchData.team2Id}>
                          {getTeamDisplayName(team)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Team 2:
                    </label>
                    <select
                      value={createMatchData.team2Id}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, team2Id: e.target.value }))}
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                    >
                      <option value="">Select team...</option>
                      {tournament.teams?.map(team => (
                        <option key={team.id} value={team.id} disabled={team.id === createMatchData.team1Id}>
                          {getTeamDisplayName(team)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">
                      Round name:
                    </label>
                    <input
                      type="text"
                      value={createMatchData.round}
                      onChange={(e) => setCreateMatchData(prev => ({ ...prev, round: e.target.value }))}
                      placeholder="e.g. Semi-Final, Final"
                      className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateManualMatch}
                  disabled={!createMatchData.team1Id || !createMatchData.team2Id}
                  variant="secondary"
                  className="w-full"
                >
                  ➕ Create Match
                </Button>
              </div>
            </div>

            {/* List of UPCOMING knockout matches with edit/delete options */}
            {(() => {
              const knockoutMatches = matches.filter(m => m.matchStatus === 'UPCOMING' && !m.round?.includes('Group'));
              if (knockoutMatches.length === 0) return null;
              const isDoublesType = tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED' || tournament.format === 'CUSTOM';
              return (
                <div className="mt-4 border-t border-light-border dark:border-gray-700 pt-4">
                  <h3 className="font-semibold text-light-text-primary dark:text-white mb-3">
                    Knockout Matches ({knockoutMatches.length})
                  </h3>
                  <div className="space-y-2">
                    {knockoutMatches.map(match => {
                      const t1 = match.team1 ? getTeamDisplayName(match.team1) : 'TBD';
                      const t2 = match.team2 ? getTeamDisplayName(match.team2) : 'TBD';
                      return (
                        <div key={match.id} className="glass-surface p-3 rounded-lg">
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{match.round}</span>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex-1 flex items-center gap-1 text-sm text-light-text-primary dark:text-white">
                              <span>{t1}</span>
                              {isDoublesType && match.team1 && (
                                <button
                                  onClick={() => setEditTeamModal({
                                    isOpen: true, teamId: match.team1.id, matchId: match.id,
                                    player1Id: match.team1.player1?.id || '', player2Id: match.team1.player2?.id || '', loading: false,
                                  })}
                                  className="p-0.5 text-teal-500 hover:bg-teal-500/10 dark:text-blue-500 dark:hover:bg-blue-500/10 rounded transition-colors"
                                  title="Edit team"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                              <span className="text-gray-500 mx-1">vs</span>
                              <span>{t2}</span>
                              {isDoublesType && match.team2 && (
                                <button
                                  onClick={() => setEditTeamModal({
                                    isOpen: true, teamId: match.team2.id, matchId: match.id,
                                    player1Id: match.team2.player1?.id || '', player2Id: match.team2.player2?.id || '', loading: false,
                                  })}
                                  className="p-0.5 text-teal-500 hover:bg-teal-500/10 dark:text-blue-500 dark:hover:bg-blue-500/10 rounded transition-colors"
                                  title="Edit team"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                            {matchDeletionEnabled && (
                              <button
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Delete Match?',
                                    message: `Delete ${match.round}: ${t1} vs ${t2}?`,
                                    confirmText: 'Delete',
                                    cancelText: 'Cancel',
                                    type: 'danger',
                                    onConfirm: async () => {
                                      try {
                                        await matchAPI.delete(match.id);
                                        toast.success('Match deleted');
                                        await fetchMatches();
                                      } catch (error) {
                                        toast.error(error.response?.data?.message || 'Failed to delete match');
                                      }
                                    },
                                  });
                                }}
                                className="ml-3 p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete match"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
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
          const getMatchTeamName = (team) => {
            if (!team) return 'TBD';
            if (team.teamName) return team.teamName;
            const p1 = team.player1?.fullName || team.player1?.username || '';
            const p2 = team.player2?.fullName || team.player2?.username || '';
            if (p2 && p2 !== p1) return `${p1} & ${p2}`;
            return p1 || 'TBD';
          };
          const team1Name = getMatchTeamName(match.team1);
          const team2Name = getMatchTeamName(match.team2);
          const isDoubles = tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED' || tournament.format === 'CUSTOM';
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
                    {autoScoreEnabled && isRoot && match.matchStatus !== 'COMPLETED' && match.team1Id && match.team2Id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAutoScore(match.id); }}
                        disabled={autoScoringMatchId === match.id}
                        className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
                      >
                        {autoScoringMatchId === match.id ? '⏳' : '⚡ Auto'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {match.scheduledTime && (
                      <div className="text-sm text-light-text-muted dark:text-gray-400">
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
                {/* Match teams layout - stacks vertically on mobile for doubles */}
                <div className={`${isDoubles ? 'flex flex-col items-center gap-2 sm:flex-row sm:items-end sm:justify-center sm:gap-4' : 'flex items-end justify-center gap-2 sm:gap-4'} text-sm sm:text-base`}>
                  {/* TEAM 1 */}
                  <div className={`${isDoubles ? 'w-full sm:w-auto sm:flex-1' : 'flex-1'} flex ${isDoubles ? 'justify-center sm:justify-end' : 'justify-end'} font-medium ${match.matchStatus === 'COMPLETED' && match.winnerId === match.team1Id ? 'text-brand-green' : 'text-light-text-primary dark:text-white'}`}>
                    <div className="inline-flex flex-col items-center">
                      {match.matchStatus === 'COMPLETED' && match.winnerId ? (
                        match.winnerId === match.team1Id
                          ? <span className="text-xs font-bold text-brand-green mb-0.5">W</span>
                          : <span className={`text-xs font-bold invisible mb-0.5 ${isDoubles ? 'hidden sm:inline' : ''}`}>W</span>
                      ) : null}
                      {isDoubles && team1Name.includes(' & ') ? (
                        <div className="inline-flex items-center gap-1">
                          <div className="inline-flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                            <span className="font-medium px-3 py-1.5 bg-light-surface dark:bg-slate-700">{team1Name.split(' & ')[0].trim()}</span>
                            <span className="border-l border-gray-300 dark:border-gray-600 self-stretch"></span>
                            <span className="font-medium px-3 py-1.5 bg-light-surface dark:bg-slate-700">{team1Name.split(' & ')[1].trim()}</span>
                          </div>
                          {canManageStatus && match.matchStatus === 'UPCOMING' && match.team1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditTeamModal({
                                isOpen: true, teamId: match.team1.id, matchId: match.id,
                                player1Id: match.team1.player1?.id || '', player2Id: match.team1.player2?.id || '', loading: false,
                              }); }}
                              className="p-1 text-teal-500 hover:bg-teal-500/10 dark:text-blue-500 dark:hover:bg-blue-500/10 rounded transition-colors"
                              title="Edit team"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="block sm:inline">{team1Name}</span>
                      )}
                    </div>
                  </div>
                  {/* VS DIVIDER */}
                  <div className="flex flex-col items-center shrink-0">
                    {!isDoubles && match.matchStatus === 'COMPLETED' && match.winnerId && (
                      <span className="text-xs font-bold invisible mb-0.5">W</span>
                    )}
                    <div className="px-4 py-1.5 bg-gray-200 dark:bg-slate-600 rounded font-bold text-xs sm:text-sm text-light-text-primary dark:text-white">VS</div>
                  </div>
                  {/* TEAM 2 */}
                  <div className={`${isDoubles ? 'w-full sm:w-auto sm:flex-1' : 'flex-1'} flex ${isDoubles ? 'justify-center sm:justify-start' : 'justify-start'} font-medium ${match.matchStatus === 'COMPLETED' && match.winnerId === match.team2Id ? 'text-brand-green' : 'text-light-text-primary dark:text-white'}`}>
                    <div className="inline-flex flex-col items-center">
                      {match.matchStatus === 'COMPLETED' && match.winnerId ? (
                        match.winnerId === match.team2Id
                          ? <span className="text-xs font-bold text-brand-green mb-0.5">W</span>
                          : <span className={`text-xs font-bold invisible mb-0.5 ${isDoubles ? 'hidden sm:inline' : ''}`}>W</span>
                      ) : null}
                      {isDoubles && team2Name.includes(' & ') ? (
                        <div className="inline-flex items-center gap-1">
                          {canManageStatus && match.matchStatus === 'UPCOMING' && match.team2 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditTeamModal({
                                isOpen: true, teamId: match.team2.id, matchId: match.id,
                                player1Id: match.team2.player1?.id || '', player2Id: match.team2.player2?.id || '', loading: false,
                              }); }}
                              className="p-1 text-teal-500 hover:bg-teal-500/10 dark:text-blue-500 dark:hover:bg-blue-500/10 rounded transition-colors"
                              title="Edit team"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          <div className="inline-flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                            <span className="font-medium px-3 py-1.5 bg-light-surface dark:bg-slate-700">{team2Name.split(' & ')[0].trim()}</span>
                            <span className="border-l border-gray-300 dark:border-gray-600 self-stretch"></span>
                            <span className="font-medium px-3 py-1.5 bg-light-surface dark:bg-slate-700">{team2Name.split(' & ')[1].trim()}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="block sm:inline">{team2Name}</span>
                      )}
                    </div>
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
                        <span className="text-xs text-light-text-muted dark:text-gray-400 uppercase tracking-wide">Winner</span>
                        <p className="text-lg font-bold text-brand-green mt-1">{winnerName}</p>
                      </div>
                    )}

                    {/* Game Scores */}
                    {match.matchStatus === 'COMPLETED' && (team1Games.length > 0 || team2Games.length > 0) ? (
                      <div className="sm:col-span-3">
                        <span className="text-xs text-light-text-muted dark:text-gray-400 uppercase tracking-wide">Game Scores</span>
                        <div className="mt-2 flex justify-center gap-4">
                          {team1Games.map((score, idx) => (
                            <div key={idx} className="text-center">
                              <span className="text-xs text-light-text-muted dark:text-gray-400">Game {idx + 1}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`font-mono font-bold ${score > (team2Games[idx] || 0) ? 'text-brand-green' : 'text-light-text-muted dark:text-gray-400'}`}>
                                  {score}
                                </span>
                                <span className="text-gray-400">-</span>
                                <span className={`font-mono font-bold ${(team2Games[idx] || 0) > score ? 'text-brand-green' : 'text-light-text-muted dark:text-gray-400'}`}>
                                  {team2Games[idx] || 0}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : match.matchStatus === 'COMPLETED' && (
                      <div className="sm:col-span-3 text-center text-light-text-muted dark:text-gray-400 text-sm">
                        No detailed scores recorded
                      </div>
                    )}

                    {/* Match Info */}
                    <div className="text-center">
                      <span className="text-xs text-light-text-muted dark:text-gray-400 uppercase tracking-wide">{team1Name}</span>
                      <p className="font-mono font-bold text-lg text-light-text-primary dark:text-white mt-1">
                        {team1Games.reduce((a, b) => a + b, 0) || 0}
                      </p>
                      <span className="text-xs text-gray-400">points</span>
                    </div>

                    <div className="text-center">
                      <span className="text-xs text-light-text-muted dark:text-gray-400 uppercase tracking-wide">Status</span>
                      <p className="font-medium text-light-text-primary dark:text-white mt-1">{match.matchStatus}</p>
                    </div>

                    <div className="text-center">
                      <span className="text-xs text-light-text-muted dark:text-gray-400 uppercase tracking-wide">{team2Name}</span>
                      <p className="font-mono font-bold text-lg text-light-text-primary dark:text-white mt-1">
                        {team2Games.reduce((a, b) => a + b, 0) || 0}
                      </p>
                      <span className="text-xs text-gray-400">points</span>
                    </div>
                  </div>

                  {/* View Full Details Link */}
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-600 flex items-center justify-center gap-4">
                    <Link
                      to={`/matches/${match.id}`}
                      className="text-brand-green hover:text-green-600 text-sm font-medium"
                    >
                      View Full Match Details →
                    </Link>
                    {autoScoreEnabled && isRoot && match.matchStatus !== 'COMPLETED' && match.team1Id && match.team2Id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAutoScore(match.id); }}
                        disabled={autoScoringMatchId === match.id}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50"
                      >
                        {autoScoringMatchId === match.id ? 'Scoring...' : 'Auto Score'}
                      </button>
                    )}
                    {matchDeletionEnabled && canManageStatus && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const t1 = getTeamDisplayName(match.team1);
                          const t2 = getTeamDisplayName(match.team2);
                          setConfirmModal({
                            isOpen: true,
                            title: 'Delete Match?',
                            message: `Delete ${match.round}: ${t1} vs ${t2}? This cannot be undone.`,
                            confirmText: 'Delete',
                            cancelText: 'Cancel',
                            type: 'danger',
                            onConfirm: async () => {
                              try {
                                await matchAPI.delete(match.id);
                                toast.success('Match deleted');
                                await Promise.all([fetchTournamentDetails(), fetchMatches()]);
                              } catch (error) {
                                toast.error(error.response?.data?.message || 'Failed to delete match');
                              }
                            },
                          });
                        }}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };

        // Helper to render matches grouped by group (e.g. "Group A", "Group B") or round
        const hiddenRounds = Array.isArray(tournament.hiddenRounds) ? tournament.hiddenRounds : [];

        const handleToggleRoundVisibility = async (round, currentlyHidden) => {
          try {
            await tournamentAPI.toggleRoundVisibility(id, round, !currentlyHidden);
            fetchTournamentDetails();
            if (!currentlyHidden) {
              // Round is being hidden — re-fetch matches to update counts
              fetchMatches();
            }
          } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to toggle round visibility');
          }
        };

        const renderMatchesGroupedByRound = (matchList) => {
          // Group matches by group name (e.g. "Group A") or by round for non-group matches
          const grouped = matchList.reduce((acc, match) => {
            const round = match.round || '';
            const groupMatch = round.match(/^(Group\s+\w+)/);
            const key = groupMatch ? groupMatch[1] : round;
            if (!acc[key]) acc[key] = [];
            acc[key].push(match);
            return acc;
          }, {});

          const groups = Object.entries(grouped);
          const isCollapsed = (key) => collapsedRounds[key];
          const toggleGroup = (key) => setCollapsedRounds((prev) => ({ ...prev, [key]: !prev[key] }));

          return groups.map(([groupKey, groupMatches], idx) => {
            const completedCount = groupMatches.filter((m) => m.matchStatus === 'COMPLETED').length;
            const isHidden = hiddenRounds.includes(groupKey);
            return (
              <div key={groupKey} className={`${idx > 0 ? 'mt-6' : ''}`}>
                <div className={`border-2 rounded-lg overflow-hidden ${isHidden ? 'border-gray-400/50 opacity-60' : 'border-brand-green'}`}>
                  <div
                    onClick={() => toggleGroup(groupKey)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-brand-green/5 transition-colors"
                  >
                    <h3 className={`text-lg font-semibold flex items-center gap-2 ${isHidden ? 'text-gray-400' : 'text-brand-green'}`}>
                      {groupKey}
                      <span className="text-sm font-normal text-light-text-muted dark:text-gray-400">
                        ({groupMatches.length} match{groupMatches.length !== 1 ? 'es' : ''}{completedCount > 0 ? `, ${completedCount} done` : ''})
                      </span>
                      {isHidden && canManageStatus && (
                        <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Hidden</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      {canManageStatus && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleRoundVisibility(groupKey, isHidden); }}
                          className={`p-1.5 rounded-lg transition-colors ${isHidden ? 'text-amber-500 hover:bg-amber-500/10' : 'text-gray-400 hover:bg-gray-500/10'}`}
                          title={isHidden ? 'Show to players' : 'Hide from players'}
                        >
                          {isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      )}
                      {isCollapsed(groupKey) ? (
                        <ChevronDown size={20} className={`flex-shrink-0 ${isHidden ? 'text-gray-400' : 'text-brand-green'}`} />
                      ) : (
                        <ChevronUp size={20} className={`flex-shrink-0 ${isHidden ? 'text-gray-400' : 'text-brand-green'}`} />
                      )}
                    </div>
                  </div>
                  {!isCollapsed(groupKey) && (
                    <div className={`px-4 pb-4 space-y-3 border-t ${isHidden ? 'border-gray-400/30' : 'border-brand-green/30'}`}>
                      {groupMatches.map((match) => renderMatchCard(match))}
                    </div>
                  )}
                </div>
              </div>
            );
          });
        };

        return (
          <div className="space-y-4 sm:space-y-6">
            {/* Active/Upcoming Matches */}
            {activeMatches.length > 0 && (
              <div className="glass-card p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-light-text-primary dark:text-white">
                    Matches ({activeMatches.length})
                  </h2>
                  {autoScoreEnabled && isRoot && activeMatches.some(m => m.team1Id && m.team2Id) && (
                    <button
                      onClick={handleAutoScoreAll}
                      disabled={autoScoringRound === 'all'}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {autoScoringRound === 'all' ? '⏳ Scoring...' : '⚡ Auto Score All'}
                    </button>
                  )}
                </div>
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
                  <h2 className="text-xl sm:text-2xl font-bold text-light-text-primary dark:text-white flex items-center gap-3">
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
                <p className="text-light-text-muted dark:text-gray-400">
                  All matches have been completed. Click "Completed Matches" above to view results.
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* Edit Playoff Team Modal */}
      {editTeamModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-3xl"
            onClick={() => !editTeamModal.loading && setEditTeamModal(prev => ({ ...prev, isOpen: false }))}
          />
          <div className="relative glass-modal max-w-md w-full p-6 animate-scale-in">
            <button
              onClick={() => setEditTeamModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-4 right-4 text-muted hover:text-primary transition-colors p-1 hover:bg-light-surface dark:hover:bg-dark-surface rounded-lg"
              disabled={editTeamModal.loading}
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-primary mb-4">Edit Team</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">Player 1:</label>
                <select
                  value={editTeamModal.player1Id}
                  onChange={(e) => setEditTeamModal(prev => ({ ...prev, player1Id: e.target.value }))}
                  className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                  disabled={editTeamModal.loading}
                >
                  <option value="">Select player...</option>
                  {tournament?.registrations?.filter(r => r.registrationStatus === 'APPROVED').map(reg => (
                    <option key={reg.userId} value={reg.userId} disabled={reg.userId === editTeamModal.player2Id}>
                      {reg.user?.fullName || reg.user?.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1 block">Player 2:</label>
                <select
                  value={editTeamModal.player2Id}
                  onChange={(e) => setEditTeamModal(prev => ({ ...prev, player2Id: e.target.value }))}
                  className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
                  disabled={editTeamModal.loading}
                >
                  <option value="">Select player...</option>
                  {tournament?.registrations?.filter(r => r.registrationStatus === 'APPROVED').map(reg => (
                    <option key={reg.userId} value={reg.userId} disabled={reg.userId === editTeamModal.player1Id}>
                      {reg.user?.fullName || reg.user?.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditTeamModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 px-6 py-3 glass-button text-primary font-semibold"
                disabled={editTeamModal.loading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePlayoffTeam}
                disabled={!editTeamModal.player1Id || !editTeamModal.player2Id || editTeamModal.player1Id === editTeamModal.player2Id || editTeamModal.loading}
                className="flex-1 px-6 py-3 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editTeamModal.loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Declare Winners Modal */}
      {winnersModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-3xl"
            onClick={() => !winnersModal.submitting && setWinnersModal(prev => ({ ...prev, isOpen: false }))}
          />
          <div className="relative glass-modal max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setWinnersModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-4 right-4 text-muted hover:text-primary transition-colors p-1 hover:bg-light-surface dark:hover:bg-dark-surface rounded-lg"
              disabled={winnersModal.submitting}
            >
              <X size={20} />
            </button>

            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-yellow-500 bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center text-4xl">
                🏆
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center text-primary mb-2">Declare Winners</h2>
            <p className="text-center text-muted mb-4 text-sm">
              Choose how to determine the top 3 placements
            </p>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => handleWinnersModalModeSwitch('leaderboard')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  winnersModal.mode === 'leaderboard' ? 'bg-brand-blue text-white' : 'glass-button text-primary'
                }`}
                disabled={winnersModal.submitting}
              >
                From Leaderboard
              </button>
              <button
                onClick={() => handleWinnersModalModeSwitch('custom')}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  winnersModal.mode === 'custom' ? 'bg-brand-blue text-white' : 'glass-button text-primary'
                }`}
                disabled={winnersModal.submitting}
              >
                Custom Entry
              </button>
            </div>

            {winnersModal.loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner message="Loading leaderboard..." />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {winnersModal.winners.map((winner, idx) => (
                    <div key={winner.place} className="glass-surface p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">
                          {winner.place === 1 ? '🥇' : winner.place === 2 ? '🥈' : '🥉'}
                        </span>
                        <span className="font-semibold text-primary text-sm">
                          {winner.place === 1 ? '1st Place' : winner.place === 2 ? '2nd Place' : '3rd Place'}
                        </span>
                      </div>

                      {winnersModal.mode === 'custom' && tournament.partnerMode !== 'ROTATING' ? (
                        <select
                          value={winner.teamId}
                          onChange={(e) => handleWinnerTeamSelect(idx, e.target.value)}
                          className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 text-sm"
                          disabled={winnersModal.submitting}
                        >
                          <option value="">Select {winnersModal.isTeam ? 'team' : 'player'}...</option>
                          {tournament.teams
                            ?.filter(team => team.player1?.id !== team.player2?.id)
                            .map(team => {
                            const alreadySelected = winnersModal.winners.some((w, i) => i !== idx && w.teamId === team.id);
                            return (
                              <option key={team.id} value={team.id} disabled={alreadySelected}>
                                {winnersModal.isTeam
                                  ? getTeamDisplayName(team)
                                  : (team.player1?.fullName || team.player1?.username || 'Unknown')}
                              </option>
                            );
                          })}
                        </select>
                      ) : winnersModal.isTeam && tournament.partnerMode === 'ROTATING' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={winner.player1Name}
                            onChange={(e) => {
                              const updated = [...winnersModal.winners];
                              updated[idx] = { ...updated[idx], player1Name: e.target.value };
                              setWinnersModal(prev => ({ ...prev, winners: updated }));
                            }}
                            className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 text-sm"
                            disabled={winnersModal.submitting}
                          >
                            <option value="">Player 1...</option>
                            {tournament.registrations?.filter(r => r.registrationStatus === 'APPROVED').map(reg => {
                              const name = reg.user?.fullName || reg.user?.username || '';
                              return (
                                <option key={reg.userId} value={name} disabled={name === winner.player2Name}>
                                  {name}
                                </option>
                              );
                            })}
                          </select>
                          <select
                            value={winner.player2Name}
                            onChange={(e) => {
                              const updated = [...winnersModal.winners];
                              updated[idx] = { ...updated[idx], player2Name: e.target.value };
                              setWinnersModal(prev => ({ ...prev, winners: updated }));
                            }}
                            className="w-full px-3 py-2 glass-surface rounded-lg text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25 text-sm"
                            disabled={winnersModal.submitting}
                          >
                            <option value="">Player 2...</option>
                            {tournament.registrations?.filter(r => r.registrationStatus === 'APPROVED').map(reg => {
                              const name = reg.user?.fullName || reg.user?.username || '';
                              return (
                                <option key={reg.userId} value={name} disabled={name === winner.player1Name}>
                                  {name}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : winnersModal.isTeam ? (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Player 1 name"
                            value={winner.player1Name}
                            onChange={(e) => {
                              const updated = [...winnersModal.winners];
                              updated[idx] = { ...updated[idx], player1Name: e.target.value };
                              setWinnersModal(prev => ({ ...prev, winners: updated }));
                            }}
                            className="w-full px-3 py-2 glass-surface rounded-lg text-primary focus:ring-2 focus:ring-brand-blue/25 placeholder:text-muted text-sm"
                            disabled={winnersModal.submitting}
                          />
                          <input
                            type="text"
                            placeholder="Player 2 name"
                            value={winner.player2Name}
                            onChange={(e) => {
                              const updated = [...winnersModal.winners];
                              updated[idx] = { ...updated[idx], player2Name: e.target.value };
                              setWinnersModal(prev => ({ ...prev, winners: updated }));
                            }}
                            className="w-full px-3 py-2 glass-surface rounded-lg text-primary focus:ring-2 focus:ring-brand-blue/25 placeholder:text-muted text-sm"
                            disabled={winnersModal.submitting}
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Player name"
                          value={winner.name}
                          onChange={(e) => {
                            const updated = [...winnersModal.winners];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setWinnersModal(prev => ({ ...prev, winners: updated }));
                          }}
                          className="w-full px-3 py-2 glass-surface rounded-lg text-primary focus:ring-2 focus:ring-brand-blue/25 placeholder:text-muted text-sm"
                          disabled={winnersModal.submitting}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setWinnersModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 px-6 py-3 glass-button text-primary font-semibold"
                    disabled={winnersModal.submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmWinners}
                    disabled={winnersModal.submitting}
                    className="flex-1 px-6 py-3 bg-brand-green hover:bg-green-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {winnersModal.submitting ? 'Declaring...' : 'Confirm Winners'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {addPlayerModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-light-text-primary dark:text-white mb-4">
              Register Player
            </h3>
            <div>
              <label className="block text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1">
                Player
              </label>
              <select
                value={addPlayerModal.playerId}
                onChange={(e) => setAddPlayerModal(prev => ({ ...prev, playerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
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
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-light-text-muted dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
            <h3 className="text-xl font-bold text-light-text-primary dark:text-white mb-4">
              Register Team
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1">
                  Player 1
                </label>
                <select
                  value={addTeamModal.player1Id}
                  onChange={(e) => setAddTeamModal(prev => ({ ...prev, player1Id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
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
                <label className="block text-sm font-medium text-light-text-muted dark:text-gray-300 mb-1">
                  Player 2
                </label>
                <select
                  value={addTeamModal.player2Id}
                  onChange={(e) => setAddTeamModal(prev => ({ ...prev, player2Id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-blue/25"
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
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-light-text-muted dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
