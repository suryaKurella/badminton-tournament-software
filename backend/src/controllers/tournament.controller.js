const { prisma } = require('../config/database');
const bracketService = require('../services/bracket.service');

// @desc    Get all tournaments
// @route   GET /api/tournaments
// @access  Public
const getAllTournaments = async (req, res) => {
  try {
    const {
      status,
      type,
      format,
      page = 1,
      limit = 10,
      sortBy = 'startDate',
      sortOrder = 'asc',
    } = req.query;

    const where = {};
    if (type) where.tournamentType = type;
    if (format) where.format = format;

    // Hide DRAFT tournaments from regular players
    const isOrganizer = req.user && (req.user.role === 'ROOT' || req.user.role === 'ADMIN' || req.user.role === 'ORGANIZER');

    if (status) {
      // If a specific status is requested
      if (!isOrganizer && status === 'DRAFT') {
        // Non-organizers can't filter by DRAFT
        where.status = { not: 'DRAFT' };
      } else {
        where.status = status;
      }
    } else {
      // No status filter - just hide DRAFT from non-organizers
      if (!isOrganizer) {
        where.status = { not: 'DRAFT' };
      }
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
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
          select: {
            id: true,
            registrationStatus: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
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
    console.error('Get tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tournaments',
      error: error.message,
    });
  }
};

// @desc    Get single tournament
// @route   GET /api/tournaments/:id
// @access  Public
const getTournament = async (req, res) => {
  try {
    console.log('=== GET TOURNAMENT REQUEST ===');
    console.log('Tournament ID:', req.params.id);
    console.log('User:', req.user ? { id: req.user.id, role: req.user.role } : 'No user (unauthenticated)');

    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        teams: {
          include: {
            player1: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
            player2: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
        matches: {
          include: {
            team1: {
              include: {
                player1: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                  },
                },
                player2: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                  },
                },
              },
            },
            team2: {
              include: {
                player1: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                  },
                },
                player2: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            matches: true,
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // For doubles/mixed tournaments, fetch partner user info for registrations with partnerId
    if (tournament.tournamentType === 'DOUBLES' || tournament.tournamentType === 'MIXED') {
      const partnerIds = tournament.registrations
        .filter(reg => reg.partnerId)
        .map(reg => reg.partnerId);

      if (partnerIds.length > 0) {
        const partnerUsers = await prisma.user.findMany({
          where: { id: { in: partnerIds } },
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        });

        const partnerUserMap = partnerUsers.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});

        // Add partnerUser to each registration that has a partnerId
        tournament.registrations = tournament.registrations.map(reg => ({
          ...reg,
          partnerUser: reg.partnerId ? partnerUserMap[reg.partnerId] || null : null,
        }));
      }
    }

    // Hide DRAFT tournaments from regular players (but allow creator to view)
    const isOrganizer = req.user && (req.user.role === 'ROOT' || req.user.role === 'ADMIN' || req.user.role === 'ORGANIZER');
    const isCreator = req.user && tournament.createdById === req.user.id;

    if (tournament.status === 'DRAFT' && !isOrganizer && !isCreator) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    res.status(200).json({
      success: true,
      data: tournament,
    });
  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tournament',
      error: error.message,
    });
  }
};

// @desc    Create new tournament
// @route   POST /api/tournaments
// @access  Private (ADMIN, ORGANIZER)
const createTournament = async (req, res) => {
  try {
    console.log('=== CREATE TOURNAMENT REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      name,
      description,
      startDate,
      endDate,
      location,
      maxParticipants,
      tournamentType,
      format,
      status,
      numberOfGroups,
      advancingPerGroup,
      clubId,
    } = req.body;

    console.log('Extracted status:', status);
    console.log('Status type:', typeof status);

    const finalStatus = status || 'DRAFT';
    console.log('Final status to be used:', finalStatus);

    // Build tournament data
    const tournamentData = {
      name,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location,
      maxParticipants: parseInt(maxParticipants),
      tournamentType,
      format: format || 'SINGLE_ELIMINATION',
      createdById: req.user.id,
      status: finalStatus,
    };

    // Add group stage settings if format is GROUP_KNOCKOUT
    if (format === 'GROUP_KNOCKOUT') {
      tournamentData.numberOfGroups = numberOfGroups ? parseInt(numberOfGroups) : 4;
      tournamentData.advancingPerGroup = advancingPerGroup ? parseInt(advancingPerGroup) : 2;
    }

    // Add club association if provided
    if (clubId) {
      tournamentData.clubId = clubId;
    }

    const tournament = await prisma.tournament.create({
      data: tournamentData,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log('Created tournament status:', tournament.status);
    console.log('Created tournament ID:', tournament.id);

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      data: tournament,
    });
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating tournament',
      error: error.message,
    });
  }
};

// @desc    Update tournament
// @route   PUT /api/tournaments/:id
// @access  Private (ADMIN, ORGANIZER - owner only)
const updateTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the creator, admin, or root
    if (tournament.createdById !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'ROOT') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this tournament',
      });
    }

    // Prevent changing tournament type or format when brackets are generated
    console.log('=== UPDATE TOURNAMENT ===');
    console.log('Tournament ID:', id);
    console.log('Bracket Generated:', tournament.bracketGenerated);
    console.log('Current Type:', tournament.tournamentType, '| Requested Type:', updateData.tournamentType);
    console.log('Current Format:', tournament.format, '| Requested Format:', updateData.format);

    if (tournament.bracketGenerated) {
      if (updateData.tournamentType && updateData.tournamentType !== tournament.tournamentType) {
        console.log('BLOCKED: Attempted to change tournament type after brackets generated');
        return res.status(400).json({
          success: false,
          message: 'Cannot change tournament type after brackets have been generated. Please reset the tournament first.',
        });
      }
      if (updateData.format && updateData.format !== tournament.format) {
        console.log('BLOCKED: Attempted to change tournament format after brackets generated');
        return res.status(400).json({
          success: false,
          message: 'Cannot change tournament format after brackets have been generated. Please reset the tournament first.',
        });
      }
    }

    // Convert dates if provided
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }
    if (updateData.maxParticipants) {
      updateData.maxParticipants = parseInt(updateData.maxParticipants);
    }
    // Convert group stage settings to integers if provided
    if (updateData.numberOfGroups) {
      updateData.numberOfGroups = parseInt(updateData.numberOfGroups);
    }
    if (updateData.advancingPerGroup) {
      updateData.advancingPerGroup = parseInt(updateData.advancingPerGroup);
    }

    // Handle clubId - convert empty string to null to clear association
    if (updateData.clubId === '') {
      updateData.clubId = null;
    }

    // Set startedAt timestamp when tournament becomes active
    // Also reset pause-related fields to start fresh
    if (updateData.status === 'ACTIVE' && tournament.status !== 'ACTIVE') {
      updateData.startedAt = new Date();
      updateData.totalPausedTime = 0;
      updateData.isPaused = false;
      updateData.pausedAt = null;

      // Generate bracket if not already generated
      if (!tournament.bracketGenerated) {
        try {
          await bracketService.generateBracket(
            id,
            tournament.format,
            tournament.seedingMethod || 'RANDOM'
          );
        } catch (bracketError) {
          console.error('Error generating bracket:', bracketError);
          // Return the error to user so they can fix the issue
          return res.status(400).json({
            success: false,
            message: bracketError.message || 'Failed to generate bracket. Please check registrations.',
          });
        }
      }
    }

    const updatedTournament = await prisma.tournament.update({
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
        club: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournament:updated', {
        tournamentId: id,
        tournament: updatedTournament,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tournament updated successfully',
      data: updatedTournament,
    });
  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating tournament',
      error: error.message,
    });
  }
};

// @desc    Delete tournament
// @route   DELETE /api/tournaments/:id
// @access  Private (ADMIN, ORGANIZER - owner only)
const deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('=== Delete Tournament Request ===');
    console.log('Tournament ID:', id);
    console.log('User ID:', req.user?.id);
    console.log('User Role:', req.user?.role);

    // Check if tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      console.log('Tournament not found');
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    console.log('Tournament found:', tournament.name);
    console.log('Created by:', tournament.createdById);

    // Check if user is the creator, admin, or root
    if (tournament.createdById !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'ROOT') {
      console.log('User not authorized to delete');
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this tournament',
      });
    }

    console.log('Authorization passed, deleting tournament...');
    await prisma.tournament.delete({
      where: { id },
    });

    console.log('Tournament deleted successfully');
    res.status(200).json({
      success: true,
      message: 'Tournament deleted successfully',
    });
  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting tournament',
      error: error.message,
    });
  }
};

// @desc    Register for tournament
// @route   POST /api/tournaments/:id/register
// @access  Private
const registerForTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const { partnerId } = req.body;

    // Check if tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if tournament is open for registration
    if (tournament.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: 'Tournament is not open for registration',
      });
    }

    // Check if registration has been closed by admin
    if (tournament.registrationClosed) {
      return res.status(400).json({
        success: false,
        message: 'Registration has been closed for this tournament',
      });
    }

    // Check if tournament is full
    if (tournament._count.registrations >= tournament.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Tournament is full',
      });
    }

    // Check if user is already registered
    const existingRegistration = await prisma.registration.findUnique({
      where: {
        userId_tournamentId: {
          userId: req.user.id,
          tournamentId: id,
        },
      },
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this tournament',
      });
    }

    const registration = await prisma.registration.create({
      data: {
        userId: req.user.id,
        tournamentId: id,
        partnerId,
        registrationStatus: 'PENDING',
        paymentStatus: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            tournamentType: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: registration,
    });
  } catch (error) {
    console.error('Tournament registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering for tournament',
      error: error.message,
    });
  }
};

const deregisterFromTournament = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if tournament exists
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is registered
    const registration = await prisma.registration.findUnique({
      where: {
        userId_tournamentId: {
          userId: req.user.id,
          tournamentId: id,
        },
      },
    });

    if (!registration) {
      return res.status(400).json({
        success: false,
        message: 'You are not registered for this tournament',
      });
    }

    // Don't allow deregistration if tournament has started
    if (tournament.status === 'ACTIVE' || tournament.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot deregister from an active or completed tournament',
      });
    }

    // Delete the registration
    await prisma.registration.delete({
      where: {
        userId_tournamentId: {
          userId: req.user.id,
          tournamentId: id,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Successfully deregistered from tournament',
    });
  } catch (error) {
    console.error('Tournament deregistration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deregistering from tournament',
      error: error.message,
    });
  }
};

// @desc    Approve a tournament registration
// @route   PUT /api/tournaments/:id/registrations/:registrationId/approve
// @access  Private (Organizer/Admin only)
const approveRegistration = async (req, res) => {
  try {
    const { id, registrationId } = req.params;

    // Get tournament with organizer info
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        name: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the organizer or admin
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can approve registrations',
      });
    }

    // Get the registration
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    // Check if registration belongs to this tournament
    if (registration.tournamentId !== id) {
      return res.status(400).json({
        success: false,
        message: 'Registration does not belong to this tournament',
      });
    }

    // Update registration status to APPROVED
    const updatedRegistration = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        registrationStatus: 'APPROVED',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Registration approved successfully',
      data: updatedRegistration,
    });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving registration',
      error: error.message,
    });
  }
};

// @desc    Reject a tournament registration
// @route   PUT /api/tournaments/:id/registrations/:registrationId/reject
// @access  Private (Organizer/Admin only)
const rejectRegistration = async (req, res) => {
  try {
    const { id, registrationId } = req.params;

    // Get tournament with organizer info
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        name: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the organizer or admin
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can reject registrations',
      });
    }

    // Get the registration
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    // Check if registration belongs to this tournament
    if (registration.tournamentId !== id) {
      return res.status(400).json({
        success: false,
        message: 'Registration does not belong to this tournament',
      });
    }

    // Update registration status to REJECTED
    const updatedRegistration = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        registrationStatus: 'REJECTED',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: 'Registration rejected successfully',
      data: updatedRegistration,
    });
  } catch (error) {
    console.error('Reject registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting registration',
      error: error.message,
    });
  }
};

// @desc    Unregister a participant from tournament (admin/organizer or self)
// @route   DELETE /api/tournaments/:id/registrations/:registrationId
// @access  Private (Admin/Organizer or Self)
const unregisterParticipant = async (req, res) => {
  try {
    const { id, registrationId } = req.params;

    // Get tournament with organizer info
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        name: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Get the registration
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    // Check if registration belongs to this tournament
    if (registration.tournamentId !== id) {
      return res.status(400).json({
        success: false,
        message: 'Registration does not belong to this tournament',
      });
    }

    // Check if user is admin, organizer, or unregistering themselves
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';
    const isSelf = registration.userId === req.user.id;

    if (!isOrganizer && !isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to unregister this participant',
      });
    }

    // Delete the registration
    await prisma.registration.delete({
      where: { id: registrationId },
    });

    res.status(200).json({
      success: true,
      message: 'Participant unregistered successfully',
      data: { registrationId, userName: registration.user.fullName || registration.user.username },
    });
  } catch (error) {
    console.error('Unregister participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Error unregistering participant',
      error: error.message,
    });
  }
};

// @desc    Toggle pause/resume tournament
// @route   PUT /api/tournaments/:id/toggle-pause
// @access  Private (Organizer/Admin only)
const togglePauseTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find the tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the creator or an admin/organizer
    const isCreator = tournament.createdById === userId;
    const isAuthorized = isCreator || userRole === 'ROOT' || userRole === 'ADMIN' || userRole === 'ORGANIZER';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to pause/resume this tournament',
      });
    }

    // Can only pause/resume ACTIVE tournaments
    if (tournament.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Can only pause/resume active tournaments',
      });
    }

    const now = new Date();
    let updateData = {};

    if (tournament.isPaused) {
      // Resume tournament
      if (tournament.pausedAt) {
        const pauseDuration = Math.floor((now - new Date(tournament.pausedAt)) / 1000);
        updateData = {
          isPaused: false,
          pausedAt: null,
          totalPausedTime: tournament.totalPausedTime + pauseDuration,
        };
      } else {
        updateData = {
          isPaused: false,
          pausedAt: null,
        };
      }
    } else {
      // Pause tournament
      updateData = {
        isPaused: true,
        pausedAt: now,
      };
    }

    const updatedTournament = await prisma.tournament.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
        registrations: {
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
        _count: {
          select: {
            registrations: true,
            matches: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: `Tournament ${updatedTournament.isPaused ? 'paused' : 'resumed'} successfully`,
      data: updatedTournament,
    });
  } catch (error) {
    console.error('Toggle pause tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling tournament pause state',
      error: error.message,
    });
  }
};

// @desc    Toggle tournament registration open/closed
// @route   PUT /api/tournaments/:id/toggle-registration
// @access  Private (Organizer/Admin only)
const toggleRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find the tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the creator or an admin/organizer
    const isCreator = tournament.createdById === userId;
    const isAuthorized = isCreator || userRole === 'ROOT' || userRole === 'ADMIN' || userRole === 'ORGANIZER';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to toggle registration for this tournament',
      });
    }

    // Can only toggle registration for OPEN tournaments
    if (tournament.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: 'Can only toggle registration for tournaments that are open for registration',
      });
    }

    const updatedTournament = await prisma.tournament.update({
      where: { id },
      data: {
        registrationClosed: !tournament.registrationClosed,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
          },
        },
        registrations: {
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
        _count: {
          select: {
            registrations: true,
            matches: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: `Registration ${updatedTournament.registrationClosed ? 'closed' : 'opened'} successfully`,
      data: updatedTournament,
    });
  } catch (error) {
    console.error('Toggle registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling registration status',
      error: error.message,
    });
  }
};

// @desc    Get tournament bracket
// @route   GET /api/tournaments/:id/bracket
// @access  Public
const getBracket = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        bracketNodes: {
          include: {
            match: {
              include: {
                team1: {
                  include: {
                    player1: {
                      select: {
                        id: true,
                        username: true,
                        fullName: true,
                      },
                    },
                    player2: {
                      select: {
                        id: true,
                        username: true,
                        fullName: true,
                      },
                    },
                  },
                },
                team2: {
                  include: {
                    player1: {
                      select: {
                        id: true,
                        username: true,
                        fullName: true,
                      },
                    },
                    player2: {
                      select: {
                        id: true,
                        username: true,
                        fullName: true,
                      },
                    },
                  },
                },
              },
            },
            nextNode: true,
            loserNextNode: true,
          },
          orderBy: [
            { roundNumber: 'asc' },
            { position: 'asc' },
          ],
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    if (!tournament.bracketGenerated) {
      return res.status(400).json({
        success: false,
        message: 'Bracket has not been generated yet',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          format: tournament.format,
          bracketGenerated: tournament.bracketGenerated,
          bracketGeneratedAt: tournament.bracketGeneratedAt,
        },
        bracketNodes: tournament.bracketNodes,
      },
    });
  } catch (error) {
    console.error('Get bracket error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting bracket',
      error: error.message,
    });
  }
};

// @desc    Regenerate tournament bracket
// @route   POST /api/tournaments/:id/regenerate-bracket
// @access  Private (ADMIN, ORGANIZER - owner only)
const regenerateBracket = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        bracketNodes: true,
        matches: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check authorization
    if (tournament.createdById !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'ROOT') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to regenerate bracket',
      });
    }

    // Can only regenerate if no matches have started
    const hasStartedMatches = tournament.matches.some(
      (match) => match.matchStatus === 'LIVE' || match.matchStatus === 'COMPLETED'
    );

    if (hasStartedMatches) {
      return res.status(400).json({
        success: false,
        message: 'Cannot regenerate bracket after matches have started',
      });
    }

    // Delete existing bracket and matches
    await prisma.$transaction([
      prisma.match.deleteMany({ where: { tournamentId: id } }),
      prisma.bracketNode.deleteMany({ where: { tournamentId: id } }),
      prisma.tournament.update({
        where: { id },
        data: {
          bracketGenerated: false,
          bracketGeneratedAt: null,
        },
      }),
    ]);

    // Generate new bracket
    const result = await bracketService.generateBracket(
      id,
      tournament.format,
      tournament.seedingMethod || 'RANDOM'
    );

    res.status(200).json({
      success: true,
      message: 'Bracket regenerated successfully',
      data: result,
    });
  } catch (error) {
    console.error('Regenerate bracket error:', error);
    res.status(500).json({
      success: false,
      message: 'Error regenerating bracket',
      error: error.message,
    });
  }
};

// @desc    Approve all pending registrations for a tournament
// @route   PUT /api/tournaments/:id/registrations/approve-all
// @access  Private (Organizer/Admin only)
const approveAllPendingRegistrations = async (req, res) => {
  try {
    const { id } = req.params;

    // Get tournament with organizer info
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        name: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the organizer or admin
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can approve registrations',
      });
    }

    // Update all pending and rejected registrations to APPROVED
    const result = await prisma.registration.updateMany({
      where: {
        tournamentId: id,
        registrationStatus: {
          in: ['PENDING', 'REJECTED'],
        },
      },
      data: {
        registrationStatus: 'APPROVED',
      },
    });

    res.status(200).json({
      success: true,
      message: `${result.count} registration${result.count !== 1 ? 's' : ''} approved successfully`,
      data: {
        approvedCount: result.count,
      },
    });
  } catch (error) {
    console.error('Approve all registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving registrations',
      error: error.message,
    });
  }
};

// @desc    Replace a no-show team with a late-arriving player
// @route   PUT /api/tournaments/:id/matches/:matchId/replace-team
// @access  Private (Organizer/Admin only)
const replaceNoShowTeam = async (req, res) => {
  try {
    const { id: tournamentId, matchId } = req.params;
    const { teamToReplaceId, newUserId } = req.body;

    if (!teamToReplaceId || !newUserId) {
      return res.status(400).json({
        success: false,
        message: 'teamToReplaceId and newUserId are required',
      });
    }

    // Get tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        createdById: true,
        name: true,
        status: true,
        tournamentType: true,
        maxParticipants: true,
        registrations: {
          select: { id: true, userId: true },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the organizer or admin
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can replace teams',
      });
    }

    // Get the match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        team1: {
          include: {
            player1: { select: { id: true, username: true, fullName: true } },
          },
        },
        team2: {
          include: {
            player1: { select: { id: true, username: true, fullName: true } },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found',
      });
    }

    if (match.tournamentId !== tournamentId) {
      return res.status(400).json({
        success: false,
        message: 'Match does not belong to this tournament',
      });
    }

    // Check match status - can only replace before match is completed
    if (match.matchStatus === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot replace team in a completed match',
      });
    }

    // Verify teamToReplaceId is one of the teams in the match
    if (match.team1Id !== teamToReplaceId && match.team2Id !== teamToReplaceId) {
      return res.status(400).json({
        success: false,
        message: 'Team to replace is not part of this match',
      });
    }

    // Get the new user
    const newUser = await prisma.user.findUnique({
      where: { id: newUserId },
      select: { id: true, username: true, fullName: true },
    });

    if (!newUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is already registered in this tournament
    const existingRegistration = tournament.registrations.find(
      (reg) => reg.userId === newUserId
    );

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create registration for new user if not exists
      let registration;
      if (!existingRegistration) {
        registration = await tx.registration.create({
          data: {
            tournamentId,
            userId: newUserId,
            registrationStatus: 'APPROVED', // Auto-approve late registration
          },
        });
      }

      // Create a new team for the new user (singles tournament style)
      const newTeam = await tx.team.create({
        data: {
          tournamentId,
          player1Id: newUserId,
          player2Id: newUserId, // Same player for singles
          teamName: newUser.fullName || newUser.username,
        },
        include: {
          player1: { select: { id: true, username: true, fullName: true } },
          player2: { select: { id: true, username: true, fullName: true } },
        },
      });

      // Update the match to use the new team
      const updateData = match.team1Id === teamToReplaceId
        ? { team1Id: newTeam.id }
        : { team2Id: newTeam.id };

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: updateData,
        include: {
          team1: {
            include: {
              player1: { select: { id: true, username: true, fullName: true } },
              player2: { select: { id: true, username: true, fullName: true } },
            },
          },
          team2: {
            include: {
              player1: { select: { id: true, username: true, fullName: true } },
              player2: { select: { id: true, username: true, fullName: true } },
            },
          },
          tournament: {
            select: { id: true, name: true },
          },
        },
      });

      return { updatedMatch, newTeam, registration };
    });

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${tournamentId}`).emit('match:teamReplaced', {
        matchId,
        match: result.updatedMatch,
      });
    }

    res.status(200).json({
      success: true,
      message: `Team replaced successfully. ${newUser.fullName || newUser.username} has joined the match.`,
      data: result.updatedMatch,
    });
  } catch (error) {
    console.error('Replace no-show team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error replacing team',
      error: error.message,
    });
  }
};

/**
 * Reset a tournament - deletes all matches, teams, and bracket nodes
 * Allows the tournament to have its bracket regenerated fresh
 */
const resetTournament = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        registrations: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check authorization - only organizer or admin can reset
    const isOrganizer = tournament.organizerId === userId;
    const isAdmin = userRole === 'ROOT' || userRole === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reset this tournament',
      });
    }

    // Perform reset in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all match events first (if any)
      await tx.matchEvent.deleteMany({
        where: {
          match: {
            tournamentId: id,
          },
        },
      });

      // Delete all matches for this tournament
      await tx.match.deleteMany({
        where: { tournamentId: id },
      });

      // Delete all bracket nodes
      await tx.bracketNode.deleteMany({
        where: { tournamentId: id },
      });

      // Delete all teams for this tournament
      await tx.team.deleteMany({
        where: { tournamentId: id },
      });

      // Reset tournament bracket flags and re-open registrations
      await tx.tournament.update({
        where: { id },
        data: {
          bracketGenerated: false,
          bracketGeneratedAt: null,
          registrationClosed: false, // Re-open registrations so players can join
          status: 'OPEN', // Change status back to OPEN to allow registrations
          isPaused: false,
          pausedAt: null,
          startedAt: null, // Reset the started timestamp
          totalPausedTime: 0,
          groupStageComplete: false, // Reset group stage / knockout progression flag
        },
      });
    });

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournament:reset', {
        tournamentId: id,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Tournament has been reset. Registrations are now open and players can join if space is available.',
    });
  } catch (error) {
    console.error('Reset tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting tournament',
      error: error.message,
    });
  }
};

// @desc    Get group standings for a GROUP_KNOCKOUT tournament
// @route   GET /api/tournaments/:id/group-standings
// @access  Public
const getGroupStandings = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        format: true,
        numberOfGroups: true,
        advancingPerGroup: true,
        groupStageComplete: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    if (tournament.format !== 'GROUP_KNOCKOUT') {
      return res.status(400).json({
        success: false,
        message: 'This tournament does not use group stage format',
      });
    }

    const standings = await bracketService.getGroupStandings(id);

    res.status(200).json({
      success: true,
      data: {
        standings,
        numberOfGroups: tournament.numberOfGroups,
        advancingPerGroup: tournament.advancingPerGroup,
        groupStageComplete: tournament.groupStageComplete,
      },
    });
  } catch (error) {
    console.error('Get group standings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting group standings',
      error: error.message,
    });
  }
};

// @desc    Complete group stage and generate knockout bracket
// @route   POST /api/tournaments/:id/complete-group-stage
// @access  Private (Organizer/Admin only)
const completeGroupStage = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check authorization
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to complete group stage',
      });
    }

    if (tournament.format !== 'GROUP_KNOCKOUT') {
      return res.status(400).json({
        success: false,
        message: 'This tournament does not use group stage format',
      });
    }

    if (tournament.groupStageComplete) {
      return res.status(400).json({
        success: false,
        message: 'Group stage is already complete',
      });
    }

    const result = await bracketService.completeGroupStage(id);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournament:groupStageComplete', {
        tournamentId: id,
        qualifiedTeams: result.data.qualifiedTeams,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Group stage completed and knockout bracket generated',
      data: result.data,
    });
  } catch (error) {
    console.error('Complete group stage error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error completing group stage',
    });
  }
};

// @desc    Assign a registration to a specific group (for manual group assignment)
// @route   PUT /api/tournaments/:id/registrations/:registrationId/assign-group
// @access  Private (Organizer/Admin only)
const assignToGroup = async (req, res) => {
  try {
    const { id, registrationId } = req.params;
    const { groupName } = req.body;

    if (!groupName) {
      return res.status(400).json({
        success: false,
        message: 'groupName is required',
      });
    }

    // Validate group name (A-H)
    const validGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    if (!validGroups.includes(groupName.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group name. Must be A-H.',
      });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        format: true,
        numberOfGroups: true,
        bracketGenerated: true,
        status: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check authorization
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can assign groups',
      });
    }

    // Check if tournament uses group format
    if (tournament.format !== 'GROUP_KNOCKOUT') {
      return res.status(400).json({
        success: false,
        message: 'This tournament does not use group stage format',
      });
    }

    // Check if bracket is already generated
    if (tournament.bracketGenerated) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change group assignments after bracket is generated. Reset the tournament first.',
      });
    }

    // Validate group index is within numberOfGroups
    const groupIndex = groupName.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
    if (groupIndex >= (tournament.numberOfGroups || 4)) {
      return res.status(400).json({
        success: false,
        message: `Invalid group. This tournament only has ${tournament.numberOfGroups || 4} groups.`,
      });
    }

    // Get registration
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        user: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    if (registration.tournamentId !== id) {
      return res.status(400).json({
        success: false,
        message: 'Registration does not belong to this tournament',
      });
    }

    // Update the registration with the group assignment
    const updatedRegistration = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        groupAssignment: groupName.toUpperCase(),
      },
      include: {
        user: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: `Player assigned to Group ${groupName.toUpperCase()}`,
      data: updatedRegistration,
    });
  } catch (error) {
    console.error('Assign to group error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning player to group',
      error: error.message,
    });
  }
};

// @desc    Get all group assignments for a tournament
// @route   GET /api/tournaments/:id/group-assignments
// @access  Public
const getGroupAssignments = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        format: true,
        numberOfGroups: true,
        bracketGenerated: true,
        registrations: {
          where: {
            registrationStatus: 'APPROVED',
          },
          include: {
            user: {
              select: { id: true, username: true, fullName: true },
            },
          },
          orderBy: {
            registeredAt: 'asc',
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    if (tournament.format !== 'GROUP_KNOCKOUT') {
      return res.status(400).json({
        success: false,
        message: 'This tournament does not use group stage format',
      });
    }

    // Organize registrations by group
    const groups = {};
    const unassigned = [];
    const numberOfGroups = tournament.numberOfGroups || 4;

    // Initialize groups
    for (let i = 0; i < numberOfGroups; i++) {
      const groupName = String.fromCharCode(65 + i);
      groups[groupName] = [];
    }

    // Sort registrations into groups
    tournament.registrations.forEach((reg) => {
      if (reg.groupAssignment && groups[reg.groupAssignment]) {
        groups[reg.groupAssignment].push(reg);
      } else {
        unassigned.push(reg);
      }
    });

    res.status(200).json({
      success: true,
      data: {
        groups,
        unassigned,
        numberOfGroups,
        bracketGenerated: tournament.bracketGenerated,
        totalRegistrations: tournament.registrations.length,
      },
    });
  } catch (error) {
    console.error('Get group assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting group assignments',
      error: error.message,
    });
  }
};

// @desc    Auto-assign all unassigned players to groups using snake seeding
// @route   POST /api/tournaments/:id/auto-assign-groups
// @access  Private (Organizer/Admin only)
const autoAssignGroups = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        format: true,
        numberOfGroups: true,
        bracketGenerated: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check authorization
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can auto-assign groups',
      });
    }

    if (tournament.format !== 'GROUP_KNOCKOUT') {
      return res.status(400).json({
        success: false,
        message: 'This tournament does not use group stage format',
      });
    }

    if (tournament.bracketGenerated) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change group assignments after bracket is generated',
      });
    }

    // Get unassigned registrations
    const unassignedRegistrations = await prisma.registration.findMany({
      where: {
        tournamentId: id,
        registrationStatus: 'APPROVED',
        OR: [
          { groupAssignment: null },
          { groupAssignment: '' },
        ],
      },
      orderBy: { registeredAt: 'asc' },
    });

    if (unassignedRegistrations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No unassigned players to distribute',
        data: { assignedCount: 0 },
      });
    }

    const numberOfGroups = tournament.numberOfGroups || 4;

    // Use snake seeding to distribute
    const updates = unassignedRegistrations.map((reg, index) => {
      const round = Math.floor(index / numberOfGroups);
      let groupIndex;
      if (round % 2 === 0) {
        groupIndex = index % numberOfGroups;
      } else {
        groupIndex = numberOfGroups - 1 - (index % numberOfGroups);
      }
      const groupName = String.fromCharCode(65 + groupIndex);

      return prisma.registration.update({
        where: { id: reg.id },
        data: { groupAssignment: groupName },
      });
    });

    await prisma.$transaction(updates);

    res.status(200).json({
      success: true,
      message: `${unassignedRegistrations.length} players auto-assigned to groups`,
      data: { assignedCount: unassignedRegistrations.length },
    });
  } catch (error) {
    console.error('Auto-assign groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Error auto-assigning groups',
      error: error.message,
    });
  }
};

// @desc    Shuffle all players randomly into groups
// @route   POST /api/tournaments/:id/shuffle-groups
// @access  Private (Organizer/Admin only)
const shuffleGroups = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        format: true,
        numberOfGroups: true,
        bracketGenerated: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check authorization
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can shuffle groups',
      });
    }

    if (tournament.format !== 'GROUP_KNOCKOUT') {
      return res.status(400).json({
        success: false,
        message: 'This tournament does not use group stage format',
      });
    }

    if (tournament.bracketGenerated) {
      return res.status(400).json({
        success: false,
        message: 'Cannot shuffle groups after bracket is generated',
      });
    }

    // Get ALL approved registrations
    const registrations = await prisma.registration.findMany({
      where: {
        tournamentId: id,
        registrationStatus: 'APPROVED',
      },
      orderBy: { registeredAt: 'asc' },
    });

    if (registrations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No players to shuffle',
        data: { shuffledCount: 0 },
      });
    }

    const numberOfGroups = tournament.numberOfGroups || 4;

    // Shuffle the registrations array randomly
    const shuffled = [...registrations];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Use snake seeding to distribute shuffled players
    const updates = shuffled.map((reg, index) => {
      const round = Math.floor(index / numberOfGroups);
      let groupIndex;
      if (round % 2 === 0) {
        groupIndex = index % numberOfGroups;
      } else {
        groupIndex = numberOfGroups - 1 - (index % numberOfGroups);
      }
      const groupName = String.fromCharCode(65 + groupIndex);

      return prisma.registration.update({
        where: { id: reg.id },
        data: { groupAssignment: groupName },
      });
    });

    await prisma.$transaction(updates);

    res.status(200).json({
      success: true,
      message: `${registrations.length} players shuffled into groups`,
      data: { shuffledCount: registrations.length },
    });
  } catch (error) {
    console.error('Shuffle groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Error shuffling groups',
      error: error.message,
    });
  }
};

// @desc    Convert Round Robin to knockout stage
// @route   POST /api/tournaments/:id/round-robin-to-knockout
// @access  Private (Organizer/Admin only)
const roundRobinToKnockout = async (req, res) => {
  try {
    const { id } = req.params;
    const { advancePlayers = 4 } = req.body;

    // Validate advancePlayers
    if (![2, 4, 8].includes(advancePlayers)) {
      return res.status(400).json({
        success: false,
        message: 'advancePlayers must be 2, 4, or 8',
      });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check authorization
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this tournament',
      });
    }

    if (tournament.format !== 'ROUND_ROBIN') {
      return res.status(400).json({
        success: false,
        message: 'This tournament is not Round Robin format',
      });
    }

    if (tournament.groupStageComplete) {
      return res.status(400).json({
        success: false,
        message: 'Knockout stage has already been created',
      });
    }

    // Check if there are enough players for the selected playoff size
    const teamCount = tournament.teams.length;
    if (teamCount < advancePlayers) {
      return res.status(400).json({
        success: false,
        message: `Not enough players for playoffs. You have ${teamCount} players but selected Top ${advancePlayers}. Please choose a smaller playoff size or use "Declare Winners" instead.`,
      });
    }

    const result = await bracketService.completeRoundRobinToKnockout(id, advancePlayers);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournament:knockoutCreated', {
        tournamentId: id,
        qualifiedTeams: result.data.qualifiedTeams,
      });
    }

    res.status(200).json({
      success: true,
      message: `Knockout bracket created with top ${advancePlayers} players`,
      data: result.data,
    });
  } catch (error) {
    console.error('Round robin to knockout error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating knockout bracket',
    });
  }
};

// @desc    Declare winners for Round Robin tournament
// @route   POST /api/tournaments/:id/declare-winners
// @access  Private (Organizer/Admin only)
const declareWinners = async (req, res) => {
  try {
    const { id } = req.params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: true,
        matches: {
          include: {
            team1: true,
            team2: true,
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check authorization
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this tournament',
      });
    }

    if (tournament.format !== 'ROUND_ROBIN') {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is only for Round Robin tournaments',
      });
    }

    // Check all matches are completed
    const incompleteMatches = tournament.matches.filter(m => m.matchStatus !== 'COMPLETED').length;
    if (incompleteMatches > 0) {
      return res.status(400).json({
        success: false,
        message: `${incompleteMatches} matches are not yet completed`,
      });
    }

    // Calculate standings
    const teamStats = {};
    tournament.teams.forEach((team) => {
      teamStats[team.id] = {
        team,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
    });

    tournament.matches.forEach((match) => {
      if (match.matchStatus !== 'COMPLETED' || !match.winnerId) return;

      const stats1 = teamStats[match.team1Id];
      const stats2 = teamStats[match.team2Id];

      if (!stats1 || !stats2) return;

      if (match.winnerId === match.team1Id) {
        stats1.wins++;
        stats2.losses++;
      } else {
        stats2.wins++;
        stats1.losses++;
      }

      if (match.team1Score && typeof match.team1Score === 'string') {
        const scores = match.team1Score.split(',').map(s => parseInt(s, 10) || 0);
        stats1.pointsFor += scores.reduce((sum, score) => sum + score, 0);
      }
      if (match.team2Score && typeof match.team2Score === 'string') {
        const scores = match.team2Score.split(',').map(s => parseInt(s, 10) || 0);
        stats2.pointsFor += scores.reduce((sum, score) => sum + score, 0);
      }
    });

    // Sort and get top 3
    const sortedTeams = Object.values(teamStats).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aDiff = a.pointsFor - a.pointsAgainst;
      const bDiff = b.pointsFor - b.pointsAgainst;
      if (bDiff !== aDiff) return bDiff - aDiff;
      return b.pointsFor - a.pointsFor;
    });

    const winners = sortedTeams.slice(0, 3).map((stat, index) => ({
      place: index + 1,
      teamId: stat.team.id,
      teamName: stat.team.teamName,
      wins: stat.wins,
      losses: stat.losses,
    }));

    // Mark tournament as completed
    await prisma.tournament.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`tournament-${id}`).emit('tournament:completed', {
        tournamentId: id,
        winners,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Winners declared and tournament completed',
      data: { winners },
    });
  } catch (error) {
    console.error('Declare winners error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error declaring winners',
    });
  }
};

// @desc    Get potential partners for doubles registration
// @route   GET /api/tournaments/:id/potential-partners
// @access  Private
const getPotentialPartners = async (req, res) => {
  try {
    const { id } = req.params;
    const { search } = req.query;
    const currentUserId = req.user.id;

    // Get tournament to verify it exists and is DOUBLES/MIXED
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          select: { userId: true, partnerId: true },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    if (tournament.tournamentType !== 'DOUBLES' && tournament.tournamentType !== 'MIXED') {
      return res.status(400).json({
        success: false,
        message: 'Partner selection only available for doubles/mixed tournaments',
      });
    }

    // Get users who are already registered AND have a partner assigned
    const registeredWithPartner = new Set(
      tournament.registrations
        .filter(reg => reg.partnerId)
        .map(reg => reg.userId)
    );

    // Build search query
    const where = {
      id: { not: currentUserId }, // Exclude self
      NOT: {
        id: { in: Array.from(registeredWithPartner) }, // Exclude users who already have a partner
      },
    };

    // Add search filter if provided
    if (search && search.trim()) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const potentialPartners = await prisma.user.findMany({
      where,
      take: 20,
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
      },
      orderBy: [
        { fullName: 'asc' },
        { username: 'asc' },
      ],
    });

    // Mark users who are already registered (but without partner)
    const registeredUserIds = new Set(tournament.registrations.map(reg => reg.userId));
    const partnersWithStatus = potentialPartners.map(user => ({
      ...user,
      isRegistered: registeredUserIds.has(user.id),
    }));

    res.status(200).json({
      success: true,
      data: partnersWithStatus,
    });
  } catch (error) {
    console.error('Get potential partners error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching potential partners',
      error: error.message,
    });
  }
};

// @desc    Assign partner to a registration (admin only)
// @route   PUT /api/tournaments/:id/registrations/:registrationId/assign-partner
// @access  Private (Organizer/Admin)
const assignPartner = async (req, res) => {
  try {
    const { id, registrationId } = req.params;
    const { partnerRegistrationId } = req.body;

    // Get tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            user: { select: { id: true, fullName: true, username: true } },
          },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    // Check if user is organizer/admin
    const isOrganizer = req.user.role === 'ROOT' || req.user.role === 'ADMIN' || req.user.role === 'ORGANIZER';
    const isCreator = tournament.createdById === req.user.id;
    if (!isOrganizer && !isCreator) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Check tournament type
    if (tournament.tournamentType !== 'DOUBLES' && tournament.tournamentType !== 'MIXED') {
      return res.status(400).json({ success: false, message: 'Partner assignment is only for doubles tournaments' });
    }

    // Find the registration to update
    const registration = tournament.registrations.find(r => r.id === registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // If clearing partner (partnerRegistrationId is null)
    if (!partnerRegistrationId) {
      // Also clear the old partner's link back to this player
      const oldPartnerId = registration.partnerId;
      const updates = [
        prisma.registration.update({
          where: { id: registrationId },
          data: { partnerId: null },
        }),
      ];

      // If there was an old partner, clear their link too
      if (oldPartnerId) {
        const oldPartnerReg = tournament.registrations.find(r => r.userId === oldPartnerId);
        if (oldPartnerReg && oldPartnerReg.partnerId === registration.userId) {
          updates.push(
            prisma.registration.update({
              where: { id: oldPartnerReg.id },
              data: { partnerId: null },
            })
          );
        }
      }

      await prisma.$transaction(updates);

      return res.status(200).json({
        success: true,
        message: 'Partner cleared successfully',
      });
    }

    // Find the partner's registration
    const partnerRegistration = tournament.registrations.find(r => r.id === partnerRegistrationId);
    if (!partnerRegistration) {
      return res.status(404).json({ success: false, message: 'Partner registration not found' });
    }

    // Can't partner with yourself
    if (registration.userId === partnerRegistration.userId) {
      return res.status(400).json({ success: false, message: 'Cannot partner with yourself' });
    }

    // Build updates array - clear old partners first, then set new ones
    const updates = [];

    // Clear old partner of registration if exists
    if (registration.partnerId) {
      const oldPartnerReg = tournament.registrations.find(r => r.userId === registration.partnerId);
      if (oldPartnerReg && oldPartnerReg.partnerId === registration.userId) {
        updates.push(
          prisma.registration.update({
            where: { id: oldPartnerReg.id },
            data: { partnerId: null },
          })
        );
      }
    }

    // Clear old partner of new partner if exists
    if (partnerRegistration.partnerId) {
      const oldPartnerReg = tournament.registrations.find(r => r.userId === partnerRegistration.partnerId);
      if (oldPartnerReg && oldPartnerReg.partnerId === partnerRegistration.userId) {
        updates.push(
          prisma.registration.update({
            where: { id: oldPartnerReg.id },
            data: { partnerId: null },
          })
        );
      }
    }

    // Set new partnership
    updates.push(
      prisma.registration.update({
        where: { id: registrationId },
        data: { partnerId: partnerRegistration.userId },
      }),
      prisma.registration.update({
        where: { id: partnerRegistrationId },
        data: { partnerId: registration.userId },
      })
    );

    await prisma.$transaction(updates);

    res.status(200).json({
      success: true,
      message: `${registration.user.fullName || registration.user.username} paired with ${partnerRegistration.user.fullName || partnerRegistration.user.username}`,
    });
  } catch (error) {
    console.error('Assign partner error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning partner',
      error: error.message,
    });
  }
};

// @desc    Approve a team where the partner hasn't registered yet (creates their registration)
// @route   PUT /api/tournaments/:id/registrations/:registrationId/approve-team
// @access  Private (Organizer/Admin only)
const approveTeamWithPendingPartner = async (req, res) => {
  try {
    const { id, registrationId } = req.params;

    // Get tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        name: true,
        tournamentType: true,
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the organizer or admin
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can approve registrations',
      });
    }

    // Get the registration with partner info
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
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

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    if (registration.tournamentId !== id) {
      return res.status(400).json({
        success: false,
        message: 'Registration does not belong to this tournament',
      });
    }

    if (!registration.partnerId) {
      return res.status(400).json({
        success: false,
        message: 'This registration does not have a partner selected',
      });
    }

    // Check if partner already has a registration
    const existingPartnerReg = await prisma.registration.findUnique({
      where: {
        userId_tournamentId: {
          userId: registration.partnerId,
          tournamentId: id,
        },
      },
    });

    if (existingPartnerReg) {
      // Partner already registered - just approve both
      await prisma.registration.updateMany({
        where: {
          id: { in: [registration.id, existingPartnerReg.id] },
        },
        data: { registrationStatus: 'APPROVED' },
      });

      return res.status(200).json({
        success: true,
        message: 'Team approved successfully',
      });
    }

    // Partner hasn't registered - create their registration and approve both
    const partnerUser = await prisma.user.findUnique({
      where: { id: registration.partnerId },
      select: {
        id: true,
        username: true,
        fullName: true,
      },
    });

    if (!partnerUser) {
      return res.status(404).json({
        success: false,
        message: 'Partner user not found',
      });
    }

    // Create partner's registration with partnerId pointing back to the original registrant
    const partnerRegistration = await prisma.registration.create({
      data: {
        userId: partnerUser.id,
        tournamentId: id,
        partnerId: registration.userId,
        registrationStatus: 'APPROVED',
        paymentStatus: 'PENDING',
      },
    });

    // Approve the original registration
    await prisma.registration.update({
      where: { id: registrationId },
      data: { registrationStatus: 'APPROVED' },
    });

    const playerName = registration.user.fullName || registration.user.username;
    const partnerName = partnerUser.fullName || partnerUser.username;

    res.status(200).json({
      success: true,
      message: `Team "${playerName} & ${partnerName}" approved successfully`,
    });
  } catch (error) {
    console.error('Approve team with pending partner error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving team',
      error: error.message,
    });
  }
};

// @desc    Admin registers a team (two players) directly
// @route   POST /api/tournaments/:id/register-team
// @access  Private (Organizer/Admin only)
const adminRegisterTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { player1Id, player2Id } = req.body;

    if (!player1Id || !player2Id) {
      return res.status(400).json({
        success: false,
        message: 'Both player1Id and player2Id are required',
      });
    }

    if (player1Id === player2Id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot register the same player twice',
      });
    }

    // Get tournament
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        name: true,
        tournamentType: true,
        maxParticipants: true,
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    // Check if user is the organizer or admin
    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can register teams',
      });
    }

    // Check tournament type
    if (tournament.tournamentType !== 'DOUBLES' && tournament.tournamentType !== 'MIXED') {
      return res.status(400).json({
        success: false,
        message: 'Team registration is only for DOUBLES or MIXED tournaments',
      });
    }

    // Get both players
    const [player1, player2] = await Promise.all([
      prisma.user.findUnique({
        where: { id: player1Id },
        select: { id: true, username: true, fullName: true },
      }),
      prisma.user.findUnique({
        where: { id: player2Id },
        select: { id: true, username: true, fullName: true },
      }),
    ]);

    if (!player1 || !player2) {
      return res.status(404).json({
        success: false,
        message: 'One or both players not found',
      });
    }

    // Check if either player is already registered
    const existingRegs = await prisma.registration.findMany({
      where: {
        tournamentId: id,
        userId: { in: [player1Id, player2Id] },
      },
    });

    if (existingRegs.length > 0) {
      const registeredNames = existingRegs.map(r => {
        const p = r.userId === player1Id ? player1 : player2;
        return p.fullName || p.username;
      });
      return res.status(400).json({
        success: false,
        message: `${registeredNames.join(' and ')} already registered for this tournament`,
      });
    }

    // Create both registrations
    const [reg1, reg2] = await Promise.all([
      prisma.registration.create({
        data: {
          userId: player1Id,
          tournamentId: id,
          partnerId: player2Id,
          registrationStatus: 'APPROVED',
          paymentStatus: 'PENDING',
        },
      }),
      prisma.registration.create({
        data: {
          userId: player2Id,
          tournamentId: id,
          partnerId: player1Id,
          registrationStatus: 'APPROVED',
          paymentStatus: 'PENDING',
        },
      }),
    ]);

    const player1Name = player1.fullName || player1.username;
    const player2Name = player2.fullName || player2.username;

    res.status(201).json({
      success: true,
      message: `Team "${player1Name} & ${player2Name}" registered successfully`,
      data: { registration1: reg1, registration2: reg2 },
    });
  } catch (error) {
    console.error('Admin register team error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering team',
      error: error.message,
    });
  }
};

// @desc    Admin registers a single player directly
// @route   POST /api/tournaments/:id/register-player
// @access  Private (Organizer/Admin only)
const adminRegisterPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: 'playerId is required',
      });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        name: true,
        tournamentType: true,
        maxParticipants: true,
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found',
      });
    }

    const isOrganizer = tournament.createdById === req.user.id;
    const isAdmin = req.user.role === 'ROOT' || req.user.role === 'ADMIN';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only tournament organizers can register players',
      });
    }

    if (tournament._count.registrations >= tournament.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Tournament is full',
      });
    }

    const player = await prisma.user.findUnique({
      where: { id: playerId },
      select: { id: true, username: true, fullName: true },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found',
      });
    }

    const existingReg = await prisma.registration.findUnique({
      where: {
        userId_tournamentId: {
          userId: playerId,
          tournamentId: id,
        },
      },
    });

    if (existingReg) {
      return res.status(400).json({
        success: false,
        message: `${player.fullName || player.username} is already registered for this tournament`,
      });
    }

    const registration = await prisma.registration.create({
      data: {
        userId: playerId,
        tournamentId: id,
        registrationStatus: 'APPROVED',
        paymentStatus: 'PENDING',
      },
      include: {
        user: {
          select: { id: true, username: true, fullName: true, email: true },
        },
      },
    });

    const playerName = player.fullName || player.username;

    res.status(201).json({
      success: true,
      message: `${playerName} registered successfully`,
      data: registration,
    });
  } catch (error) {
    console.error('Admin register player error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering player',
      error: error.message,
    });
  }
};

module.exports = {
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
};
