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
const { protect, authorize } = require('../middleware/supabaseAuth.middleware');
const { requireFlag } = require('../middleware/featureFlag.middleware');

const router = express.Router();

router.get('/tournament/:tournamentId', getMatchesByTournament);
router.get('/:id', getMatch);
router.post('/', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), createMatch);
router.put('/:id', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), updateMatch);
router.put('/:id/score', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), updateMatchScore);
router.put('/:id/start', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), startMatch);
router.put('/:id/complete', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), completeMatch);
router.put('/:id/walkover', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), awardWalkover);
router.delete('/:id', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), requireFlag('match_deletion'), deleteMatch);

// Live scoring endpoints
router.post('/:id/score-point', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), requireFlag('live_scoring'), recordPoint);
router.post('/:id/undo-point', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), requireFlag('live_scoring'), undoPoint);
router.get('/:id/current-score', getCurrentScore);
router.get('/:id/timeline', getMatchTimeline);
router.put('/:id/serving-team', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), updateServingTeam);
router.post('/:id/timeout', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), recordTimeout);

// Dev/testing endpoint
router.post('/:id/auto-score', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), requireFlag('dev_auto_score'), autoScoreMatch);

module.exports = router;
