const statisticsService = require('../services/statistics.service');

// @desc    Get global leaderboard
// @route   GET /api/statistics/leaderboard
// @access  Public
const getLeaderboard = async (req, res) => {
  try {
    const { page, limit, timeRange, tournamentType, minMatches } = req.query;

    const filters = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 100,
      timeRange: timeRange || 'all',
      tournamentType,
      minMatches: minMatches ? parseInt(minMatches) : 0,
    };

    const result = await statisticsService.getLeaderboard(filters);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting leaderboard',
    });
  }
};

// @desc    Get player statistics
// @route   GET /api/statistics/player/:userId
// @access  Public
const getPlayerStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await statisticsService.getPlayerStats(userId);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting player statistics',
    });
  }
};

// @desc    Get player match history
// @route   GET /api/statistics/player/:userId/history
// @access  Public
const getPlayerMatchHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;

    const result = await statisticsService.getPlayerMatchHistory(
      userId,
      limit ? parseInt(limit) : 10
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('Get player match history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting player match history',
    });
  }
};

// @desc    Get tournament leaderboard
// @route   GET /api/statistics/tournament/:tournamentId/leaderboard
// @access  Public
const getTournamentLeaderboard = async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const result = await statisticsService.getTournamentLeaderboard(tournamentId);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get tournament leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting tournament leaderboard',
    });
  }
};

// @desc    Force recalculation of global rankings
// @route   POST /api/statistics/recalculate
// @access  Private (ROOT only)
const recalculateRankings = async (req, res) => {
  try {
    const result = await statisticsService.updateGlobalRankings();

    res.status(200).json(result);
  } catch (error) {
    console.error('Recalculate rankings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error recalculating rankings',
    });
  }
};

// @desc    Initialize statistics for existing users
// @route   POST /api/statistics/initialize
// @access  Private (ROOT only)
const initializeStatistics = async (req, res) => {
  try {
    const result = await statisticsService.initializeStatisticsForExistingUsers();

    res.status(200).json(result);
  } catch (error) {
    console.error('Initialize statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing statistics',
    });
  }
};

module.exports = {
  getLeaderboard,
  getPlayerStats,
  getPlayerMatchHistory,
  getTournamentLeaderboard,
  recalculateRankings,
  initializeStatistics,
};
