const { prisma } = require('../config/database');

/**
 * Check if a game is complete based on badminton scoring rules
 * - 21 points to win with 2-point lead
 * - Hard cap at 30 points
 */
function checkGameComplete(team1Score, team2Score) {
  // Standard win: 21+ points with 2-point lead
  if ((team1Score >= 21 || team2Score >= 21) && Math.abs(team1Score - team2Score) >= 2) {
    return true;
  }

  // Hard cap: First to 30 wins
  if (team1Score === 30 || team2Score === 30) {
    return true;
  }

  return false;
}

/**
 * Determine winner of a game
 */
function getGameWinner(team1Score, team2Score) {
  if (!checkGameComplete(team1Score, team2Score)) {
    return null;
  }
  return team1Score > team2Score ? 1 : 2;
}

/**
 * Check if match is complete (best of 3 games)
 */
function checkMatchComplete(games) {
  if (!games || games.length === 0) return false;

  let team1GamesWon = 0;
  let team2GamesWon = 0;

  games.forEach((game) => {
    if (game.team1 > game.team2) team1GamesWon++;
    else if (game.team2 > game.team1) team2GamesWon++;
  });

  // First to win 2 games wins the match
  return team1GamesWon >= 2 || team2GamesWon >= 2;
}

/**
 * Get match winner from completed games
 */
function getMatchWinner(games, team1Id, team2Id) {
  let team1GamesWon = 0;
  let team2GamesWon = 0;

  games.forEach((game) => {
    if (game.team1 > game.team2) team1GamesWon++;
    else if (game.team2 > game.team1) team2GamesWon++;
  });

  if (team1GamesWon > team2GamesWon) return team1Id;
  if (team2GamesWon > team1GamesWon) return team2Id;
  return null;
}

/**
 * Record a point in the match
 */
async function recordPoint(matchId, scoringTeamId, pointType = 'RALLY', recordedById) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchEvents: {
          orderBy: { eventSequence: 'desc' },
          take: 1,
        },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.matchStatus === 'COMPLETED') {
      throw new Error('Match is already completed');
    }

    if (match.matchStatus === 'CANCELLED') {
      throw new Error('Match is cancelled');
    }

    // Initialize detailed score if not exists
    let detailedScore = match.detailedScore || {
      games: [],
      currentGame: { team1: 0, team2: 0 },
      gamesWon: { team1: 0, team2: 0 },
    };

    // Get current game scores
    let currentGameScore = detailedScore.currentGame || { team1: 0, team2: 0 };
    const gameNumber = match.currentGame;

    // Update score
    if (scoringTeamId === match.team1Id) {
      currentGameScore.team1++;
    } else if (scoringTeamId === match.team2Id) {
      currentGameScore.team2++;
    } else {
      throw new Error('Invalid scoring team ID');
    }

    // Get next event sequence number
    const lastEvent = match.matchEvents[0];
    const eventSequence = lastEvent ? lastEvent.eventSequence + 1 : 1;

    // Create match event
    await prisma.matchEvent.create({
      data: {
        matchId,
        eventType: 'POINT_SCORED',
        gameNumber,
        eventSequence,
        team1Score: currentGameScore.team1,
        team2Score: currentGameScore.team2,
        scoringTeamId,
        pointType,
        recordedById,
      },
    });

    // Check if game is complete
    const gameComplete = checkGameComplete(currentGameScore.team1, currentGameScore.team2);

    if (gameComplete) {
      // Determine game winner
      const gameWinner = getGameWinner(currentGameScore.team1, currentGameScore.team2);

      // Update games won
      if (gameWinner === 1) {
        detailedScore.gamesWon.team1++;
      } else {
        detailedScore.gamesWon.team2++;
      }

      // Add completed game to games array
      detailedScore.games.push({
        team1: currentGameScore.team1,
        team2: currentGameScore.team2,
      });

      // Record game end event
      await prisma.matchEvent.create({
        data: {
          matchId,
          eventType: 'GAME_END',
          gameNumber,
          eventSequence: eventSequence + 1,
          team1Score: currentGameScore.team1,
          team2Score: currentGameScore.team2,
          recordedById,
        },
      });

      // Check if match is complete
      const matchComplete = checkMatchComplete(detailedScore.games);

      if (matchComplete) {
        // Determine match winner
        const winnerId = getMatchWinner(detailedScore.games, match.team1Id, match.team2Id);

        // Update match status
        await prisma.match.update({
          where: { id: matchId },
          data: {
            matchStatus: 'COMPLETED',
            endTime: new Date(),
            detailedScore,
            winnerId,
            team1Score: { games: detailedScore.games.map((g) => g.team1) },
            team2Score: { games: detailedScore.games.map((g) => g.team2) },
          },
        });

        // Record match end event
        await prisma.matchEvent.create({
          data: {
            matchId,
            eventType: 'MATCH_END',
            gameNumber,
            eventSequence: eventSequence + 2,
            team1Score: currentGameScore.team1,
            team2Score: currentGameScore.team2,
            recordedById,
          },
        });

        return {
          success: true,
          gameComplete: true,
          matchComplete: true,
          winnerId,
          currentScore: detailedScore,
        };
      }

      // Start next game
      const nextGame = match.currentGame + 1;
      detailedScore.currentGame = { team1: 0, team2: 0 };

      await prisma.match.update({
        where: { id: matchId },
        data: {
          currentGame: nextGame,
          detailedScore,
        },
      });

      // Record next game start event
      await prisma.matchEvent.create({
        data: {
          matchId,
          eventType: 'GAME_START',
          gameNumber: nextGame,
          eventSequence: eventSequence + 2,
          team1Score: 0,
          team2Score: 0,
          recordedById,
        },
      });

      return {
        success: true,
        gameComplete: true,
        matchComplete: false,
        nextGame,
        currentScore: detailedScore,
      };
    }

    // Update current game score
    detailedScore.currentGame = currentGameScore;

    await prisma.match.update({
      where: { id: matchId },
      data: {
        detailedScore,
      },
    });

    return {
      success: true,
      gameComplete: false,
      matchComplete: false,
      currentScore: detailedScore,
    };
  } catch (error) {
    console.error('Error recording point:', error);
    throw error;
  }
}

/**
 * Undo the last point scored
 */
async function undoLastPoint(matchId) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchEvents: {
          where: {
            eventType: {
              in: ['POINT_SCORED', 'GAME_END', 'GAME_START', 'MATCH_END'],
            },
          },
          orderBy: { eventSequence: 'desc' },
        },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.matchEvents.length === 0) {
      throw new Error('No points to undo');
    }

    // Get the last event(s) to undo
    const lastEvent = match.matchEvents[0];
    const eventsToDelete = [lastEvent];

    let detailedScore = match.detailedScore || {
      games: [],
      currentGame: { team1: 0, team2: 0 },
      gamesWon: { team1: 0, team2: 0 },
    };

    let currentGame = match.currentGame;
    let matchStatus = match.matchStatus;

    // Handle different event types
    if (lastEvent.eventType === 'MATCH_END') {
      // Undo match completion
      matchStatus = 'LIVE';

      // Also undo the game end before it
      const gameEndEvent = match.matchEvents.find(
        (e) => e.eventType === 'GAME_END' && e.eventSequence < lastEvent.eventSequence
      );
      if (gameEndEvent) {
        eventsToDelete.push(gameEndEvent);

        // Restore the last game to current game
        const lastGame = detailedScore.games.pop();
        detailedScore.currentGame = lastGame;

        // Decrement games won
        const winner = lastGame.team1 > lastGame.team2 ? 'team1' : 'team2';
        detailedScore.gamesWon[winner]--;
      }
    } else if (lastEvent.eventType === 'GAME_START') {
      // Undo game start - go back to previous game
      currentGame--;

      // Also undo the game end before it
      const gameEndEvent = match.matchEvents.find(
        (e) => e.eventType === 'GAME_END' && e.eventSequence < lastEvent.eventSequence
      );
      if (gameEndEvent) {
        eventsToDelete.push(gameEndEvent);

        // Restore the last game to current game
        const lastGame = detailedScore.games.pop();
        detailedScore.currentGame = lastGame;

        // Decrement games won
        const winner = lastGame.team1 > lastGame.team2 ? 'team1' : 'team2';
        detailedScore.gamesWon[winner]--;
      }
    } else if (lastEvent.eventType === 'POINT_SCORED') {
      // Undo point
      if (lastEvent.scoringTeamId === match.team1Id) {
        detailedScore.currentGame.team1--;
      } else {
        detailedScore.currentGame.team2--;
      }
    }

    // Delete the events in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete events
      await tx.matchEvent.deleteMany({
        where: {
          id: {
            in: eventsToDelete.map((e) => e.id),
          },
        },
      });

      // Create undo event
      await tx.matchEvent.create({
        data: {
          matchId,
          eventType: 'UNDO',
          gameNumber: currentGame,
          eventSequence: lastEvent.eventSequence,
          team1Score: detailedScore.currentGame.team1,
          team2Score: detailedScore.currentGame.team2,
          description: `Undid ${lastEvent.eventType}`,
        },
      });

      // Update match
      await tx.match.update({
        where: { id: matchId },
        data: {
          detailedScore,
          currentGame,
          matchStatus,
          winnerId: matchStatus === 'LIVE' ? null : match.winnerId,
        },
      });
    });

    return {
      success: true,
      message: 'Point undone successfully',
      currentScore: detailedScore,
    };
  } catch (error) {
    console.error('Error undoing point:', error);
    throw error;
  }
}

/**
 * Get current game score
 */
async function getCurrentGameScore(matchId) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const detailedScore = match.detailedScore || {
      games: [],
      currentGame: { team1: 0, team2: 0 },
      gamesWon: { team1: 0, team2: 0 },
    };

    return {
      success: true,
      data: {
        gameNumber: match.currentGame,
        currentGame: detailedScore.currentGame,
        gamesWon: detailedScore.gamesWon,
        completedGames: detailedScore.games,
        servingTeamId: match.servingTeamId,
      },
    };
  } catch (error) {
    console.error('Error getting current game score:', error);
    throw error;
  }
}

/**
 * Get match timeline (all events)
 */
async function getMatchTimeline(matchId, gameNumber = null) {
  try {
    const whereClause = { matchId };
    if (gameNumber) {
      whereClause.gameNumber = gameNumber;
    }

    const events = await prisma.matchEvent.findMany({
      where: whereClause,
      orderBy: { eventSequence: 'asc' },
      include: {
        recordedBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    return {
      success: true,
      data: events,
    };
  } catch (error) {
    console.error('Error getting match timeline:', error);
    throw error;
  }
}

/**
 * Start a match (set status to LIVE)
 */
async function startMatch(matchId, recordedById) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.matchStatus !== 'UPCOMING') {
      throw new Error('Match has already started or completed');
    }

    // Initialize detailed score
    const detailedScore = {
      games: [],
      currentGame: { team1: 0, team2: 0 },
      gamesWon: { team1: 0, team2: 0 },
    };

    await prisma.$transaction(async (tx) => {
      // Update match status
      await tx.match.update({
        where: { id: matchId },
        data: {
          matchStatus: 'LIVE',
          startTime: new Date(),
          currentGame: 1,
          detailedScore,
          servingTeamId: match.team1Id, // Team1 serves first by default
        },
      });

      // Create match start event
      await tx.matchEvent.create({
        data: {
          matchId,
          eventType: 'MATCH_START',
          gameNumber: 1,
          eventSequence: 1,
          team1Score: 0,
          team2Score: 0,
          recordedById,
        },
      });

      // Create game start event
      await tx.matchEvent.create({
        data: {
          matchId,
          eventType: 'GAME_START',
          gameNumber: 1,
          eventSequence: 2,
          team1Score: 0,
          team2Score: 0,
          recordedById,
        },
      });
    });

    return {
      success: true,
      message: 'Match started successfully',
    };
  } catch (error) {
    console.error('Error starting match:', error);
    throw error;
  }
}

/**
 * Update serving team
 */
async function updateServingTeam(matchId, servingTeamId) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (servingTeamId !== match.team1Id && servingTeamId !== match.team2Id) {
      throw new Error('Invalid serving team ID');
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        servingTeamId,
      },
    });

    return {
      success: true,
      message: 'Serving team updated',
    };
  } catch (error) {
    console.error('Error updating serving team:', error);
    throw error;
  }
}

/**
 * Record a timeout or injury break
 */
async function recordTimeout(matchId, eventType, recordedById) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchEvents: {
          orderBy: { eventSequence: 'desc' },
          take: 1,
        },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    const lastEvent = match.matchEvents[0];
    const eventSequence = lastEvent ? lastEvent.eventSequence + 1 : 1;

    const detailedScore = match.detailedScore || {
      games: [],
      currentGame: { team1: 0, team2: 0 },
      gamesWon: { team1: 0, team2: 0 },
    };

    await prisma.matchEvent.create({
      data: {
        matchId,
        eventType,
        gameNumber: match.currentGame,
        eventSequence,
        team1Score: detailedScore.currentGame.team1,
        team2Score: detailedScore.currentGame.team2,
        recordedById,
      },
    });

    return {
      success: true,
      message: `${eventType} recorded`,
    };
  } catch (error) {
    console.error('Error recording timeout:', error);
    throw error;
  }
}

module.exports = {
  recordPoint,
  undoLastPoint,
  getCurrentGameScore,
  getMatchTimeline,
  startMatch,
  updateServingTeam,
  recordTimeout,
  checkGameComplete,
  checkMatchComplete,
  getGameWinner,
  getMatchWinner,
};
