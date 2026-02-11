const express = require('express');
const { protect } = require('../middleware/supabaseAuth.middleware');
const { prisma } = require('../config/database');

const router = express.Router();

// Get current user profile
router.get('/me', protect, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message,
    });
  }
});

// Check username availability
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Validate username format
    if (!username || username.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long',
      });
    }

    // Check if username contains only allowed characters (letters, numbers, underscores, hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: 'Username can only contain letters, numbers, underscores, and hyphens',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    res.status(200).json({
      success: true,
      available: !existingUser,
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking username availability',
      error: error.message,
    });
  }
});

// Update user profile
router.put('/me', protect, async (req, res) => {
  try {
    const { username, fullName, phoneNumber, avatarUrl } = req.body;

    // If username is being updated, check if it's available
    if (username) {
      // Validate username format
      if (username.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters long',
        });
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return res.status(400).json({
          success: false,
          message: 'Username can only contain letters, numbers, underscores, and hyphens',
        });
      }

      // Check if username is already taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      });

      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken',
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(username && { username: username.toLowerCase() }),
        ...(fullName !== undefined && { fullName }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update user error:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating user profile',
      error: error.message,
    });
  }
});

module.exports = router;
