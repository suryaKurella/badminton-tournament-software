import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const LeaderboardTable = ({ players = [], loading = false }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Filter players based on search and category
  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || player.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Loading skeleton
  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-8 h-8 bg-light-surface dark:bg-dark-surface rounded"></div>
              <div className="flex-1 h-12 bg-light-surface dark:bg-dark-surface rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Filters */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-1">Leaderboard</h1>
            <p className="text-muted text-sm">Top performing players this season</p>
          </div>
          <div className="badge badge-info px-4 py-2">
            <span className="text-sm font-semibold">{filteredPlayers.length} Players</span>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
              aria-label="Search players"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input cursor-pointer"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
            <option value="mixed">Mixed Doubles</option>
          </select>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-light-surface dark:bg-dark-surface border-b-2 border-light-border dark:border-dark-border">
              <tr>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Player
                </th>
                <th className="px-4 sm:px-6 py-4 text-center text-xs font-semibold text-muted uppercase tracking-wider hidden sm:table-cell">
                  Matches
                </th>
                <th className="px-4 sm:px-6 py-4 text-center text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">
                  Wins
                </th>
                <th className="px-4 sm:px-6 py-4 text-center text-xs font-semibold text-muted uppercase tracking-wider hidden md:table-cell">
                  Win Rate
                </th>
                <th className="px-4 sm:px-6 py-4 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-dark-border">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-muted">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p>No players found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player, index) => {
                  const isCurrentUser = user && player.userId === user.id;
                  const rank = index + 1;
                  const winRate = player.matchesPlayed > 0
                    ? ((player.wins / player.matchesPlayed) * 100).toFixed(1)
                    : '0.0';

                  return (
                    <tr
                      key={player.id}
                      className={`
                        table-row
                        ${isCurrentUser ? 'table-row-highlight' : ''}
                      `}
                    >
                      {/* Rank */}
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {rank <= 3 ? (
                            <span className="text-2xl">
                              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span className="text-lg font-bold text-muted">#{rank}</span>
                          )}
                        </div>
                      </td>

                      {/* Player Name */}
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold text-sm">
                            {(player.fullName || player.username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-primary flex items-center gap-2">
                              {player.fullName || player.username}
                              {isCurrentUser && (
                                <span className="badge badge-info text-xs">You</span>
                              )}
                            </div>
                            {player.category && (
                              <div className="text-xs text-muted">{player.category}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Matches */}
                      <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap hidden sm:table-cell">
                        <span className="text-primary font-semibold">{player.matchesPlayed || 0}</span>
                      </td>

                      {/* Wins */}
                      <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap hidden md:table-cell">
                        <span className="text-success font-semibold">{player.wins || 0}</span>
                      </td>

                      {/* Win Rate */}
                      <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap hidden md:table-cell">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-semibold text-primary">{winRate}%</span>
                          <div className="w-16 h-2 bg-light-surface dark:bg-dark-surface rounded-full overflow-hidden">
                            <div
                              className="h-full bg-success rounded-full transition-all"
                              style={{ width: `${winRate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Points */}
                      <td className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xl sm:text-2xl font-bold text-brand-blue">
                            {player.points || 0}
                          </span>
                          <span className="text-xs text-muted">pts</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardTable;
