const { prisma } = require('../config/database');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (ADMIN)
const getAllUsers = async (req, res) => {
  try {
    const { role, search, limit = 50 } = req.query;

    const where = {};
    if (role) where.role = role;

    // Add search functionality for finding users by name/username/email
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      take: parseInt(limit),
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        phoneNumber: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private (Own profile or ADMIN)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phoneNumber, avatarUrl } = req.body;

    // Check if user is updating their own profile or is admin
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this user',
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        fullName,
        phoneNumber,
        avatarUrl,
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
        updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (ADMIN)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.user.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
};
