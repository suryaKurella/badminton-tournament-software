const express = require('express');
const {
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
} = require('../controllers/match.controller');
const { protect, authorize, optionalAuth } = require('../middleware/supabaseAuth.middleware');
const { requireFlag } = require('../middleware/featureFlag.middleware');
const { matchLockMiddleware } = require('../utils/matchLock');

const router = express.Router();

router.get('/tournament/:tournamentId', optionalAuth, getMatchesByTournament);
router.get('/:id', getMatch);
router.post('/', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), createMatch);
router.put('/:id', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), matchLockMiddleware, updateMatch);
router.put('/:id/score', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), matchLockMiddleware, updateMatchScore);
router.put('/:id/start', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), matchLockMiddleware, startMatch);
router.put('/:id/complete', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), matchLockMiddleware, completeMatch);
router.put('/:id/walkover', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), matchLockMiddleware, awardWalkover);
router.delete('/:id', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), requireFlag('match_deletion'), matchLockMiddleware, deleteMatch);

// Live scoring endpoints
router.post('/:id/score-point', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), requireFlag('live_scoring'), matchLockMiddleware, recordPoint);
router.post('/:id/undo-point', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), requireFlag('live_scoring'), matchLockMiddleware, undoPoint);
router.get('/:id/current-score', getCurrentScore);
router.get('/:id/timeline', getMatchTimeline);
router.put('/:id/serving-team', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), matchLockMiddleware, updateServingTeam);
router.post('/:id/timeout', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), matchLockMiddleware, recordTimeout);

// Dev/testing endpoint
router.post('/:id/auto-score', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), requireFlag('dev_auto_score'), matchLockMiddleware, autoScoreMatch);

module.exports = router;
