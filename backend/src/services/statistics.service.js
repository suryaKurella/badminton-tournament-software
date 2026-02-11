const { prisma } = require('../config/database');

/**
 * Calculate ELO rating change
 * @param {number} playerRating - Current player rating
 * @param {number} opponentRating - Opponent's rating
 * @param {string} result - 'WIN', 'LOSS', or 'DRAW'
 * @returns {number} - New rating
 */
function calculateRankingPoints(playerRating, opponentRating, result) {
  const K = 32; // K-factor (rating sensitivity)
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const actualScore = result === 'WIN' ? 1 : result === 'LOSS' ? 0 : 0.5;
  const change = Math.round(K * (actualScore - expectedScore));
  return playerRating + change;
}

/**
 * Update player statistics after a match completion
 * @param {string} userId - Player user ID
 * @param {object} matchResult - Match result data
 */
async function updatePlayerStatistics(userId, matchResult) {
  try {
    const { matchId, won, gamesWon, gamesLost, pointsScored, pointsConceded, opponentRating } = matchResult;

    // Get or create player statistics
    let stats = await prisma.playerStatistics.findUnique({
      where: { userId },
    });

    if (!stats) {
      stats = await prisma.playerStatistics.create({
        data: { userId },
      });
    }

    // Calculate new rating
    const result = won ? 'WIN' : 'LOSS';
    const newRating = calculateRankingPoints(stats.rankingPoints, opponentRating, result);

    // Update statistics
    const updatedStats = {
      totalMatches: stats.totalMatches + 1,
      matchesWon: won ? stats.matchesWon + 1 : stats.matchesWon,
      matchesLost: !won ? stats.matchesLost + 1 : stats.matchesLost,
      totalGames: stats.totalGames + gamesWon + gamesLost,
      gamesWon: stats.gamesWon + gamesWon,
      gamesLost: stats.gamesLost + gamesLost,
      totalPointsScored: stats.totalPointsScored + pointsScored,
      totalPointsConceded: stats.totalPointsConceded + pointsConceded,
      rankingPoints: newRating,
      lastMatchDate: new Date(),
    };

    // Calculate win rate
    updatedStats.winRate = updatedStats.totalMatches > 0
      ? updatedStats.matchesWon / updatedStats.totalMatches
      : 0;

    // Calculate average points per game (avoid division by zero)
    updatedStats.avgPointsPerGame = updatedStats.totalGames > 0
      ? updatedStats.totalPointsScored / updatedStats.totalGames
      : 0;

    // Update streaks
    if (won) {
      updatedStats.currentWinStreak = stats.currentWinStreak + 1;
      updatedStats.longestWinStreak = Math.max(updatedStats.currentWinStreak, stats.longestWinStreak);
      updatedStats.currentLossStreak = 0;
    } else {
      updatedStats.currentLossStreak = stats.currentLossStreak + 1;
      updatedStats.currentWinStreak = 0;
    }

    // Update peak rank if improved
    if (stats.peakRank === null || stats.currentRank < stats.peakRank) {
      updatedStats.peakRank = stats.currentRank;
      updatedStats.peakRankDate = new Date();
    }

    // Save updated statistics
    const updated = await prisma.playerStatistics.update({
      where: { userId },
      data: updatedStats,
    });

    return {
      success: true,
      data: updated,
      ratingChange: newRating - stats.rankingPoints,
    };
  } catch (error) {
    console.error('Error updating player statistics:', error);
    throw error;
  }
}

/**
 * Update statistics for all players in a match
 * Called after match completion
 */
async function updateMatchPlayerStatistics(matchId) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        team1: true,
        team2: true,
        tournament: true,
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (!match.winnerId) {
      throw new Error('Match has no winner');
    }

    const detailedScore = match.detailedScore || {
      games: [],
      gamesWon: { team1: 0, team2: 0 },
    };

    // Calculate points scored/conceded from games
    let team1Points = 0,
      team2Points = 0;
    detailedScore.games.forEach((game) => {
      team1Points += game.team1;
      team2Points += game.team2;
    });

    // Determine winner/loser
    const team1Won = match.winnerId === match.team1Id;

    // Get average opponent rating for ELO calculation
    const getOpponentRating = async (teamId) => {
      const opponentTeamId = teamId === match.team1Id ? match.team2Id : match.team1Id;
      const opponentTeam = teamId === match.team1Id ? match.team2 : match.team1;

      const player1Stats = await prisma.playerStatistics.findUnique({
        where: { userId: opponentTeam.player1Id },
      });
      const player2Stats = await prisma.playerStatistics.findUnique({
        where: { userId: opponentTeam.player2Id },
      });

      return ((player1Stats?.rankingPoints || 1000) + (player2Stats?.rankingPoints || 1000)) / 2;
    };

    // Update team1 players
    const team1OpponentRating = await getOpponentRating(match.team1Id);
    await updatePlayerStatistics(match.team1.player1Id, {
      matchId,
      won: team1Won,
      gamesWon: detailedScore.gamesWon.team1,
      gamesLost: detailedScore.gamesWon.team2,
      pointsScored: team1Points,
      pointsConceded: team2Points,
      opponentRating: team1OpponentRating,
    });

    // For singles, player1 and player2 are the same
    if (match.team1.player1Id !== match.team1.player2Id) {
      await updatePlayerStatistics(match.team1.player2Id, {
        matchId,
        won: team1Won,
        gamesWon: detailedScore.gamesWon.team1,
        gamesLost: detailedScore.gamesWon.team2,
        pointsScored: team1Points,
        pointsConceded: team2Points,
        opponentRating: team1OpponentRating,
      });
    }

    // Update team2 players
    const team2OpponentRating = await getOpponentRating(match.team2Id);
    await updatePlayerStatistics(match.team2.player1Id, {
      matchId,
      won: !team1Won,
      gamesWon: detailedScore.gamesWon.team2,
      gamesLost: detailedScore.gamesWon.team1,
      pointsScored: team2Points,
      pointsConceded: team1Points,
      opponentRating: team2OpponentRating,
    });

    if (match.team2.player1Id !== match.team2.player2Id) {
      await updatePlayerStatistics(match.team2.player2Id, {
        matchId,
        won: !team1Won,
        gamesWon: detailedScore.gamesWon.team2,
        gamesLost: detailedScore.gamesWon.team1,
        pointsScored: team2Points,
        pointsConceded: team1Points,
        opponentRating: team2OpponentRating,
      });
    }

    // Recalculate global rankings
    await updateGlobalRankings();

    return {
      success: true,
      message: 'Player statistics updated successfully',
    };
  } catch (error) {
    console.error('Error updating match player statistics:', error);
    throw error;
  }
}

/**
 * Update global rankings for all players
 * Sort by ranking points and assign ranks
 */
async function updateGlobalRankings() {
  try {
    // Get all player statistics sorted by ranking points
    const allPlayers = await prisma.playerStatistics.findMany({
      where: {
        totalMatches: {
          gte: 1, // Must have played at least 1 match
        },
      },
      orderBy: {
        rankingPoints: 'desc',
      },
    });

    // Update ranks
    for (let i = 0; i < allPlayers.length; i++) {
      const player = allPlayers[i];
      const newRank = i + 1;

      await prisma.playerStatistics.update({
        where: { id: player.id },
        data: {
          currentRank: newRank,
          peakRank: player.peakRank === null ? newRank : Math.min(newRank, player.peakRank),
          peakRankDate: player.peakRank === null || newRank < player.peakRank ? new Date() : player.peakRankDate,
        },
      });
    }

    return {
      success: true,
      message: 'Global rankings updated',
    };
  } catch (error) {
    console.error('Error updating global rankings:', error);
    throw error;
  }
}

/**
 * Get leaderboard with filters
 */
async function getLeaderboard(filters = {}) {
  try {
    const { page = 1, limit = 100, timeRange = 'all', tournamentType, minMatches = 0 } = filters;

    const whereClause = {
      totalMatches: {
        gte: minMatches,
      },
    };

    // Time range filter
    if (timeRange !== 'all') {
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }

      if (startDate) {
        whereClause.lastMatchDate = {
          gte: startDate,
        };
      }
    }

    const skip = (page - 1) * limit;

    const [players, total] = await Promise.all([
      prisma.playerStatistics.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          rankingPoints: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.playerStatistics.count({
        where: whereClause,
      }),
    ]);

    return {
      success: true,
      data: players,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
}

/**
 * Get player statistics
 */
async function getPlayerStats(userId) {
  try {
    const stats = await prisma.playerStatistics.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!stats) {
      // Return default stats if player hasn't played
      return {
        success: true,
        data: {
          userId,
          totalMatches: 0,
          matchesWon: 0,
          matchesLost: 0,
          winRate: 0,
          rankingPoints: 1000,
          currentRank: null,
        },
      };
    }

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error('Error getting player stats:', error);
    throw error;
  }
}

/**
 * Get player match history
 */
async function getPlayerMatchHistory(userId, limit = 10) {
  try {
    // Find all matches where the player participated
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          {
            team1: {
              OR: [{ player1Id: userId }, { player2Id: userId }],
            },
          },
          {
            team2: {
              OR: [{ player1Id: userId }, { player2Id: userId }],
            },
          },
        ],
        matchStatus: 'COMPLETED',
      },
      include: {
        team1: {
          include: {
            player1: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
            player2: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
        team2: {
          include: {
            player1: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
            player2: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            tournamentType: true,
          },
        },
      },
      orderBy: {
        endTime: 'desc',
      },
      take: limit,
    });

    // Format matches with result
    const formattedMatches = matches.map((match) => {
      const isTeam1 =
        match.team1.player1Id === userId || match.team1.player2Id === userId;
      const won = isTeam1 ? match.winnerId === match.team1Id : match.winnerId === match.team2Id;

      return {
        ...match,
        result: won ? 'WIN' : 'LOSS',
        playerTeam: isTeam1 ? 'team1' : 'team2',
      };
    });

    return {
      success: true,
      data: formattedMatches,
    };
  } catch (error) {
    console.error('Error getting player match history:', error);
    throw error;
  }
}

/**
 * Get tournament leaderboard
 */
async function getTournamentLeaderboard(tournamentId) {
  try {
    // Get all players who participated in the tournament
    const matches = await prisma.match.findMany({
      where: {
        tournamentId,
        matchStatus: 'COMPLETED',
      },
      include: {
        team1: true,
        team2: true,
      },
    });

    // Calculate tournament-specific stats for each player
    const playerStats = {};

    matches.forEach((match) => {
      const processTeam = (team, isWinner) => {
        // Use Set to avoid counting same player twice in singles (player1Id === player2Id)
        const uniquePlayerIds = [...new Set([team.player1Id, team.player2Id])];
        uniquePlayerIds.forEach((playerId) => {
          if (!playerStats[playerId]) {
            playerStats[playerId] = {
              playerId,
              matchesWon: 0,
              matchesLost: 0,
              totalMatches: 0,
            };
          }

          playerStats[playerId].totalMatches++;
          if (isWinner) {
            playerStats[playerId].matchesWon++;
          } else {
            playerStats[playerId].matchesLost++;
          }
        });
      };

      processTeam(match.team1, match.winnerId === match.team1Id);
      processTeam(match.team2, match.winnerId === match.team2Id);
    });

    // Get player details and global stats
    const playersArray = await Promise.all(
      Object.values(playerStats).map(async (stats) => {
        const user = await prisma.user.findUnique({
          where: { id: stats.playerId },
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        });

        const globalStats = await prisma.playerStatistics.findUnique({
          where: { userId: stats.playerId },
        });

        return {
          ...stats,
          user,
          winRate: stats.matchesWon / stats.totalMatches,
          globalRankingPoints: globalStats?.rankingPoints || 1000,
        };
      })
    );

    // Sort by matches won, then by global ranking points
    playersArray.sort((a, b) => {
      if (b.matchesWon !== a.matchesWon) {
        return b.matchesWon - a.matchesWon;
      }
      return b.globalRankingPoints - a.globalRankingPoints;
    });

    return {
      success: true,
      data: playersArray,
    };
  } catch (error) {
    console.error('Error getting tournament leaderboard:', error);
    throw error;
  }
}

/**
 * Initialize statistics for existing users (migration helper)
 */
async function initializeStatisticsForExistingUsers() {
  try {
    const users = await prisma.user.findMany({
      where: {
        playerStatistics: null,
      },
    });

    for (const user of users) {
      await prisma.playerStatistics.create({
        data: {
          userId: user.id,
        },
      });
    }

    return {
      success: true,
      message: `Initialized statistics for ${users.length} users`,
    };
  } catch (error) {
    console.error('Error initializing statistics:', error);
    throw error;
  }
}

module.exports = {
  updatePlayerStatistics,
  updateMatchPlayerStatistics,
  updateGlobalRankings,
  getLeaderboard,
  getPlayerStats,
  getPlayerMatchHistory,
  getTournamentLeaderboard,
  calculateRankingPoints,
  initializeStatisticsForExistingUsers,
};
