import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournamentAPI } from '../../services/api';
import { Button, LoadingSpinner } from '../common';
import { Trophy, Users, ChevronRight } from 'lucide-react';

const GroupStageView = ({ tournament, matches, isOrganizer, onGroupStageComplete }) => {
  const navigate = useNavigate();
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (tournament?.format === 'GROUP_KNOCKOUT') {
      fetchGroupStandings();
    }
  }, [tournament?.id, matches]);

  const fetchGroupStandings = async () => {
    try {
      const response = await tournamentAPI.getGroupStandings(tournament.id);
      setStandings(response.data.data);
    } catch (error) {
      console.error('Error fetching group standings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteGroupStage = async () => {
    setCompleting(true);
    try {
      await tournamentAPI.completeGroupStage(tournament.id);
      if (onGroupStageComplete) {
        onGroupStageComplete();
      }
    } catch (error) {
      console.error('Error completing group stage:', error);
      alert(error.response?.data?.message || 'Failed to complete group stage');
    } finally {
      setCompleting(false);
    }
  };

  const getTeamName = (team) => {
    if (!team) return 'TBD';
    if (team.teamName) return team.teamName;
    const player1Name = team.player1?.fullName || team.player1?.username || 'Unknown';
    if (team.player2 && team.player2.id !== team.player1?.id) {
      const player2Name = team.player2?.fullName || team.player2?.username;
      return `${player1Name} & ${player2Name}`;
    }
    return player1Name;
  };

  const getGroupMatches = (groupName) => {
    return matches.filter((match) => match.round?.includes(`Group ${groupName}`));
  };

  const isAllGroupMatchesComplete = () => {
    const groupMatches = matches.filter((match) => match.round?.includes('Group'));
    return groupMatches.length > 0 && groupMatches.every((match) => match.matchStatus === 'COMPLETED');
  };

  if (loading) {
    return <LoadingSpinner message="Loading group standings..." />;
  }

  if (!standings) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No group standings available yet.
      </div>
    );
  }

  const groupNames = Object.keys(standings.standings || {}).sort();

  return (
    <div className="space-y-6">
      {/* Group Stage Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="text-brand-green" size={24} />
            Group Stage
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {standings.numberOfGroups} groups, top {standings.advancingPerGroup} from each advance
          </p>
        </div>

        {isOrganizer && !standings.groupStageComplete && isAllGroupMatchesComplete() && (
          <Button
            onClick={handleCompleteGroupStage}
            loading={completing}
            disabled={completing}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Trophy size={18} />
            Complete Group Stage & Generate Knockout
          </Button>
        )}

        {standings.groupStageComplete && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
            <Trophy size={18} />
            <span className="font-medium">Group Stage Complete</span>
          </div>
        )}
      </div>

      {/* Group Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        {groupNames.map((groupName) => {
          const groupTeams = standings.standings[groupName] || [];
          const groupMatches = getGroupMatches(groupName);
          const advancingCount = standings.advancingPerGroup || 2;

          return (
            <div key={groupName} className="glass-card overflow-hidden">
              <div className="bg-gradient-to-r from-brand-green/20 to-transparent p-4 border-b border-border">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Group {groupName}
                </h3>
              </div>

              {/* Standings Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-xs text-gray-500 dark:text-gray-400">
                      <th className="text-left py-2 px-3">#</th>
                      <th className="text-left py-2 px-3">Player/Team</th>
                      <th className="text-center py-2 px-2">P</th>
                      <th className="text-center py-2 px-2">W</th>
                      <th className="text-center py-2 px-2">L</th>
                      <th className="text-center py-2 px-2">+/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupTeams.map((stat, index) => {
                      const isAdvancing = index < advancingCount;
                      return (
                        <tr
                          key={stat.team.id}
                          className={`border-b border-border/50 ${
                            isAdvancing
                              ? 'bg-green-50 dark:bg-green-900/10'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            <span
                              className={`font-semibold ${
                                isAdvancing ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                              }`}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-white text-sm">
                            {getTeamName(stat.team)}
                            {isAdvancing && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-400">Q</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-600 dark:text-gray-400 text-sm">
                            {stat.matchesPlayed}
                          </td>
                          <td className="py-2 px-2 text-center text-green-600 dark:text-green-400 font-semibold text-sm">
                            {stat.wins}
                          </td>
                          <td className="py-2 px-2 text-center text-red-500 text-sm">
                            {stat.losses}
                          </td>
                          <td
                            className={`py-2 px-2 text-center font-semibold text-sm ${
                              stat.pointsFor - stat.pointsAgainst > 0
                                ? 'text-green-600 dark:text-green-400'
                                : stat.pointsFor - stat.pointsAgainst < 0
                                ? 'text-red-500'
                                : 'text-gray-500'
                            }`}
                          >
                            {stat.pointsFor - stat.pointsAgainst > 0 ? '+' : ''}
                            {stat.pointsFor - stat.pointsAgainst}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Group Matches */}
              <div className="p-4 border-t border-border">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Matches
                </h4>
                <div className="space-y-2">
                  {groupMatches.map((match) => {
                    const isComplete = match.matchStatus === 'COMPLETED';
                    const isLive = match.matchStatus === 'LIVE';

                    return (
                      <div
                        key={match.id}
                        onClick={() => navigate(`/matches/${match.id}`)}
                        className={`p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.01] ${
                          isLive
                            ? 'bg-brand-green/10 border border-brand-green/30'
                            : isComplete
                            ? 'bg-gray-50 dark:bg-slate-800/50'
                            : 'bg-gray-50 dark:bg-slate-700/30 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className={`font-medium ${match.winnerId === match.team1Id ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                {getTeamName(match.team1)}
                              </span>
                              {isComplete && match.team1Score && (
                                <span className="font-mono text-xs ml-2">
                                  {match.team1Score.games?.join('-') || '-'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between text-sm mt-1">
                              <span className={`font-medium ${match.winnerId === match.team2Id ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                                {getTeamName(match.team2)}
                              </span>
                              {isComplete && match.team2Score && (
                                <span className="font-mono text-xs ml-2">
                                  {match.team2Score.games?.join('-') || '-'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-3 flex items-center text-right">
                            {isLive ? (
                              <span className="text-brand-green text-xs font-semibold animate-pulse">LIVE</span>
                            ) : isComplete ? (
                              <div className="flex flex-col items-end">
                                <span className="text-gray-400 text-xs">Final</span>
                                <span className="text-brand-green text-[10px] font-medium">
                                  {match.winnerId === match.team1Id
                                    ? getTeamName(match.team1)
                                    : getTeamName(match.team2)}
                                </span>
                              </div>
                            ) : (
                              <ChevronRight size={16} className="text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {groupMatches.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      No matches scheduled
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Knockout Stage Preview */}
      {standings.groupStageComplete && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-500" size={20} />
            Knockout Stage
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Knockout matches have been generated. View the matches below.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-4">
        <span><span className="text-green-600 dark:text-green-400 font-semibold">Q</span> = Qualified for knockout</span>
        <span>P = Played | W = Wins | L = Losses | +/- = Point Differential</span>
      </div>
    </div>
  );
};

export default GroupStageView;
