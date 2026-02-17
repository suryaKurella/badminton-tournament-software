const { prisma } = require('../config/database');
const scoreService = require('../services/score.service');
const statisticsService = require('../services/statistics.service');
const bracketService = require('../services/bracket.service');

// Socket.io instance will be set from server.js
let io;

const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Helper function to check if player scoring is allowed for a tournament
const checkPlayerScoringAllowed = async (tournamentId, userRole) => {
  // Get tournament to check status and scoring settings
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { allowPlayerScoring: true, status: true },
  });

  if (!tournament) {
    return { allowed: false, error: 'Tournament not found' };
  }

  // Tournament must be ACTIVE to allow any scoring
  if (tournament.status !== 'ACTIVE') {
    return { allowed: false, error: 'Tournament has not started yet. Please start the tournament first.' };
  }

  // Organizers and above can always score when tournament is active
  if (['ROOT', 'ADMIN', 'ORGANIZER'].includes(userRole)) {
    return { allowed: true };
  }

  // For PLAYER role, check tournament setting
  if (!tournament.allowPlayerScoring) {
    return { allowed: false, error: 'Only organizers can update scores for this tournament' };
  }

  return { allowed: true };
};

// @desc    Get all matches for a tournament
// @route   GET /api/matches/tournament/:tournamentId
// @access  Public
const getMatchesByTournament = async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = { tournamentId };
    if (status) where.matchStatus = status;

    // Get total count
    const total = await prisma.match.count({ where });

    const matches = await prisma.match.findMany({
      where,
      skip,
      take: limitNum,
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
      },
      orderBy: [
        { round: 'asc' },
        { scheduledTime: 'asc' },
      ],
    });

    res.status(200).json({
      success: true,
      count: matches.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: matches,
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching matches',
      error: error.message,
    });
  }
};

// @desc    Get single match
// @route   GET /api/matches/:id
// @access  Public
const getMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            tournamentType: true,
            allowPlayerScoring: true,
            status: true,
          },
        },
        team1: {
          include: {
            player1: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            player2: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
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
                avatarUrl: true,
              },
            },
            player2: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    res.status(200).json({
      success: true,
      data: match,
    });
  } catch (error) {
    console.error('Get match error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching match',
      error: error.message,
    });
  }
};

// @desc    Create new match
// @route   POST /api/matches
// @access  Private (ADMIN, ORGANIZER)
const createMatch = async (req, res) => {
  try {
    const {
      tournamentId,
      round,
      courtNumber,
      scheduledTime,
      team1Id,
      team2Id,
    } = req.body;

    const match = await prisma.match.create({
      data: {
        tournamentId,
        round,
        courtNumber: courtNumber ? parseInt(courtNumber) : null,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        team1Id,
        team2Id,
        matchStatus: 'UPCOMING',
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
      },
    });

    // Emit socket event for new match
    if (io) {
      io.to(`tournament-${tournamentId}`).emit('match:created', match);
    }

    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      data: match,
    });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating match',
      error: error.message,
    });
  }
};

// @desc    Update match
// @route   PUT /api/matches/:id
// @access  Private (ADMIN, ORGANIZER)
const updateMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if match exists
    const match = await prisma.match.findUnique({
      where: { id },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Convert dates if provided
    if (updateData.scheduledTime) {
      updateData.scheduledTime = new Date(updateData.scheduledTime);
    }
    if (updateData.courtNumber) {
      updateData.courtNumber = parseInt(updateData.courtNumber);
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: updateData,
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
      },
    });

    // Emit socket event for match update
    if (io) {
      io.to(`tournament-${match.tournamentId}`).emit('match:updated', updatedMatch);
    }

    res.status(200).json({
      success: true,
      message: 'Match updated successfully',
      data: updatedMatch,
    });
  } catch (error) {
    console.error('Update match error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating match',
      error: error.message,
    });
  }
};

// @desc    Update match score
// @route   PUT /api/matches/:id/score
// @access  Private (ADMIN, ORGANIZER, PLAYER - if participant)
const updateMatchScore = async (req, res) => {
  try {
    const { id } = req.params;
    const { team1Score, team2Score, winnerId, matchStatus } = req.body;

    // Check if match exists and get team info for player authorization
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        team1: true,
        team2: true,
      },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Check if player scoring is allowed
    const scoringCheck = await checkPlayerScoringAllowed(match.tournamentId, req.user.role);
    if (!scoringCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: scoringCheck.error,
      });
    }

    // Build update data object
    const updateData = {
      team1Score,
      team2Score,
    };

    // Add winnerId if provided
    if (winnerId) {
      updateData.winnerId = winnerId;
    }

    // Add matchStatus if provided
    if (matchStatus) {
      updateData.matchStatus = matchStatus;

      // If completing the match, set endTime
      if (matchStatus === 'COMPLETED') {
        updateData.endTime = new Date();

        // If not already started, set startTime
        if (!match.startTime) {
          updateData.startTime = new Date();
        }
      }
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: updateData,
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
      },
    });

    // Emit socket event for real-time score update
    if (io) {
      io.to(`tournament-${match.tournamentId}`).emit('match:scoreUpdate', updatedMatch);
      io.to(`match-${id}`).emit('match:scoreUpdate', updatedMatch);

      // If match completed, emit completion event
      if (matchStatus === 'COMPLETED') {
        io.to(`tournament-${match.tournamentId}`).emit('match:completed', updatedMatch);
        io.to(`match-${id}`).emit('match:completed', updatedMatch);

        // Update player statistics (non-blocking - errors logged but don't fail the request)
        if (winnerId) {
          try {
            await statisticsService.updateMatchPlayerStatistics(id);
          } catch (statsError) {
            console.error('Error updating player statistics:', statsError);
          }
        }

        // Advance winner in bracket if applicable (non-blocking - errors logged but don't fail the request)
        if (winnerId) {
          try {
            await bracketService.advanceWinner(id, winnerId);
          } catch (bracketError) {
            console.error('Error advancing bracket winner:', bracketError);
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Score updated successfully',
      data: updatedMatch,
    });
  } catch (error) {
    console.error('Update score error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating score',
      error: error.message,
    });
  }
};

// @desc    Start match
// @route   PUT /api/matches/:id/start
// @access  Private (ADMIN, ORGANIZER, PLAYER - if participant)
const startMatch = async (req, res) => {
  try {
    const { id } = req.params;

    // Get match to check tournament settings
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      select: { tournamentId: true },
    });

    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Check if player scoring is allowed
    const scoringCheck = await checkPlayerScoringAllowed(existingMatch.tournamentId, req.user.role);
    if (!scoringCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: scoringCheck.error,
      });
    }

    const match = await prisma.match.update({
      where: { id },
      data: {
        matchStatus: 'LIVE',
        startTime: new Date(),
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
      },
    });

    // Emit socket event
    if (io) {
      io.to(`tournament-${match.tournamentId}`).emit('match:started', match);
      io.to(`match-${id}`).emit('match:started', match);
    }

    res.status(200).json({
      success: true,
      message: 'Match started',
      data: match,
    });
  } catch (error) {
    console.error('Start match error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting match',
      error: error.message,
    });
  }
};

// @desc    Complete match
// @route   PUT /api/matches/:id/complete
// @access  Private (ADMIN, ORGANIZER, PLAYER - if participant)
const completeMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { winnerId } = req.body;

    if (!winnerId) {
      return res.status(400).json({
        success: false,
        message: 'Winner ID is required',
      });
    }

    // Get match to check tournament settings
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      select: { tournamentId: true },
    });

    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Check if player scoring is allowed
    const scoringCheck = await checkPlayerScoringAllowed(existingMatch.tournamentId, req.user.role);
    if (!scoringCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: scoringCheck.error,
      });
    }

    const match = await prisma.match.update({
      where: { id },
      data: {
        matchStatus: 'COMPLETED',
        endTime: new Date(),
        winnerId,
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
      },
    });

    // Update player statistics (non-blocking)
    try {
      await statisticsService.updateMatchPlayerStatistics(id);
    } catch (statsError) {
      console.error('Error updating player statistics:', statsError);
    }

    // Advance winner in bracket if applicable (non-blocking)
    try {
      await bracketService.advanceWinner(id, winnerId);
    } catch (bracketError) {
      console.log('Bracket advance info:', bracketError.message);
      // Non-critical - continue even if bracket advancement fails
    }

    // Emit socket event
    if (io) {
      io.to(`tournament-${match.tournamentId}`).emit('match:completed', match);
      io.to(`match-${id}`).emit('match:completed', match);
    }

    res.status(200).json({
      success: true,
      message: 'Match completed',
      data: match,
    });
  } catch (error) {
    console.error('Complete match error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing match',
      error: error.message,
    });
  }
};

// @desc    Record a point in live scoring
// @route   POST /api/matches/:id/score-point
// @access  Private (ADMIN, ORGANIZER, PLAYER - if participant)
const recordPoint = async (req, res) => {
  try {
    const { id } = req.params;
    const { scoringTeamId, pointType = 'RALLY' } = req.body;

    if (!scoringTeamId) {
      return res.status(400).json({
        success: false,
        message: 'Scoring team ID is required',
      });
    }

    // Get match to check tournament settings
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      select: { tournamentId: true },
    });

    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Check if player scoring is allowed
    const scoringCheck = await checkPlayerScoringAllowed(existingMatch.tournamentId, req.user.role);
    if (!scoringCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: scoringCheck.error,
      });
    }

    const result = await scoreService.recordPoint(id, scoringTeamId, pointType, req.user.id);

    // Emit real-time update
    if (io) {
      io.to(`match-${id}`).emit('match:pointScored', {
        matchId: id,
        ...result,
      });
    }

    // If match completed, update statistics and advance bracket
    if (result.matchComplete) {
      const match = await prisma.match.findUnique({
        where: { id },
        include: { tournament: true },
      });

      // Update player statistics
      await statisticsService.updateMatchPlayerStatistics(id);

      // Advance winner in bracket
      if (match.winnerId) {
        await bracketService.advanceWinner(id, match.winnerId);
      }

      // Emit match completion
      if (io) {
        io.to(`tournament-${match.tournamentId}`).emit('match:completed', match);
        io.to(`match-${id}`).emit('match:completed', match);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Point recorded successfully',
      data: result,
    });
  } catch (error) {
    console.error('Record point error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording point',
      error: error.message,
    });
  }
};

// @desc    Undo last point
// @route   POST /api/matches/:id/undo-point
// @access  Private (ADMIN, ORGANIZER, PLAYER - if participant)
const undoPoint = async (req, res) => {
  try {
    const { id } = req.params;

    // Get match to check tournament settings
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      select: { tournamentId: true },
    });

    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Check if player scoring is allowed
    const scoringCheck = await checkPlayerScoringAllowed(existingMatch.tournamentId, req.user.role);
    if (!scoringCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: scoringCheck.error,
      });
    }

    const result = await scoreService.undoLastPoint(id);

    // Emit real-time update
    if (io) {
      io.to(`match-${id}`).emit('match:undoPoint', {
        matchId: id,
        ...result,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Point undone successfully',
      data: result,
    });
  } catch (error) {
    console.error('Undo point error:', error);
    res.status(500).json({
      success: false,
      message: 'Error undoing point',
      error: error.message,
    });
  }
};

// @desc    Get current game score
// @route   GET /api/matches/:id/current-score
// @access  Public
const getCurrentScore = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await scoreService.getCurrentGameScore(id);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get current score error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting current score',
      error: error.message,
    });
  }
};

// @desc    Get match timeline (all events)
// @route   GET /api/matches/:id/timeline
// @access  Public
const getMatchTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    const { gameNumber } = req.query;

    const result = await scoreService.getMatchTimeline(id, gameNumber ? parseInt(gameNumber) : null);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get match timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting match timeline',
      error: error.message,
    });
  }
};

// @desc    Update serving team
// @route   PUT /api/matches/:id/serving-team
// @access  Private (ADMIN, ORGANIZER)
const updateServingTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { servingTeamId } = req.body;

    if (!servingTeamId) {
      return res.status(400).json({
        success: false,
        message: 'Serving team ID is required',
      });
    }

    const result = await scoreService.updateServingTeam(id, servingTeamId);

    // Emit real-time update
    if (io) {
      io.to(`match-${id}`).emit('match:servingTeamUpdated', {
        matchId: id,
        servingTeamId,
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Update serving team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating serving team',
      error: error.message,
    });
  }
};

// @desc    Record timeout or injury break
// @route   POST /api/matches/:id/timeout
// @access  Private (ADMIN, ORGANIZER)
const recordTimeout = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventType = 'TIMEOUT' } = req.body;

    if (!['TIMEOUT', 'INJURY_BREAK'].includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event type',
      });
    }

    const result = await scoreService.recordTimeout(id, eventType, req.user.id);

    // Emit real-time update
    if (io) {
      io.to(`match-${id}`).emit('match:timeout', {
        matchId: id,
        eventType,
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Record timeout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording timeout',
      error: error.message,
    });
  }
};

// @desc    Award walkover (no-show, forfeit, etc.)
// @route   PUT /api/matches/:id/walkover
// @access  Private (ADMIN, ORGANIZER only)
const awardWalkover = async (req, res) => {
  try {
    const { id } = req.params;
    const { winnerId, noShowTeamId, reason = 'NO_SHOW' } = req.body;

    // Validate reason
    const validReasons = ['NO_SHOW', 'FORFEIT', 'INJURY', 'DISQUALIFICATION'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Invalid walkover reason. Must be one of: ${validReasons.join(', ')}`,
      });
    }

    if (!winnerId) {
      return res.status(400).json({
        success: false,
        message: 'Winner ID is required',
      });
    }

    // Get the match with full details
    const existingMatch = await prisma.match.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            id: true,
            createdById: true,
          },
        },
        team1: true,
        team2: true,
      },
    });

    if (!existingMatch) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Only organizers/admins can award walkovers
    const userRole = req.user.role;
    const isCreator = existingMatch.tournament.createdById === req.user.id;
    const isAuthorized = isCreator || ['ROOT', 'ADMIN', 'ORGANIZER'].includes(userRole);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Only organizers can award walkovers',
      });
    }

    // Validate winnerId is one of the teams
    if (winnerId !== existingMatch.team1Id && winnerId !== existingMatch.team2Id) {
      return res.status(400).json({
        success: false,
        message: 'Winner must be one of the teams in this match',
      });
    }

    // If noShowTeamId is provided, validate it
    if (noShowTeamId && noShowTeamId !== existingMatch.team1Id && noShowTeamId !== existingMatch.team2Id) {
      return res.status(400).json({
        success: false,
        message: 'No-show team must be one of the teams in this match',
      });
    }

    // Update match with walkover
    const match = await prisma.match.update({
      where: { id },
      data: {
        matchStatus: 'COMPLETED',
        endTime: new Date(),
        winnerId,
        isWalkover: true,
        walkoverReason: reason,
        noShowTeamId: noShowTeamId || (winnerId === existingMatch.team1Id ? existingMatch.team2Id : existingMatch.team1Id),
        // Set score to W/O format (walkover)
        team1Score: winnerId === existingMatch.team1Id ? 'W/O' : '-',
        team2Score: winnerId === existingMatch.team2Id ? 'W/O' : '-',
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
          },
        },
      },
    });

    // Advance winner in bracket
    const bracketService = require('../services/bracket.service');
    try {
      await bracketService.advanceWinner(id, winnerId);
    } catch (bracketError) {
      console.log('Bracket advance info:', bracketError.message);
      // Non-critical - continue even if bracket advancement fails
    }

    // Emit socket event
    if (io) {
      io.to(`tournament-${match.tournamentId}`).emit('match:walkover', match);
      io.to(`match-${id}`).emit('match:walkover', match);
      io.to(`tournament-${match.tournamentId}`).emit('match:completed', match);
      io.to(`match-${id}`).emit('match:completed', match);
    }

    const reasonText = {
      NO_SHOW: 'No Show',
      FORFEIT: 'Forfeit',
      INJURY: 'Injury',
      DISQUALIFICATION: 'Disqualification',
    };

    res.status(200).json({
      success: true,
      message: `Walkover awarded due to ${reasonText[reason]}`,
      data: match,
    });
  } catch (error) {
    console.error('Award walkover error:', error);
    res.status(500).json({
      success: false,
      message: 'Error awarding walkover',
      error: error.message,
    });
  }
};

const deleteMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const match = await prisma.match.findUnique({
      where: { id },
      include: { tournament: true },
    });

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    if (match.matchStatus !== 'UPCOMING') {
      return res.status(400).json({
        success: false,
        message: 'Only UPCOMING matches can be deleted',
      });
    }

    // Check authorization
    const isOrganizer = match.tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this match' });
    }

    // Delete associated bracket node if exists, then the match
    await prisma.$transaction([
      prisma.bracketNode.deleteMany({ where: { matchId: id } }),
      prisma.matchEvent.deleteMany({ where: { matchId: id } }),
      prisma.match.delete({ where: { id } }),
    ]);

    if (io) {
      io.to(`tournament-${match.tournamentId}`).emit('match:deleted', { matchId: id, tournamentId: match.tournamentId });
    }

    res.status(200).json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({ success: false, message: 'Error deleting match', error: error.message });
  }
};

module.exports = {
  setSocketIO,
  getMatchesByTournament,
  getMatch,
  createMatch,
  updateMatch,
  updateMatchScore,
  startMatch,
  completeMatch,
  awardWalkover,
  recordPoint,
  undoPoint,
  getCurrentScore,
  getMatchTimeline,
  updateServingTeam,
  recordTimeout,
  deleteMatch,
};
