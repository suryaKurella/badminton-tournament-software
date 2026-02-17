const { supabase } = require('../config/supabase');
const { prisma } = require('../config/database');

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  phoneNumber: true,
  role: true,
  avatarUrl: true,
  createdAt: true,
};

// Shared helper to find or create a user from Supabase auth data
const findOrCreateUser = async (supabaseUser) => {
  // Try by ID first
  let user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: USER_SELECT,
  });

  if (user) return user;

  // Try by email (might have been manually created)
  user = await prisma.user.findUnique({
    where: { email: supabaseUser.email },
    select: USER_SELECT,
  });

  if (user) return user;

  // Create new user
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
    select: USER_SELECT,
  });

  return user;
};

const protect = async (req, res, next) => {
  try {
    let token;

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
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

      if (error || !supabaseUser) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
        });
      }

      req.user = await findOrCreateUser(supabaseUser);
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
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
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    try {
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);

      if (error || !supabaseUser) {
        return next();
      }

      req.user = await findOrCreateUser(supabaseUser);
    } catch (error) {
      // Token invalid, continue without req.user
    }

    next();
  } catch (error) {
    // Continue even if there's an error
    next();
  }
};

module.exports = { protect, authorize, optionalAuth };
