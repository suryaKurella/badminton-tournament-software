import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tournamentAPI, matchAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button, LoadingSpinner } from '../common';
import { Trophy, Users, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

const GroupStageView = ({ tournament, matches, isOrganizer, onGroupStageComplete }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [advancingPerGroup, setAdvancingPerGroup] = useState(tournament?.advancingPerGroup || 2);
  const [createMatchData, setCreateMatchData] = useState({ team1Id: '', team2Id: '', round: '' });

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
      await tournamentAPI.completeGroupStage(tournament.id, { advancingPerGroup });
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

  const toggleGroup = (groupName) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const toggleAllGroups = (names) => {
    const allCollapsed = names.length > 0 && names.every((g) => collapsedGroups[g]);
    const newState = {};
    names.forEach((g) => {
      newState[g] = !allCollapsed;
    });
    setCollapsedGroups(newState);
  };

  const isAllGroupMatchesComplete = () => {
    const groupMatches = matches.filter((match) => match.round?.includes('Group'));
    return groupMatches.length > 0 && groupMatches.every((match) => match.matchStatus === 'COMPLETED');
  };

  const getTeamDisplayName = (team) => {
    if (!team) return 'Unknown';
    const p1 = team.player1?.fullName || team.player1?.username || 'Unknown';
    if (team.player2 && team.player2.id !== team.player1?.id) {
      const p2 = team.player2?.fullName || team.player2?.username;
      return `${p1} & ${p2}`;
    }
    return p1;
  };

  const handleCreateMatch = async () => {
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
        tournamentId: tournament.id,
        team1Id: createMatchData.team1Id,
        team2Id: createMatchData.team2Id,
        round: createMatchData.round || 'Custom Match',
      });
      toast.success('Match created successfully');
      setCreateMatchData({ team1Id: '', team2Id: '', round: '' });
      if (onGroupStageComplete) onGroupStageComplete();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create match');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading group standings..." />;
  }

  if (!standings) {
    return (
      <div className="text-center py-8 text-light-text-muted dark:text-gray-400">
        No group standings available yet.
      </div>
    );
  }

  const groupNames = Object.keys(standings.standings || {}).sort();

  const renderGroupContent = (groupName, groupTeams, groupMatches, advancingCount) => {
    if (collapsedGroups[groupName]) return null;
    return (
      <div>
        {/* Standings Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-light-text-muted dark:text-gray-400">
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
                const isInQualifyingPosition = index < advancingCount;
                const hasPlayedMatches = stat.matchesPlayed > 0;
                const showQualified = isInQualifyingPosition && hasPlayedMatches;
                return (
                  <tr
                    key={stat.team.id}
                    className={`border-b border-border/50 ${
                      showQualified ? 'bg-green-50 dark:bg-green-900/10' : ''
                    }`}
                  >
                    <td className="py-2 px-3">
                      <span
                        className={`font-semibold ${
                          showQualified ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-medium text-light-text-primary dark:text-white text-sm">
                      {getTeamName(stat.team)}
                      {showQualified && (
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
                      : 'bg-light-surface dark:bg-slate-700/30 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`font-medium ${match.winnerId === match.team1Id ? 'text-green-600 dark:text-green-400' : 'text-light-text-primary dark:text-white'}`}>
                          {getTeamName(match.team1)}
                        </span>
                        {isComplete && match.team1Score && (
                          <span className="font-mono text-xs ml-2">
                            {match.team1Score.games?.join('-') || '-'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className={`font-medium ${match.winnerId === match.team2Id ? 'text-green-600 dark:text-green-400' : 'text-light-text-primary dark:text-white'}`}>
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
              <p className="text-sm text-light-text-muted dark:text-gray-400 text-center py-2">
                No matches scheduled
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Group Stage Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-light-text-primary dark:text-white flex items-center gap-2">
            <Users className="text-brand-green" size={24} />
            Group Stage
          </h2>
          <p className="text-sm text-light-text-muted dark:text-gray-400 mt-1">
            {standings.numberOfGroups} groups, top {standings.groupStageComplete ? standings.advancingPerGroup : advancingPerGroup} from each advance
          </p>
        </div>

        <button
          onClick={() => toggleAllGroups(groupNames)}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 rounded-lg transition-colors flex items-center gap-1.5"
        >
          {groupNames.every((g) => collapsedGroups[g]) ? (
            <><ChevronDown size={14} />{' '}Expand All</>
          ) : (
            <><ChevronUp size={14} />{' '}Collapse All</>
          )}
        </button>

        {standings.groupStageComplete && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
            <Trophy size={18} />
            <span className="font-medium">Group Stage Complete</span>
          </div>
        )}
      </div>

      {/* Admin Options - Generate Knockout + Create Match */}
      {isOrganizer && !standings.groupStageComplete && isAllGroupMatchesComplete() && (
        <div className="glass-card p-4 sm:p-6 border-2 border-brand-green/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold text-light-text-primary dark:text-white">Generate Knockout</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All group matches are complete. Select how many advance and generate the knockout bracket.
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Advance top
                </label>
                <select
                  value={advancingPerGroup}
                  onChange={(e) => setAdvancingPerGroup(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-light-text-primary dark:text-white focus:ring-2 focus:ring-brand-green focus:border-brand-green"
                >
                  {Array.from({ length: Math.max(...groupNames.map((g) => (standings.standings[g] || []).length)) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  per group
                </span>
              </div>
              <Button
                onClick={handleCompleteGroupStage}
                loading={completing}
                disabled={completing}
                variant="primary"
                className="flex items-center gap-2 w-fit"
              >
                <Trophy size={18} />
                Generate Knockout
              </Button>
            </div>
            <div className="glass-surface p-4 rounded-lg">
              <h3 className="font-semibold text-light-text-primary dark:text-white mb-2">Create Match</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Manually create a match between any two registered teams.
              </p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Team 1:</label>
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
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Team 2:</label>
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
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Round name:</label>
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
                onClick={handleCreateMatch}
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

      {/* Group Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        {groupNames.map((groupName) => {
          const groupTeams = standings.standings[groupName] || [];
          const grpMatches = getGroupMatches(groupName);
          const advancingCount = standings.groupStageComplete ? (standings.advancingPerGroup || 2) : advancingPerGroup;

          return (
            <div key={groupName} className="glass-card overflow-hidden">
              <div
                onClick={() => toggleGroup(groupName)}
                className="bg-gradient-to-r from-brand-green/20 to-transparent p-4 cursor-pointer flex items-center justify-between hover:from-brand-green/30 transition-all"
              >
                <h3 className="text-lg font-bold text-light-text-primary dark:text-white">
                  Group {groupName}
                  <span className="ml-2 text-sm font-normal text-light-text-muted dark:text-gray-400">
                    ({groupTeams.length} teams, {grpMatches.filter((m) => m.matchStatus === 'COMPLETED').length}/{grpMatches.length} played)
                  </span>
                </h3>
                {collapsedGroups[groupName] ? (
                  <ChevronDown size={20} className="text-light-text-muted dark:text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronUp size={20} className="text-light-text-muted dark:text-gray-400 flex-shrink-0" />
                )}
              </div>
              {renderGroupContent(groupName, groupTeams, grpMatches, advancingCount)}
            </div>
          );
        })}
      </div>

      {/* Knockout Stage Preview - Hide when tournament is complete (winner is known) */}
      {standings.groupStageComplete && tournament.status !== 'COMPLETED' && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-light-text-primary dark:text-white mb-4 flex items-center gap-2">
            <Trophy className="text-yellow-500" size={20} />
            Knockout Stage
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Knockout matches have been generated. View the matches below.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="text-xs text-light-text-muted dark:text-gray-400 flex flex-wrap gap-4">
        <span><span className="text-green-600 dark:text-green-400 font-semibold">Q</span> = Currently qualifying for knockout</span>
        <span>P = Played | W = Wins | L = Losses | +/- = Point Differential</span>
      </div>
    </div>
  );
};

export default GroupStageView;
