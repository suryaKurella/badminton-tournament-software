import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, TrendingUp, TrendingDown, Award, User } from 'lucide-react';

const Leaderboard = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    timeRange: 'all',
    minMatches: 0,
    page: 1,
    limit: 50,
  });

  useEffect(() => {
    fetchLeaderboard();
  }, [filters]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: filters.page,
        limit: filters.limit,
        timeRange: filters.timeRange,
        minMatches: filters.minMatches,
      });

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/statistics/leaderboard?${queryParams}`
      );
      const data = await response.json();

      if (data.success) {
        setPlayers(data.data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadgeColor = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'from-gray-300 to-gray-500 text-white';
    if (rank === 3) return 'from-orange-400 to-orange-600 text-white';
    return 'from-card-dark to-border text-foreground';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy size={20} className="text-white" />;
    if (rank === 2) return <Award size={20} className="text-white" />;
    if (rank === 3) return <Award size={20} className="text-white" />;
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-gray-900 dark:text-white">
          Player Leaderboard
        </h1>
        <p className="text-muted">Top ranked badminton players based on ELO rating</p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Time Range */}
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Time Range</label>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters({ ...filters, timeRange: e.target.value, page: 1 })}
              className="w-full px-4 py-2 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors"
            >
              <option value="all">All Time</option>
              <option value="year">This Year</option>
              <option value="month">This Month</option>
              <option value="week">This Week</option>
            </select>
          </div>

          {/* Minimum Matches */}
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Min. Matches</label>
            <select
              value={filters.minMatches}
              onChange={(e) => setFilters({ ...filters, minMatches: parseInt(e.target.value), page: 1 })}
              className="w-full px-4 py-2 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors"
            >
              <option value="0">No Minimum</option>
              <option value="5">5+ Matches</option>
              <option value="10">10+ Matches</option>
              <option value="20">20+ Matches</option>
            </select>
          </div>

          {/* Results per page */}
          <div>
            <label className="block text-sm font-medium text-muted mb-2">Show</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
              className="w-full px-4 py-2 glass-surface rounded-lg border border-border focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-colors"
            >
              <option value="25">25 Players</option>
              <option value="50">50 Players</option>
              <option value="100">100 Players</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
        </div>
      ) : players.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <User size={48} className="mx-auto mb-4 text-muted" />
          <p className="text-lg text-muted">No players found matching your filters</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted">Rank</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-muted">Player</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-muted">Rating</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-muted">Matches</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-muted">W-L</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-muted">Win Rate</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-muted">Streak</th>
                  <th className="text-center py-4 px-4 text-sm font-semibold text-muted">Peak Rank</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => {
                  const rank = player.currentRank || (filters.page - 1) * filters.limit + index + 1;
                  const winRate = (player.winRate * 100).toFixed(1);

                  return (
                    <tr
                      key={player.id}
                      className="border-b border-border/50 hover:bg-brand-green/5 transition-colors"
                    >
                      {/* Rank */}
                      <td className="py-4 px-4">
                        <div
                          className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-bold bg-gradient-to-br ${getRankBadgeColor(rank)} min-w-[60px]`}
                        >
                          {getRankIcon(rank)}
                          <span>{rank}</span>
                        </div>
                      </td>

                      {/* Player */}
                      <td className="py-4 px-4">
                        <Link
                          to={`/player/${player.userId}/stats`}
                          className="flex items-center gap-3 hover:text-brand-green transition-colors"
                        >
                          {player.user.avatarUrl ? (
                            <img
                              src={player.user.avatarUrl}
                              alt={player.user.fullName}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-brand-green/20 flex items-center justify-center">
                              <User size={20} className="text-brand-green" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold">
                              {player.user.fullName || player.user.username}
                            </p>
                            <p className="text-xs text-muted">@{player.user.username}</p>
                          </div>
                        </Link>
                      </td>

                      {/* Rating */}
                      <td className="py-4 px-4 text-center">
                        <span className="text-lg font-bold text-brand-green">
                          {player.rankingPoints}
                        </span>
                      </td>

                      {/* Matches */}
                      <td className="py-4 px-4 text-center text-muted">
                        {player.totalMatches}
                      </td>

                      {/* W-L */}
                      <td className="py-4 px-4 text-center">
                        <span className="font-semibold">
                          <span className="text-brand-green">{player.matchesWon}</span>
                          {' - '}
                          <span className="text-red-500">{player.matchesLost}</span>
                        </span>
                      </td>

                      {/* Win Rate */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-green"
                              style={{ width: `${winRate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold">{winRate}%</span>
                        </div>
                      </td>

                      {/* Streak */}
                      <td className="py-4 px-4 text-center">
                        {player.currentWinStreak > 0 ? (
                          <div className="flex items-center justify-center gap-1 text-brand-green">
                            <TrendingUp size={16} />
                            <span className="font-semibold">{player.currentWinStreak}W</span>
                          </div>
                        ) : player.currentLossStreak > 0 ? (
                          <div className="flex items-center justify-center gap-1 text-red-500">
                            <TrendingDown size={16} />
                            <span className="font-semibold">{player.currentLossStreak}L</span>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>

                      {/* Peak Rank */}
                      <td className="py-4 px-4 text-center">
                        {player.peakRank ? (
                          <span className="text-sm font-semibold">#{player.peakRank}</span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4 p-4">
            {players.map((player, index) => {
              const rank = player.currentRank || (filters.page - 1) * filters.limit + index + 1;
              const winRate = (player.winRate * 100).toFixed(1);

              return (
                <Link
                  key={player.id}
                  to={`/player/${player.userId}/stats`}
                  className="block p-4 glass-surface rounded-lg hover:border-brand-green/50 transition-all"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-bold bg-gradient-to-br ${getRankBadgeColor(rank)}`}
                    >
                      {getRankIcon(rank)}
                      <span>{rank}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">
                        {player.user.fullName || player.user.username}
                      </p>
                      <p className="text-xs text-muted">@{player.user.username}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-brand-green">
                        {player.rankingPoints}
                      </p>
                      <p className="text-xs text-muted">Rating</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <p className="text-muted text-xs">Matches</p>
                      <p className="font-semibold">{player.totalMatches}</p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">W-L</p>
                      <p className="font-semibold">
                        <span className="text-brand-green">{player.matchesWon}</span>
                        {'-'}
                        <span className="text-red-500">{player.matchesLost}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted text-xs">Win Rate</p>
                      <p className="font-semibold">{winRate}%</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 glass-card p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted">About Rankings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted">
          <div>
            <p>• Rankings are based on ELO rating system (starting at 1000)</p>
            <p>• Win against higher-ranked players gains more points</p>
          </div>
          <div>
            <p>• Players must complete matches to be ranked</p>
            <p>• Streak tracks consecutive wins or losses</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
