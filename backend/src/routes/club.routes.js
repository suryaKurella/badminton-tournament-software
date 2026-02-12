const express = require('express');
const {
  getAllClubs,
  getMyClubs,
  getClub,
  createClub,
  updateClub,
  deleteClub,
  joinClub,
  leaveClub,
  approveMembership,
  rejectMembership,
  removeMember,
  updateMemberRole,
  getClubTournaments,
} = require('../controllers/club.controller');
const { protect, authorize, optionalAuth } = require('../middleware/supabaseAuth.middleware');

const router = express.Router();

// Public routes (with optional auth for filtering)
router.get('/', optionalAuth, getAllClubs);
router.get('/my-clubs', protect, getMyClubs);
router.get('/:id', optionalAuth, getClub);
router.get('/:id/tournaments', optionalAuth, getClubTournaments);

// Protected routes - Club CRUD
router.post('/', protect, authorize('ROOT', 'ADMIN'), createClub);
router.put('/:id', protect, updateClub);
router.delete('/:id', protect, deleteClub);

// Membership routes
router.post('/:id/join', protect, joinClub);
router.delete('/:id/leave', protect, leaveClub);
router.put('/:id/memberships/:membershipId/approve', protect, approveMembership);
router.put('/:id/memberships/:membershipId/reject', protect, rejectMembership);
router.delete('/:id/memberships/:membershipId', protect, removeMember);
router.put('/:id/memberships/:membershipId/role', protect, updateMemberRole);

module.exports = router;
