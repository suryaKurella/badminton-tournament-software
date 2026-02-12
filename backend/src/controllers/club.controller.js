const { prisma } = require('../config/database');

// @desc    Get all clubs
// @route   GET /api/clubs
// @access  Public (with optionalAuth for filtering)
const getAllClubs = async (req, res) => {
  try {
    const { search, visibility, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    // Filter by visibility - show public clubs + user's private clubs if authenticated
    if (req.user) {
      // For authenticated users, show public clubs OR clubs they're a member of
      where.OR = [
        { visibility: 'PUBLIC' },
        {
          memberships: {
            some: {
              userId: req.user.id,
              status: 'APPROVED'
            }
          }
        }
      ];
    } else {
      // For anonymous users, only show public clubs
      where.visibility = 'PUBLIC';
    }

    // Filter by visibility if explicitly requested
    if (visibility && visibility !== 'all') {
      where.visibility = visibility;
    }

    // Search by name
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const total = await prisma.club.count({ where });

    const clubs = await prisma.club.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        memberships: {
          where: { status: 'APPROVED' },
          select: { id: true },
        },
        tournaments: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include counts
    const clubsWithCounts = clubs.map(club => ({
      ...club,
      memberCount: club.memberships.length,
      tournamentCount: club.tournaments.length,
      memberships: undefined,
      tournaments: undefined,
    }));

    res.status(200).json({
      success: true,
      count: clubs.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: clubsWithCounts,
    });
  } catch (error) {
    console.error('Error fetching clubs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clubs',
      error: error.message,
    });
  }
};

// @desc    Get user's clubs
// @route   GET /api/clubs/my-clubs
// @access  Private
const getMyClubs = async (req, res) => {
  try {
    const memberships = await prisma.clubMembership.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        club: {
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
            memberships: {
              where: { status: 'APPROVED' },
              select: { id: true },
            },
            tournaments: {
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include counts and membership info
    const clubs = memberships.map(m => ({
      ...m.club,
      memberCount: m.club.memberships.length,
      tournamentCount: m.club.tournaments.length,
      memberships: undefined,
      tournaments: undefined,
      myMembership: {
        id: m.id,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
      },
    }));

    res.status(200).json({
      success: true,
      count: clubs.length,
      data: clubs,
    });
  } catch (error) {
    console.error('Error fetching user clubs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your clubs',
      error: error.message,
    });
  }
};

// @desc    Get single club
// @route   GET /api/clubs/:id
// @access  Public (private clubs require membership)
const getClub = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        memberships: {
          where: { status: 'APPROVED' },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: [
            { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
            { joinedAt: 'asc' },
          ],
        },
        tournaments: {
          where: {
            status: { not: 'CANCELLED' },
          },
          orderBy: { startDate: 'desc' },
          take: 10,
          include: {
            registrations: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    // Check access for private clubs
    if (club.visibility === 'PRIVATE') {
      const isAdmin = req.user && (req.user.role === 'ROOT' || req.user.role === 'ADMIN');
      const isMember = req.user && club.memberships.some(m => m.user.id === req.user.id);

      if (!isAdmin && !isMember) {
        return res.status(403).json({
          success: false,
          message: 'This is a private club. You must be a member to view it.',
        });
      }
    }

    // Get pending memberships for club admins
    let pendingMemberships = [];
    if (req.user) {
      const userMembership = club.memberships.find(m => m.user.id === req.user.id);
      const isClubAdmin = userMembership && (userMembership.role === 'OWNER' || userMembership.role === 'ADMIN');
      const isSiteAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

      if (isClubAdmin || isSiteAdmin) {
        pendingMemberships = await prisma.clubMembership.findMany({
          where: {
            clubId: id,
            status: 'PENDING',
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
      }
    }

    // Get user's membership status
    let myMembership = null;
    if (req.user) {
      const membership = await prisma.clubMembership.findUnique({
        where: {
          clubId_userId: {
            clubId: id,
            userId: req.user.id,
          },
        },
      });
      if (membership) {
        myMembership = {
          id: membership.id,
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joinedAt,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...club,
        memberCount: club.memberships.length,
        tournamentCount: club.tournaments.length,
        pendingMemberships,
        myMembership,
      },
    });
  } catch (error) {
    console.error('Error fetching club:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching club',
      error: error.message,
    });
  }
};

// @desc    Create club
// @route   POST /api/clubs
// @access  Private (ADMIN, ROOT only)
const createClub = async (req, res) => {
  try {
    const { name, description, visibility = 'PUBLIC' } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Club name is required',
      });
    }

    // Create club with creator as OWNER
    const club = await prisma.club.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        visibility,
        createdById: req.user.id,
        memberships: {
          create: {
            userId: req.user.id,
            role: 'OWNER',
            status: 'APPROVED',
            joinedAt: new Date(),
          },
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Club created successfully',
      data: club,
    });
  } catch (error) {
    console.error('Error creating club:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating club',
      error: error.message,
    });
  }
};

// @desc    Update club
// @route   PUT /api/clubs/:id
// @access  Private (Club OWNER/ADMIN, or ROOT/ADMIN)
const updateClub = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, visibility } = req.body;

    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { userId: req.user.id },
        },
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    // Check authorization
    const userMembership = club.memberships[0];
    const isClubAdmin = userMembership && (userMembership.role === 'OWNER' || userMembership.role === 'ADMIN');
    const isSiteAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isClubAdmin && !isSiteAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this club',
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (visibility !== undefined) updateData.visibility = visibility;

    const updatedClub = await prisma.club.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Club updated successfully',
      data: updatedClub,
    });
  } catch (error) {
    console.error('Error updating club:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating club',
      error: error.message,
    });
  }
};

// @desc    Delete club
// @route   DELETE /api/clubs/:id
// @access  Private (Club OWNER, or ROOT)
const deleteClub = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { userId: req.user.id },
        },
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    // Check authorization - only OWNER or ROOT can delete
    const userMembership = club.memberships[0];
    const isClubOwner = userMembership && userMembership.role === 'OWNER';
    const isRoot = req.user.role === 'ROOT';

    if (!isClubOwner && !isRoot) {
      return res.status(403).json({
        success: false,
        message: 'Only the club owner can delete this club',
      });
    }

    // Delete club (memberships will cascade delete)
    await prisma.club.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: 'Club deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting club:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting club',
      error: error.message,
    });
  }
};

// @desc    Join club
// @route   POST /api/clubs/:id/join
// @access  Private
const joinClub = async (req, res) => {
  try {
    const { id } = req.params;

    const club = await prisma.club.findUnique({
      where: { id },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    // Check if already a member
    const existingMembership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: {
          clubId: id,
          userId: req.user.id,
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.status === 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'You are already a member of this club',
        });
      }
      if (existingMembership.status === 'PENDING') {
        return res.status(400).json({
          success: false,
          message: 'Your membership request is pending approval',
        });
      }
      if (existingMembership.status === 'REJECTED') {
        return res.status(400).json({
          success: false,
          message: 'Your membership request was rejected',
        });
      }
    }

    // For public clubs, auto-approve. For private clubs, set as pending
    const isAutoApproved = club.visibility === 'PUBLIC';

    const membership = await prisma.clubMembership.create({
      data: {
        clubId: id,
        userId: req.user.id,
        role: 'MEMBER',
        status: isAutoApproved ? 'APPROVED' : 'PENDING',
        joinedAt: isAutoApproved ? new Date() : null,
      },
      include: {
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: isAutoApproved
        ? `You have joined ${club.name}`
        : 'Your membership request has been submitted for approval',
      data: membership,
    });
  } catch (error) {
    console.error('Error joining club:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining club',
      error: error.message,
    });
  }
};

// @desc    Leave club
// @route   DELETE /api/clubs/:id/leave
// @access  Private
const leaveClub = async (req, res) => {
  try {
    const { id } = req.params;

    const membership = await prisma.clubMembership.findUnique({
      where: {
        clubId_userId: {
          clubId: id,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'You are not a member of this club',
      });
    }

    // Owners cannot leave - they must transfer ownership first
    if (membership.role === 'OWNER') {
      return res.status(400).json({
        success: false,
        message: 'As the owner, you cannot leave the club. Transfer ownership first or delete the club.',
      });
    }

    await prisma.clubMembership.delete({
      where: { id: membership.id },
    });

    res.status(200).json({
      success: true,
      message: 'You have left the club',
    });
  } catch (error) {
    console.error('Error leaving club:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving club',
      error: error.message,
    });
  }
};

// @desc    Approve membership request
// @route   PUT /api/clubs/:id/memberships/:membershipId/approve
// @access  Private (Club OWNER/ADMIN)
const approveMembership = async (req, res) => {
  try {
    const { id, membershipId } = req.params;

    // Verify club exists and user has permission
    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { userId: req.user.id },
        },
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    const userMembership = club.memberships[0];
    const isClubAdmin = userMembership && (userMembership.role === 'OWNER' || userMembership.role === 'ADMIN');
    const isSiteAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isClubAdmin && !isSiteAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve memberships',
      });
    }

    const membership = await prisma.clubMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.clubId !== id) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found',
      });
    }

    if (membership.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Membership is not pending approval',
      });
    }

    const updatedMembership = await prisma.clubMembership.update({
      where: { id: membershipId },
      data: {
        status: 'APPROVED',
        joinedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Membership approved',
      data: updatedMembership,
    });
  } catch (error) {
    console.error('Error approving membership:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving membership',
      error: error.message,
    });
  }
};

// @desc    Reject membership request
// @route   PUT /api/clubs/:id/memberships/:membershipId/reject
// @access  Private (Club OWNER/ADMIN)
const rejectMembership = async (req, res) => {
  try {
    const { id, membershipId } = req.params;

    // Verify club exists and user has permission
    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { userId: req.user.id },
        },
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    const userMembership = club.memberships[0];
    const isClubAdmin = userMembership && (userMembership.role === 'OWNER' || userMembership.role === 'ADMIN');
    const isSiteAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isClubAdmin && !isSiteAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject memberships',
      });
    }

    const membership = await prisma.clubMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.clubId !== id) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found',
      });
    }

    if (membership.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Membership is not pending',
      });
    }

    const updatedMembership = await prisma.clubMembership.update({
      where: { id: membershipId },
      data: { status: 'REJECTED' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Membership rejected',
      data: updatedMembership,
    });
  } catch (error) {
    console.error('Error rejecting membership:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting membership',
      error: error.message,
    });
  }
};

// @desc    Remove member from club
// @route   DELETE /api/clubs/:id/memberships/:membershipId
// @access  Private (Club OWNER/ADMIN, or self)
const removeMember = async (req, res) => {
  try {
    const { id, membershipId } = req.params;

    const membership = await prisma.clubMembership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    if (!membership || membership.clubId !== id) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found',
      });
    }

    // Check if removing self
    const isRemovingSelf = membership.userId === req.user.id;

    if (isRemovingSelf) {
      // Use leave logic - owners can't remove themselves
      if (membership.role === 'OWNER') {
        return res.status(400).json({
          success: false,
          message: 'As the owner, you cannot remove yourself. Transfer ownership first or delete the club.',
        });
      }
    } else {
      // Check if user has permission to remove others
      const club = await prisma.club.findUnique({
        where: { id },
        include: {
          memberships: {
            where: { userId: req.user.id },
          },
        },
      });

      const userMembership = club.memberships[0];
      const isClubAdmin = userMembership && (userMembership.role === 'OWNER' || userMembership.role === 'ADMIN');
      const isSiteAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

      if (!isClubAdmin && !isSiteAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to remove members',
        });
      }

      // Cannot remove the owner
      if (membership.role === 'OWNER') {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the club owner',
        });
      }

      // ADMINs cannot remove other ADMINs (only OWNER can)
      if (membership.role === 'ADMIN' && userMembership?.role !== 'OWNER' && !isSiteAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only the club owner can remove admins',
        });
      }
    }

    await prisma.clubMembership.delete({
      where: { id: membershipId },
    });

    res.status(200).json({
      success: true,
      message: isRemovingSelf ? 'You have left the club' : `${membership.user.username || membership.user.fullName} has been removed from the club`,
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing member',
      error: error.message,
    });
  }
};

// @desc    Update member role
// @route   PUT /api/clubs/:id/memberships/:membershipId/role
// @access  Private (Club OWNER only)
const updateMemberRole = async (req, res) => {
  try {
    const { id, membershipId } = req.params;
    const { role } = req.body;

    if (!role || !['ADMIN', 'MEMBER'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be ADMIN or MEMBER.',
      });
    }

    // Verify club exists and user is the owner
    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { userId: req.user.id },
        },
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    const userMembership = club.memberships[0];
    const isClubOwner = userMembership && userMembership.role === 'OWNER';
    const isRoot = req.user.role === 'ROOT';

    if (!isClubOwner && !isRoot) {
      return res.status(403).json({
        success: false,
        message: 'Only the club owner can change member roles',
      });
    }

    const membership = await prisma.clubMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.clubId !== id) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found',
      });
    }

    // Cannot change owner's role
    if (membership.role === 'OWNER') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change the owner\'s role',
      });
    }

    // Cannot change own role (as owner)
    if (membership.userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role',
      });
    }

    const updatedMembership = await prisma.clubMembership.update({
      where: { id: membershipId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: `Member role updated to ${role}`,
      data: updatedMembership,
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating member role',
      error: error.message,
    });
  }
};

// @desc    Get club tournaments
// @route   GET /api/clubs/:id/tournaments
// @access  Public (private clubs require membership)
const getClubTournaments = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const club = await prisma.club.findUnique({
      where: { id },
      include: {
        memberships: req.user ? {
          where: { userId: req.user.id, status: 'APPROVED' },
        } : false,
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    // Check access for private clubs
    if (club.visibility === 'PRIVATE') {
      const isAdmin = req.user && (req.user.role === 'ROOT' || req.user.role === 'ADMIN');
      const isMember = req.user && club.memberships && club.memberships.length > 0;

      if (!isAdmin && !isMember) {
        return res.status(403).json({
          success: false,
          message: 'This is a private club. You must be a member to view tournaments.',
        });
      }
    }

    const where = { clubId: id };
    if (status) {
      where.status = status;
    }

    const total = await prisma.tournament.count({ where });

    const tournaments = await prisma.tournament.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        registrations: {
          select: { id: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    res.status(200).json({
      success: true,
      count: tournaments.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      data: tournaments,
    });
  } catch (error) {
    console.error('Error fetching club tournaments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching club tournaments',
      error: error.message,
    });
  }
};

module.exports = {
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
};
