import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { matchAPI, tournamentAPI, userAPI } from '../../services/api';
import socketService from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useFeatureFlag } from '../../context/FeatureFlagContext';
import { LoadingSpinner, StatusBadge, ConfirmationModal, Button } from '../../components/common';
import { PlayCircle, Pencil, UserX, AlertTriangle, UserPlus, Search, X } from 'lucide-react';

const MatchDetails = () => {
  const { id } = useParams();
  const { dbUser, isOrganizer } = useAuth();
  const toast = useToast();
  const liveScoringEnabled = useFeatureFlag('live_scoring');
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [walkoverModal, setWalkoverModal] = useState({
    isOpen: false,
    noShowTeamId: null,
    noShowTeamName: '',
    winnerId: null,
  });
  const [replaceModal, setReplaceModal] = useState({
    isOpen: false,
    teamToReplaceId: null,
    teamToReplaceName: '',
  });
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);

  // Check if user is a player in this match
  const isMatchParticipant = dbUser && match && (
    match.team1?.player1Id === dbUser.id ||
    match.team1?.player2Id === dbUser.id ||
    match.team2?.player1Id === dbUser.id ||
    match.team2?.player2Id === dbUser.id
  );

  // Check if user can score based on tournament settings
  const scoringPermission = match?.tournament?.scoringPermission || 'ANYONE';
  const canScore = dbUser &&
    match?.tournament?.status === 'ACTIVE' &&
    (isOrganizer ||
      scoringPermission === 'ANYONE' ||
      (scoringPermission === 'PARTICIPANTS' && isMatchParticipant));

  useEffect(() => {
    fetchMatch();

    // Connect socket and join match room
    socketService.connect();
    socketService.joinMatch(id);

    // Listen for real-time updates
    socketService.onMatchScoreUpdate((updatedMatch) => {
      if (updatedMatch.id === id) {
        setMatch((prev) => prev ? { ...prev, ...updatedMatch } : prev);
      }
    });

    socketService.onMatchStarted(() => {
      fetchMatch();
    });

    socketService.onMatchCompleted(() => {
      fetchMatch();
    });

    socketService.onMatchWalkover(() => {
      fetchMatch();
    });

    socketService.on('match:updated', () => {
      fetchMatch();
    });

    return () => {
      socketService.leaveMatch(id);
      socketService.off('match:scoreUpdate');
      socketService.off('match:started');
      socketService.off('match:completed');
      socketService.off('match:walkover');
      socketService.off('match:updated');
    };
  }, [id]);

  const fetchMatch = async () => {
    try {
      const response = await matchAPI.getById(id);
      setMatch(response.data.data);
    } catch (error) {
      // Silently fail
    } finally {
      setLoading(false);
    }
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

  const formatScore = (score) => {
    if (!score) return '-';
    if (typeof score === 'string') {
      try {
        score = JSON.parse(score);
      } catch {
        return score;
      }
    }
    if (Array.isArray(score)) {
      return score.join(', ');
    }
    return JSON.stringify(score);
  };

  const getTeamName = (team) => {
    const player1Name = team.player1.fullName || team.player1.username;
    // For singles tournaments, player1 and player2 are the same person
    // Check if player2 exists and is different from player1
    if (team.player2 && team.player2.id !== team.player1.id) {
      const player2Name = team.player2.fullName || team.player2.username;
      return `${player1Name} & ${player2Name}`;
    }
    return player1Name;
  };

  const handleWalkoverClick = (noShowTeamId, winnerId) => {
    const noShowTeam = noShowTeamId === match.team1Id ? match.team1 : match.team2;
    setWalkoverModal({
      isOpen: true,
      noShowTeamId,
      noShowTeamName: getTeamName(noShowTeam),
      winnerId,
    });
  };

  const handleWalkoverConfirm = async () => {
    try {
      await matchAPI.walkover(id, {
        winnerId: walkoverModal.winnerId,
        noShowTeamId: walkoverModal.noShowTeamId,
        reason: 'NO_SHOW',
      });
      toast.success('Walkover awarded successfully');
      setWalkoverModal({ isOpen: false, noShowTeamId: null, noShowTeamName: '', winnerId: null });
      fetchMatch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to award walkover');
    }
  };

  const getWalkoverReasonLabel = (reason) => {
    const labels = {
      NO_SHOW: 'No Show',
      FORFEIT: 'Forfeit',
      INJURY: 'Injury',
      DISQUALIFICATION: 'Disqualification',
    };
    return labels[reason] || reason;
  };

  const handleReplaceClick = (teamToReplaceId) => {
    const teamToReplace = teamToReplaceId === match.team1Id ? match.team1 : match.team2;
    setReplaceModal({
      isOpen: true,
      teamToReplaceId,
      teamToReplaceName: getTeamName(teamToReplace),
    });
    setUserSearch('');
    setSearchResults([]);
  };

  const handleUserSearch = async (query) => {
    setUserSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await userAPI.getAll({ search: query, limit: 10 });
      // Filter out users already in this match
      const existingUserIds = [
        match.team1.player1.id,
        match.team1.player2?.id,
        match.team2.player1.id,
        match.team2.player2?.id,
      ].filter(Boolean);

      const filteredResults = response.data.data.filter(
        user => !existingUserIds.includes(user.id)
      );
      setSearchResults(filteredResults);
    } catch (error) {
      toast.error('Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleReplaceConfirm = async (newUserId) => {
    setReplacing(true);
    try {
      await tournamentAPI.replaceTeam(match.tournament.id, id, {
        teamToReplaceId: replaceModal.teamToReplaceId,
        newUserId,
      });
      toast.success('Player replaced successfully');
      setReplaceModal({ isOpen: false, teamToReplaceId: null, teamToReplaceName: '' });
      setUserSearch('');
      setSearchResults([]);
      fetchMatch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to replace player');
    } finally {
      setReplacing(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading match..." />;
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl text-red-600 dark:text-red-400">Match not found</p>
        </div>
      </div>
    );
  }

  const isLive = match.matchStatus === 'LIVE';

  return (
    <div className="w-full">
      <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
        <Link
          to={`/tournaments/${match.tournament.id}`}
          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium mb-4 transition-colors"
        >
          ← Back to Tournament
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-white">
          {match.tournament.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-semibold">
              {match.round}
            </span>
            <StatusBadge status={match.matchStatus} />
          </div>

          {/* Live Score Button for Organizers and Players in the match */}
          {liveScoringEnabled && canScore && (match.matchStatus === 'UPCOMING' || match.matchStatus === 'LIVE' || match.matchStatus === 'COMPLETED') && (
            <Link
              to={`/matches/${id}/live-score`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-green to-green-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all"
            >
              {match.matchStatus === 'COMPLETED' ? <Pencil size={18} /> : <PlayCircle size={18} />}
              {match.matchStatus === 'COMPLETED' ? 'Edit Scores' : match.matchStatus === 'LIVE' ? 'Continue Scoring' : 'Start Live Scoring'}
            </Link>
          )}

          {/* Message when tournament not started */}
          {dbUser && match?.tournament?.status !== 'ACTIVE' && match.matchStatus !== 'COMPLETED' && (
            <div className="text-sm text-amber-600 dark:text-amber-400">
              Tournament not started yet. Scoring will be available once the tournament begins.
            </div>
          )}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div
            className={`p-4 sm:p-6 rounded-lg ${
              match.winnerId === match.team1Id
                ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                : 'bg-gray-50 dark:bg-slate-700'
            }`}
          >
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Team 1</h2>
            <div className="mb-3">
              <div className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                {match.team1.player1.fullName || match.team1.player1.username}
              </div>
              {match.team1.player2 && match.team1.player2.id !== match.team1.player1.id && (
                <div className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                  {match.team1.player2.fullName || match.team1.player2.username}
                </div>
              )}
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              {formatScore(match.team1Score)}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="px-4 sm:px-6 py-2 bg-gray-200 dark:bg-slate-600 rounded-lg font-bold text-gray-900 dark:text-white text-lg sm:text-xl">
              VS
            </div>
          </div>

          <div
            className={`p-4 sm:p-6 rounded-lg ${
              match.winnerId === match.team2Id
                ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                : 'bg-gray-50 dark:bg-slate-700'
            }`}
          >
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Team 2</h2>
            <div className="mb-3">
              <div className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                {match.team2.player1.fullName || match.team2.player1.username}
              </div>
              {match.team2.player2 && match.team2.player2.id !== match.team2.player1.id && (
                <div className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                  {match.team2.player2.fullName || match.team2.player2.username}
                </div>
              )}
            </div>
            <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              {formatScore(match.team2Score)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {match.scheduledTime && (
          <div className="glass-card p-4">
            <strong className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Scheduled Time:
            </strong>
            <span className="text-gray-900 dark:text-white">{formatDate(match.scheduledTime)}</span>
          </div>
        )}

        {match.courtNumber && (
          <div className="glass-card p-4">
            <strong className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Court:
            </strong>
            <span className="text-gray-900 dark:text-white">Court {match.courtNumber}</span>
          </div>
        )}

        {match.startTime && (
          <div className="glass-card p-4">
            <strong className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Start Time:
            </strong>
            <span className="text-gray-900 dark:text-white">{formatDate(match.startTime)}</span>
          </div>
        )}

        {match.endTime && (
          <div className="glass-card p-4">
            <strong className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
              End Time:
            </strong>
            <span className="text-gray-900 dark:text-white">{formatDate(match.endTime)}</span>
          </div>
        )}

        {match.winnerId && (
          <div className={`rounded-lg shadow p-4 sm:col-span-2 border-l-4 ${
            match.isWalkover
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-500'
              : 'bg-green-50 dark:bg-green-900/20 border-green-500'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className={`block text-sm font-semibold mb-1 ${
                  match.isWalkover
                    ? 'text-orange-700 dark:text-orange-400'
                    : 'text-green-700 dark:text-green-400'
                }`}>
                  Winner {match.isWalkover && '(Walkover)'}:
                </strong>
                <span className={`text-lg font-bold ${
                  match.isWalkover
                    ? 'text-orange-900 dark:text-orange-200'
                    : 'text-green-900 dark:text-green-200'
                }`}>
                  {match.winnerId === match.team1Id
                    ? getTeamName(match.team1)
                    : getTeamName(match.team2)}
                </span>
              </div>
              {match.isWalkover && match.walkoverReason && (
                <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 dark:bg-orange-900/40 rounded-full">
                  <UserX size={16} className="text-orange-600 dark:text-orange-400" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {getWalkoverReasonLabel(match.walkoverReason)}
                  </span>
                </div>
              )}
            </div>
            {match.isWalkover && match.noShowTeamId && (
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                {match.noShowTeamId === match.team1Id
                  ? getTeamName(match.team1)
                  : getTeamName(match.team2)} did not show up
              </p>
            )}
          </div>
        )}
      </div>

      {isLive && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 dark:text-red-400 text-xl animate-pulse">●</span>
            <span className="text-red-800 dark:text-red-200 font-medium text-sm sm:text-base">
              This match is currently in progress. Scores update in real-time.
            </span>
          </div>
        </div>
      )}

      {/* Walkover & Replace Section for Organizers */}
      {isOrganizer && (match.matchStatus === 'UPCOMING' || match.matchStatus === 'LIVE') && !match.isWalkover && (
        <div className="glass-card p-4 sm:p-6 space-y-6">
          {/* Walkover Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-orange-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Award Walkover
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              If a player/team did not show up, you can award a walkover to the other team.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleWalkoverClick(match.team1Id, match.team2Id)}
                className="flex items-center justify-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-900/20"
              >
                <UserX size={18} />
                {getTeamName(match.team1)} No Show
              </Button>
              <Button
                variant="outline"
                onClick={() => handleWalkoverClick(match.team2Id, match.team1Id)}
                className="flex items-center justify-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-900/20"
              >
                <UserX size={18} />
                {getTeamName(match.team2)} No Show
              </Button>
            </div>
          </div>

          {/* Replace Player Section */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="text-blue-500" size={20} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Replace No-Show Player
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              If a player didn't show up and a late player wants to take their place, you can replace them.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleReplaceClick(match.team1Id)}
                className="flex items-center justify-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <UserPlus size={18} />
                Replace {getTeamName(match.team1)}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleReplaceClick(match.team2Id)}
                className="flex items-center justify-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <UserPlus size={18} />
                Replace {getTeamName(match.team2)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Walkover Confirmation Modal */}
      <ConfirmationModal
        isOpen={walkoverModal.isOpen}
        onClose={() => setWalkoverModal({ isOpen: false, noShowTeamId: null, noShowTeamName: '', winnerId: null })}
        onConfirm={handleWalkoverConfirm}
        title="Confirm Walkover"
        message={`Are you sure you want to mark "${walkoverModal.noShowTeamName}" as no-show? The opponent will be awarded the match.`}
        confirmText="Award Walkover"
        type="warning"
      />

      {/* Replace Player Modal */}
      {replaceModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setReplaceModal({ isOpen: false, teamToReplaceId: null, teamToReplaceName: '' })} />
          <div className="relative glass-card rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Replace Player
                </h2>
                <button
                  onClick={() => setReplaceModal({ isOpen: false, teamToReplaceId: null, teamToReplaceName: '' })}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Replacing: <span className="font-semibold text-gray-900 dark:text-white">{replaceModal.teamToReplaceName}</span>
              </p>
            </div>

            <div className="p-6">
              <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for a player by name or username..."
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
                  autoFocus
                />
              </div>

              <div className="max-h-64 overflow-y-auto">
                {searchLoading ? (
                  <LoadingSpinner message="Searching..." />
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleReplaceConfirm(user.id)}
                        disabled={replacing}
                        className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            {(user.fullName || user.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {user.fullName || user.username}
                          </p>
                          {user.fullName && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              @{user.username}
                            </p>
                          )}
                        </div>
                        <UserPlus size={18} className="text-blue-500" />
                      </button>
                    ))}
                  </div>
                ) : userSearch.length >= 2 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <UserX size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No players found</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Search size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Type at least 2 characters to search</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchDetails;
