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
} = require('../controllers/match.controller');
const { protect, authorize } = require('../middleware/supabaseAuth.middleware');

const router = express.Router();

router.get('/tournament/:tournamentId', getMatchesByTournament);
router.get('/:id', getMatch);
router.post('/', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), createMatch);
router.put('/:id', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), updateMatch);
router.put('/:id/score', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), updateMatchScore);
router.put('/:id/start', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), startMatch);
router.put('/:id/complete', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), completeMatch);
router.put('/:id/walkover', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), awardWalkover);

// Live scoring endpoints
router.post('/:id/score-point', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), recordPoint);
router.post('/:id/undo-point', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER', 'PLAYER'), undoPoint);
router.get('/:id/current-score', getCurrentScore);
router.get('/:id/timeline', getMatchTimeline);
router.put('/:id/serving-team', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), updateServingTeam);
router.post('/:id/timeout', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), recordTimeout);

module.exports = router;
