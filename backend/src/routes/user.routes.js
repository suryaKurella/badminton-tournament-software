const express = require('express');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/supabaseAuth.middleware');

const router = express.Router();

router.get('/', protect, authorize('ROOT', 'ADMIN'), getAllUsers);
router.get('/:id', protect, getUserById);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, authorize('ROOT', 'ADMIN'), deleteUser);

module.exports = router;
