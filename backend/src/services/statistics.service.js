const { prisma } = require('../config/database');

// In-memory leaderboard cache (keyed by tournamentId)
const leaderboardCache = new Map();
const LEADERBOARD_TTL = 5 * 60 * 1000; // 5 minutes

function invalidateLeaderboardCache(tournamentId) {
  if (tournamentId) {
    leaderboardCache.delete(tournamentId);
  } else {
    leaderboardCache.clear();
  }
}

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
 * Ranks by tournament progression (knockout stage) first, then by wins/point differential
 */
async function getTournamentLeaderboard(tournamentId) {
  try {
    // Check cache first
    const cached = leaderboardCache.get(tournamentId);
    if (cached && Date.now() - cached.timestamp < LEADERBOARD_TTL) {
      return cached.data;
    }

    // Get tournament to check type
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { tournamentType: true, partnerMode: true },
    });

    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Rotating partner tournaments use individual leaderboard even for doubles/mixed
    const isTeamTournament = (tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED')
      && tournament.partnerMode !== 'ROTATING';

    // Get all completed matches with bracket info
    const matches = await prisma.match.findMany({
      where: {
        tournamentId,
        matchStatus: 'COMPLETED',
      },
      include: {
        team1: {
          include: {
            player1: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
            player2: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
          },
        },
        team2: {
          include: {
            player1: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
            player2: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
          },
        },
        bracketNode: true,
      },
    });

    // Separate knockout and non-knockout matches
    const knockoutMatches = matches.filter(m => m.bracketNode?.bracketType === 'KNOCKOUT');
    const hasKnockout = knockoutMatches.length > 0;

    // Find the highest knockout round (to determine finals)
    const maxKnockoutRound = hasKnockout
      ? Math.max(...knockoutMatches.map(m => m.bracketNode?.roundNumber || 0))
      : 0;

    // Helper to compute games won/lost from score strings
    const computeGames = (team1ScoreStr, team2ScoreStr) => {
      const t1Games = team1ScoreStr ? team1ScoreStr.split(',').map(s => parseInt(s, 10) || 0) : [];
      const t2Games = team2ScoreStr ? team2ScoreStr.split(',').map(s => parseInt(s, 10) || 0) : [];
      let team1GamesWon = 0, team2GamesWon = 0;
      for (let i = 0; i < Math.max(t1Games.length, t2Games.length); i++) {
        if ((t1Games[i] || 0) > (t2Games[i] || 0)) team1GamesWon++;
        else if ((t2Games[i] || 0) > (t1Games[i] || 0)) team2GamesWon++;
      }
      return { team1GamesWon, team2GamesWon };
    };

    if (isTeamTournament) {
      // Calculate team-based stats for doubles/mixed tournaments
      const teamStats = {};
      // Track head-to-head results: headToHead[teamKeyA][teamKeyB] = true if A beat B
      const headToHead = {};

      matches.forEach((match) => {
        let team1Points = 0;
        let team2Points = 0;

        if (match.team1Score && typeof match.team1Score === 'string') {
          const scores = match.team1Score.split(',').map(s => parseInt(s, 10) || 0);
          team1Points = scores.reduce((sum, score) => sum + score, 0);
        }

        if (match.team2Score && typeof match.team2Score === 'string') {
          const scores = match.team2Score.split(',').map(s => parseInt(s, 10) || 0);
          team2Points = scores.reduce((sum, score) => sum + score, 0);
        }

        const { team1GamesWon, team2GamesWon } = computeGames(match.team1Score, match.team2Score);

        const isKnockout = match.bracketNode?.bracketType === 'KNOCKOUT';
        const knockoutRound = match.bracketNode?.roundNumber || 0;

        const getTeamKey = (team) => [team.player1Id, team.player2Id].sort().join('-');

        const processTeam = (team, isWinner, pointsFor, pointsAgainst, gamesWon, gamesLost) => {
          // Create a unique team key using sorted player IDs
          const teamKey = getTeamKey(team);

          if (!teamStats[teamKey]) {
            teamStats[teamKey] = {
              teamKey,
              player1: team.player1,
              player2: team.player2,
              matchesWon: 0,
              matchesLost: 0,
              totalMatches: 0,
              gamesWon: 0,
              gamesLost: 0,
              pointsScored: 0,
              pointsConceded: 0,
              // Knockout progression tracking
              knockoutProgress: 0, // 0 = didn't qualify, higher = further progression
              isChampion: false,
              isRunnerUp: false,
            };
          }

          teamStats[teamKey].totalMatches++;
          teamStats[teamKey].pointsScored += pointsFor;
          teamStats[teamKey].pointsConceded += pointsAgainst;
          teamStats[teamKey].gamesWon += gamesWon;
          teamStats[teamKey].gamesLost += gamesLost;
          if (isWinner) {
            teamStats[teamKey].matchesWon++;
          } else {
            teamStats[teamKey].matchesLost++;
          }

          // Track knockout progression
          if (isKnockout) {
            if (isWinner) {
              // Winner advances - their progress is the next round
              const progress = knockoutRound + 1;
              teamStats[teamKey].knockoutProgress = Math.max(teamStats[teamKey].knockoutProgress, progress);

              // Check if this was the final and they won
              if (knockoutRound === maxKnockoutRound) {
                teamStats[teamKey].isChampion = true;
                teamStats[teamKey].knockoutProgress = maxKnockoutRound + 2; // Champion gets highest score
              }
            } else {
              // Loser eliminated at this round
              teamStats[teamKey].knockoutProgress = Math.max(teamStats[teamKey].knockoutProgress, knockoutRound);

              // Check if this was the final and they lost
              if (knockoutRound === maxKnockoutRound) {
                teamStats[teamKey].isRunnerUp = true;
                teamStats[teamKey].knockoutProgress = maxKnockoutRound + 1; // Runner-up gets second highest
              }
            }
          }
        };

        processTeam(match.team1, match.winnerId === match.team1Id, team1Points, team2Points, team1GamesWon, team2GamesWon);
        processTeam(match.team2, match.winnerId === match.team2Id, team2Points, team1Points, team2GamesWon, team1GamesWon);

        // Track head-to-head (non-knockout matches only for RR tiebreakers)
        if (!isKnockout && match.winnerId) {
          const t1Key = getTeamKey(match.team1);
          const t2Key = getTeamKey(match.team2);
          const winnerKey = match.winnerId === match.team1Id ? t1Key : t2Key;
          const loserKey = match.winnerId === match.team1Id ? t2Key : t1Key;
          if (!headToHead[winnerKey]) headToHead[winnerKey] = {};
          headToHead[winnerKey][loserKey] = true;
        }
      });

      const teamsArray = Object.values(teamStats).map((stats) => ({
        ...stats,
        winRate: stats.totalMatches > 0 ? stats.matchesWon / stats.totalMatches : 0,
        gameDiff: stats.gamesWon - stats.gamesLost,
        pointDiff: stats.pointsScored - stats.pointsConceded,
        isTeam: true,
      }));

      // Sort teams using BWF rules: knockout progression > wins > head-to-head > game diff > point diff
      teamsArray.sort((a, b) => {
        // If knockout exists, sort by progression first
        if (hasKnockout) {
          if (b.knockoutProgress !== a.knockoutProgress) {
            return b.knockoutProgress - a.knockoutProgress;
          }
        }
        // 1. Matches won
        if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
        // 2. Points scored
        if (b.pointsScored !== a.pointsScored) return b.pointsScored - a.pointsScored;
        // 3. Head-to-head
        if (headToHead[a.teamKey]?.[b.teamKey]) return -1;
        if (headToHead[b.teamKey]?.[a.teamKey]) return 1;
        // 4. Game differential
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
        // 5. Point differential
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
        // Finally alphabetical
        const nameA = (a.player1?.fullName || a.player1?.username || '').toLowerCase();
        const nameB = (b.player1?.fullName || b.player1?.username || '').toLowerCase();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });

      const teamResult = {
        success: true,
        data: teamsArray,
        isTeamLeaderboard: true,
      };
      leaderboardCache.set(tournamentId, { data: teamResult, timestamp: Date.now() });
      return teamResult;
    }

    // Singles tournament - calculate player-based stats
    const playerStats = {};
    const singlesHeadToHead = {};

    matches.forEach((match) => {
      let team1Points = 0;
      let team2Points = 0;

      if (match.team1Score && typeof match.team1Score === 'string') {
        const scores = match.team1Score.split(',').map(s => parseInt(s, 10) || 0);
        team1Points = scores.reduce((sum, score) => sum + score, 0);
      }

      if (match.team2Score && typeof match.team2Score === 'string') {
        const scores = match.team2Score.split(',').map(s => parseInt(s, 10) || 0);
        team2Points = scores.reduce((sum, score) => sum + score, 0);
      }

      const { team1GamesWon, team2GamesWon } = computeGames(match.team1Score, match.team2Score);

      const isKnockout = match.bracketNode?.bracketType === 'KNOCKOUT';
      const knockoutRound = match.bracketNode?.roundNumber || 0;

      const processTeam = (team, isWinner, pointsFor, pointsAgainst, gamesWon, gamesLost) => {
        const uniquePlayerIds = [...new Set([team.player1Id, team.player2Id])];
        uniquePlayerIds.forEach((playerId) => {
          if (!playerStats[playerId]) {
            playerStats[playerId] = {
              playerId,
              user: team.player1Id === playerId ? team.player1 : team.player2,
              matchesWon: 0,
              matchesLost: 0,
              totalMatches: 0,
              gamesWon: 0,
              gamesLost: 0,
              pointsScored: 0,
              pointsConceded: 0,
              knockoutProgress: 0,
              isChampion: false,
              isRunnerUp: false,
            };
          }

          playerStats[playerId].totalMatches++;
          playerStats[playerId].pointsScored += pointsFor;
          playerStats[playerId].pointsConceded += pointsAgainst;
          playerStats[playerId].gamesWon += gamesWon;
          playerStats[playerId].gamesLost += gamesLost;
          if (isWinner) {
            playerStats[playerId].matchesWon++;
          } else {
            playerStats[playerId].matchesLost++;
          }

          // Track knockout progression
          if (isKnockout) {
            if (isWinner) {
              const progress = knockoutRound + 1;
              playerStats[playerId].knockoutProgress = Math.max(playerStats[playerId].knockoutProgress, progress);

              if (knockoutRound === maxKnockoutRound) {
                playerStats[playerId].isChampion = true;
                playerStats[playerId].knockoutProgress = maxKnockoutRound + 2;
              }
            } else {
              playerStats[playerId].knockoutProgress = Math.max(playerStats[playerId].knockoutProgress, knockoutRound);

              if (knockoutRound === maxKnockoutRound) {
                playerStats[playerId].isRunnerUp = true;
                playerStats[playerId].knockoutProgress = maxKnockoutRound + 1;
              }
            }
          }
        });
      };

      processTeam(match.team1, match.winnerId === match.team1Id, team1Points, team2Points, team1GamesWon, team2GamesWon);
      processTeam(match.team2, match.winnerId === match.team2Id, team2Points, team1Points, team2GamesWon, team1GamesWon);

      // Track head-to-head (non-knockout only)
      if (!isKnockout && match.winnerId) {
        const winnerId = match.winnerId === match.team1Id ? match.team1.player1Id : match.team2.player1Id;
        const loserId = match.winnerId === match.team1Id ? match.team2.player1Id : match.team1.player1Id;
        if (!singlesHeadToHead[winnerId]) singlesHeadToHead[winnerId] = {};
        singlesHeadToHead[winnerId][loserId] = true;
      }
    });

    // Batch fetch all player statistics in a single query (instead of N+1 individual queries)
    const playerIds = Object.keys(playerStats);
    const allGlobalStats = await prisma.playerStatistics.findMany({
      where: { userId: { in: playerIds } },
    });
    const globalStatsMap = new Map(allGlobalStats.map(s => [s.userId, s]));

    const playersArray = Object.values(playerStats).map((stats) => {
      const globalStats = globalStatsMap.get(stats.playerId);
      return {
        ...stats,
        winRate: stats.totalMatches > 0 ? stats.matchesWon / stats.totalMatches : 0,
        gameDiff: stats.gamesWon - stats.gamesLost,
        pointDiff: stats.pointsScored - stats.pointsConceded,
        globalRankingPoints: globalStats?.rankingPoints || 1000,
        isTeam: false,
      };
    });

    // Sort using BWF rules: knockout progression > wins > head-to-head > game diff > point diff
    playersArray.sort((a, b) => {
      if (hasKnockout) {
        if (b.knockoutProgress !== a.knockoutProgress) {
          return b.knockoutProgress - a.knockoutProgress;
        }
      }
      // 1. Matches won
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
      // 2. Points scored
      if (b.pointsScored !== a.pointsScored) return b.pointsScored - a.pointsScored;
      // 3. Head-to-head
      if (singlesHeadToHead[a.playerId]?.[b.playerId]) return -1;
      if (singlesHeadToHead[b.playerId]?.[a.playerId]) return 1;
      // 4. Game differential
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      // 5. Point differential
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      const nameA = (a.user?.fullName || a.user?.username || '').toLowerCase();
      const nameB = (b.user?.fullName || b.user?.username || '').toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const singlesResult = {
      success: true,
      data: playersArray,
      isTeamLeaderboard: false,
    };
    leaderboardCache.set(tournamentId, { data: singlesResult, timestamp: Date.now() });
    return singlesResult;
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
  invalidateLeaderboardCache,
};
