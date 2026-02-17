import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { matchAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner, Button } from '../../components/common';
import { ArrowLeft, Save } from 'lucide-react';

const LiveScoring = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dbUser, isOrganizer } = useAuth();
  const toast = useToast();

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualScores, setManualScores] = useState({
    game1: { team1: '0', team2: '0' },
    game2: { team1: '0', team2: '0' },
    game3: { team1: '0', team2: '0' },
  });

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
  }, [id]);

  // Check authorization after match is loaded
  useEffect(() => {
    if (!loading && match) {
      if (!dbUser) {
        toast.error('You must be logged in to score matches');
        navigate(`/matches/${id}`);
      } else if (match.tournament?.status !== 'ACTIVE') {
        toast.error('Tournament has not started yet. Please start the tournament first.');
        navigate(`/matches/${id}`);
      } else if (!isOrganizer) {
        const perm = match.tournament?.scoringPermission || 'ANYONE';
        if (perm === 'ORGANIZERS') {
          toast.error('Only organizers can update scores for this tournament');
          navigate(`/matches/${id}`);
        } else if (perm === 'PARTICIPANTS' && !isMatchParticipant) {
          toast.error('Only tournament participants and organizers can update scores');
          navigate(`/matches/${id}`);
        }
      }
    }
  }, [loading, match, dbUser, isOrganizer, isMatchParticipant, navigate, id, toast]);

  const fetchMatch = async () => {
    try {
      const response = await matchAPI.getById(id);
      if (response.data.success) {
        const matchData = response.data.data;
        setMatch(matchData);

        // Pre-populate scores if they exist
        if (matchData.team1Score && matchData.team2Score) {
          const team1Scores = matchData.team1Score.split(',');
          const team2Scores = matchData.team2Score.split(',');

          const newScores = {
            game1: {
              team1: team1Scores[0] || '0',
              team2: team2Scores[0] || '0'
            },
            game2: {
              team1: team1Scores[1] || '0',
              team2: team2Scores[1] || '0'
            },
            game3: {
              team1: team1Scores[2] || '0',
              team2: team2Scores[2] || '0'
            },
          };

          setManualScores(newScores);
        }
      }
    } catch (error) {
      toast.error('Failed to load match');
    } finally {
      setLoading(false);
    }
  };

  const saveManualScores = async () => {
    setIsProcessing(true);
    try {
      // Build the games array from manual scores
      const games = [];
      let team1Wins = 0;
      let team2Wins = 0;

      // Game 1
      if (manualScores.game1.team1 !== '' && manualScores.game1.team2 !== '') {
        const g1t1 = parseInt(manualScores.game1.team1);
        const g1t2 = parseInt(manualScores.game1.team2);
        games.push({ team1: g1t1, team2: g1t2 });
        if (g1t1 > g1t2) team1Wins++;
        else if (g1t2 > g1t1) team2Wins++;
        // If equal, neither wins the game
      }

      // Game 2
      if (manualScores.game2.team1 !== '' && manualScores.game2.team2 !== '') {
        const g2t1 = parseInt(manualScores.game2.team1);
        const g2t2 = parseInt(manualScores.game2.team2);
        games.push({ team1: g2t1, team2: g2t2 });
        if (g2t1 > g2t2) team1Wins++;
        else if (g2t2 > g2t1) team2Wins++;
      }

      // Game 3
      if (manualScores.game3.team1 !== '' && manualScores.game3.team2 !== '') {
        const g3t1 = parseInt(manualScores.game3.team1);
        const g3t2 = parseInt(manualScores.game3.team2);
        games.push({ team1: g3t1, team2: g3t2 });
        if (g3t1 > g3t2) team1Wins++;
        else if (g3t2 > g3t1) team2Wins++;
      }

      if (games.length === 0) {
        toast.error('Please enter at least one game score');
        setIsProcessing(false);
        return;
      }

      // Determine winner - must have a clear winner
      let winnerId;
      if (team1Wins > team2Wins) {
        winnerId = match.team1Id;
      } else if (team2Wins > team1Wins) {
        winnerId = match.team2Id;
      } else {
        // Tie - shouldn't happen in badminton, but handle gracefully
        toast.error('Match is tied. Please enter a deciding game.');
        setIsProcessing(false);
        return;
      }
      const requestData = {
        team1Score: games.map(g => g.team1).join(','),
        team2Score: games.map(g => g.team2).join(','),
        winnerId,
        matchStatus: 'COMPLETED',
      };

      // Update match with manual scores
      const response = await matchAPI.updateScore(id, requestData);

      if (response.data.success) {
        const message = match.matchStatus === 'COMPLETED'
          ? 'Match scores updated successfully!'
          : 'Match scores saved successfully!';
        toast.success(message);
        setTimeout(() => navigate(`/matches/${id}`), 1500);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save scores');
    } finally {
      setIsProcessing(false);
    }
  };

  const getTeamName = (team) => {
    if (!team) return 'Unknown';
    if (team.teamName) return team.teamName;
    if (team.player1?.id === team.player2?.id) {
      return team.player1?.fullName || team.player1?.username || 'Unknown';
    }
    return `${team.player1?.fullName || team.player1?.username} / ${team.player2?.fullName || team.player2?.username}`;
  };

  if (loading) {
    return <LoadingSpinner fullScreen size="lg" message="Loading match..." />;
  }

  if (!match) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          <p>Failed to load match</p>
          <button
            onClick={() => navigate(`/matches/${id}`)}
            className="mt-4 px-6 py-2 bg-brand-green text-white rounded-lg"
          >
            Back to Match
          </button>
        </div>
      </div>
    );
  }

  const team1Name = getTeamName(match.team1);
  const team2Name = getTeamName(match.team2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-card-dark/20 pb-8">
      {/* Header */}
      <div className="glass-card sticky top-0 z-10 border-b border-border/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/matches/${id}`)}
              className="flex items-center gap-2 text-muted hover:text-brand-green transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Match</span>
            </button>
            <div className="text-center">
              <p className="text-sm text-muted">Score Entry</p>
              <p className="text-xs text-muted">{match.tournament?.name}</p>
            </div>
            <div className="w-20"></div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Match Info */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-xl font-bold text-center mb-4 text-brand-green">{match.round}</h2>
          <div className="grid grid-cols-2 gap-6 text-center">
            <div className="p-4 glass-surface rounded-lg">
              <p className="text-muted text-sm mb-2">Team 1</p>
              <p className="font-semibold text-lg">{team1Name}</p>
            </div>
            <div className="p-4 glass-surface rounded-lg">
              <p className="text-muted text-sm mb-2">Team 2</p>
              <p className="font-semibold text-lg">{team2Name}</p>
            </div>
          </div>
        </div>

        {/* Manual Score Entry Form */}
        <div className="glass-card p-6 border border-brand-green/30">
          <h3 className="text-xl font-bold text-center mb-2">
            {match?.matchStatus === 'COMPLETED' ? 'Edit Match Scores' : 'Enter Match Scores'}
          </h3>
          <p className="text-sm text-muted text-center mb-6">
            {match?.matchStatus === 'COMPLETED'
              ? 'Update the scores below to correct any mistakes.'
              : 'Enter the final score for each game. Leave Game 3 empty for 2-game matches.'}
          </p>

          {/* Game 1 */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-muted mb-3">Game 1 *</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1 truncate">{team1Name}</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualScores.game1.team1}
                  onChange={(e) => setManualScores({
                    ...manualScores,
                    game1: { ...manualScores.game1, team1: e.target.value }
                  })}
                  placeholder="0"
                  className="w-full px-4 py-3 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors text-center text-2xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1 truncate">{team2Name}</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualScores.game1.team2}
                  onChange={(e) => setManualScores({
                    ...manualScores,
                    game1: { ...manualScores.game1, team2: e.target.value }
                  })}
                  placeholder="0"
                  className="w-full px-4 py-3 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors text-center text-2xl font-bold"
                />
              </div>
            </div>
          </div>

          {/* Game 2 */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-muted mb-3">Game 2 *</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1 truncate">{team1Name}</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualScores.game2.team1}
                  onChange={(e) => setManualScores({
                    ...manualScores,
                    game2: { ...manualScores.game2, team1: e.target.value }
                  })}
                  placeholder="0"
                  className="w-full px-4 py-3 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors text-center text-2xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1 truncate">{team2Name}</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualScores.game2.team2}
                  onChange={(e) => setManualScores({
                    ...manualScores,
                    game2: { ...manualScores.game2, team2: e.target.value }
                  })}
                  placeholder="0"
                  className="w-full px-4 py-3 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors text-center text-2xl font-bold"
                />
              </div>
            </div>
          </div>

          {/* Game 3 */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-muted mb-3">Game 3 (Optional)</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1 truncate">{team1Name}</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualScores.game3.team1}
                  onChange={(e) => setManualScores({
                    ...manualScores,
                    game3: { ...manualScores.game3, team1: e.target.value }
                  })}
                  placeholder="0"
                  className="w-full px-4 py-3 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors text-center text-2xl font-bold"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1 truncate">{team2Name}</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={manualScores.game3.team2}
                  onChange={(e) => setManualScores({
                    ...manualScores,
                    game3: { ...manualScores.game3, team2: e.target.value }
                  })}
                  placeholder="0"
                  className="w-full px-4 py-3 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors text-center text-2xl font-bold"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={saveManualScores}
            disabled={isProcessing}
            variant="success"
            size="lg"
            className="w-full text-lg"
          >
            <Save size={20} />
            {isProcessing
              ? 'Saving...'
              : match?.matchStatus === 'COMPLETED'
              ? 'Update Scores'
              : 'Save & Complete Match'}
          </Button>
          <p className="text-xs text-muted text-center mt-3">
            {match?.matchStatus === 'COMPLETED'
              ? 'This will update the match scores'
              : 'This will save the scores and mark the match as completed'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiveScoring;
