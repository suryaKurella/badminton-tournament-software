const { supabase } = require('../config/supabase');
const { prisma } = require('../config/database');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      // Verify token with Supabase
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

      if (error || !supabaseUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
        });
      }

      // Get or create user in our database
      let user = await prisma.user.findUnique({
        where: { id: supabaseUser.id },
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

      // If user doesn't exist by ID, check by email
      if (!user) {
        // Check if user exists by email (might have been manually created)
        user = await prisma.user.findUnique({
          where: { email: supabaseUser.email },
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

        // If still no user, create new one
        if (!user) {
          // Only use username from metadata if it's valid (from normal registration)
          // Don't auto-generate from email - let user choose via UsernameModal
          const username = supabaseUser.user_metadata?.username || null;

          user = await prisma.user.create({
            data: {
              id: supabaseUser.id,
              email: supabaseUser.email,
              username: username,
              fullName: supabaseUser.user_metadata?.full_name || null,
              phoneNumber: supabaseUser.user_metadata?.phone_number || null,
              role: supabaseUser.user_metadata?.role || 'PLAYER',
              avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
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
        }
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Middleware to check if user has specific role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    next();
  };
};

// Optional authentication - sets req.user if token is present, but doesn't fail if not
const optionalAuth = async (req, res, next) => {
  try {
    console.log('=== OPTIONAL AUTH MIDDLEWARE ===');
    console.log('Request path:', req.path);
    console.log('Authorization header:', req.headers.authorization ? 'Present' : 'Missing');

    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('Token extracted (first 20 chars):', token ? token.substring(0, 20) + '...' : 'null');
    }

    // If no token, just continue without setting req.user
    if (!token) {
      console.log('No token found, continuing without auth');
      return next();
    }

    try {
      console.log('Verifying token with Supabase...');
      // Verify token with Supabase
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

      if (error) {
        console.log('Supabase auth error:', error.message);
        // Invalid token, but we don't fail - just continue without req.user
        return next();
      }

      if (!supabaseUser) {
        console.log('No Supabase user returned');
        return next();
      }

      console.log('Supabase user verified:', { id: supabaseUser.id, email: supabaseUser.email });

      // Get or create user in our database
      console.log('Fetching user from database...');
      let user = await prisma.user.findUnique({
        where: { id: supabaseUser.id },
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

      // If user doesn't exist by ID, check by email
      if (!user) {
        console.log('User not found by ID, checking by email...');
        user = await prisma.user.findUnique({
          where: { email: supabaseUser.email },
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

        // If still no user, create new one
        if (!user) {
          console.log('User not found in database, creating new user...');
          // Only use username from metadata if it's valid (from normal registration)
          // Don't auto-generate from email - let user choose via UsernameModal
          const username = supabaseUser.user_metadata?.username || null;

          user = await prisma.user.create({
            data: {
              id: supabaseUser.id,
              email: supabaseUser.email,
              username: username,
              fullName: supabaseUser.user_metadata?.full_name || null,
              phoneNumber: supabaseUser.user_metadata?.phone_number || null,
              role: supabaseUser.user_metadata?.role || 'PLAYER',
              avatarUrl: supabaseUser.user_metadata?.avatar_url || null,
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
          console.log('New user created:', { id: user.id, role: user.role });
        }
      }

      if (user) {
        console.log('Database user found:', { id: user.id, role: user.role });
        req.user = user;
      }
    } catch (error) {
      // Token invalid, but we don't fail - just continue without req.user
      console.log('Optional auth token invalid:', error.message);
      console.error('Full error:', error);
    }

    console.log('OptionalAuth result - req.user:', req.user ? { id: req.user.id, role: req.user.role } : 'Not set');
    next();
  } catch (error) {
    // Continue even if there's an error
    console.error('OptionalAuth outer error:', error);
    next();
  }
};

module.exports = { protect, authorize, optionalAuth };
