const { prisma } = require('../config/database');
const scoreService = require('../services/score.service');
const statisticsService = require('../services/statistics.service');
const bracketService = require('../services/bracket.service');

const PLAYER_SELECT = { id: true, username: true, fullName: true };
const MATCH_TEAM_INCLUDE = {
  team1: { include: { player1: { select: PLAYER_SELECT }, player2: { select: PLAYER_SELECT } } },
  team2: { include: { player1: { select: PLAYER_SELECT }, player2: { select: PLAYER_SELECT } } },
};

// Socket.io instance will be set from server.js
let io;

const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Helper function to check if player scoring is allowed for a tournament
const checkPlayerScoringAllowed = async (tournamentId, userRole, userId) => {
  // Get tournament to check status and scoring settings
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { scoringPermission: true, status: true },
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

  // ANYONE: all logged-in users can score
  if (tournament.scoringPermission === 'ANYONE') {
    return { allowed: true };
  }

  // PARTICIPANTS: only registered tournament participants can score
  if (tournament.scoringPermission === 'PARTICIPANTS') {
    const registration = await prisma.registration.findUnique({
      where: {
        userId_tournamentId: { userId, tournamentId },
      },
      select: { registrationStatus: true },
    });
    if (registration && registration.registrationStatus === 'APPROVED') {
      return { allowed: true };
    }
    return { allowed: false, error: 'Only tournament participants and organizers can update scores' };
  }

  // ORGANIZERS: only admins/organizers (already handled above)
  return { allowed: false, error: 'Only organizers can update scores for this tournament' };
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
        ...MATCH_TEAM_INCLUDE,
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
            scoringPermission: true,
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
        ...MATCH_TEAM_INCLUDE,
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
        ...MATCH_TEAM_INCLUDE,
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
        bracketNode: { select: { id: true } },
      },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    // Check if player scoring is allowed
    const scoringCheck = await checkPlayerScoringAllowed(match.tournamentId, req.user.role, req.user.id);
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
        ...MATCH_TEAM_INCLUDE,
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

        // Fire-and-forget: update stats and advance bracket without blocking response
        if (winnerId) {
          statisticsService.invalidateLeaderboardCache(match.tournamentId);
          statisticsService.updateMatchPlayerStatistics(id).catch(e => console.error('Stats update error:', e.message));

          // Only advance bracket if the match has a bracket node (skips standalone RR matches)
          if (match.bracketNode) {
            bracketService.advanceWinner(id, winnerId).catch(e => console.error('Bracket advance error:', e.message));
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
    const scoringCheck = await checkPlayerScoringAllowed(existingMatch.tournamentId, req.user.role, req.user.id);
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
        ...MATCH_TEAM_INCLUDE,
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
    const scoringCheck = await checkPlayerScoringAllowed(existingMatch.tournamentId, req.user.role, req.user.id);
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
        ...MATCH_TEAM_INCLUDE,
        bracketNode: { select: { id: true } },
      },
    });

    // Invalidate leaderboard cache and update stats
    statisticsService.invalidateLeaderboardCache(match.tournamentId);
    statisticsService.updateMatchPlayerStatistics(id).catch(e => console.error('Stats update error:', e.message));
    if (match.bracketNode) {
      bracketService.advanceWinner(id, winnerId).catch(e => console.error('Bracket advance error:', e.message));
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
    const scoringCheck = await checkPlayerScoringAllowed(existingMatch.tournamentId, req.user.role, req.user.id);
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
        include: { tournament: true, bracketNode: { select: { id: true } } },
      });

      // Fire-and-forget: invalidate cache, update stats, advance bracket
      statisticsService.invalidateLeaderboardCache(match.tournamentId);
      statisticsService.updateMatchPlayerStatistics(id).catch(e => console.error('Stats update error:', e.message));
      if (match.winnerId && match.bracketNode) {
        bracketService.advanceWinner(id, match.winnerId).catch(e => console.error('Bracket advance error:', e.message));
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
    const scoringCheck = await checkPlayerScoringAllowed(existingMatch.tournamentId, req.user.role, req.user.id);
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
        ...MATCH_TEAM_INCLUDE,
        bracketNode: { select: { id: true } },
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Fire-and-forget: invalidate cache, advance bracket
    statisticsService.invalidateLeaderboardCache(match.tournamentId);
    if (match.bracketNode) {
      bracketService.advanceWinner(id, winnerId).catch(e => console.error('Bracket advance error:', e.message));
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

    statisticsService.invalidateLeaderboardCache(match.tournamentId);

    if (io) {
      io.to(`tournament-${match.tournamentId}`).emit('match:deleted', { matchId: id, tournamentId: match.tournamentId });
    }

    res.status(200).json({ success: true, message: 'Match deleted successfully' });
  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({ success: false, message: 'Error deleting match' });
  }
};

// @desc    Auto-score a match with random results (dev/testing tool)
// @route   POST /api/matches/:id/auto-score
// @access  Private (protected by dev_auto_score feature flag)
const autoScoreMatch = async (req, res) => {
  try {
    const { id } = req.params;

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        ...MATCH_TEAM_INCLUDE,
        bracketNode: { select: { id: true } },
      },
    });

    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    if (match.matchStatus === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Match is already completed' });
    }

    if (!match.team1Id || !match.team2Id) {
      return res.status(400).json({ success: false, message: 'Match does not have both teams assigned' });
    }

    // Randomly pick winner
    const team1Wins = Math.random() < 0.5;
    const winnerId = team1Wins ? match.team1Id : match.team2Id;
    const loserScore = Math.floor(Math.random() * 19) + 1; // 1-19

    const team1Score = team1Wins ? '21' : String(loserScore);
    const team2Score = team1Wins ? String(loserScore) : '21';

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: {
        team1Score,
        team2Score,
        winnerId,
        matchStatus: 'COMPLETED',
        endTime: new Date(),
        startTime: match.startTime || new Date(),
      },
      include: {
        ...MATCH_TEAM_INCLUDE,
      },
    });

    // Emit socket events
    if (io) {
      io.to(`tournament-${match.tournamentId}`).emit('match:scoreUpdate', updatedMatch);
      io.to(`match-${id}`).emit('match:scoreUpdate', updatedMatch);
      io.to(`tournament-${match.tournamentId}`).emit('match:completed', updatedMatch);
      io.to(`match-${id}`).emit('match:completed', updatedMatch);
    }

    // Fire-and-forget: invalidate cache, update stats and advance bracket without blocking response
    statisticsService.invalidateLeaderboardCache(match.tournamentId);
    statisticsService.updateMatchPlayerStatistics(id).catch(e => console.error('Auto-score stats error:', e.message));
    if (match.bracketNode) {
      bracketService.advanceWinner(id, winnerId).catch(e => console.error('Auto-score bracket error:', e.message));
    }

    res.status(200).json({
      success: true,
      message: `Auto-scored: ${team1Score}-${team2Score}`,
      data: updatedMatch,
    });
  } catch (error) {
    console.error('Auto-score error:', error);
    res.status(500).json({ success: false, message: 'Error auto-scoring match' });
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
  autoScoreMatch,
};
