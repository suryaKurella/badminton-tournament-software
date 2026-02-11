const express = require('express');
const {
  getLeaderboard,
  getPlayerStats,
  getPlayerMatchHistory,
  getTournamentLeaderboard,
  recalculateRankings,
  initializeStatistics,
} = require('../controllers/statistics.controller');
const { protect, authorize } = require('../middleware/supabaseAuth.middleware');

const router = express.Router();

// Public endpoints
router.get('/leaderboard', getLeaderboard);
router.get('/player/:userId', getPlayerStats);
router.get('/player/:userId/history', getPlayerMatchHistory);
router.get('/tournament/:tournamentId/leaderboard', getTournamentLeaderboard);

// ROOT only endpoints
router.post('/recalculate', protect, authorize('ROOT'), recalculateRankings);
router.post('/initialize', protect, authorize('ROOT'), initializeStatistics);

module.exports = router;
