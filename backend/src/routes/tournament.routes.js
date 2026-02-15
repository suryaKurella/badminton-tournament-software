const express = require('express');
const {
  getAllTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  registerForTournament,
  deregisterFromTournament,
  approveRegistration,
  approveAllPendingRegistrations,
  rejectRegistration,
  unregisterParticipant,
  togglePauseTournament,
  toggleRegistration,
  getBracket,
  regenerateBracket,
  replaceNoShowTeam,
  resetTournament,
  getGroupStandings,
  completeGroupStage,
  assignToGroup,
  getGroupAssignments,
  autoAssignGroups,
  shuffleGroups,
  roundRobinToKnockout,
  declareWinners,
  getPotentialPartners,
  assignPartner,
  approveTeamWithPendingPartner,
  adminRegisterTeam,
  adminRegisterPlayer,
} = require('../controllers/tournament.controller');
const { protect, authorize, optionalAuth } = require('../middleware/supabaseAuth.middleware');

const router = express.Router();

router.get('/', optionalAuth, getAllTournaments);
router.get('/:id', optionalAuth, getTournament);
router.post('/', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), createTournament);
router.put('/:id', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), updateTournament);
router.delete('/:id', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), deleteTournament);
router.post('/:id/register', protect, registerForTournament);
router.post('/:id/register-team', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), adminRegisterTeam);
router.post('/:id/register-player', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), adminRegisterPlayer);
router.delete('/:id/register', protect, deregisterFromTournament);
router.get('/:id/potential-partners', protect, getPotentialPartners);
router.put('/:id/registrations/approve-all', protect, approveAllPendingRegistrations);
router.put('/:id/registrations/:registrationId/approve', protect, approveRegistration);
router.put('/:id/registrations/:registrationId/approve-team', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), approveTeamWithPendingPartner);
router.put('/:id/registrations/:registrationId/reject', protect, rejectRegistration);
router.delete('/:id/registrations/:registrationId', protect, unregisterParticipant);
router.put('/:id/toggle-pause', protect, togglePauseTournament);
router.put('/:id/toggle-registration', protect, toggleRegistration);
router.get('/:id/bracket', optionalAuth, getBracket);
router.post('/:id/regenerate-bracket', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), regenerateBracket);
router.put('/:id/matches/:matchId/replace-team', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), replaceNoShowTeam);
router.post('/:id/reset', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), resetTournament);

// Group stage routes
router.get('/:id/group-standings', optionalAuth, getGroupStandings);
router.post('/:id/complete-group-stage', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), completeGroupStage);

// Manual group assignment routes
router.get('/:id/group-assignments', optionalAuth, getGroupAssignments);
router.put('/:id/registrations/:registrationId/assign-group', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), assignToGroup);
router.put('/:id/registrations/:registrationId/assign-partner', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), assignPartner);
router.post('/:id/auto-assign-groups', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), autoAssignGroups);
router.post('/:id/shuffle-groups', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), shuffleGroups);

// Round Robin completion routes
router.post('/:id/round-robin-to-knockout', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), roundRobinToKnockout);
router.post('/:id/declare-winners', protect, authorize('ROOT', 'ADMIN', 'ORGANIZER'), declareWinners);

module.exports = router;
