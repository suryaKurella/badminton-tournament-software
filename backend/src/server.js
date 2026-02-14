require('dotenv').config();

// Validate environment variables before starting
const { validateEnv } = require('./config/env.validation');
validateEnv();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { connectDB } = require('./config/database');
const { setupMatchSocket } = require('./socket/match.socket');
const { setSocketIO } = require('./controllers/match.controller');

// Import routes
const authRoutes = require('./routes/auth.routes');
const tournamentRoutes = require('./routes/tournament.routes');
const matchRoutes = require('./routes/match.routes');
const userRoutes = require('./routes/user.routes');
const statisticsRoutes = require('./routes/statistics.routes');
const clubRoutes = require('./routes/club.routes');

// Initialize Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

// Connect to database
connectDB();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, configure properly in production
  crossOriginEmbedderPolicy: false,
}));

// Compression middleware
app.use(compression());

// CORS - MUST come before rate limiting so rate limit responses have CORS headers
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600, // Cache preflight for 10 minutes
  })
);

// Rate limiting - higher limits for development
const isDev = process.env.NODE_ENV !== 'production';
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 5000 : 500, // 5000 in dev, 500 in production
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100 : 20, // 100 in dev, 20 in production
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Setup Socket.io
setupMatchSocket(io);
setSocketIO(io);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Badminton Tournament Management API',
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/clubs', clubRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

  // Don't expose error details in production
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message: status === 500 && process.env.NODE_ENV === 'production'
      ? 'An error occurred while processing your request'
      : message,
    ...(process.env.NODE_ENV === 'development' && {
      error: err.message,
      stack: err.stack
    }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io enabled for real-time updates`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}\n`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  httpServer.close(() => process.exit(1));
});
