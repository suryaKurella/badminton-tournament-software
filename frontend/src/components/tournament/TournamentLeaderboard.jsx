import { useState, useEffect } from 'react';
import axios from 'axios';

const TournamentLeaderboard = ({ tournamentId }) => {
  const [entries, setEntries] = useState([]);
  const [isTeamLeaderboard, setIsTeamLeaderboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [tournamentId]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/statistics/tournament/${tournamentId}/leaderboard`
      );

      if (response.data.success) {
        setEntries(response.data.data || []);
        setIsTeamLeaderboard(response.data.isTeamLeaderboard || false);
      } else {
        setError(response.data.message || 'Failed to load leaderboard');
      }
    } catch (err) {
      console.error('Error fetching tournament leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getTeamName = (entry) => {
    const player1Name = entry.player1?.fullName || entry.player1?.username || 'Unknown';
    const player2Name = entry.player2?.fullName || entry.player2?.username || 'Unknown';
    return `${player1Name} & ${player2Name}`;
  };

  const getTeamInitials = (entry) => {
    const initial1 = (entry.player1?.fullName || entry.player1?.username || 'U').charAt(0).toUpperCase();
    const initial2 = (entry.player2?.fullName || entry.player2?.username || 'U').charAt(0).toUpperCase();
    return `${initial1}${initial2}`;
  };

  const getPlayerName = (entry) => {
    return entry.user?.fullName || entry.user?.username || 'Unknown Player';
  };

  const getPlayerInitial = (entry) => {
    return (entry.user?.fullName || entry.user?.username || 'U').charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>No rankings available yet. Complete some matches to see the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              Rank
            </th>
            <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              {isTeamLeaderboard ? 'Team' : 'Player'}
            </th>
            <th className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
              Matches
            </th>
            <th className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
              W-L
            </th>
            <th className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
              Points
            </th>
            <th className="px-4 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
              Win Rate
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {entries.map((entry, index) => {
            const rank = index + 1;
            const winRate = entry.totalMatches > 0
              ? ((entry.matchesWon / entry.totalMatches) * 100).toFixed(1)
              : '0.0';

            return (
              <tr
                key={entry.teamKey || entry.playerId || index}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {/* Rank */}
                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {rank <= 3 ? (
                      <span className="text-2xl">
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-gray-500 dark:text-gray-400">#{rank}</span>
                    )}
                  </div>
                </td>

                {/* Team/Player Name */}
                <td className="px-4 sm:px-6 py-4">
                  {isTeamLeaderboard ? (
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {entry.player1?.fullName || entry.player1?.username || 'Unknown'}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {entry.player2?.fullName || entry.player2?.username || 'Unknown'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold text-sm">
                        {getPlayerInitial(entry)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {getPlayerName(entry)}
                        </div>
                      </div>
                    </div>
                  )}
                </td>

                {/* Matches */}
                <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap hidden sm:table-cell">
                  <span className="text-gray-900 dark:text-white font-semibold">{entry.totalMatches || 0}</span>
                </td>

                {/* W-L */}
                <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap hidden md:table-cell">
                  <span className="text-green-600 dark:text-green-400 font-semibold">{entry.matchesWon || 0}</span>
                  <span className="text-gray-500 mx-1">-</span>
                  <span className="text-red-600 dark:text-red-400 font-semibold">{entry.matchesLost || 0}</span>
                </td>

                {/* Points */}
                <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap hidden md:table-cell">
                  <span className="text-gray-900 dark:text-white font-semibold">{entry.pointsScored || 0}</span>
                </td>

                {/* Win Rate */}
                <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap hidden md:table-cell">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{winRate}%</span>
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${winRate}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TournamentLeaderboard;
